#!/usr/bin/env python3
"""
One-time bootstrap: create the first ADMIN user directly in DynamoDB.

There is no API route to create an admin — /auth/register always creates a
FARMER, and every admin-only endpoint requires an existing ADMIN token. Run
this once after the backend stack is deployed.

Usage:
  pip install boto3 bcrypt
  python3 create_admin.py --name "Admin Name" --phone 9999999999 --password 'StrongPass123'
"""
import argparse
import time
import uuid

import bcrypt
import boto3
from boto3.dynamodb.conditions import Key


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', required=True)
    parser.add_argument('--phone', required=True)
    parser.add_argument('--password', required=True)
    parser.add_argument('--table', default='naveena-users')
    parser.add_argument('--region', default='ap-south-1')
    args = parser.parse_args()

    if len(args.password) < 6:
        raise SystemExit('password must be at least 6 characters')

    table = boto3.resource('dynamodb', region_name=args.region).Table(args.table)

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
        'passwordHash': pw_hash,
        'role':         'ADMIN',
        'createdAt':    time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    table.put_item(Item=user)
    print(f"Created ADMIN user {user['userId']} ({args.name}, {args.phone})")


if __name__ == '__main__':
    main()
