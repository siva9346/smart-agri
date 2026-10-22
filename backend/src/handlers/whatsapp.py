"""
WhatsApp Business Platform integration.

GET  /whatsapp/status          – {enabled} for internal users (drives UI options)
GET  /whatsapp/config          – settings + secret hints          (integrations.configure)
PUT  /whatsapp/config          – update settings / secrets       (integrations.configure)
POST /whatsapp/test            – {to} send a test message         (integrations.configure)
GET  /whatsapp/webhook         – Meta verification handshake (hub.challenge)
POST /whatsapp/webhook         – Meta events: message statuses and inbound messages.
                                 Rejected unless X-Hub-Signature-256 matches the app secret.

Inbound handling: a message from a known lead's phone is logged on that lead
(and its owner notified); opt-out keywords (STOP…) set whatsappOptOut, opt-in
keywords (START) clear it. Unknown numbers create a new lead in the shared pool
(source WHATSAPP) so enquiries are not lost. Every event is processed
idempotently (message ids are remembered).
"""
import base64
import json
import secrets as pysecrets
import time

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from lib.db import table
from lib.router import run
from lib.permissions import require_permission
from lib.settings import get_setting, put_setting
from lib import secrets as sec
from lib import whatsapp as wa
from lib.crm import log_activity, search_text, UNASSIGNED
from lib.notify import notify_users
from lib.audit import audit
from lib.util import HttpError, now_iso, new_id, clean_str, query_all
from lib.response import ok, query_param, parse_body

SECRET_KEYS = {'accessToken': 'whatsapp/access-token', 'appSecret': 'whatsapp/app-secret', 'verifyToken': 'whatsapp/verify-token'}
TEMPLATE_KINDS = ('GREETING', 'FOLLOW_UP', 'CONSULTATION_SUMMARY', 'QUOTATION')
STATUS_RANK = {'ACCEPTED': 0, 'SENT': 1, 'DELIVERED': 2, 'READ': 3, 'FAILED': 4}


def handler(event, _ctx):
    return run(event, _route)


def _route(event, m, seg):
    if seg == ['status'] and m == 'GET':  return _status(event)
    if seg == ['config'] and m == 'GET':  return _get_config(event)
    if seg == ['config'] and m == 'PUT':  return _put_config(event)
    if seg == ['test'] and m == 'POST':   return _test(event)
    if seg == ['webhook'] and m == 'GET': return _verify(event)
    if seg == ['webhook'] and m == 'POST': return _webhook(event)
    return None


def _status(event):
    require_permission(event, 'crm.view')
    return ok({'enabled': wa.is_enabled()})


def _present(cfg: dict) -> dict:
    out = dict(cfg)
    out['secrets'] = {k: {'configured': bool(sec.get_secret(v)), 'hint': sec.hint(sec.get_secret(v))} for k, v in SECRET_KEYS.items()}
    out['ready'] = wa.is_enabled()
    out['webhookPath'] = '/whatsapp/webhook'
    return out


def _get_config(event):
    require_permission(event, 'integrations.configure')
    return ok(_present(get_setting('whatsapp', fresh=True)))


