"""
Shared CRM for SUPER_ADMIN, ADMIN, STAFF and EXPERT (record-level filtered).

GET  /crm/dashboard                      – role-scoped metrics from live data
GET  /crm/pipeline                       – leads grouped by stage (role-scoped)
GET  /crm/reports                        – conversion by source / owner, quotation funnel
GET  /crm/activities                     – recent activity feed (?mine=1)
GET  /crm/leads                          – ?view=mine|pool|all|expert &stage= &source= &q= &cursor=
POST /crm/leads                          – manual lead (409 + duplicates unless force=true)
GET  /crm/leads/duplicates?phone=
GET  /crm/leads/{id}                     – lead + activities + consultation + quotations + tasks
PUT  /crm/leads/{id}                     – edit details
PUT  /crm/leads/{id}/stage               – {stage, reason}
PUT  /crm/leads/{id}/owner               – {ownerId}; staff may claim an UNASSIGNED lead for themselves
PUT  /crm/leads/{id}/expert              – {expertId}
POST /crm/leads/{id}/notes               – {text}
POST /crm/leads/{id}/calls               – {outcome, notes?, durationSec?, nextFollowUpAt?}
POST /crm/leads/{id}/whatsapp            – {kind, text?} → click-to-chat URL + logged share attempt
GET  /crm/customers/{customerId}         – customer care profile (leads, consultations, quotations)

Call and WhatsApp records reflect what the user did/reported in the app. No
telephony or WhatsApp Business provider is connected, so the API never marks a
call as completed or a message as delivered on its own.
"""
import time
from urllib.parse import quote

from boto3.dynamodb.conditions import Key, Attr

from lib.db import table, encode_key, decode_key
from lib.router import run
from lib.permissions import (
    require_permission, has_permission, can_view_lead, can_edit_lead, ensure,
    ADMIN_ROLES, EXPERT, STAFF,
)
from lib.crm import (
    STAGES, SOURCES, PRIORITIES, CLOSED_STAGES, UNASSIGNED,
    get_lead, log_activity, change_stage, sync_lead_owner_to_consultations, search_text,
)
from lib.tasks import create_task_record
from lib.notify import notify_users
from lib.audit import audit
from lib.util import (
    HttpError, now_iso, new_id, clean_str, normalize_phone, update_item, query_all, scan_all,
    to_decimal, EMAIL_RE, iso_in,
)
from lib.response import ok, created, _json, query_param, parse_body

PAGE_SIZE = 30
CALL_OUTCOMES = ('DIALER_OPENED', 'CONNECTED', 'NO_ANSWER', 'BUSY', 'SWITCHED_OFF', 'WRONG_NUMBER',
                 'CALLBACK_REQUESTED', 'NOT_INTERESTED')
WHATSAPP_KINDS = ('GREETING', 'FOLLOW_UP', 'CONSULTATION_SUMMARY', 'CUSTOM')
LEAD_SUMMARY_FIELDS = ('leadId', 'customerName', 'phone', 'location', 'source', 'stage', 'priority', 'ownerId',
                       'ownerName', 'expertId', 'expertName', 'cropName', 'requirement', 'createdAt', 'updatedAt',
                       'lastActivityAt', 'consultationId', 'customerId', 'budget')


def handler(event, _ctx):
    return run(event, _route)


def _route(event, m, seg):
    if not seg:
        return None
    head, rest = seg[0], seg[1:]
    if head == 'dashboard' and m == 'GET':  return _dashboard(event)
    if head == 'pipeline' and m == 'GET':   return _pipeline(event)
    if head == 'reports' and m == 'GET':    return _reports(event)
    if head == 'activities' and m == 'GET': return _activities(event)
    if head == 'customers' and len(rest) == 1 and m == 'GET': return _customer(event, rest[0])
    if head != 'leads':
        return None
    if not rest:
        if m == 'GET':  return _list(event)
        if m == 'POST': return _create(event)
        return None
    if rest == ['duplicates'] and m == 'GET':
        return _duplicates_route(event)
    lid, action = rest[0], (rest[1] if len(rest) > 1 else None)
    if action is None:
        if m == 'GET': return _get(event, lid)
        if m == 'PUT': return _update(event, lid)
    if action == 'stage' and m == 'PUT':    return _stage(event, lid)
    if action == 'owner' and m == 'PUT':    return _owner(event, lid)
    if action == 'expert' and m == 'PUT':   return _expert(event, lid)
    if action == 'notes' and m == 'POST':   return _note(event, lid)
    if action == 'calls' and m == 'POST':   return _call(event, lid)
    if action == 'whatsapp' and m == 'POST': return _whatsapp(event, lid)
    return None


