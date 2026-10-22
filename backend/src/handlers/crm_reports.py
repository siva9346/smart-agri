"""
CRM reporting routes (mounted under /crm by handlers.crm):

GET /crm/daily-report?date=YYYY-MM-DD&userId=   – one person's day (self, or anyone with reports.team)
GET /crm/performance?days=30                     – per staff / expert metrics            (reports.team)
GET /crm/targets?month=YYYY-MM                   – sales targets with live progress (own; everyone with reports.team)
PUT /crm/targets                                 – {month, userId, revenue, wonLeads}    (reports.team)

All figures are computed from recorded activity, tasks, leads and quotations —
there are no manually entered "achieved" numbers.
"""
import time
from decimal import Decimal

from boto3.dynamodb.conditions import Key, Attr

from lib.db import table
from lib.permissions import require_permission, has_permission, STAFF, EXPERT
from lib.settings import get_setting, put_setting
from lib.audit import audit
from lib.util import HttpError, query_all, to_decimal, now_iso
from lib.response import ok, query_param, parse_body


def _day(value: str | None) -> str:
    day = value or time.strftime('%Y-%m-%d', time.gmtime())
    try:
        time.strptime(day, '%Y-%m-%d')
    except ValueError:
        raise HttpError(400, 'date must be YYYY-MM-DD')
    return day


def _month(value: str | None) -> str:
    month = value or time.strftime('%Y-%m', time.gmtime())
    try:
        time.strptime(month, '%Y-%m')
    except ValueError:
        raise HttpError(400, 'month must be YYYY-MM')
    return month


def _subject(actor: dict, user_id: str | None) -> dict:
    if not user_id or user_id == actor['userId']:
        return actor
    if not has_permission(actor, 'reports.team'):
        raise HttpError(403, 'You can only view your own report')
    user = table('users').get_item(Key={'userId': user_id}).get('Item')
    if not user or user.get('role') == 'FARMER':
        raise HttpError(404, 'User not found')
    return user


def _activities(user_id: str, prefix: str) -> list[dict]:
    return query_all(table('lead_activities'), IndexName='ActorIndex',
                     KeyConditionExpression=Key('actorId').eq(user_id) & Key('sortKey').begins_with(prefix))


def daily_report(event):
    actor = require_permission(event, 'crm.view')
    day = _day(query_param(event, 'date'))
    who = _subject(actor, query_param(event, 'userId'))
    acts = _activities(who['userId'], day)
    by_type: dict = {}
    for a in acts:
        by_type[a['type']] = by_type.get(a['type'], 0) + 1
    calls = [a for a in acts if a['type'] == 'CALL' and (a.get('data') or {}).get('outcome') != 'DIALER_OPENED']
    tasks = query_all(table('tasks'), IndexName='AssigneeIndex', KeyConditionExpression=Key('assigneeId').eq(who['userId']))
    completed = [t for t in tasks if (t.get('completedAt') or '').startswith(day) and t.get('status') == 'COMPLETED']
    due = [t for t in tasks if t.get('dueAt', '').startswith(day)]
    visits = [t for t in tasks if t.get('kind') == 'FIELD_VISIT' and any(c['at'].startswith(day) for c in t.get('checkIns', []))]
    return ok({
        'date': day, 'user': {'userId': who['userId'], 'name': who.get('name'), 'role': who.get('role')},
        'counts': {
            'callsLogged': len(calls),
            'callsConnected': sum(1 for a in calls if a['data'].get('outcome') == 'CONNECTED'),
            'whatsapp': by_type.get('WHATSAPP', 0), 'notes': by_type.get('NOTE', 0),
            'stageChanges': by_type.get('STAGE_CHANGE', 0), 'quotationActions': by_type.get('QUOTATION', 0),
            'leadsCreated': by_type.get('CREATED', 0), 'consultationActions': by_type.get('CONSULTATION', 0),
            'tasksDue': len(due), 'tasksCompleted': len(completed), 'fieldVisits': len(visits),
        },
        'completedTasks': [{k: t.get(k) for k in ('taskId', 'kind', 'title', 'outcome', 'completedAt', 'customerName')} for t in completed],
        'fieldVisits': [{k: t.get(k) for k in ('taskId', 'title', 'customerName', 'location', 'visitReport', 'checkIns')} for t in visits],
        'timeline': sorted([{k: a.get(k) for k in ('activityId', 'leadId', 'type', 'text', 'createdAt')} for a in acts],
                           key=lambda a: a['createdAt']),
    })


