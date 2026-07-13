"""
GET    /records?cycleId=x  – list records for a cycle (date-sorted, paginated)
POST   /records             – create daily record
POST   /records/upload-photo – upload a base64 activity photo to S3, returns its URL
POST   /records/advice      – admin gives advice on a crop cycle (the one write admin can make)
GET    /records/{id}        – get record by recordId (via GSI)
PUT    /records/{id}        – update record
DELETE /records/{id}        – delete record

Ownership: a FARMER may only touch records on their own crop cycle; ADMIN/
SUPER_ADMIN may read any record but never writes here — admin's only write
into farmer data is the advice endpoint. Once the parent cycle's status is
COMPLETED, records are frozen: no create/update/delete by anyone.

Table design: PK=cycleId, SK=date#recordId  → O(1) query by cycle, sorted by date.
"""
import os
import uuid
import time
import base64
import binascii
import boto3
from boto3.dynamodb.conditions import Key

from lib.db import table, encode_key, decode_key
from lib.auth import require_auth, require_admin, is_admin_role, AuthError, ForbiddenError
from lib.response import (
    ok, created, no_content, bad_request, not_found, forbidden, conflict, server_err,
    parse_body, method, path_param, query_param,
)

VALID_PRIORITIES = ('LOW', 'MEDIUM', 'HIGH')

PAGE_SIZE = 100
MAX_PHOTO_BYTES = 8 * 1024 * 1024  # 8MB
PHOTOS_BUCKET = os.environ.get('PHOTOS_BUCKET', '')
AWS_REGION = os.environ.get('AWS_REGION', 'ap-south-1')

_s3 = boto3.client('s3')


def handler(event, _ctx):
    try:
        m   = method(event)
        rid = path_param(event)

        if m == 'OPTIONS':
            return no_content()
        if rid == 'upload-photo' and m == 'POST':
            return _upload_photo(event)
        if rid == 'advice' and m == 'POST':
            return _create_advice(event)
        if rid:
            if m == 'GET':    return _get(event, rid)
            if m == 'PUT':    return _update(event, rid)
            if m == 'DELETE': return _delete(event, rid)
        else:
            if m == 'GET':  return _list(event)
            if m == 'POST': return _create(event)

        return bad_request('Method not allowed')

    except AuthError as e:
        from lib.response import unauthorized
        return unauthorized(str(e))
    except ForbiddenError as e:
        return forbidden(str(e))
    except Exception as e:
        return server_err(e)


def _get_cycle(cycle_id: str) -> dict | None:
    resp = table('crop_cycles').query(
        IndexName='CycleIdIndex',
        KeyConditionExpression=Key('cycleId').eq(cycle_id),
        Limit=1,
    )
    items = resp.get('Items', [])
    return items[0] if items else None


def _list(event):
    payload = require_auth(event)
    cycle_id = query_param(event, 'cycleId')
    if not cycle_id:
        return bad_request('cycleId query param required')

    cycle = _get_cycle(cycle_id)
    if not cycle:
        return not_found('Crop cycle not found')
    if not is_admin_role(payload['role']) and cycle.get('farmerId') != payload['userId']:
        return forbidden('Access denied')

    tbl    = table('daily_records')
    cursor = query_param(event, 'cursor')
    kwargs = {
        'KeyConditionExpression': Key('cycleId').eq(cycle_id),
        'ScanIndexForward': True,   # oldest → newest (date#id sort key)
        'Limit': PAGE_SIZE,
    }
    if cursor:
        kwargs['ExclusiveStartKey'] = decode_key(cursor)

    resp = tbl.query(**kwargs)
    return ok({
        'items':      resp.get('Items', []),
        'nextCursor': encode_key(resp.get('LastEvaluatedKey')),
    })


def _create(event):
    payload = require_auth(event)
    if is_admin_role(payload['role']):
        return forbidden('Admins have read-only access to customer crop data')

    body     = parse_body(event)
    cycle_id = (body.get('cycleId') or '').strip()
    date     = (body.get('date') or time.strftime('%Y-%m-%d', time.gmtime())).strip()

    if not cycle_id:
        return bad_request('cycleId required')

    cycle = _get_cycle(cycle_id)
    if not cycle:
        return not_found('Crop cycle not found')
    if cycle.get('farmerId') != payload['userId']:
        return forbidden('Access denied')
    if cycle.get('status') == 'COMPLETED':
        return conflict('This crop cycle has been completed. Activity records are now read-only.')

    record_id = str(uuid.uuid4())
    sort_key  = f'{date}#{record_id}'
    now       = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    record = {
        'cycleId':      cycle_id,
        'sortKey':      sort_key,
        'recordId':     record_id,
        'date':         date,
        'stage':        body.get('stage', ''),
        'costType':     body.get('costType', ''),
        'activityType': body.get('activityType', ''),
        'expense':      body.get('expense', 0),
        'incomeAmount': body.get('incomeAmount'),
        'quantity':     body.get('quantity'),
        'notes':        body.get('notes', ''),
        'image':        body.get('image'),
        'createdAt':    now,
        'updatedAt':    now,
    }
    # Strip None values before writing to DynamoDB
    record = {k: v for k, v in record.items() if v is not None}
    table('daily_records').put_item(Item=record)
    return created(record)