def _put_config(event):
    actor = require_permission(event, 'integrations.configure')
    body = parse_body(event)
    cfg = get_setting('whatsapp', fresh=True)
    changed = []
    for f, n in (('phoneNumberId', 40), ('businessAccountId', 40), ('apiVersion', 10)):
        if f in body:
            v = clean_str(body, f, n)
            if v and not v.replace('.', '').replace('v', '').isalnum():
                raise HttpError(400, f'invalid {f}')
            cfg[f] = v
            changed.append(f)
    if 'templates' in body:
        tpls = {}
        for kind, t in (body['templates'] or {}).items():
            if kind in TEMPLATE_KINDS and isinstance(t, dict) and str(t.get('name') or '').strip():
                tpls[kind] = {'name': str(t['name']).strip()[:100], 'language': str(t.get('language') or 'en').strip()[:10]}
        cfg['templates'] = tpls
        changed.append('templates')
    for f in ('optOutKeywords', 'optInKeywords'):
        if f in body:
            cfg[f] = [str(k).strip().upper()[:30] for k in (body[f] or []) if str(k).strip()][:20]
            changed.append(f)
    rotated = {}
    for field, key in SECRET_KEYS.items():
        v = (body.get(field) or '').strip()
        if body.get(f'remove_{field}'):
            sec.delete_secret(key); rotated[field] = 'removed'
        elif v and not sec.looks_masked(v):
            if len(v) < 8 or len(v) > 600 or any(c.isspace() for c in v):
                raise HttpError(400, f'{field} format looks invalid')
            sec.put_secret(key, v); rotated[field] = 'set'
    if body.get('generateVerifyToken'):
        sec.put_secret(SECRET_KEYS['verifyToken'], pysecrets.token_urlsafe(24)); rotated['verifyToken'] = 'generated'
    if 'enabled' in body:
        if body['enabled'] and not (cfg.get('phoneNumberId') and sec.get_secret(SECRET_KEYS['accessToken'])):
            raise HttpError(400, 'Save the phone number ID and access token before enabling WhatsApp')
        cfg['enabled'] = bool(body['enabled'])
        changed.append('enabled')
    put_setting('whatsapp', cfg, actor['userId'])
    audit(actor, 'WHATSAPP_CONFIG_UPDATED', 'settings', 'whatsapp', {'changed': changed, 'secrets': rotated or None})
    out = _present(cfg)
    if rotated.get('verifyToken') == 'generated':
        out['verifyToken'] = sec.get_secret(SECRET_KEYS['verifyToken'])  # shown once so it can be pasted into Meta
    return ok(out)


def _test(event):
    actor = require_permission(event, 'integrations.configure')
    to = clean_str(parse_body(event), 'to', 20, required=True)
    try:
        res = wa.send(to, 'Smart Agri test message — WhatsApp Business is connected.', 'TEST')
    except wa.WhatsAppError as e:
        audit(actor, 'WHATSAPP_TEST', 'settings', 'whatsapp', {'ok': False})
        return ok({'ok': False, 'error': str(e)})
    audit(actor, 'WHATSAPP_TEST', 'settings', 'whatsapp', {'ok': True})
    return ok({'ok': True, 'messageId': res['messageId'],
               'note': 'Accepted by WhatsApp. Delivery arrives via the webhook; a free-form test only delivers if the number messaged you in the last 24h.'})


# ── Webhook ─────────────────────────────────────────────────────────────────

def _verify(event):
    mode = query_param(event, 'hub.mode')
    token = query_param(event, 'hub.verify_token')
    expected = sec.get_secret(SECRET_KEYS['verifyToken'])
    if mode == 'subscribe' and expected and token and pysecrets.compare_digest(token, expected):
        return {'statusCode': 200, 'headers': {'Content-Type': 'text/plain'}, 'body': query_param(event, 'hub.challenge') or ''}
    return {'statusCode': 403, 'headers': {'Content-Type': 'text/plain'}, 'body': 'forbidden'}


def _raw_body(event) -> str:
    raw = event.get('body') or ''
    return base64.b64decode(raw).decode() if event.get('isBase64Encoded') else raw


def _webhook(event):
    raw = _raw_body(event)
    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    if not wa.verify_signature(raw, headers.get('x-hub-signature-256')):
        return {'statusCode': 401, 'headers': {}, 'body': ''}
    try:
        payload = json.loads(raw or '{}')
    except ValueError:
        return {'statusCode': 400, 'headers': {}, 'body': ''}
    for entry in payload.get('entry', []):
        for change in entry.get('changes', []):
            value = change.get('value') or {}
            for st in value.get('statuses', []):
                _apply_status(st)
            contacts = {c.get('wa_id'): (c.get('profile') or {}).get('name') for c in value.get('contacts', [])}
            for msg in value.get('messages', []):
                _inbound(msg, contacts.get(msg.get('from')))
    return ok({'received': True})  # always 200 so Meta doesn't retry processed events


