"""
Product quotations linked to CRM leads.

GET  /quotations                   – internal: role-scoped (?status=&leadId=); customer: own, once shared
POST /quotations/preview           – compute totals without saving
POST /quotations                   – create DRAFT {leadId, items:[{productId, quantity, discountPct}], deliveryCharge, ...}
GET  /quotations/{id}              – details (a customer opening a SHARED quotation marks it VIEWED)
PUT  /quotations/{id}              – edit a DRAFT (totals recomputed)
POST /quotations/{id}/submit       – DRAFT → PENDING_APPROVAL or APPROVED (per settings.quotation rules)
POST /quotations/{id}/approve      – PENDING_APPROVAL → APPROVED
POST /quotations/{id}/reject       – PENDING_APPROVAL → DRAFT {reason}
POST /quotations/{id}/share        – {channel: WHATSAPP|IN_APP} → SHARED; returns message text + click-to-chat URL
POST /quotations/{id}/respond      – {decision: ACCEPT|REJECT, comment} (customer, or staff recording it)
POST /quotations/{id}/cancel
GET  /quotations/{id}/document     – printable HTML (the app renders it to PDF on device)

Status: DRAFT, PENDING_APPROVAL, APPROVED, SHARED, VIEWED, ACCEPTED, REJECTED, EXPIRED, CANCELLED.
"""
import html
import time
from urllib.parse import quote

from boto3.dynamodb.conditions import Key, Attr

from lib.db import table, encode_key, decode_key
from lib.router import run
from lib.permissions import (
    require_actor, require_permission, has_permission, can_view_lead, ensure, FARMER, SUPER_ADMIN,
)
from lib.crm import get_lead, log_activity, advance_stage
from lib.quotation_calc import calculate
from lib.settings import get_setting, next_sequence
from lib.notify import notify_users, notify_roles
from lib.audit import audit
from lib.util import HttpError, now_iso, new_id, clean_str, update_item, today, to_decimal
from lib.response import ok, created, query_param, parse_body

