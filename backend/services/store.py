'''
Core business logic: computations, aggregations, merges.
'''
from typing import Dict, List
from collections import defaultdict
from utils.helpers import get_iso_week_label, get_week_monday, get_week_sunday


def get_product_total(item: Dict) -> int:
    return int(item.get('total', 0) or 0)


def get_flags(item: Dict) -> Dict[str, int]:
    return item.get('标旗分类', {}) or {}


def get_flag_count(item: Dict, flag_type: str) -> int:
    return get_flags(item).get(flag_type, 0) or 0


def get_region_distribution(item: Dict) -> Dict[str, Dict]:
    province_flags = item.get('省份分类', {}) or {}
    if province_flags and '红色旗子' in province_flags:
        return province_flags['红色旗子']
    return item.get('地域分布', {}) or {}


def get_shop_distribution(item: Dict) -> Dict[str, int]:
    shop_flags = item.get('店铺分类', {}) or {}
    if shop_flags and '红色旗子' in shop_flags:
        result = {}
        for shop, val in shop_flags['红色旗子'].items():
            if isinstance(val, dict) and 'count' in val:
                result[shop] = val['count']
            elif isinstance(val, (int, float)):
                result[shop] = int(val)
        return result
    shop_dist = item.get('店铺分布', {}) or {}
    return {
        k: v['count'] if isinstance(v, dict) else int(v)
        for k, v in shop_dist.items()
    }


def flatten_remark_counts(raw: Dict) -> Dict[str, int]:
    result = {}
    for key, val in raw.items():
        if isinstance(val, (int, float)):
            result[key] = result.get(key, 0) + int(val)
        elif isinstance(val, dict):
            count = 0
            if '订单数' in val and isinstance(val['订单数'], (int, float)):
                count = int(val['订单数'])
            elif 'total' in val and isinstance(val.get('total'), (int, float)):
                count = int(val['total'])
            elif '明细' in val and isinstance(val['明细'], list):
                count = len(val['明细'])
            if count > 0:
                result[key] = result.get(key, 0) + count
    return result


def get_red_flag_reasons(item: Dict) -> Dict[str, int]:
    remark_flags = item.get('客服备注分类', {}) or {}
    if remark_flags and '红色旗子' in remark_flags:
        return flatten_remark_counts(remark_flags['红色旗子'])
    return {}


def get_remark_by_flag(item: Dict, flag_type: str) -> Dict:
    remark_flags = item.get('客服备注分类', {}) or {}
    return remark_flags.get(flag_type, {})


def get_remark_other_details(item: Dict, flag_type: str):
    remarks = get_remark_by_flag(item, flag_type)
    other_val = remarks.get('其他')
    if isinstance(other_val, dict) and '明细' in other_val:
        return other_val
    return None


def compute_day_summary(date_str: str, records: Dict) -> Dict:
    total_orders = 0
    red_flags = 0
    product_breakdown = []
    reason_agg = {}

    record_data = records.get(date_str, {}).get('data', {})
    for name, item in record_data.items():
        total = get_product_total(item)
        total_orders += total
        rf = get_flag_count(item, '红色旗子')
        red_flags += rf
        reasons = get_red_flag_reasons(item)
        for reason, count in reasons.items():
            reason_agg[reason] = reason_agg.get(reason, 0) + count
        product_breakdown.append({
            'name': name,
            'total': total,
            'redFlags': rf,
        })

    product_breakdown.sort(key=lambda x: x['total'], reverse=True)
    top_reasons = sorted(reason_agg.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        'date': date_str,
        'totalOrders': total_orders,
        'redFlags': red_flags,
        'productBreakdown': product_breakdown,
        'topReasons': [(k, v) for k, v in top_reasons],
    }


