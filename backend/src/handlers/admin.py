"""
Platform administration and role dashboards.

GET /dashboard                      – role-specific dashboard for the current user (all roles)
GET /admin/settings/{key}           – assignment | quotation | permissions
PUT /admin/settings/{key}           – replace that setting (validated)
GET /admin/permissions              – permission catalogue with effective per-role grants
GET /admin/audit-logs               – ?day=YYYY-MM-DD (default today) &entityId= &cursor=
"""
import time
from decimal import Decimal

from boto3.dynamodb.conditions import Key, Attr

from lib.db import table, encode_key, decode_key
from lib.router import run
from lib.permissions import (
    require_actor, require_permission, has_permission, permissions_for, DEFAULT_PERMISSIONS, CUSTOMER_PERMISSIONS,
    ALL_ROLES, SUPER_ADMIN, ADMIN, STAFF, EXPERT, FARMER,
)
from lib.settings import get_setting, put_setting
from lib.audit import audit
from lib.ai import PROVIDERS
from lib.notify import unread_count
from lib.util import HttpError, now_iso, today, query_all, scan_all
from lib.response import ok, query_param, parse_body

SETTING_PERMS = {'assignment': 'settings.assignment', 'quotation': 'settings.quotation', 'permissions': 'settings.permissions'}


def handler(event, _ctx):
    return run(event, _route)


def _route(event, m, seg):
    path = event.get('rawPath', '')
    if path.endswith('/dashboard') and m == 'GET':
        return _dashboard(event)
    if seg[:1] == ['settings'] and len(seg) == 2 and seg[1] in SETTING_PERMS:
        if m == 'GET': return _get_setting(event, seg[1])
        if m == 'PUT': return _put_setting(event, seg[1])
    if seg == ['permissions'] and m == 'GET':
        return _permissions(event)
    if seg == ['audit-logs'] and m == 'GET':
        return _audit(event)
    return None


# ── Settings ────────────────────────────────────────────────────────────────

def _get_setting(event, key):
    actor = require_actor(event)
    if not (has_permission(actor, SETTING_PERMS[key]) or (key != 'permissions' and actor['role'] == ADMIN)):
        raise HttpError(403, 'Access denied')
    return ok(get_setting(key, fresh=True))


def _num(v, field, lo, hi):
    try:
        d = Decimal(str(v))
    except Exception:
        raise HttpError(400, f'{field} must be a number')
    if not (Decimal(str(lo)) <= d <= Decimal(str(hi))):
        raise HttpError(400, f'{field} must be between {lo} and {hi}')
    return d


