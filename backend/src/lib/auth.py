import os
import time
import jwt

SECRET = os.environ['JWT_SECRET']
ALGORITHM = 'HS256'
TTL_SECONDS = 30 * 24 * 3600  # 30 days


class AuthError(Exception):
    pass


class ForbiddenError(Exception):
    pass


def sign_token(user_id: str, role: str) -> str:
    payload = {
        'userId': user_id,
        'role': role,
        'exp': int(time.time()) + TTL_SECONDS,
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    return jwt.decode(token, SECRET, algorithms=[ALGORITHM])


def _extract_token(event: dict) -> str | None:
    headers = event.get('headers') or {}
    auth = headers.get('authorization') or headers.get('Authorization') or ''
    if auth.startswith('Bearer '):
        return auth[7:]
    return None


def require_auth(event: dict) -> dict:
    token = _extract_token(event)
    if not token:
        raise AuthError('Missing token')
    try:
        return verify_token(token)
    except jwt.ExpiredSignatureError:
        raise AuthError('Token expired')
    except Exception:
        raise AuthError('Invalid token')


ADMIN_ROLES = ('ADMIN', 'SUPER_ADMIN')


def is_admin_role(role: str) -> bool:
    return role in ADMIN_ROLES


def require_admin(event: dict) -> dict:
    payload = require_auth(event)
    if not is_admin_role(payload.get('role')):
        raise ForbiddenError('Admin only')
    return payload


def require_super_admin(event: dict) -> dict:
    payload = require_auth(event)
    if payload.get('role') != 'SUPER_ADMIN':
        raise ForbiddenError('Super admin only')
    return payload
