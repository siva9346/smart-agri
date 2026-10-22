"""End-to-end API scenarios (spec §20, tests 1–16) against moto-backed tables."""
import time
import uuid
from decimal import Decimal

import pytest
from boto3.dynamodb.conditions import Key

from conftest import call, make_user, make_product, inbox, TINY_PNG
from lib.db import table
from handlers import consultations, crm, quotations, tasks, notifications, ai, profile, users, admin, auth, scheduler


def consult_body(**over):
    body = {'idempotencyKey': str(uuid.uuid4()), 'cropName': 'Tomato', 'problemCategory': 'disease',
            'symptoms': 'Yellow leaves with brown spots spreading upward', 'severity': 'HIGH',
            'farmLocation': 'Erode', 'preferredContact': 'WHATSAPP'}
    body.update(over)
    return body


def leads_for(customer):
    return table('leads').query(IndexName='CustomerIndex',
                                KeyConditionExpression=Key('customerId').eq(customer['userId']))['Items']


# ── Test 1: consultation → CRM lead, assignment, notifications ──────────────

def test_consultation_creates_one_lead_assigns_expert_and_notifies():
    farmer = make_user('FARMER')
    staff = make_user('STAFF')
    expert = make_user('EXPERT', specializations=['tomato'])
    make_user('EXPERT', specializations=['general'])

    st, photo = call(consultations, 'POST', 'upload-photo', farmer, {'image': TINY_PNG, 'contentType': 'image/png'})
    assert st == 201 and photo['key'].startswith(f"consultations/{farmer['userId']}/")

    body = consult_body(photoKeys=[photo['key']])
    st, c = call(consultations, 'POST', '', farmer, body)
    assert st == 201
    assert c['status'] == 'ASSIGNED' and c['expertId'] == expert['userId']
    assert 'leadId' not in c, 'internal routing data must not be returned to customers'

    # Retry with the same idempotency key → same consultation, still exactly one lead.
    st, again = call(consultations, 'POST', '', farmer, body)
    assert st == 200 and again['consultationId'] == c['consultationId']
    leads = leads_for(farmer)
    assert len(leads) == 1
    lead = leads[0]
    assert lead['source'] == 'EXPERT_CONSULTATION' and lead['stage'] == 'EXPERT_CONSULTATION'
    assert lead['expertId'] == expert['userId'] and lead['ownerId'] == staff['userId']
    assert lead['priority'] == 'HIGH'

    assert any(n['type'] == 'ASSIGNMENT' for n in inbox(expert))
    assert any(n['title'] == 'Expert assigned' for n in inbox(farmer))
    assert any(n['type'] == 'CRM_TASK' for n in inbox(staff))
    assert int(table('users').get_item(Key={'userId': expert['userId']})['Item']['activeConsultationCount']) == 1

    # Photo stays private: only reachable via presigned URL on the detail view.
    st, detail = call(consultations, 'GET', c['consultationId'], farmer)
    assert st == 200 and 'X-Amz-Signature' in detail['photoUrls'][0]


def test_photo_keys_must_belong_to_the_customer():
    a, b = make_user('FARMER'), make_user('FARMER')
    st, _ = call(consultations, 'POST', '', a, consult_body(photoKeys=[f"consultations/{b['userId']}/x.png"]))
    assert st == 400


# ── Test 2: expert fallback chain ───────────────────────────────────────────

@pytest.mark.parametrize('experts,expected_tier', [
    ([['vegetables']], 'RELATED'),
    ([['plant pathology']], 'RELATED'),
    ([['general']], 'GENERAL'),
    ([['paddy'], ['general']], 'GENERAL'),
])
def test_expert_fallback_tiers(experts, expected_tier):
    farmer = make_user('FARMER')
    for specs in experts:
        make_user('EXPERT', specializations=specs)
    st, c = call(consultations, 'POST', '', farmer, consult_body())
    assert st == 201 and c['status'] == 'ASSIGNED'
    stored = table('consultations').get_item(Key={'consultationId': c['consultationId']})['Item']
    assert stored['assignmentTier'] == expected_tier


