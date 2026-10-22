"""
"Get Suggestions from Experts" — consultation requests.

POST   /consultations/upload-photo         – customer uploads a crop photo (private S3 key)
POST   /consultations                      – customer creates (submit, or saveAsDraft) — idempotent on idempotencyKey
GET    /consultations                      – role-scoped list (?status=&cursor=)
GET    /consultations/{id}                 – details (photo URLs are short-lived presigned links)
POST   /consultations/{id}/submit          – submit a draft
PUT    /consultations/{id}/status          – validated status transition {status, note}
POST   /consultations/{id}/messages        – thread message {text, requestInfo?}
POST   /consultations/{id}/recommendation  – expert recommendation {text, productIds[], followUpAt?, aiAssisted?}
POST   /consultations/{id}/assign          – admin manual (re)assignment {expertId?, reason}; no expertId re-runs auto-assign

Submitting creates the consultation AND its CRM lead in one DynamoDB
transaction. Both ids are derived from (customer, idempotencyKey), so a
retried submit returns the original records instead of creating duplicates.
"""
import os
import uuid
import base64
import binascii

import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from lib.db import table, client, encode_key, decode_key
from lib.router import run
from lib.permissions import (
    require_actor, require_permission, can_view_consultation, FARMER, EXPERT, ADMIN_ROLES,
)
from lib.assignment import auto_assign, manual_assign, release_workload
from lib.crm import activity_item, log_activity, pick_owner, advance_stage, search_text, UNASSIGNED
from lib.notify import notify_users, notify_roles
from lib.audit import audit
from lib.util import (
    HttpError, now_iso, stable_id, clean_str, update_item, user_summary,
)
from lib.response import ok, created, query_param, parse_body

PAGE_SIZE = 30
MAX_PHOTOS = 5
MAX_PHOTO_BYTES = 5 * 1024 * 1024
CONTENT_TYPES = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}
PHOTOS_BUCKET = os.environ.get('PHOTOS_BUCKET', '')

SEVERITIES = ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
PROBLEM_CATEGORIES = ('pest', 'disease', 'nutrient', 'soil', 'irrigation', 'weed', 'growth', 'other')
CONTACT_METHODS = ('IN_APP', 'CALL', 'WHATSAPP')
TERMINAL = ('RESOLVED', 'CLOSED', 'CANCELLED')

# status → statuses it may move to, per actor class.
TRANSITIONS = {
    'customer': {
        'DRAFT': {'CANCELLED'},
        'SUBMITTED': {'CANCELLED'},
        'AWAITING_ASSIGNMENT': {'CANCELLED'},
        'ASSIGNED': {'CANCELLED'},
        'RECOMMENDATION_PROVIDED': {'RESOLVED', 'IN_PROGRESS'},
        'FOLLOW_UP_SCHEDULED': {'RESOLVED'},
        'RESOLVED': {'CLOSED', 'IN_PROGRESS'},
    },
    'expert': {
        'ASSIGNED': {'ACCEPTED'},
        'ACCEPTED': {'IN_PROGRESS', 'INFO_REQUIRED'},
        'IN_PROGRESS': {'INFO_REQUIRED'},
        'INFO_REQUIRED': {'IN_PROGRESS'},
        'RECOMMENDATION_PROVIDED': {'FOLLOW_UP_SCHEDULED', 'RESOLVED', 'IN_PROGRESS'},
        'FOLLOW_UP_SCHEDULED': {'IN_PROGRESS', 'RESOLVED'},
        'RESOLVED': {'CLOSED'},
    },
}
ADMIN_TRANSITIONS = {
    s: set(targets) | {'CANCELLED'} for s, targets in {
        'SUBMITTED': set(), 'AWAITING_ASSIGNMENT': set(),
        'ASSIGNED': {'ACCEPTED'}, 'ACCEPTED': {'IN_PROGRESS', 'INFO_REQUIRED'},
        'IN_PROGRESS': {'INFO_REQUIRED'}, 'INFO_REQUIRED': {'IN_PROGRESS'},
        'RECOMMENDATION_PROVIDED': {'FOLLOW_UP_SCHEDULED', 'RESOLVED', 'IN_PROGRESS'},
        'FOLLOW_UP_SCHEDULED': {'IN_PROGRESS', 'RESOLVED'},
        'RESOLVED': {'CLOSED', 'IN_PROGRESS'},
    }.items()
}

