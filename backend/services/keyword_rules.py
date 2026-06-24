'''
Keyword rules service: CRUD operations for reason/product keyword rules.
Moved from excel_import router to keep controllers thin.
'''
from typing import Dict, List
from uuid import uuid4
from utils.database import get_supabase_client


def get_reason_rules() -> List[Dict]:
    '''Fetch all reason keyword rules.'''
    supabase = get_supabase_client()
    result = supabase.table('keyword_rules').select(
        'category, keywords'
    ).eq('rule_type', 'reasons').order('sort_order').execute()
    return [{'category': r['category'], 'keywords': r['keywords']} for r in result.data]


def get_product_rules() -> List[Dict]:
    '''Fetch all product keyword rules.'''
    supabase = get_supabase_client()
    result = supabase.table('keyword_rules').select(
        'category, keywords'
    ).eq('rule_type', 'products').order('sort_order').execute()
    return [{'category': r['category'], 'keywords': r['keywords']} for r in result.data]


def get_all_rules() -> Dict:
    '''Fetch both reason and product rules.'''
    return {
        'reasons': get_reason_rules(),
        'products': get_product_rules(),
    }


def set_reason_rules(reasons: List[Dict]) -> List[Dict]:
    '''Replace all reason keyword rules.'''
    supabase = get_supabase_client()
    supabase.table('keyword_rules').delete().eq('rule_type', 'reasons').execute()
    for i, rule in enumerate(reasons):
        supabase.table('keyword_rules').insert({
            'id': str(uuid4()),
            'rule_type': 'reasons',
            'category': rule['category'],
            'keywords': rule['keywords'],
            'sort_order': i,
        }).execute()
    return reasons


def set_product_rules(products: List[Dict]) -> List[Dict]:
    '''Replace all product keyword rules.'''
    supabase = get_supabase_client()
    supabase.table('keyword_rules').delete().eq('rule_type', 'products').execute()
    for i, rule in enumerate(products):
        supabase.table('keyword_rules').insert({
            'id': str(uuid4()),
            'rule_type': 'products',
            'category': rule['category'],
            'keywords': rule['keywords'],
            'sort_order': i,
        }).execute()
    return products
