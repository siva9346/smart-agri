"""
Expert assignment for consultation requests.

Priority order (first tier with an eligible expert wins):
  1. EXACT    – expert lists the crop itself (e.g. "tomato")
  2. RELATED  – expert lists a category related to the crop or problem
                (settings.assignment.cropCategories / problemCategories)
  3. GENERAL  – expert lists the general specialization ("general")
  4. QUEUE    – nobody eligible → status AWAITING_ASSIGNMENT, admins notified

Eligible = role EXPERT, active, marked available, and below their
maxActiveConsultations. Within a tier the expert with the lowest current
workload wins, ties broken by who was assigned least recently.

The consultation update is conditional on it still being unassigned (or still
assigned to the expected previous expert for reassignment), so two concurrent
assignment attempts can never both succeed.
"""
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from lib.db import table
from lib.settings import get_setting
from lib.util import now_iso, query_all, update_item, HttpError

ASSIGNABLE_STATUSES = ('SUBMITTED', 'AWAITING_ASSIGNMENT')
OPEN_STATUSES = (
    'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'INFO_REQUIRED',
    'RECOMMENDATION_PROVIDED', 'FOLLOW_UP_SCHEDULED',
)


def _norm(s: str) -> str:
    return (s or '').strip().lower()


def active_experts() -> list[dict]:
    experts = query_all(table('users'), IndexName='RoleIndex', KeyConditionExpression=Key('role').eq('EXPERT'))
    return [e for e in experts if e.get('isActive') is not False and e.get('deletionStatus') != 'PENDING']


def is_eligible(expert: dict, cfg: dict) -> bool:
    if expert.get('isActive') is False or expert.get('isAvailable') is False:
        return False
    cap = int(expert.get('maxActiveConsultations') or cfg['defaultMaxActiveConsultations'])
    return int(expert.get('activeConsultationCount') or 0) < cap


def rank_candidates(consultation: dict, experts: list[dict], cfg: dict) -> list[tuple[dict, str, str]]:
    """Return eligible experts ordered by priority, each with (tier, reason)."""
    crop = _norm(consultation.get('cropName'))
    problem = _norm(consultation.get('problemCategory'))
    related = {_norm(c) for c in cfg['cropCategories'].get(crop, [])}
    related |= {_norm(c) for c in cfg['problemCategories'].get(problem, [])}
    general = _norm(cfg['generalSpecialization'])

    tiers = {'EXACT': [], 'RELATED': [], 'GENERAL': []}
    for e in experts:
        if not is_eligible(e, cfg):
            continue
        specs = {_norm(s) for s in (e.get('specializations') or [])}
        if crop and crop in specs:
            tiers['EXACT'].append((e, f'Specializes in {crop}'))
        elif specs & related:
            tiers['RELATED'].append((e, 'Related specialization: ' + ', '.join(sorted(specs & related))))
        elif general in specs:
            tiers['GENERAL'].append((e, 'General agricultural expert'))

    ordered = []
    for tier in ('EXACT', 'RELATED', 'GENERAL'):
        tiers[tier].sort(key=lambda er: (int(er[0].get('activeConsultationCount') or 0),
                                         er[0].get('lastAssignedAt') or ''))
        ordered += [(e, tier, reason) for e, reason in tiers[tier]]
    return ordered


def _bump_workload(expert_id: str, delta: int):
    try:
        table('users').update_item(
            Key={'userId': expert_id},
            UpdateExpression='ADD activeConsultationCount :d SET lastAssignedAt = :t',
            ExpressionAttributeValues={':d': delta, ':t': now_iso()},
        )
    except Exception as e:
        print(f'workload update failed for {expert_id}: {e}')


def release_workload(expert_id: str | None):
    if not expert_id:
        return
    try:
        table('users').update_item(
            Key={'userId': expert_id},
            UpdateExpression='ADD activeConsultationCount :d',
            ConditionExpression=Attr('activeConsultationCount').gt(0),
            ExpressionAttributeValues={':d': -1},
        )
    except ClientError:
        pass


