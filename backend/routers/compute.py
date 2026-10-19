"""
Computation API routes.
Thin controllers: receive request with data, call service functions, return JSON.
All business logic lives in services/compute.py
"""
import json
import traceback
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from services import compute as svc

router = APIRouter(prefix='/api/compute', tags=['compute'])


def _dump_error(endpoint: str, payload: Dict, exc: BaseException) -> None:
    """把失败堆栈落盘到 _diag/last_backend_error.json（该目录不入库）。

    前端只能拿到 "Internal Server Error"，没有这里无法定位是哪个字段触发的。
    """
    try:
        out_dir = Path(__file__).resolve().parents[2] / '_diag'
        out_dir.mkdir(parents=True, exist_ok=True)
        records = payload.get('records')
        record_dates = sorted(records) if isinstance(records, dict) else []
        info = {
            'time': datetime.now().isoformat(timespec='seconds'),
            'endpoint': endpoint,
            'error': f'{type(exc).__name__}: {exc}',
            'traceback': traceback.format_exc(),
            'startDate': payload.get('startDate'),
            'endDate': payload.get('endDate'),
            'productName': payload.get('productName'),
            'selectedShops': payload.get('selectedShops'),
            'recordCount': len(record_dates),
            'recordDates': record_dates[:5] + (['...'] if len(record_dates) > 5 else []),
        }
        (out_dir / 'last_backend_error.json').write_text(
            json.dumps(info, ensure_ascii=False, indent=2), encoding='utf-8')
    except Exception:
        pass


# ==================== Data extraction helpers ====================

@router.post('/extract/product-total')
async def extract_product_total(payload: Dict):
    item = payload.get('item', {})
    return {'result': svc.get_product_total(item)}


@router.post('/extract/flags')
async def extract_flags(payload: Dict):
    item = payload.get('item', {})
    return {'result': svc.get_flags(item)}


@router.post('/extract/flag-count')
async def extract_flag_count(payload: Dict):
    item = payload.get('item', {})
    flag_type = payload.get('flagType', '')
    return {'result': svc.get_flag_count(item, flag_type)}


@router.post('/extract/region-distribution')
async def extract_region_distribution(payload: Dict):
    item = payload.get('item', {})
    return {'result': svc.get_region_distribution(item)}


@router.post('/extract/shop-distribution')
async def extract_shop_distribution(payload: Dict):
    item = payload.get('item', {})
    return {'result': svc.get_shop_distribution(item)}


@router.post('/extract/red-flag-reasons')
async def extract_red_flag_reasons(payload: Dict):
    item = payload.get('item', {})
    return {'result': svc.get_red_flag_reasons(item)}


@router.post('/extract/flatten-remark')
async def extract_flatten_remark(payload: Dict):
    raw = payload.get('raw', {})
    return {'result': svc.flatten_remark_counts(raw)}


@router.post('/extract/product-qty-stats')
async def extract_product_qty_stats(payload: Dict):
    product_data = payload.get('productData', {})
    return {'result': svc.get_product_qty_stats(product_data)}


@router.post('/extract/remark-other-details')
async def extract_remark_other_details(payload: Dict):
    product_data = payload.get('productData', {})
    flag_type = payload.get('flagType', '红色旗子')
    return {'result': svc.get_remark_other_details(product_data, flag_type)}


@router.post('/extract/product-display-name')
async def extract_product_display_name(payload: Dict):
    original_name = payload.get('originalName', '')
    aliases = payload.get('aliases', {})
    return {'result': svc.get_product_display_name(original_name, aliases)}


# ==================== Validation ====================

@router.post('/validate-import')
async def validate_import(payload: Dict):
    parsed = payload.get('parsed')
    return {'valid': svc.validate_import_data(parsed)}


@router.post('/parse-json')
async def parse_dirty_json(payload: Dict):
    raw_str = payload.get('raw', '')
    try:
        result = svc.parse_dirty_json(raw_str)
        return {'success': result is not None, 'result': result}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ==================== Date utilities ====================

