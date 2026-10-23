"""Automation rule builder: configurable rules, execution history, idempotency, approval gates."""
import uuid

from conftest import call, make_user, make_product, inbox
from lib.db import table
from lib.settings import get_setting, put_setting
from lib.util import now_iso, stable_id, today
from handlers import automation, consultations, crm, quotations, tasks, scheduler, ai


def _consult_body(**over):
    body = {'idempotencyKey': str(uuid.uuid4()), 'cropName': 'Tomato', 'problemCategory': 'disease',
            'symptoms': 'Yellow leaves with brown spots spreading upward', 'severity': 'HIGH',
            'farmLocation': 'Erode', 'preferredContact': 'WHATSAPP'}
    body.update(over)
    return body


def _lead_for_customer(staff, farmer):
    _, lead = call(crm, 'POST', 'leads', staff, {'customerName': farmer['name'], 'phone': farmer['phone'],
                                                 'location': 'Erode', 'source': 'WHATSAPP', 'requirement': 'Pesticides'})
    return lead


def test_rules_listing_and_permissions():
    admin_user, staff = make_user('ADMIN'), make_user('STAFF')
    st, body = call(automation, 'GET', 'rules', admin_user)
    assert st == 200
    assert set(body['rules']) == {'UNASSIGNED_CONSULTATION_ESCALATION', 'FOLLOWUP_OVERDUE_REMINDER',
                                  'QUOTATION_FOLLOWUP', 'AI_PROVIDER_FAILURE_ALERT'}
    assert all(r['enabled'] for r in body['rules'].values())
    assert call(automation, 'GET', 'rules', staff)[0] == 403


def test_update_rule_validates_params_and_unknown_ids():
    admin_user = make_user('ADMIN')
    st, updated = call(automation, 'PUT', 'rules/QUOTATION_FOLLOWUP', admin_user,
                       {'followUpAfterHours': 72, 'requiresApproval': False})
    assert st == 200 and updated['followUpAfterHours'] == 72 and updated['requiresApproval'] is False
    assert call(automation, 'PUT', 'rules/QUOTATION_FOLLOWUP', admin_user, {'followUpAfterHours': 0})[0] == 400
    assert call(automation, 'PUT', 'rules/NOT_A_RULE', admin_user, {'enabled': False})[0] == 404


def test_disabling_escalation_rule_stops_the_scheduler_job_and_re_enabling_resumes_it():
    admin_user, farmer = make_user('ADMIN'), make_user('FARMER')
    call(automation, 'PUT', 'rules/UNASSIGNED_CONSULTATION_ESCALATION', admin_user, {'enabled': False})
    _, c = call(consultations, 'POST', '', farmer, _consult_body())  # no experts → queued
    table('consultations').update_item(Key={'consultationId': c['consultationId']},
                                       UpdateExpression='SET createdAt = :t', ExpressionAttributeValues={':t': '2020-01-01T00:00:00Z'})

    result = scheduler.handler({}, None)
    assert result['escalations'] == 0
    assert call(automation, 'GET', 'runs', admin_user, query={'ruleId': 'UNASSIGNED_CONSULTATION_ESCALATION'})[1]['items'] == []

    call(automation, 'PUT', 'rules/UNASSIGNED_CONSULTATION_ESCALATION', admin_user, {'enabled': True})
    result = scheduler.handler({}, None)
    assert result['escalations'] == 1
    assert any(n['type'] == 'ESCALATION' for n in inbox(admin_user))
    st, runs = call(automation, 'GET', 'runs', admin_user, query={'ruleId': 'UNASSIGNED_CONSULTATION_ESCALATION'})
    assert st == 200 and len(runs['items']) == 1 and runs['items'][0]['status'] == 'SUCCESS'


def test_disabling_reminder_rule_stops_the_scheduler_job():
    admin_user, staff = make_user('ADMIN'), make_user('STAFF')
    call(automation, 'PUT', 'rules/FOLLOWUP_OVERDUE_REMINDER', admin_user, {'enabled': False})
    call(tasks, 'POST', '', staff, {'kind': 'FOLLOW_UP', 'title': 'Call Murugan', 'dueAt': '2020-01-01T10:00'})
    result = scheduler.handler({}, None)
    assert result['reminders'] == 0
    assert call(automation, 'GET', 'runs', admin_user, query={'ruleId': 'FOLLOWUP_OVERDUE_REMINDER'})[1]['items'] == []