_s3 = boto3.client('s3')


def handler(event, _ctx):
    return run(event, _route)


def _route(event, m, seg):
    if seg == ['upload-photo'] and m == 'POST':
        return _upload_photo(event)
    if not seg:
        if m == 'GET':  return _list(event)
        if m == 'POST': return _create(event)
        return None
    cid = seg[0]
    action = seg[1] if len(seg) > 1 else None
    if action is None and m == 'GET':      return _get(event, cid)
    if action == 'submit' and m == 'POST': return _submit_draft(event, cid)
    if action == 'status' and m == 'PUT':  return _set_status(event, cid)
    if action == 'messages' and m == 'POST': return _add_message(event, cid)
    if action == 'recommendation' and m == 'POST': return _recommend(event, cid)
    if action == 'assign' and m == 'POST': return _assign(event, cid)
    return None


# ── Photos ───────────────────────────────────────────────────────────────────

def _upload_photo(event):
    actor = require_permission(event, 'consultation.create')
    body = parse_body(event)
    content_type = (body.get('contentType') or 'image/jpeg').strip()
    if content_type not in CONTENT_TYPES:
        raise HttpError(400, f'contentType must be one of: {", ".join(CONTENT_TYPES)}')
    try:
        data = base64.b64decode(body.get('image') or '', validate=True)
    except (binascii.Error, ValueError):
        raise HttpError(400, 'invalid base64 image data')
    if not data:
        raise HttpError(400, 'image (base64) required')
    if len(data) > MAX_PHOTO_BYTES:
        raise HttpError(400, 'image too large (max 5MB)')
    key = f"consultations/{actor['userId']}/{uuid.uuid4()}.{CONTENT_TYPES[content_type]}"
    _s3.put_object(Bucket=PHOTOS_BUCKET, Key=key, Body=data, ContentType=content_type)
    return created({'key': key, 'url': _presign(key)})


def _presign(key: str) -> str:
    return _s3.generate_presigned_url('get_object', Params={'Bucket': PHOTOS_BUCKET, 'Key': key}, ExpiresIn=3600)


# ── Create / submit ─────────────────────────────────────────────────────────

def _fields_from_body(body: dict, actor: dict) -> dict:
    severity = (body.get('severity') or 'MEDIUM').upper()
    if severity not in SEVERITIES:
        raise HttpError(400, 'invalid severity')
    problem = (body.get('problemCategory') or '').lower()
    if problem not in PROBLEM_CATEGORIES:
        raise HttpError(400, f'problemCategory must be one of: {", ".join(PROBLEM_CATEGORIES)}')
    contact = (body.get('preferredContact') or 'IN_APP').upper()
    if contact not in CONTACT_METHODS:
        raise HttpError(400, 'invalid preferredContact')

    photo_keys = body.get('photoKeys') or []
    if not isinstance(photo_keys, list) or len(photo_keys) > MAX_PHOTOS:
        raise HttpError(400, f'at most {MAX_PHOTOS} photos allowed')
    prefix = f"consultations/{actor['userId']}/"
    for k in photo_keys:
        if not isinstance(k, str) or not k.startswith(prefix) or '..' in k:
            raise HttpError(400, 'invalid photo reference')

    fields = {
        'cropName':          clean_str(body, 'cropName', 80, required=True),
        'variety':           clean_str(body, 'variety', 80),
        'growthStage':       clean_str(body, 'growthStage', 80),
        'problemCategory':   problem,
        'symptoms':          clean_str(body, 'symptoms', 3000, required=True),
        'severity':          severity,
        'affectedArea':      clean_str(body, 'affectedArea', 80),
        'farmLocation':      clean_str(body, 'farmLocation', 200),
        'soilInfo':          clean_str(body, 'soilInfo', 500),
        'irrigationInfo':    clean_str(body, 'irrigationInfo', 500),
        'previousTreatments': clean_str(body, 'previousTreatments', 1000),
        'comments':          clean_str(body, 'comments', 1000),
        'preferredContact':  contact,
        'photoKeys':         photo_keys,
        'cycleId':           clean_str(body, 'cycleId', 64),
        'landId':            clean_str(body, 'landId', 64),
    }
    if fields['cycleId']:
        cycle = table('crop_cycles').query(
            IndexName='CycleIdIndex', KeyConditionExpression=Key('cycleId').eq(fields['cycleId']), Limit=1,
        ).get('Items')
        if not cycle or cycle[0].get('farmerId') != actor['userId']:
            raise HttpError(400, 'Crop not found')
        fields['landId'] = cycle[0].get('landId', '')
    return fields


