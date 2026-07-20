"""
GET    /orders              – farmer sees own orders; admin sees all (paginated)
POST   /orders              – place order (farmer)
GET    /orders/{id}         – get order by orderId
PUT    /orders/{id}         – update order status (admin) or cancel (farmer)
DELETE /orders/{id}         – delete order (admin)
"""
import uuid
import time
from decimal import Decimal
from boto3.dynamodb.conditions import Key

from lib.db import table, encode_key, decode_key
from lib.auth import require_auth, require_admin, is_admin_role, AuthError, ForbiddenError
from lib.response import (
    ok, created, no_content, bad_request, not_found, server_err,
    parse_body, method, path_param, query_param,
)

PAGE_SIZE = 50
VALID_STATUSES = {'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'}


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
    tbl     = table('orders')
    cursor  = query_param(event, 'cursor')

    if payload['role'] == 'FARMER':
        kwargs = {
            'IndexName': 'CustomerIndex',
            'KeyConditionExpression': Key('customerId').eq(payload['userId']),
            'ScanIndexForward': False,
            'Limit': PAGE_SIZE,
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
    items   = body.get('items', [])

    if not items:
        return bad_request('items array required')

    # Phase 1: validate all items before touching stock
    enriched_items = []
    total_amount   = Decimal('0')

    for line in items:
        product_id = line.get('productId')
        qty        = int(line.get('quantity', 0))
        if not product_id or qty <= 0:
            return bad_request('Each item needs productId and quantity > 0')

        resp    = table('products').get_item(Key={'productId': product_id})
        product = resp.get('Item')
        if not product:
            return not_found(f'Product {product_id} not found')
        if not product.get('isActive', True):
            return bad_request(f'Product {product["name"]} is not available')

        current_stock = int(product.get('stock', 0))
        if current_stock < qty:
            return bad_request(
                f'Insufficient stock for {product["name"]}: '
                f'requested {qty}, available {current_stock}'
            )

        price = Decimal(str(product.get('price', 0)))
        enriched_items.append({
            'productId':   product_id,
            'productName': product['name'],
            'quantity':    qty,
            'unit':        product.get('unit', ''),
            'unitPrice':   str(price),
            'subtotal':    str(price * qty),
            'imageUrl':    product.get('imageUrl', ''),
        })
        total_amount += price * qty

    # Phase 2: atomically decrement stock for each item
    # ConditionExpression ensures no negative stock even under concurrent orders
    from botocore.exceptions import ClientError
    products_tbl = table('products')
    decremented  = []
    try:
        for line in enriched_items:
            products_tbl.update_item(
                Key={'productId': line['productId']},
                UpdateExpression='SET stock = stock - :qty',
                ConditionExpression='stock >= :qty',
                ExpressionAttributeValues={':qty': int(line['quantity'])},
            )
            decremented.append(line['productId'])
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            # Roll back decrements already applied
            for pid in decremented:
                qty_back = next(i['quantity'] for i in enriched_items if i['productId'] == pid)
                products_tbl.update_item(
                    Key={'productId': pid},
                    UpdateExpression='SET stock = stock + :qty',
                    ExpressionAttributeValues={':qty': int(qty_back)},
                )
            return bad_request('Stock changed during checkout — please try again')
        raise

    now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    order = {
        'orderId':      str(uuid.uuid4()),
        'customerId':   payload['userId'],
        'items':        enriched_items,
        'totalAmount':  str(total_amount),
        'status':       'PENDING',
        'address':      body.get('address', ''),
        'notes':        body.get('notes', ''),
        'createdAt':    now,
        'updatedAt':    now,
    }
    table('orders').put_item(Item=order)
    return created(order)


def _get(event, order_id: str):
    payload = require_auth(event)
    resp    = table('orders').get_item(Key={'orderId': order_id})
    item    = resp.get('Item')
    if not item:
        return not_found('Order not found')
    if not is_admin_role(payload['role']) and item['customerId'] != payload['userId']:
        from lib.response import forbidden
        return forbidden('Access denied')
    return ok(item)


def _update(event, order_id: str):
    payload = require_auth(event)
    tbl     = table('orders')
    resp    = tbl.get_item(Key={'orderId': order_id})
    item    = resp.get('Item')
    if not item:
        return not_found('Order not found')

    body   = parse_body(event)
    status = body.get('status', '').upper()

    if payload['role'] == 'FARMER':
        if item['customerId'] != payload['userId']:
            from lib.response import forbidden
            return forbidden('Access denied')
        if status != 'CANCELLED':
            return bad_request('Farmers can only cancel orders')
        if item['status'] not in ('PENDING',):
            return bad_request('Order cannot be cancelled at this stage')

    elif is_admin_role(payload['role']):
        if status and status not in VALID_STATUSES:
            return bad_request(f'Invalid status. Use: {", ".join(VALID_STATUSES)}')

    updates = {'updatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    if status:
        updates['status'] = status
    if body.get('adminNote'):
        updates['adminNote'] = body['adminNote']

    tbl.update_item(
        Key={'orderId': order_id},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )
    return ok({**item, **updates})


def _delete(event, order_id: str):
    require_admin(event)
    tbl  = table('orders')
    resp = tbl.get_item(Key={'orderId': order_id})
    if not resp.get('Item'):
        return not_found('Order not found')
    tbl.delete_item(Key={'orderId': order_id})
    return no_content()
