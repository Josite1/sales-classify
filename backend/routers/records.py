'''
Records CRUD API routes.
'''
from fastapi import APIRouter, HTTPException
from typing import Dict
from services.store import (
    compute_day_summary,
    compute_week_summaries,
    aggregate_records_by_range,
    merge_records,
)

router = APIRouter(prefix='/api/records', tags=['records'])

_store: Dict[str, Dict] = {}


@router.get('')
async def get_all_records():
    return {'records': _store, 'count': len(_store)}


@router.get('/{date}')
async def get_record(date: str):
    if date not in _store:
        raise HTTPException(status_code=404, detail=f'No record for date: {date}')
    return {'record': _store[date]}


@router.post('/{date}')
async def add_or_update_record(date: str, record: Dict):
    _store[date] = {
        'date': date,
        'data': record.get('data', record),
        'importedAt': record.get('importedAt', 0),
    }
    return {'success': True, 'date': date}


@router.delete('/{date}')
async def delete_record(date: str):
    if date in _store:
        del _store[date]
    return {'success': True, 'date': date}


@router.post('/sync/upload')
async def sync_upload(payload: Dict):
    records = payload.get('records', {})
    for date_str, record in records.items():
        _store[date_str] = record
    return {'success': True, 'synced': len(records)}


@router.get('/sync/download')
async def sync_download():
    return {'success': True, 'records': _store}


@router.post('/sync/merge')
async def sync_merge(payload: Dict):
    local = payload.get('local', {})
    cloud = payload.get('cloud', {})
    global _store
    _store = merge_records(local, cloud)
    return {'success': True, 'records': _store}


@router.get('/summary/day/{date}')
async def day_summary(date: str):
    if date not in _store:
        raise HTTPException(status_code=404, detail=f'No record for date: {date}')
    summary = compute_day_summary(date, _store)
    return {'summary': summary}


@router.get('/summary/weeks')
async def week_summaries():
    summaries = compute_week_summaries(_store)
    return {'summaries': summaries}


@router.get('/summary/range')
async def range_summary(start: str, end: str):
    result = aggregate_records_by_range(_store, start, end)
    return {'summary': result}
