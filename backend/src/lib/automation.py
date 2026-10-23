"""
Configurable automation rules layered on top of the scheduler's existing jobs.

Rule *types* are fixed, predefined and validated here in code — there is no
general-purpose rule engine and nothing an Admin configures is ever evaluated
as code. What's configurable per rule (see settings.DEFAULTS['automationRules'])
is only: enabled, and a couple of named numeric/boolean parameters.

Every firing is recorded exactly once via a deterministic `runId`
(ruleId + target + "period") written with a conditional put — that's what
prevents duplicate execution across scheduler ticks / retries. A rule whose
action is customer-facing (today: the quotation follow-up's suggested
message) is recorded as PENDING_APPROVAL instead of being sent; an admin
must explicitly approve or reject it — nothing here ever messages a
customer on its own.
"""
from boto3.dynamodb.conditions import Key

from lib.audit import audit
from lib.crm import get_lead, log_activity
from lib.db import table
from lib.notify import notify_roles
from lib.settings import get_setting, put_setting
from lib.tasks import create_task_record
from lib.util import HttpError, iso_in, new_id, now_iso, query_all, stable_id, today

RULE_IDS = (
    'UNASSIGNED_CONSULTATION_ESCALATION', 'FOLLOWUP_OVERDUE_REMINDER',
    'QUOTATION_FOLLOWUP', 'AI_PROVIDER_FAILURE_ALERT',
)
RUN_STATUSES = ('SUCCESS', 'FAILED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')


# ── Rule configuration ───────────────────────────────────────────────────────

def rules() -> dict:
    return get_setting('automationRules')


def rule(rule_id: str) -> dict:
    cfg = rules().get(rule_id)
    if not cfg:
        raise HttpError(404, 'Unknown automation rule')
    return cfg


def is_enabled(rule_id: str) -> bool:
    return bool(rules().get(rule_id, {}).get('enabled'))


def update_rule(rule_id: str, patch: dict, actor: dict) -> dict:
    cfg = rules()
    if rule_id not in cfg:
        raise HttpError(404, 'Unknown automation rule')
    next_ = dict(cfg[rule_id])
    changed = {}
    if 'enabled' in patch:
        next_['enabled'] = bool(patch['enabled'])
        changed['enabled'] = next_['enabled']
    if rule_id == 'QUOTATION_FOLLOWUP':
        if 'followUpAfterHours' in patch:
            hours = int(patch['followUpAfterHours'])
            if not (1 <= hours <= 24 * 30):
                raise HttpError(400, 'followUpAfterHours must be between 1 and 720')
            next_['followUpAfterHours'] = hours
            changed['followUpAfterHours'] = hours
        if 'requiresApproval' in patch:
            next_['requiresApproval'] = bool(patch['requiresApproval'])
            changed['requiresApproval'] = next_['requiresApproval']
    if rule_id == 'AI_PROVIDER_FAILURE_ALERT' and 'failureThreshold' in patch:
        n = int(patch['failureThreshold'])
        if not (1 <= n <= 1000):
            raise HttpError(400, 'failureThreshold must be between 1 and 1000')
        next_['failureThreshold'] = n
        changed['failureThreshold'] = n
    if not changed:
        return next_
    cfg[rule_id] = next_
    put_setting('automationRules', cfg, actor['userId'])
    audit(actor, 'AUTOMATION_RULE_UPDATED', 'automation_rule', rule_id, changed)
    return next_


# ── Run records (history + idempotency) ──────────────────────────────────────

def _record(rule_id: str, target_type: str, target_id: str, period: str, status: str, detail: str,
            payload: dict | None = None) -> dict | None:
    """Write the run record if (rule, target, period) hasn't fired before. Returns None when it's a duplicate."""
    run_id = stable_id('automation-run', rule_id, target_type, target_id, period)
    item = {
        'runId': run_id, 'ruleId': rule_id, 'targetType': target_type, 'targetId': target_id,
        'period': period, 'status': status, 'detail': (detail or '')[:1000], 'createdAt': now_iso(), 'attempts': 1,
    }
    if payload:
        item['payload'] = payload
    try:
        table('automation_runs').put_item(Item=item, ConditionExpression='attribute_not_exists(runId)')
        return item
    except Exception:
        return None  # already recorded for this period — duplicate execution suppressed


def get_run(run_id: str) -> dict:
    run = table('automation_runs').get_item(Key={'runId': run_id}).get('Item')
    if not run:
        raise HttpError(404, 'Automation run not found')
    return run


