import json
import decimal
import traceback


def _encode(obj):
    if isinstance(obj, decimal.Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return str(obj)


def _json(status: int, body):
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(body, default=_encode),
    }


def ok(body):          return _json(200, body)
def created(body):     return _json(201, body)
def no_content():      return {'statusCode': 204, 'headers': {}, 'body': ''}
def bad_request(msg):  return _json(400, {'error': msg})
def unauthorized(msg='Unauthorized'): return _json(401, {'error': msg})
def forbidden(msg='Forbidden'):       return _json(403, {'error': msg})
def not_found(msg='Not found'):       return _json(404, {'error': msg})
def conflict(msg):     return _json(409, {'error': msg})


def server_err(exc=None):
    if exc:
        print(traceback.format_exc())
    return _json(500, {'error': 'Internal server error'})


def parse_body(event: dict) -> dict:
    body = event.get('body') or ''
    if not body:
        return {}
    try:
        return json.loads(body)
    except Exception:
        return {}


def method(event: dict) -> str:
    return event['requestContext']['http']['method'].upper()


def path_param(event: dict, key: str = 'proxy') -> str | None:
    params = event.get('pathParameters') or {}
    return params.get(key)


def query_param(event: dict, key: str) -> str | None:
    params = event.get('queryStringParameters') or {}
    return params.get(key)
