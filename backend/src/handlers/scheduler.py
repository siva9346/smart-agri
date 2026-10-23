"""
EventBridge job (every 15 minutes):
  1. task / appointment reminders whose reminderAt has passed;
  2. escalation of consultations stuck in SUBMITTED / AWAITING_ASSIGNMENT / ASSIGNED
     for longer than settings.assignment.escalateAfterHours (each escalated once);
     SUBMITTED ones are retried through auto-assignment first;
  3. lazy quotation expiry for APPROVED / SHARED / VIEWED past validUntil.
"""
from boto3.dynamodb.conditions import Key, Attr

from lib import automation
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
        'scheduledPushes': _scheduled_pushes(),
        'pushReceipts': _push_receipts(),
        'quotationFollowUps': automation.run_quotation_followups(),
        'aiProviderAlerts': automation.run_ai_provider_alert(),
    }


def _scheduled_pushes() -> int:
    """Send the push for scheduled announcements whose start time has arrived."""
    from lib.notify import is_started
    from lib.push import tokens_for, send_to_recipients
    from lib.util import scan_all
    due = [n for n in scan_all(table('notifications'), FilterExpression=Attr('channelStatus.PUSH').eq('NOT_SENT_SCHEDULED'))
           if is_started(n)]
    for n in due:
        recs = query_all(table('inbox'), IndexName='NotifIndex', KeyConditionExpression=Key('notifId').eq(n['notifId']),
                         ProjectionExpression='userId, recipientKey')
        try:
            tokens = tokens_for([r['userId'] for r in recs])
            send_to_recipients([{'userId': r['userId'], 'recipientKey': r['recipientKey'], 'tokens': tokens.get(r['userId'], [])}
                                for r in recs], n)
        finally:
            table('notifications').update_item(Key={'notifId': n['notifId']}, UpdateExpression='SET channelStatus.PUSH = :s',
                                               ExpressionAttributeValues={':s': 'SENT'})
    return len(due)


def _push_receipts() -> int:
    from lib.push import collect_receipts
    try:
        return collect_receipts()
    except Exception as e:
        print(f'push receipts failed: {e}')
        return 0


def _reminders() -> int:
    if not automation.is_enabled('FOLLOWUP_OVERDUE_REMINDER'):
        return 0
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
        automation.reminder_fired(t['taskId'], f"{label} '{t['title']}' due {t['dueAt']}")
        sent += 1
    return sent


def _escalations() -> int:
    if not automation.is_enabled('UNASSIGNED_CONSULTATION_ESCALATION'):
        return 0
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
            detail = f"{c.get('customerName')} — {c['cropName']} has waited over {cfg['escalateAfterHours']}h{who}."
            notify_roles(['ADMIN', 'SUPER_ADMIN'], 'Overdue consultation', detail, 'ESCALATION', f"consultation/{c['consultationId']}")
            automation.escalation_fired(c['consultationId'], status, detail)
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
