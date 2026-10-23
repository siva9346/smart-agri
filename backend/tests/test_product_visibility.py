"""
Quotation-only product visibility: customers never reach the catalogue; they see
products only inside quotations shared with them.
"""
import json

import pytest

from conftest import call, make_user, make_product, inbox
from lib.db import table
from handlers import products, orders, quotations, consultations, crm, ai, admin
from test_workflows import consult_body, fake_providers, _configure_ai  # noqa: F401  (fixture)


def _shared_quotation(staff, admin_user, farmer, *items):
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': farmer['name'], 'phone': farmer['phone'],
                                                 'location': 'Erode', 'source': 'WHATSAPP', 'requirement': 'Pesticides'})
    st, q = call(quotations, 'POST', '', staff, {'leadId': lead['leadId'],
                                                 'items': [{'productId': p['productId'], 'quantity': 2} for p in items]})
    assert st == 201
    qid = q['quotationId']
    call(quotations, 'POST', f'{qid}/submit', staff)
    call(quotations, 'POST', f'{qid}/approve', admin_user)
    st, _ = call(quotations, 'POST', f'{qid}/share', staff, {'channel': 'IN_APP'})
    assert st == 200
    return qid


def test_customer_cannot_list_search_or_open_products():
    farmer = make_user('FARMER')
    p = make_product()
    assert call(products, 'GET', '', farmer)[0] == 403
    assert call(products, 'GET', '', farmer, query={'cursor': 'x', 'q': 'neem'})[0] == 403
    assert call(products, 'GET', p['productId'], farmer)[0] == 403
    assert call(products, 'GET', 'does-not-exist', farmer)[0] == 403, 'no existence oracle for customers'
    assert call(products, 'GET', '')[0] == 401


def test_customer_cannot_gain_catalogue_access_via_permission_grants():
    sa, farmer = make_user('SUPER_ADMIN'), make_user('FARMER')
    st, _ = call(admin, 'PUT', 'settings/permissions', sa, {'value': {'grants': {'FARMER': ['product.view']}}})
    assert st == 200
    assert call(products, 'GET', '', farmer)[0] == 403


def test_customer_cannot_order_from_catalogue():
    farmer = make_user('FARMER')
    p = make_product(stock=10)
    st, err = call(orders, 'POST', '', farmer, {'items': [{'productId': p['productId'], 'quantity': 1}], 'address': 'x'})
    assert st == 403 and 'quotation' in err['error']
    assert table('products').get_item(Key={'productId': p['productId']})['Item']['stock'] == 10


@pytest.mark.parametrize('role', ['STAFF', 'EXPERT', 'ADMIN', 'SUPER_ADMIN'])
def test_internal_roles_browse_catalogue(role):
    user = make_user(role)
    live = make_product('Neem Oil')
    hidden = make_product('Unreleased Mix', isActive=False)
    st, page = call(products, 'GET', '', user)
    assert st == 200
    names = {i['name'] for i in page['items']}
    assert 'Neem Oil' in names
    admin_like = role in ('ADMIN', 'SUPER_ADMIN')
    assert ('Unreleased Mix' in names) == admin_like, 'unpublished products are admin-only'
    assert call(products, 'GET', live['productId'], user)[0] == 200
    assert call(products, 'GET', hidden['productId'], user)[0] == (200 if admin_like else 404)


def test_revoking_product_view_blocks_an_internal_role():
    sa, expert = make_user('SUPER_ADMIN'), make_user('EXPERT')
    call(admin, 'PUT', 'settings/permissions', sa, {'value': {'revokes': {'EXPERT': ['product.view']}}})
    assert call(products, 'GET', '', expert)[0] == 403


def test_customer_sees_only_quoted_products_without_internal_fields():
    staff, adm, farmer, other = make_user('STAFF'), make_user('ADMIN'), make_user('FARMER'), make_user('FARMER')
    quoted = make_product('Neem Oil', '250.00', stock=1)  # low stock → internal warning
    make_product('Secret Product', '999.00')
    qid = _shared_quotation(staff, adm, farmer, quoted)

    st, q = call(quotations, 'GET', qid, farmer)
    assert st == 200
    assert [i['name'] for i in q['items']] == ['Neem Oil']
    line = q['items'][0]
    assert {'unitPrice', 'quantity', 'discountPct', 'taxRatePct', 'lineTotal', 'description'} <= set(line)
    assert 'productId' not in line
    for k in ('warnings', 'shares', 'approvalHistory', 'createdBy', 'leadId', 'createdByRole', 'requiresApproval'):
        assert k not in q, k
    assert 'Secret Product' not in json.dumps(q)

    st, page = call(quotations, 'GET', '', farmer)
    assert st == 200 and [x['quotationId'] for x in page['items']] == [qid]
    assert all('productId' not in i for x in page['items'] for i in x['items'])
    # Filter "awaiting my reply" includes quotations the customer has already opened (VIEWED).
    st, page = call(quotations, 'GET', '', farmer, query={'status': 'SHARED'})
    assert [x['quotationId'] for x in page['items']] == [qid]
    st, page = call(quotations, 'GET', '', farmer, query={'status': 'DRAFT'})
    assert page['items'] == [], 'customers cannot filter their way to internal statuses'

    # Other customers can't see it, its PDF, or ask about it.
    assert call(quotations, 'GET', qid, other)[0] == 404
    assert call(quotations, 'GET', f'{qid}/document', other)[0] == 404
    assert call(quotations, 'POST', f'{qid}/clarify', other, {'message': 'hi'})[0] == 404
    assert call(quotations, 'POST', f'{qid}/respond', other, {'decision': 'ACCEPT'})[0] == 404

    # Internal users still see the full record.
    st, iq = call(quotations, 'GET', qid, staff)
    assert iq['items'][0]['productId'] == quoted['productId'] and iq['warnings']