@router.get('/date-range/week')
async def date_range_week(date: str = Query(...)):
    return svc.get_iso_week_range(date)


@router.get('/date-range/month')
async def date_range_month(date: str = Query(...)):
    return svc.get_month_range(date)


@router.get('/date-range/year')
async def date_range_year(date: str = Query(...)):
    year_str = date[:4]
    return {'start': f'{year_str}-01-01', 'end': f'{year_str}-12-31'}


@router.get('/dates-in-range')
async def dates_in_range(start: str = Query(...), end: str = Query(...)):
    return {'dates': svc.get_dates_in_range(start, end)}


# ==================== Summaries ====================

@router.post('/day-summary')
async def day_summary(payload: Dict):
    date_str = payload.get('date', '')
    records = payload.get('records', {})
    result = svc.compute_day_summary(date_str, records)
    if result is None:
        raise HTTPException(404, f'No record for date: {date_str}')
    return {'summary': result}


@router.post('/filtered-summary')
async def filtered_summary(payload: Dict):
    result = svc.compute_filtered_summary(
        records=payload.get('records', {}),
        start_date=payload.get('startDate', ''),
        end_date=payload.get('endDate', ''),
        selected_products=payload.get('selectedProducts', []),
        selected_shops=payload.get('selectedShops', []),
    )
    return {'summary': result}


@router.post('/options')
async def compute_options(payload: Dict):
    result = svc.compute_options(
        records=payload.get('records', {}),
        start_date=payload.get('startDate', ''),
        end_date=payload.get('endDate', ''),
        selected_products=payload.get('selectedProducts', []),
        selected_shops=payload.get('selectedShops', []),
        aliases=payload.get('aliases', {}),
    )
    return result


# ==================== Trend data (WeeklyTrendChart) ====================

@router.post('/trend-data')
async def trend_data(payload: Dict):
    daily_data = svc.compute_trend_data(
        records=payload.get('records', {}),
        start_date=payload.get('startDate', ''),
        end_date=payload.get('endDate', ''),
        time_mode=payload.get('timeMode', 'week'),
        selected_products=payload.get('selectedProducts', []),
        selected_shops=payload.get('selectedShops', []),
        aliases=payload.get('aliases', {}),
    )
    top_products = svc.compute_trend_top_items(daily_data, 'products', 8)
    top_reasons = svc.compute_trend_top_items(daily_data, 'reasons', 8)
    return {
        'dailyData': daily_data,
        'topProducts': top_products,
        'topReasons': top_reasons,
    }


# ==================== Product analysis ====================

@router.post('/product-analysis')
async def product_analysis(payload: Dict):
    try:
        return _product_analysis(payload)
    except Exception as e:
        # 落盘堆栈：前端只能看到 500，没有这个就没法定位脏字段
        _dump_error('product-analysis', payload, e)
        raise


def _product_analysis(payload: Dict):
    records = payload.get('records') or {}
    if not isinstance(records, dict):
        records = {}
    start_date = payload.get('startDate', '')
    end_date = payload.get('endDate', '')
    product_name = payload.get('productName', '')
    selected_shops = payload.get('selectedShops') or []
    if not isinstance(selected_shops, list):
        selected_shops = []

    aggregated = svc.compute_product_analysis(
        records=records,
        start_date=start_date,
        end_date=end_date,
        product_name=product_name,
        selected_shops=selected_shops,
    )
    global_total = svc.compute_product_global_total(
        records=records,
        start_date=start_date,
        end_date=end_date,
    )

    if aggregated is None:
        # 筛选后无数据时返回空结构，保持图表可见（而不是 404 导致图表消失）
        return {
            'productData': {},
            'globalTotal': global_total,
            'stats': {'total': 0, 'qtyStats': {}, 'singleRatio': '0', 'topQty': '-', 'topQtyVal': 0},
        }

    stats = svc.compute_product_stats(aggregated)

    # 诊断日志：仅在结构正常时输出，避免脏数据打断接口
    if selected_shops:
        try:
            print(f"[DIAG:product-analysis] product={product_name}, shops={selected_shops}")
            print(f"  total={aggregated.get('total')}, flags={aggregated.get('标旗分类')}")
            qty_data = aggregated.get('数量分类') or {}
            flags_data = aggregated.get('标旗分类') or {}
            if isinstance(qty_data, dict):
                for flag, qmap in qty_data.items():
                    if not isinstance(qmap, dict):
                        continue
                    qsum = sum(svc._to_int(v) for v in qmap.values())
                    flag_total = flags_data.get(flag, 0) if isinstance(flags_data, dict) else 0
                    print(f"  qty[{flag}]: sum={qsum}, flag_total={flag_total}, 匹配={qsum==flag_total}")
            print(f"  qtyStats: {stats.get('qtyStats')}")
        except Exception:
            pass

    return {
        'productData': aggregated,
        'globalTotal': global_total,
        'stats': stats,
    }


