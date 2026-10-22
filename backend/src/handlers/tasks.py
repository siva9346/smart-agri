"""
Follow-ups, appointments and tasks.

GET  /tasks          – ?scope=mine|team|customer &kind= &status= &leadId= &overdue=1
POST /tasks          – create {kind, title, dueAt, assigneeId?, leadId?, consultationId?, ...}
GET  /tasks/{id}
PUT  /tasks/{id}     – update fields, or {status: COMPLETED, outcome} to complete

Customers only see appointments that reference them (scope=customer).
"""
from boto3.dynamodb.conditions import Key, Attr

from lib.db import table, encode_key, decode_key
from lib.router import run
from lib.permissions import require_actor, require_permission, has_permission, can_view_lead, FARMER
from lib.crm import get_lead, log_activity
from lib.tasks import (
    create_task_record, parse_iso, to_iso, STATUSES, PRIORITIES,
)
from lib.notify import notify_users
from lib.util import HttpError, now_iso, update_item, clean_str
from lib.response import ok, created, query_param, parse_body

PAGE_SIZE = 50


def handler(event, _ctx):
    return run(event, _route)


def _route(event, m, seg):
    if not seg:
        if m == 'GET':  return _list(event)
        if m == 'POST': return _create(event)
        return None
    if len(seg) == 1:
        if m == 'GET': return _get(event, seg[0])
        if m == 'PUT': return _update(event, seg[0])
    return None


def _decorate(task: dict) -> dict:
    out = dict(task)
    out['isOverdue'] = task.get('status') == 'OPEN' and task.get('dueAt', '') < now_iso()
    out.pop('reminderPending', None)
    return out


def _list(event):
    actor = require_actor(event)
    scope = query_param(event, 'scope') or 'mine'
    kind = (query_param(event, 'kind') or '').upper()
    status = (query_param(event, 'status') or '').upper()
    lead_id = query_param(event, 'leadId')
    overdue = query_param(event, 'overdue') == '1'
    cursor = decode_key(query_param(event, 'cursor'))
    tbl = table('tasks')

    filters = []
    if kind:
        filters.append(Attr('kind').eq(kind))
    if status:
        filters.append(Attr('status').eq(status))
    if overdue:
        filters.append(Attr('status').eq('OPEN') & Attr('dueAt').lt(now_iso()))
    kwargs = {'Limit': PAGE_SIZE}
    if cursor:
        kwargs['ExclusiveStartKey'] = cursor

    if actor['role'] == FARMER:
        kwargs.update(IndexName='CustomerIndex', KeyConditionExpression=Key('customerId').eq(actor['userId']))
        filters.append(Attr('kind').eq('APPOINTMENT'))
    elif lead_id:
        if not can_view_lead(actor, get_lead(lead_id)):
            raise HttpError(403, 'Access denied')
        kwargs.update(IndexName='LeadIndex', KeyConditionExpression=Key('leadId').eq(lead_id))
    elif scope == 'team':
        if not has_permission(actor, 'tasks.assign_others'):
            raise HttpError(403, 'Access denied')
    else:
        if not has_permission(actor, 'tasks.manage'):
            raise HttpError(403, 'Access denied')
        kwargs.update(IndexName='AssigneeIndex', KeyConditionExpression=Key('assigneeId').eq(actor['userId']))

    if filters:
        f = filters[0]
        for extra in filters[1:]:
            f = f & extra
        kwargs['FilterExpression'] = f

    resp = tbl.query(**kwargs) if 'KeyConditionExpression' in kwargs else tbl.scan(**kwargs)
    items = sorted(resp.get('Items', []), key=lambda t: t.get('dueAt', ''))
    return ok({'items': [_decorate(t) for t in items], 'nextCursor': encode_key(resp.get('LastEvaluatedKey'))})


