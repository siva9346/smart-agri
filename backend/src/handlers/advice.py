"""
GET    /advice             – farmer sees own; admin sees all
POST   /advice             – farmer creates advice request
GET    /advice/{id}        – get advice thread
PUT    /advice/{id}        – admin adds reply; farmer can add followup
DELETE /advice/{id}        – delete (admin)
"""
import uuid
import time
from boto3.dynamodb.conditions import Key

from lib.db import table, encode_key, decode_key
from lib.auth import require_auth, require_admin, AuthError, ForbiddenError
from lib.response import (
    ok, created, no_content, bad_request, not_found, server_err,
    parse_body, method, path_param, query_param,
)

PAGE_SIZE = 50


def handler(event, _ctx):
    try:
        m   = method(event)
        rid = path_param(event)

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
    payload = require_auth(event)
    tbl     = table('advice')
    cursor  = query_param(event, 'cursor')

    if payload['role'] == 'FARMER':
        kwargs = {
            'IndexName': 'FarmerIndex',
            'KeyConditionExpression': Key('farmerId').eq(payload['userId']),
            'ScanIndexForward': False,
            'Limit': PAGE_SIZE,
        }
        if cursor:
            kwargs['ExclusiveStartKey'] = decode_key(cursor)
        resp = tbl.query(**kwargs)
    else:
        kwargs = {'Limit': PAGE_SIZE}
        if cursor:
            kwargs['ExclusiveStartKey'] = decode_key(cursor)
        resp = tbl.scan(**kwargs)

    return ok({
        'items':      resp.get('Items', []),
        'nextCursor': encode_key(resp.get('LastEvaluatedKey')),
    })


def _create(event):
    payload = require_auth(event)
    body    = parse_body(event)
    subject = (body.get('subject') or '').strip()
    message = (body.get('message') or '').strip()

    if not subject or not message:
        return bad_request('subject and message required')

    now    = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    advice = {
        'adviceId':  str(uuid.uuid4()),
        'farmerId':  payload['userId'],
        'subject':   subject,
        'message':   message,
        'cropName':  body.get('cropName', ''),
        'status':    'OPEN',
        'reply':     None,
        'repliedAt': None,
        'createdAt': now,
        'updatedAt': now,
    }
    advice = {k: v for k, v in advice.items() if v is not None}
    table('advice').put_item(Item=advice)
    return created(advice)


def _get(event, advice_id: str):
    payload = require_auth(event)
    resp    = table('advice').get_item(Key={'adviceId': advice_id})
    item    = resp.get('Item')
    if not item:
        return not_found('Advice not found')
    if payload['role'] != 'ADMIN' and item['farmerId'] != payload['userId']:
        from lib.response import forbidden
        return forbidden('Access denied')
    return ok(item)


def _update(event, advice_id: str):
    payload = require_auth(event)
    tbl     = table('advice')
    resp    = tbl.get_item(Key={'adviceId': advice_id})
    item    = resp.get('Item')
    if not item:
        return not_found('Advice not found')
    if payload['role'] != 'ADMIN' and item['farmerId'] != payload['userId']:
        from lib.response import forbidden
        return forbidden('Access denied')

    body = parse_body(event)
    now  = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    updates = {'updatedAt': now}

    if payload['role'] == 'ADMIN':
        if body.get('reply'):
            updates['reply']     = body['reply']
            updates['repliedAt'] = now
            updates['status']    = 'ANSWERED'
    if body.get('status'):
        updates['status'] = body['status']

    tbl.update_item(
        Key={'adviceId': advice_id},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )
    return ok({**item, **updates})


def _delete(event, advice_id: str):
    require_admin(event)
    tbl  = table('advice')
    resp = tbl.get_item(Key={'adviceId': advice_id})
    if not resp.get('Item'):
        return not_found('Advice not found')
    tbl.delete_item(Key={'adviceId': advice_id})
    return no_content()
