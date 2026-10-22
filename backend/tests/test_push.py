"""Expo push: token registration, sending, preference opt-out, receipts, dead tokens."""
import time

import pytest

from conftest import call, make_user, inbox
from lib.db import table
from lib import push as lib_push
from handlers import profile, notifications, scheduler, consultations

TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'
TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]'


@pytest.fixture
def expo(monkeypatch):
    sent, behaviour = [], {'dead': set(), 'receipt': 'ok'}

    def fake_post(url, payload):
        if url == lib_push.SEND_URL:
            sent.extend(payload)
            return {'data': [
                {'status': 'error', 'message': 'not registered', 'details': {'error': 'DeviceNotRegistered'}}
                if m['to'] in behaviour['dead'] else {'status': 'ok', 'id': f"ticket-{m['to'][-4:]}-{len(sent)}"}
                for m in payload]}
        return {'data': {i: {'status': behaviour['receipt'], 'message': 'MessageRateExceeded'} for i in payload['ids']}}
    monkeypatch.setattr(lib_push, '_post', fake_post)
    return sent, behaviour


def test_register_token_and_validation():
    u = make_user('FARMER')
    assert call(profile, 'POST', 'push-token', u, {'token': 'garbage'})[0] == 400
    st, r = call(profile, 'POST', 'push-token', u, {'token': TOKEN_A, 'platform': 'android'})
    assert st == 200 and r['devices'] == 1
    _, me = call(profile, 'GET', '', u)
    assert me['pushDevices'] == 1 and 'pushTokens' not in me
    call(profile, 'POST', 'push-token/remove', u, {'token': TOKEN_A})
    assert call(profile, 'GET', '', u)[1]['pushDevices'] == 0


def test_system_notification_is_pushed_and_tracked(expo):
    sent, behaviour = expo
    farmer = make_user('FARMER')
    expert = make_user('EXPERT', specializations=['tomato'])
    call(profile, 'POST', 'push-token', expert, {'token': TOKEN_A})
    call(consultations, 'POST', '', farmer, {'idempotencyKey': 'k1', 'cropName': 'Tomato', 'problemCategory': 'disease',
                                             'symptoms': 'Spots on leaves spreading', 'severity': 'LOW'})
    assert any(m['to'] == TOKEN_A for m in sent)
    rec = [i for i in inbox(expert) if i['type'] == 'ASSIGNMENT'][0]
    assert rec['pushStatus'] == 'SENT_TO_EXPO' and rec['pushPending'] == 'Y'
    assert [i for i in inbox(farmer)][0]['pushStatus'] == 'NO_DEVICE'

    # Receipts are collected only after ~15 minutes.
    old = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - 20 * 60))
    table('inbox').update_item(Key={'userId': expert['userId'], 'recipientKey': rec['recipientKey']},
                               UpdateExpression='SET createdAt = :t', ExpressionAttributeValues={':t': old})
    assert scheduler.handler({}, None)['pushReceipts'] == 1
    rec = [i for i in inbox(expert) if i['type'] == 'ASSIGNMENT'][0]
    assert rec['pushStatus'] == 'DELIVERED_TO_OS' and 'pushPending' not in rec


def test_push_opt_out_and_dead_tokens(expo):
    sent, behaviour = expo
    adm, a, b = make_user('ADMIN'), make_user('FARMER'), make_user('FARMER')
    call(profile, 'POST', 'push-token', a, {'token': TOKEN_A})
    call(profile, 'POST', 'push-token', b, {'token': TOKEN_B})
    call(profile, 'PUT', '', a, {'notificationPrefs': {'push': False}})
    behaviour['dead'].add(TOKEN_B)
    st, n = call(notifications, 'POST', '', adm, {'title': 'Offer', 'message': 'm', 'audience': 'CUSTOMERS', 'channels': ['IN_APP', 'PUSH']})
    assert st == 201
    assert not any(m['to'] == TOKEN_A for m in sent), 'push opt-out respected (still gets in-app)'
    assert len(inbox(a)) == 1 and inbox(a)[0]['pushStatus'] == 'NO_DEVICE'
    assert inbox(b)[0]['pushStatus'] == 'FAILED'
    assert table('users').get_item(Key={'userId': b['userId']})['Item']['pushTokens'] == [], 'dead token removed'
    _, stats = call(notifications, 'GET', f"{n['notifId']}/stats", adm)
    assert stats['push']['FAILED'] == 1 and stats['push']['NO_DEVICE'] == 1
    assert stats['channelStatus']['PUSH'] == 'SENT'


def test_in_app_only_announcement_does_not_push(expo):
    sent, _ = expo
    adm, a = make_user('ADMIN'), make_user('FARMER')
    call(profile, 'POST', 'push-token', a, {'token': TOKEN_A})
    call(notifications, 'POST', '', adm, {'title': 'Hi', 'message': 'm', 'audience': 'CUSTOMERS'})
    assert sent == [] and 'pushStatus' not in inbox(a)[0]


def test_scheduled_announcement_pushes_when_due(expo):
    sent, _ = expo
    adm, a = make_user('ADMIN'), make_user('FARMER')
    call(profile, 'POST', 'push-token', a, {'token': TOKEN_A})
    st, n = call(notifications, 'POST', '', adm, {'title': 'Later', 'message': 'm', 'audience': 'CUSTOMERS',
                                                  'channels': ['PUSH'], 'startsAt': '2099-01-01T00:00'})
    assert sent == []
    assert table('notifications').get_item(Key={'notifId': n['notifId']})['Item']['channelStatus']['PUSH'] == 'NOT_SENT_SCHEDULED'
    table('notifications').update_item(Key={'notifId': n['notifId']}, UpdateExpression='SET startsAt = :s',
                                       ExpressionAttributeValues={':s': '2020-01-01T00:00:00Z'})
    assert scheduler.handler({}, None)['scheduledPushes'] == 1
    assert any(m['to'] == TOKEN_A for m in sent)