def test_no_eligible_expert_goes_to_admin_queue():
    farmer = make_user('FARMER')
    admin_user = make_user('ADMIN')
    make_user('EXPERT', specializations=['tomato'], isAvailable=False)
    make_user('EXPERT', specializations=['tomato'], isActive=False)
    make_user('EXPERT', specializations=['general'], activeConsultationCount=15)  # at default capacity
    st, c = call(consultations, 'POST', '', farmer, consult_body())
    assert st == 201 and c['status'] == 'AWAITING_ASSIGNMENT' and 'expertId' not in c
    assert any(n['type'] == 'ESCALATION' for n in inbox(admin_user))

    # Admin assigns manually once an expert is available.
    expert = make_user('EXPERT', specializations=['soil science'])
    st, assigned = call(consultations, 'POST', f"{c['consultationId']}/assign", admin_user,
                        {'expertId': expert['userId'], 'reason': 'Closest available'})
    assert st == 200 and assigned['expertId'] == expert['userId'] and assigned['assignmentTier'] == 'MANUAL'


def test_consultation_status_workflow_and_recommendation():
    farmer = make_user('FARMER')
    expert = make_user('EXPERT', specializations=['tomato'])
    staff = make_user('STAFF')
    product = make_product()
    _, c = call(consultations, 'POST', '', farmer, consult_body())
    cid = c['consultationId']

    st, _ = call(consultations, 'PUT', f'{cid}/status', farmer, {'status': 'ACCEPTED'})
    assert st == 409, 'customers cannot accept on behalf of the expert'
    st, _ = call(consultations, 'PUT', f'{cid}/status', expert, {'status': 'ACCEPTED'})
    assert st == 200
    st, c2 = call(consultations, 'POST', f'{cid}/messages', expert, {'text': 'Please send a close-up photo', 'requestInfo': True})
    assert c2['status'] == 'INFO_REQUIRED'
    st, c3 = call(consultations, 'POST', f'{cid}/messages', farmer, {'text': 'Uploaded'})
    assert c3['status'] == 'IN_PROGRESS'
    st, rec = call(consultations, 'POST', f'{cid}/recommendation', expert,
                   {'text': 'Early blight. Remove affected leaves; spray neem oil.', 'productIds': [product['productId'], 'bogus']})
    assert st == 200 and rec['status'] == 'RECOMMENDATION_PROVIDED'
    assert rec['recommendation']['productIds'] == [product['productId']]
    lead = leads_for(farmer)[0]
    assert lead['stage'] == 'RECOMMENDATION_PROVIDED'
    assert any('prepare quotation' in n['title'] for n in inbox(staff))
    st, done = call(consultations, 'PUT', f'{cid}/status', farmer, {'status': 'RESOLVED'})
    assert st == 200
    # Workload released exactly once.
    assert int(table('users').get_item(Key={'userId': expert['userId']})['Item']['activeConsultationCount']) == 0
    # Consultation resolved, lead stage independent.
    assert table('leads').get_item(Key={'leadId': lead['leadId']})['Item']['stage'] == 'RECOMMENDATION_PROVIDED'


# ── Test 3: manual lead ─────────────────────────────────────────────────────

def test_manual_lead_with_duplicate_detection_and_follow_up():
    staff = make_user('STAFF')
    body = {'customerName': 'Murugan', 'phone': '98400 12345', 'location': 'Salem', 'source': 'PHONE_CALL',
            'requirement': 'Drip irrigation kit for 2 acres of banana', 'priority': 'HIGH',
            'nextFollowUpAt': '2030-01-05T10:00'}
    st, lead = call(crm, 'POST', 'leads', staff, body)
    assert st == 201 and lead['ownerId'] == staff['userId'] and lead['phone'] == '9840012345'
    st, dup = call(crm, 'POST', 'leads', staff, {**body, 'nextFollowUpAt': None})
    assert st == 409 and dup['duplicates'][0]['leadId'] == lead['leadId']
    st, _ = call(crm, 'POST', 'leads', staff, {**body, 'force': True, 'nextFollowUpAt': None})
    assert st == 201

    st, t = call(tasks, 'GET', '', staff, query={'leadId': lead['leadId']})
    assert st == 200 and t['items'][0]['kind'] == 'FOLLOW_UP' and t['items'][0]['assigneeId'] == staff['userId']

    st, detail = call(crm, 'GET', f"leads/{lead['leadId']}", staff)
    assert st == 200 and detail['activities'] and detail['permissions']['quote'] is True

    st, _ = call(crm, 'PUT', f"leads/{lead['leadId']}/stage", staff, {'stage': 'LOST'})
    assert st == 400, 'lost reason required'
    st, l2 = call(crm, 'PUT', f"leads/{lead['leadId']}/stage", staff, {'stage': 'LOST', 'reason': 'Bought elsewhere'})
    assert st == 200 and l2['lostReason'] == 'Bought elsewhere'
    st, _ = call(crm, 'PUT', f"leads/{lead['leadId']}/stage", staff, {'stage': 'NEW'})
    assert st == 403, 'only admins reopen closed leads'