# ── Scope helpers ───────────────────────────────────────────────────────────

def _summary(lead: dict) -> dict:
    return {k: lead[k] for k in LEAD_SUMMARY_FIELDS if k in lead}


def _scoped_leads(actor: dict) -> list[dict]:
    """Every lead the actor may see (used for dashboards / pipeline)."""
    tbl = table('leads')
    if has_permission(actor, 'crm.view_all'):
        return scan_all(tbl)
    if actor['role'] == EXPERT:
        return query_all(tbl, IndexName='ExpertIndex', KeyConditionExpression=Key('expertId').eq(actor['userId']))
    mine = query_all(tbl, IndexName='OwnerIndex', KeyConditionExpression=Key('ownerId').eq(actor['userId']))
    pool = query_all(tbl, IndexName='OwnerIndex', KeyConditionExpression=Key('ownerId').eq(UNASSIGNED))
    return mine + pool


def _load_visible(actor: dict, lead_id: str) -> dict:
    lead = get_lead(lead_id)
    if not can_view_lead(actor, lead):
        raise HttpError(403, 'Access denied')
    return lead


def _load_editable(actor: dict, lead_id: str) -> dict:
    lead = get_lead(lead_id)
    if not can_edit_lead(actor, lead):
        raise HttpError(403, 'You cannot modify this lead')
    return lead


# ── List / create ───────────────────────────────────────────────────────────

def _list(event):
    actor = require_permission(event, 'crm.view')
    view = query_param(event, 'view') or ('expert' if actor['role'] == EXPERT else 'mine')
    stage = (query_param(event, 'stage') or '').upper()
    source = (query_param(event, 'source') or '').upper()
    q = (query_param(event, 'q') or '').strip().lower()
    cursor = decode_key(query_param(event, 'cursor'))
    tbl = table('leads')

    kwargs = {'Limit': PAGE_SIZE}
    if cursor:
        kwargs['ExclusiveStartKey'] = cursor
    if actor['role'] == EXPERT or view == 'expert':
        kwargs.update(IndexName='ExpertIndex', KeyConditionExpression=Key('expertId').eq(actor['userId']))
    elif view == 'all':
        if not has_permission(actor, 'crm.view_all'):
            raise HttpError(403, 'Access denied')
        if stage:
            kwargs.update(IndexName='StageIndex', KeyConditionExpression=Key('stage').eq(stage))
            stage = ''
    elif view == 'pool':
        kwargs.update(IndexName='OwnerIndex', KeyConditionExpression=Key('ownerId').eq(UNASSIGNED))
    else:
        kwargs.update(IndexName='OwnerIndex', KeyConditionExpression=Key('ownerId').eq(actor['userId']))

    filters = []
    if stage:
        filters.append(Attr('stage').eq(stage))
    if source == 'MANUAL':
        filters.append(Attr('source').ne('EXPERT_CONSULTATION'))
    elif source:
        filters.append(Attr('source').eq(source))
    if q:
        filters.append(Attr('searchText').contains(q) | Attr('phone').contains(q))
    if filters:
        f = filters[0]
        for x in filters[1:]:
            f = f & x
        kwargs['FilterExpression'] = f
    if 'KeyConditionExpression' in kwargs:
        kwargs['ScanIndexForward'] = False
        resp = tbl.query(**kwargs)
    else:
        resp = tbl.scan(**kwargs)
    items = sorted(resp.get('Items', []), key=lambda l: l.get('createdAt', ''), reverse=True)
    return ok({'items': [_summary(l) for l in items], 'nextCursor': encode_key(resp.get('LastEvaluatedKey'))})


def _find_duplicates(phone: str) -> list[dict]:
    leads = query_all(table('leads'), IndexName='PhoneIndex', KeyConditionExpression=Key('phone').eq(phone))
    return [_summary(l) for l in leads if l.get('stage') not in CLOSED_STAGES]


def _duplicates_route(event):
    require_permission(event, 'lead.create')
    phone = normalize_phone(query_param(event, 'phone') or '')
    return ok({'items': _find_duplicates(phone)})