def _lead_for(consultation: dict, actor: dict, owner: dict | None) -> dict:
    now = consultation['createdAt']
    priority = {'LOW': 'LOW', 'MEDIUM': 'MEDIUM', 'HIGH': 'HIGH', 'CRITICAL': 'URGENT'}[consultation['severity']]
    location = consultation.get('farmLocation') or ', '.join(
        p for p in (actor.get('village'), actor.get('district')) if p)
    lead = {
        'leadId':        stable_id('lead', consultation['consultationId']),
        'customerId':    actor['userId'],
        'customerName':  actor.get('name', ''),
        'phone':         actor.get('phone', ''),
        'email':         actor.get('email') or None,
        'location':      location or '-',
        'source':        'EXPERT_CONSULTATION',
        'requirement':   f"{consultation['cropName']}: {consultation['symptoms'][:300]}",
        'cropName':      consultation['cropName'],
        'stage':         'EXPERT_CONSULTATION',
        'priority':      priority,
        'ownerId':       owner['userId'] if owner else UNASSIGNED,
        'ownerName':     owner.get('name') if owner else None,
        'consultationId': consultation['consultationId'],
        'createdBy':     'system',
        'createdAt':     now,
        'updatedAt':     now,
        'lastActivityAt': now,
    }
    lead['searchText'] = search_text(lead)
    return lead


def _strip_none(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None and v != ''}


def _create(event):
    actor = require_permission(event, 'consultation.create')
    body = parse_body(event)
    idem = clean_str(body, 'idempotencyKey', 100, required=True)
    fields = _fields_from_body(body, actor)
    cid = stable_id('consultation', actor['userId'], idem)

    existing = table('consultations').get_item(Key={'consultationId': cid}).get('Item')
    if existing:
        return ok(_present(existing, actor))

    now = now_iso()
    consultation = {
        'consultationId': cid,
        'customerId':     actor['userId'],
        'customerName':   actor.get('name', ''),
        **fields,
        'status':         'DRAFT' if body.get('saveAsDraft') else 'SUBMITTED',
        'messages':       [],
        'createdAt':      now,
        'updatedAt':      now,
    }
    if consultation['status'] == 'DRAFT':
        try:
            table('consultations').put_item(Item=_strip_none(consultation),
                                            ConditionExpression='attribute_not_exists(consultationId)')
        except ClientError as e:
            if e.response['Error']['Code'] != 'ConditionalCheckFailedException':
                raise
        return created(_present(consultation, actor))

    consultation['submittedAt'] = now
    result = _submit(consultation, actor, is_new=True)
    return created(_present(result, actor))


def _submit_draft(event, cid):
    actor = require_permission(event, 'consultation.create')
    c = _load(cid)
    if c['customerId'] != actor['userId']:
        raise HttpError(403, 'Access denied')
    if c['status'] != 'DRAFT':
        return ok(_present(c, actor))  # already submitted — idempotent
    c['submittedAt'] = now_iso()
    return ok(_present(_submit(c, actor, is_new=False), actor))