def test_call_logging_never_claims_completion():
    staff = make_user('STAFF')
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': 'A', 'phone': '9000000001', 'location': 'X',
                                                 'source': 'REFERRAL', 'requirement': 'Seeds'})
    st, act = call(crm, 'POST', f"leads/{lead['leadId']}/calls", staff, {'outcome': 'DIALER_OPENED'})
    assert st == 201 and act['data']['verified'] is False
    assert table('leads').get_item(Key={'leadId': lead['leadId']})['Item']['stage'] == 'NEW'
    call(crm, 'POST', f"leads/{lead['leadId']}/calls", staff, {'outcome': 'CONNECTED', 'notes': 'Interested'})
    assert table('leads').get_item(Key={'leadId': lead['leadId']})['Item']['stage'] == 'CONTACTED'


# ── Tests 4 & 5: quotation pricing, approval, sharing, response ─────────────

def _lead_for_customer(staff, farmer):
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': farmer['name'], 'phone': farmer['phone'],
                                                 'location': 'Erode', 'source': 'WHATSAPP', 'requirement': 'Pesticides'})
    return lead


def test_quotation_backend_pricing_ignores_client_prices():
    staff = make_user('STAFF')
    farmer = make_user('FARMER')
    p1 = make_product('Neem Oil', '250.00', taxRatePct=Decimal('18'))
    p2 = make_product('Bio Fertilizer', '99.50')
    lead = _lead_for_customer(staff, farmer)
    assert lead['customerId'] == farmer['userId'], 'existing customer record is linked, not duplicated'

    st, q = call(quotations, 'POST', '', staff, {
        'leadId': lead['leadId'], 'deliveryCharge': 50,
        'items': [{'productId': p1['productId'], 'quantity': 2, 'discountPct': 10, 'unitPrice': 1},
                  {'productId': p2['productId'], 'quantity': 3}],
        'grandTotal': 1,
    })
    assert st == 201
    # p1: 500 − 50 disc = 450 + 18% tax 81 = 531 ; p2: 298.50 ; delivery 50
    assert Decimal(str(q['subtotal'])) == Decimal('798.50')
    assert Decimal(str(q['discountTotal'])) == Decimal('50.00')
    assert Decimal(str(q['taxTotal'])) == Decimal('81.00')
    assert Decimal(str(q['grandTotal'])) == Decimal('879.50')
    assert q['quotationNumber'].startswith('QT-') and q['status'] == 'DRAFT'

    st, _ = call(quotations, 'POST', '', staff, {'leadId': lead['leadId'],
                                                 'items': [{'productId': p1['productId'], 'quantity': 1, 'discountPct': 30}]})
    assert st == 403, 'staff discount limit (10%) enforced'


def test_quotation_approval_share_view_and_accept():
    staff = make_user('STAFF')
    admin_user = make_user('ADMIN')
    farmer = make_user('FARMER')
    p = make_product()
    lead = _lead_for_customer(staff, farmer)
    _, q = call(quotations, 'POST', '', staff, {'leadId': lead['leadId'], 'items': [{'productId': p['productId'], 'quantity': 4}]})
    qid = q['quotationId']

    st, _ = call(quotations, 'POST', f'{qid}/share', staff, {'channel': 'WHATSAPP'})
    assert st == 409, 'cannot share before approval'
    st, sub = call(quotations, 'POST', f'{qid}/submit', staff)
    assert sub['status'] == 'PENDING_APPROVAL', 'staff quotations need approval by default'
    assert any(n['title'] == 'Quotation awaiting approval' for n in inbox(admin_user))
    st, _ = call(quotations, 'POST', f'{qid}/approve', staff)
    assert st == 403
    st, appr = call(quotations, 'POST', f'{qid}/approve', admin_user, {'note': 'ok'})
    assert st == 200 and appr['status'] == 'APPROVED'

    st, shared = call(quotations, 'POST', f'{qid}/share', staff, {'channel': 'WHATSAPP'})
    assert st == 200 and shared['quotation']['status'] == 'SHARED'
    assert shared['url'].startswith('https://wa.me/') and q['quotationNumber'] in shared['text']
    assert 'Total Amount: ₹1000.00' in shared['text']
    assert shared['quotation']['shares'][0]['deliveryStatus'] == 'NOT_TRACKED'
    assert table('leads').get_item(Key={'leadId': lead['leadId']})['Item']['stage'] == 'QUOTATION_SHARED'

    st, seen = call(quotations, 'GET', qid, farmer)
    assert st == 200 and seen['status'] == 'VIEWED' and 'approvalHistory' not in seen
    st, acc = call(quotations, 'POST', f'{qid}/respond', farmer, {'decision': 'ACCEPT'})
    assert st == 200 and acc['status'] == 'ACCEPTED'

    st, doc = call(quotations, 'GET', f'{qid}/document', farmer)
    assert st == 200 and q['quotationNumber'] in doc['html']