def _resolve_user(user_id: str, role: str, label: str) -> dict:
    user = table('users').get_item(Key={'userId': user_id}).get('Item')
    if not user or user.get('isActive') is False or (role and user.get('role') not in (role if isinstance(role, tuple) else (role,))):
        raise HttpError(400, f'{label} must be an active team member')
    return user


def _create(event):
    actor = require_permission(event, 'lead.create')
    body = parse_body(event)
    phone = normalize_phone(clean_str(body, 'phone', 20, required=True))
    source = (body.get('source') or '').upper()
    if source not in SOURCES:
        raise HttpError(400, f'source must be one of: {", ".join(SOURCES)}')
    priority = (body.get('priority') or 'MEDIUM').upper()
    if priority not in PRIORITIES:
        raise HttpError(400, 'invalid priority')
    email = clean_str(body, 'email', 120).lower()
    if email and not EMAIL_RE.match(email):
        raise HttpError(400, 'invalid email address')

    if not body.get('force'):
        dups = _find_duplicates(phone)
        if dups:
            return _json(409, {'error': 'Possible duplicate lead', 'duplicates': dups})

    # Owner: staff own what they create; admins may pick anyone (or leave in pool).
    owner = None
    owner_id = clean_str(body, 'ownerId', 64)
    if owner_id and owner_id != UNASSIGNED:
        if owner_id != actor['userId'] and not has_permission(actor, 'lead.assign'):
            raise HttpError(403, 'You cannot assign leads to others')
        owner = _resolve_user(owner_id, (STAFF,) + ADMIN_ROLES, 'Owner')
    elif actor['role'] == STAFF:
        owner = actor
    expert = None
    if body.get('expertId'):
        expert = _resolve_user(body['expertId'], EXPERT, 'Expert')

    customer = table('users').query(IndexName='PhoneIndex', KeyConditionExpression=Key('phone').eq(phone), Limit=1).get('Items')
    customer = customer[0] if customer and customer[0].get('role') == 'FARMER' else None

    now = now_iso()
    lead = {
        'leadId':       new_id(),
        'customerName': clean_str(body, 'customerName', 120, required=True),
        'phone':        phone,
        'location':     clean_str(body, 'location', 200, required=True),
        'source':       source,
        'requirement':  clean_str(body, 'requirement', 2000, required=True),
        'priority':     priority,
        'stage':        'NEW',
        'ownerId':      owner['userId'] if owner else UNASSIGNED,
        'ownerName':    owner.get('name') if owner else None,
        'expertId':     expert['userId'] if expert else None,
        'expertName':   expert.get('name') if expert else None,
        'customerId':   customer['userId'] if customer else None,
        'email':        email or None,
        'cropName':     clean_str(body, 'cropName', 80) or None,
        'farmSize':     clean_str(body, 'farmSize', 50) or None,
        'productInterest': clean_str(body, 'productInterest', 500) or None,
        'notes':        clean_str(body, 'notes', 2000) or None,
        'createdBy':    actor['userId'],
        'createdByName': actor.get('name', ''),
        'createdAt':    now,
        'updatedAt':    now,
        'lastActivityAt': now,
    }
    if body.get('budget') not in (None, ''):
        lead['budget'] = to_decimal(body['budget'], 'budget', minimum=0)
    lead['searchText'] = search_text(lead)
    lead = {k: v for k, v in lead.items() if v is not None}
    table('leads').put_item(Item=lead, ConditionExpression='attribute_not_exists(leadId)')

    log_activity(lead['leadId'], 'CREATED', actor, f"Lead created manually (source: {source.replace('_', ' ').title()})")
    audit(actor, 'LEAD_CREATED', 'lead', lead['leadId'], {'source': source})
    if body.get('nextFollowUpAt'):
        create_task_record({
            'kind': 'FOLLOW_UP', 'title': f"Follow up with {lead['customerName']}", 'dueAt': body['nextFollowUpAt'],
            'assigneeId': lead['ownerId'] if lead['ownerId'] != UNASSIGNED else actor['userId'],
            'leadId': lead['leadId'], 'customerName': lead['customerName'], 'priority': priority,
            'followUpType': (body.get('followUpType') or 'CALL'),
        }, actor)
    if owner and owner['userId'] != actor['userId']:
        notify_users([owner['userId']], 'New lead assigned', f"{lead['customerName']} — {lead['requirement'][:120]}",
                     'CRM_TASK', f"lead/{lead['leadId']}")
    if expert:
        notify_users([expert['userId']], 'You were added to a lead', f"{lead['customerName']} — {lead['requirement'][:120]}",
                     'CRM_TASK', f"lead/{lead['leadId']}")
    return created(lead)


