'''
Excel import and keyword management API routes.
'''
import io
import json
from typing import Dict, List
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.excel_processor import ExcelProcessor

router = APIRouter(prefix='/api/excel', tags=['excel'])

# In-memory keyword rules store
_rules: Dict = {
    'reasons': [],
    'products': [],
}


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
    '''
    Import sales Excel using pre-configured keyword rules (from keyword management).
    '''
    if not sales_file.filename:
        raise HTTPException(400, 'sales_file is required')

    if not _rules['reasons'] or not _rules['products']:
        raise HTTPException(400, 'No keyword rules configured. Please set up rules first.')

    try:
        sales_bytes = io.BytesIO(await sales_file.read())
    except Exception as e:
        raise HTTPException(400, f'Failed to read file: {e}')

    processor = ExcelProcessor()
    try:
        result = processor.process_with_rules_dict(
            sales_bytes, _rules['reasons'], _rules['products']
        )
    except Exception as e:
        raise HTTPException(500, f'Processing failed: {e}')

    return {'success': True, 'data': result}


# ---- Keyword Rules CRUD ----

@router.get('/rules/reasons')
async def get_reason_rules():
    return {'reasons': _rules['reasons']}


@router.put('/rules/reasons')
async def set_reason_rules(payload: Dict):
    reasons = payload.get('reasons', [])
    _rules['reasons'] = reasons
    return {'success': True, 'reasons': reasons}


@router.get('/rules/products')
async def get_product_rules():
    return {'products': _rules['products']}


@router.put('/rules/products')
async def set_product_rules(payload: Dict):
    products = payload.get('products', [])
    _rules['products'] = products
    return {'success': True, 'products': products}


@router.get('/rules/all')
async def get_all_rules():
    return _rules


# ---- Rules import from Excel ----

@router.post('/rules/import')
async def import_rules_from_excel(
    rules_file: UploadFile = File(...),
):
    '''
    Import keyword rules from an Excel file.
    Stores them for use with /import-with-rules.
    '''
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

        _rules['reasons'] = [
            {'category': str(row['分类']), 'keywords': str(row['关键词'])}
            for _, row in reason_df.iterrows()
            if not pd.isna(row['关键词'])
        ]
        _rules['products'] = [
            {'category': str(row['品']), 'keywords': str(row['关键词'])}
            for _, row in product_df.iterrows()
            if not pd.isna(row['关键词'])
        ]
    except Exception as e:
        raise HTTPException(500, f'Failed to parse rules Excel: {e}')

    return {'success': True, 'reasons': _rules['reasons'], 'products': _rules['products']}