def test_customer_cannot_see_unshared_or_others_quotations():
    staff, farmer, other = make_user('STAFF'), make_user('FARMER'), make_user('FARMER')
    p = make_product()
    lead = _lead_for_customer(staff, farmer)
    _, q = call(quotations, 'POST', '', staff, {'leadId': lead['leadId'], 'items': [{'productId': p['productId'], 'quantity': 1}]})
    assert call(quotations, 'GET', q['quotationId'], farmer)[0] == 404
    assert call(quotations, 'GET', q['quotationId'], other)[0] == 404


# ── Test 6: role permissions ────────────────────────────────────────────────

def test_role_permissions_and_record_level_access():
    farmer, other_farmer = make_user('FARMER'), make_user('FARMER')
    staff_a, staff_b = make_user('STAFF'), make_user('STAFF')
    expert = make_user('EXPERT', specializations=['tomato'])
    other_expert = make_user('EXPERT', specializations=['paddy'])
    admin_user = make_user('ADMIN')

    assert call(crm, 'GET', 'dashboard', farmer)[0] == 403
    assert call(crm, 'POST', 'leads', expert, {})[0] == 403
    assert call(ai, 'GET', 'config', admin_user)[0] == 403
    assert call(admin, 'GET', 'audit-logs', admin_user)[0] == 403
    assert call(users, 'POST', '', admin_user, {'role': 'ADMIN', 'name': 'x', 'phone': '9111111111',
                                                'email': 'a@b.co', 'password': 'secret1'})[0] == 403

    _, lead_a = call(crm, 'POST', 'leads', staff_a, {'customerName': 'C', 'phone': '9000000002', 'location': 'X',
                                                     'source': 'CAMPAIGN', 'requirement': 'Seeds'})
    assert call(crm, 'GET', f"leads/{lead_a['leadId']}", staff_b)[0] == 403
    assert call(crm, 'GET', f"leads/{lead_a['leadId']}", admin_user)[0] == 200
    assert call(crm, 'GET', f"leads/{lead_a['leadId']}", expert)[0] == 403

    _, c = call(consultations, 'POST', '', farmer, consult_body())
    assert call(consultations, 'GET', c['consultationId'], other_farmer)[0] == 403
    assert call(consultations, 'GET', c['consultationId'], other_expert)[0] == 403
    assert call(consultations, 'GET', c['consultationId'], expert)[0] == 200
    lead_c = leads_for(farmer)[0]
    assert call(crm, 'GET', f"leads/{lead_c['leadId']}", expert)[0] == 200, 'experts see leads they are on'

    # Deactivated users are locked out immediately, despite a valid token.
    table('users').update_item(Key={'userId': staff_a['userId']}, UpdateExpression='SET isActive = :f',
                               ExpressionAttributeValues={':f': False})
    assert call(crm, 'GET', 'dashboard', staff_a)[0] == 403


def test_admin_manages_staff_but_not_admins_and_no_self_escalation():
    sa = make_user('SUPER_ADMIN')
    adm = make_user('ADMIN')
    st, staff = call(users, 'POST', '', adm, {'role': 'STAFF', 'name': 'Ravi', 'phone': '9222222222',
                                              'email': 'ravi@x.co', 'password': 'secret1'})
    assert st == 201
    assert call(users, 'PUT', staff['userId'], adm, {'role': 'ADMIN'})[0] == 403
    assert call(users, 'PUT', adm['userId'], adm, {'role': 'SUPER_ADMIN'})[0] == 403
    assert call(users, 'PUT', adm['userId'], sa, {'isActive': False})[0] == 200


# ── Tests 7–10: AI configuration and gating ─────────────────────────────────