# ── Detail / edit ───────────────────────────────────────────────────────────

def _get(event, lead_id):
    actor = require_permission(event, 'crm.view')
    lead = _load_visible(actor, lead_id)
    acts = table('lead_activities').query(
        KeyConditionExpression=Key('leadId').eq(lead_id), ScanIndexForward=False, Limit=100,
    ).get('Items', [])
    quotes = table('quotations').query(
        IndexName='LeadIndex', KeyConditionExpression=Key('leadId').eq(lead_id), ScanIndexForward=False,
    ).get('Items', []) if has_permission(actor, 'quotation.view') else []
    tasks = table('tasks').query(IndexName='LeadIndex', KeyConditionExpression=Key('leadId').eq(lead_id)).get('Items', [])
    consultations = []
    if lead.get('consultationId'):
        c = table('consultations').get_item(Key={'consultationId': lead['consultationId']}).get('Item')
        if c:
            consultations.append({k: c.get(k) for k in ('consultationId', 'cropName', 'problemCategory', 'severity',
                                                         'status', 'expertName', 'createdAt', 'symptoms')})
    if lead.get('customerId'):
        other = query_all(table('consultations'), IndexName='CustomerIndex',
                          KeyConditionExpression=Key('customerId').eq(lead['customerId']), max_items=20)
        seen = {c['consultationId'] for c in consultations}
        consultations += [{k: c.get(k) for k in ('consultationId', 'cropName', 'problemCategory', 'severity', 'status',
                                                 'expertName', 'createdAt')}
                          for c in other if c['consultationId'] not in seen and c.get('status') != 'DRAFT']

    now = now_iso()
    out = dict(lead)
    out.pop('searchText', None)
    out.update({
        'activities': acts,
        'quotations': [{k: q.get(k) for k in ('quotationId', 'quotationNumber', 'status', 'grandTotal', 'createdAt',
                                               'validUntil')} for q in quotes],
        'tasks': sorted([{**t, 'isOverdue': t.get('status') == 'OPEN' and t.get('dueAt', '') < now} for t in tasks],
                        key=lambda t: t.get('dueAt', '')),
        'consultations': consultations,
        'permissions': {
            'edit': can_edit_lead(actor, lead),
            'assign': has_permission(actor, 'lead.assign'),
            'quote': has_permission(actor, 'quotation.create'),
            'communicate': has_permission(actor, 'lead.communicate'),
            'claim': lead.get('ownerId') == UNASSIGNED and actor['role'] == STAFF,
        },
    })
    return ok(out)


def _update(event, lead_id):
    actor = require_permission(event, 'lead.edit')
    lead = _load_editable(actor, lead_id)
    body = parse_body(event)
    updates = {}
    for k, n in (('customerName', 120), ('location', 200), ('requirement', 2000), ('cropName', 80),
                 ('farmSize', 50), ('productInterest', 500), ('notes', 2000)):
        if k in body:
            updates[k] = clean_str(body, k, n) or None
    for k in ('customerName', 'location', 'requirement'):
        if k in updates and not updates[k]:
            raise HttpError(400, f'{k} cannot be empty')
    if 'email' in body:
        email = clean_str(body, 'email', 120).lower()
        if email and not EMAIL_RE.match(email):
            raise HttpError(400, 'invalid email address')
        updates['email'] = email or None
    if 'priority' in body:
        p = (body['priority'] or '').upper()
        if p not in PRIORITIES:
            raise HttpError(400, 'invalid priority')
        updates['priority'] = p
    if 'budget' in body:
        updates['budget'] = to_decimal(body['budget'], 'budget', minimum=0) if body['budget'] not in (None, '') else None
    if 'whatsappOptOut' in body:
        updates['whatsappOptOut'] = bool(body['whatsappOptOut']) or None
    if not updates:
        raise HttpError(400, 'Nothing to update')
    updates['updatedAt'] = now_iso()
    merged = {**lead, **{k: v for k, v in updates.items() if v is not None}}
    updates['searchText'] = search_text(merged)
    updated = update_item(table('leads'), {'leadId': lead_id}, updates)
    changed = [k for k in updates if k not in ('updatedAt', 'searchText')]
    log_activity(lead_id, 'UPDATED', actor, 'Updated ' + ', '.join(changed))
    if 'whatsappOptOut' in updates:
        audit(actor, 'LEAD_WHATSAPP_CONSENT', 'lead', lead_id, {'optOut': bool(updates['whatsappOptOut'])})
    return ok(updated)


