"""
GET    /notifications          – list notifications (all authenticated users)
POST   /notifications          – create notification (admin only)
GET    /notifications/{id}     – get notification
PUT    /notifications/{id}     – update notification (admin only)
DELETE /notifications/{id}     – delete notification (admin only)
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
    require_auth(event)
    tbl    = table('notifications')
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
    body  = parse_body(event)
    title = (body.get('title') or '').strip()
    msg   = (body.get('message') or '').strip()

    if not title or not msg:
        return bad_request('title and message required')

    now   = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    notif = {
        'notifId':    str(uuid.uuid4()),
        'title':      title,
        'message':    msg,
        'type':       body.get('type', 'INFO'),
        'targetRole': body.get('targetRole', 'ALL'),
        'isActive':   body.get('isActive', True),
        'createdAt':  now,
        'updatedAt':  now,
    }
    table('notifications').put_item(Item=notif)
    return created(notif)


def _get(event, notif_id: str):
    require_auth(event)
    resp = table('notifications').get_item(Key={'notifId': notif_id})
    item = resp.get('Item')
    if not item:
        return not_found('Notification not found')
    return ok(item)


def _update(event, notif_id: str):
    require_admin(event)
    tbl  = table('notifications')
    resp = tbl.get_item(Key={'notifId': notif_id})
    if not resp.get('Item'):
        return not_found('Notification not found')

    body    = parse_body(event)
    allowed = ['title', 'message', 'type', 'targetRole', 'isActive']
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    updates['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    tbl.update_item(
        Key={'notifId': notif_id},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )
    return ok({**resp['Item'], **updates})


def _delete(event, notif_id: str):
    require_admin(event)
    tbl  = table('notifications')
    resp = tbl.get_item(Key={'notifId': notif_id})
    if not resp.get('Item'):
        return not_found('Notification not found')
    tbl.delete_item(Key={'notifId': notif_id})
    return no_content()
