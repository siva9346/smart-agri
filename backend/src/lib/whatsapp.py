"""
WhatsApp Business Platform (Meta Cloud API) client.

Configuration (settings key 'whatsapp') + secrets in SSM:
  whatsapp/access-token  – permanent system-user token
  whatsapp/app-secret    – Meta app secret, used to verify webhook signatures
  whatsapp/verify-token  – the token typed into Meta's webhook setup screen

Messaging rules enforced by WhatsApp itself: free-form text is only accepted
within 24 h of the customer's last inbound message; outside that window an
approved *template* is required. We send the configured template when one is
set for the message kind, otherwise free-form text, and record whatever the API
answers. Delivery progress (sent → delivered → read / failed) arrives later on
the webhook and is written back onto the CRM activity.
"""
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.request

from lib.db import table
from lib.secrets import get_secret
from lib.settings import get_setting

GRAPH = 'https://graph.facebook.com'


class WhatsAppError(Exception):
    """Safe-to-show error from the Cloud API (never contains the token)."""


def config() -> dict:
    return get_setting('whatsapp')


def is_enabled() -> bool:
    cfg = config()
    return bool(cfg.get('enabled') and cfg.get('phoneNumberId') and get_secret('whatsapp/access-token'))


def to_wa_number(phone: str) -> str:
    """E.164 digits without '+'. Ten-digit numbers are assumed Indian (+91)."""
    digits = ''.join(ch for ch in phone if ch.isdigit())
    if len(digits) == 10:
        digits = '91' + digits
    return digits


def _post(payload: dict) -> dict:
    cfg = config()
    url = f"{GRAPH}/{cfg.get('apiVersion') or 'v21.0'}/{cfg['phoneNumberId']}/messages"
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method='POST', headers={
        'Content-Type': 'application/json', 'Authorization': f"Bearer {get_secret('whatsapp/access-token')}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read() or b'{}')
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read() or b'{}').get('error', {})
        except Exception:
            err = {}
        code = err.get('code')
        if code == 131047 or 're-engagement' in str(err.get('message', '')).lower():
            raise WhatsAppError('More than 24 hours since the customer last messaged — configure an approved template for this message type.')
        if e.code in (401, 403) or code == 190:
            raise WhatsAppError('WhatsApp rejected the access token (expired or missing permissions).')
        raise WhatsAppError(f"WhatsApp API error {code or e.code}: {str(err.get('message', ''))[:160]}")
    except (urllib.error.URLError, TimeoutError) as e:
        raise WhatsAppError(f'Could not reach WhatsApp ({getattr(e, "reason", "timeout")}).')


def send(phone: str, text: str, kind: str, params: list[str] | None = None) -> dict:
    """Send one message; returns {'messageId', 'mode': 'TEMPLATE'|'TEXT'}."""
    if not is_enabled():
        raise WhatsAppError('WhatsApp Business is not configured.')
    cfg = config()
    tpl = (cfg.get('templates') or {}).get(kind) or {}
    to = to_wa_number(phone)
    if tpl.get('name'):
        payload = {'messaging_product': 'whatsapp', 'to': to, 'type': 'template', 'template': {
            'name': tpl['name'], 'language': {'code': tpl.get('language') or 'en'},
            **({'components': [{'type': 'body', 'parameters': [{'type': 'text', 'text': p[:1000]} for p in params]}]}
               if params else {}),
        }}
        mode = 'TEMPLATE'
    else:
        payload = {'messaging_product': 'whatsapp', 'to': to, 'type': 'text', 'text': {'body': text[:4096]}}
        mode = 'TEXT'
    data = _post(payload)
    try:
        mid = data['messages'][0]['id']
    except (KeyError, IndexError):
        raise WhatsAppError('WhatsApp returned no message id.')
    return {'messageId': mid, 'mode': mode}


def remember_message(message_id: str, lead_id: str, activity_sort_key: str):
    """Map wamid → CRM activity so webhook status updates can be applied (kept 30 days)."""
    table('settings').put_item(Item={
        'settingKey': f'wamid#{message_id}', 'leadId': lead_id, 'sortKey': activity_sort_key,
        'expiresAtEpoch': int(time.time()) + 30 * 86400,
    })


def verify_signature(raw_body: str, header: str | None) -> bool:
    secret = get_secret('whatsapp/app-secret')
    if not secret or not header or not header.startswith('sha256='):
        return False
    expected = hmac.new(secret.encode(), raw_body.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[7:])