def _stage(event, lead_id):
    actor = require_permission(event, 'lead.edit')
    lead = _load_editable(actor, lead_id)
    body = parse_body(event)
    updated = change_stage(lead, (body.get('stage') or '').upper(), actor, clean_str(body, 'reason', 500))
    audit(actor, 'LEAD_STAGE', 'lead', lead_id, {'from': lead.get('stage'), 'to': updated.get('stage')})
    return ok(updated)


def _owner(event, lead_id):
    actor = require_permission(event, 'crm.view')
    lead = get_lead(lead_id)
    owner_id = clean_str(parse_body(event), 'ownerId', 64, required=True)
    is_claim = owner_id == actor['userId'] and lead.get('ownerId') == UNASSIGNED and actor['role'] == STAFF
    if not is_claim:
        ensure(actor, 'lead.assign')
    if owner_id == UNASSIGNED:
        owner = None
    else:
        owner = actor if is_claim else _resolve_user(owner_id, (STAFF,) + ADMIN_ROLES, 'Owner')
    expected = lead.get('ownerId')
    updated = update_item(table('leads'), {'leadId': lead_id},
                          {'ownerId': owner['userId'] if owner else UNASSIGNED,
                           'ownerName': owner.get('name') if owner else None, 'updatedAt': now_iso()},
                          condition=Attr('ownerId').eq(expected))
    sync_lead_owner_to_consultations(updated)
    text = f"Lead claimed by {actor.get('name')}" if is_claim else \
        (f"Owner changed to {owner.get('name')}" if owner else 'Lead returned to the shared pool')
    log_activity(lead_id, 'ASSIGNMENT', actor, text)
    audit(actor, 'LEAD_OWNER', 'lead', lead_id, {'from': expected, 'to': updated['ownerId']})
    if owner and owner['userId'] != actor['userId']:
        notify_users([owner['userId']], 'Lead assigned to you', f"{lead.get('customerName')} — {lead.get('requirement', '')[:120]}",
                     'CRM_TASK', f'lead/{lead_id}')
    return ok(updated)


def _expert(event, lead_id):
    actor = require_permission(event, 'lead.assign')
    lead = get_lead(lead_id)
    expert = _resolve_user(clean_str(parse_body(event), 'expertId', 64, required=True), EXPERT, 'Expert')
    updated = update_item(table('leads'), {'leadId': lead_id},
                          {'expertId': expert['userId'], 'expertName': expert.get('name', ''), 'updatedAt': now_iso()})
    log_activity(lead_id, 'ASSIGNMENT', actor, f"Expert {expert.get('name')} added to lead")
    notify_users([expert['userId']], 'You were added to a lead', f"{lead.get('customerName')} — {lead.get('requirement', '')[:120]}",
                 'CRM_TASK', f'lead/{lead_id}')
    return ok(updated)


def _note(event, lead_id):
    actor = require_permission(event, 'crm.view')
    _load_visible(actor, lead_id)
    text = clean_str(parse_body(event), 'text', 4000, required=True)
    return created(log_activity(lead_id, 'NOTE', actor, text))


