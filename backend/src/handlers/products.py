"""
GET    /products          – list products (all users, paginated)
POST   /products          – create product (admin only)
GET    /products/{id}     – get product by productId
PUT    /products/{id}     – update product (admin only)
DELETE /products/{id}     – delete product (admin only)
"""
import uuid
import time
from lib.db import table, encode_key, decode_key
from lib.auth import require_auth, require_admin, AuthError, ForbiddenError
from lib.response import (
    ok, created, no_content, bad_request, not_found, server_err,
    parse_body, method, path_param, query_param,
)

PAGE_SIZE = 50


def handler(event, _ctx):
    try:
        m   = method(event)
        rid = path_param(event)

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
    require_auth(event)
    tbl    = table('products')
    cursor = query_param(event, 'cursor')
    kwargs = {'Limit': PAGE_SIZE}
    if cursor:
        kwargs['ExclusiveStartKey'] = decode_key(cursor)

    resp = tbl.scan(**kwargs)
    return ok({
        'items':      resp.get('Items', []),
        'nextCursor': encode_key(resp.get('LastEvaluatedKey')),
    })


def _create(event):
    require_admin(event)
    body = parse_body(event)
    name = (body.get('name') or '').strip()
    if not name:
        return bad_request('name required')

    product = {
        'productId':   str(uuid.uuid4()),
        'name':        name,
        'description': body.get('description', ''),
        'category':    body.get('category', ''),
        'price':       body.get('price', 0),
        'unit':        body.get('unit', 'kg'),
        'stock':       body.get('stock', 0),
        'imageUrl':    body.get('imageUrl', ''),
        'isActive':    body.get('isActive', True),
        'createdAt':   time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    table('products').put_item(Item=product)
    return created(product)


def _get(event, product_id: str):
    require_auth(event)
    resp = table('products').get_item(Key={'productId': product_id})
    item = resp.get('Item')
    if not item:
        return not_found('Product not found')
    return ok(item)


def _update(event, product_id: str):
    require_admin(event)
    tbl  = table('products')
    resp = tbl.get_item(Key={'productId': product_id})
    if not resp.get('Item'):
        return not_found('Product not found')

    body    = parse_body(event)
    allowed = ['name', 'description', 'category', 'price', 'unit', 'stock', 'imageUrl', 'isActive']
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    if not updates:
        return bad_request('Nothing to update')

    tbl.update_item(
        Key={'productId': product_id},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )
    return ok({**resp['Item'], **updates})


def _delete(event, product_id: str):
    require_admin(event)
    tbl  = table('products')
    resp = tbl.get_item(Key={'productId': product_id})
    if not resp.get('Item'):
        return not_found('Product not found')
    tbl.delete_item(Key={'productId': product_id})
    return no_content()
