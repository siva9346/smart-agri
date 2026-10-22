"""
Announcements (admin-authored) and the per-user notification inbox.

Announcements
GET    /notifications               – announcement list (admins: all; others: those targeted at their role — legacy screens)
POST   /notifications               – create + fan out {title, message, type, priority, audience, roles?, userIds?,
                                      actionLink?, startsAt?, expiresAt?, channels?}
GET    /notifications/{id}          – get announcement
GET    /notifications/{id}/stats    – delivery/read/dismiss counts (does not change recipient state)
PUT    /notifications/{id}          – update announcement metadata (admin)
DELETE /notifications/{id}          – delete announcement and retract it from inboxes (admin)

Inbox (current user only)
GET    /notifications/inbox                    – ?cursor=
GET    /notifications/inbox/banners            – items whose banner should currently show
GET    /notifications/inbox/unread-count
POST   /notifications/inbox/read-all
POST   /notifications/inbox/{recipientKey}/read
POST   /notifications/inbox/{recipientKey}/dismiss   – hides the banner; does NOT mark read

Fan-out runs asynchronously (this function invokes itself with {"fanout": id})
so large audiences don't hit the API Gateway timeout. Push delivery is not
configured: the PUSH channel is recorded as NOT_CONFIGURED, never as sent.
"""
import os
import json
import time

import boto3
from boto3.dynamodb.conditions import Key, Attr

from lib.db import table, encode_key, decode_key
from lib.router import run
from lib.permissions import require_actor, require_permission, ADMIN_ROLES, SUPER_ADMIN
from lib.notify import (
    TYPES, write_recipients, banner_visible, is_started, list_for_user, unread_count, user_ids_by_roles,
)
from lib.audit import audit
from lib.util import HttpError, now_iso, new_id, clean_str, update_item, query_all
from lib.tasks import parse_iso, to_iso
from lib.response import ok, created, no_content, query_param, parse_body

PAGE_SIZE = 50
AUDIENCES = ('ALL', 'CUSTOMERS', 'STAFF', 'EXPERTS', 'ADMINS', 'ROLES', 'USERS')
AUDIENCE_ROLES = {'CUSTOMERS': ['FARMER'], 'STAFF': ['STAFF'], 'EXPERTS': ['EXPERT'], 'ADMINS': ['ADMIN', 'SUPER_ADMIN']}
PRIORITIES = ('LOW', 'NORMAL', 'HIGH')
LEGACY_TYPES = {'INFO': 'GENERAL', 'WARNING': 'IMPORTANT', 'ALERT': 'IMPORTANT', 'PROMOTION': 'PRODUCT'}

_lambda = boto3.client('lambda')


def handler(event, _ctx):
    if 'fanout' in event:  # async self-invocation, not an HTTP request
        return _fanout(event['fanout'])
    return run(event, _route)


def _route(event, m, seg):
    if seg and seg[0] == 'inbox':
        rest = seg[1:]
        if not rest and m == 'GET':                  return _inbox(event)
        if rest == ['banners'] and m == 'GET':       return _banners(event)
        if rest == ['unread-count'] and m == 'GET':  return _unread(event)
        if rest == ['read-all'] and m == 'POST':     return _read_all(event)
        if len(rest) == 2 and m == 'POST' and rest[1] in ('read', 'dismiss'):
            return _mark(event, rest[0], rest[1])
        return None
    if not seg:
        if m == 'GET':  return _list(event)
        if m == 'POST': return _create(event)
        return None
    nid = seg[0]
    if len(seg) == 2 and seg[1] == 'stats' and m == 'GET':
        return _stats(event, nid)
    if len(seg) == 1:
        if m == 'GET':    return _get(event, nid)
        if m == 'PUT':    return _update(event, nid)
        if m == 'DELETE': return _delete(event, nid)
    return None


# ── Announcements ───────────────────────────────────────────────────────────

def _target_roles(n: dict) -> list[str]:
    audience = n.get('audience')
    if not audience:  # legacy record
        tr = n.get('targetRole', 'ALL')
        return ['ALL'] if tr == 'ALL' else [tr]
    if audience == 'ALL':
        return ['ALL']
    if audience == 'ROLES':
        return n.get('roles', [])
    return AUDIENCE_ROLES.get(audience, [])