def _call(event, lead_id):
    actor = require_permission(event, 'lead.communicate')
    lead = _load_visible(actor, lead_id)
    body = parse_body(event)
    outcome = (body.get('outcome') or '').upper()
    if outcome not in CALL_OUTCOMES:
        raise HttpError(400, f'outcome must be one of: {", ".join(CALL_OUTCOMES)}')
    notes = clean_str(body, 'notes', 2000)
    data = {'outcome': outcome, 'phone': lead.get('phone'), 'reportedBy': 'user', 'verified': False}
    if body.get('durationSec') not in (None, ''):
        data['durationSec'] = int(to_decimal(body['durationSec'], 'durationSec', 0, 36000))
    text = 'Dialer opened' if outcome == 'DIALER_OPENED' else f"Call outcome: {outcome.replace('_', ' ').lower()}"
    act = log_activity(lead_id, 'CALL', actor, text + (f' — {notes}' if notes else ''), data)
    if outcome != 'DIALER_OPENED':
        table('leads').update_item(Key={'leadId': lead_id}, UpdateExpression='SET lastContactedAt = :t',
                                   ExpressionAttributeValues={':t': act['createdAt']})
        if outcome == 'CONNECTED' and lead.get('stage') in ('NEW', 'CONTACT_PENDING'):
            change_stage(lead, 'CONTACTED', actor, 'Call connected', auto=True)
        elif lead.get('stage') == 'NEW':
            change_stage(lead, 'CONTACT_PENDING', actor, 'Contact attempted', auto=True)
    if body.get('nextFollowUpAt'):
        create_task_record({
            'kind': 'FOLLOW_UP', 'title': f"Call back {lead.get('customerName')}", 'dueAt': body['nextFollowUpAt'],
            'assigneeId': actor['userId'], 'leadId': lead_id, 'customerId': lead.get('customerId'),
            'customerName': lead.get('customerName'), 'followUpType': 'CALL',
        }, actor)
    return created(act)


def _whatsapp_text(kind: str, lead: dict, actor: dict, custom: str) -> str:
    name = lead.get('customerName', '')
    if kind == 'CUSTOM':
        return custom
    if kind == 'GREETING':
        return (f"Hello {name},\n\nThis is {actor.get('name')} from Smart Agri regarding your enquiry"
                f"{' about ' + lead['cropName'] if lead.get('cropName') else ''}. How can we help you today?\n\nThank you,\nSmart Agri Team")
    if kind == 'FOLLOW_UP':
        return (f"Hello {name},\n\nFollowing up on your requirement: {lead.get('requirement', '')[:200]}.\n"
                f"Please let us know a convenient time to talk.\n\nThank you,\nSmart Agri Team")
    # CONSULTATION_SUMMARY — only the recommendation text the expert already shared with the customer.
    c = table('consultations').get_item(Key={'consultationId': lead.get('consultationId') or '-'}).get('Item')
    rec = (c or {}).get('recommendation')
    if not rec:
        raise HttpError(409, 'This lead has no expert recommendation to share yet')
    return (f"Hello {name},\n\nSummary of the expert advice for your {c.get('cropName')}:\n\n{rec['text'][:1500]}\n\n"
            f"Thank you,\nSmart Agri Team")


def _whatsapp(event, lead_id):
    actor = require_permission(event, 'lead.communicate')
    lead = _load_visible(actor, lead_id)
    if lead.get('whatsappOptOut'):
        raise HttpError(409, 'The customer has opted out of WhatsApp messages')
    body = parse_body(event)
    kind = (body.get('kind') or 'GREETING').upper()
    if kind not in WHATSAPP_KINDS:
        raise HttpError(400, 'invalid kind')
    text = _whatsapp_text(kind, lead, actor, clean_str(body, 'text', 3000, required=(kind == 'CUSTOM')))
    url = f"https://wa.me/{lead['phone'].lstrip('+')}?text={quote(text)}"
    act = log_activity(lead_id, 'WHATSAPP', actor, f"WhatsApp chat opened ({kind.replace('_', ' ').lower()})",
                       {'kind': kind, 'channel': 'CLICK_TO_CHAT', 'deliveryStatus': 'NOT_TRACKED', 'text': text[:1000]})
    return created({'url': url, 'text': text, 'activity': act})


# ── Dashboards & reports ────────────────────────────────────────────────────

def _scoped_quotations(actor: dict, lead_ids: set) -> list[dict]:
    if not has_permission(actor, 'quotation.view'):
        return []
    if has_permission(actor, 'crm.view_all'):
        return scan_all(table('quotations'))
    tbl = table('quotations')
    found = {q['quotationId']: q for q in query_all(
        tbl, IndexName='CreatorIndex', KeyConditionExpression=Key('createdBy').eq(actor['userId']))}
    for lead_id in list(lead_ids)[:200]:
        for q in query_all(tbl, IndexName='LeadIndex', KeyConditionExpression=Key('leadId').eq(lead_id)):
            found[q['quotationId']] = q
    return list(found.values())


