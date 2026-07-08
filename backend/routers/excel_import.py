'''
Excel import and keyword management API routes.
Controllers are thin: receive request, call service, return JSON.
'''
import io
from typing import Dict
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.excel_processor import ExcelProcessor
from services.keyword_rules import (
    get_reason_rules as svc_get_reason_rules,
    get_product_rules as svc_get_product_rules,
    get_all_rules as svc_get_all_rules,
    set_reason_rules as svc_set_reason_rules,
    set_product_rules as svc_set_product_rules,
    append_reason_rule as svc_append_reason_rule,
)
from services.rules_import import import_rules_from_excel as svc_import_rules

router = APIRouter(prefix='/api/excel', tags=['excel'])


@router.post('/import')
async def import_excel(
    sales_file: UploadFile = File(...),
    rules_file: UploadFile = File(...),
):
    '''Import sales Excel using keyword rules Excel. Returns classified JSON.'''
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
async def import_excel_with_rules(sales_file: UploadFile = File(...)):
    '''Import sales Excel using rules already stored in database.'''
    if not sales_file.filename:
        raise HTTPException(400, 'sales_file is required')

    reasons = svc_get_reason_rules()
    products = svc_get_product_rules()

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
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f'Excel处理异常: {e}')

    return {'success': True, 'data': result}


# ---- Keyword Rules CRUD (thin controllers) ----

@router.get('/rules/reasons')
async def get_reason_rules():
    return {'reasons': svc_get_reason_rules()}


@router.put('/rules/reasons')
async def set_reason_rules(payload: Dict):
    reasons = payload.get('reasons', [])
    svc_set_reason_rules(reasons)
    return {'success': True, 'reasons': reasons}


@router.post('/rules/reasons/append')
async def append_reason_rule(payload: Dict):
    '''Append a single reason keyword rule. Merges keywords if category exists.'''
    category = payload.get('category', '').strip()
    keywords = payload.get('keywords', '').strip()
    if not category or not keywords:
        raise HTTPException(400, 'category and keywords are required')
    try:
        updated = svc_append_reason_rule(category, keywords)
    except Exception as e:
        raise HTTPException(500, f'Failed to save rule: {e}')
    return {'success': True, 'reasons': updated}


@router.get('/rules/products')
async def get_product_rules():
    return {'products': svc_get_product_rules()}


@router.put('/rules/products')
async def set_product_rules(payload: Dict):
    products = payload.get('products', [])
    svc_set_product_rules(products)
    return {'success': True, 'products': products}


@router.get('/rules/all')
async def get_all_rules():
    return svc_get_all_rules()


# ---- Rules import from Excel ----

@router.post('/rules/import')
async def import_rules_from_excel(rules_file: UploadFile = File(...)):
    if not rules_file.filename:
        raise HTTPException(400, 'rules_file is required')
    try:
        rules_bytes = io.BytesIO(await rules_file.read())
    except Exception as e:
        raise HTTPException(400, f'Failed to read file: {e}')

    try:
        result = svc_import_rules(rules_bytes)
    except Exception as e:
        raise HTTPException(500, f'Failed to parse rules Excel: {e}')

    return {'success': True, **result}
