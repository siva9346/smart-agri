"""
GET    /enquiries             – farmer sees own; admin sees all
POST   /enquiries             – farmer creates enquiry
GET    /enquiries/{id}        – get enquiry
PUT    /enquiries/{id}        – admin updates status / adds response
DELETE /enquiries/{id}        – delete (admin)
"""
import uuid
import time
from boto3.dynamodb.conditions import Key, Attr

from lib.db import table, encode_key, decode_key
from lib.auth import require_auth, require_admin, is_admin_role, AuthError, ForbiddenError
from lib.response import (
    ok, created, no_content, bad_request, not_found, server_err,
    parse_body, method, path_param, query_param,
)

PAGE_SIZE    = 50
VALID_STATUS = {'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'}


def handler(event, _ctx):
    try:
        m   = method(event)
        rid = path_param(event)

        if m == 'OPTIONS':
            return no_content()
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
    tbl     = table('enquiries')
    cursor  = query_param(event, 'cursor')
    status  = query_param(event, 'status')

    if payload['role'] == 'FARMER':
        kwargs = {
            'IndexName': 'FarmerIndex',
            'KeyConditionExpression': Key('farmerId').eq(payload['userId']),
            'ScanIndexForward': False,
            'Limit': PAGE_SIZE,
        }
        if status:
            kwargs['FilterExpression'] = Attr('status').eq(status.upper())
        if cursor:
            kwargs['ExclusiveStartKey'] = decode_key(cursor)
        resp = tbl.query(**kwargs)
    else:
        kwargs = {'Limit': PAGE_SIZE}
        if status:
            kwargs['FilterExpression'] = Attr('status').eq(status.upper())
        if cursor:
            kwargs['ExclusiveStartKey'] = decode_key(cursor)
        resp = tbl.scan(**kwargs)

    return ok({
        'items':      resp.get('Items', []),
        'nextCursor': encode_key(resp.get('LastEvaluatedKey')),
    })


def _create(event):
    payload  = require_auth(event)
    body     = parse_body(event)
    subject  = (body.get('subject') or '').strip()
    message  = (body.get('message') or '').strip()

    if not subject or not message:
        return bad_request('subject and message required')

    now     = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    enquiry = {
        'enquiryId':  str(uuid.uuid4()),
        'farmerId':   payload['userId'],
        'subject':    subject,
        'message':    message,
        'category':   body.get('category', 'GENERAL'),
        'status':     'OPEN',
        'response':   None,
        'respondedAt': None,
        'createdAt':  now,
        'updatedAt':  now,
    }
    enquiry = {k: v for k, v in enquiry.items() if v is not None}
    table('enquiries').put_item(Item=enquiry)
    return created(enquiry)


def _get(event, enquiry_id: str):
    payload = require_auth(event)
    resp    = table('enquiries').get_item(Key={'enquiryId': enquiry_id})
    item    = resp.get('Item')
    if not item:
        return not_found('Enquiry not found')
    if not is_admin_role(payload['role']) and item['farmerId'] != payload['userId']:
        from lib.response import forbidden
        return forbidden('Access denied')
    return ok(item)


def _update(event, enquiry_id: str):
    payload = require_auth(event)
    tbl     = table('enquiries')
    resp    = tbl.get_item(Key={'enquiryId': enquiry_id})
    item    = resp.get('Item')
    if not item:
        return not_found('Enquiry not found')
    if not is_admin_role(payload['role']) and item['farmerId'] != payload['userId']:
        from lib.response import forbidden
        return forbidden('Access denied')

    body    = parse_body(event)
    now     = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    updates = {'updatedAt': now}

    if is_admin_role(payload['role']):
        if body.get('response'):
            updates['response']    = body['response']
            updates['respondedAt'] = now
        if body.get('status'):
            s = body['status'].upper()
            if s not in VALID_STATUS:
                return bad_request(f'Invalid status. Use: {", ".join(VALID_STATUS)}')
            updates['status'] = s

    tbl.update_item(
        Key={'enquiryId': enquiry_id},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )
    return ok({**item, **updates})


def _delete(event, enquiry_id: str):
    require_admin(event)
    tbl  = table('enquiries')
    resp = tbl.get_item(Key={'enquiryId': enquiry_id})
    if not resp.get('Item'):
        return not_found('Enquiry not found')
    tbl.delete_item(Key={'enquiryId': enquiry_id})
    return no_content()