def _scoped_tasks(actor: dict) -> list[dict]:
    if has_permission(actor, 'tasks.assign_others'):
        return scan_all(table('tasks'), FilterExpression=Attr('status').eq('OPEN'))
    return query_all(table('tasks'), IndexName='AssigneeIndex',
                     KeyConditionExpression=Key('assigneeId').eq(actor['userId']),
                     FilterExpression=Attr('status').eq('OPEN'))


def _dashboard(event):
    actor = require_permission(event, 'crm.view')
    leads = _scoped_leads(actor)
    lead_ids = {l['leadId'] for l in leads}
    quotes = _scoped_quotations(actor, lead_ids)
    tasks = _scoped_tasks(actor)
    now = now_iso()
    today_end = time.strftime('%Y-%m-%dT23:59:59Z', time.gmtime())
    week_ago = iso_in(-7 * 86400)

    by_stage = {s: 0 for s in STAGES}
    for l in leads:
        by_stage[l.get('stage', 'NEW')] = by_stage.get(l.get('stage', 'NEW'), 0) + 1
    won, lost = by_stage['WON'], by_stage['LOST']
    q_status = {}
    for q in quotes:
        q_status[q.get('status')] = q_status.get(q.get('status'), 0) + 1

    feed = _recent_activity(actor, lead_ids, 10)
    return ok({
        'scope': 'all' if has_permission(actor, 'crm.view_all') else ('expert' if actor['role'] == EXPERT else 'mine'),
        'leads': {
            'total': len(leads),
            'new': by_stage['NEW'],
            'createdLast7Days': sum(1 for l in leads if l.get('createdAt', '') >= week_ago),
            'byStage': by_stage,
            'manual': sum(1 for l in leads if l.get('source') != 'EXPERT_CONSULTATION'),
            'expertConsultation': sum(1 for l in leads if l.get('source') == 'EXPERT_CONSULTATION'),
            'unassigned': sum(1 for l in leads if l.get('ownerId') == UNASSIGNED),
            'won': won, 'lost': lost,
            'conversionRate': round(won * 100 / (won + lost), 1) if (won + lost) else None,
        },
        'tasks': {
            'followUpsDueToday': sum(1 for t in tasks if t.get('kind') == 'FOLLOW_UP' and now <= t.get('dueAt', '') <= today_end),
            'overdue': sum(1 for t in tasks if t.get('dueAt', '') < now),
            'upcomingAppointments': sum(1 for t in tasks if t.get('kind') == 'APPOINTMENT' and t.get('dueAt', '') >= now),
            'openTotal': len(tasks),
        },
        'quotations': {
            'created': len(quotes),
            'pendingApproval': q_status.get('PENDING_APPROVAL', 0),
            'shared': sum(q_status.get(s, 0) for s in ('SHARED', 'VIEWED', 'ACCEPTED', 'REJECTED')),
            'accepted': q_status.get('ACCEPTED', 0),
            'byStatus': q_status,
        },
        'recentActivities': feed,
    })


def _recent_activity(actor: dict, lead_ids: set, limit: int) -> list[dict]:
    if has_permission(actor, 'crm.view_all'):
        items = table('lead_activities').query(
            IndexName='FeedIndex', KeyConditionExpression=Key('feed').eq('ALL'), ScanIndexForward=False, Limit=limit,
        ).get('Items', [])
    else:
        items = table('lead_activities').query(
            IndexName='ActorIndex', KeyConditionExpression=Key('actorId').eq(actor['userId']),
            ScanIndexForward=False, Limit=limit,
        ).get('Items', [])
    return [i for i in items if has_permission(actor, 'crm.view_all') or i['leadId'] in lead_ids or i.get('actorId') == actor['userId']]


def _activities(event):
    actor = require_permission(event, 'crm.view')
    leads = _scoped_leads(actor) if not has_permission(actor, 'crm.view_all') else []
    return ok({'items': _recent_activity(actor, {l['leadId'] for l in leads}, 50)})


def _pipeline(event):
    actor = require_permission(event, 'crm.view')
    leads = _scoped_leads(actor)
    columns = {s: [] for s in STAGES}
    for l in sorted(leads, key=lambda l: l.get('updatedAt', ''), reverse=True):
        columns.setdefault(l.get('stage', 'NEW'), []).append(_summary(l))
    return ok({'stages': [{'stage': s, 'count': len(columns[s]), 'items': columns[s][:100]} for s in STAGES]})


