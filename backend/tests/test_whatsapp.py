"""WhatsApp Business Cloud API: config, sending, signed webhook, statuses, inbound, opt-out."""
import hashlib
import hmac
import json
import urllib.error
from io import BytesIO

import pytest

from conftest import call, make_user, make_product, inbox
from lib.db import table
from lib import whatsapp as lib_wa
from handlers import whatsapp, crm, quotations

APP_SECRET = 'app-secret-123456'


@pytest.fixture
def meta(monkeypatch):
    sent = []

    def fake_post(payload):
        sent.append(payload)
        if payload.get('to', '').endswith('9000000099'):  # simulate 24h-window rejection
            raise lib_wa.WhatsAppError('More than 24 hours since the customer last messaged — configure an approved template for this message type.')
        return {'messages': [{'id': f'wamid.{len(sent)}'}]}
    monkeypatch.setattr(lib_wa, '_post', fake_post)
    return sent


def configure(sa):
    st, cfg = call(whatsapp, 'PUT', 'config', sa, {
        'phoneNumberId': '123456789', 'accessToken': 'EAAG' + 'x' * 40, 'appSecret': APP_SECRET, 'generateVerifyToken': True,
        'templates': {'QUOTATION': {'name': 'quotation_v1', 'language': 'en'}}})
    assert st == 200
    st, cfg2 = call(whatsapp, 'PUT', 'config', sa, {'enabled': True})
    assert st == 200 and cfg2['ready']
    return cfg


def webhook(body: dict, secret=APP_SECRET):
    raw = json.dumps(body)
    sig = 'sha256=' + hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    event = {'requestContext': {'http': {'method': 'POST'}}, 'pathParameters': {'proxy': 'webhook'},
             'headers': {'x-hub-signature-256': sig}, 'body': raw}
    return whatsapp.handler(event, None)


def status_event(mid, status):
    return {'entry': [{'changes': [{'value': {'statuses': [{'id': mid, 'status': status}]}}]}]}


def inbound_event(mid, sender, text, name='Customer'):
    return {'entry': [{'changes': [{'value': {'contacts': [{'wa_id': sender, 'profile': {'name': name}}],
                                              'messages': [{'id': mid, 'from': sender, 'type': 'text', 'text': {'body': text}}]}}]}]}


def test_config_secrets_are_masked_and_enable_requires_credentials():
    sa = make_user('SUPER_ADMIN')
    adm = make_user('ADMIN')
    assert call(whatsapp, 'GET', 'config', adm)[0] == 403
    assert call(whatsapp, 'PUT', 'config', sa, {'enabled': True})[0] == 400
    cfg = configure(sa)
    assert cfg['verifyToken'], 'generated verify token is shown once'
    st, got = call(whatsapp, 'GET', 'config', sa)
    assert 'EAAG' not in json.dumps(got) and APP_SECRET not in json.dumps(got) and 'verifyToken' not in got
    assert got['secrets']['accessToken']['hint'].startswith('••••')


def test_verify_handshake():
    sa = make_user('SUPER_ADMIN')
    token = configure(sa)['verifyToken']
    ev = lambda t: {'requestContext': {'http': {'method': 'GET'}}, 'pathParameters': {'proxy': 'webhook'},
                    'queryStringParameters': {'hub.mode': 'subscribe', 'hub.verify_token': t, 'hub.challenge': '42'}}
    assert whatsapp.handler(ev(token), None)['body'] == '42'
    assert whatsapp.handler(ev('wrong'), None)['statusCode'] == 403


def test_send_from_lead_and_delivery_status_flow(meta):
    sa, staff = make_user('SUPER_ADMIN'), make_user('STAFF')
    configure(sa)
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': 'Arun', 'phone': '9876543210', 'location': 'Salem',
                                                 'source': 'PHONE_CALL', 'requirement': 'Seeds'})
    st, res = call(crm, 'POST', f"leads/{lead['leadId']}/whatsapp", staff, {'kind': 'GREETING', 'send': True})
    assert st == 201 and res['sent'] and meta[-1]['to'] == '919876543210' and meta[-1]['type'] == 'text'
    act = res['activity']
    assert act['data']['deliveryStatus'] == 'ACCEPTED'

    assert webhook(status_event('wamid.1', 'delivered'))['statusCode'] == 200
    assert webhook(status_event('wamid.1', 'sent'))['statusCode'] == 200   # late, out of order
    stored = table('lead_activities').get_item(Key={'leadId': lead['leadId'], 'sortKey': act['sortKey']})['Item']
    assert stored['data']['deliveryStatus'] == 'DELIVERED', 'status never moves backwards'
    webhook(status_event('wamid.1', 'read'))
    stored = table('lead_activities').get_item(Key={'leadId': lead['leadId'], 'sortKey': act['sortKey']})['Item']
    assert stored['data']['deliveryStatus'] == 'READ'

    # Unsigned / wrongly signed webhooks are rejected and change nothing.
    assert webhook(status_event('wamid.1', 'failed'), secret='attacker')['statusCode'] == 401