def _history_entry(expert: dict | None, tier: str, reason: str, by: str) -> dict:
    return {
        'expertId': expert['userId'] if expert else None,
        'expertName': expert.get('name') if expert else None,
        'tier': tier, 'reason': reason, 'by': by, 'at': now_iso(),
    }


def auto_assign(consultation: dict) -> tuple[dict, dict | None]:
    """Assign the best expert. Returns (updated consultation, expert or None)."""
    cfg = get_setting('assignment')
    candidates = rank_candidates(consultation, active_experts(), cfg)
    tbl = table('consultations')
    cid = consultation['consultationId']

    for expert, tier, reason in candidates:
        try:
            updated = tbl.update_item(
                Key={'consultationId': cid},
                UpdateExpression=(
                    'SET #s = :assigned, expertId = :eid, expertName = :ename, assignedAt = :now, '
                    'updatedAt = :now, assignmentTier = :tier, '
                    'assignmentHistory = list_append(if_not_exists(assignmentHistory, :empty), :h)'
                ),
                ConditionExpression='attribute_not_exists(expertId) AND #s IN (:s1, :s2)',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={
                    ':assigned': 'ASSIGNED', ':eid': expert['userId'], ':ename': expert.get('name', ''),
                    ':now': now_iso(), ':tier': tier, ':empty': [],
                    ':h': [_history_entry(expert, tier, reason, 'system')],
                    ':s1': ASSIGNABLE_STATUSES[0], ':s2': ASSIGNABLE_STATUSES[1],
                },
                ReturnValues='ALL_NEW',
            )['Attributes']
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                # Already assigned by a concurrent request — return current state.
                current = tbl.get_item(Key={'consultationId': cid}).get('Item') or consultation
                return current, None
            raise
        _bump_workload(expert['userId'], 1)
        return updated, expert

    # Priority 4: nobody eligible → admin queue (only if not already queued).
    if consultation.get('status') == 'AWAITING_ASSIGNMENT':
        return consultation, None
    updated = update_item(
        tbl, {'consultationId': cid},
        {'status': 'AWAITING_ASSIGNMENT', 'updatedAt': now_iso()},
        condition=Attr('status').eq('SUBMITTED') & Attr('expertId').not_exists(),
    )
    tbl.update_item(
        Key={'consultationId': cid},
        UpdateExpression='SET assignmentHistory = list_append(if_not_exists(assignmentHistory, :empty), :h)',
        ExpressionAttributeValues={':empty': [], ':h': [_history_entry(None, 'QUEUE', 'No eligible expert available', 'system')]},
    )
    return updated, None


def manual_assign(consultation: dict, expert: dict, actor: dict, reason: str) -> dict:
    if expert.get('role') != 'EXPERT' or expert.get('isActive') is False:
        raise HttpError(400, 'Selected user is not an active expert')
    status = consultation.get('status')
    if status not in ASSIGNABLE_STATUSES + ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'INFO_REQUIRED'):
        raise HttpError(409, f'Cannot reassign a consultation in status {status}')
    previous = consultation.get('expertId')
    if previous == expert['userId']:
        raise HttpError(409, 'Consultation is already assigned to this expert')

    cond = Attr('expertId').eq(previous) if previous else Attr('expertId').not_exists()
    updated = table('consultations').update_item(
        Key={'consultationId': consultation['consultationId']},
        UpdateExpression=(
            'SET #s = :assigned, expertId = :eid, expertName = :ename, assignedAt = :now, updatedAt = :now, '
            'assignmentTier = :tier, assignmentHistory = list_append(if_not_exists(assignmentHistory, :empty), :h)'
        ),
        ConditionExpression=cond,
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={
            ':assigned': 'ASSIGNED', ':eid': expert['userId'], ':ename': expert.get('name', ''),
            ':now': now_iso(), ':tier': 'MANUAL', ':empty': [],
            ':h': [_history_entry(expert, 'MANUAL', reason or 'Manual assignment', actor['userId'])],
        },
        ReturnValues='ALL_NEW',
    )['Attributes']
    release_workload(previous)
    _bump_workload(expert['userId'], 1)
    return updated