@pytest.fixture
def fake_providers(monkeypatch):
    from lib import ai as lib_ai
    calls = []
    behaviour = {'openai': 'ok', 'gemini': 'ok'}

    def fake_request(method, url, headers, body, timeout):
        provider = 'openai' if 'openai' in url else 'gemini'
        calls.append((provider, method, url))
        if behaviour[provider] == 'fail':
            raise lib_ai.ProviderError('Provider returned HTTP 500.')
        if method == 'GET':
            return {'data': [{'id': 'gpt-test'}]} if provider == 'openai' else \
                {'models': [{'name': 'models/gemini-test', 'supportedGenerationMethods': ['generateContent']}]}
        if provider == 'openai':
            return {'choices': [{'message': {'content': f'answer from openai'}}]}
        return {'candidates': [{'content': {'parts': [{'text': 'answer from gemini'}]}}]}
    monkeypatch.setattr(lib_ai, '_request', fake_request)
    return behaviour, calls


def _configure_ai(sa, enabled=True, openai=True, gemini=True, **extra):
    key = 'sk-test-' + 'a' * 30
    st, cfg = call(ai, 'PUT', 'config', sa, {
        'providers': {'openai': {'apiKey': key, 'model': 'gpt-test'}, 'gemini': {'apiKey': 'AIza' + 'b' * 30, 'model': 'gemini-test'}}})
    assert st == 200
    st, cfg = call(ai, 'PUT', 'config', sa, {
        'enabled': enabled, **extra,
        'providers': {'openai': {'enabled': openai}, 'gemini': {'enabled': gemini}}})
    assert st == 200
    return cfg


def test_ai_provider_configuration_keys_are_secret(fake_providers):
    sa = make_user('SUPER_ADMIN')
    cfg = _configure_ai(sa)
    assert cfg['providers']['openai']['keyConfigured'] is True
    assert cfg['providers']['openai']['keyHint'] == '••••aaaa'
    import json
    assert 'sk-test-' not in json.dumps(cfg)
    st, got = call(ai, 'GET', 'config', sa)
    assert 'sk-test-' not in json.dumps(got)

    # Masked field left unchanged does not overwrite the stored key.
    call(ai, 'PUT', 'config', sa, {'providers': {'openai': {'apiKey': '••••aaaa'}}})
    from lib import ai as lib_ai
    lib_ai._key_cache.clear()
    assert lib_ai.get_key('openai') == 'sk-test-' + 'a' * 30

    st, test = call(ai, 'POST', 'test/openai', sa)
    assert st == 200 and test['ok'] and test['models'] == ['gpt-test'] and test['generationOk']
    st, got = call(ai, 'GET', 'config', sa)
    assert got['providers']['openai']['lastTestOk'] is True and got['providers']['openai']['lastSuccessAt']

    logs = table('audit').scan()['Items']
    assert any(l['action'] == 'AI_CONFIG_UPDATED' for l in logs)
    assert 'sk-test-' not in json.dumps(logs, default=str)


def test_cannot_enable_provider_without_key():
    sa = make_user('SUPER_ADMIN')
    assert call(ai, 'PUT', 'config', sa, {'providers': {'gemini': {'enabled': True}}})[0] == 400


def test_global_ai_off_blocks_every_role(fake_providers):
    sa = make_user('SUPER_ADMIN')
    _configure_ai(sa, enabled=False)
    for role, feature in (('FARMER', 'CUSTOMER_ASSISTANT'), ('STAFF', 'FOLLOWUP_SUGGEST'), ('ADMIN', 'CRM_REPORT')):
        u = make_user(role)
        st, status = call(ai, 'GET', 'status', u)
        assert status['enabled'] is False and status['anyAvailable'] is False
        st, err = call(ai, 'POST', 'assist', u, {'feature': feature, 'prompt': 'help'})
        assert st == 503 and 'turned off' in err['error']
    assert not any(c[1] == 'POST' for c in fake_providers[1]), 'no AI request may reach a provider'
    # Non-AI functionality keeps working.
    farmer = make_user('FARMER')
    assert call(consultations, 'POST', '', farmer, consult_body())[0] == 201


