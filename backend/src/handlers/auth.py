"""
POST /auth/login  – verify phone + password, return JWT
GET  /auth/me     – return current user from JWT
POST /auth/register – create a new farmer account (self-registration)
"""
import uuid
import bcrypt
from boto3.dynamodb.conditions import Key

from lib.db import table
from lib.auth import sign_token, require_auth, AuthError
from lib.response import (
    ok, created, bad_request, unauthorized, server_err,
    parse_body, method, path_param,
)


def handler(event, _ctx):
    try:
        m = method(event)
        proxy = path_param(event) or ''

        if proxy == 'login' and m == 'POST':
            return _login(event)
        if proxy == 'register' and m == 'POST':
            return _register(event)
        if proxy == 'me' and m == 'GET':
            return _me(event)
        return bad_request('Unknown auth route')

    except AuthError as e:
        return unauthorized(str(e))
    except Exception as e:
        return server_err(e)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _login(event):
    body = parse_body(event)
    phone = (body.get('phone') or '').strip()
    password = body.get('password') or ''

    if not phone or not password:
        return bad_request('phone and password required')

    tbl = table('users')
    resp = tbl.query(
        IndexName='PhoneIndex',
        KeyConditionExpression=Key('phone').eq(phone),
        Limit=1,
    )
    items = resp.get('Items', [])
    if not items:
        return unauthorized('Invalid credentials')

    user = items[0]
    stored_hash = user.get('passwordHash', '').encode()
    if not bcrypt.checkpw(password.encode(), stored_hash):
        return unauthorized('Invalid credentials')

    token = sign_token(user['userId'], user['role'])
    return ok({
        'token': token,
        'user': _safe_user(user),
    })


def _register(event):
    body = parse_body(event)
    name  = (body.get('name') or '').strip()
    phone = (body.get('phone') or '').strip()
    password = body.get('password') or ''

    if not name or not phone or not password:
        return bad_request('name, phone, and password required')
    if len(password) < 6:
        return bad_request('password must be at least 6 characters')

    tbl = table('users')
    # Check phone uniqueness
    existing = tbl.query(
        IndexName='PhoneIndex',
        KeyConditionExpression=Key('phone').eq(phone),
        Limit=1,
    )
    if existing.get('Items'):
        from lib.response import conflict
        return conflict('Phone already registered')

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user_id = str(uuid.uuid4())

    import time
    user = {
        'userId':       user_id,
        'name':         name,
        'phone':        phone,
        'passwordHash': pw_hash,
        'role':         'FARMER',
        'createdAt':    time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    tbl.put_item(Item=user)

    token = sign_token(user_id, 'FARMER')
    return created({'token': token, 'user': _safe_user(user)})


def _me(event):
    payload = require_auth(event)
    tbl = table('users')
    resp = tbl.get_item(Key={'userId': payload['userId']})
    user = resp.get('Item')
    if not user:
        from lib.response import not_found
        return not_found('User not found')
    return ok(_safe_user(user))


def _safe_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k != 'passwordHash'}
