"""
Append-only audit log for sensitive operations.

Items are partitioned by UTC day so the newest entries can be read with a
single query; EntityIndex gives the history of one lead / quotation / user.
Never pass secrets in `details` — callers log *that* a key changed, not the key.
"""
from lib.db import table
from lib.util import now_iso, new_id, today


def audit(actor: dict | None, action: str, entity_type: str, entity_id: str, details: dict | None = None):
    ts = now_iso()
    audit_id = new_id()
    item = {
        'auditDay':   today(),
        'sortKey':    f'{ts}#{audit_id}',
        'auditId':    audit_id,
        'action':     action,
        'entityType': entity_type,
        'entityId':   entity_id or '-',
        'actorId':    (actor or {}).get('userId', 'system'),
        'actorName':  (actor or {}).get('name', 'System'),
        'actorRole':  (actor or {}).get('role', 'SYSTEM'),
        'createdAt':  ts,
    }
    if details:
        item['details'] = details
    try:
        table('audit').put_item(Item=item)
    except Exception as e:  # auditing must never break the operation it records
        print(f'audit write failed: {e}')