def test_global_ai_on_role_features(fake_providers):
    sa = make_user('SUPER_ADMIN')
    _configure_ai(sa)
    farmer, staff, adm = make_user('FARMER'), make_user('STAFF'), make_user('ADMIN')
    st, r = call(ai, 'POST', 'assist', farmer, {'feature': 'CUSTOMER_ASSISTANT', 'prompt': 'When to irrigate paddy?'})
    assert st == 200 and r['text'] == 'answer from openai' and r['disclaimer']
    st, _ = call(ai, 'POST', 'assist', farmer, {'feature': 'CRM_REPORT'})
    assert st == 403, 'customers cannot reach CRM data through AI'
    assert call(ai, 'POST', 'assist', adm, {'feature': 'CRM_REPORT'})[0] == 200
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': 'D', 'phone': '9000000003', 'location': 'X',
                                                 'source': 'OTHER', 'requirement': 'Seeds'})
    assert call(ai, 'POST', 'assist', staff, {'feature': 'LEAD_SUMMARY', 'leadId': lead['leadId']})[0] == 200
    other_staff = make_user('STAFF')
    assert call(ai, 'POST', 'assist', other_staff, {'feature': 'LEAD_SUMMARY', 'leadId': lead['leadId']})[0] == 403

    # Feature-level toggle.
    call(ai, 'PUT', 'config', sa, {'features': {'CUSTOMER_ASSISTANT': False}})
    assert call(ai, 'POST', 'assist', farmer, {'feature': 'CUSTOMER_ASSISTANT', 'prompt': 'x'})[0] == 503


def test_provider_fallback(fake_providers):
    behaviour, _ = fake_providers
    sa = make_user('SUPER_ADMIN')
    _configure_ai(sa, fallbackOnError=True)
    farmer = make_user('FARMER')
    behaviour['openai'] = 'fail'
    st, r = call(ai, 'POST', 'assist', farmer, {'feature': 'CUSTOMER_ASSISTANT', 'prompt': 'x'})
    assert st == 200 and r['provider'] == 'gemini' and r['fallbackUsed']

    call(ai, 'PUT', 'config', sa, {'fallbackOnError': False})
    st, err = call(ai, 'POST', 'assist', farmer, {'feature': 'CUSTOMER_ASSISTANT', 'prompt': 'x'})
    assert st == 502 and 'openai' in err['error']

    call(ai, 'PUT', 'config', sa, {'providers': {'openai': {'enabled': False}}})
    st, r = call(ai, 'POST', 'assist', farmer, {'feature': 'CUSTOMER_ASSISTANT', 'prompt': 'x'})
    assert st == 200 and r['provider'] == 'gemini', 'only the enabled provider is used'

    call(ai, 'PUT', 'config', sa, {'providers': {'gemini': {'enabled': False}}})
    st, err = call(ai, 'POST', 'assist', farmer, {'feature': 'CUSTOMER_ASSISTANT', 'prompt': 'x'})
    assert st == 503 and 'provider' in err['error']


def test_quotation_assist_keeps_only_catalogue_products(fake_providers, monkeypatch):
    from lib import ai as lib_ai
    sa = make_user('SUPER_ADMIN')
    _configure_ai(sa)
    staff = make_user('STAFF')
    p = make_product('Neem Oil', '250.00')
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': 'E', 'phone': '9000000004', 'location': 'X',
                                                 'source': 'OTHER', 'requirement': 'Pest control'})
    monkeypatch.setattr(lib_ai, 'generate', lambda *a, **k:
                        '{"items":[{"productId":"%s","quantity":2,"reason":"aphids"},{"productId":"fake","quantity":1}],"notes":"ok"}' % p['productId'])
    st, r = call(ai, 'POST', 'assist', staff, {'feature': 'QUOTATION_ASSIST', 'leadId': lead['leadId']})
    assert st == 200 and len(r['suggestedProducts']) == 1 and r['droppedSuggestions'] == 1
    assert r['suggestedProducts'][0]['price'] == 250


# ── Test 11: personal settings ──────────────────────────────────────────────

@pytest.mark.parametrize('role', ['FARMER', 'STAFF', 'EXPERT', 'ADMIN', 'SUPER_ADMIN'])
def test_profile_update_cannot_change_role(role):
    u = make_user(role)
    st, p = call(profile, 'PUT', '', u, {'language': 'ta', 'role': 'SUPER_ADMIN', 'isActive': True,
                                         'permissions': ['ai.configure'], 'notificationPrefs': {'push': False}})
    assert st == 200 and p['language'] == 'ta' and p['role'] == role
    assert p['notificationPrefs']['push'] is False
    assert table('users').get_item(Key={'userId': u['userId']})['Item']['role'] == role
    st, me = call(profile, 'GET', '', u)
    assert st == 200 and me['role'] == role and 'passwordHash' not in me


# ── Tests 12–15: announcements and notification state ───────────────────────