def _validate(key: str, value: dict) -> dict:
    if not isinstance(value, dict):
        raise HttpError(400, 'value must be an object')
    base = get_setting(key, fresh=True)
    if key == 'assignment':
        for mapping in ('cropCategories', 'problemCategories'):
            if mapping in value:
                m = value[mapping]
                if not isinstance(m, dict) or len(m) > 300:
                    raise HttpError(400, f'{mapping} must be an object')
                base[mapping] = {str(k).strip().lower(): sorted({str(x).strip().lower() for x in (v or []) if str(x).strip()})
                                 for k, v in m.items() if str(k).strip()}
        if 'generalSpecialization' in value:
            base['generalSpecialization'] = str(value['generalSpecialization']).strip().lower() or 'general'
        if 'defaultMaxActiveConsultations' in value:
            base['defaultMaxActiveConsultations'] = int(_num(value['defaultMaxActiveConsultations'], 'defaultMaxActiveConsultations', 1, 500))
        if 'escalateAfterHours' in value:
            base['escalateAfterHours'] = int(_num(value['escalateAfterHours'], 'escalateAfterHours', 1, 720))
        if 'leadOwnerStrategy' in value:
            if value['leadOwnerStrategy'] not in ('UNASSIGNED', 'ROUND_ROBIN'):
                raise HttpError(400, 'invalid leadOwnerStrategy')
            base['leadOwnerStrategy'] = value['leadOwnerStrategy']
    elif key == 'quotation':
        if 'defaultTaxRatePct' in value:
            base['defaultTaxRatePct'] = _num(value['defaultTaxRatePct'], 'defaultTaxRatePct', 0, 100)
        if 'validityDays' in value:
            base['validityDays'] = int(_num(value['validityDays'], 'validityDays', 1, 180))
        if 'approvalDiscountPct' in value:
            base['approvalDiscountPct'] = _num(value['approvalDiscountPct'], 'approvalDiscountPct', 0, 100)
        if 'maxDiscountPctByRole' in value:
            base['maxDiscountPctByRole'] = {r: _num(value['maxDiscountPctByRole'].get(r, 0), f'maxDiscount {r}', 0, 100)
                                            for r in (SUPER_ADMIN, ADMIN, STAFF, EXPERT)}
        if 'approvalRequiredForRoles' in value:
            base['approvalRequiredForRoles'] = [r for r in value['approvalRequiredForRoles'] if r in (ADMIN, STAFF, EXPERT)]
        for f in ('paymentTerms', 'deliveryTerms', 'termsAndConditions', 'companyName', 'companyContact'):
            if f in value:
                base[f] = str(value[f] or '')[:2000]
    elif key == 'permissions':
        grants, revokes = {}, {}
        for role in (ADMIN, STAFF, EXPERT, FARMER):
            allowed = CUSTOMER_PERMISSIONS if role == FARMER else set(DEFAULT_PERMISSIONS)
            grants[role] = sorted(p for p in (value.get('grants') or {}).get(role, []) if p in allowed)
            revokes[role] = sorted(p for p in (value.get('revokes') or {}).get(role, []) if p in DEFAULT_PERMISSIONS)
            if role == ADMIN and 'settings.permissions' in grants[role]:
                raise HttpError(403, 'Only a Super Admin can manage permissions')
        base = {'grants': grants, 'revokes': revokes}
    return base


def _put_setting(event, key):
    actor = require_permission(event, SETTING_PERMS[key])
    before = get_setting(key, fresh=True)
    value = _validate(key, parse_body(event).get('value') or {})
    put_setting(key, value, actor['userId'])
    changed = sorted(k for k in set(before) | set(value) if before.get(k) != value.get(k))
    audit(actor, 'SETTINGS_UPDATED', 'settings', key, {'changed': changed})
    return ok(value)


def _permissions(event):
    require_permission(event, 'settings.permissions')
    return ok({
        'catalog': sorted(DEFAULT_PERMISSIONS),
        'customerAllowed': sorted(CUSTOMER_PERMISSIONS),
        'defaults': {r: sorted(p for p, roles in DEFAULT_PERMISSIONS.items() if r in roles) for r in ALL_ROLES},
        'effective': {r: sorted(permissions_for(r)) for r in ALL_ROLES},
        'overrides': get_setting('permissions', fresh=True),
    })


def _audit(event):
    require_permission(event, 'audit.view')
    entity = query_param(event, 'entityId')
    cursor = decode_key(query_param(event, 'cursor'))
    tbl = table('audit')
    if entity:
        kwargs = {'IndexName': 'EntityIndex', 'KeyConditionExpression': Key('entityId').eq(entity)}
    else:
        day = query_param(event, 'day') or today()
        kwargs = {'KeyConditionExpression': Key('auditDay').eq(day)}
    kwargs.update(ScanIndexForward=False, Limit=50)
    if cursor:
        kwargs['ExclusiveStartKey'] = cursor
    resp = tbl.query(**kwargs)
    return ok({'items': resp.get('Items', []), 'nextCursor': encode_key(resp.get('LastEvaluatedKey'))})


# ── Dashboards ──────────────────────────────────────────────────────────────

def _count_role(role: str) -> dict:
    users = query_all(table('users'), IndexName='RoleIndex', KeyConditionExpression=Key('role').eq(role),
                      ProjectionExpression='isActive')
    return {'total': len(users), 'active': sum(1 for u in users if u.get('isActive') is not False)}


def _count_status(status: str) -> int:
    return table('consultations').query(IndexName='StatusIndex', KeyConditionExpression=Key('status').eq(status),
                                        Select='COUNT')['Count']


def _my_tasks(user_id: str) -> list[dict]:
    return query_all(table('tasks'), IndexName='AssigneeIndex', KeyConditionExpression=Key('assigneeId').eq(user_id),
                     FilterExpression=Attr('status').eq('OPEN'))


