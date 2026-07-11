#!/usr/bin/env python3
"""
One-time bootstrap: create the SUPER_ADMIN user directly in DynamoDB.

There is no API route to create the super admin – /auth/register always
creates a FARMER. The super admin is the only account that can create the
one regular ADMIN account (via the in-app "Add Admin" screen, which calls
POST /auth/register-admin). Run this once, right after the backend stack is
deployed; it refuses if a SUPER_ADMIN already exists.

Usage:
  pip install boto3 bcrypt
  python3 create_admin.py --name "Owner Name" --phone 9999999999 \
      --password 'StrongPass123' --email owner@example.com
"""
import argparse
import re
import time
import uuid

import bcrypt
import boto3
from boto3.dynamodb.conditions import Attr, Key

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', required=True)
    parser.add_argument('--phone', required=True)
    parser.add_argument('--password', required=True)
    parser.add_argument('--email', required=True, help='Used for forgot-password OTP delivery')
    parser.add_argument('--table', default='naveena-users')
    parser.add_argument('--region', default='ap-south-1')
    args = parser.parse_args()

    if len(args.password) < 6:
        raise SystemExit('password must be at least 6 characters')
    if not EMAIL_RE.match(args.email):
        raise SystemExit('invalid email address')

    table = boto3.resource('dynamodb', region_name=args.region).Table(args.table)

    existing_super = table.scan(
        FilterExpression=Attr('role').eq('SUPER_ADMIN'),
        Select='COUNT',
    )['Count']
    if existing_super >= 1:
        raise SystemExit('A SUPER_ADMIN already exists — refusing to create another.')

    existing = table.query(
        IndexName='PhoneIndex',
        KeyConditionExpression=Key('phone').eq(args.phone),
        Limit=1,
    )
    if existing.get('Items'):
        raise SystemExit(f'Phone {args.phone} is already registered')

    pw_hash = bcrypt.hashpw(args.password.encode(), bcrypt.gensalt()).decode()
    user = {
        'userId':       str(uuid.uuid4()),
        'name':         args.name,
        'phone':        args.phone,
        'email':        args.email.strip().lower(),
        'passwordHash': pw_hash,
        'role':         'SUPER_ADMIN',
        'createdAt':    time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    table.put_item(Item=user)
    print(f"Created SUPER_ADMIN user {user['userId']} ({args.name}, {args.phone})")


if __name__ == '__main__':
    main()