def test_announcement_audience_and_independent_records():
    sa, adm = make_user('SUPER_ADMIN'), make_user('ADMIN')
    farmers = [make_user('FARMER') for _ in range(3)]
    staff = make_user('STAFF')
    st, n = call(notifications, 'POST', '', adm, {'title': 'Rain alert', 'message': 'Heavy rain expected', 'audience': 'CUSTOMERS'})
    assert st == 201
    for f in farmers:
        assert len(inbox(f)) == 1
    assert inbox(staff) == [] and inbox(sa) == []
    st, stats = call(notifications, 'GET', f"{n['notifId']}/stats", adm)
    assert stats['recipients'] == 3 and stats['read'] == 0

    assert call(notifications, 'POST', '', adm, {'title': 't', 'message': 'm', 'audience': 'ADMINS'})[0] == 403
    assert call(notifications, 'POST', '', sa, {'title': 't', 'message': 'm', 'audience': 'ADMINS'})[0] == 201
    assert len(inbox(adm)) == 1


def test_dismiss_hides_banner_without_marking_read_and_persists():
    adm, farmer = make_user('ADMIN'), make_user('FARMER')
    call(notifications, 'POST', '', adm, {'title': 'Hello', 'message': 'World', 'audience': 'ALL'})
    _, banners = call(notifications, 'GET', 'inbox/banners', farmer)
    assert len(banners['items']) == 1
    key = banners['items'][0]['recipientKey']
    st, item = call(notifications, 'POST', f'inbox/{key}/dismiss', farmer)
    assert st == 200 and item['isDismissed'] and item['isRead'] is False
    # "Reopen the app": state comes from the server, so a fresh fetch still hides it.
    _, banners = call(notifications, 'GET', 'inbox/banners', farmer)
    assert banners['items'] == []
    _, count = call(notifications, 'GET', 'inbox/unread-count', farmer)
    assert count['count'] == 1
    _, center = call(notifications, 'GET', 'inbox', farmer)
    assert len(center['items']) == 1 and center['items'][0]['deliveredAt']


def test_read_banner_disappears_after_24h_but_history_remains():
    adm, farmer = make_user('ADMIN'), make_user('FARMER')
    call(notifications, 'POST', '', adm, {'title': 'Hello', 'message': 'World', 'audience': 'CUSTOMERS'})
    key = inbox(farmer)[0]['recipientKey']
    call(notifications, 'POST', f'inbox/{key}/read', farmer)
    _, banners = call(notifications, 'GET', 'inbox/banners', farmer)
    assert len(banners['items']) == 1, 'still visible right after reading'
    old = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - 25 * 3600))
    table('inbox').update_item(Key={'userId': farmer['userId'], 'recipientKey': key},
                               UpdateExpression='SET readAt = :t', ExpressionAttributeValues={':t': old})
    _, banners = call(notifications, 'GET', 'inbox/banners', farmer)
    assert banners['items'] == []
    _, center = call(notifications, 'GET', 'inbox', farmer)
    assert len(center['items']) == 1 and center['items'][0]['isRead']


def test_expired_and_scheduled_notifications():
    adm, farmer = make_user('ADMIN'), make_user('FARMER')
    call(notifications, 'POST', '', adm, {'title': 'Later', 'message': 'm', 'audience': 'CUSTOMERS',
                                          'startsAt': '2099-01-01T00:00'})
    call(notifications, 'POST', '', adm, {'title': 'Gone', 'message': 'm', 'audience': 'CUSTOMERS',
                                          'startsAt': '2020-01-01T00:00', 'expiresAt': '2020-01-02T00:00'})
    _, banners = call(notifications, 'GET', 'inbox/banners', farmer)
    assert banners['items'] == []
    _, center = call(notifications, 'GET', 'inbox', farmer)
    assert [i['title'] for i in center['items']] == ['Gone'] and center['items'][0]['isExpired']


def test_notification_state_is_private_per_user():
    adm, a, b = make_user('ADMIN'), make_user('FARMER'), make_user('FARMER')
    call(notifications, 'POST', '', adm, {'title': 'Hi', 'message': 'm', 'audience': 'CUSTOMERS'})
    key_b = inbox(b)[0]['recipientKey']
    key_a = inbox(a)[0]['recipientKey']
    call(notifications, 'POST', f'inbox/{key_a}/read', a)
    assert inbox(b)[0]['isRead'] is False
    if key_a != key_b:
        assert call(notifications, 'POST', f'inbox/{key_b}/dismiss', a)[0] == 404
    assert inbox(b)[0]['isDismissed'] is False


