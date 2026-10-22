"""
Test harness: moto-mocked DynamoDB / SSM / S3, with tables built from the real
template.yaml so key schemas and GSIs under test match what gets deployed.

Run:  cd backend && pip install -r tests/requirements.txt && pytest -q
"""
import base64
import json
import os
import sys
import time
import uuid

import pytest
import yaml

HERE = os.path.dirname(__file__)
SRC = os.path.abspath(os.path.join(HERE, '..', 'src'))
TEMPLATE = os.path.abspath(os.path.join(HERE, '..', 'template.yaml'))

os.environ.update({
    'AWS_ACCESS_KEY_ID': 'testing', 'AWS_SECRET_ACCESS_KEY': 'testing', 'AWS_SESSION_TOKEN': 'testing',
    'AWS_DEFAULT_REGION': 'ap-south-1', 'AWS_REGION': 'ap-south-1',
    'JWT_SECRET': 'test-secret', 'PHOTOS_BUCKET': 'test-photos', 'EMAIL_FUNCTION_NAME': 'email',
})
os.environ.pop('AWS_LAMBDA_FUNCTION_NAME', None)
sys.path.insert(0, SRC)

from moto import mock_aws  # noqa: E402

_mock = mock_aws()
_mock.start()


class _CfnLoader(yaml.SafeLoader):
    pass


for _tag in ('!Ref', '!Sub', '!GetAtt', '!If', '!Equals', '!Not', '!Join', '!Select', '!Split', '!FindInMap'):
    _CfnLoader.add_constructor(_tag, lambda loader, node: None)

with open(TEMPLATE) as f:
    _TEMPLATE = yaml.load(f, Loader=_CfnLoader)

TABLE_DEFS = {}
for logical, res in _TEMPLATE['Resources'].items():
    if res['Type'] == 'AWS::DynamoDB::Table':
        TABLE_DEFS[logical] = res['Properties']

ENV_FOR_TABLE = {
    'UsersTable': 'USERS_TABLE', 'LandsTable': 'LANDS_TABLE', 'CropCyclesTable': 'CROP_CYCLES_TABLE',
    'DailyRecordsTable': 'DAILY_RECORDS_TABLE', 'ProductsTable': 'PRODUCTS_TABLE', 'OrdersTable': 'ORDERS_TABLE',
    'AdviceTable': 'ADVICE_TABLE', 'NotificationsTable': 'NOTIFICATIONS_TABLE', 'EnquiriesTable': 'ENQUIRIES_TABLE',
    'SymptomsTable': 'SYMPTOMS_TABLE', 'ConsultationsTable': 'CONSULTATIONS_TABLE', 'LeadsTable': 'LEADS_TABLE',
    'LeadActivitiesTable': 'LEAD_ACTIVITIES_TABLE', 'QuotationsTable': 'QUOTATIONS_TABLE', 'TasksTable': 'TASKS_TABLE',
    'InboxTable': 'INBOX_TABLE', 'SettingsTable': 'SETTINGS_TABLE', 'AuditTable': 'AUDIT_TABLE',
}
for logical, env in ENV_FOR_TABLE.items():
    os.environ[env] = TABLE_DEFS[logical]['TableName']

import boto3  # noqa: E402

_ddb = boto3.client('dynamodb', region_name='ap-south-1')
_s3 = boto3.client('s3', region_name='ap-south-1')


def _create_tables():
    for props in TABLE_DEFS.values():
        kwargs = {
            'TableName': props['TableName'],
            'AttributeDefinitions': props['AttributeDefinitions'],
            'KeySchema': props['KeySchema'],
            'BillingMode': 'PAY_PER_REQUEST',
        }
        if props.get('GlobalSecondaryIndexes'):
            kwargs['GlobalSecondaryIndexes'] = props['GlobalSecondaryIndexes']
        _ddb.create_table(**kwargs)


def _drop_tables():
    for name in _ddb.list_tables()['TableNames']:
        _ddb.delete_table(TableName=name)


@pytest.fixture(autouse=True)
def fresh_state():
    _create_tables()
    try:
        _s3.create_bucket(Bucket='test-photos', CreateBucketConfiguration={'LocationConstraint': 'ap-south-1'})
    except _s3.exceptions.BucketAlreadyOwnedByYou:
        pass
    from lib import settings, ai, secrets
    settings._cache.clear()
    ai._key_cache.clear()
    secrets._cache.clear()
    yield
    _drop_tables()
    ssm = boto3.client('ssm', region_name='ap-south-1')
    for p in ssm.describe_parameters().get('Parameters', []):
        ssm.delete_parameter(Name=p['Name'])


# ── helpers ─────────────────────────────────────────────────────────────────

from lib.db import table  # noqa: E402
from lib.auth import sign_token  # noqa: E402


def make_user(role='FARMER', name=None, phone=None, **extra):
    uid = str(uuid.uuid4())
    user = {
        'userId': uid, 'role': role, 'name': name or f'{role.title()} {uid[:4]}',
        'phone': phone or f'9{int(time.time() * 1e6) % 10**9:09d}', 'email': f'{uid[:6]}@example.com',
        'passwordHash': '$2b$04$abcdefghijklmnopqrstuuJ0nC0eVUfCCgL0G1XcH1jF9W1t4v1n6',
        'createdAt': '2026-01-01T00:00:00Z', 'village': 'Erode', 'district': 'Erode', **extra,
    }
    if role == 'EXPERT':
        user.setdefault('specializations', [])
        user.setdefault('isAvailable', True)
        user.setdefault('activeConsultationCount', 0)
    table('users').put_item(Item=user)
    user['token'] = sign_token(uid, role)
    return user


def make_product(name='Neem Oil', price='250.00', stock=100, unit='litre', **extra):
    from decimal import Decimal
    p = {'productId': str(uuid.uuid4()), 'name': name, 'price': Decimal(price), 'stock': stock, 'unit': unit,
         'category': 'Pesticide', 'description': f'{name} description', 'isActive': True, **extra}
    table('products').put_item(Item=p)
    return p


def call(handler_module, method, path='', user=None, body=None, query=None, raw_path=None):
    event = {
        'requestContext': {'http': {'method': method}},
        'pathParameters': {'proxy': path} if path else None,
        'headers': {'authorization': f"Bearer {user['token']}"} if user else {},
        'body': json.dumps(body) if body is not None else None,
        'queryStringParameters': query,
        'rawPath': raw_path or '',
    }
    resp = handler_module.handler(event, None)
    data = json.loads(resp['body']) if resp.get('body') else None
    return resp['statusCode'], data


def inbox(user):
    from boto3.dynamodb.conditions import Key
    return table('inbox').query(KeyConditionExpression=Key('userId').eq(user['userId']))['Items']


TINY_PNG = base64.b64encode(
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
    b'\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82').decode()