def compute_week_summaries(records: Dict) -> List[Dict]:
    weeks = defaultdict(lambda: {
        'dates': [],
        'products': defaultdict(int),
        'red_flags': 0,
        'top_reasons': defaultdict(int),
    })

    for date_str in sorted(records.keys()):
        record = records[date_str]
        week_label = get_iso_week_label(date_str)
        w = weeks[week_label]
        w['dates'].append(date_str)

        for product_name, item in record.get('data', {}).items():
            total = get_product_total(item)
            w['products'][product_name] += total
            rf = get_flag_count(item, '红色旗子')
            w['red_flags'] += rf
            reasons = get_red_flag_reasons(item)
            for reason, count in reasons.items():
                w['top_reasons'][reason] += count

    summaries = []
    for week_label, data in sorted(weeks.items()):
        monday = get_week_monday(data['dates'][0])
        sunday = get_week_sunday(monday)
        products = dict(data['products'])
        top_reasons = dict(
            sorted(data['top_reasons'].items(), key=lambda x: x[1], reverse=True)[:20]
        )
        summaries.append({
            'weekLabel': week_label,
            'weekStart': monday,
            'weekEnd': sunday,
            'totalOrders': sum(products.values()),
            'productCount': len(products),
            'products': products,
            'redFlags': data['red_flags'],
            'topReasons': top_reasons,
        })

    return summaries


def aggregate_records_by_range(
    records: Dict,
    start_date: str,
    end_date: str,
) -> Dict:
    date_filtered = [
        d for d in sorted(records.keys())
        if start_date <= d <= end_date
    ]
    if not date_filtered:
        return {}

    result = {}
    for date_str in date_filtered:
        record = records[date_str]
        for name, item in record.get('data', {}).items():
            if name not in result:
                result[name] = {
                    'total': 0,
                    'red_flags': 0,
                    'green_flags': 0,
                    'grey_flags': 0,
                    'reasons': {},
                }
            result[name]['total'] += get_product_total(item)
            flags = get_flags(item)
            result[name]['red_flags'] += flags.get('红色旗子', 0) or 0
            result[name]['green_flags'] += flags.get('绿色旗子', 0) or 0
            result[name]['grey_flags'] += flags.get('灰色旗子', 0) or 0
            reasons = get_red_flag_reasons(item)
            for reason, count in reasons.items():
                result[name]['reasons'][reason] = (
                    result[name]['reasons'].get(reason, 0) + count
                )

    total_orders = sum(v['total'] for v in result.values())
    red_flags = sum(v['red_flags'] for v in result.values())
    product_breakdown = sorted(
        [
            {'name': k, 'total': v['total'], 'redFlags': v['red_flags']}
            for k, v in result.items()
        ],
        key=lambda x: x['total'],
        reverse=True,
    )

    reason_agg = defaultdict(int)
    for v in result.values():
        for reason, count in v['reasons'].items():
            reason_agg[reason] += count
    top_reasons = sorted(
        reason_agg.items(), key=lambda x: x[1], reverse=True
    )[:10]

    return {
        'totalOrders': total_orders,
        'redFlags': red_flags,
        'productBreakdown': product_breakdown,
        'topReasons': [(k, v) for k, v in top_reasons],
    }


def merge_records(local: Dict, cloud: Dict) -> Dict:
    """Merge local and cloud records.
    Cloud is the source of truth for existence: dates present only in local
    (with importedAt older than the latest cloud timestamp) are treated as
    deleted from another device and removed."""
    merged = dict(local)

    # Latest cloud timestamp — used to determine if local-only dates are stale
    latest_cloud_time = max(
        (r.get('importedAt', 0) for r in cloud.values()),
        default=0
    )

    for date_key, cloud_record in cloud.items():
        if date_key not in merged:
            merged[date_key] = cloud_record
        elif cloud_record.get('importedAt', 0) > merged[date_key].get('importedAt', 0):
            merged[date_key] = cloud_record

    # Remove local-only dates that are older than the latest cloud activity.
    # These were deleted from another device and should be cleaned up.
    # Dates with importedAt > latest_cloud_time are new local data, keep them.
    for date_key in list(merged.keys()):
        if date_key not in cloud:
            local_time = merged[date_key].get('importedAt', 0)
            if local_time < latest_cloud_time or latest_cloud_time == 0:
                del merged[date_key]

    return merged