def test_quotation_followup_creates_pending_approval_task_and_dedupes():
    staff, admin_user, farmer = make_user('STAFF'), make_user('ADMIN'), make_user('FARMER')
    p = make_product()
    lead = _lead_for_customer(staff, farmer)
    _, q = call(quotations, 'POST', '', staff, {'leadId': lead['leadId'], 'items': [{'productId': p['productId'], 'quantity': 2}]})
    qid = q['quotationId']
    call(quotations, 'POST', f'{qid}/submit', staff)
    call(quotations, 'POST', f'{qid}/approve', admin_user, {'note': 'ok'})
    call(quotations, 'POST', f'{qid}/share', staff, {'channel': 'WHATSAPP'})
    table('quotations').update_item(Key={'quotationId': qid}, UpdateExpression='SET updatedAt = :t',
                                    ExpressionAttributeValues={':t': '2020-01-01T00:00:00Z'})

    result = scheduler.handler({}, None)
    assert result['quotationFollowUps'] == 1
    st, runs = call(automation, 'GET', 'runs', admin_user, query={'ruleId': 'QUOTATION_FOLLOWUP'})
    assert st == 200 and len(runs['items']) == 1
    run = runs['items'][0]
    assert run['status'] == 'PENDING_APPROVAL' and run['payload']['quotationId'] == qid

    st, tlist = call(tasks, 'GET', '', staff, query={'leadId': lead['leadId']})
    assert st == 200 and any(t['kind'] == 'FOLLOW_UP' and 'quotation' in t['title'].lower() for t in tlist['items'])

    # a second tick on the still-SHARED quotation must not create a duplicate run
    assert scheduler.handler({}, None)['quotationFollowUps'] == 0

    st, approved = call(automation, 'POST', f"runs/{run['runId']}/approve", admin_user)
    assert st == 200 and approved['status'] == 'APPROVED'
    st, detail = call(crm, 'GET', f"leads/{lead['leadId']}", staff)
    assert st == 200 and any('Approved follow-up message suggestion' in a['text'] for a in detail['activities'])

    # approving twice is rejected — the run is already resolved
    assert call(automation, 'POST', f"runs/{run['runId']}/approve", admin_user)[0] == 400


def test_reject_pending_run_resolves_it_without_logging_an_activity():
    staff, admin_user, farmer = make_user('STAFF'), make_user('ADMIN'), make_user('FARMER')
    p = make_product()
    lead = _lead_for_customer(staff, farmer)
    _, q = call(quotations, 'POST', '', staff, {'leadId': lead['leadId'], 'items': [{'productId': p['productId'], 'quantity': 1}]})
    qid = q['quotationId']
    call(quotations, 'POST', f'{qid}/submit', staff)
    call(quotations, 'POST', f'{qid}/approve', admin_user, {'note': 'ok'})
    call(quotations, 'POST', f'{qid}/share', staff, {'channel': 'WHATSAPP'})
    table('quotations').update_item(Key={'quotationId': qid}, UpdateExpression='SET updatedAt = :t',
                                    ExpressionAttributeValues={':t': '2020-01-01T00:00:00Z'})
    scheduler.handler({}, None)
    run = call(automation, 'GET', 'runs', admin_user, query={'ruleId': 'QUOTATION_FOLLOWUP'})[1]['items'][0]

    st, rejected = call(automation, 'POST', f"runs/{run['runId']}/reject", admin_user)
    assert st == 200 and rejected['status'] == 'REJECTED'
    st, detail = call(crm, 'GET', f"leads/{lead['leadId']}", staff)
    assert not any('Approved follow-up' in a['text'] for a in detail['activities'])


def test_ai_provider_failure_alert_fires_once_per_day_per_provider():
    admin_user = make_user('ADMIN')
    cfg = get_setting('ai', fresh=True)
    cfg['providers']['openai']['enabled'] = True
    put_setting('ai', cfg, admin_user['userId'])
    table('settings').put_item(Item={'settingKey': f'aiUsage#{today()}', 'e_openai': 5})

    result = scheduler.handler({}, None)
    assert result['aiProviderAlerts'] == 1
    assert any(n['title'] == 'AI provider failing' for n in inbox(admin_user))
    assert scheduler.handler({}, None)['aiProviderAlerts'] == 0  # same day, already alerted


def test_retry_a_failed_run():
    admin_user = make_user('ADMIN')
    run_id = stable_id('automation-run', 'AI_PROVIDER_FAILURE_ALERT', 'AI_PROVIDER', 'gemini', '2020-01-01')
    table('automation_runs').put_item(Item={
        'runId': run_id, 'ruleId': 'AI_PROVIDER_FAILURE_ALERT', 'targetType': 'AI_PROVIDER', 'targetId': 'gemini',
        'period': '2020-01-01', 'status': 'FAILED', 'detail': 'gemini failed 5 time(s) today (threshold 3)',
        'createdAt': now_iso(), 'attempts': 1,
    })
    st, retried = call(automation, 'POST', f'runs/{run_id}/retry', admin_user)
    assert st == 200 and retried['status'] == 'SUCCESS' and retried['attempts'] == 2
    assert any(n['title'] == 'AI provider failing' for n in inbox(admin_user))
    assert call(automation, 'POST', f'runs/{run_id}/retry', admin_user)[0] == 400  # no longer FAILED