def _task_summary(tasks: list[dict]) -> dict:
    now = now_iso()
    end = time.strftime('%Y-%m-%dT23:59:59Z', time.gmtime())
    return {
        'overdue': sum(1 for t in tasks if t.get('dueAt', '') < now),
        'dueToday': sum(1 for t in tasks if now <= t.get('dueAt', '') <= end),
        'callsToday': sum(1 for t in tasks if t.get('followUpType') == 'CALL' and t.get('dueAt', '') <= end),
        'upcomingAppointments': sorted(
            [{k: t.get(k) for k in ('taskId', 'title', 'dueAt', 'customerName', 'meetingMethod')}
             for t in tasks if t.get('kind') == 'APPOINTMENT' and t.get('dueAt', '') >= now],
            key=lambda t: t['dueAt'])[:5],
        'next': sorted([{k: t.get(k) for k in ('taskId', 'title', 'dueAt', 'kind', 'priority', 'leadId')} for t in tasks],
                       key=lambda t: t['dueAt'])[:8],
    }


def _dashboard(event):
    actor = require_actor(event)
    role, uid = actor['role'], actor['userId']
    out = {'role': role, 'unreadNotifications': unread_count(uid)}

    if role == FARMER:
        cons = query_all(table('consultations'), IndexName='CustomerIndex', KeyConditionExpression=Key('customerId').eq(uid),
                         max_items=50)
        cons = sorted([c for c in cons if c.get('status') != 'DRAFT'], key=lambda c: c['createdAt'], reverse=True)
        quotes = query_all(table('quotations'), IndexName='CustomerIndex', KeyConditionExpression=Key('customerId').eq(uid),
                           FilterExpression=Attr('status').is_in(['SHARED', 'VIEWED', 'ACCEPTED', 'REJECTED']))
        appts = query_all(table('tasks'), IndexName='CustomerIndex', KeyConditionExpression=Key('customerId').eq(uid),
                          FilterExpression=Attr('kind').eq('APPOINTMENT') & Attr('status').eq('OPEN') & Attr('dueAt').gte(now_iso()))
        lands = query_all(table('lands'), IndexName='FarmerIndex', KeyConditionExpression=Key('farmerId').eq(uid))
        active = next((c for c in cons if c['status'] not in ('CLOSED', 'CANCELLED', 'RESOLVED')), None)
        out.update({
            'landCount': len(lands),
            'recentConsultations': [{k: c.get(k) for k in ('consultationId', 'cropName', 'status', 'expertName', 'createdAt')}
                                    for c in cons[:5]],
            'openConsultations': sum(1 for c in cons if c['status'] not in ('CLOSED', 'CANCELLED', 'RESOLVED')),
            'recommendationsReady': sum(1 for c in cons if c['status'] in ('RECOMMENDATION_PROVIDED', 'FOLLOW_UP_SCHEDULED')),
            'assignedExpert': active.get('expertName') if active else None,
            'pendingQuotations': [{k: q.get(k) for k in ('quotationId', 'quotationNumber', 'grandTotal', 'validUntil', 'status')}
                                  for q in quotes if q['status'] in ('SHARED', 'VIEWED')],
            'upcomingAppointments': [{k: t.get(k) for k in ('taskId', 'title', 'dueAt', 'meetingMethod')} for t in appts][:5],
        })
        return ok(out)

    tasks = _my_tasks(uid)
    out['tasks'] = _task_summary(tasks)

    if role == EXPERT:
        cons = query_all(table('consultations'), IndexName='ExpertIndex', KeyConditionExpression=Key('expertId').eq(uid))
        by = {}
        for c in cons:
            by[c['status']] = by.get(c['status'], 0) + 1
        out.update({
            'consultationsByStatus': by,
            'newRequests': by.get('ASSIGNED', 0),
            'awaitingResponse': by.get('ACCEPTED', 0) + by.get('IN_PROGRESS', 0),
            'awaitingCustomer': by.get('INFO_REQUIRED', 0),
            'completed': by.get('RECOMMENDATION_PROVIDED', 0) + by.get('FOLLOW_UP_SCHEDULED', 0) + by.get('RESOLVED', 0) + by.get('CLOSED', 0),
            'workload': {'active': int(actor.get('activeConsultationCount') or 0),
                         'capacity': int(actor.get('maxActiveConsultations') or get_setting('assignment')['defaultMaxActiveConsultations']),
                         'isAvailable': actor.get('isAvailable', True)},
            'recent': sorted([{k: c.get(k) for k in ('consultationId', 'cropName', 'customerName', 'status', 'severity', 'createdAt')}
                              for c in cons if c['status'] in ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'INFO_REQUIRED')],
                             key=lambda c: c['createdAt'], reverse=True)[:8],
        })
        return ok(out)

    if role == STAFF:
        mine = query_all(table('leads'), IndexName='OwnerIndex', KeyConditionExpression=Key('ownerId').eq(uid))
        pool = table('leads').query(IndexName='OwnerIndex', KeyConditionExpression=Key('ownerId').eq('UNASSIGNED'),
                                    Select='COUNT')['Count']
        quotes = query_all(table('quotations'), IndexName='CreatorIndex', KeyConditionExpression=Key('createdBy').eq(uid))
        out.update({
            'myLeads': len(mine),
            'myOpenLeads': sum(1 for l in mine if l.get('stage') not in ('WON', 'LOST')),
            'poolLeads': pool,
            'quotationsToShare': sum(1 for q in quotes if q['status'] == 'APPROVED'),
            'quotationsDraft': sum(1 for q in quotes if q['status'] == 'DRAFT'),
            'recentLeads': sorted([{k: l.get(k) for k in ('leadId', 'customerName', 'stage', 'priority', 'lastActivityAt')}
                                   for l in mine], key=lambda l: l.get('lastActivityAt') or '', reverse=True)[:6],
        })
        return ok(out)

    # ADMIN / SUPER_ADMIN
    leads = scan_all(table('leads'), ProjectionExpression='stage, ownerId, createdAt')
    quotes = scan_all(table('quotations'), ProjectionExpression='#s', ExpressionAttributeNames={'#s': 'status'})
    open_tasks = scan_all(table('tasks'), FilterExpression=Attr('status').eq('OPEN'), ProjectionExpression='dueAt, kind')
    experts = query_all(table('users'), IndexName='RoleIndex', KeyConditionExpression=Key('role').eq(EXPERT))
    by_stage = {}
    for l in leads:
        by_stage[l.get('stage')] = by_stage.get(l.get('stage'), 0) + 1
    won, lost = by_stage.get('WON', 0), by_stage.get('LOST', 0)
    pending = sum(_count_status(s) for s in ('SUBMITTED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'INFO_REQUIRED'))
    out.update({
        'leads': {'total': len(leads), 'byStage': by_stage, 'unassigned': sum(1 for l in leads if l.get('ownerId') == 'UNASSIGNED'),
                  'conversionRate': round(won * 100 / (won + lost), 1) if won + lost else None},
        'consultations': {'pending': pending, 'awaitingAssignment': _count_status('AWAITING_ASSIGNMENT')},
        'quotations': {'pendingApproval': sum(1 for q in quotes if q.get('status') == 'PENDING_APPROVAL'),
                       'accepted': sum(1 for q in quotes if q.get('status') == 'ACCEPTED'), 'total': len(quotes)},
        'overdueFollowUps': sum(1 for t in open_tasks if t.get('dueAt', '') < now_iso()),
        'expertWorkload': [{'name': e.get('name'), 'active': int(e.get('activeConsultationCount') or 0),
                            'available': e.get('isAvailable', True) and e.get('isActive', True)} for e in experts],
    })
    if role == SUPER_ADMIN:
        cfg = get_setting('ai')
        usage = table('settings').get_item(Key={'settingKey': f'aiUsage#{today()}'}).get('Item') or {}
        out.update({
            'users': {r: _count_role(r) for r in (ADMIN, STAFF, EXPERT, FARMER)},
            'ai': {'enabled': cfg.get('enabled'),
                   'providers': {p: {k: cfg['providers'][p].get(k) for k in ('enabled', 'keyConfigured', 'lastTestOk', 'lastTestAt', 'model')}
                                 for p in PROVIDERS},
                   'requestsToday': int(usage.get('total', 0)), 'errorsToday': int(usage.get('errors', 0))},
        })
    return ok(out)
