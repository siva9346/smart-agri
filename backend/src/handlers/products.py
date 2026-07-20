"""
GET    /products              – list products (all users, paginated)
POST   /products              – create product (admin only)
POST   /products/upload-photo – upload a base64 product image to S3, returns its URL (admin only)
GET    /products/{id}         – get product by productId
PUT    /products/{id}         – update product (admin only)
DELETE /products/{id}         – delete product (admin only)
"""
import os
import uuid
import time
import base64
import binascii
import boto3
from lib.db import table, encode_key, decode_key
from lib.auth import require_auth, require_admin, AuthError, ForbiddenError
from lib.response import (
    ok, created, no_content, bad_request, not_found, server_err,
    parse_body, method, path_param, query_param,
)

PAGE_SIZE = 50
MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5MB
CONTENT_TYPES = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
}
PHOTOS_BUCKET = os.environ.get('PHOTOS_BUCKET', '')
AWS_REGION = os.environ.get('AWS_REGION', 'ap-south-1')

_s3 = boto3.client('s3')


def handler(event, _ctx):
    try:
        m   = method(event)
        rid = path_param(event)

        if m == 'OPTIONS':
            return no_content()
        if rid == 'upload-photo' and m == 'POST':
            return _upload_photo(event)
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


def _upload_photo(event):
    payload = require_admin(event)
    body = parse_body(event)
    image_b64 = body.get('image')
    content_type = (body.get('contentType') or 'image/jpeg').strip()

    if not image_b64:
        return bad_request('image (base64) required')
    if content_type not in CONTENT_TYPES:
        return bad_request(f'contentType must be one of: {", ".join(CONTENT_TYPES)}')

    try:
        data = base64.b64decode(image_b64, validate=True)
    except (binascii.Error, ValueError):
        return bad_request('invalid base64 image data')

    if len(data) > MAX_PHOTO_BYTES:
        return bad_request(f'image too large (max {MAX_PHOTO_BYTES // (1024 * 1024)}MB)')

    ext = CONTENT_TYPES[content_type]
    key = f"products/{payload['userId']}/{uuid.uuid4()}.{ext}"

    _s3.put_object(Bucket=PHOTOS_BUCKET, Key=key, Body=data, ContentType=content_type)
    url = f'https://{PHOTOS_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}'
    return created({'url': url})


def _delete_photo_if_owned(url: str):
    """Best-effort cleanup of a previously-uploaded product photo. Never
    raises — an S3 delete failure must not block the DynamoDB write it's
    cleaning up after."""
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

    old_image_url = resp['Item'].get('imageUrl', '')
    new_image_url = updates.get('imageUrl')

    tbl.update_item(
        Key={'productId': product_id},
        UpdateExpression='SET ' + ', '.join(f'#{k} = :{k}' for k in updates),
        ExpressionAttributeNames={f'#{k}': k for k in updates},
        ExpressionAttributeValues={f':{k}': v for k, v in updates.items()},
    )

    if new_image_url is not None and new_image_url != old_image_url:
        _delete_photo_if_owned(old_image_url)

    return ok({**resp['Item'], **updates})


def _delete(event, product_id: str):
    require_admin(event)
    tbl  = table('products')
    resp = tbl.get_item(Key={'productId': product_id})
    if not resp.get('Item'):
        return not_found('Product not found')
    tbl.delete_item(Key={'productId': product_id})
    _delete_photo_if_owned(resp['Item'].get('imageUrl', ''))
    return no_content()
