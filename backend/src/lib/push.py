"""
Push notifications through the Expo Push Service (https://exp.host).

Devices register an Expo push token via POST /profile/push-token. Delivery is
tracked honestly in three steps, stored on the recipient's inbox item:
  pushStatus = NO_DEVICE        user has no registered device
             = SENT_TO_EXPO     Expo accepted the message (ticket ok)
             = DELIVERED_TO_OS  Expo receipt ok: handed to APNs / FCM
             = FAILED           ticket or receipt error (pushError has the reason)
Reaching APNs/FCM is the furthest point we can observe; it is not proof the
person saw it. Receipts are collected by the scheduler (collect_receipts).

Android delivery additionally needs FCM credentials uploaded to EAS; iOS needs
an APNs key in EAS. Without them Expo returns errors that show up as FAILED.
"""
import json
import os
import time
import urllib.request
import urllib.error

from boto3.dynamodb.conditions import Key

from lib.db import table

SEND_URL = 'https://exp.host/--/api/v2/push/send'
RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts'
ACCESS_TOKEN = os.environ.get('EXPO_ACCESS_TOKEN', '')  # only needed if "enhanced push security" is on
MAX_TOKENS_PER_USER = 5


def _post(url: str, payload) -> dict:
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    if ACCESS_TOKEN:
        headers['Authorization'] = f'Bearer {ACCESS_TOKEN}'
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read() or b'{}')


def is_expo_token(token: str) -> bool:
    return isinstance(token, str) and token.startswith(('ExponentPushToken[', 'ExpoPushToken[')) and token.endswith(']')


def _remove_token(user_id: str, token: str):
    user = table('users').get_item(Key={'userId': user_id}).get('Item') or {}
    tokens = [t for t in user.get('pushTokens', []) if t.get('token') != token]
    table('users').update_item(Key={'userId': user_id}, UpdateExpression='SET pushTokens = :t',
                               ExpressionAttributeValues={':t': tokens})


def _mark(user_id: str, recipient_key: str, status: str, error: str | None = None, ticket_ids=None):
    expr = 'SET pushStatus = :s'
    values = {':s': status}
    if error:
        expr += ', pushError = :e'
        values[':e'] = error[:300]
    if ticket_ids:
        expr += ', pushTickets = :t, pushPending = :p'
        values.update({':t': ticket_ids, ':p': 'Y'})
    try:
        table('inbox').update_item(Key={'userId': user_id, 'recipientKey': recipient_key},
                                   UpdateExpression=expr, ExpressionAttributeValues=values)
    except Exception as e:
        print(f'push status update failed: {e}')


def send_to_recipients(recipients: list[dict], notif: dict):
    """recipients: [{userId, recipientKey, tokens: [str]}]. Never raises."""
    messages, owners = [], []
    for r in recipients:
        if not r['tokens']:
            _mark(r['userId'], r['recipientKey'], 'NO_DEVICE')
            continue
        for tok in r['tokens']:
            messages.append({
                'to': tok, 'title': notif['title'][:100], 'body': notif['message'][:240], 'sound': 'default',
                'priority': 'high' if notif.get('priority') == 'HIGH' else 'default',
                'data': {'actionLink': notif.get('actionLink'), 'notifId': notif['notifId']},
            })
            owners.append((r['userId'], r['recipientKey'], tok))
    per_recipient: dict = {}
    for i in range(0, len(messages), 100):
        chunk, chunk_owners = messages[i:i + 100], owners[i:i + 100]
        try:
            tickets = _post(SEND_URL, chunk).get('data', [])
        except Exception as e:
            tickets = [{'status': 'error', 'message': f'Expo push request failed: {e}'}] * len(chunk)
        for (uid, rk, tok), ticket in zip(chunk_owners, tickets):
            entry = per_recipient.setdefault((uid, rk), {'ids': [], 'errors': []})
            if ticket.get('status') == 'ok':
                entry['ids'].append(ticket['id'])
            else:
                entry['errors'].append(ticket.get('message', 'error'))
                if (ticket.get('details') or {}).get('error') == 'DeviceNotRegistered':
                    _remove_token(uid, tok)
    for (uid, rk), entry in per_recipient.items():
        if entry['ids']:
            _mark(uid, rk, 'SENT_TO_EXPO', ticket_ids=entry['ids'])
        else:
            _mark(uid, rk, 'FAILED', '; '.join(entry['errors']))


def tokens_for(user_ids: list[str]) -> dict:
    """userId → list of push tokens for users who have push enabled in their preferences."""
    from lib.db import _resource
    out = {}
    for i in range(0, len(user_ids), 100):
        chunk = user_ids[i:i + 100]
        resp = _resource.batch_get_item(RequestItems={table('users').name: {
            'Keys': [{'userId': u} for u in chunk], 'ProjectionExpression': 'userId, pushTokens, notificationPrefs'}})
        for u in resp['Responses'].get(table('users').name, []):
            if (u.get('notificationPrefs') or {}).get('push', True) is False:
                out[u['userId']] = []
            else:
                out[u['userId']] = [t['token'] for t in u.get('pushTokens', []) if is_expo_token(t.get('token'))]
    return out


def collect_receipts(limit: int = 300) -> int:
    """Scheduler step: turn SENT_TO_EXPO into DELIVERED_TO_OS / FAILED using Expo receipts."""
    pending = table('inbox').query(IndexName='PushPendingIndex', KeyConditionExpression=Key('pushPending').eq('Y'),
                                   Limit=limit).get('Items', [])
    # Expo receipts are available ~15 min after sending; skip very recent ones.
    cutoff = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - 15 * 60))
    pending = [p for p in pending if p.get('createdAt', '') <= cutoff]
    ids = [t for p in pending for t in p.get('pushTickets', [])]
    if not ids:
        return 0
    receipts = {}
    for i in range(0, len(ids), 300):
        try:
            receipts.update(_post(RECEIPTS_URL, {'ids': ids[i:i + 300]}).get('data', {}))
        except Exception as e:
            print(f'receipt fetch failed: {e}')
            return 0
    done = 0
    for p in pending:
        rs = [receipts.get(t) for t in p.get('pushTickets', [])]
        if any(r is None for r in rs):
            continue  # not ready yet
        ok = any(r.get('status') == 'ok' for r in rs)
        errs = '; '.join(r.get('message', '') for r in rs if r.get('status') != 'ok')
        table('inbox').update_item(
            Key={'userId': p['userId'], 'recipientKey': p['recipientKey']},
            UpdateExpression='SET pushStatus = :s, pushError = :e REMOVE pushPending',
            ExpressionAttributeValues={':s': 'DELIVERED_TO_OS' if ok else 'FAILED', ':e': errs or None},
        )
        done += 1
    return done
