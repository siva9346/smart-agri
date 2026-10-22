"""
Team user management (staff, experts, admins).

GET  /users                 – ?role=STAFF|EXPERT|ADMIN|SUPER_ADMIN  (users.manage; ADMIN sees STAFF/EXPERT only)
POST /users                 – create {name, phone, email, password, role, ...}
GET  /users/assignable      – ?role=STAFF|EXPERT  minimal list for pickers (any internal user)
GET  /users/experts         – expert workload, availability and crop coverage (consultation.assign)
GET  /users/{id}
PUT  /users/{id}            – {isActive, role, specializations, isAvailable, maxActiveConsultations, department, jobTitle, ...}

Rules: SUPER_ADMIN manages ADMIN/STAFF/EXPERT; ADMIN manages STAFF/EXPERT only.
Super Admins are still created through /auth/register-admin (capped). Nobody
can change their own role or deactivate themselves. Customers stay on /farmers.
"""
import bcrypt
from boto3.dynamodb.conditions import Key

from lib.db import table
from lib.router import run
from lib.permissions import (
    require_permission, INTERNAL_ROLES, SUPER_ADMIN, ADMIN, STAFF, EXPERT,
)
from lib.settings import get_setting
from lib.audit import audit
from lib.util import (
    HttpError, now_iso, new_id, clean_str, normalize_phone, update_item, query_all, safe_user, EMAIL_RE,
)
from lib.response import ok, created, query_param, parse_body

MANAGEABLE = {SUPER_ADMIN: (ADMIN, STAFF, EXPERT), ADMIN: (STAFF, EXPERT)}
PROFILE_FIELDS = ('department', 'jobTitle', 'responsibilities', 'qualifications')


def handler(event, _ctx):
    return run(event, _route)


def _route(event, m, seg):
    if not seg:
        if m == 'GET':  return _list(event)
        if m == 'POST': return _create(event)
        return None
    if seg == ['assignable'] and m == 'GET': return _assignable(event)
    if seg == ['experts'] and m == 'GET':    return _experts(event)
    if len(seg) == 1:
        if m == 'GET': return _get(event, seg[0])
        if m == 'PUT': return _update(event, seg[0])
    return None


def _can_manage(actor: dict, target_role: str) -> bool:
    return target_role in MANAGEABLE.get(actor['role'], ())


def _specializations(value) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise HttpError(400, 'specializations must be a list')
    out = sorted({str(s).strip().lower() for s in value if str(s).strip()})
    if len(out) > 30 or any(len(s) > 40 for s in out):
        raise HttpError(400, 'too many or too long specializations')
    return out


def _present(user: dict) -> dict:
    out = safe_user(user)
    out.setdefault('isActive', True)
    return out


def _list(event):
    actor = require_permission(event, 'users.manage')
    role = (query_param(event, 'role') or '').upper()
    roles = [role] if role else list(MANAGEABLE.get(actor['role'], ()))
    if actor['role'] == SUPER_ADMIN and not role:
        roles.append(SUPER_ADMIN)
    out = []
    for r in roles:
        if r not in INTERNAL_ROLES or (r not in MANAGEABLE.get(actor['role'], ()) and actor['role'] != SUPER_ADMIN):
            raise HttpError(403, 'Access denied')
        out += query_all(table('users'), IndexName='RoleIndex', KeyConditionExpression=Key('role').eq(r))
    q = (query_param(event, 'q') or '').lower()
    if q:
        out = [u for u in out if q in (u.get('name', '') + u.get('phone', '')).lower()]
    out.sort(key=lambda u: u.get('name', '').lower())
    return ok({'items': [_present(u) for u in out]})


def _create(event):
    actor = require_permission(event, 'users.manage')
    body = parse_body(event)
    role = (body.get('role') or '').upper()
    if not _can_manage(actor, role):
        raise HttpError(403, f'You cannot create {role or "this"} accounts')
    name = clean_str(body, 'name', 120, required=True)
    phone = normalize_phone(clean_str(body, 'phone', 20, required=True))
    email = clean_str(body, 'email', 120, required=True).lower()
    password = body.get('password') or ''
    if not EMAIL_RE.match(email):
        raise HttpError(400, 'invalid email address')
    if len(password) < 6:
        raise HttpError(400, 'password must be at least 6 characters')
    if table('users').query(IndexName='PhoneIndex', KeyConditionExpression=Key('phone').eq(phone), Limit=1).get('Items'):
        raise HttpError(409, 'Phone already registered')

    user = {
        'userId': new_id(), 'name': name, 'phone': phone, 'email': email, 'role': role,
        'passwordHash': bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
        'isActive': True, 'createdAt': now_iso(), 'createdBy': actor['userId'],
    }
    for f in PROFILE_FIELDS:
        if body.get(f):
            user[f] = clean_str(body, f, 500)
    if role == EXPERT:
        user['specializations'] = _specializations(body.get('specializations'))
        user['isAvailable'] = True
        user['activeConsultationCount'] = 0
        if body.get('maxActiveConsultations'):
            user['maxActiveConsultations'] = max(1, min(int(body['maxActiveConsultations']), 200))
        if body.get('experienceYears') not in (None, ''):
            user['experienceYears'] = max(0, min(int(body['experienceYears']), 70))
    table('users').put_item(Item=user, ConditionExpression='attribute_not_exists(userId)')
    audit(actor, 'USER_CREATED', 'user', user['userId'], {'role': role})
    return created(_present(user))


