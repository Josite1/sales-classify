'''
Excel import and keyword management API routes.
'''
import io
import json
from typing import Dict, List
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.excel_processor import ExcelProcessor
from utils.database import get_supabase_client
from uuid import uuid4

router = APIRouter(prefix='/api/excel', tags=['excel'])



@router.post('/import')
async def import_excel(
    sales_file: UploadFile = File(...),
    rules_file: UploadFile = File(...),
):
    '''
    Import sales Excel directly, using keyword rules Excel.
    Returns the classified JSON result.
    '''
    if not sales_file.filename or not rules_file.filename:
        raise HTTPException(400, 'Both sales_file and rules_file are required')

    try:
        sales_bytes = io.BytesIO(await sales_file.read())
        rules_bytes = io.BytesIO(await rules_file.read())
    except Exception as e:
        raise HTTPException(400, f'Failed to read files: {e}')

    processor = ExcelProcessor()
    try:
        result = processor.process(sales_bytes, rules_bytes)
    except Exception as e:
        raise HTTPException(500, f'Processing failed: {e}')

    return {'success': True, 'data': result}


@router.post('/import-with-rules')
async def import_excel_with_rules(
    sales_file: UploadFile = File(...),
):
    if not sales_file.filename:
        raise HTTPException(400, 'sales_file is required')

    supabase = get_supabase_client()
    reasons_result = supabase.table('keyword_rules').select('category, keywords').eq('rule_type', 'reasons').order('sort_order').execute()
    products_result = supabase.table('keyword_rules').select('category, keywords').eq('rule_type', 'products').order('sort_order').execute()
    reasons = [{'category': r['category'], 'keywords': r['keywords']} for r in reasons_result.data]
    products = [{'category': r['category'], 'keywords': r['keywords']} for r in products_result.data]

    if not reasons or not products:
        raise HTTPException(400, 'No keyword rules configured. Please set up rules first.')

    try:
        sales_bytes = io.BytesIO(await sales_file.read())
    except Exception as e:
        raise HTTPException(400, f'Failed to read file: {e}')

    processor = ExcelProcessor()
    try:
        result = processor.process_with_rules_dict(sales_bytes, reasons, products)
    except Exception as e:
        raise HTTPException(500, f'Processing failed: {e}')

    return {'success': True, 'data': result}

# ---- Keyword Rules CRUD ----
@router.get('/rules/reasons')
async def get_reason_rules():
    supabase = get_supabase_client()
    result = supabase.table('keyword_rules') \
        .select('category, keywords') \
        .eq('rule_type', 'reasons') \
        .order('sort_order') \
        .execute()
    return {'reasons': [{'category': r['category'], 'keywords': r['keywords']} for r in result.data]}


@router.put('/rules/reasons')
async def set_reason_rules(payload: Dict):
    supabase = get_supabase_client()
    reasons = payload.get('reasons', [])
    supabase.table('keyword_rules').delete().eq('rule_type', 'reasons').execute()
    for i, rule in enumerate(reasons):
        supabase.table('keyword_rules').insert({
            'id': str(uuid4()), 'rule_type': 'reasons',
            'category': rule['category'], 'keywords': rule['keywords'], 'sort_order': i,
        }).execute()
    return {'success': True, 'reasons': reasons}


@router.get('/rules/products')
async def get_product_rules():
    supabase = get_supabase_client()
    result = supabase.table('keyword_rules') \
        .select('category, keywords') \
        .eq('rule_type', 'products') \
        .order('sort_order') \
        .execute()
    return {'products': [{'category': r['category'], 'keywords': r['keywords']} for r in result.data]}


@router.put('/rules/products')
async def set_product_rules(payload: Dict):
    supabase = get_supabase_client()
    products = payload.get('products', [])
    supabase.table('keyword_rules').delete().eq('rule_type', 'products').execute()
    for i, rule in enumerate(products):
        supabase.table('keyword_rules').insert({
            'id': str(uuid4()), 'rule_type': 'products',
            'category': rule['category'], 'keywords': rule['keywords'], 'sort_order': i,
        }).execute()
    return {'success': True, 'products': products}


@router.get('/rules/all')
async def get_all_rules():
    supabase = get_supabase_client()
    reasons = supabase.table('keyword_rules').select('category, keywords').eq('rule_type', 'reasons').order('sort_order').execute()
    products = supabase.table('keyword_rules').select('category, keywords').eq('rule_type', 'products').order('sort_order').execute()
    return {
        'reasons': [{'category': r['category'], 'keywords': r['keywords']} for r in reasons.data],
        'products': [{'category': r['category'], 'keywords': r['keywords']} for r in products.data],
    }


# ---- Rules import from Excel ----

@router.post('/rules/import')
async def import_rules_from_excel(rules_file: UploadFile = File(...)):
    if not rules_file.filename:
        raise HTTPException(400, 'rules_file is required')
    try:
        rules_bytes = io.BytesIO(await rules_file.read())
    except Exception as e:
        raise HTTPException(400, f'Failed to read file: {e}')
    import pandas as pd
    try:
        reason_df = pd.read_excel(rules_bytes, sheet_name='售后原因')
        product_df = pd.read_excel(rules_bytes, sheet_name='品类')
        reasons = [{'category': str(row['分类']), 'keywords': str(row['关键词'])} for _, row in reason_df.iterrows() if not pd.isna(row['关键词'])]
        products = [{'category': str(row['品']), 'keywords': str(row['关键词'])} for _, row in product_df.iterrows() if not pd.isna(row['关键词'])]
        supabase = get_supabase_client()
        supabase.table('keyword_rules').delete().eq('rule_type', 'reasons').execute()
        supabase.table('keyword_rules').delete().eq('rule_type', 'products').execute()
        for i, r in enumerate(reasons):
            supabase.table('keyword_rules').insert({'id': str(uuid4()), 'rule_type': 'reasons', 'category': r['category'], 'keywords': r['keywords'], 'sort_order': i}).execute()
        for i, p in enumerate(products):
            supabase.table('keyword_rules').insert({'id': str(uuid4()), 'rule_type': 'products', 'category': p['category'], 'keywords': p['keywords'], 'sort_order': i}).execute()
    except Exception as e:
        raise HTTPException(500, f'Failed to parse rules Excel: {e}')
    return {'success': True, 'reasons': reasons, 'products': products}