def _reports(event):
    actor = require_permission(event, 'crm.view')
    leads = _scoped_leads(actor)
    quotes = _scoped_quotations(actor, {l['leadId'] for l in leads})

    def bucket(key_fn):
        out = {}
        for l in leads:
            k = key_fn(l) or 'Unknown'
            b = out.setdefault(k, {'total': 0, 'won': 0, 'lost': 0, 'open': 0})
            b['total'] += 1
            st = l.get('stage')
            b['won' if st == 'WON' else 'lost' if st == 'LOST' else 'open'] += 1
        for b in out.values():
            closed = b['won'] + b['lost']
            b['conversionRate'] = round(b['won'] * 100 / closed, 1) if closed else None
        return out

    accepted_value = sum(float(q.get('grandTotal') or 0) for q in quotes if q.get('status') == 'ACCEPTED')
    report = {
        'bySource': bucket(lambda l: l.get('source')),
        'quotationFunnel': {
            'created': len(quotes),
            'approved': sum(1 for q in quotes if q.get('status') in ('APPROVED', 'SHARED', 'VIEWED', 'ACCEPTED', 'REJECTED')),
            'shared': sum(1 for q in quotes if q.get('status') in ('SHARED', 'VIEWED', 'ACCEPTED', 'REJECTED')),
            'accepted': sum(1 for q in quotes if q.get('status') == 'ACCEPTED'),
            'acceptedValue': round(accepted_value, 2),
        },
    }
    if has_permission(actor, 'reports.team'):
        report['byOwner'] = bucket(lambda l: l.get('ownerName') or ('Unassigned' if l.get('ownerId') == UNASSIGNED else None))
        report['byExpert'] = bucket(lambda l: l.get('expertName'))
    return ok(report)


def _customer(event, customer_id):
    actor = require_permission(event, 'crm.view')
    customer = table('users').get_item(Key={'userId': customer_id}).get('Item')
    if not customer or customer.get('role') != 'FARMER':
        raise HttpError(404, 'Customer not found')
    leads = query_all(table('leads'), IndexName='CustomerIndex', KeyConditionExpression=Key('customerId').eq(customer_id))
    visible = [l for l in leads if can_view_lead(actor, l)]
    if not has_permission(actor, 'crm.view_all') and not visible:
        raise HttpError(403, 'Access denied')
    consultations = query_all(table('consultations'), IndexName='CustomerIndex',
                              KeyConditionExpression=Key('customerId').eq(customer_id), max_items=50)
    if actor['role'] == EXPERT:
        consultations = [c for c in consultations if c.get('expertId') == actor['userId']]
    quotes = query_all(table('quotations'), IndexName='CustomerIndex',
                       KeyConditionExpression=Key('customerId').eq(customer_id)) \
        if has_permission(actor, 'quotation.view') else []
    visible_ids = {l['leadId'] for l in visible}
    if not has_permission(actor, 'crm.view_all'):
        quotes = [q for q in quotes if q.get('leadId') in visible_ids]
    comms = []
    for l in visible[:10]:
        comms += table('lead_activities').query(
            KeyConditionExpression=Key('leadId').eq(l['leadId']), ScanIndexForward=False, Limit=30,
            FilterExpression=Attr('type').is_in(['CALL', 'WHATSAPP', 'NOTE']),
        ).get('Items', [])
    lands = query_all(table('lands'), IndexName='FarmerIndex', KeyConditionExpression=Key('farmerId').eq(customer_id), max_items=20)
    return ok({
        'customer': {k: customer.get(k) for k in ('userId', 'name', 'phone', 'email', 'village', 'district', 'createdAt',
                                                  'preferredContactMethod', 'language') if customer.get(k)},
        'lands': [{k: x.get(k) for k in ('landId', 'name', 'area', 'areaUnit', 'village', 'soilType') if x.get(k) is not None} for x in lands],
        'leads': [_summary(l) for l in visible],
        'consultations': [{k: c.get(k) for k in ('consultationId', 'cropName', 'status', 'severity', 'expertName', 'createdAt')}
                          for c in consultations if c.get('status') != 'DRAFT'],
        'quotations': [{k: q.get(k) for k in ('quotationId', 'quotationNumber', 'status', 'grandTotal', 'createdAt')} for q in quotes],
        'communications': sorted(comms, key=lambda a: a['createdAt'], reverse=True)[:50],
    })