def list_runs(rule_id: str | None = None, status: str | None = None, limit: int = 100) -> list[dict]:
    tbl = table('automation_runs')
    if rule_id:
        items = query_all(tbl, IndexName='RuleIndex', KeyConditionExpression=Key('ruleId').eq(rule_id),
                          ScanIndexForward=False, max_items=limit)
    elif status:
        items = query_all(tbl, IndexName='StatusIndex', KeyConditionExpression=Key('status').eq(status),
                          ScanIndexForward=False, max_items=limit)
    else:
        items = []
        for rid in RULE_IDS:
            items += query_all(tbl, IndexName='RuleIndex', KeyConditionExpression=Key('ruleId').eq(rid), max_items=limit)
    return sorted(items, key=lambda r: r['createdAt'], reverse=True)[:limit]


def retry_run(run_id: str, actor: dict) -> dict:
    run = get_run(run_id)
    if run['status'] != 'FAILED':
        raise HttpError(400, 'Only a failed run can be retried')
    try:
        _execute_action(run)
        updates = {'status': 'SUCCESS', 'attempts': int(run.get('attempts', 1)) + 1, 'retriedAt': now_iso(), 'retriedBy': actor['userId']}
    except Exception as e:
        updates = {'status': 'FAILED', 'attempts': int(run.get('attempts', 1)) + 1, 'detail': str(e)[:1000],
                   'retriedAt': now_iso(), 'retriedBy': actor['userId']}
    table('automation_runs').update_item(
        Key={'runId': run_id}, UpdateExpression='SET #s = :s, attempts = :a, retriedAt = :r, retriedBy = :u' + (', detail = :d' if 'detail' in updates else ''),
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={':s': updates['status'], ':a': updates['attempts'], ':r': updates['retriedAt'],
                                   ':u': updates['retriedBy'], **({':d': updates['detail']} if 'detail' in updates else {})},
    )
    return {**run, **updates}


def _execute_action(run: dict):
    """Re-run the notification side-effect for a retried run (idempotent-ish: these are just notifications)."""
    if run['ruleId'] == 'UNASSIGNED_CONSULTATION_ESCALATION':
        notify_roles(['ADMIN', 'SUPER_ADMIN'], 'Overdue consultation', run['detail'], 'ESCALATION', f"consultation/{run['targetId']}")
    elif run['ruleId'] == 'AI_PROVIDER_FAILURE_ALERT':
        notify_roles(['ADMIN', 'SUPER_ADMIN'], 'AI provider failing', run['detail'], 'IMPORTANT')
    else:
        raise HttpError(400, 'This automation cannot be retried')


def approve_run(run_id: str, actor: dict) -> dict:
    run = get_run(run_id)
    if run['status'] != 'PENDING_APPROVAL':
        raise HttpError(400, 'Only a pending run can be approved')
    payload = run.get('payload') or {}
    if run['ruleId'] == 'QUOTATION_FOLLOWUP' and payload.get('leadId'):
        log_activity(payload['leadId'], 'WHATSAPP', actor,
                     f"Approved follow-up message suggestion for {payload.get('quotationNumber', '')}: {payload.get('suggestedMessage', '')}",
                     {'quotationId': payload.get('quotationId'), 'automationRunId': run_id})
    updated = table('automation_runs').update_item(
        Key={'runId': run_id}, UpdateExpression='SET #s = :s, approvedAt = :t, approvedBy = :u',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={':s': 'APPROVED', ':t': now_iso(), ':u': actor['userId']},
        ReturnValues='ALL_NEW',
    )['Attributes']
    audit(actor, 'AUTOMATION_RUN_APPROVED', 'automation_run', run_id, {'ruleId': run['ruleId']})
    return updated


def reject_run(run_id: str, actor: dict) -> dict:
    run = get_run(run_id)
    if run['status'] != 'PENDING_APPROVAL':
        raise HttpError(400, 'Only a pending run can be rejected')
    updated = table('automation_runs').update_item(
        Key={'runId': run_id}, UpdateExpression='SET #s = :s, rejectedAt = :t, rejectedBy = :u',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={':s': 'REJECTED', ':t': now_iso(), ':u': actor['userId']},
        ReturnValues='ALL_NEW',
    )['Attributes']
    audit(actor, 'AUTOMATION_RUN_REJECTED', 'automation_run', run_id, {'ruleId': run['ruleId']})
    return updated


