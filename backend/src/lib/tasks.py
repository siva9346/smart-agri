"""Follow-ups, appointments and tasks — shared creation logic."""
import calendar
import time

from lib.db import table
from lib.crm import log_activity
from lib.notify import notify_users
from lib.util import HttpError, now_iso, new_id

KINDS = ('FOLLOW_UP', 'APPOINTMENT', 'TASK', 'FIELD_VISIT')
STATUSES = ('OPEN', 'COMPLETED', 'CANCELLED', 'NO_SHOW')
PRIORITIES = ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
FOLLOW_UP_TYPES = ('CALL', 'WHATSAPP', 'VISIT', 'MEETING', 'OTHER')
MEETING_METHODS = ('IN_PERSON', 'PHONE', 'VIDEO', 'FIELD_VISIT')


def parse_iso(value: str, field: str) -> float:
    """Accept 'YYYY-MM-DDTHH:MM:SSZ', 'YYYY-MM-DDTHH:MM' (UTC) or 'YYYY-MM-DD'."""
    for fmt in ('%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%MZ', '%Y-%m-%dT%H:%M', '%Y-%m-%d'):
        try:
            return calendar.timegm(time.strptime(value, fmt))
        except (ValueError, TypeError):
            continue
    raise HttpError(400, f'{field} must be an ISO date/time')


def to_iso(epoch: float) -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(epoch))


def create_task_record(data: dict, actor: dict) -> dict:
    kind = (data.get('kind') or 'TASK').upper()
    if kind not in KINDS:
        raise HttpError(400, 'invalid kind')
    title = (data.get('title') or '').strip()
    if not title:
        raise HttpError(400, 'title required')
    due_epoch = parse_iso(data.get('dueAt') or '', 'dueAt')
    priority = (data.get('priority') or 'MEDIUM').upper()
    if priority not in PRIORITIES:
        raise HttpError(400, 'invalid priority')

    assignee = table('users').get_item(Key={'userId': data.get('assigneeId') or actor['userId']}).get('Item')
    if not assignee or assignee.get('role') == 'FARMER' or assignee.get('isActive') is False:
        raise HttpError(400, 'Assignee must be an active team member')

    now = now_iso()
    task = {
        'taskId':      new_id(),
        'kind':        kind,
        'title':       title[:200],
        'description': (data.get('description') or '')[:2000],
        'assigneeId':  assignee['userId'],
        'assigneeName': assignee.get('name', ''),
        'dueAt':       to_iso(due_epoch),
        'priority':    priority,
        'status':      'OPEN',
        'createdBy':   actor['userId'],
        'createdByName': actor.get('name', ''),
        'createdAt':   now,
        'updatedAt':   now,
        'history':     [{'at': now, 'by': actor['userId'], 'event': 'CREATED'}],
    }
    for k in ('leadId', 'consultationId', 'customerId', 'customerName', 'notes', 'location'):
        if data.get(k):
            task[k] = str(data[k])[:1000]
    if kind == 'FOLLOW_UP':
        ftype = (data.get('followUpType') or 'CALL').upper()
        if ftype not in FOLLOW_UP_TYPES:
            raise HttpError(400, 'invalid followUpType')
        task['followUpType'] = ftype
    if kind == 'FIELD_VISIT':
        task['purpose'] = (data.get('purpose') or '')[:500]
    if kind == 'APPOINTMENT':
        method = (data.get('meetingMethod') or 'IN_PERSON').upper()
        if method not in MEETING_METHODS:
            raise HttpError(400, 'invalid meetingMethod')
        task['meetingMethod'] = method
        task['consultationType'] = (data.get('consultationType') or '')[:100]

    reminder = data.get('reminderMinutes')
    if reminder is None:
        reminder = 60 if kind == 'APPOINTMENT' else 30
    reminder = int(reminder)
    if reminder >= 0:
        task['reminderMinutes'] = reminder
        task['reminderAt'] = to_iso(due_epoch - reminder * 60)
        task['reminderPending'] = 'Y'  # sparse ReminderIndex key; removed once sent

    table('tasks').put_item(Item=task)

    if task.get('leadId'):
        log_activity(task['leadId'], kind, actor, f"{kind.replace('_', ' ').title()} scheduled: {task['title']} on {task['dueAt']}",
                     {'taskId': task['taskId']})
    if assignee['userId'] != actor['userId']:
        notify_users([assignee['userId']], f"New {kind.replace('_', ' ').lower()}", f"{task['title']} — due {task['dueAt']}",
                     'CRM_TASK', f"task/{task['taskId']}")
    return task