def _submit(consultation: dict, actor: dict, is_new: bool) -> dict:
    owner = pick_owner()
    lead = _lead_for(consultation, actor, owner)
    consultation.update({
        'status': 'SUBMITTED', 'leadId': lead['leadId'], 'leadOwnerId': lead['ownerId'],
        'updatedAt': consultation['submittedAt'],
    })
    act = activity_item(lead['leadId'], 'CONSULTATION', actor,
                        f"Expert consultation requested for {consultation['cropName']} ({consultation['problemCategory']}, {consultation['severity']})",
                        {'consultationId': consultation['consultationId']}, ts=consultation['submittedAt'])

    if is_new:
        c_op = {'Put': {
            'TableName': table('consultations').name, 'Item': _strip_none(consultation),
            'ConditionExpression': 'attribute_not_exists(consultationId)',
        }}
    else:
        c_op = {'Update': {
            'TableName': table('consultations').name,
            'Key': {'consultationId': consultation['consultationId']},
            'UpdateExpression': 'SET #s = :s, leadId = :l, leadOwnerId = :o, submittedAt = :t, updatedAt = :t',
            'ConditionExpression': '#s = :draft',
            'ExpressionAttributeNames': {'#s': 'status'},
            'ExpressionAttributeValues': {':s': 'SUBMITTED', ':l': lead['leadId'], ':o': lead['ownerId'],
                                          ':t': consultation['submittedAt'], ':draft': 'DRAFT'},
        }}
    try:
        client().transact_write_items(TransactItems=[
            c_op,
            {'Put': {'TableName': table('leads').name, 'Item': _strip_none(lead),
                     'ConditionExpression': 'attribute_not_exists(leadId)'}},
            {'Put': {'TableName': table('lead_activities').name, 'Item': act}},
        ])
    except ClientError as e:
        if e.response['Error']['Code'] == 'TransactionCanceledException':
            # A concurrent retry with the same idempotency key won the race.
            current = table('consultations').get_item(Key={'consultationId': consultation['consultationId']}).get('Item')
            if current:
                return current
        raise

    audit(actor, 'CONSULTATION_SUBMITTED', 'consultation', consultation['consultationId'], {'leadId': lead['leadId']})
    return _after_submit(consultation, lead, actor)


def _after_submit(consultation: dict, lead: dict, actor: dict) -> dict:
    """Assignment + notifications. Failures here leave a valid SUBMITTED request
    that the escalation job / an admin can still assign."""
    try:
        consultation, expert = auto_assign(consultation)
    except Exception as e:
        print(f'auto-assign failed: {e}')
        return consultation

    crop = consultation['cropName']
    link = f"consultation/{consultation['consultationId']}"
    if expert:
        table('leads').update_item(
            Key={'leadId': lead['leadId']},
            UpdateExpression='SET expertId = :e, expertName = :n',
            ExpressionAttributeValues={':e': expert['userId'], ':n': expert.get('name', '')},
        )
        log_activity(lead['leadId'], 'ASSIGNMENT', None,
                     f"Expert {expert.get('name')} auto-assigned ({consultation.get('assignmentTier')})")
        notify_users([expert['userId']], 'New consultation assigned',
                     f"{actor.get('name', 'A customer')} needs help with {crop}: {consultation['symptoms'][:140]}",
                     'ASSIGNMENT', link, 'HIGH' if consultation['severity'] in ('HIGH', 'CRITICAL') else 'NORMAL')
        notify_users([actor['userId']], 'Expert assigned',
                     f"{expert.get('name')} will review your {crop} request.", 'CONSULTATION', link)
    else:
        notify_roles(['ADMIN', 'SUPER_ADMIN'], 'Consultation awaiting assignment',
                     f"No eligible expert for {crop} ({consultation['problemCategory']}). Please assign manually.",
                     'ESCALATION', link)
    if lead['ownerId'] != UNASSIGNED:
        notify_users([lead['ownerId']], 'New consultation lead',
                     f"{actor.get('name', 'Customer')} — {crop}. Lead assigned to you.", 'CRM_TASK', f"lead/{lead['leadId']}")
    return consultation


# ── Read ────────────────────────────────────────────────────────────────────

def _load(cid: str) -> dict:
    c = table('consultations').get_item(Key={'consultationId': cid}).get('Item')
    if not c:
        raise HttpError(404, 'Consultation not found')
    return c


def _load_visible(actor: dict, cid: str) -> dict:
    c = _load(cid)
    if not can_view_consultation(actor, c):
        raise HttpError(403, 'Access denied')
    return c


def _present(c: dict, actor: dict, detail: bool = False) -> dict:
    out = dict(c)
    out['photoUrls'] = [_presign(k) for k in c.get('photoKeys', [])] if detail else []
    if actor['role'] == FARMER:
        # Internal routing data is not for customers.
        for k in ('leadId', 'leadOwnerId', 'assignmentHistory', 'assignmentTier', 'escalatedAt', 'workloadReleased'):
            out.pop(k, None)
        out['messages'] = [m for m in c.get('messages', []) if not m.get('internal')]
    return out


