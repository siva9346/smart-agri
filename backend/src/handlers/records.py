"""
GET    /records?cycleId=x  – list records for a cycle (date-sorted, paginated)
POST   /records             – create daily record
POST   /records/upload-photo – upload a base64 activity photo to S3, returns its URL
GET    /records/{id}        – get record by recordId (via GSI)
PUT    /records/{id}        – update record
DELETE /records/{id}        – delete record

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
from lib.auth import require_auth, AuthError, ForbiddenError
from lib.response import (
    ok, created, no_content, bad_request, not_found, server_err,
    parse_body, method, path_param, query_param,
)

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
        from lib.response import forbidden
        return forbidden(str(e))
    except Exception as e:
        return server_err(e)


def _list(event):
    require_auth(event)
    cycle_id = query_param(event, 'cycleId')
    if not cycle_id:
        return bad_request('cycleId query param required')

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
    require_auth(event)
    body     = parse_body(event)
    cycle_id = (body.get('cycleId') or '').strip()
    date     = (body.get('date') or time.strftime('%Y-%m-%d', time.gmtime())).strip()

    if not cycle_id:
        return bad_request('cycleId required')

    record_id = str(uuid.uuid4())
    sort_key  = f'{date}#{record_id}'

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
        'createdAt':    time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    # Strip None values before writing to DynamoDB
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
    require_auth(event)
    item = _get_by_record_id(record_id)
    if not item:
        return not_found('Record not found')
    return ok(item)


def _update(event, record_id: str):
    require_auth(event)
    item = _get_by_record_id(record_id)
    if not item:
        return not_found('Record not found')

    body    = parse_body(event)
    allowed = ['stage', 'costType', 'activityType', 'expense',
               'incomeAmount', 'quantity', 'notes', 'image']
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    if not updates:
        return bad_request('Nothing to update')

    table('daily_records').update_item(
        Key={'cycleId': item['cycleId'], 'sortKey': item['sortKey']},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )
    return ok({**item, **updates})


def _delete(event, record_id: str):
    require_auth(event)
    item = _get_by_record_id(record_id)
    if not item:
        return not_found('Record not found')

    table('daily_records').delete_item(
        Key={'cycleId': item['cycleId'], 'sortKey': item['sortKey']}
    )
    return no_content()
