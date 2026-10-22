"""
Integration secrets in SSM Parameter Store (SecureString, aws/ssm KMS key) under
SECRET_PREFIX. Values are cached per container for CACHE_TTL seconds and are
never returned by any API — callers expose only `hint()`.
"""
import os
import time

import boto3

SECRET_PREFIX = os.environ.get('SECRET_PARAM_PREFIX', '/naveena/')
CACHE_TTL = 300

_ssm = boto3.client('ssm')
_cache: dict = {}


def _name(key: str) -> str:
    return f'{SECRET_PREFIX}{key}'


def get_secret(key: str) -> str | None:
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]
    try:
        value = _ssm.get_parameter(Name=_name(key), WithDecryption=True)['Parameter']['Value']
    except _ssm.exceptions.ParameterNotFound:
        value = None
    _cache[key] = (time.time(), value)
    return value


def put_secret(key: str, value: str, description: str = ''):
    _ssm.put_parameter(Name=_name(key), Value=value, Type='SecureString', Overwrite=True,
                       Description=description or f'Smart Agri {key} (managed from the app)')
    _cache[key] = (time.time(), value)


def delete_secret(key: str):
    try:
        _ssm.delete_parameter(Name=_name(key))
    except _ssm.exceptions.ParameterNotFound:
        pass
    _cache.pop(key, None)


def hint(value: str | None) -> str:
    return f'••••{value[-4:]}' if value and len(value) >= 8 else ('••••' if value else '')


def looks_masked(value: str) -> bool:
    return '•' in value or set(value) <= {'*'}
