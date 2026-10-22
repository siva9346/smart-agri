import re
import time
import uuid
from decimal import Decimal, ROUND_HALF_UP

PHONE_RE = re.compile(r'^\+?[0-9]{8,15}$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


class HttpError(Exception):
    """Raised from deep inside a handler to short-circuit with a 4xx response."""
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def now_iso() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def iso_in(seconds: int) -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + seconds))


def today() -> str:
    return time.strftime('%Y-%m-%d', time.gmtime())


def new_id() -> str:
    return str(uuid.uuid4())


def stable_id(*parts: str) -> str:
    """Deterministic id from the given parts — used for idempotent creates."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, '|'.join(parts)))


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def to_decimal(value, field: str, minimum=None, maximum=None) -> Decimal:
    try:
        d = Decimal(str(value))
    except Exception:
        raise HttpError(400, f'{field} must be a number')
    if not d.is_finite():
        raise HttpError(400, f'{field} must be a number')
    if minimum is not None and d < Decimal(str(minimum)):
        raise HttpError(400, f'{field} must be at least {minimum}')
    if maximum is not None and d > Decimal(str(maximum)):
        raise HttpError(400, f'{field} must be at most {maximum}')
    return d


def clean_str(body: dict, key: str, max_len: int = 500, required: bool = False) -> str:
    value = body.get(key)
    value = value.strip() if isinstance(value, str) else ''
    if required and not value:
        raise HttpError(400, f'{key} required')
    if len(value) > max_len:
        raise HttpError(400, f'{key} must be at most {max_len} characters')
    return value


def normalize_phone(phone: str) -> str:
    phone = re.sub(r'[\s\-()]', '', phone or '')
    if not PHONE_RE.match(phone):
        raise HttpError(400, 'invalid phone number')
    return phone


def update_item(tbl, key: dict, updates: dict, condition=None):
    """SET every key in `updates` (None values are REMOVEd)."""
    sets = {k: v for k, v in updates.items() if v is not None}
    removes = [k for k, v in updates.items() if v is None]
    expr = []
    if sets:
        expr.append('SET ' + ', '.join(f'#{k} = :{k}' for k in sets))
    if removes:
        expr.append('REMOVE ' + ', '.join(f'#{k}' for k in removes))
    kwargs = {
        'Key': key,
        'UpdateExpression': ' '.join(expr),
        'ExpressionAttributeNames': {f'#{k}': k for k in updates},
        'ReturnValues': 'ALL_NEW',
    }
    if sets:
        kwargs['ExpressionAttributeValues'] = {f':{k}': v for k, v in sets.items()}
    if condition is not None:
        kwargs['ConditionExpression'] = condition
    return tbl.update_item(**kwargs).get('Attributes', {})


def query_all(tbl, max_items: int = 5000, **kwargs) -> list:
    items = []
    while True:
        resp = tbl.query(**kwargs)
        items.extend(resp.get('Items', []))
        if not resp.get('LastEvaluatedKey') or len(items) >= max_items:
            return items
        kwargs['ExclusiveStartKey'] = resp['LastEvaluatedKey']


def scan_all(tbl, max_items: int = 20000, **kwargs) -> list:
    items = []
    while True:
        resp = tbl.scan(**kwargs)
        items.extend(resp.get('Items', []))
        if not resp.get('LastEvaluatedKey') or len(items) >= max_items:
            return items
        kwargs['ExclusiveStartKey'] = resp['LastEvaluatedKey']


def safe_user(user: dict | None) -> dict | None:
    if not user:
        return None
    return {k: v for k, v in user.items() if k not in ('passwordHash', 'resetOtpHash', 'resetOtpExpiresAt')}


def user_summary(user: dict | None) -> dict | None:
    """Minimal identity for embedding in other records / responses."""
    if not user:
        return None
    return {k: user[k] for k in ('userId', 'name', 'phone', 'role') if k in user}
