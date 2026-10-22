"""
Scheduled Lambda (EventBridge, rate(1 day)) — permanently purges accounts
that requested deletion more than DELETION_GRACE_DAYS ago.

Not an HTTP handler: invoked directly by an EventBridge Schedule rule, so
there is no API Gateway event shape and no JWT to check here.

Data handling on purge (see docs/account-deletion.html for the public-facing
version of this policy):
  - Hard-deleted: the user row, their lands, crop cycles, daily records
    (including any S3 photos), expert-advice requests, and enquiries.
  - Anonymized (not deleted): their orders — item/amount/date history is kept
    for accounting integrity (and so admin Sales Report stays accurate for
    other customers), but customerId/address/notes are replaced with
    non-identifying placeholders so the order can no longer be linked back
    to the deleted user.
  - Hard-deleted: their expert consultations (with crop photos) and their
    per-user notification inbox records.
  - Anonymized: CRM leads and quotations linked to them (name/phone/email/location
    replaced) so sales reporting stays accurate without identifying them.
  - Untouched: announcement records (the broadcast itself, not per-user state) and
    the products/symptoms reference catalogues (not user-owned data).
"""
import os
import time
import calendar
import boto3
from boto3.dynamodb.conditions import Key, Attr

from lib.db import table

DELETION_GRACE_DAYS = 30
ANONYMOUS_ID = '00000000-0000-0000-0000-000000000000'

PHOTOS_BUCKET = os.environ.get('PHOTOS_BUCKET', '')
AWS_REGION = os.environ.get('AWS_REGION', 'ap-south-1')

_s3 = boto3.client('s3')


def handler(event, _ctx):
    cutoff_ts = time.time() - DELETION_GRACE_DAYS * 24 * 60 * 60
    purged = 0

    users_tbl = table('users')
    scan_kwargs = {'FilterExpression': Attr('deletionStatus').eq('PENDING')}
    while True:
        resp = users_tbl.scan(**scan_kwargs)
        for user in resp.get('Items', []):
            requested_ts = _parse_iso(user.get('deletionRequestedAt'))
            if requested_ts is None or requested_ts > cutoff_ts:
                continue  # still inside the 30-day grace period
            _purge_user(user['userId'])
            purged += 1
        if not resp.get('LastEvaluatedKey'):
            break
        scan_kwargs['ExclusiveStartKey'] = resp['LastEvaluatedKey']

    print(f'cleanup_deleted_accounts: purged {purged} account(s)')
    return {'purged': purged}


def _parse_iso(ts):
    if not ts:
        return None
    try:
        # ts is always UTC ('...Z'), written via time.strftime(..., time.gmtime());
        # timegm (not mktime) is required so this isn't skewed by the Lambda's
        # local timezone setting.
        return calendar.timegm(time.strptime(ts, '%Y-%m-%dT%H:%M:%SZ'))
    except Exception:
        return None


def _query_all(tbl, **kwargs):
    items = []
    while True:
        resp = tbl.query(**kwargs)
        items.extend(resp.get('Items', []))
        if not resp.get('LastEvaluatedKey'):
            return items
        kwargs['ExclusiveStartKey'] = resp['LastEvaluatedKey']


def _purge_user(user_id: str):
    _purge_lands_and_descendants(user_id)
    _anonymize_orders(user_id)
    _delete_by_farmer_index('advice', 'adviceId', user_id)
    _delete_by_farmer_index('enquiries', 'enquiryId', user_id)
    _purge_consultations(user_id)
    _purge_inbox(user_id)
    _anonymize_crm(user_id)
    table('users').delete_item(Key={'userId': user_id})


def _purge_consultations(customer_id: str):
    tbl = table('consultations')
    for c in _query_all(tbl, IndexName='CustomerIndex', KeyConditionExpression=Key('customerId').eq(customer_id)):
        for key in c.get('photoKeys', []):
            try:
                _s3.delete_object(Bucket=PHOTOS_BUCKET, Key=key)
            except Exception:
                pass
        tbl.delete_item(Key={'consultationId': c['consultationId']})


def _purge_inbox(user_id: str):
    tbl = table('inbox')
    with tbl.batch_writer() as batch:
        for i in _query_all(tbl, KeyConditionExpression=Key('userId').eq(user_id), ProjectionExpression='recipientKey'):
            batch.delete_item(Key={'userId': user_id, 'recipientKey': i['recipientKey']})


def _anonymize_crm(customer_id: str):
    leads = table('leads')
    for lead in _query_all(leads, IndexName='CustomerIndex', KeyConditionExpression=Key('customerId').eq(customer_id)):
        leads.update_item(
            Key={'leadId': lead['leadId']},
            UpdateExpression='SET customerId = :cid, customerName = :d, phone = :d, #loc = :d, searchText = :e '
                             'REMOVE email, consultationId',
            ExpressionAttributeNames={'#loc': 'location'},
            ExpressionAttributeValues={':cid': ANONYMOUS_ID, ':d': '[deleted]', ':e': ''},
        )
    quotes = table('quotations')
    for q in _query_all(quotes, IndexName='CustomerIndex', KeyConditionExpression=Key('customerId').eq(customer_id)):
        quotes.update_item(
            Key={'quotationId': q['quotationId']},
            UpdateExpression='SET customerId = :cid, customerName = :d, customerPhone = :d, customerLocation = :d',
            ExpressionAttributeValues={':cid': ANONYMOUS_ID, ':d': '[deleted]'},
        )


def _purge_lands_and_descendants(farmer_id: str):
    lands_tbl = table('lands')
    for land in _query_all(lands_tbl, IndexName='FarmerIndex', KeyConditionExpression=Key('farmerId').eq(farmer_id)):
        land_id = land['landId']
        cycles_tbl = table('crop_cycles')
        for cycle in _query_all(cycles_tbl, KeyConditionExpression=Key('landId').eq(land_id)):
            cycle_id = cycle['cycleId']
            records_tbl = table('daily_records')
            for record in _query_all(records_tbl, KeyConditionExpression=Key('cycleId').eq(cycle_id)):
                _delete_photo_if_owned(record.get('image'))
                records_tbl.delete_item(Key={'cycleId': cycle_id, 'sortKey': record['sortKey']})
            cycles_tbl.delete_item(Key={'landId': land_id, 'cycleId': cycle_id})
        lands_tbl.delete_item(Key={'landId': land_id})


def _anonymize_orders(customer_id: str):
    orders_tbl = table('orders')
    for order in _query_all(orders_tbl, IndexName='CustomerIndex', KeyConditionExpression=Key('customerId').eq(customer_id)):
        orders_tbl.update_item(
            Key={'orderId': order['orderId']},
            UpdateExpression='SET customerId = :cid, address = :addr, notes = :notes',
            ExpressionAttributeValues={
                ':cid':   ANONYMOUS_ID,
                ':addr':  '[deleted]',
                ':notes': '',
            },
        )


def _delete_by_farmer_index(table_name: str, id_field: str, farmer_id: str):
    tbl = table(table_name)
    for item in _query_all(tbl, IndexName='FarmerIndex', KeyConditionExpression=Key('farmerId').eq(farmer_id)):
        tbl.delete_item(Key={id_field: item[id_field]})


def _delete_photo_if_owned(url):
    if not url:
        return
    prefix = f'https://{PHOTOS_BUCKET}.s3.{AWS_REGION}.amazonaws.com/'
    if not url.startswith(prefix):
        return
    key = url[len(prefix):]
    try:
        _s3.delete_object(Bucket=PHOTOS_BUCKET, Key=key)
    except Exception:
        pass
