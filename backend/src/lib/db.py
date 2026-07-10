import os
import base64
import json
import boto3
from boto3.dynamodb.conditions import Key, Attr  # noqa: F401 — re-exported for handlers

# Module-level client — created once per container, reused across warm invocations.
_endpoint_url = os.environ.get('DYNAMODB_ENDPOINT_URL')
_resource = boto3.resource('dynamodb', endpoint_url=_endpoint_url) if _endpoint_url else boto3.resource('dynamodb')

TABLES = {
    'users':         os.environ['USERS_TABLE'],
    'lands':         os.environ['LANDS_TABLE'],
    'crop_cycles':   os.environ['CROP_CYCLES_TABLE'],
    'daily_records': os.environ['DAILY_RECORDS_TABLE'],
    'products':      os.environ['PRODUCTS_TABLE'],
    'orders':        os.environ['ORDERS_TABLE'],
    'advice':        os.environ['ADVICE_TABLE'],
    'notifications': os.environ['NOTIFICATIONS_TABLE'],
    'enquiries':     os.environ['ENQUIRIES_TABLE'],
    'symptoms':      os.environ['SYMPTOMS_TABLE'],
}


def table(name: str):
    return _resource.Table(TABLES[name])


def encode_key(last_key: dict | None) -> str | None:
    if not last_key:
        return None
    return base64.urlsafe_b64encode(json.dumps(last_key).encode()).decode()


def decode_key(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        return json.loads(base64.urlsafe_b64decode(token.encode()).decode())
    except Exception:
        return None
