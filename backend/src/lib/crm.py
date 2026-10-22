"""
CRM lead domain helpers shared by the crm, consultations and quotations handlers.

Lead stage (sales pipeline) is deliberately independent of consultation status:
a consultation can be RESOLVED while its lead is LOST, or vice-versa.
`ownerId` is the sentinel 'UNASSIGNED' (not absent) so the shared pool can be
queried through OwnerIndex.
"""
from boto3.dynamodb.conditions import Key, Attr

from lib.db import table
from lib.settings import get_setting
from lib.util import now_iso, new_id, query_all, update_item, HttpError

STAGES = [
    'NEW', 'CONTACT_PENDING', 'CONTACTED', 'REQUIREMENT_IDENTIFIED', 'EXPERT_CONSULTATION',
    'RECOMMENDATION_PROVIDED', 'QUOTATION_SHARED', 'NEGOTIATION', 'WON', 'LOST',
]
CLOSED_STAGES = ('WON', 'LOST')
SOURCES = ['PHONE_CALL', 'WHATSAPP', 'FIELD_VISIT', 'REFERRAL', 'CAMPAIGN', 'WEBSITE', 'EXPERT_CONSULTATION', 'OTHER']
PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
UNASSIGNED = 'UNASSIGNED'


def activity_item(lead_id: str, type_: str, actor: dict | None, text: str, data: dict | None = None,
                  ts: str | None = None) -> dict:
    ts = ts or now_iso()
    aid = new_id()
    item = {
        'leadId':     lead_id,
        'sortKey':    f'{ts}#{aid}',
        'activityId': aid,
        'type':       type_,
        'text':       text[:4000],
        'actorId':    (actor or {}).get('userId', 'system'),
        'actorName':  (actor or {}).get('name', 'System'),
        'actorRole':  (actor or {}).get('role', 'SYSTEM'),
        'createdAt':  ts,
        'feed':       'ALL',  # constant partition for the global FeedIndex (admin activity feed)
    }
    if data:
        item['data'] = data
    return item


def log_activity(lead_id: str, type_: str, actor: dict | None, text: str, data: dict | None = None) -> dict:
    item = activity_item(lead_id, type_, actor, text, data)
    table('lead_activities').put_item(Item=item)
    table('leads').update_item(
        Key={'leadId': lead_id},
        UpdateExpression='SET lastActivityAt = :t',
        ExpressionAttributeValues={':t': item['createdAt']},
    )
    return item


def search_text(lead: dict) -> str:
    return ' '.join(str(lead.get(k) or '') for k in ('customerName', 'phone', 'location', 'cropName', 'requirement')).lower()


def get_lead(lead_id: str) -> dict:
    lead = table('leads').get_item(Key={'leadId': lead_id}).get('Item')
    if not lead:
        raise HttpError(404, 'Lead not found')
    return lead


def pick_owner() -> dict | None:
    """Staff member for a new system-created lead, per settings.assignment.leadOwnerStrategy."""
    if get_setting('assignment').get('leadOwnerStrategy') != 'ROUND_ROBIN':
        return None
    staff = query_all(table('users'), IndexName='RoleIndex', KeyConditionExpression=Key('role').eq('STAFF'))
    staff = [s for s in staff if s.get('isActive') is not False and s.get('deletionStatus') != 'PENDING']
    if not staff:
        return None
    staff.sort(key=lambda s: s.get('lastLeadAssignedAt') or '')
    chosen = staff[0]
    table('users').update_item(
        Key={'userId': chosen['userId']},
        UpdateExpression='SET lastLeadAssignedAt = :t',
        ExpressionAttributeValues={':t': now_iso()},
    )
    return chosen


def change_stage(lead: dict, stage: str, actor: dict | None, reason: str = '', auto: bool = False) -> dict:
    if stage not in STAGES:
        raise HttpError(400, 'invalid stage')
    current = lead.get('stage')
    if current == stage:
        return lead
    if stage == 'LOST' and not reason:
        raise HttpError(400, 'A reason is required when marking a lead as lost')
    if current in CLOSED_STAGES and not auto and (actor or {}).get('role') not in ('ADMIN', 'SUPER_ADMIN'):
        raise HttpError(403, 'Only an admin can reopen a closed lead')
    now = now_iso()
    updates = {'stage': stage, 'updatedAt': now, 'stageChangedAt': now}
    if stage == 'LOST':
        updates['lostReason'] = reason
    if stage in CLOSED_STAGES:
        updates['closedAt'] = now
    # Optimistic check: fail (409) if someone else moved the lead meanwhile.
    updated = update_item(table('leads'), {'leadId': lead['leadId']}, updates,
                          condition=Attr('stage').eq(current) if current else Attr('stage').not_exists())
    log_activity(lead['leadId'], 'STAGE_CHANGE', actor,
                 f"Stage changed from {current or '-'} to {stage}" + (f' — {reason}' if reason else ''),
                 {'from': current, 'to': stage, 'reason': reason or None, 'auto': auto})
    return updated


def advance_stage(lead_id: str | None, stage: str, actor: dict | None, note: str):
    """Move a lead forward automatically, never backwards and never out of WON/LOST."""
    if not lead_id:
        return
    try:
        lead = get_lead(lead_id)
    except HttpError:
        return
    current = lead.get('stage', 'NEW')
    if current in CLOSED_STAGES or STAGES.index(stage) <= STAGES.index(current):
        return
    change_stage(lead, stage, actor, note, auto=True)


def sync_lead_owner_to_consultations(lead: dict):
    cid = lead.get('consultationId')
    if not cid:
        return
    table('consultations').update_item(
        Key={'consultationId': cid},
        UpdateExpression='SET leadOwnerId = :o',
        ConditionExpression='attribute_exists(consultationId)',
        ExpressionAttributeValues={':o': lead.get('ownerId', UNASSIGNED)},
    )
