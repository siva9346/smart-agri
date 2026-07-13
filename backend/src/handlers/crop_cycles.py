"""
GET    /crop-cycles?landId=x  – list cycles for a land
POST   /crop-cycles            – create crop cycle
GET    /crop-cycles/{id}       – get cycle by cycleId (via GSI)
PUT    /crop-cycles/{id}       – update / complete cycle
DELETE /crop-cycles/{id}       – delete cycle

Ownership: a FARMER may only touch cycles on their own land; ADMIN/SUPER_ADMIN
may read any cycle but — per product decision — never writes to one (admin's
only writes into farmer data are advice records, handled in records.py).
Once a cycle's status is COMPLETED, it is frozen: no further update or delete
by anyone.
"""
import uuid
import time
from boto3.dynamodb.conditions import Key

from lib.db import table, encode_key, decode_key
from lib.auth import require_auth, is_admin_role, AuthError, ForbiddenError
from lib.response import (
    ok, created, no_content, bad_request, not_found, forbidden, conflict, server_err,
    parse_body, method, path_param, query_param,
)


def handler(event, _ctx):
    try:
        m   = method(event)
        rid = path_param(event)

        if m == 'OPTIONS':
            return no_content()
        if rid:
            if m == 'GET':    return _get(event, rid)
            if m == 'PUT':    return _update(event, rid)
            if m == 'DELETE': return _delete(event, rid)
        else:
            if m == 'GET':  return _list(event)
            if m == 'POST': return _create(event)

        return bad_request('Method not allowed')

    except AuthError as e:
        from lib.response import unauthorized
        return unauthorized(str(e))
    except ForbiddenError as e:
        return forbidden(str(e))
    except Exception as e:
        return server_err(e)


def _list(event):
    payload = require_auth(event)
    land_id = query_param(event, 'landId')
    if not land_id:
        return bad_request('landId query param required')

    land = table('lands').get_item(Key={'landId': land_id}).get('Item')
    if not land:
        return not_found('Land not found')
    if not is_admin_role(payload['role']) and land.get('farmerId') != payload['userId']:
        return forbidden('Access denied')

    tbl    = table('crop_cycles')
    cursor = query_param(event, 'cursor')
    kwargs = {
        'KeyConditionExpression': Key('landId').eq(land_id),
        'ScanIndexForward': False,  # newest first
    }
    if cursor:
        kwargs['ExclusiveStartKey'] = decode_key(cursor)

    resp = tbl.query(**kwargs)
    return ok({
        'items':      resp.get('Items', []),
        'nextCursor': encode_key(resp.get('LastEvaluatedKey')),
    })


def _create(event):
    payload  = require_auth(event)
    if is_admin_role(payload['role']):
        return forbidden('Admins have read-only access to customer crop data')

    body     = parse_body(event)
    land_id  = (body.get('landId') or '').strip()
    crop_name = (body.get('cropName') or '').strip()

    if not land_id or not crop_name:
        return bad_request('landId and cropName required')

    land = table('lands').get_item(Key={'landId': land_id}).get('Item')
    if not land:
        return not_found('Land not found')
    if land.get('farmerId') != payload['userId']:
        return forbidden('Access denied')

    cycle_id = str(uuid.uuid4())
    cycle = {
        'landId':    land_id,
        'cycleId':   cycle_id,
        'cropName':  crop_name,
        'variety':   body.get('variety', ''),
        'area':      body.get('area', ''),
        'startDate': body.get('startDate') or time.strftime('%Y-%m-%d', time.gmtime()),
        'endDate':   None,
        'status':    'ACTIVE',
        'farmerId':  payload['userId'],
        'notes':     body.get('notes', ''),
        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    table('crop_cycles').put_item(Item=cycle)
    return created(cycle)


def _get_by_cycle_id(cycle_id: str) -> dict | None:
    resp = table('crop_cycles').query(
        IndexName='CycleIdIndex',
        KeyConditionExpression=Key('cycleId').eq(cycle_id),
        Limit=1,
    )
    items = resp.get('Items', [])
    return items[0] if items else None


def _check_owner_or_admin(payload: dict, item: dict):
    """Read access: owner or any admin."""
    if not is_admin_role(payload['role']) and item.get('farmerId') != payload['userId']:
        return forbidden('Access denied')
    return None


def _check_owner_only(payload: dict, item: dict):
    """Write access: owner only — admins are read-only on customer crop data."""
    if is_admin_role(payload['role']):
        return forbidden('Admins have read-only access to customer crop data')
    if item.get('farmerId') != payload['userId']:
        return forbidden('Access denied')
    return None


def _get(event, cycle_id: str):
    payload = require_auth(event)
    item = _get_by_cycle_id(cycle_id)
    if not item:
        return not_found('Crop cycle not found')
    denied = _check_owner_or_admin(payload, item)
    if denied:
        return denied
    return ok(item)


def _update(event, cycle_id: str):
    payload = require_auth(event)
    item = _get_by_cycle_id(cycle_id)
    if not item:
        return not_found('Crop cycle not found')
    denied = _check_owner_only(payload, item)
    if denied:
        return denied
    if item.get('status') == 'COMPLETED':
        return conflict('This crop cycle has been completed and is now read-only.')

    body    = parse_body(event)
    allowed = ['cropName', 'variety', 'area', 'startDate', 'endDate', 'status', 'notes']
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    if not updates:
        return bad_request('Nothing to update')

    table('crop_cycles').update_item(
        Key={'landId': item['landId'], 'cycleId': cycle_id},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )
    return ok({**item, **updates})


def _delete(event, cycle_id: str):
    payload = require_auth(event)
    item = _get_by_cycle_id(cycle_id)
    if not item:
        return not_found('Crop cycle not found')
    denied = _check_owner_only(payload, item)
    if denied:
        return denied
    if item.get('status') == 'COMPLETED':
        return conflict('This crop cycle has been completed and is now read-only.')

    table('crop_cycles').delete_item(
        Key={'landId': item['landId'], 'cycleId': cycle_id}
    )
    return no_content()