def performance(event):
    require_permission(event, 'reports.team')
    days = int(to_decimal(query_param(event, 'days') or 30, 'days', 1, 365))
    since = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - days * 86400))
    now = now_iso()
    rows = []
    for role in (STAFF, EXPERT):
        for u in query_all(table('users'), IndexName='RoleIndex', KeyConditionExpression=Key('role').eq(role)):
            if u.get('isActive') is False:
                continue
            acts = query_all(table('lead_activities'), IndexName='ActorIndex',
                             KeyConditionExpression=Key('actorId').eq(u['userId']) & Key('sortKey').gte(since))
            tasks = query_all(table('tasks'), IndexName='AssigneeIndex', KeyConditionExpression=Key('assigneeId').eq(u['userId']))
            row = {
                'userId': u['userId'], 'name': u.get('name'), 'role': role,
                'calls': sum(1 for a in acts if a['type'] == 'CALL' and (a.get('data') or {}).get('outcome') != 'DIALER_OPENED'),
                'whatsapp': sum(1 for a in acts if a['type'] == 'WHATSAPP'),
                'activities': len(acts),
                'tasksCompleted': sum(1 for t in tasks if t.get('status') == 'COMPLETED' and (t.get('completedAt') or '') >= since),
                'overdueTasks': sum(1 for t in tasks if t.get('status') == 'OPEN' and t.get('dueAt', '') < now),
            }
            if role == STAFF:
                leads = query_all(table('leads'), IndexName='OwnerIndex', KeyConditionExpression=Key('ownerId').eq(u['userId']))
                won = sum(1 for l in leads if l.get('stage') == 'WON' and (l.get('closedAt') or '') >= since)
                lost = sum(1 for l in leads if l.get('stage') == 'LOST' and (l.get('closedAt') or '') >= since)
                quotes = query_all(table('quotations'), IndexName='CreatorIndex',
                                   KeyConditionExpression=Key('createdBy').eq(u['userId']) & Key('createdAt').gte(since))
                row.update(openLeads=sum(1 for l in leads if l.get('stage') not in ('WON', 'LOST')), won=won, lost=lost,
                           conversionRate=round(won * 100 / (won + lost), 1) if won + lost else None,
                           quotations=len(quotes),
                           acceptedValue=float(sum(Decimal(str(q.get('grandTotal') or 0)) for q in quotes if q.get('status') == 'ACCEPTED')))
            else:
                cons = query_all(table('consultations'), IndexName='ExpertIndex',
                                 KeyConditionExpression=Key('expertId').eq(u['userId']) & Key('createdAt').gte(since))
                answered = [c for c in cons if c.get('recommendation')]
                hours = []
                for c in answered:
                    try:
                        a = time.mktime(time.strptime(c['assignedAt'], '%Y-%m-%dT%H:%M:%SZ'))
                        r = time.mktime(time.strptime(c['recommendation']['at'], '%Y-%m-%dT%H:%M:%SZ'))
                        hours.append((r - a) / 3600)
                    except (KeyError, ValueError):
                        pass
                row.update(consultations=len(cons), recommendations=len(answered),
                           activeConsultations=int(u.get('activeConsultationCount') or 0),
                           avgResponseHours=round(sum(hours) / len(hours), 1) if hours else None)
            rows.append(row)
    return ok({'days': days, 'since': since, 'items': rows})


def _progress(user_id: str, month: str) -> dict:
    quotes = query_all(table('quotations'), IndexName='CreatorIndex', KeyConditionExpression=Key('createdBy').eq(user_id),
                       FilterExpression=Attr('status').eq('ACCEPTED'))
    revenue = sum(Decimal(str(q.get('grandTotal') or 0)) for q in quotes if (q.get('respondedAt') or '').startswith(month))
    leads = query_all(table('leads'), IndexName='OwnerIndex', KeyConditionExpression=Key('ownerId').eq(user_id),
                      FilterExpression=Attr('stage').eq('WON'))
    won = sum(1 for l in leads if (l.get('closedAt') or '').startswith(month))
    return {'revenue': float(revenue), 'wonLeads': won}


def targets(event):
    actor = require_permission(event, 'crm.view')
    month = _month(query_param(event, 'month'))
    stored = get_setting(f'targets#{month}', fresh=True)
    if has_permission(actor, 'reports.team'):
        people = query_all(table('users'), IndexName='RoleIndex', KeyConditionExpression=Key('role').eq(STAFF))
        people = [p for p in people if p.get('isActive') is not False]
    else:
        people = [actor]
    items = []
    for p in sorted(people, key=lambda x: x.get('name', '')):
        t = stored.get(p['userId']) or {}
        prog = _progress(p['userId'], month)
        rev_t, won_t = float(t.get('revenue') or 0), int(t.get('wonLeads') or 0)
        items.append({
            'userId': p['userId'], 'name': p.get('name'),
            'target': {'revenue': rev_t, 'wonLeads': won_t}, 'achieved': prog,
            'revenuePct': round(prog['revenue'] * 100 / rev_t, 1) if rev_t else None,
            'wonPct': round(prog['wonLeads'] * 100 / won_t, 1) if won_t else None,
        })
    return ok({'month': month, 'items': items,
               'note': 'Revenue = accepted quotations created by the person, by acceptance month. Won = leads they own marked Won that month.'})


def set_target(event):
    actor = require_permission(event, 'reports.team')
    body = parse_body(event)
    month = _month(body.get('month'))
    user = table('users').get_item(Key={'userId': str(body.get('userId') or '')}).get('Item')
    if not user or user.get('role') != STAFF:
        raise HttpError(400, 'Targets can be set for staff members')
    stored = get_setting(f'targets#{month}', fresh=True)
    stored[user['userId']] = {'revenue': to_decimal(body.get('revenue') or 0, 'revenue', 0, 10 ** 10),
                              'wonLeads': int(to_decimal(body.get('wonLeads') or 0, 'wonLeads', 0, 100000))}
    put_setting(f'targets#{month}', stored, actor['userId'])
    audit(actor, 'TARGET_SET', 'user', user['userId'], {'month': month})
    return ok({'month': month, 'userId': user['userId'], 'target': stored[user['userId']]})