def _apply_status(st: dict):
    mapping = table('settings').get_item(Key={'settingKey': f"wamid#{st.get('id')}"}).get('Item')
    if not mapping:
        return
    status = str(st.get('status', '')).upper()
    if status not in STATUS_RANK:
        return
    key = {'leadId': mapping['leadId'], 'sortKey': mapping['sortKey']}
    act = table('lead_activities').get_item(Key=key).get('Item')
    if not act:
        return
    current = (act.get('data') or {}).get('deliveryStatus', 'ACCEPTED')
    if STATUS_RANK.get(current, -1) >= STATUS_RANK[status] and status != 'FAILED':
        return  # webhooks can arrive out of order; never move backwards
    data = dict(act.get('data') or {})
    data['deliveryStatus'] = status
    data[f'{status.lower()}At'] = now_iso()
    if status == 'FAILED':
        errs = st.get('errors') or [{}]
        data['error'] = str(errs[0].get('title') or errs[0].get('message') or 'failed')[:200]
    table('lead_activities').update_item(Key=key, UpdateExpression='SET #d = :d', ExpressionAttributeNames={'#d': 'data'},
                                         ExpressionAttributeValues={':d': data})


def _find_leads(wa_number: str) -> list[dict]:
    digits = ''.join(ch for ch in wa_number if ch.isdigit())
    variants = {digits, '+' + digits, digits[-10:]}
    leads = []
    for v in variants:
        leads += query_all(table('leads'), IndexName='PhoneIndex', KeyConditionExpression=Key('phone').eq(v))
    return leads


def _inbound(msg: dict, profile_name: str | None):
    mid = msg.get('id')
    try:  # idempotency: Meta may deliver the same message more than once
        table('settings').put_item(Item={'settingKey': f'wain#{mid}', 'expiresAtEpoch': int(time.time()) + 7 * 86400},
                                   ConditionExpression='attribute_not_exists(settingKey)')
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return
        raise
    sender = msg.get('from', '')
    mtype = msg.get('type')
    text = (msg.get('text') or {}).get('body') or (msg.get('button') or {}).get('text') \
        or ((msg.get('interactive') or {}).get('button_reply') or {}).get('title') or f'[{mtype} message]'
    cfg = get_setting('whatsapp')
    keyword = text.strip().upper()
    leads = [l for l in _find_leads(sender) if l.get('stage') not in ('WON', 'LOST')] or _find_leads(sender)

    if not leads:
        now = now_iso()
        lead = {
            'leadId': new_id(), 'customerName': profile_name or f'WhatsApp +{sender}', 'phone': sender[-10:] if sender.startswith('91') and len(sender) == 12 else sender,
            'location': '-', 'source': 'WHATSAPP', 'requirement': text[:2000], 'priority': 'MEDIUM', 'stage': 'NEW',
            'ownerId': UNASSIGNED, 'createdBy': 'whatsapp', 'createdAt': now, 'updatedAt': now, 'lastActivityAt': now,
        }
        lead['searchText'] = search_text(lead)
        table('leads').put_item(Item=lead)
        leads = [lead]
        from lib.notify import notify_roles
        notify_roles(['ADMIN', 'SUPER_ADMIN'], 'New WhatsApp enquiry', f"{lead['customerName']}: {text[:140]}", 'CRM_TASK', f"lead/{lead['leadId']}")

    for lead in leads[:3]:
        updates = {'waLastInboundAt': now_iso()}
        if keyword in cfg.get('optOutKeywords', []):
            updates['whatsappOptOut'] = True
        elif keyword in cfg.get('optInKeywords', []):
            updates['whatsappOptOut'] = False
        table('leads').update_item(Key={'leadId': lead['leadId']},
                                   UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
                                   ExpressionAttributeNames={f'#{k}': k for k in updates},
                                   ExpressionAttributeValues={f':{k}': v for k, v in updates.items()})
        note = ' (opted out of WhatsApp)' if updates.get('whatsappOptOut') is True else \
            ' (opted back in to WhatsApp)' if updates.get('whatsappOptOut') is False else ''
        log_activity(lead['leadId'], 'WHATSAPP', None, f'Customer: {text[:1000]}{note}',
                     {'direction': 'INBOUND', 'channel': 'CLOUD_API', 'providerMessageId': mid})
        if lead.get('ownerId') not in (None, UNASSIGNED):
            notify_users([lead['ownerId']], f"WhatsApp from {lead.get('customerName')}", text[:160], 'CRM_TASK', f"lead/{lead['leadId']}")