def _get(event, user_id):
    actor = require_permission(event, 'users.manage')
    user = table('users').get_item(Key={'userId': user_id}).get('Item')
    if not user or (user['role'] not in MANAGEABLE.get(actor['role'], ()) and actor['role'] != SUPER_ADMIN
                    and user_id != actor['userId']):
        raise HttpError(404, 'User not found')
    return ok(_present(user))


def _update(event, user_id):
    actor = require_permission(event, 'users.manage')
    user = table('users').get_item(Key={'userId': user_id}).get('Item')
    if not user:
        raise HttpError(404, 'User not found')
    if user_id == actor['userId']:
        raise HttpError(403, 'Use My Profile to change your own details')
    if not _can_manage(actor, user['role']):
        raise HttpError(403, 'You cannot modify this account')
    body = parse_body(event)
    updates = {}

    if 'role' in body and body['role'] != user['role']:
        new_role = str(body['role']).upper()
        if not _can_manage(actor, new_role):
            raise HttpError(403, f'You cannot assign the {new_role} role')
        if user['role'] == EXPERT and int(user.get('activeConsultationCount') or 0) > 0:
            raise HttpError(409, 'Reassign this expert’s open consultations before changing the role')
        updates['role'] = new_role
    if 'isActive' in body:
        updates['isActive'] = bool(body['isActive'])
        if not updates['isActive'] and user['role'] == EXPERT and int(user.get('activeConsultationCount') or 0) > 0:
            updates['isAvailable'] = False  # stop new assignments; existing ones must be reassigned
    if 'name' in body:
        updates['name'] = clean_str(body, 'name', 120, required=True)
    if 'email' in body:
        email = clean_str(body, 'email', 120).lower()
        if email and not EMAIL_RE.match(email):
            raise HttpError(400, 'invalid email address')
        updates['email'] = email or None
    for f in PROFILE_FIELDS:
        if f in body:
            updates[f] = clean_str(body, f, 500) or None
    if (updates.get('role') or user['role']) == EXPERT:
        if 'specializations' in body:
            updates['specializations'] = _specializations(body['specializations'])
        if 'isAvailable' in body:
            updates['isAvailable'] = bool(body['isAvailable'])
        if 'maxActiveConsultations' in body:
            updates['maxActiveConsultations'] = max(1, min(int(body['maxActiveConsultations']), 200))
    if not updates:
        raise HttpError(400, 'Nothing to update')
    updates['updatedAt'] = now_iso()
    updated = update_item(table('users'), {'userId': user_id}, updates)
    audit(actor, 'USER_UPDATED', 'user', user_id,
          {k: v for k, v in updates.items() if k in ('role', 'isActive', 'specializations', 'isAvailable')})
    return ok(_present(updated))


def _assignable(event):
    require_permission(event, 'crm.view')
    role = (query_param(event, 'role') or STAFF).upper()
    if role not in (STAFF, EXPERT, ADMIN):
        raise HttpError(400, 'invalid role')
    users = query_all(table('users'), IndexName='RoleIndex', KeyConditionExpression=Key('role').eq(role))
    return ok({'items': [
        {k: u.get(k) for k in ('userId', 'name', 'role', 'specializations', 'isAvailable', 'activeConsultationCount')
         if u.get(k) is not None}
        for u in sorted(users, key=lambda u: u.get('name', '').lower())
        if u.get('isActive') is not False and u.get('deletionStatus') != 'PENDING'
    ]})


def _experts(event):
    require_permission(event, 'consultation.assign')
    cfg = get_setting('assignment')
    experts = query_all(table('users'), IndexName='RoleIndex', KeyConditionExpression=Key('role').eq(EXPERT))
    default_cap = int(cfg['defaultMaxActiveConsultations'])
    general = cfg['generalSpecialization']
    rows = []
    for e in experts:
        cap = int(e.get('maxActiveConsultations') or default_cap)
        active = int(e.get('activeConsultationCount') or 0)
        rows.append({
            'userId': e['userId'], 'name': e.get('name'), 'specializations': e.get('specializations', []),
            'isActive': e.get('isActive', True), 'isAvailable': e.get('isAvailable', True),
            'activeConsultations': active, 'capacity': cap,
            'utilization': round(active * 100 / cap) if cap else None,
        })
    eligible = [r for r in rows if r['isActive'] and r['isAvailable'] and r['activeConsultations'] < r['capacity']]
    specs = {s for r in eligible for s in r['specializations']}
    coverage = []
    for crop, cats in sorted(cfg['cropCategories'].items()):
        tier = 'EXACT' if crop in specs else 'RELATED' if specs & {c.lower() for c in cats} else \
            'GENERAL' if general in specs else 'NONE'
        coverage.append({'crop': crop, 'tier': tier})
    awaiting = table('consultations').query(IndexName='StatusIndex',
                                            KeyConditionExpression=Key('status').eq('AWAITING_ASSIGNMENT'),
                                            Select='COUNT')['Count']
    return ok({'experts': rows, 'coverage': coverage, 'awaitingAssignment': awaiting,
               'hasGeneralExpert': any(general in r['specializations'] for r in eligible)})
