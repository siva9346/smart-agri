"""
Personal information & preferences for every authenticated user.

GET  /profile         – own profile + effective permissions
PUT  /profile         – update permitted preference fields for the caller's role
POST /profile/photo   – upload a profile image (base64), returns its URL

Identity fields (name / email / village / district) keep their existing
one-time-completion rule in PUT /auth/me. Role, isActive, specializations and
other management fields can never be changed here.
"""
import os
import uuid
import base64
import binascii

import boto3

from lib.db import table
from lib.router import run
from lib.permissions import require_actor, permissions_for, FARMER, STAFF, EXPERT
from lib.audit import audit
from lib.util import HttpError, now_iso, clean_str, update_item, safe_user
from lib.response import ok, created, parse_body

PHOTOS_BUCKET = os.environ.get('PHOTOS_BUCKET', '')
AWS_REGION = os.environ.get('AWS_REGION', 'ap-south-1')
CONTENT_TYPES = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}
LANGUAGES = ('en', 'ta', 'hi', 'te', 'kn', 'ml')
CONTACT_METHODS = ('IN_APP', 'CALL', 'WHATSAPP')
NOTIFICATION_CATEGORIES = ('announcements', 'consultations', 'quotations', 'crmTasks', 'reminders')

COMMON = {'language': 10, 'timezone': 60, 'location': 200, 'profileImageUrl': 500}
BY_ROLE = {
    FARMER: {'farmLocation': 200, 'farmingPreferences': 1000, 'preferredContactMethod': 20},
    STAFF: {'workPreferences': 1000},
    EXPERT: {'qualifications': 500, 'consultationPreferences': 1000, 'bio': 1000},
}

_s3 = boto3.client('s3')


def handler(event, _ctx):
    return run(event, _route)


def _route(event, m, seg):
    if not seg:
        if m == 'GET': return _get(event)
        if m == 'PUT': return _update(event)
    if seg == ['photo'] and m == 'POST':
        return _photo(event)
    if seg == ['push-token'] and m == 'POST':
        return _push_token(event, add=True)
    if seg == ['push-token', 'remove'] and m == 'POST':
        return _push_token(event, add=False)
    return None


def _push_token(event, add: bool):
    from lib.push import is_expo_token, MAX_TOKENS_PER_USER
    actor = require_actor(event)
    body = parse_body(event)
    token = clean_str(body, 'token', 200, required=True)
    if not is_expo_token(token):
        raise HttpError(400, 'invalid Expo push token')
    tokens = [t for t in actor.get('pushTokens', []) if t.get('token') != token]
    if add:
        platform = clean_str(body, 'platform', 20) or 'unknown'
        tokens = (tokens + [{'token': token, 'platform': platform, 'registeredAt': now_iso()}])[-MAX_TOKENS_PER_USER:]
    update_item(table('users'), {'userId': actor['userId']}, {'pushTokens': tokens})
    return ok({'registered': add, 'devices': len(tokens)})


def _present(user: dict) -> dict:
    out = safe_user(user)
    out['pushDevices'] = len(out.pop('pushTokens', []) or [])
    out['permissions'] = sorted(permissions_for(user['role']))
    out.setdefault('notificationPrefs', {'inApp': True, 'push': True, 'whatsapp': True,
                                         **{c: True for c in NOTIFICATION_CATEGORIES}})
    return out


def _get(event):
    return ok(_present(require_actor(event)))


def _update(event):
    actor = require_actor(event)
    body = parse_body(event)
    allowed = {**COMMON, **BY_ROLE.get(actor['role'], {})}
    updates = {}
    for field, max_len in allowed.items():
        if field in body:
            updates[field] = clean_str(body, field, max_len) or None
    if updates.get('language') and updates['language'] not in LANGUAGES:
        raise HttpError(400, 'unsupported language')
    if updates.get('preferredContactMethod') and updates['preferredContactMethod'] not in CONTACT_METHODS:
        raise HttpError(400, 'invalid preferredContactMethod')
    if updates.get('profileImageUrl') and not updates['profileImageUrl'].startswith(
            f'https://{PHOTOS_BUCKET}.s3.{AWS_REGION}.amazonaws.com/profiles/{actor["userId"]}/'):
        raise HttpError(400, 'Upload the image through /profile/photo')
    if 'notificationPrefs' in body:
        prefs = body['notificationPrefs'] or {}
        if not isinstance(prefs, dict):
            raise HttpError(400, 'notificationPrefs must be an object')
        updates['notificationPrefs'] = {k: bool(prefs.get(k, True))
                                        for k in ('inApp', 'push', 'whatsapp', *NOTIFICATION_CATEGORIES)}
    if actor['role'] == EXPERT:
        if 'isAvailable' in body:
            updates['isAvailable'] = bool(body['isAvailable'])
        if 'experienceYears' in body:
            updates['experienceYears'] = max(0, min(int(body['experienceYears'] or 0), 70))
    if not updates:
        raise HttpError(400, 'Nothing to update')
    updates['updatedAt'] = now_iso()
    updated = update_item(table('users'), {'userId': actor['userId']}, updates)
    if 'isAvailable' in updates:
        audit(actor, 'EXPERT_AVAILABILITY', 'user', actor['userId'], {'isAvailable': updates['isAvailable']})
    return ok(_present(updated))


def _photo(event):
    actor = require_actor(event)
    body = parse_body(event)
    content_type = (body.get('contentType') or 'image/jpeg').strip()
    if content_type not in CONTENT_TYPES:
        raise HttpError(400, 'unsupported image type')
    try:
        data = base64.b64decode(body.get('image') or '', validate=True)
    except (binascii.Error, ValueError):
        raise HttpError(400, 'invalid base64 image data')
    if not data or len(data) > 2 * 1024 * 1024:
        raise HttpError(400, 'image required (max 2MB)')
    key = f"profiles/{actor['userId']}/{uuid.uuid4()}.{CONTENT_TYPES[content_type]}"
    _s3.put_object(Bucket=PHOTOS_BUCKET, Key=key, Body=data, ContentType=content_type)
    url = f'https://{PHOTOS_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}'
    updated = update_item(table('users'), {'userId': actor['userId']}, {'profileImageUrl': url, 'updatedAt': now_iso()})
    return created(_present(updated))