def _create_advice(event):
    payload = require_admin(event)
    body = parse_body(event)
    cycle_id           = (body.get('cycleId') or '').strip()
    title              = (body.get('title') or '').strip()
    message            = (body.get('message') or '').strip()
    priority           = (body.get('priority') or 'MEDIUM').strip().upper()
    recommended_action = (body.get('recommendedAction') or '').strip()
    related_record_id  = body.get('relatedRecordId')

    if not cycle_id or not title or not message:
        return bad_request('cycleId, title, and message required')
    if priority not in VALID_PRIORITIES:
        return bad_request(f'priority must be one of: {", ".join(VALID_PRIORITIES)}')

    cycle = _get_cycle(cycle_id)
    if not cycle:
        return not_found('Crop cycle not found')

    record_id = str(uuid.uuid4())
    date      = time.strftime('%Y-%m-%d', time.gmtime())
    now       = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    record = {
        'cycleId':           cycle_id,
        'sortKey':           f'{date}#{record_id}',
        'recordId':          record_id,
        'date':              date,
        'activityType':      'Admin Advice',
        'stage':             '',
        'costType':          '',
        'expense':           0,
        'title':             title,
        'notes':             message,
        'priority':          priority,
        'recommendedAction': recommended_action,
        'createdBy':         payload['userId'],
        'relatedRecordId':   related_record_id,
        'createdAt':         now,
        'updatedAt':         now,
    }
    record = {k: v for k, v in record.items() if v is not None}
    table('daily_records').put_item(Item=record)
    return created(record)


def _upload_photo(event):
    payload = require_auth(event)
    body = parse_body(event)
    image_b64 = body.get('image')
    content_type = (body.get('contentType') or 'image/jpeg').strip()

    if not image_b64:
        return bad_request('image (base64) required')
    if content_type not in ('image/jpeg', 'image/png'):
        return bad_request('contentType must be image/jpeg or image/png')

    try:
        data = base64.b64decode(image_b64, validate=True)
    except (binascii.Error, ValueError):
        return bad_request('invalid base64 image data')

    if len(data) > MAX_PHOTO_BYTES:
        return bad_request(f'image too large (max {MAX_PHOTO_BYTES // (1024 * 1024)}MB)')

    ext = 'png' if content_type == 'image/png' else 'jpg'
    key = f"records/{payload['userId']}/{uuid.uuid4()}.{ext}"

    _s3.put_object(Bucket=PHOTOS_BUCKET, Key=key, Body=data, ContentType=content_type)
    url = f'https://{PHOTOS_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}'
    return created({'url': url})


def _get_by_record_id(record_id: str) -> dict | None:
    resp = table('daily_records').query(
        IndexName='RecordIdIndex',
        KeyConditionExpression=Key('recordId').eq(record_id),
        Limit=1,
    )
    items = resp.get('Items', [])
    return items[0] if items else None


def _get(event, record_id: str):
    payload = require_auth(event)
    item = _get_by_record_id(record_id)
    if not item:
        return not_found('Record not found')

    cycle = _get_cycle(item['cycleId'])
    owner_id = cycle.get('farmerId') if cycle else None
    if not is_admin_role(payload['role']) and owner_id != payload['userId']:
        return forbidden('Access denied')
    return ok(item)


def _update(event, record_id: str):
    payload = require_auth(event)
    if is_admin_role(payload['role']):
        return forbidden('Admins have read-only access to customer crop data')

    item = _get_by_record_id(record_id)
    if not item:
        return not_found('Record not found')

    cycle = _get_cycle(item['cycleId'])
    if not cycle or cycle.get('farmerId') != payload['userId']:
        return forbidden('Access denied')
    if cycle.get('status') == 'COMPLETED':
        return conflict('This crop cycle has been completed. Activity records are now read-only.')

    body    = parse_body(event)
    allowed = ['stage', 'costType', 'activityType', 'expense',
               'incomeAmount', 'quantity', 'notes', 'image']
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    if not updates:
        return bad_request('Nothing to update')
    updates['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    table('daily_records').update_item(
        Key={'cycleId': item['cycleId'], 'sortKey': item['sortKey']},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )
    return ok({**item, **updates})


def _delete(event, record_id: str):
    payload = require_auth(event)
    if is_admin_role(payload['role']):
        return forbidden('Admins have read-only access to customer crop data')

    item = _get_by_record_id(record_id)
    if not item:
        return not_found('Record not found')

    cycle = _get_cycle(item['cycleId'])
    if not cycle or cycle.get('farmerId') != payload['userId']:
        return forbidden('Access denied')
    if cycle.get('status') == 'COMPLETED':
        return conflict('This crop cycle has been completed. Activity records are now read-only.')

    table('daily_records').delete_item(
        Key={'cycleId': item['cycleId'], 'sortKey': item['sortKey']}
    )
    return no_content()
