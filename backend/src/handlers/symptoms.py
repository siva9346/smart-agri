"""
GET    /symptoms          – list symptoms (all authenticated, paginated)
POST   /symptoms          – create symptom (admin only)
GET    /symptoms/{id}     – get symptom by symptomId
PUT    /symptoms/{id}     – update symptom (admin only)
DELETE /symptoms/{id}     – delete symptom (admin only)
"""
import uuid
import time
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
    require_auth(event)
    tbl    = table('symptoms')
    cursor = query_param(event, 'cursor')
    kwargs = {'Limit': PAGE_SIZE}
    if cursor:
        kwargs['ExclusiveStartKey'] = decode_key(cursor)

    resp = tbl.scan(**kwargs)
    return ok({
        'items':      resp.get('Items', []),
        'nextCursor': encode_key(resp.get('LastEvaluatedKey')),
    })


def _create(event):
    require_admin(event)
    body     = parse_body(event)
    name     = (body.get('name') or '').strip()
    crop     = (body.get('cropName') or '').strip()

    if not name or not crop:
        return bad_request('name and cropName required')

    symptom = {
        'symptomId':   str(uuid.uuid4()),
        'name':        name,
        'cropName':    crop,
        'description': body.get('description', ''),
        'cause':       body.get('cause', ''),
        'remedy':      body.get('remedy', ''),
        'prevention':  body.get('prevention', ''),
        'imageUrl':    body.get('imageUrl', ''),
        'severity':    body.get('severity', 'MEDIUM'),
        'createdAt':   time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    table('symptoms').put_item(Item=symptom)
    return created(symptom)


def _get(event, symptom_id: str):
    require_auth(event)
    resp = table('symptoms').get_item(Key={'symptomId': symptom_id})
    item = resp.get('Item')
    if not item:
        return not_found('Symptom not found')
    return ok(item)


def _update(event, symptom_id: str):
    require_admin(event)
    tbl  = table('symptoms')
    resp = tbl.get_item(Key={'symptomId': symptom_id})
    if not resp.get('Item'):
        return not_found('Symptom not found')

    body    = parse_body(event)
    allowed = ['name', 'cropName', 'description', 'cause', 'remedy', 'prevention', 'imageUrl', 'severity']
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    if not updates:
        return bad_request('Nothing to update')

    tbl.update_item(
        Key={'symptomId': symptom_id},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )
    return ok({**resp['Item'], **updates})


def _delete(event, symptom_id: str):
    require_admin(event)
    tbl  = table('symptoms')
    resp = tbl.get_item(Key={'symptomId': symptom_id})
    if not resp.get('Item'):
        return not_found('Symptom not found')
    tbl.delete_item(Key={'symptomId': symptom_id})
    return no_content()
