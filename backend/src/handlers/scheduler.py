"""
EventBridge job (every 15 minutes):
  1. task / appointment reminders whose reminderAt has passed;
  2. escalation of consultations stuck in SUBMITTED / AWAITING_ASSIGNMENT / ASSIGNED
     for longer than settings.assignment.escalateAfterHours (each escalated once);
     SUBMITTED ones are retried through auto-assignment first;
  3. lazy quotation expiry for APPROVED / SHARED / VIEWED past validUntil.
"""
from boto3.dynamodb.conditions import Key, Attr

from lib.db import table
from lib.settings import get_setting
from lib.assignment import auto_assign
from lib.notify import notify_users, notify_roles
from lib.util import now_iso, iso_in, today, query_all, update_item


def handler(_event, _ctx):
    return {
        'reminders': _reminders(),
        'escalations': _escalations(),
        'expiredQuotations': _expire_quotations(),
    }


def _reminders() -> int:
    due = query_all(table('tasks'), IndexName='ReminderIndex',
                    KeyConditionExpression=Key('reminderPending').eq('Y') & Key('reminderAt').lte(now_iso()))
    sent = 0
    for t in due:
        try:
            table('tasks').update_item(
                Key={'taskId': t['taskId']}, UpdateExpression='REMOVE reminderPending SET remindedAt = :n',
                ConditionExpression=Attr('reminderPending').eq('Y'), ExpressionAttributeValues={':n': now_iso()},
            )
        except Exception:
            continue  # another run already sent it
        if t.get('status') != 'OPEN':
            continue
        label = t['kind'].replace('_', ' ').lower()
        notify_users([t['assigneeId']], f'Reminder: {label} due', f"{t['title']} — due {t['dueAt']}", 'REMINDER',
                     f"task/{t['taskId']}", 'HIGH' if t.get('priority') in ('HIGH', 'URGENT') else 'NORMAL')
        if t['kind'] == 'APPOINTMENT' and t.get('customerId'):
            notify_users([t['customerId']], 'Upcoming appointment', f"{t['title']} at {t['dueAt']}", 'REMINDER')
        sent += 1
    return sent


def _escalations() -> int:
    cfg = get_setting('assignment')
    cutoff = iso_in(-int(cfg['escalateAfterHours']) * 3600)
    count = 0
    for status in ('SUBMITTED', 'AWAITING_ASSIGNMENT', 'ASSIGNED'):
        stuck = query_all(table('consultations'), IndexName='StatusIndex',
                          KeyConditionExpression=Key('status').eq(status) & Key('createdAt').lte(cutoff),
                          FilterExpression=Attr('escalatedAt').not_exists())
        for c in stuck:
            if status in ('SUBMITTED', 'AWAITING_ASSIGNMENT'):
                try:
                    updated, expert = auto_assign(c)
                    if expert:
                        notify_users([expert['userId']], 'New consultation assigned',
                                     f"{c.get('customerName')} — {c['cropName']}", 'ASSIGNMENT', f"consultation/{c['consultationId']}")
                        continue
                except Exception as e:
                    print(f"retry assign failed {c['consultationId']}: {e}")
            update_item(table('consultations'), {'consultationId': c['consultationId']}, {'escalatedAt': now_iso()})
            who = f" (assigned to {c.get('expertName')}, not accepted)" if status == 'ASSIGNED' else ''
            notify_roles(['ADMIN', 'SUPER_ADMIN'], 'Overdue consultation',
                         f"{c.get('customerName')} — {c['cropName']} has waited over {cfg['escalateAfterHours']}h{who}.",
                         'ESCALATION', f"consultation/{c['consultationId']}")
            count += 1
    return count


def _expire_quotations() -> int:
    n = 0
    for status in ('APPROVED', 'SHARED', 'VIEWED'):
        for q in query_all(table('quotations'), IndexName='StatusIndex', KeyConditionExpression=Key('status').eq(status),
                           FilterExpression=Attr('validUntil').lt(today())):
            try:
                update_item(table('quotations'), {'quotationId': q['quotationId']},
                            {'status': 'EXPIRED', 'updatedAt': now_iso()}, condition=Attr('status').eq(status))
                n += 1
            except Exception:
                pass
    return n