# ── Triggers called from the scheduler ───────────────────────────────────────

def escalation_fired(consultation_id: str, status: str, detail: str):
    """Record history for the existing (unconditional) consultation escalation job — called only when it actually fires."""
    try:
        _record('UNASSIGNED_CONSULTATION_ESCALATION', 'CONSULTATION', consultation_id, status, 'SUCCESS', detail)
    except Exception as e:
        print(f'automation history write failed: {e}')


def reminder_fired(task_id: str, detail: str):
    try:
        _record('FOLLOWUP_OVERDUE_REMINDER', 'TASK', task_id, 'sent', 'SUCCESS', detail)
    except Exception as e:
        print(f'automation history write failed: {e}')


def run_quotation_followups() -> int:
    cfg = rule('QUOTATION_FOLLOWUP')
    if not cfg.get('enabled'):
        return 0
    cutoff = iso_in(-int(cfg.get('followUpAfterHours', 48)) * 3600)
    count = 0
    for status in ('SHARED', 'VIEWED'):
        for q in query_all(table('quotations'), IndexName='StatusIndex', KeyConditionExpression=Key('status').eq(status)):
            if q.get('updatedAt', '') > cutoff:
                continue
            try:
                count += _quotation_followup_one(q, status, cfg)
            except Exception as e:  # one bad quotation/lead must not abort the whole scheduler tick
                print(f"quotation follow-up failed for {q.get('quotationId')}: {e}")
    return count


def _quotation_followup_one(q: dict, status: str, cfg: dict) -> int:
    if not q.get('leadId'):
        return 0
    lead = get_lead(q['leadId'])
    owner = lead.get('ownerId')
    suggested = (f"Hi {q.get('customerName', '')}, just checking in on quotation {q.get('quotationNumber', '')} "
                 f"(₹{q.get('grandTotal', '')}) we shared — happy to answer any questions before it expires "
                 f"on {q.get('validUntil', '')}.")
    payload = {'quotationId': q['quotationId'], 'quotationNumber': q.get('quotationNumber', ''),
               'leadId': q['leadId'], 'suggestedMessage': suggested}
    rec = _record('QUOTATION_FOLLOWUP', 'QUOTATION', q['quotationId'], status,
                  'PENDING_APPROVAL' if cfg.get('requiresApproval', True) else 'SUCCESS',
                  f"Quotation {q.get('quotationNumber', '')} unanswered for {cfg.get('followUpAfterHours')}h",
                  payload)
    if not rec:
        return 0  # already actioned this quotation while in this status
    if owner and owner != 'UNASSIGNED':
        try:
            create_task_record({
                'kind': 'FOLLOW_UP', 'title': f"Follow up on quotation {q.get('quotationNumber', '')}",
                'dueAt': now_iso(), 'assigneeId': owner, 'leadId': q['leadId'],
                'customerId': lead.get('customerId'), 'customerName': lead.get('customerName'),
                'followUpType': 'WHATSAPP', 'priority': 'MEDIUM',
                'notes': f"Suggested message (needs approval before sending): {suggested}",
            }, {'userId': 'system', 'name': 'Automation', 'role': 'SYSTEM'})
        except Exception as e:  # the run is already recorded and visible in history either way
            print(f"follow-up task creation failed for quotation {q['quotationId']}: {e}")
    return 1


def run_ai_provider_alert() -> int:
    cfg = rule('AI_PROVIDER_FAILURE_ALERT')
    if not cfg.get('enabled'):
        return 0
    threshold = int(cfg.get('failureThreshold', 3))
    ai_cfg = get_setting('ai')
    usage = table('settings').get_item(Key={'settingKey': f'aiUsage#{today()}'}).get('Item') or {}
    count = 0
    for provider, pcfg in ai_cfg.get('providers', {}).items():
        if not pcfg.get('enabled'):
            continue
        failures = int(usage.get(f'e_{provider}', 0))
        if failures < threshold:
            continue
        rec = _record('AI_PROVIDER_FAILURE_ALERT', 'AI_PROVIDER', provider, today(), 'SUCCESS',
                      f'{provider} failed {failures} time(s) today (threshold {threshold})')
        if not rec:
            continue
        notify_roles(['ADMIN', 'SUPER_ADMIN'], 'AI provider failing', rec['detail'], 'IMPORTANT')
        count += 1
    return count