PAGE_SIZE = 30
CUSTOMER_VISIBLE = ('SHARED', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED')
EXPIRABLE = ('APPROVED', 'SHARED', 'VIEWED')
FINAL = ('ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED')


def handler(event, _ctx):
    return run(event, _route)


def _route(event, m, seg):
    if not seg:
        if m == 'GET':  return _list(event)
        if m == 'POST': return _create(event)
        return None
    if seg == ['preview'] and m == 'POST':
        return _preview(event)
    qid, action = seg[0], (seg[1] if len(seg) > 1 else None)
    if action is None:
        if m == 'GET': return _get(event, qid)
        if m == 'PUT': return _update(event, qid)
        return None
    if action == 'document' and m == 'GET': return _document(event, qid)
    if m != 'POST':
        return None
    return {
        'submit': _submit, 'approve': _approve, 'reject': _reject, 'share': _share,
        'respond': _respond, 'cancel': _cancel,
    }.get(action, lambda *_: None)(event, qid)


# ── Access ──────────────────────────────────────────────────────────────────

def _expire_if_due(q: dict) -> dict:
    if q.get('status') in EXPIRABLE and q.get('validUntil', '9999') < today():
        try:
            q = update_item(table('quotations'), {'quotationId': q['quotationId']},
                            {'status': 'EXPIRED', 'updatedAt': now_iso()}, condition=Attr('status').eq(q['status']))
        except Exception:
            q = table('quotations').get_item(Key={'quotationId': q['quotationId']}).get('Item') or q
    return q


def _load(actor: dict, qid: str) -> dict:
    q = table('quotations').get_item(Key={'quotationId': qid}).get('Item')
    if not q:
        raise HttpError(404, 'Quotation not found')
    if actor['role'] == FARMER:
        if q.get('customerId') != actor['userId'] or q.get('status') not in CUSTOMER_VISIBLE:
            raise HttpError(404, 'Quotation not found')
    else:
        ensure(actor, 'quotation.view')
        if q.get('createdBy') != actor['userId'] and not can_view_lead(actor, get_lead(q['leadId'])):
            raise HttpError(403, 'Access denied')
    return _expire_if_due(q)


def _present(q: dict, actor: dict) -> dict:
    out = dict(q)
    if actor['role'] == FARMER:
        for k in ('approvalHistory', 'createdBy', 'approvedBy', 'leadId', 'requiresApproval', 'warnings', 'rejectionReason'):
            out.pop(k, None)
    else:
        out['permissions'] = {
            'edit': q['status'] == 'DRAFT' and (q.get('createdBy') == actor['userId'] or actor['role'] in ('ADMIN', SUPER_ADMIN)),
            'approve': q['status'] == 'PENDING_APPROVAL' and has_permission(actor, 'quotation.approve')
                       and (q.get('createdBy') != actor['userId'] or actor['role'] == SUPER_ADMIN),
            'share': q['status'] in ('APPROVED', 'SHARED', 'VIEWED') and has_permission(actor, 'quotation.share'),
            'recordResponse': q['status'] in ('SHARED', 'VIEWED') and has_permission(actor, 'quotation.share'),
        }
    return out


# ── List / preview / create / edit ──────────────────────────────────────────

def _list(event):
    actor = require_actor(event)
    status = (query_param(event, 'status') or '').upper()
    lead_id = query_param(event, 'leadId')
    cursor = decode_key(query_param(event, 'cursor'))
    tbl = table('quotations')
    kwargs = {'Limit': PAGE_SIZE, 'ScanIndexForward': False}
    if cursor:
        kwargs['ExclusiveStartKey'] = cursor

    if actor['role'] == FARMER:
        kwargs.update(IndexName='CustomerIndex', KeyConditionExpression=Key('customerId').eq(actor['userId']),
                      FilterExpression=Attr('status').is_in(list(CUSTOMER_VISIBLE)))
    else:
        ensure(actor, 'quotation.view')
        if lead_id:
            if not can_view_lead(actor, get_lead(lead_id)):
                raise HttpError(403, 'Access denied')
            kwargs.update(IndexName='LeadIndex', KeyConditionExpression=Key('leadId').eq(lead_id))
        elif has_permission(actor, 'crm.view_all'):
            if status:
                kwargs.update(IndexName='StatusIndex', KeyConditionExpression=Key('status').eq(status))
                status = ''
        else:
            kwargs.update(IndexName='CreatorIndex', KeyConditionExpression=Key('createdBy').eq(actor['userId']))
        if status:
            kwargs['FilterExpression'] = Attr('status').eq(status)

    if 'KeyConditionExpression' in kwargs:
        resp = tbl.query(**kwargs)
    else:
        kwargs.pop('ScanIndexForward')
        resp = tbl.scan(**kwargs)
    items = sorted((_expire_if_due(q) for q in resp.get('Items', [])), key=lambda q: q.get('createdAt', ''), reverse=True)
    return ok({'items': [_present(q, actor) for q in items], 'nextCursor': encode_key(resp.get('LastEvaluatedKey'))})


def _preview(event):
    actor = require_permission(event, 'quotation.create')
    body = parse_body(event)
    return ok(calculate(body.get('items'), body.get('deliveryCharge'), actor['role']))


def _terms(body: dict, cfg: dict) -> dict:
    validity = int(to_decimal(body.get('validityDays') or cfg['validityDays'], 'validityDays', 1, 180))
    return {
        'validityDays': validity,
        'validUntil': time.strftime('%Y-%m-%d', time.gmtime(time.time() + validity * 86400)),
        'paymentTerms': clean_str(body, 'paymentTerms', 1000) or cfg['paymentTerms'],
        'deliveryTerms': clean_str(body, 'deliveryTerms', 1000) or cfg['deliveryTerms'],
        'notes': clean_str(body, 'notes', 2000),
    }


def _create(event):
    actor = require_permission(event, 'quotation.create')
    body = parse_body(event)
    lead = get_lead(clean_str(body, 'leadId', 64, required=True))
    if not can_view_lead(actor, lead):
        raise HttpError(403, 'Access denied')
    if lead.get('stage') in ('WON', 'LOST'):
        raise HttpError(409, 'Reopen the lead before creating a new quotation')
    calc = calculate(body.get('items'), body.get('deliveryCharge'), actor['role'])
    cfg = get_setting('quotation')
    now = now_iso()
    seq = next_sequence('quotation')
    q = {
        'quotationId': new_id(),
        'quotationNumber': f"QT-{time.strftime('%Y', time.gmtime())}-{seq:05d}",
        'leadId': lead['leadId'],
        'customerId': lead.get('customerId') or None,
        'customerName': lead.get('customerName', ''),
        'customerPhone': lead.get('phone', ''),
        'customerLocation': lead.get('location', ''),
        **calc,
        **_terms(body, cfg),
        'status': 'DRAFT',
        'createdBy': actor['userId'],
        'createdByName': actor.get('name', ''),
        'createdByRole': actor['role'],
        'createdAt': now,
        'updatedAt': now,
        'approvalHistory': [],
    }
    q = {k: v for k, v in q.items() if v is not None}
    table('quotations').put_item(Item=q)
    log_activity(lead['leadId'], 'QUOTATION', actor, f"Quotation {q['quotationNumber']} drafted — ₹{q['grandTotal']}",
                 {'quotationId': q['quotationId']})
    audit(actor, 'QUOTATION_CREATED', 'quotation', q['quotationId'], {'grandTotal': str(q['grandTotal'])})
    return created(_present(q, actor))


def _update(event, qid):
    actor = require_permission(event, 'quotation.create')
    q = _load(actor, qid)
    if q['status'] != 'DRAFT':
        raise HttpError(409, 'Only draft quotations can be edited')
    if q['createdBy'] != actor['userId'] and actor['role'] not in ('ADMIN', SUPER_ADMIN):
        raise HttpError(403, 'Only the creator or an admin can edit this quotation')
    body = parse_body(event)
    items = body.get('items') if 'items' in body else [
        {'productId': i['productId'], 'quantity': i['quantity'], 'discountPct': i.get('discountPct', 0)} for i in q['items']]
    calc = calculate(items, body.get('deliveryCharge', q.get('deliveryCharge')), actor['role'])
    updates = {**calc, **_terms({**q, **body}, get_setting('quotation')), 'updatedAt': now_iso(), 'rejectionReason': None}
    updated = update_item(table('quotations'), {'quotationId': qid}, updates, condition=Attr('status').eq('DRAFT'))
    return ok(_present(updated, actor))


# ── Workflow ────────────────────────────────────────────────────────────────

def _history(q: dict, actor: dict, event: str, note: str = '') -> list:
    return (q.get('approvalHistory') or []) + [
        {'event': event, 'by': actor['userId'], 'byName': actor.get('name', ''), 'note': note or None, 'at': now_iso()}]


def _submit(event, qid):
    actor = require_permission(event, 'quotation.create')
    q = _load(actor, qid)
    if q['status'] != 'DRAFT':
        raise HttpError(409, 'Only drafts can be submitted')
    # Re-price at submit time so approval is based on current catalogue prices.
    items = [{'productId': i['productId'], 'quantity': i['quantity'], 'discountPct': i.get('discountPct', 0)} for i in q['items']]
    calc = calculate(items, q.get('deliveryCharge'), q.get('createdByRole', actor['role']))
    needs = calc['requiresApproval']
    status = 'PENDING_APPROVAL' if needs else 'APPROVED'
    updates = {**calc, 'status': status, 'updatedAt': now_iso(), 'submittedAt': now_iso(),
               'approvalHistory': _history(q, actor, 'SUBMITTED')}
    if not needs:
        updates.update(approvedBy='auto', approvedAt=now_iso())
    updated = update_item(table('quotations'), {'quotationId': qid}, updates, condition=Attr('status').eq('DRAFT'))
    log_activity(q['leadId'], 'QUOTATION', actor,
                 f"Quotation {q['quotationNumber']} {'sent for approval' if needs else 'approved automatically'}")
    if needs:
        notify_roles(['ADMIN', SUPER_ADMIN], 'Quotation awaiting approval',
                     f"{q['quotationNumber']} for {q.get('customerName')} — ₹{calc['grandTotal']}", 'QUOTATION',
                     f'quotation/{qid}')
    return ok(_present(updated, actor))


def _approve(event, qid):
    actor = require_permission(event, 'quotation.approve')
    q = _load(actor, qid)
    if q['status'] != 'PENDING_APPROVAL':
        raise HttpError(409, 'Quotation is not awaiting approval')
    if q['createdBy'] == actor['userId'] and actor['role'] != SUPER_ADMIN:
        raise HttpError(403, 'You cannot approve your own quotation')
    note = clean_str(parse_body(event), 'note', 500)
    updated = update_item(table('quotations'), {'quotationId': qid}, {
        'status': 'APPROVED', 'approvedBy': actor['userId'], 'approvedByName': actor.get('name', ''),
        'approvedAt': now_iso(), 'updatedAt': now_iso(), 'approvalHistory': _history(q, actor, 'APPROVED', note),
    }, condition=Attr('status').eq('PENDING_APPROVAL'))
    log_activity(q['leadId'], 'QUOTATION', actor, f"Quotation {q['quotationNumber']} approved")
    audit(actor, 'QUOTATION_APPROVED', 'quotation', qid)
    notify_users([q['createdBy']], 'Quotation approved', f"{q['quotationNumber']} is ready to share.", 'QUOTATION',
                 f'quotation/{qid}')
    return ok(_present(updated, actor))


def _reject(event, qid):
    actor = require_permission(event, 'quotation.approve')
    q = _load(actor, qid)
    if q['status'] != 'PENDING_APPROVAL':
        raise HttpError(409, 'Quotation is not awaiting approval')
    reason = clean_str(parse_body(event), 'reason', 500, required=True)
    updated = update_item(table('quotations'), {'quotationId': qid}, {
        'status': 'DRAFT', 'rejectionReason': reason, 'updatedAt': now_iso(),
        'approvalHistory': _history(q, actor, 'REJECTED', reason),
    }, condition=Attr('status').eq('PENDING_APPROVAL'))
    log_activity(q['leadId'], 'QUOTATION', actor, f"Quotation {q['quotationNumber']} sent back: {reason}")
    audit(actor, 'QUOTATION_REJECTED', 'quotation', qid, {'reason': reason})
    notify_users([q['createdBy']], 'Quotation needs changes', f"{q['quotationNumber']}: {reason}", 'QUOTATION',
                 f'quotation/{qid}')
    return ok(_present(updated, actor))


def _fmt_qty(d) -> str:
    s = format(d, 'f')
    return s.rstrip('0').rstrip('.') if '.' in s else s


def share_message(q: dict) -> str:
    products = '\n'.join(f"- {i['name']} × {_fmt_qty(i['quantity'])} {i.get('unit', '')}".rstrip() for i in q['items'])
    return (
        f"Hello {q.get('customerName', '')},\n\n"
        f"Based on your requirements, we have prepared your Smart Agri quotation.\n\n"
        f"Quotation No: {q['quotationNumber']}\n\n"
        f"Products:\n{products}\n\n"
        f"Total Amount: ₹{q['grandTotal']}\n\n"
        f"Valid Until: {q['validUntil']}\n\n"
        f"Please review the quotation and let us know if you would like to proceed.\n\n"
        f"Thank you,\nSmart Agri Team"
    )


def _share(event, qid):
    actor = require_permission(event, 'quotation.share')
    q = _load(actor, qid)
    if q['status'] not in ('APPROVED', 'SHARED', 'VIEWED'):
        raise HttpError(409, 'Only approved quotations can be shared' if q['status'] != 'EXPIRED' else 'This quotation has expired')
    lead = get_lead(q['leadId'])
    channel = (parse_body(event).get('channel') or 'WHATSAPP').upper()
    if channel not in ('WHATSAPP', 'WHATSAPP_API', 'IN_APP'):
        raise HttpError(400, 'channel must be WHATSAPP, WHATSAPP_API or IN_APP')
    if channel.startswith('WHATSAPP') and lead.get('whatsappOptOut'):
        raise HttpError(409, 'The customer has opted out of WhatsApp messages')
    if channel == 'IN_APP' and not q.get('customerId'):
        raise HttpError(409, 'This customer has no app account — share via WhatsApp instead')

    text = share_message(q)
    share = {'channel': channel, 'by': actor['userId'], 'at': now_iso(),
             'deliveryStatus': 'NOT_TRACKED' if channel == 'WHATSAPP' else 'IN_APP_CREATED'}
    wa_result = None
    if channel == 'WHATSAPP_API':
        from lib import whatsapp as wa
        products = ', '.join(f"{i['name']} × {_fmt_qty(i['quantity'])}" for i in q['items'])[:900]
        try:
            wa_result = wa.send(lead['phone'], text, 'QUOTATION',
                                [q.get('customerName', ''), q['quotationNumber'], products, f"₹{q['grandTotal']}", q['validUntil']])
        except wa.WhatsAppError as e:
            raise HttpError(502, str(e))
        share.update(deliveryStatus='ACCEPTED', providerMessageId=wa_result['messageId'])
    new_status = q['status'] if q['status'] == 'VIEWED' else 'SHARED'
    updated = update_item(table('quotations'), {'quotationId': qid}, {
        'status': new_status, 'sharedAt': q.get('sharedAt') or share['at'], 'updatedAt': share['at'],
        'shares': (q.get('shares') or []) + [share],
    }, condition=Attr('status').eq(q['status']))

    if q.get('customerId'):
        notify_users([q['customerId']], 'New quotation', f"{q['quotationNumber']} — ₹{q['grandTotal']}, valid until {q['validUntil']}",
                     'QUOTATION', f'quotation/{qid}')
    via = {'WHATSAPP': 'WhatsApp (click-to-chat; delivery not tracked)', 'WHATSAPP_API': 'WhatsApp Business (delivery tracked)',
           'IN_APP': 'in-app notification'}[channel]
    act = log_activity(q['leadId'], 'WHATSAPP' if channel.startswith('WHATSAPP') else 'QUOTATION', actor,
                       f"Quotation {q['quotationNumber']} shared via {via}",
                       {'quotationId': qid, 'channel': 'CLOUD_API' if channel == 'WHATSAPP_API' else channel,
                        'deliveryStatus': share['deliveryStatus'],
                        **({'providerMessageId': wa_result['messageId']} if wa_result else {})})
    if wa_result:
        from lib import whatsapp as wa
        wa.remember_message(wa_result['messageId'], q['leadId'], act['sortKey'])
    advance_stage(q['leadId'], 'QUOTATION_SHARED', actor, f"Quotation {q['quotationNumber']} shared")
    audit(actor, 'QUOTATION_SHARED', 'quotation', qid, {'channel': channel})
    result = {'quotation': _present(updated, actor), 'text': text}
    if channel == 'WHATSAPP':
        result['url'] = f"https://wa.me/{lead['phone'].lstrip('+')}?text={quote(text)}"
    return ok(result)


def _respond(event, qid):
    actor = require_actor(event)
    q = _load(actor, qid)
    if actor['role'] == FARMER:
        ensure(actor, 'quotation.respond')
    else:
        ensure(actor, 'quotation.share')
    if q['status'] not in ('SHARED', 'VIEWED'):
        raise HttpError(409, 'This quotation can no longer be accepted or rejected' if q['status'] in FINAL
                        else 'This quotation has not been shared yet')
    body = parse_body(event)
    decision = (body.get('decision') or '').upper()
    if decision not in ('ACCEPT', 'REJECT'):
        raise HttpError(400, 'decision must be ACCEPT or REJECT')
    comment = clean_str(body, 'comment', 1000)
    status = 'ACCEPTED' if decision == 'ACCEPT' else 'REJECTED'
    updated = update_item(table('quotations'), {'quotationId': qid}, {
        'status': status, 'respondedAt': now_iso(), 'updatedAt': now_iso(), 'customerComment': comment or None,
        'responseRecordedBy': None if actor['role'] == FARMER else actor['userId'],
    }, condition=Attr('status').eq(q['status']))
    who = 'Customer' if actor['role'] == FARMER else f"{actor.get('name')} (on behalf of customer)"
    log_activity(q['leadId'], 'QUOTATION', actor if actor['role'] != FARMER else None,
                 f"{who} {status.lower()} quotation {q['quotationNumber']}" + (f': {comment}' if comment else ''))
    if status == 'ACCEPTED':
        advance_stage(q['leadId'], 'NEGOTIATION', None, 'Quotation accepted')
    lead = get_lead(q['leadId'])
    notify_users([q['createdBy'], lead.get('ownerId')], f'Quotation {status.lower()}',
                 f"{q.get('customerName')} {status.lower()} {q['quotationNumber']}" + (f': {comment}' if comment else ''),
                 'QUOTATION', f'quotation/{qid}')
    return ok(_present(updated, actor))


def _cancel(event, qid):
    actor = require_permission(event, 'quotation.create')
    q = _load(actor, qid)
    if q['status'] in FINAL:
        raise HttpError(409, f"Quotation is already {q['status'].lower()}")
    if q['createdBy'] != actor['userId'] and actor['role'] not in ('ADMIN', SUPER_ADMIN):
        raise HttpError(403, 'Only the creator or an admin can cancel')
    updated = update_item(table('quotations'), {'quotationId': qid},
                          {'status': 'CANCELLED', 'updatedAt': now_iso(),
                           'approvalHistory': _history(q, actor, 'CANCELLED', clean_str(parse_body(event), 'reason', 500))},
                          condition=Attr('status').eq(q['status']))
    log_activity(q['leadId'], 'QUOTATION', actor, f"Quotation {q['quotationNumber']} cancelled")
    return ok(_present(updated, actor))


def _get(event, qid):
    actor = require_actor(event)
    q = _load(actor, qid)
    if actor['role'] == FARMER and q['status'] == 'SHARED':
        # Server-recorded: the customer actually opened it in the app.
        q = update_item(table('quotations'), {'quotationId': qid},
                        {'status': 'VIEWED', 'viewedAt': now_iso()}, condition=Attr('status').eq('SHARED'))
        log_activity(q['leadId'], 'QUOTATION', None, f"Customer viewed quotation {q['quotationNumber']} in the app")
    return ok(_present(q, actor))


# ── Printable document ──────────────────────────────────────────────────────

def _document(event, qid):
    actor = require_actor(event)
    q = _load(actor, qid)
    if actor['role'] != FARMER and q['status'] in ('DRAFT', 'PENDING_APPROVAL', 'CANCELLED'):
        watermark = 'DRAFT — NOT VALID'
    else:
        watermark = ''
    cfg = get_setting('quotation')
    e = lambda v: html.escape(str(v if v is not None else ''))
    rows = ''.join(
        f"<tr><td>{n}</td><td><b>{e(i['name'])}</b><div class='d'>{e(i.get('description', ''))}</div></td>"
        f"<td class='r'>{e(_fmt_qty(i['quantity']))} {e(i.get('unit', ''))}</td><td class='r'>₹{e(i['unitPrice'])}</td>"
        f"<td class='r'>{e(_fmt_qty(i['discountPct']))}%</td><td class='r'>{e(_fmt_qty(i['taxRatePct']))}%</td>"
        f"<td class='r'>₹{e(i['lineTotal'])}</td></tr>"
        for n, i in enumerate(q['items'], 1))
    doc = f"""<!doctype html><html><head><meta charset="utf-8"><style>
body{{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#1f1f1f;margin:32px;font-size:12px}}
h1{{color:#2E7D32;margin:0;font-size:22px}} .muted{{color:#666}} table{{width:100%;border-collapse:collapse;margin-top:16px}}
th{{background:#F1F8E9;text-align:left;padding:8px;border-bottom:2px solid #2E7D32;font-size:11px}}
td{{padding:8px;border-bottom:1px solid #eee;vertical-align:top}} .r{{text-align:right}} .d{{color:#777;font-size:10px}}
.tot td{{border:none;padding:4px 8px}} .grand td{{font-size:15px;font-weight:700;color:#2E7D32;border-top:2px solid #2E7D32}}
.head{{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:12px}}
.wm{{color:#C62828;font-weight:700;font-size:14px}} h3{{margin:18px 0 4px;font-size:12px;color:#2E7D32}}
</style></head><body>
<div class="head"><div><h1>{e(cfg['companyName'])}</h1><div class="muted">{e(cfg.get('companyContact', ''))}</div></div>
<div style="text-align:right"><b>QUOTATION</b><br>{e(q['quotationNumber'])}<br>Date: {e(q['createdAt'][:10])}<br>
Valid until: {e(q['validUntil'])}<div class="wm">{e(watermark)}</div></div></div>
<h3>Customer</h3><div><b>{e(q.get('customerName'))}</b><br>{e(q.get('customerPhone'))}<br>{e(q.get('customerLocation'))}</div>
<table><tr><th>#</th><th>Product</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Disc.</th>
<th class="r">Tax</th><th class="r">Amount</th></tr>{rows}</table>
<table class="tot" style="width:45%;margin-left:55%">
<tr><td>Subtotal</td><td class="r">₹{e(q['subtotal'])}</td></tr>
<tr><td>Discount</td><td class="r">− ₹{e(q['discountTotal'])}</td></tr>
<tr><td>Tax</td><td class="r">₹{e(q['taxTotal'])}</td></tr>
<tr><td>Delivery</td><td class="r">₹{e(q['deliveryCharge'])}</td></tr>
<tr class="grand"><td>Grand total</td><td class="r">₹{e(q['grandTotal'])}</td></tr></table>
<h3>Payment terms</h3><div>{e(q.get('paymentTerms'))}</div>
<h3>Delivery terms</h3><div>{e(q.get('deliveryTerms'))}</div>
{f"<h3>Notes</h3><div>{e(q['notes'])}</div>" if q.get('notes') else ''}
<h3>Terms &amp; conditions</h3><div class="muted">{e(cfg['termsAndConditions'])}</div>
<p class="muted" style="margin-top:24px">Prepared by {e(q.get('createdByName'))}. This quotation is valid until {e(q['validUntil'])}.</p>
</body></html>"""
    return ok({'html': doc, 'fileName': f"{q['quotationNumber']}.pdf"})
