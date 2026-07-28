"""
POST /account/delete – authenticated user requests deletion of their own
account (Google Play account-deletion compliance).

The user ID is taken from the JWT (require_auth), never from the request
body — a caller cannot request deletion of anyone else's account.

This does NOT hard-delete anything immediately. It only flags the account as
pending deletion; the actual data purge happens ~30 days later, run by the
scheduled `cleanup_deleted_accounts` Lambda (see that file for what gets
deleted vs. retained).
"""
import time

from lib.db import table
from lib.auth import require_auth, AuthError, ForbiddenError
from lib.response import ok, no_content, bad_request, not_found, server_err, method


def handler(event, _ctx):
    try:
        m = method(event)
        if m == 'OPTIONS':
            return no_content()
        if m != 'POST':
            return bad_request('Method not allowed')
        return _request_deletion(event)

    except AuthError as e:
        from lib.response import unauthorized
        return unauthorized(str(e))
    except ForbiddenError as e:
        from lib.response import forbidden
        return forbidden(str(e))
    except Exception as e:
        return server_err(e)


def _request_deletion(event):
    payload = require_auth(event)
    user_id = payload['userId']

    tbl  = table('users')
    resp = tbl.get_item(Key={'userId': user_id})
    user = resp.get('Item')
    if not user:
        return not_found('User not found')

    if user.get('deletionStatus') == 'PENDING':
        return ok({
            'message': 'Account deletion already requested',
            'deletionStatus': 'PENDING',
            'deletionRequestedAt': user.get('deletionRequestedAt'),
        })

    now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    tbl.update_item(
        Key={'userId': user_id},
        UpdateExpression='SET deletionRequested = :req, deletionRequestedAt = :ts, deletionStatus = :status',
        ExpressionAttributeValues={':req': True, ':ts': now, ':status': 'PENDING'},
    )

    return ok({
        'message': 'Account deletion requested',
        'deletionStatus': 'PENDING',
        'deletionRequestedAt': now,
    })