# ==================== Region distribution ====================

@router.post('/region-aggregation')
async def region_aggregation(payload: Dict):
    try:
        result = svc.compute_region_aggregation(
            records=payload.get('records', {}),
            start_date=payload.get('startDate', ''),
            end_date=payload.get('endDate', ''),
            target_products=payload.get('targetProducts', []),
            flag_type=payload.get('flagType', '红色旗子'),
        )
        return result or {'region': {}, 'total': 0, 'count': 0}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f'region-aggregation error: {e}')


@router.post('/region-trend')
async def region_trend(payload: Dict):
    result = svc.compute_region_trend_data(
        records=payload.get('records', {}),
        start_date=payload.get('startDate', ''),
        end_date=payload.get('endDate', ''),
        top_regions=payload.get('topRegions', []),
        target_products=payload.get('targetProducts', []),
        flag_type=payload.get('flagType', '红色旗子'),
    )
    return {'trendData': result}


# ==================== Shop distribution ====================

@router.post('/shop-aggregation')
async def shop_aggregation(payload: Dict):
    result = svc.compute_shop_aggregation(
        records=payload.get('records', {}),
        start_date=payload.get('startDate', ''),
        end_date=payload.get('endDate', ''),
        target_products=payload.get('targetProducts', []),
        flag_type=payload.get('flagType', '红色旗子'),
    )
    return result or {'shop': {}, 'total': 0, 'count': 0}


@router.post('/shop-trend')
async def shop_trend(payload: Dict):
    result = svc.compute_shop_trend_data(
        records=payload.get('records', {}),
        start_date=payload.get('startDate', ''),
        end_date=payload.get('endDate', ''),
        top_shops=payload.get('topShops', []),
        target_products=payload.get('targetProducts', []),
        flag_type=payload.get('flagType', '红色旗子'),
    )
    return {'trendData': result}


@router.post('/shop-all-shops')
async def shop_all_shops(payload: Dict):
    result = svc.compute_shop_all_shops(
        records=payload.get('records', {}),
        start_date=payload.get('startDate', ''),
        end_date=payload.get('endDate', ''),
        product_names=payload.get('productNames', []),
    )
    return {'allShops': result}


@router.post('/shop-filtered-products')
async def shop_filtered_products(payload: Dict):
    result = svc.compute_shop_filtered_products(
        records=payload.get('records', {}),
        start_date=payload.get('startDate', ''),
        end_date=payload.get('endDate', ''),
        products_to_aggregate=payload.get('productsToAggregate', []),
        selected_filter_shops=payload.get('selectedFilterShops', []),
    )
    return {'products': result}


# ==================== Build product data from shops ====================

@router.post('/build-product-from-shops')
async def build_product_from_shops(payload: Dict):
    shop_stats = payload.get('shopStats', {})
    result = svc.build_product_data_from_shop_stats(shop_stats)
    return {'productData': result}


# ==================== Merge records ====================

@router.post('/merge-records')
async def compute_merge_records(payload: Dict):
    local = payload.get('local', {})
    cloud = payload.get('cloud', {})
    result = svc.merge_records(local, cloud)
    return {'records': result}
