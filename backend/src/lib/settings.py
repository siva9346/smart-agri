"""
Platform settings stored in the settings table, one item per `settingKey`.

Every setting has a code default (below) that is deep-merged with whatever the
Super Admin has saved, so newly added keys work without a data migration.
Values are cached per Lambda container for a short TTL so a toggle (e.g. the
global AI switch) takes effect within CACHE_TTL seconds everywhere.
"""
import copy
import time

from lib.db import table
from lib.util import now_iso

CACHE_TTL = 30

DEFAULTS = {
    # Role → permissions overrides; empty means "use lib.permissions defaults".
    'permissions': {'grants': {}, 'revokes': {}},

    'assignment': {
        # Crop (lower-case) → related specialization categories (Priority 2).
        'cropCategories': {
            'tomato': ['vegetables', 'horticulture'],
            'chilli': ['vegetables', 'horticulture'],
            'brinjal': ['vegetables', 'horticulture'],
            'onion': ['vegetables', 'horticulture'],
            'banana': ['fruits', 'horticulture'],
            'mango': ['fruits', 'horticulture'],
            'coconut': ['plantation crops', 'horticulture'],
            'paddy': ['cereals', 'field crops'],
            'rice': ['cereals', 'field crops'],
            'maize': ['cereals', 'field crops'],
            'sugarcane': ['field crops'],
            'cotton': ['field crops'],
            'groundnut': ['oilseeds', 'field crops'],
        },
        # Problem category → related specializations (also Priority 2).
        'problemCategories': {
            'pest': ['entomology', 'plant protection'],
            'disease': ['plant pathology', 'plant protection'],
            'nutrient': ['soil science', 'agronomy'],
            'soil': ['soil science'],
            'irrigation': ['water management', 'agronomy'],
            'weed': ['agronomy', 'plant protection'],
            'growth': ['agronomy'],
            'other': [],
        },
        'generalSpecialization': 'general',
        'defaultMaxActiveConsultations': 15,
        'escalateAfterHours': 24,
        # UNASSIGNED leaves new consultation leads in the shared pool;
        # ROUND_ROBIN gives them to the active staff member assigned least recently.
        'leadOwnerStrategy': 'ROUND_ROBIN',
    },

    'quotation': {
        'defaultTaxRatePct': 0,
        'validityDays': 15,
        'maxDiscountPctByRole': {'SUPER_ADMIN': 100, 'ADMIN': 25, 'STAFF': 10, 'EXPERT': 0},
        # Quotations created by these roles always need an approver.
        'approvalRequiredForRoles': ['STAFF'],
        # Any quotation with a line discount above this needs approval.
        'approvalDiscountPct': 5,
        'paymentTerms': '100% advance before dispatch.',
        'deliveryTerms': 'Delivery within 7 working days of order confirmation.',
        'termsAndConditions': 'Prices are inclusive of the taxes shown. Subject to stock availability.',
        'companyName': 'Smart Agri',
        'companyContact': '',
    },

    'ai': {
        'enabled': False,
        'strategy': 'OPENAI_PREFERRED',   # OPENAI_PREFERRED | GEMINI_PREFERRED
        'fallbackOnError': True,
        'providers': {
            'openai': {'enabled': False, 'model': '', 'keyConfigured': False, 'keyHint': '',
                       'lastTestAt': None, 'lastTestOk': None, 'lastTestError': None,
                       'lastSuccessAt': None, 'availableModels': []},
            'gemini': {'enabled': False, 'model': '', 'keyConfigured': False, 'keyHint': '',
                       'lastTestAt': None, 'lastTestOk': None, 'lastTestError': None,
                       'lastSuccessAt': None, 'availableModels': []},
        },
        'features': {
            'CUSTOMER_ASSISTANT': True,
            'CROP_PROBLEM': True,
            'EXPERT_ASSIST': True,
            'LEAD_SUMMARY': True,
            'FOLLOWUP_SUGGEST': True,
            'QUOTATION_ASSIST': True,
            'CRM_REPORT': True,
            'STAFF_INSIGHTS': True,
        },
        'requestsPerMinutePerUser': 10,
    },
}

_cache: dict = {}


def _merge(base, override):
    if isinstance(base, dict) and isinstance(override, dict):
        out = copy.deepcopy(base)
        for k, v in override.items():
            out[k] = _merge(base.get(k), v) if k in base else v
        return out
    return copy.deepcopy(override) if override is not None else copy.deepcopy(base)


def get_setting(key: str, fresh: bool = False) -> dict:
    cached = _cache.get(key)
    if cached and not fresh and time.time() - cached[0] < CACHE_TTL:
        return copy.deepcopy(cached[1])
    item = table('settings').get_item(Key={'settingKey': key}).get('Item') or {}
    value = _merge(DEFAULTS.get(key, {}), item.get('value') or {})
    _cache[key] = (time.time(), value)
    return copy.deepcopy(value)


def put_setting(key: str, value: dict, actor_id: str):
    table('settings').put_item(Item={
        'settingKey': key,
        'value': value,
        'updatedAt': now_iso(),
        'updatedBy': actor_id,
    })
    _cache[key] = (time.time(), copy.deepcopy(value))


def next_sequence(name: str) -> int:
    resp = table('settings').update_item(
        Key={'settingKey': f'counter#{name}'},
        UpdateExpression='ADD #v :one',
        ExpressionAttributeNames={'#v': 'counter'},
        ExpressionAttributeValues={':one': 1},
        ReturnValues='UPDATED_NEW',
    )
    return int(resp['Attributes']['counter'])
