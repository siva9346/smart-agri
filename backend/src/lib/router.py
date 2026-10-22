"""Shared request wrapper for the newer handlers: OPTIONS, error mapping, path splitting."""
from urllib.parse import unquote

from botocore.exceptions import ClientError

from lib.auth import AuthError, ForbiddenError
from lib.util import HttpError
from lib.response import _json, no_content, unauthorized, forbidden, server_err, method, path_param


def segments(event) -> list[str]:
    proxy = path_param(event) or ''
    # Decode each segment so encoded ids (e.g. ':' in inbox keys) match whether or
    # not the gateway already decoded the path.
    return [unquote(s) for s in proxy.split('/') if s]


def run(event, route):
    """`route(event, method, segments)` returns a response or None (→ 404)."""
    try:
        m = method(event)
        if m == 'OPTIONS':
            return no_content()
        resp = route(event, m, segments(event))
        if resp is None:
            return _json(404, {'error': 'Unknown route'})
        return resp
    except AuthError as e:
        return unauthorized(str(e))
    except ForbiddenError as e:
        return forbidden(str(e))
    except HttpError as e:
        return _json(e.status, {'error': str(e)})
    except ClientError as e:
        if e.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException':
            return _json(409, {'error': 'The record was changed by someone else. Refresh and try again.'})
        return server_err(e)
    except Exception as e:
        return server_err(e)