def _list(event):
    actor = require_actor(event)
    status = (query_param(event, 'status') or '').upper() or None
    cursor = decode_key(query_param(event, 'cursor'))
    tbl = table('consultations')
    kwargs = {'Limit': PAGE_SIZE}
    if cursor:
        kwargs['ExclusiveStartKey'] = cursor

    role = actor['role']
    if role in (FARMER, EXPERT):
        index, attr = ('CustomerIndex', 'customerId') if role == FARMER else ('ExpertIndex', 'expertId')
        kwargs.update(IndexName=index, KeyConditionExpression=Key(attr).eq(actor['userId']), ScanIndexForward=False)
        if status:
            kwargs['FilterExpression'] = Attr('status').eq(status)
        resp = tbl.query(**kwargs)
    elif role in ADMIN_ROLES:
        if status:
            kwargs.update(IndexName='StatusIndex', KeyConditionExpression=Key('status').eq(status), ScanIndexForward=False)
            resp = tbl.query(**kwargs)
        else:
            resp = tbl.scan(**kwargs)
    else:  # STAFF — through the leads they handle
        f = Attr('leadOwnerId').is_in([actor['userId'], UNASSIGNED])
        if status:
            f = f & Attr('status').eq(status)
        resp = tbl.scan(FilterExpression=f, **kwargs)

    items = sorted(resp.get('Items', []), key=lambda c: c.get('createdAt', ''), reverse=True)
    return ok({
        'items': [_present(c, actor) for c in items],
        'nextCursor': encode_key(resp.get('LastEvaluatedKey')),
    })


def _get(event, cid):
    actor = require_actor(event)
    c = _load_visible(actor, cid)
    out = _present(c, actor, detail=True)
    if actor['role'] != FARMER:
        customer = table('users').get_item(Key={'userId': c['customerId']}).get('Item')
        out['customer'] = user_summary(customer)
        if customer:
            out['customer'].update({k: customer.get(k) for k in ('village', 'district') if customer.get(k)})
    elif c.get('expertId'):
        expert = table('users').get_item(Key={'userId': c['expertId']}).get('Item') or {}
        out['expert'] = {k: expert.get(k) for k in ('name', 'qualifications', 'experienceYears', 'specializations')
                         if expert.get(k)}
    if c.get('recommendation', {}).get('productIds'):
        out['recommendedProducts'] = _products(c['recommendation']['productIds'])
    return ok(out)


def _products(ids: list) -> list:
    out = []
    for pid in ids[:20]:
        p = table('products').get_item(Key={'productId': pid}).get('Item')
        if p:
            out.append({k: p.get(k) for k in ('productId', 'name', 'unit', 'price', 'imageUrl', 'category')})
    return out


# ── Workflow ────────────────────────────────────────────────────────────────

def _actor_class(actor: dict, c: dict) -> str:
    if actor['role'] == FARMER:
        return 'customer'
    if actor['role'] in ADMIN_ROLES:
        return 'admin'
    if actor['role'] == EXPERT and c.get('expertId') == actor['userId']:
        return 'expert'
    raise HttpError(403, 'Access denied')


def _allowed_targets(actor_class: str, status: str) -> set:
    if actor_class == 'admin':
        return ADMIN_TRANSITIONS.get(status, set())
    return TRANSITIONS[actor_class].get(status, set())


def _transition(c: dict, new_status: str, actor: dict, note: str = '', extra: dict | None = None) -> dict:
    old = c['status']
    updates = {'status': new_status, 'updatedAt': now_iso(), **(extra or {})}
    if new_status in TERMINAL and c.get('expertId') and not c.get('workloadReleased'):
        updates['workloadReleased'] = True
    reopened = old in TERMINAL and new_status not in TERMINAL and c.get('workloadReleased')
    if reopened:
        updates['workloadReleased'] = False
    if new_status in ('RESOLVED', 'CLOSED'):
        updates[f'{new_status.lower()}At'] = now_iso()
    updated = update_item(table('consultations'), {'consultationId': c['consultationId']}, updates,
                          condition=Attr('status').eq(old))
    if updates.get('workloadReleased') is True:
        release_workload(c.get('expertId'))
    elif reopened and c.get('expertId'):
        table('users').update_item(Key={'userId': c['expertId']},
                                   UpdateExpression='ADD activeConsultationCount :one',
                                   ExpressionAttributeValues={':one': 1})
    if c.get('leadId'):
        log_activity(c['leadId'], 'CONSULTATION', actor,
                     f'Consultation status {old} → {new_status}' + (f': {note}' if note else ''))
    return updated


