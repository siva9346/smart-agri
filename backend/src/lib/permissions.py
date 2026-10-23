"""
Role-based access control for the CRM / consultation / AI features.

Roles: SUPER_ADMIN > ADMIN > STAFF, EXPERT (internal) and FARMER (customer).

DEFAULT_PERMISSIONS is the baseline. A Super Admin can grant or revoke
permissions per role through the `permissions` setting, with two hard limits
enforced here regardless of settings:
  - customers (FARMER) can never receive an internal permission;
  - SUPER_ADMIN always keeps every permission.

`require_actor` re-reads the user record so a deactivated account is locked
out immediately, not only when its 30-day JWT expires.
"""
from lib.auth import require_auth, ForbiddenError, AuthError
from lib.db import table
from lib.settings import get_setting

SUPER_ADMIN, ADMIN, STAFF, EXPERT, FARMER = 'SUPER_ADMIN', 'ADMIN', 'STAFF', 'EXPERT', 'FARMER'
ALL_ROLES = (SUPER_ADMIN, ADMIN, STAFF, EXPERT, FARMER)
INTERNAL_ROLES = (SUPER_ADMIN, ADMIN, STAFF, EXPERT)
ADMIN_ROLES = (SUPER_ADMIN, ADMIN)

# Permissions a customer may hold — anything else is internal-only.
CUSTOMER_PERMISSIONS = {
    'consultation.create', 'quotation.respond', 'ai.use', 'profile.edit',
}

DEFAULT_PERMISSIONS = {
    'crm.view':               {SUPER_ADMIN, ADMIN, STAFF, EXPERT},
    'crm.view_all':           {SUPER_ADMIN, ADMIN},
    'lead.create':            {SUPER_ADMIN, ADMIN, STAFF},
    'lead.edit':              {SUPER_ADMIN, ADMIN, STAFF},
    'lead.assign':            {SUPER_ADMIN, ADMIN},
    'lead.communicate':       {SUPER_ADMIN, ADMIN, STAFF, EXPERT},
    'consultation.create':    {FARMER},
    'consultation.assign':    {SUPER_ADMIN, ADMIN},
    'consultation.recommend': {SUPER_ADMIN, ADMIN, EXPERT},
    'product.view':           {SUPER_ADMIN, ADMIN, STAFF, EXPERT},  # catalogue; customers see products only via quotations
    'quotation.view':         {SUPER_ADMIN, ADMIN, STAFF, EXPERT},
    'quotation.create':       {SUPER_ADMIN, ADMIN, STAFF},
    'quotation.approve':      {SUPER_ADMIN, ADMIN},
    'quotation.share':        {SUPER_ADMIN, ADMIN, STAFF},
    'quotation.respond':      {FARMER},
    'tasks.manage':           {SUPER_ADMIN, ADMIN, STAFF, EXPERT},
    'tasks.assign_others':    {SUPER_ADMIN, ADMIN},
    'users.manage':           {SUPER_ADMIN, ADMIN},
    'announcements.send':     {SUPER_ADMIN, ADMIN},
    'reports.team':           {SUPER_ADMIN, ADMIN},
    'settings.assignment':    {SUPER_ADMIN},
    'settings.quotation':     {SUPER_ADMIN},
    'settings.permissions':   {SUPER_ADMIN},
    'ai.configure':           {SUPER_ADMIN},
    'integrations.configure': {SUPER_ADMIN},
    'automation.manage':      {SUPER_ADMIN, ADMIN},
    'ai.use':                 {SUPER_ADMIN, ADMIN, STAFF, EXPERT, FARMER},
    'audit.view':             {SUPER_ADMIN},
    'profile.edit':           {SUPER_ADMIN, ADMIN, STAFF, EXPERT, FARMER},
}


def permissions_for(role: str) -> set[str]:
    if role == SUPER_ADMIN:
        return set(DEFAULT_PERMISSIONS)
    perms = {p for p, roles in DEFAULT_PERMISSIONS.items() if role in roles}
    overrides = get_setting('permissions')
    perms |= set(overrides.get('grants', {}).get(role, []))
    perms -= set(overrides.get('revokes', {}).get(role, []))
    perms &= set(DEFAULT_PERMISSIONS)
    if role == FARMER:
        perms &= CUSTOMER_PERMISSIONS
    return perms


def has_permission(actor: dict, perm: str) -> bool:
    return perm in permissions_for(actor.get('role'))


def require_actor(event, *roles: str) -> dict:
    """Authenticate, load the live user record, and optionally restrict roles."""
    payload = require_auth(event)
    user = table('users').get_item(Key={'userId': payload['userId']}).get('Item')
    if not user:
        raise AuthError('Account not found')
    if user.get('isActive') is False or user.get('deletionStatus') == 'PENDING':
        raise ForbiddenError('This account is deactivated')
    if roles and user.get('role') not in roles:
        raise ForbiddenError('Access denied')
    return user


def require_permission(event, perm: str) -> dict:
    actor = require_actor(event)
    if not has_permission(actor, perm):
        raise ForbiddenError('You do not have permission to perform this action')
    return actor


def ensure(actor: dict, perm: str):
    if not has_permission(actor, perm):
        raise ForbiddenError('You do not have permission to perform this action')


def is_admin(actor: dict) -> bool:
    return actor.get('role') in ADMIN_ROLES


# ── Record-level rules ──────────────────────────────────────────────────────

def can_view_lead(actor: dict, lead: dict) -> bool:
    if has_permission(actor, 'crm.view_all'):
        return True
    if not has_permission(actor, 'crm.view'):
        return False
    uid = actor['userId']
    if actor['role'] == EXPERT:
        return lead.get('expertId') == uid
    # Staff: own leads plus the unassigned shared pool.
    return lead.get('ownerId') in (uid, 'UNASSIGNED')


def can_edit_lead(actor: dict, lead: dict) -> bool:
    if not has_permission(actor, 'lead.edit'):
        return False
    return can_view_lead(actor, lead)


def can_view_consultation(actor: dict, c: dict) -> bool:
    role = actor['role']
    if role == FARMER:
        return c.get('customerId') == actor['userId']
    if role == EXPERT:
        return c.get('expertId') == actor['userId']
    if role in ADMIN_ROLES:
        return True
    if role == STAFF:
        # Staff see consultations through the lead they handle.
        return c.get('leadOwnerId') in (actor['userId'], 'UNASSIGNED')
    return False
