"""
OpenAI / Google Gemini provider access.

API keys live only in SSM Parameter Store as SecureString parameters
(AI_KEY_PARAM_PREFIX + '<provider>-api-key'), encrypted with the account's
aws/ssm KMS key. They are never returned by any API, never logged, and never
stored in the settings table (only a "…last4" hint is). Keys are cached in
memory per container for KEY_CACHE_TTL seconds.

Provider calls use the REST APIs directly (urllib) so no SDK dependency is added.
"""
import os
import json
import time
import urllib.request
import urllib.error

import boto3

from lib.util import HttpError

PROVIDERS = ('openai', 'gemini')
KEY_PARAM_PREFIX = os.environ.get('AI_KEY_PARAM_PREFIX', '/naveena/ai/')
KEY_CACHE_TTL = 300
OPENAI_BASE = 'https://api.openai.com/v1'
GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

_ssm = boto3.client('ssm')
_key_cache: dict = {}


class ProviderError(Exception):
    """Safe-to-show provider failure (never contains the key)."""


def _param(provider: str) -> str:
    return f'{KEY_PARAM_PREFIX}{provider}-api-key'


def get_key(provider: str) -> str | None:
    cached = _key_cache.get(provider)
    if cached and time.time() - cached[0] < KEY_CACHE_TTL:
        return cached[1]
    try:
        value = _ssm.get_parameter(Name=_param(provider), WithDecryption=True)['Parameter']['Value']
    except _ssm.exceptions.ParameterNotFound:
        value = None
    _key_cache[provider] = (time.time(), value)
    return value


def put_key(provider: str, key: str):
    _ssm.put_parameter(Name=_param(provider), Value=key, Type='SecureString', Overwrite=True,
                       Description=f'Smart Agri {provider} API key (managed from the app)')
    _key_cache[provider] = (time.time(), key)


def delete_key(provider: str):
    try:
        _ssm.delete_parameter(Name=_param(provider))
    except _ssm.exceptions.ParameterNotFound:
        pass
    _key_cache.pop(provider, None)


def key_hint(key: str) -> str:
    return f'••••{key[-4:]}' if len(key) >= 8 else '••••'


# ── HTTP ────────────────────────────────────────────────────────────────────

def _request(method: str, url: str, headers: dict, body: dict | None, timeout: float) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={'Content-Type': 'application/json', **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read() or b'{}')
    except urllib.error.HTTPError as e:
        status = e.code
        try:
            detail = json.loads(e.read() or b'{}').get('error', {})
            detail = detail.get('message', '') if isinstance(detail, dict) else str(detail)
        except Exception:
            detail = ''
        detail = detail[:200]
        if status in (401, 403):
            raise ProviderError('The API key was rejected by the provider (invalid or lacks permission).')
        if status == 404:
            raise ProviderError(f'Model or endpoint not found. {detail}'.strip())
        if status == 429:
            raise ProviderError('Provider rate limit or quota exceeded. Try again later or check billing.')
        raise ProviderError(f'Provider returned HTTP {status}. {detail}'.strip())
    except (urllib.error.URLError, TimeoutError) as e:
        raise ProviderError(f'Could not reach the provider ({getattr(e, "reason", "timeout")}).')


# ── Model listing (connection test) ─────────────────────────────────────────

def list_models(provider: str, key: str) -> list[str]:
    if provider == 'openai':
        data = _request('GET', f'{OPENAI_BASE}/models', {'Authorization': f'Bearer {key}'}, None, 10)
        ids = [m['id'] for m in data.get('data', [])]
        return sorted(i for i in ids if i.startswith(('gpt', 'o1', 'o3', 'o4', 'chatgpt'))
                      and not any(x in i for x in ('audio', 'realtime', 'tts', 'transcribe', 'image', 'search')))
    data = _request('GET', f'{GEMINI_BASE}/models?pageSize=200', {'x-goog-api-key': key}, None, 10)
    return sorted(m['name'].removeprefix('models/') for m in data.get('models', [])
                  if 'generateContent' in m.get('supportedGenerationMethods', []))


# ── Generation ──────────────────────────────────────────────────────────────

def generate(provider: str, key: str, model: str, system: str, user: str,
             image_b64: str | None = None, image_type: str = 'image/jpeg', timeout: float = 25) -> str:
    if not model:
        raise ProviderError('No model selected for this provider.')
    if provider == 'openai':
        content = user if not image_b64 else [
            {'type': 'text', 'text': user},
            {'type': 'image_url', 'image_url': {'url': f'data:{image_type};base64,{image_b64}'}},
        ]
        data = _request('POST', f'{OPENAI_BASE}/chat/completions', {'Authorization': f'Bearer {key}'}, {
            'model': model,
            'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': content}],
        }, timeout)
        try:
            return (data['choices'][0]['message']['content'] or '').strip()
        except (KeyError, IndexError, TypeError):
            raise ProviderError('Unexpected response from OpenAI.')

    parts = [{'text': user}]
    if image_b64:
        parts.append({'inline_data': {'mime_type': image_type, 'data': image_b64}})
    data = _request('POST', f'{GEMINI_BASE}/models/{model}:generateContent', {'x-goog-api-key': key}, {
        'system_instruction': {'parts': [{'text': system}]},
        'contents': [{'role': 'user', 'parts': parts}],
    }, timeout)
    try:
        cand = data['candidates'][0]
        text = ''.join(p.get('text', '') for p in cand.get('content', {}).get('parts', []))
    except (KeyError, IndexError, TypeError):
        block = (data.get('promptFeedback') or {}).get('blockReason')
        raise ProviderError(f'Gemini returned no answer{" (blocked: " + block + ")" if block else ""}.')
    if not text.strip():
        raise ProviderError('Gemini returned an empty answer.')
    return text.strip()


def provider_order(cfg: dict) -> list[str]:
    """Usable providers (enabled + key + model) in strategy order."""
    preferred = ['gemini', 'openai'] if cfg.get('strategy') == 'GEMINI_PREFERRED' else ['openai', 'gemini']
    usable = [p for p in preferred
              if cfg['providers'][p].get('enabled') and cfg['providers'][p].get('keyConfigured')
              and cfg['providers'][p].get('model')]
    return usable if cfg.get('fallbackOnError') else usable[:1]


def run_with_fallback(cfg: dict, system: str, user: str, image_b64=None, image_type='image/jpeg') -> tuple[str, str, str, list]:
    """Returns (text, provider, model, errors-from-skipped-providers)."""
    order = provider_order(cfg)
    if not order:
        raise HttpError(503, 'AI is not available right now: no AI provider is enabled and configured.')
    errors = []
    budget = 25.0
    for i, provider in enumerate(order):
        key = get_key(provider)
        if not key:
            errors.append(f'{provider}: API key missing')
            continue
        model = cfg['providers'][provider]['model']
        timeout = budget / (len(order) - i) if len(order) - i > 1 else budget
        start = time.time()
        try:
            return generate(provider, key, model, system, user, image_b64, image_type, timeout), provider, model, errors
        except ProviderError as e:
            errors.append(f'{provider}: {e}')
            budget -= time.time() - start
            if budget < 4:
                break
    raise HttpError(502, 'The AI provider could not answer. ' + ' | '.join(errors))