def _list(event):
    actor = require_actor(event)
    cursor = query_param(event, 'cursor')
    kwargs = {'Limit': PAGE_SIZE}
    if cursor:
        kwargs['ExclusiveStartKey'] = decode_key(cursor)
    resp = table('notifications').scan(**kwargs)
    items = resp.get('Items', [])
    if actor['role'] not in ADMIN_ROLES:
        role = actor['role']
        items = [n for n in items if n.get('isActive', True) and n.get('audience') != 'USERS'
                 and ('ALL' in _target_roles(n) or role in _target_roles(n)) and is_started(n)]
    return ok({'items': items, 'nextCursor': encode_key(resp.get('LastEvaluatedKey'))})


def _validate_audience(actor: dict, body: dict) -> dict:
    audience = (body.get('audience') or '').upper()
    if not audience:  # legacy clients send targetRole
        tr = (body.get('targetRole') or 'ALL').upper()
        audience = 'ALL' if tr == 'ALL' else 'CUSTOMERS' if tr == 'FARMER' else 'ROLES'
        if audience == 'ROLES':
            body['roles'] = [tr]
    if audience not in AUDIENCES:
        raise HttpError(400, f'audience must be one of: {", ".join(AUDIENCES)}')
    is_super = actor['role'] == SUPER_ADMIN
    out = {'audience': audience}
    if audience == 'ADMINS' and not is_super:
        raise HttpError(403, 'Only a Super Admin can message administrators')
    if audience == 'ROLES':
        roles = [r for r in (body.get('roles') or []) if r in ('FARMER', 'STAFF', 'EXPERT', 'ADMIN', 'SUPER_ADMIN')]
        if not roles:
            raise HttpError(400, 'Select at least one role')
        if not is_super and set(roles) & set(ADMIN_ROLES):
            raise HttpError(403, 'Only a Super Admin can message administrators')
        out['roles'] = roles
    if audience == 'USERS':
        ids = [u for u in (body.get('userIds') or []) if isinstance(u, str)][:500]
        if not ids:
            raise HttpError(400, 'Select at least one user')
        out['userIds'] = ids
    return out


def _create(event):
    actor = require_permission(event, 'announcements.send')
    body = parse_body(event)
    title = clean_str(body, 'title', 120, required=True)
    message = clean_str(body, 'message', 2000, required=True)
    type_ = (body.get('type') or 'GENERAL').upper()
    type_ = LEGACY_TYPES.get(type_, type_)
    if type_ not in TYPES:
        raise HttpError(400, 'invalid type')
    priority = (body.get('priority') or 'NORMAL').upper()
    if priority not in PRIORITIES:
        raise HttpError(400, 'invalid priority')
    starts = to_iso(parse_iso(body['startsAt'], 'startsAt')) if body.get('startsAt') else None
    expires = to_iso(parse_iso(body['expiresAt'], 'expiresAt')) if body.get('expiresAt') else None
    if starts and expires and expires <= starts:
        raise HttpError(400, 'expiresAt must be after startsAt')
    channels = [c for c in (body.get('channels') or ['IN_APP']) if c in ('IN_APP', 'PUSH')] or ['IN_APP']

    now = now_iso()
    notif = {
        'notifId': new_id(), 'title': title, 'message': message, 'type': type_, 'priority': priority,
        **_validate_audience(actor, body),
        'actionLink': clean_str(body, 'actionLink', 300) or None,
        'startsAt': starts, 'expiresAt': expires,
        'channels': channels,
        'channelStatus': {'IN_APP': 'QUEUED', **({'PUSH': 'QUEUED'} if 'PUSH' in channels else {})},
        'isActive': True, 'deliveryStatus': 'QUEUED',
        'createdBy': actor['userId'], 'createdByName': actor.get('name', ''), 'createdByRole': actor['role'],
        'createdAt': now, 'updatedAt': now,
    }
    roles = _target_roles(notif)
    notif['targetRole'] = 'ALL' if roles == ['ALL'] else ','.join(roles)  # legacy field
    notif = {k: v for k, v in notif.items() if v is not None}
    table('notifications').put_item(Item=notif)
    audit(actor, 'ANNOUNCEMENT_CREATED', 'notification', notif['notifId'], {'audience': notif['audience']})

    fn = os.environ.get('AWS_LAMBDA_FUNCTION_NAME')
    if fn:
        _lambda.invoke(FunctionName=fn, InvocationType='Event',
                       Payload=json.dumps({'fanout': notif['notifId']}).encode())
    else:  # local / tests
        _fanout(notif['notifId'])
    return created(notif)


