#!/usr/bin/env python3
"""
Local development API: runs the real Lambda handlers against moto's in-memory
DynamoDB / SSM / S3 (tables built from template.yaml), seeded with one user per
role, so the app can be exercised end-to-end without deploying.

Usage:
  pip install -r backend/tests/requirements.txt
  python backend/scripts/local_api.py            # http://localhost:3001
  EXPO_PUBLIC_API_URL=http://localhost:3001 npx expo start --web

All data is lost when the process stops. Seeded logins (password: password1):
  9000000001 Super Admin · 9000000002 Admin · 9000000003 Staff
  9000000004 Expert (tomato) · 9000000005 Expert (general) · 9000000006 Farmer
"""
import importlib
import json
import os
import sys
import uuid
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qsl

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tests'))

import conftest  # noqa: E402  — starts moto, sets env vars, loads table definitions

PORT = int(os.environ.get('PORT', '3001'))

# path prefix → handler module (mirrors the HttpApi routes in template.yaml)
ROUTES = {
    'auth': 'auth', 'farmers': 'farmers', 'lands': 'lands', 'crop-cycles': 'crop_cycles', 'records': 'records',
    'products': 'products', 'orders': 'orders', 'advice': 'advice', 'notifications': 'notifications',
    'enquiries': 'enquiries', 'symptoms': 'symptoms', 'consultations': 'consultations', 'crm': 'crm',
    'quotations': 'quotations', 'tasks': 'tasks', 'users': 'users', 'profile': 'profile', 'ai': 'ai',
    'admin': 'admin', 'dashboard': 'admin', 'account': 'delete_account', 'whatsapp': 'whatsapp',
}
_modules = {}


def _handler(name):
    if name not in _modules:
        _modules[name] = importlib.import_module(f'handlers.{name}')
    return _modules[name]


def seed():
    import bcrypt
    import boto3
    from lib.db import table
    conftest._create_tables()
    boto3.client('s3', region_name='ap-south-1').create_bucket(
        Bucket='test-photos', CreateBucketConfiguration={'LocationConstraint': 'ap-south-1'})
    pw = bcrypt.hashpw(b'password1', bcrypt.gensalt(4)).decode()
    people = [
        ('SUPER_ADMIN', 'Sivaprasath (Super Admin)', '9000000001', {}),
        ('ADMIN', 'Anitha (Admin)', '9000000002', {}),
        ('STAFF', 'Ravi (Staff)', '9000000003', {'department': 'Sales', 'jobTitle': 'Field Executive'}),
        ('EXPERT', 'Dr. Meena (Tomato expert)', '9000000004',
         {'specializations': ['tomato', 'vegetables'], 'isAvailable': True, 'activeConsultationCount': 0,
          'qualifications': 'M.Sc. Plant Pathology', 'experienceYears': 9}),
        ('EXPERT', 'Kumar (General agronomist)', '9000000005',
         {'specializations': ['general'], 'isAvailable': True, 'activeConsultationCount': 0}),
        ('FARMER', 'Murugan', '9000000006', {'village': 'Gobichettipalayam', 'district': 'Erode'}),
    ]
    ids = {}
    for role, name, phone, extra in people:
        uid = str(uuid.uuid4())
        ids[phone] = uid
        table('users').put_item(Item={'userId': uid, 'role': role, 'name': name, 'phone': phone,
                                      'email': f'{phone}@example.com', 'passwordHash': pw, 'isActive': True,
                                      'createdAt': '2026-01-01T00:00:00Z', **extra})
    farmer = ids['9000000006']
    land_id = str(uuid.uuid4())
    table('lands').put_item(Item={'landId': land_id, 'farmerId': farmer, 'name': 'North field', 'area': Decimal('2.5'),
                                  'areaUnit': 'acres', 'village': 'Gobichettipalayam', 'soilType': 'Red soil',
                                  'createdAt': '2026-01-02T00:00:00Z'})
    table('crop_cycles').put_item(Item={'landId': land_id, 'cycleId': str(uuid.uuid4()), 'cropName': 'Tomato',
                                        'variety': 'PKM-1', 'area': '1', 'startDate': '2026-09-01', 'status': 'ACTIVE',
                                        'farmerId': farmer, 'notes': '', 'createdAt': '2026-09-01T00:00:00Z'})
    for name, price, unit, cat, tax in [('Neem Oil 1500 ppm', '450.00', 'litre', 'Bio-pesticide', '18'),
                                        ('Mancozeb 75% WP', '320.00', 'kg', 'Fungicide', '18'),
                                        ('Vermicompost', '12.00', 'kg', 'Organic manure', '5'),
                                        ('Drip Irrigation Kit (1 acre)', '18500.00', 'set', 'Irrigation', '12'),
                                        ('Hybrid Tomato Seeds', '850.00', 'packet', 'Seeds', '0')]:
        table('products').put_item(Item={'productId': str(uuid.uuid4()), 'name': name, 'price': Decimal(price),
                                         'unit': unit, 'stock': 200, 'category': cat, 'isActive': True,
                                         'description': f'{name} for field use', 'taxRatePct': Decimal(tax),
                                         'createdAt': '2026-01-01T00:00:00Z'})


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Hub-Signature-256')

    def _dispatch(self):
        url = urlparse(self.path)
        parts = [p for p in url.path.split('/') if p]
        if parts and parts[0] == 'v1':
            parts = parts[1:]
        if self.command == 'OPTIONS':
            self.send_response(204); self._cors(); self.end_headers(); return
        if not parts or parts[0] not in ROUTES:
            return self._send(404, {'error': 'Unknown route'})
        length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(length).decode() if length else None
        event = {
            'requestContext': {'http': {'method': self.command}},
            'rawPath': '/' + '/'.join(parts),
            'pathParameters': {'proxy': '/'.join(parts[1:])} if len(parts) > 1 else None,
            'headers': {k.lower(): v for k, v in self.headers.items()},
            'queryStringParameters': dict(parse_qsl(url.query)) or None,
            'body': body,
        }
        try:
            resp = _handler(ROUTES[parts[0]]).handler(event, None)
        except Exception as e:  # surfaced the same way API Gateway would
            print(f'handler crash: {e!r}')
            return self._send(500, {'error': 'Internal server error'})
        self.send_response(resp['statusCode'])
        self._cors()
        for k, v in (resp.get('headers') or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if resp.get('body'):
            self.wfile.write(resp['body'].encode())

    def _send(self, status, obj):
        self.send_response(status); self._cors()
        self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps(obj).encode())

    do_GET = do_POST = do_PUT = do_DELETE = do_OPTIONS = _dispatch

    def log_message(self, fmt, *args):
        sys.stderr.write(f'{self.command} {self.path} → {args[1] if len(args) > 1 else ""}\n')


if __name__ == '__main__':
    seed()
    print(f'Local Smart Agri API on http://localhost:{PORT}  (password for seeded users: password1)')
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()  # single-threaded: moto state is not thread-safe