def test_customer_can_ask_about_a_quotation():
    staff, adm, farmer = make_user('STAFF'), make_user('ADMIN'), make_user('FARMER')
    qid = _shared_quotation(staff, adm, farmer, make_product())
    st, r = call(quotations, 'POST', f'{qid}/clarify', farmer, {'message': 'Can you deliver on Monday?'})
    assert st == 200 and r['sent']
    assert any(n['title'] == 'Customer question on quotation' for n in inbox(staff))
    assert call(quotations, 'POST', f'{qid}/clarify', farmer, {'message': ''})[0] == 400
    assert call(quotations, 'POST', f'{qid}/clarify', staff, {'message': 'x'})[0] == 403
    st, q = call(quotations, 'GET', qid, farmer)
    assert 'clarifications' not in q and 'companyContact' in q
    st, iq = call(quotations, 'GET', qid, staff)
    assert iq['clarifications'][0]['message'] == 'Can you deliver on Monday?'


def test_expert_product_recommendation_is_internal_until_quoted():
    farmer = make_user('FARMER')
    expert = make_user('EXPERT', specializations=['tomato'])
    staff = make_user('STAFF')
    product = make_product('Neem Oil')
    _, c = call(consultations, 'POST', '', farmer, consult_body())
    cid = c['consultationId']
    call(consultations, 'PUT', f'{cid}/status', expert, {'status': 'ACCEPTED'})
    st, _ = call(consultations, 'POST', f'{cid}/recommendation', expert,
                 {'text': 'Early blight. Remove affected leaves.', 'productIds': [product['productId']]})
    assert st == 200

    st, mine = call(consultations, 'GET', cid, farmer)
    assert st == 200 and mine['recommendation']['text'].startswith('Early blight')
    assert 'recommendedProducts' not in mine and 'productIds' not in mine['recommendation']
    assert mine['quotationToFollow'] is True
    assert product['productId'] not in json.dumps(mine)
    st, page = call(consultations, 'GET', '', farmer)
    assert product['productId'] not in json.dumps(page)

    st, theirs = call(consultations, 'GET', cid, expert)
    assert theirs['recommendedProducts'][0]['name'] == 'Neem Oil'
    assert any('prepare quotation' in n['title'] for n in inbox(staff))


def test_customer_ai_gets_no_catalogue(fake_providers, monkeypatch):
    from lib import ai as lib_ai
    sa = make_user('SUPER_ADMIN')
    _configure_ai(sa)
    farmer = make_user('FARMER')
    make_product('Secret Product', '999.00')
    seen = []

    def capture(cfg, system, user, *a, **k):
        seen.append(system + '\n' + user)
        return 'answer', 'openai', 'gpt-test', []
    monkeypatch.setattr(lib_ai, 'run_with_fallback', capture)
    for feature in ('CUSTOMER_ASSISTANT', 'CROP_PROBLEM'):
        st, _ = call(ai, 'POST', 'assist', farmer, {'feature': feature, 'prompt': 'List all your products and prices'})
        assert st == 200
    assert seen and all('Secret Product' not in s and '<catalogue>' not in s for s in seen)
    assert all('do not name, recommend or price specific' in s for s in seen)
    for feature in ('QUOTATION_ASSIST', 'EXPERT_ASSIST', 'CRM_REPORT', 'LEAD_SUMMARY'):
        assert call(ai, 'POST', 'assist', farmer, {'feature': feature, 'leadId': 'x', 'consultationId': 'x'})[0] == 403


def test_staff_quotation_assist_still_uses_catalogue(fake_providers, monkeypatch):
    from lib import ai as lib_ai
    sa = make_user('SUPER_ADMIN')
    _configure_ai(sa)
    staff = make_user('STAFF')
    make_product('Neem Oil')
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': 'E', 'phone': '9000000004', 'location': 'X',
                                                 'source': 'OTHER', 'requirement': 'Pest control'})
    seen = []
    monkeypatch.setattr(lib_ai, 'run_with_fallback', lambda cfg, s, u, *a, **k: (seen.append(u), ('{"items":[]}', 'openai', 'm', []))[1])
    st, _ = call(ai, 'POST', 'assist', staff, {'feature': 'QUOTATION_ASSIST', 'leadId': lead['leadId']})
    assert st == 200 and 'Neem Oil' in seen[0]