def _set_status(event, cid):
    actor = require_actor(event)
    c = _load_visible(actor, cid)
    body = parse_body(event)
    new_status = (body.get('status') or '').upper()
    note = clean_str(body, 'note', 1000)
    klass = _actor_class(actor, c)
    if new_status not in _allowed_targets(klass, c['status']):
        raise HttpError(409, f"Cannot change status from {c['status']} to {new_status}")

    updated = _transition(c, new_status, actor, note)
    audit(actor, 'CONSULTATION_STATUS', 'consultation', cid, {'from': c['status'], 'to': new_status})

    link = f'consultation/{cid}'
    if klass != 'customer':
        notify_users([c['customerId']], 'Consultation update',
                     f"Your {c['cropName']} request is now {new_status.replace('_', ' ').lower()}.", 'CONSULTATION', link)
    elif c.get('expertId'):
        notify_users([c['expertId']], 'Consultation update',
                     f"{c.get('customerName', 'Customer')} marked the {c['cropName']} request {new_status.lower()}.",
                     'CONSULTATION', link)
    return ok(_present(updated, actor, detail=True))


def _add_message(event, cid):
    actor = require_actor(event)
    c = _load_visible(actor, cid)
    if c['status'] in ('CLOSED', 'CANCELLED', 'DRAFT'):
        raise HttpError(409, 'This consultation is not open for messages')
    body = parse_body(event)
    text = clean_str(body, 'text', 3000, required=True)
    klass = 'staff' if actor['role'] == 'STAFF' else _actor_class(actor, c)
    internal = bool(body.get('internal')) and klass != 'customer'
    msg = {'by': actor['userId'], 'byName': actor.get('name', ''), 'role': actor['role'],
           'text': text, 'at': now_iso(), 'internal': internal}

    table('consultations').update_item(
        Key={'consultationId': cid},
        UpdateExpression='SET messages = list_append(if_not_exists(messages, :e), :m), updatedAt = :t',
        ExpressionAttributeValues={':e': [], ':m': [msg], ':t': msg['at']},
    )
    c['messages'] = c.get('messages', []) + [msg]

    if body.get('requestInfo') and klass in ('expert', 'admin') and 'INFO_REQUIRED' in _allowed_targets(klass, c['status']):
        c = _transition(c, 'INFO_REQUIRED', actor, 'Additional information requested')
    elif klass == 'customer' and c['status'] == 'INFO_REQUIRED':
        c = _transition(c, 'IN_PROGRESS', actor, 'Customer provided information')

    link = f'consultation/{cid}'
    if klass == 'customer':
        notify_users([c.get('expertId')], 'Customer replied', f"{actor.get('name')}: {text[:140]}", 'CONSULTATION', link)
    elif not internal:
        notify_users([c['customerId']], 'New message on your consultation', text[:160], 'CONSULTATION', link)
    return ok(_present(_load(cid), actor, detail=True))