def _create(event):
    actor = require_permission(event, 'tasks.manage')
    body = parse_body(event)
    if body.get('assigneeId') and body['assigneeId'] != actor['userId'] \
            and not has_permission(actor, 'tasks.assign_others'):
        raise HttpError(403, 'You can only create tasks for yourself')
    if body.get('leadId'):
        lead = get_lead(body['leadId'])
        if not can_view_lead(actor, lead):
            raise HttpError(403, 'Access denied')
        body.setdefault('customerId', lead.get('customerId'))
        body.setdefault('customerName', lead.get('customerName'))
    task = create_task_record(body, actor)
    if task['kind'] == 'APPOINTMENT' and task.get('customerId'):
        notify_users([task['customerId']], 'Appointment scheduled',
                     f"{task['title']} on {task['dueAt']}", 'CONSULTATION', f"task/{task['taskId']}")
    return created(_decorate(task))


def _load(actor: dict, task_id: str) -> dict:
    task = table('tasks').get_item(Key={'taskId': task_id}).get('Item')
    if not task:
        raise HttpError(404, 'Task not found')
    uid = actor['userId']
    if actor['role'] == FARMER:
        if task.get('customerId') != uid or task.get('kind') != 'APPOINTMENT':
            raise HttpError(403, 'Access denied')
    elif uid not in (task.get('assigneeId'), task.get('createdBy')) and not has_permission(actor, 'tasks.assign_others'):
        raise HttpError(403, 'Access denied')
    return task


def _get(event, task_id):
    actor = require_actor(event)
    return ok(_decorate(_load(actor, task_id)))


def _update(event, task_id):
    actor = require_permission(event, 'tasks.manage')
    task = _load(actor, task_id)
    body = parse_body(event)
    updates = {'updatedAt': now_iso()}
    events = []

    if 'title' in body:
        updates['title'] = clean_str(body, 'title', 200, required=True)
    for k in ('description', 'notes', 'location'):
        if k in body:
            updates[k] = clean_str(body, k, 2000)
    if 'priority' in body:
        p = (body['priority'] or '').upper()
        if p not in PRIORITIES:
            raise HttpError(400, 'invalid priority')
        updates['priority'] = p
    if body.get('dueAt'):
        due = parse_iso(body['dueAt'], 'dueAt')
        updates['dueAt'] = to_iso(due)
        events.append(f"Rescheduled to {updates['dueAt']}")
        if task.get('reminderMinutes') is not None and task.get('status') == 'OPEN':
            updates['reminderAt'] = to_iso(due - int(task['reminderMinutes']) * 60)
            updates['reminderPending'] = 'Y'
    if body.get('assigneeId') and body['assigneeId'] != task['assigneeId']:
        if not has_permission(actor, 'tasks.assign_others'):
            raise HttpError(403, 'Only an admin can reassign tasks')
        assignee = table('users').get_item(Key={'userId': body['assigneeId']}).get('Item')
        if not assignee or assignee.get('role') == FARMER:
            raise HttpError(400, 'invalid assignee')
        updates.update(assigneeId=assignee['userId'], assigneeName=assignee.get('name', ''))
        events.append(f"Reassigned to {assignee.get('name')}")
        notify_users([assignee['userId']], 'Task assigned to you', updates.get('title', task['title']), 'CRM_TASK',
                     f'task/{task_id}')
    if body.get('status'):
        status = body['status'].upper()
        if status not in STATUSES:
            raise HttpError(400, 'invalid status')
        if status != task['status']:
            updates['status'] = status
            if status != 'OPEN':
                updates['reminderPending'] = None
                updates['completedAt'] = now_iso()
                updates['completedBy'] = actor['userId']
            outcome = clean_str(body, 'outcome', 2000)
            if outcome:
                updates['outcome'] = outcome
            events.append(f'Status {task["status"]} → {status}' + (f': {outcome}' if outcome else ''))

    history = task.get('history', []) + [{'at': updates['updatedAt'], 'by': actor['userId'], 'event': e} for e in events]
    updates['history'] = history[-50:]
    updated = update_item(table('tasks'), {'taskId': task_id}, updates)
    if task.get('leadId') and events:
        log_activity(task['leadId'], task['kind'], actor, f"{task['title']}: " + '; '.join(events), {'taskId': task_id})
    return ok(_decorate(updated))