def _recipients(notif: dict) -> list[str]:
    by_super = notif.get('createdByRole') == SUPER_ADMIN
    audience = notif['audience']
    if audience == 'USERS':
        ids = []
        for uid in notif.get('userIds', []):
            u = table('users').get_item(Key={'userId': uid}).get('Item')
            if not u or u.get('isActive') is False or u.get('deletionStatus') == 'PENDING':
                continue
            if u.get('role') in ADMIN_ROLES and not by_super:
                continue
            ids.append(uid)
        return ids
    type_ = notif.get('type')
    if audience == 'ALL':
        return user_ids_by_roles(['FARMER', 'STAFF', 'EXPERT'] + (list(ADMIN_ROLES) if by_super else []), type_=type_)
    return user_ids_by_roles(_target_roles(notif), type_=type_)


def _fanout(notif_id: str):
    tbl = table('notifications')
    notif = tbl.get_item(Key={'notifId': notif_id}).get('Item')
    if not notif or notif.get('deliveryStatus') not in ('QUEUED', 'FAILED'):
        return {'skipped': True}
    try:
        wants_push = 'PUSH' in notif.get('channels', [])
        count = write_recipients(_recipients(notif), notif, push=wants_push)
        expr = 'SET deliveryStatus = :s, recipientCount = :c, channelStatus.IN_APP = :s, fannedOutAt = :t'
        values = {':s': 'COMPLETED', ':c': count, ':t': now_iso()}
        if wants_push:
            # Scheduled pushes are not sent at fan-out time; recorded so admins aren't misled.
            expr += ', channelStatus.PUSH = :p'
            values[':p'] = 'SENT' if is_started(notif) else 'NOT_SENT_SCHEDULED'
        tbl.update_item(Key={'notifId': notif_id}, UpdateExpression=expr, ExpressionAttributeValues=values)
        return {'recipients': count}
    except Exception as e:
        print(f'fan-out failed for {notif_id}: {e}')
        tbl.update_item(Key={'notifId': notif_id}, UpdateExpression='SET deliveryStatus = :s',
                        ExpressionAttributeValues={':s': 'FAILED'})
        raise


def _get(event, notif_id):
    require_actor(event)
    item = table('notifications').get_item(Key={'notifId': notif_id}).get('Item')
    if not item:
        raise HttpError(404, 'Notification not found')
    return ok(item)


def _stats(event, notif_id):
    require_permission(event, 'announcements.send')
    notif = table('notifications').get_item(Key={'notifId': notif_id}).get('Item')
    if not notif:
        raise HttpError(404, 'Notification not found')
    recs = query_all(table('inbox'), IndexName='NotifIndex', KeyConditionExpression=Key('notifId').eq(notif_id),
                     ProjectionExpression='isRead, isDismissed, deliveredAt, pushStatus')
    return ok({
        'notifId': notif_id,
        'deliveryStatus': notif.get('deliveryStatus'),
        'channelStatus': notif.get('channelStatus', {}),
        'recipients': len(recs),
        'delivered': sum(1 for r in recs if r.get('deliveredAt')),
        'read': sum(1 for r in recs if r.get('isRead')),
        'dismissed': sum(1 for r in recs if r.get('isDismissed')),
        'push': {s: sum(1 for r in recs if r.get('pushStatus') == s)
                 for s in ('NO_DEVICE', 'SENT_TO_EXPO', 'DELIVERED_TO_OS', 'FAILED')},
    })


def _update(event, notif_id):
    actor = require_permission(event, 'announcements.send')
    tbl = table('notifications')
    item = tbl.get_item(Key={'notifId': notif_id}).get('Item')
    if not item:
        raise HttpError(404, 'Notification not found')
    body = parse_body(event)
    updates = {k: body[k] for k in ('title', 'message', 'type', 'isActive', 'priority') if body.get(k) is not None}
    if 'type' in updates:
        updates['type'] = LEGACY_TYPES.get(str(updates['type']).upper(), str(updates['type']).upper())
    if body.get('targetRole') and not item.get('audience'):
        updates['targetRole'] = body['targetRole']
    updates['updatedAt'] = now_iso()
    updated = update_item(tbl, {'notifId': notif_id}, updates)
    audit(actor, 'ANNOUNCEMENT_UPDATED', 'notification', notif_id)
    return ok(updated)