def test_24h_window_error_is_reported_not_hidden(meta):
    sa, staff = make_user('SUPER_ADMIN'), make_user('STAFF')
    configure(sa)
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': 'B', 'phone': '9000000099', 'location': 'X',
                                                 'source': 'OTHER', 'requirement': 'R'})
    st, err = call(crm, 'POST', f"leads/{lead['leadId']}/whatsapp", staff, {'kind': 'FOLLOW_UP', 'send': True})
    assert st == 502 and '24 hours' in err['error']
    acts = call(crm, 'GET', f"leads/{lead['leadId']}", staff)[1]['activities']
    assert any(a['type'] == 'WHATSAPP' and a.get('data', {}).get('deliveryStatus') == 'FAILED' for a in acts)


def test_inbound_message_opt_out_and_opt_in(meta):
    sa, staff = make_user('SUPER_ADMIN'), make_user('STAFF')
    configure(sa)
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': 'C', 'phone': '9123456780', 'location': 'X',
                                                 'source': 'OTHER', 'requirement': 'R'})
    webhook(inbound_event('in.1', '919123456780', 'Do you have drip kits?'))
    webhook(inbound_event('in.1', '919123456780', 'Do you have drip kits?'))  # duplicate delivery ignored
    acts = [a for a in call(crm, 'GET', f"leads/{lead['leadId']}", staff)[1]['activities'] if a.get('data', {}).get('direction') == 'INBOUND']
    assert len(acts) == 1 and 'drip kits' in acts[0]['text']
    assert any('WhatsApp from' in n['title'] for n in inbox(staff))

    webhook(inbound_event('in.2', '919123456780', 'STOP'))
    assert table('leads').get_item(Key={'leadId': lead['leadId']})['Item']['whatsappOptOut'] is True
    assert call(crm, 'POST', f"leads/{lead['leadId']}/whatsapp", staff, {'kind': 'GREETING', 'send': True})[0] == 409
    webhook(inbound_event('in.3', '919123456780', 'start'))
    assert table('leads').get_item(Key={'leadId': lead['leadId']})['Item']['whatsappOptOut'] is False


def test_inbound_from_unknown_number_creates_pool_lead(meta):
    sa = make_user('SUPER_ADMIN')
    configure(sa)
    webhook(inbound_event('in.9', '919555512345', 'Need fertilizer for paddy', name='Lakshmi'))
    leads = table('leads').query(IndexName='PhoneIndex', KeyConditionExpression=__import__('boto3').dynamodb.conditions.Key('phone').eq('9555512345'))['Items']
    assert len(leads) == 1 and leads[0]['source'] == 'WHATSAPP' and leads[0]['ownerId'] == 'UNASSIGNED'
    assert leads[0]['customerName'] == 'Lakshmi'


def test_quotation_share_via_business_api_uses_template(meta):
    sa, staff, adm, farmer = make_user('SUPER_ADMIN'), make_user('STAFF'), make_user('ADMIN'), make_user('FARMER')
    configure(sa)
    p = make_product()
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': farmer['name'], 'phone': farmer['phone'], 'location': 'X',
                                                 'source': 'OTHER', 'requirement': 'R'})
    _, q = call(quotations, 'POST', '', staff, {'leadId': lead['leadId'], 'items': [{'productId': p['productId'], 'quantity': 2}]})
    call(quotations, 'POST', f"{q['quotationId']}/submit", staff)
    call(quotations, 'POST', f"{q['quotationId']}/approve", adm)
    st, res = call(quotations, 'POST', f"{q['quotationId']}/share", staff, {'channel': 'WHATSAPP_API'})
    assert st == 200 and meta[-1]['type'] == 'template' and meta[-1]['template']['name'] == 'quotation_v1'
    params = [x['text'] for x in meta[-1]['template']['components'][0]['parameters']]
    assert params[1] == q['quotationNumber'] and params[3] == '₹500.00'
    assert res['quotation']['shares'][-1]['deliveryStatus'] == 'ACCEPTED'


def test_disabled_integration_cannot_send(meta):
    staff = make_user('STAFF')
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': 'D', 'phone': '9000011111', 'location': 'X',
                                                 'source': 'OTHER', 'requirement': 'R'})
    st, err = call(crm, 'POST', f"leads/{lead['leadId']}/whatsapp", staff, {'kind': 'GREETING', 'send': True})
    assert st == 502 and 'not configured' in err['error'] and meta == []
