"""
GET    /lands             – list lands (farmer sees own; admin sees all)
POST   /lands             – create land parcel
GET    /lands/{id}        – get land by landId
PUT    /lands/{id}        – update land
DELETE /lands/{id}        – delete land
"""
import uuid
import time
from boto3.dynamodb.conditions import Key, Attr

from lib.db import table, encode_key, decode_key
from lib.auth import require_auth, is_admin_role, AuthError, ForbiddenError
from lib.response import (
    ok, created, no_content, bad_request, not_found, server_err,
    parse_body, method, path_param, query_param,
)

PAGE_SIZE = 50


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
        from lib.response import forbidden
        return forbidden(str(e))
    except Exception as e:
        return server_err(e)


def _list(event):
    payload = require_auth(event)
    tbl     = table('lands')
    cursor  = query_param(event, 'cursor')

    if payload['role'] == 'FARMER':
        farmer_id = query_param(event, 'farmerId') or payload['userId']
        kwargs = {
            'IndexName': 'FarmerIndex',
            'KeyConditionExpression': Key('farmerId').eq(farmer_id),
        }
        if cursor:
            kwargs['ExclusiveStartKey'] = decode_key(cursor)
        resp = tbl.query(**kwargs)
    else:
        kwargs = {'Limit': PAGE_SIZE}
        if cursor:
            kwargs['ExclusiveStartKey'] = decode_key(cursor)
        resp = tbl.scan(**kwargs)

    return ok({
        'items':      resp.get('Items', []),
        'nextCursor': encode_key(resp.get('LastEvaluatedKey')),
    })


def _create(event):
    payload = require_auth(event)
    body    = parse_body(event)
    name    = (body.get('name') or '').strip()
    area    = body.get('area')

    if not name:
        return bad_request('name is required')

    farmer_id = body.get('farmerId') or payload['userId']
    if not is_admin_role(payload['role']):
        farmer_id = payload['userId']

    land = {
        'landId':    str(uuid.uuid4()),
        'farmerId':  farmer_id,
        'name':      name,
        'area':      area,
        'areaUnit':  body.get('areaUnit', 'acres'),
        'village':   body.get('village', ''),
        'district':  body.get('district', ''),
        'soilType':  body.get('soilType', ''),
        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    table('lands').put_item(Item=land)
    return created(land)


def _get(event, land_id: str):
    payload = require_auth(event)
    resp    = table('lands').get_item(Key={'landId': land_id})
    item    = resp.get('Item')
    if not item:
        return not_found('Land not found')
    if not is_admin_role(payload['role']) and item['farmerId'] != payload['userId']:
        from lib.response import forbidden
        return forbidden('Access denied')
    return ok(item)


def _update(event, land_id: str):
    payload = require_auth(event)
    tbl     = table('lands')
    resp    = tbl.get_item(Key={'landId': land_id})
    item    = resp.get('Item')
    if not item:
        return not_found('Land not found')
    if not is_admin_role(payload['role']) and item['farmerId'] != payload['userId']:
        from lib.response import forbidden
        return forbidden('Access denied')

    body    = parse_body(event)
    allowed = ['name', 'area', 'areaUnit', 'village', 'district', 'soilType']
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    if not updates:
        return bad_request('Nothing to update')

    tbl.update_item(
        Key={'landId': land_id},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )
    return ok({**item, **updates})


def _delete(event, land_id: str):
    payload = require_auth(event)
    tbl     = table('lands')
    resp    = tbl.get_item(Key={'landId': land_id})
    item    = resp.get('Item')
    if not item:
        return not_found('Land not found')
    if not is_admin_role(payload['role']) and item['farmerId'] != payload['userId']:
        from lib.response import forbidden
        return forbidden('Access denied')
    tbl.delete_item(Key={'landId': land_id})
    return no_content()
