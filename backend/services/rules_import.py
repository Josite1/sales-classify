"""
Rules import from Excel: parses rules Excel file and stores to Supabase.
Moved from excel_import router to keep controllers thin.
"""
import io
from typing import Dict, List
from uuid import uuid4
import pandas as pd
from utils.database import get_supabase_client


def import_rules_from_excel(rules_file: io.BytesIO) -> Dict:
    """Parse rules Excel file and store to database.

    Expects sheets: reasons and products.
    Returns dict with 'reasons' and 'products' lists.
    """
    reason_df = pd.read_excel(rules_file, sheet_name='\u552e\u540e\u539f\u56e0')
    product_df = pd.read_excel(rules_file, sheet_name='\u54c1\u7c7b')

    reasons = [
        {'category': str(row['\u5206\u7c7b']), 'keywords': str(row['\u5173\u952e\u8bcd'])}
        for _, row in reason_df.iterrows()
        if not pd.isna(row['\u5173\u952e\u8bcd'])
    ]
    products = [
        {'category': str(row['\u54c1']), 'keywords': str(row['\u5173\u952e\u8bcd'])}
        for _, row in product_df.iterrows()
        if not pd.isna(row['\u5173\u952e\u8bcd'])
    ]

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

    supabase.table('keyword_rules').delete().eq('rule_type', 'products').execute()
    for i, rule in enumerate(products):
        supabase.table('keyword_rules').insert({
            'id': str(uuid4()),
            'rule_type': 'products',
            'category': rule['category'],
            'keywords': rule['keywords'],
            'sort_order': i,
        }).execute()

    return {
        'reasons': reasons,
        'products': products,
    }