def _recommend(event, cid):
    actor = require_permission(event, 'consultation.recommend')
    c = _load_visible(actor, cid)
    klass = _actor_class(actor, c)
    if c['status'] not in ('ACCEPTED', 'IN_PROGRESS', 'INFO_REQUIRED', 'RECOMMENDATION_PROVIDED', 'FOLLOW_UP_SCHEDULED'):
        raise HttpError(409, 'Accept the consultation before providing a recommendation')
    body = parse_body(event)
    text = clean_str(body, 'text', 6000, required=True)
    product_ids = [p for p in (body.get('productIds') or []) if isinstance(p, str)][:20]
    valid_products = _products(product_ids)
    recommendation = {
        'text': text,
        'productIds': [p['productId'] for p in valid_products],
        'by': actor['userId'], 'byName': actor.get('name', ''),
        'aiAssisted': bool(body.get('aiAssisted')),  # expert confirmed review by submitting
        'at': now_iso(),
    }
    follow_up = clean_str(body, 'followUpAt', 30)
    new_status = 'FOLLOW_UP_SCHEDULED' if follow_up else 'RECOMMENDATION_PROVIDED'
    extra = {'recommendation': recommendation}
    if follow_up:
        extra['followUpAt'] = follow_up

    updated = update_item(table('consultations'), {'consultationId': cid},
                          {'status': new_status, 'updatedAt': now_iso(), **extra},
                          condition=Attr('status').eq(c['status']))
    audit(actor, 'CONSULTATION_RECOMMENDATION', 'consultation', cid, {'products': len(valid_products), 'by': klass})

    if c.get('leadId'):
        log_activity(c['leadId'], 'CONSULTATION', actor,
                     f"Recommendation provided{' with ' + str(len(valid_products)) + ' product(s)' if valid_products else ''}",
                     {'productIds': recommendation['productIds']})
        advance_stage(c['leadId'], 'RECOMMENDATION_PROVIDED', actor, 'Expert recommendation provided')
        lead = table('leads').get_item(Key={'leadId': c['leadId']}).get('Item') or {}
        if valid_products and lead.get('ownerId') not in (None, UNASSIGNED):
            notify_users([lead['ownerId']], 'Products recommended — prepare quotation',
                         f"{actor.get('name')} recommended {len(valid_products)} product(s) for {c.get('customerName')}.",
                         'CRM_TASK', f"lead/{c['leadId']}")
    if follow_up and c.get('expertId'):
        from lib.tasks import create_task_record
        create_task_record({
            'kind': 'FOLLOW_UP', 'title': f"Follow up: {c['cropName']} — {c.get('customerName', '')}",
            'assigneeId': c['expertId'], 'dueAt': follow_up, 'leadId': c.get('leadId'),
            'consultationId': cid, 'customerId': c['customerId'], 'priority': 'MEDIUM',
        }, actor)
    notify_users([c['customerId']], 'Recommendation ready',
                 f"Your expert has responded to your {c['cropName']} request.", 'CONSULTATION', f'consultation/{cid}')
    return ok(_present(updated, actor, detail=True))


def _assign(event, cid):
    actor = require_permission(event, 'consultation.assign')
    c = _load(cid)
    body = parse_body(event)
    expert_id = clean_str(body, 'expertId', 64)
    reason = clean_str(body, 'reason', 300)

    if not expert_id:
        if c.get('expertId'):
            raise HttpError(409, 'Already assigned — choose an expert to reassign')
        updated, expert = auto_assign(c)
        if not expert:
            raise HttpError(409, 'No eligible expert is available. Choose one manually.')
    else:
        expert = table('users').get_item(Key={'userId': expert_id}).get('Item')
        if not expert:
            raise HttpError(404, 'Expert not found')
        updated = manual_assign(c, expert, actor, reason)
        if c.get('expertId'):
            notify_users([c['expertId']], 'Consultation reassigned',
                         f"The {c['cropName']} request from {c.get('customerName')} was reassigned.", 'ASSIGNMENT')

    if c.get('leadId'):
        table('leads').update_item(
            Key={'leadId': c['leadId']},
            UpdateExpression='SET expertId = :e, expertName = :n, updatedAt = :t',
            ExpressionAttributeValues={':e': expert['userId'], ':n': expert.get('name', ''), ':t': now_iso()},
        )
        log_activity(c['leadId'], 'ASSIGNMENT', actor, f"Expert {expert.get('name')} assigned" + (f': {reason}' if reason else ''))
    audit(actor, 'CONSULTATION_ASSIGNED', 'consultation', cid,
          {'from': c.get('expertId'), 'to': expert['userId'], 'reason': reason or None})
    notify_users([expert['userId']], 'Consultation assigned to you',
                 f"{c.get('customerName')} — {c['cropName']}: {c['symptoms'][:120]}", 'ASSIGNMENT', f'consultation/{cid}')
    return ok(_present(updated, actor, detail=True))