# ── Test 16: existing behaviour preserved ───────────────────────────────────

def test_legacy_notification_routes_and_login_still_work():
    import bcrypt
    adm = make_user('ADMIN')
    farmer = make_user('FARMER')
    st, n = call(notifications, 'POST', '', adm, {'title': 'Old style', 'message': 'm', 'type': 'INFO', 'targetRole': 'ALL'})
    assert st == 201
    st, lst = call(notifications, 'GET', '', farmer)
    assert st == 200 and any(i['notifId'] == n['notifId'] for i in lst['items'])
    st, _ = call(notifications, 'PUT', n['notifId'], adm, {'title': 'Edited'})
    assert st == 200
    st, _ = call(notifications, 'DELETE', n['notifId'], adm)
    assert st == 204 and inbox(farmer) == []

    pw = bcrypt.hashpw(b'secret1', bcrypt.gensalt(4)).decode()
    table('users').update_item(Key={'userId': farmer['userId']}, UpdateExpression='SET passwordHash = :p',
                               ExpressionAttributeValues={':p': pw})
    st, login = call(auth, 'POST', 'login', None, {'phone': farmer['phone'], 'password': 'secret1'})
    assert st == 200 and 'consultation.create' in login['user']['permissions']
    table('users').update_item(Key={'userId': farmer['userId']}, UpdateExpression='SET isActive = :f',
                               ExpressionAttributeValues={':f': False})
    assert call(auth, 'POST', 'login', None, {'phone': farmer['phone'], 'password': 'secret1'})[0] == 403


# ── Tasks, scheduler, dashboards ────────────────────────────────────────────

def test_reminders_and_escalation_job():
    staff, adm, farmer = make_user('STAFF'), make_user('ADMIN'), make_user('FARMER')
    st, t = call(tasks, 'POST', '', staff, {'kind': 'FOLLOW_UP', 'title': 'Call Murugan', 'dueAt': '2020-01-01T10:00'})
    assert st == 201 and t['isOverdue']
    _, c = call(consultations, 'POST', '', farmer, consult_body())  # no experts → queue
    table('consultations').update_item(Key={'consultationId': c['consultationId']},
                                       UpdateExpression='SET createdAt = :t', ExpressionAttributeValues={':t': '2020-01-01T00:00:00Z'})
    result = scheduler.handler({}, None)
    assert result['reminders'] == 1 and result['escalations'] == 1
    assert any(n['type'] == 'REMINDER' for n in inbox(staff))
    assert scheduler.handler({}, None) == {'reminders': 0, 'escalations': 0, 'expiredQuotations': 0}


@pytest.mark.parametrize('role', ['FARMER', 'STAFF', 'EXPERT', 'ADMIN', 'SUPER_ADMIN'])
def test_role_dashboards(role):
    u = make_user(role)
    st, d = call(admin, 'GET', '', u, raw_path='/v1/dashboard')
    assert st == 200 and d['role'] == role
    if role in ('STAFF', 'EXPERT', 'ADMIN', 'SUPER_ADMIN'):
        assert call(crm, 'GET', 'dashboard', u)[0] == 200
        assert call(crm, 'GET', 'pipeline', u)[0] == 200


def test_notification_preferences_are_respected():
    adm = make_user('ADMIN')
    opted_out = make_user('FARMER')
    normal = make_user('FARMER')
    call(profile, 'PUT', '', opted_out, {'notificationPrefs': {'announcements': False}})
    call(notifications, 'POST', '', adm, {'title': 'Offer', 'message': 'm', 'audience': 'CUSTOMERS', 'type': 'GENERAL'})
    assert inbox(opted_out) == [] and len(inbox(normal)) == 1
    # Important notices are always delivered.
    call(notifications, 'POST', '', adm, {'title': 'Outage', 'message': 'm', 'audience': 'CUSTOMERS', 'type': 'MAINTENANCE'})
    assert len(inbox(opted_out)) == 1


@pytest.mark.parametrize('legacy', ['INFO', 'WARNING', 'ALERT', 'PROMOTION'])
def test_legacy_alert_screen_types_still_accepted(legacy):
    adm = make_user('ADMIN')
    st, _ = call(notifications, 'POST', '', adm, {'title': 't', 'message': 'm', 'type': legacy, 'targetRole': 'ALL'})
    assert st == 201
