"""
POST /auth/login  – verify phone + password, return JWT
GET  /auth/me     – return current user from JWT
POST /auth/register – create a new farmer account (self-registration)
POST /auth/register-admin – SUPER_ADMIN creates the one regular ADMIN account
POST /auth/forgot-password/send-otp   – email a 6-digit OTP to the phone's registered address
POST /auth/forgot-password/verify-otp – verify the OTP, set a new password
"""
import os
import re
import time
import uuid
import secrets
import bcrypt
import boto3
from boto3.dynamodb.conditions import Attr, Key

from lib.db import table
from lib.auth import sign_token, require_auth, require_super_admin, AuthError, ForbiddenError
from lib.response import (
    ok, created, bad_request, unauthorized, forbidden, not_found, conflict, server_err,
    parse_body, method, path_param, no_content,
)

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
OTP_TTL_SECONDS = 10 * 60
MAX_ADMINS = 2  # 1 SUPER_ADMIN + 1 ADMIN
SES_SENDER_EMAIL = os.environ.get('SES_SENDER_EMAIL', '')

_ses = boto3.client('sesv2', region_name=os.environ.get('AWS_REGION', 'ap-south-1'))


def handler(event, _ctx):
    try:
        m = method(event)
        proxy = path_param(event) or ''

        # Browsers send a CORS preflight OPTIONS request before the real one.
        # The HttpApi route below is "ANY /auth/{proxy+}", which captures
        # OPTIONS too and forwards it here instead of letting API Gateway's
        # CorsConfiguration auto-respond — so it must be answered explicitly.
        if m == 'OPTIONS':
            return no_content()
        if proxy == 'login' and m == 'POST':
            return _login(event)
        if proxy == 'register' and m == 'POST':
            return _register(event)
        if proxy == 'register-admin' and m == 'POST':
            return _register_admin(event)
        if proxy == 'me' and m == 'GET':
            return _me(event)
        if proxy == 'forgot-password/send-otp' and m == 'POST':
            return _forgot_password_send_otp(event)
        if proxy == 'forgot-password/verify-otp' and m == 'POST':
            return _forgot_password_verify_otp(event)
        return bad_request('Unknown auth route')

    except AuthError as e:
        return unauthorized(str(e))
    except ForbiddenError as e:
        return forbidden(str(e))
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
    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''

    if not name or not phone or not password or not email:
        return bad_request('name, phone, email, and password required')
    if len(password) < 6:
        return bad_request('password must be at least 6 characters')
    if not EMAIL_RE.match(email):
        return bad_request('invalid email address')

    tbl = table('users')
    # Check phone uniqueness
    existing = tbl.query(
        IndexName='PhoneIndex',
        KeyConditionExpression=Key('phone').eq(phone),
        Limit=1,
    )
    if existing.get('Items'):
        return conflict('Phone already registered')

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user_id = str(uuid.uuid4())

    user = {
        'userId':       user_id,
        'name':         name,
        'phone':        phone,
        'email':        email,
        'passwordHash': pw_hash,
        'role':         'FARMER',
        'createdAt':    time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    tbl.put_item(Item=user)

    token = sign_token(user_id, 'FARMER')
    return created({'token': token, 'user': _safe_user(user)})


def _register_admin(event):
    require_super_admin(event)

    body  = parse_body(event)
    name  = (body.get('name') or '').strip()
    phone = (body.get('phone') or '').strip()
    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''

    if not name or not phone or not password or not email:
        return bad_request('name, phone, email, and password required')
    if len(password) < 6:
        return bad_request('password must be at least 6 characters')
    if not EMAIL_RE.match(email):
        return bad_request('invalid email address')

    tbl = table('users')
    admin_count = tbl.scan(
        FilterExpression=Attr('role').is_in(['ADMIN', 'SUPER_ADMIN']),
        Select='COUNT',
    )['Count']
    if admin_count >= MAX_ADMINS:
        return conflict(f'Cannot create another admin: {MAX_ADMINS} admin accounts already exist.')

    existing = tbl.query(
        IndexName='PhoneIndex',
        KeyConditionExpression=Key('phone').eq(phone),
        Limit=1,
    )
    if existing.get('Items'):
        return conflict('Phone already registered')

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user_id = str(uuid.uuid4())

    user = {
        'userId':       user_id,
        'name':         name,
        'phone':        phone,
        'email':        email,
        'passwordHash': pw_hash,
        'role':         'ADMIN',
        'createdAt':    time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    tbl.put_item(Item=user)

    return created({'user': _safe_user(user)})


def _forgot_password_send_otp(event):
    body = parse_body(event)
    phone = (body.get('phone') or '').strip()
    if not phone:
        return bad_request('phone required')

    tbl = table('users')
    resp = tbl.query(
        IndexName='PhoneIndex',
        KeyConditionExpression=Key('phone').eq(phone),
        Limit=1,
    )
    items = resp.get('Items', [])
    if not items:
        return not_found('No account found for this phone number')

    user = items[0]
    email = user.get('email')
    if not email:
        return bad_request('No email is set for this account. Contact support.')

    otp = f'{secrets.randbelow(1000000):06d}'
    otp_hash = bcrypt.hashpw(otp.encode(), bcrypt.gensalt()).decode()
    expires_at = int(time.time()) + OTP_TTL_SECONDS

    tbl.update_item(
        Key={'userId': user['userId']},
        UpdateExpression='SET resetOtpHash = :h, resetOtpExpiresAt = :e',
        ExpressionAttributeValues={':h': otp_hash, ':e': expires_at},
    )

    _send_otp_email(email, otp)

    return ok({'message': 'OTP sent', 'email': _mask_email(email)})


def _forgot_password_verify_otp(event):
    body = parse_body(event)
    phone = (body.get('phone') or '').strip()
    otp = (body.get('otp') or '').strip()
    new_password = body.get('newPassword') or ''

    if not phone or not otp or not new_password:
        return bad_request('phone, otp, and newPassword required')
    if len(new_password) < 6:
        return bad_request('password must be at least 6 characters')

    tbl = table('users')
    resp = tbl.query(
        IndexName='PhoneIndex',
        KeyConditionExpression=Key('phone').eq(phone),
        Limit=1,
    )
    items = resp.get('Items', [])
    if not items:
        return unauthorized('Invalid phone or OTP')

    user = items[0]
    stored_hash = user.get('resetOtpHash')
    expires_at = user.get('resetOtpExpiresAt') or 0
    if not stored_hash or int(time.time()) > int(expires_at):
        return unauthorized('OTP expired or not requested. Please request a new one.')
    if not bcrypt.checkpw(otp.encode(), stored_hash.encode()):
        return unauthorized('Invalid phone or OTP')

    new_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    tbl.update_item(
        Key={'userId': user['userId']},
        UpdateExpression='SET passwordHash = :h REMOVE resetOtpHash, resetOtpExpiresAt',
        ExpressionAttributeValues={':h': new_hash},
    )
    return ok({'message': 'Password updated successfully'})


def _me(event):
    payload = require_auth(event)
    tbl = table('users')
    resp = tbl.get_item(Key={'userId': payload['userId']})
    user = resp.get('Item')
    if not user:
        return not_found('User not found')
    return ok(_safe_user(user))


def _safe_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k not in ('passwordHash', 'resetOtpHash', 'resetOtpExpiresAt')}


def _mask_email(email: str) -> str:
    local, _, domain = email.partition('@')
    if len(local) <= 2:
        masked = local[0] + '*' * max(len(local) - 1, 1)
    else:
        masked = local[0] + '*' * (len(local) - 2) + local[-1]
    return f'{masked}@{domain}'


def _send_otp_email(to_email: str, otp: str):
    _ses.send_email(
        FromEmailAddress=SES_SENDER_EMAIL,
        Destination={'ToAddresses': [to_email]},
        Content={
            'Simple': {
                'Subject': {'Data': 'Naveena Uzhavan – Password Reset OTP'},
                'Body': {
                    'Text': {
                        'Data': (
                            f'Your password reset OTP is: {otp}\n\n'
                            f'This code expires in {OTP_TTL_SECONDS // 60} minutes. '
                            'If you did not request this, you can ignore this email.'
                        )
                    }
                },
            }
        },
    )
