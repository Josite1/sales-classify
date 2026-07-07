'''
Product aliases API routes.
'''
from fastapi import APIRouter
from typing import Dict

router = APIRouter(prefix='/api/aliases', tags=['aliases'])

_aliases: Dict[str, Dict[str, str]] = {}


@router.get('')
async def get_aliases():
    return {'aliases': _aliases}


@router.put('/{product_name:path}')
async def set_alias(product_name: str, payload: Dict):
    _aliases[product_name] = {
        'alias': payload.get('alias', product_name),
        'note': payload.get('note', ''),
    }
    return {'success': True, 'aliases': _aliases}


@router.delete('/{product_name:path}')
async def delete_alias(product_name: str):
    if product_name in _aliases:
        del _aliases[product_name]
    return {'success': True}


@router.get('/display/{product_name:path}')
async def get_display_name(product_name: str):
    alias_info = _aliases.get(product_name, {})
    return {'name': alias_info.get('alias', product_name)}
