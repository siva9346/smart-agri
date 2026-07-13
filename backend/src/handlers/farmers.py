"""
GET    /farmers          – list all farmers (admin)
POST   /farmers          – create farmer (admin)
GET    /farmers/{id}     – get farmer by userId
PUT    /farmers/{id}     – update farmer profile
DELETE /farmers/{id}     – delete farmer (admin)
"""
import uuid
import time
import bcrypt
from boto3.dynamodb.conditions import Key, Attr

from lib.db import table, encode_key, decode_key
from lib.auth import require_auth, require_admin, is_admin_role, AuthError, ForbiddenError
from lib.response import (
    ok, created, no_content, bad_request, not_found, server_err,
    parse_body, method, path_param, query_param,
)

PAGE_SIZE = 50


def handler(event, _ctx):
    try:
        m   = method(event)
        rid = path_param(event)  # farmer userId from /farmers/{proxy+}

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


def _count_by_farmer(table_name: str, active_only: bool = False) -> dict:
    """Scan a table once and return {farmerId: count}, optionally counting only
    ACTIVE crop cycles. Avoids N+1 network calls when enriching the farmer list."""
    counts: dict = {}
    kwargs = {}
    if active_only:
        kwargs['FilterExpression'] = Attr('status').eq('ACTIVE')
    while True:
        resp = table(table_name).scan(**kwargs)
        for item in resp.get('Items', []):
            fid = item.get('farmerId')
            if fid:
                counts[fid] = counts.get(fid, 0) + 1
        if not resp.get('LastEvaluatedKey'):
            break
        kwargs['ExclusiveStartKey'] = resp['LastEvaluatedKey']
    return counts


def _list(event):
    require_admin(event)
    tbl = table('users')
    kwargs = {
        'FilterExpression': Attr('role').eq('FARMER'),
        'Limit': PAGE_SIZE,
    }
    cursor = query_param(event, 'cursor')
    if cursor:
        kwargs['ExclusiveStartKey'] = decode_key(cursor)

    resp = tbl.scan(**kwargs)
    land_counts  = _count_by_farmer('lands')
    cycle_counts = _count_by_farmer('crop_cycles', active_only=True)

    items = []
    for u in resp.get('Items', []):
        safe_u = _safe(u)
        safe_u['landCount'] = land_counts.get(u['userId'], 0)
        safe_u['activeCycleCount'] = cycle_counts.get(u['userId'], 0)
        items.append(safe_u)

    return ok({
        'items':     items,
        'nextCursor': encode_key(resp.get('LastEvaluatedKey')),
    })


def _create(event):
    require_admin(event)
    body  = parse_body(event)
    name  = (body.get('name') or '').strip()
    phone = (body.get('phone') or '').strip()
    password = body.get('password') or 'Welcome@123'

    if not name or not phone:
        return bad_request('name and phone required')

    tbl = table('users')
    existing = tbl.query(
        IndexName='PhoneIndex',
        KeyConditionExpression=Key('phone').eq(phone),
        Limit=1,
    )
    if existing.get('Items'):
        from lib.response import conflict
        return conflict('Phone already registered')

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    email = (body.get('email') or '').strip().lower()

    user = {
        'userId':       str(uuid.uuid4()),
        'name':         name,
        'phone':        phone,
        'passwordHash': pw_hash,
        'role':         'FARMER',
        'village':      body.get('village', ''),
        'district':     body.get('district', ''),
        'createdAt':    time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    if email:
        user['email'] = email
    tbl.put_item(Item=user)
    return created(_safe(user))


def _get(event, user_id: str):
    payload = require_auth(event)
    if not is_admin_role(payload['role']) and payload['userId'] != user_id:
        from lib.response import forbidden
        return forbidden('Access denied')

    resp = table('users').get_item(Key={'userId': user_id})
    item = resp.get('Item')
    if not item:
        return not_found('Farmer not found')
    return ok(_safe(item))


def _update(event, user_id: str):
    payload = require_auth(event)
    if not is_admin_role(payload['role']) and payload['userId'] != user_id:
        from lib.response import forbidden
        return forbidden('Access denied')

    body = parse_body(event)
    allowed = ['name', 'village', 'district', 'phone']
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    if not updates:
        return bad_request('Nothing to update')

    tbl = table('users')
    resp = tbl.get_item(Key={'userId': user_id})
    if not resp.get('Item'):
        return not_found('Farmer not found')

    expr_parts = [f'#{k} = :{k}' for k in updates]
    tbl.update_item(
        Key={'userId': user_id},
        UpdateExpression='SET ' + ', '.join(expr_parts),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )
    updated = {**resp['Item'], **updates}
    return ok(_safe(updated))


def _delete(event, user_id: str):
    require_admin(event)
    tbl = table('users')
    resp = tbl.get_item(Key={'userId': user_id})
    if not resp.get('Item'):
        return not_found('Farmer not found')
    tbl.delete_item(Key={'userId': user_id})
    return no_content()


def _safe(user: dict) -> dict:
    return {k: v for k, v in user.items() if k not in ('passwordHash', 'resetOtpHash', 'resetOtpExpiresAt')}
