"""
Per-recipient notification records (the "inbox").

Each recipient gets their own item, keyed (userId, recipientKey), so read and
dismiss state is independent per user. `recipientKey` is "<createdAt>_<notifId>"
which sorts newest-last and is URL-safe.

Banner rules (evaluated server-side, see banner_visible):
  - hidden once dismissed (X), regardless of read state;
  - hidden 24h after it was read;
  - hidden once expiresAt has passed;
  - not shown before startsAt (scheduled announcements).
Retention is separate: records stay in the Notification Center until the
table's TTL (`purgeAt`, RETENTION_DAYS) removes them.
"""
import calendar
import time

from boto3.dynamodb.conditions import Key, Attr

from lib.db import table
from lib.util import now_iso, new_id, query_all

READ_BANNER_SECONDS = 24 * 3600
RETENTION_DAYS = 180

# Notification type → the user preference category that can switch it off.
# IMPORTANT and MAINTENANCE notices are always delivered.
PREF_CATEGORY = {
    'GENERAL': 'announcements', 'PRODUCT': 'announcements',
    'CONSULTATION': 'consultations', 'ASSIGNMENT': 'consultations', 'ESCALATION': 'consultations',
    'QUOTATION': 'quotations', 'CRM_TASK': 'crmTasks', 'REMINDER': 'reminders',
}

TYPES = {
    'GENERAL', 'IMPORTANT', 'CONSULTATION', 'CRM_TASK', 'PRODUCT', 'MAINTENANCE',
    # system-generated
    'ASSIGNMENT', 'QUOTATION', 'REMINDER', 'ESCALATION',
}


def recipient_item(user_id: str, notif: dict) -> dict:
    created = notif.get('createdAt') or now_iso()
    return {
        'userId':       user_id,
        'recipientKey': f"{created}_{notif['notifId']}",
        'notifId':      notif['notifId'],
        'title':        notif['title'],
        'message':      notif['message'],
        'type':         notif.get('type', 'GENERAL'),
        'priority':     notif.get('priority', 'NORMAL'),
        'actionLink':   notif.get('actionLink') or None,
        'startsAt':     notif.get('startsAt') or created,
        'expiresAt':    notif.get('expiresAt') or None,
        'createdAt':    created,
        'isRead':       False,
        'isDismissed':  False,
        'deliveryStatus': 'CREATED',
        'purgeAt':      int(time.time()) + RETENTION_DAYS * 86400,
    }


def write_recipients(user_ids, notif: dict, push: bool = False) -> int:
    """Create one inbox record per user; with push=True also send via Expo push (status tracked per record)."""
    user_ids = list(user_ids)
    count = 0
    with table('inbox').batch_writer(overwrite_by_pkeys=['userId', 'recipientKey']) as batch:
        for uid in user_ids:
            item = recipient_item(uid, notif)
            batch.put_item(Item={k: v for k, v in item.items() if v is not None})
            count += 1
    if push and user_ids and is_started({'startsAt': notif.get('startsAt')}):
        from lib.push import tokens_for, send_to_recipients
        try:
            tokens = tokens_for(user_ids)
            key = recipient_item(user_ids[0], notif)['recipientKey']
            send_to_recipients([{'userId': u, 'recipientKey': key, 'tokens': tokens.get(u, [])} for u in user_ids], notif)
        except Exception as e:
            print(f'push send failed: {e}')
    return count


def wants(prefs: dict | None, type_: str) -> bool:
    category = PREF_CATEGORY.get(type_)
    if not category or not prefs:
        return True
    return prefs.get(category, True) is not False and prefs.get('inApp', True) is not False


def _filter_by_prefs(ids: list[str], type_: str) -> list[str]:
    if type_ not in PREF_CATEGORY or not ids:
        return ids
    from lib.db import _resource
    keep = []
    for i in range(0, len(ids), 100):
        chunk = ids[i:i + 100]
        resp = _resource.batch_get_item(RequestItems={table('users').name: {
            'Keys': [{'userId': u} for u in chunk], 'ProjectionExpression': 'userId, notificationPrefs'}})
        prefs = {u['userId']: u.get('notificationPrefs') for u in resp['Responses'].get(table('users').name, [])}
        keep += [u for u in chunk if wants(prefs.get(u), type_)]
    return keep


def notify_users(user_ids, title: str, message: str, type_: str = 'GENERAL',
                 action_link: str | None = None, priority: str = 'NORMAL'):
    """Direct system notification to specific users (no announcement record)."""
    ids = sorted({u for u in user_ids if u and u != 'UNASSIGNED'})
    try:
        ids = _filter_by_prefs(ids, type_)
    except Exception as e:
        print(f'pref filter failed, delivering to all: {e}')
    if not ids:
        return
    notif = {
        'notifId': new_id(), 'title': title[:120], 'message': message[:2000],
        'type': type_, 'priority': priority, 'actionLink': action_link,
        'createdAt': now_iso(),
    }
    try:
        write_recipients(ids, notif, push=True)
    except Exception as e:  # a failed notification must not fail the business write
        print(f'notify failed: {e}')


def user_ids_by_roles(roles, active_only: bool = True, type_: str | None = None) -> list[str]:
    """Active users with these roles; with `type_`, also drops users who opted out of that category."""
    ids = []
    for role in roles:
        users = query_all(
            table('users'),
            IndexName='RoleIndex',
            KeyConditionExpression=Key('role').eq(role),
            ProjectionExpression='userId, isActive, deletionStatus, notificationPrefs',
        )
        for u in users:
            if active_only and (u.get('isActive') is False or u.get('deletionStatus') == 'PENDING'):
                continue
            if type_ and not wants(u.get('notificationPrefs'), type_):
                continue
            ids.append(u['userId'])
    return ids


def notify_roles(roles, title: str, message: str, type_: str = 'GENERAL', action_link: str | None = None):
    notify_users(user_ids_by_roles(roles, type_=type_), title, message, type_, action_link)


def _epoch(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        return calendar.timegm(time.strptime(iso, '%Y-%m-%dT%H:%M:%SZ'))
    except ValueError:
        return None


def banner_visible(item: dict, now: float | None = None) -> bool:
    now = now or time.time()
    if item.get('isDismissed'):
        return False
    starts = _epoch(item.get('startsAt'))
    if starts and starts > now:
        return False
    expires = _epoch(item.get('expiresAt'))
    if expires and expires <= now:
        return False
    if item.get('isRead'):
        read_at = _epoch(item.get('readAt'))
        if read_at is None or now - read_at >= READ_BANNER_SECONDS:
            return False
    return True


def is_started(item: dict, now: float | None = None) -> bool:
    starts = _epoch(item.get('startsAt'))
    return not starts or starts <= (now or time.time())


def list_for_user(user_id: str, limit: int = 50, cursor: dict | None = None):
    kwargs = {
        'KeyConditionExpression': Key('userId').eq(user_id),
        'ScanIndexForward': False,
        'Limit': limit,
    }
    if cursor:
        kwargs['ExclusiveStartKey'] = cursor
    return table('inbox').query(**kwargs)


def unread_count(user_id: str) -> int:
    now = time.time()
    items = query_all(
        table('inbox'),
        max_items=500,
        KeyConditionExpression=Key('userId').eq(user_id),
        FilterExpression=Attr('isRead').eq(False),
        ProjectionExpression='startsAt, expiresAt',
    )
    return sum(1 for i in items if is_started(i, now))