def _delete(event, notif_id):
    actor = require_permission(event, 'announcements.send')
    tbl = table('notifications')
    if not tbl.get_item(Key={'notifId': notif_id}).get('Item'):
        raise HttpError(404, 'Notification not found')
    recs = query_all(table('inbox'), IndexName='NotifIndex', KeyConditionExpression=Key('notifId').eq(notif_id),
                     ProjectionExpression='userId, recipientKey')
    with table('inbox').batch_writer() as batch:
        for r in recs:
            batch.delete_item(Key={'userId': r['userId'], 'recipientKey': r['recipientKey']})
    tbl.delete_item(Key={'notifId': notif_id})
    audit(actor, 'ANNOUNCEMENT_DELETED', 'notification', notif_id, {'retracted': len(recs)})
    return no_content()


# ── Inbox ───────────────────────────────────────────────────────────────────

def _present(item: dict, now: float) -> dict:
    out = {k: v for k, v in item.items() if k != 'purgeAt'}
    out['bannerVisible'] = banner_visible(item, now)
    out['isExpired'] = bool(item.get('expiresAt') and item['expiresAt'] <= now_iso())
    return out


def _mark_delivered(user_id: str, items: list[dict]):
    ts = now_iso()
    for i in items:
        if not i.get('deliveredAt'):
            table('inbox').update_item(
                Key={'userId': user_id, 'recipientKey': i['recipientKey']},
                UpdateExpression='SET deliveredAt = :t, deliveryStatus = :d',
                ConditionExpression='attribute_exists(recipientKey)',
                ExpressionAttributeValues={':t': ts, ':d': 'DELIVERED_IN_APP'},
            )
            i['deliveredAt'] = ts


def _inbox(event):
    actor = require_actor(event)
    resp = list_for_user(actor['userId'], PAGE_SIZE, decode_key(query_param(event, 'cursor')))
    now = time.time()
    items = [i for i in resp.get('Items', []) if is_started(i, now)]
    _mark_delivered(actor['userId'], items)
    return ok({'items': [_present(i, now) for i in items], 'nextCursor': encode_key(resp.get('LastEvaluatedKey'))})


def _banners(event):
    actor = require_actor(event)
    now = time.time()
    items = list_for_user(actor['userId'], 50).get('Items', [])
    visible = [i for i in items if banner_visible(i, now)]
    _mark_delivered(actor['userId'], visible)
    return ok({'items': [_present(i, now) for i in visible[:5]]})


def _unread(event):
    actor = require_actor(event)
    return ok({'count': unread_count(actor['userId'])})


def _mark(event, recipient_key: str, action: str):
    actor = require_actor(event)
    key = {'userId': actor['userId'], 'recipientKey': recipient_key}  # userId from the token: users only touch their own
    ts = now_iso()
    if action == 'read':
        expr, values = 'SET isRead = :t, readAt = if_not_exists(readAt, :ts)', {':t': True, ':ts': ts}
    else:
        expr, values = 'SET isDismissed = :t, dismissedAt = if_not_exists(dismissedAt, :ts)', {':t': True, ':ts': ts}
    try:
        item = table('inbox').update_item(
            Key=key, UpdateExpression=expr, ExpressionAttributeValues=values,
            ConditionExpression='attribute_exists(recipientKey)', ReturnValues='ALL_NEW',
        )['Attributes']
    except table('inbox').meta.client.exceptions.ConditionalCheckFailedException:
        raise HttpError(404, 'Notification not found')
    return ok(_present(item, time.time()))


def _read_all(event):
    actor = require_actor(event)
    items = query_all(table('inbox'), max_items=500, KeyConditionExpression=Key('userId').eq(actor['userId']),
                      FilterExpression=Attr('isRead').eq(False), ProjectionExpression='recipientKey')
    ts = now_iso()
    for i in items:
        table('inbox').update_item(
            Key={'userId': actor['userId'], 'recipientKey': i['recipientKey']},
            UpdateExpression='SET isRead = :t, readAt = if_not_exists(readAt, :ts)',
            ExpressionAttributeValues={':t': True, ':ts': ts},
        )
    return ok({'updated': len(items)})
