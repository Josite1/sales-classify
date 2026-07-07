"""
Backend compute service.
All business logic from frontend compute-service.ts and component-level aggregation.
Pure functions: given input, return output. No side effects.
"""
import re
import json
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple


# ==================== Data extraction helpers ====================

def get_product_total(item: Dict) -> int:
    return int(item.get('total', 0) or 0)


def get_flags(item: Dict) -> Dict[str, int]:
    return item.get('标旗分类', {}) or {}


def get_flag_count(item: Dict, flag_type: str) -> int:
    return get_flags(item).get(flag_type, 0) or 0


def get_region_distribution(item: Dict) -> Dict[str, Any]:
    province_flags = item.get('省份分类', {}) or {}
    if '红色旗子' in province_flags:
        return province_flags['红色旗子']
    return item.get('地域分布', {}) or {}


def get_shop_distribution(item: Dict) -> Dict[str, int]:
    shop_flags = item.get('店铺分类', {}) or {}
    if '红色旗子' in shop_flags:
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
            if '订单数' in val and isinstance(val.get('订单数'), (int, float)):
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
    if '红色旗子' in remark_flags:
        return flatten_remark_counts(remark_flags['红色旗子'])
    return {}


def get_remark_by_flag(item: Dict, flag_type: str) -> Dict:
    remark_flags = item.get('客服备注分类', {}) or {}
    return remark_flags.get(flag_type, {}) or {}


def get_shop_count(shop_val: Any) -> int:
    if isinstance(shop_val, (int, float)):
        return int(shop_val)
    if isinstance(shop_val, dict):
        cnt = shop_val.get('count', 0)
        if isinstance(cnt, (int, float)):
            return int(cnt)
        if isinstance(cnt, str):
            try:
                return int(cnt)
            except (ValueError, TypeError):
                return 0
    return 0


def get_product_qty_stats(product_data: Dict) -> Dict[str, int]:
    result = {}
    qty_data = product_data.get('数量分类', {}) or {}
    for flag, qty_map in qty_data.items():
        if isinstance(qty_map, dict):
            for qty, count in qty_map.items():
                if isinstance(count, (int, float)):
                    result[f"{flag}_{qty}"] = int(count)
    return result


def get_remark_other_details(product_data: Dict, flag_type: str) -> Optional[Dict]:
    remarks = get_remark_by_flag(product_data, flag_type)
    other_val = remarks.get('其他')
    if isinstance(other_val, dict) and '明细' in other_val:
        return other_val
    return None


def get_product_display_name(original_name: str, aliases: Dict) -> str:
    alias_info = aliases.get(original_name, {})
    if isinstance(alias_info, dict):
        return alias_info.get('alias', original_name)
    return original_name


# ==================== Validation ====================

def validate_import_data(parsed: Any) -> bool:
    """Validate that parsed data has the expected ProductData structure."""
    if not isinstance(parsed, dict):
        return False
    valid_count = 0
    for key, item in parsed.items():
        if not isinstance(item, dict):
            continue
        total_val = item.get('total')
        if total_val is not None:
            try:
                float(total_val)
                valid_count += 1
            except (ValueError, TypeError):
                pass
    return valid_count > 0


def parse_dirty_json(raw_str: str) -> Any:
    """Parse potentially malformed JSON, fixing common issues."""
    s = raw_str.strip()
    # Try standard parse first
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass

    # Find object/array boundaries
    obj_start = s.find('{')
    obj_end = s.rfind('}')
    arr_start = s.find('[')
    arr_end = s.rfind(']')

    start, end = -1, -1
    if obj_start != -1 and obj_end != -1 and (arr_start == -1 or obj_start < arr_start):
        start, end = obj_start, obj_end
    elif arr_start != -1 and arr_end != -1:
        start, end = arr_start, arr_end

    if start != -1 and end > start:
        cleaned = s[start:end + 1]
        # Fix unquoted keys
        cleaned = re.sub(r'([{,]\s*)(\w+)(\s*:)', r'\1"\2"\3', cleaned)
        # Fix trailing commas
        cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)
        # Replace single quotes with double quotes
        cleaned = cleaned.replace("'", '"')
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass
    return None


# ==================== Date utilities ====================

def get_iso_week_range(date_str: str) -> Dict[str, str]:
    d = date.fromisoformat(date_str)
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return {'start': monday.isoformat(), 'end': sunday.isoformat()}


def get_month_range(date_str: str) -> Dict[str, str]:
    d = date.fromisoformat(date_str)
    start = d.replace(day=1)
    if d.month == 12:
        end = d.replace(year=d.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        end = d.replace(month=d.month + 1, day=1) - timedelta(days=1)
    return {'start': start.isoformat(), 'end': end.isoformat()}


def get_year_range(date_str: str) -> Dict[str, str]:
    d = date.fromisoformat(date_str)
    return {'start': f'{d.year}-01-01', 'end': f'{d.year}-12-31'}


def get_dates_in_range(start_str: str, end_str: str) -> List[str]:
    dates = []
    current = date.fromisoformat(start_str)
    end = date.fromisoformat(end_str)
    while current <= end:
        dates.append(current.isoformat())
        current += timedelta(days=1)
    return dates


def get_iso_week_label(date_str: str) -> str:
    d = date.fromisoformat(date_str)
    iso_year, iso_week, _ = d.isocalendar()
    return f'{iso_year}-W{iso_week:02d}'


def get_week_monday(date_str: str) -> str:
    d = date.fromisoformat(date_str)
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()


def get_week_sunday(monday_str: str) -> str:
    d = date.fromisoformat(monday_str)
    sunday = d + timedelta(days=6)
    return sunday.isoformat()


# ==================== Aggregation & Summary ====================

def compute_day_summary(date_str: str, records: Dict) -> Optional[Dict]:
    record = records.get(date_str)
    if not record:
        return None

    total_orders = 0
    red_flags = 0
    product_breakdown = []
    reason_agg = {}

    for name, item in record.get('data', {}).items():
        total = get_product_total(item)
        total_orders += total
        rf = get_flag_count(item, '红色旗子')
        red_flags += rf
        reasons = get_red_flag_reasons(item)
        for reason, count in reasons.items():
            reason_agg[reason] = reason_agg.get(reason, 0) + count
        product_breakdown.append({'name': name, 'total': total, 'redFlags': rf})

    product_breakdown.sort(key=lambda x: x['total'], reverse=True)
    top_reasons = sorted(reason_agg.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        'date': date_str,
        'totalOrders': total_orders,
        'redFlags': red_flags,
        'productBreakdown': product_breakdown,
        'topReasons': [[k, v] for k, v in top_reasons],
    }


def compute_filtered_summary(
    records: Dict,
    start_date: str,
    end_date: str,
    selected_products: List[str],
    selected_shops: List[str],
) -> Optional[Dict]:
    """Compute filtered summary (from DayOverview computeFilteredSummary)."""
    total_orders = 0
    red_flags = 0
    product_map = {}

    dates = [d for d in sorted(records.keys()) if start_date <= d <= end_date]
    if not dates:
        return None

    for d in dates:
        record = records[d]
        for p_name, p_data in record.get('data', {}).items():
            if selected_products and p_name not in selected_products:
                continue

            p_total = 0
            p_red_flags = 0

            if selected_shops:
                shop_stats = p_data.get('店铺分类', {}) or {}
                has_match = False
                for flag, shops_in_flag in shop_stats.items():
                    if not isinstance(shops_in_flag, dict):
                        continue
                    for s_name, shop_val in shops_in_flag.items():
                        if s_name in selected_shops:
                            cnt = get_shop_count(shop_val)
                            has_match = True
                            p_total += cnt
                            if flag == '红色旗子':
                                p_red_flags += cnt
                if not has_match:
                    continue
            else:
                p_total = get_product_total(p_data)
                p_red_flags = get_flags(p_data).get('红色旗子', 0) or 0

            if p_total == 0:
                continue

            total_orders += p_total
            red_flags += p_red_flags

            if p_name not in product_map:
                product_map[p_name] = {'total': 0, 'redFlags': 0, 'reasons': {}}
            product_map[p_name]['total'] += p_total
            product_map[p_name]['redFlags'] += p_red_flags

            reasons = get_red_flag_reasons(p_data)
            for r, c in reasons.items():
                product_map[p_name]['reasons'][r] = product_map[p_name]['reasons'].get(r, 0) + c

    if total_orders == 0:
        return None

    product_breakdown = sorted(
        [{'name': k, 'total': v['total'], 'redFlags': v['redFlags']}
         for k, v in product_map.items()],
        key=lambda x: x['total'], reverse=True
    )

    reason_agg = {}
    for v in product_map.values():
        for r, c in v['reasons'].items():
            reason_agg[r] = reason_agg.get(r, 0) + c

    top_reasons = sorted(reason_agg.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        'totalOrders': total_orders,
        'redFlags': red_flags,
        'productBreakdown': product_breakdown,
        'topReasons': [[k, v] for k, v in top_reasons],
    }


def compute_options(
    records: Dict,
    start_date: str,
    end_date: str,
    selected_products: List[str],
    selected_shops: List[str],
    aliases: Dict,
) -> Dict:
    """Compute product and shop options with counts (from DayOverview/WeeklyTrendChart)."""
    product_count = {}
    shop_count = {}
    products_set = set()
    shops_set = set()

    dates = [d for d in sorted(records.keys()) if start_date <= d <= end_date]

    # First pass: collect all product and shop names
    for d in dates:
        record = records[d]
        for p_name, p_data in record.get('data', {}).items():
            products_set.add(p_name)
            shop_stats = p_data.get('店铺分类', {}) or {}
            for flag, shops_in_flag in shop_stats.items():
                if isinstance(shops_in_flag, dict):
                    for s_name in shops_in_flag:
                        shops_set.add(s_name)

    for p in products_set:
        product_count[p] = 0
    for s in shops_set:
        shop_count[s] = 0

    # Second pass: compute counts
    for d in dates:
        record = records[d]
        for p_name, p_data in record.get('data', {}).items():
            shop_stats = p_data.get('店铺分类', {}) or {}

            if selected_shops:
                p_total = 0
                for flag, shops_in_flag in shop_stats.items():
                    if not isinstance(shops_in_flag, dict):
                        continue
                    for s_name, shop_val in shops_in_flag.items():
                        if s_name in selected_shops:
                            p_total += get_shop_count(shop_val)
                if p_total > 0:
                    product_count[p_name] = product_count.get(p_name, 0) + p_total
            else:
                product_count[p_name] = product_count.get(p_name, 0) + get_product_total(p_data)

            if selected_products and p_name not in selected_products:
                continue

            for flag, shops_in_flag in shop_stats.items():
                if not isinstance(shops_in_flag, dict):
                    continue
                for s_name, shop_val in shops_in_flag.items():
                    shop_count[s_name] = shop_count.get(s_name, 0) + get_shop_count(shop_val)

    product_options = sorted(
        [{'label': get_product_display_name(p, aliases), 'value': p, 'count': product_count.get(p, 0)}
         for p in products_set],
        key=lambda x: x['count'], reverse=True
    )

    shop_options = sorted(
        [{'label': s, 'value': s, 'count': shop_count.get(s, 0)}
         for s in shops_set],
        key=lambda x: x['count'], reverse=True
    )

    return {
        'productOptions': product_options,
        'shopOptions': shop_options,
        'allProducts': sorted(products_set),
        'allShops': sorted(shops_set),
    }


# ==================== Trend Data (WeeklyTrendChart) ====================

def _compute_single_day_summary(
    date_str: str,
    record: Optional[Dict],
    sel_products: List[str],
    sel_shops: List[str],
    aliases: Dict,
) -> Dict:
    """Helper for trend data: compute one day's aggregated stats."""
    result = {
        'totalOrders': 0, 'redFlags': 0, 'greenFlags': 0, 'greyFlags': 0,
        'yellowFlags': 0, 'purpleFlags': 0,
        'products': {}, 'reasons': {},
    }
    if not record:
        return result

    for p_name, p_data in record.get('data', {}).items():
        if sel_products and p_name not in sel_products:
            continue

        p_total = 0
        p_red = 0
        p_green = 0
        p_grey = 0
        p_yellow = 0
        p_purple = 0
        shop_stats = p_data.get('店铺分类', {}) or {}

        if sel_shops:
            for flag, shops_in_flag in shop_stats.items():
                if not isinstance(shops_in_flag, dict):
                    continue
                flag_count = 0
                for s_name, shop_val in shops_in_flag.items():
                    if s_name not in sel_shops:
                        continue
                    cnt = get_shop_count(shop_val)
                    if cnt == 0:
                        continue
                    flag_count += cnt
                    if flag == '红色旗子' and isinstance(shop_val, dict):
                        shop = shop_val
                        remark_cats = shop.get('客服备注分类', {}) or {}
                        for reason, val in remark_cats.items():
                            if isinstance(val, (int, float)):
                                result['reasons'][reason] = result['reasons'].get(reason, 0) + int(val)
                            elif isinstance(val, dict) and '订单数' in val:
                                result['reasons'][reason] = result['reasons'].get(reason, 0) + val['订单数']

                if flag_count == 0:
                    continue
                p_total += flag_count
                if flag == '红色旗子':
                    p_red += flag_count
                elif flag == '绿色旗子':
                    p_green += flag_count
                elif flag == '灰色旗子':
                    p_grey += flag_count
                elif flag == '黄色旗子':
                    p_yellow += flag_count
                elif flag == '紫色旗子':
                    p_purple += flag_count
        else:
            p_total = get_product_total(p_data)
            flags = get_flags(p_data)
            p_red = flags.get('红色旗子', 0) or 0
            p_green = flags.get('绿色旗子', 0) or 0
            p_grey = flags.get('灰色旗子', 0) or 0
            p_yellow = flags.get('黄色旗子', 0) or 0
            p_purple = flags.get('紫色旗子', 0) or 0
            red_reasons = get_red_flag_reasons(p_data)
            for reason, count in red_reasons.items():
                result['reasons'][reason] = result['reasons'].get(reason, 0) + count

        if p_total == 0:
            continue

        result['totalOrders'] += p_total
        result['redFlags'] += p_red
        result['greenFlags'] += p_green
        result['greyFlags'] += p_grey
        result['yellowFlags'] += p_yellow
        result['purpleFlags'] += p_purple

        dn = get_product_display_name(p_name, aliases)
        result['products'][dn] = result['products'].get(dn, 0) + p_total

    return result


def _get_day_label(date_str: str) -> str:
    d = date.fromisoformat(date_str)
    week_days = ['日', '一', '二', '三', '四', '五', '六']
    return f"{d.month}/{d.day} 周{week_days[d.weekday()]}"


def compute_trend_data(
    records: Dict,
    start_date: str,
    end_date: str,
    time_mode: str,
    selected_products: List[str],
    selected_shops: List[str],
    aliases: Dict,
) -> List[Dict]:
    """Compute trend data for WeeklyTrendChart."""
    all_dates = get_dates_in_range(start_date, end_date)

    if time_mode == 'week':
        # Daily breakdown
        return [_make_trend_point(
            d, records.get(d), selected_products, selected_shops, aliases
        ) for d in all_dates]

    elif time_mode == 'month':
        # Weekly aggregation
        week_map = defaultdict(lambda: {'days': [], 'week_start': '', 'week_end': ''})
        for d_str in all_dates:
            wr = get_iso_week_range(d_str)
            key = wr['start']
            week_map[key]['days'].append(d_str)
            week_map[key]['week_start'] = wr['start']
            week_map[key]['week_end'] = wr['end']

        result = []
        for idx, (monday, info) in enumerate(sorted(week_map.items())):
            agg = {'totalOrders': 0, 'redFlags': 0, 'greenFlags': 0, 'greyFlags': 0,
                   'yellowFlags': 0, 'purpleFlags': 0,
                   'products': {}, 'reasons': {}}
            for d_str in info['days']:
                s = _compute_single_day_summary(d_str, records.get(d_str), selected_products, selected_shops, aliases)
                agg['totalOrders'] += s['totalOrders']
                agg['redFlags'] += s['redFlags']
                agg['greenFlags'] += s['greenFlags']
                agg['greyFlags'] += s['greyFlags']
                agg['yellowFlags'] += s['yellowFlags']
                agg['purpleFlags'] += s['purpleFlags']
                for k, v in s['products'].items():
                    agg['products'][k] = agg['products'].get(k, 0) + v
                for k, v in s['reasons'].items():
                    agg['reasons'][k] = agg['reasons'].get(k, 0) + v

            start_str = info['week_start'][5:]
            end_str = info['week_end'][5:]
            result.append({
                'label': f"W{idx + 1} {start_str}~{end_str}",
                **agg
            })
        return result

    elif time_mode == 'year':
        # Monthly aggregation
        result = []
        for month_idx in range(12):
            first = date.fromisoformat(start_date[:4] + '-01-01')
            month_start = first.replace(month=month_idx + 1, day=1)
            if month_idx == 11:
                month_end = month_start.replace(year=month_start.year + 1, month=1) - timedelta(days=1)
            else:
                month_end = month_start.replace(month=month_start.month + 1, day=1) - timedelta(days=1)
            month_dates = get_dates_in_range(month_start.isoformat(), month_end.isoformat())

            agg = {'totalOrders': 0, 'redFlags': 0, 'greenFlags': 0, 'greyFlags': 0,
                   'yellowFlags': 0, 'purpleFlags': 0,
                   'products': {}, 'reasons': {}}
            for d_str in month_dates:
                s = _compute_single_day_summary(d_str, records.get(d_str), selected_products, selected_shops, aliases)
                agg['totalOrders'] += s['totalOrders']
                agg['redFlags'] += s['redFlags']
                agg['greenFlags'] += s['greenFlags']
                agg['greyFlags'] += s['greyFlags']
                agg['yellowFlags'] += s['yellowFlags']
                agg['purpleFlags'] += s['purpleFlags']
                for k, v in s['products'].items():
                    agg['products'][k] = agg['products'].get(k, 0) + v
                for k, v in s['reasons'].items():
                    agg['reasons'][k] = agg['reasons'].get(k, 0) + v

            result.append({
                'label': f"{month_start.year}-{month_start.month:02d}",
                **agg
            })
        return result

    else:  # custom
        return [_make_trend_point(
            d, records.get(d), selected_products, selected_shops, aliases
        ) for d in all_dates]


def _make_trend_point(
    date_str: str,
    record: Optional[Dict],
    sel_products: List[str],
    sel_shops: List[str],
    aliases: Dict,
) -> Dict:
    """Make a single trend data point with label."""
    summary = _compute_single_day_summary(date_str, record, sel_products, sel_shops, aliases)
    return {
        'date': date_str,
        'label': _get_day_label(date_str),
        **summary,
    }


def compute_trend_top_items(daily_data: List[Dict], key: str, count: int = 8) -> List[str]:
    """Extract top N items from trend daily data by aggregation key (products/reasons)."""
    totals = {}
    for d in daily_data:
        for name, c in d.get(key, {}).items():
            totals[name] = totals.get(name, 0) + c
    return [name for name, _ in sorted(totals.items(), key=lambda x: x[1], reverse=True)[:count]]


# ==================== Product Analysis ====================

def build_product_data_from_shop_stats(shop_stats: Dict) -> Dict:
    """Rebuild a ProductData from filtered shop stats (product-analysis.tsx)."""
    flags = {}
    qty_flag_category = {}
    remark_flag_category = {}

    for flag_name, shops in shop_stats.items():
        if not isinstance(shops, dict):
            continue
        flags[flag_name] = 0
        qty_flag_category[flag_name] = {}
        remark_flag_category[flag_name] = {}

        for shop_name, shop_val in shops.items():
            if shop_val is None:
                continue
            if isinstance(shop_val, (int, float)):
                flags[flag_name] += int(shop_val)
                continue

            shop = shop_val if isinstance(shop_val, dict) else {}
            cnt = shop.get('count', 0)
            if isinstance(cnt, (int, float)):
                flags[flag_name] += int(cnt)

            qty_dist = shop.get('数量分布', {}) or {}
            for qty, cnt in qty_dist.items():
                if isinstance(cnt, (int, float)):
                    qty_flag_category[flag_name][qty] = \
                        qty_flag_category[flag_name].get(qty, 0) + int(cnt)

            remark_cats = shop.get('客服备注分类', {}) or {}
            for reason, val in remark_cats.items():
                if isinstance(val, (int, float)):
                    remark_flag_category[flag_name][reason] = \
                        remark_flag_category[flag_name].get(reason, 0) + int(val)
                elif isinstance(val, dict) and '订单数' in val:
                    remark_flag_category[flag_name][reason] = \
                        remark_flag_category[flag_name].get(reason, 0) + val['订单数']

    total = sum(flags.values())

    return {
        'total': total,
        '标旗分类': flags,
        '数量分类': qty_flag_category,
        '客服备注分类': remark_flag_category,
        '省份分类': {},
        '店铺分类': shop_stats,
    }


def merge_product_data(a: Dict, b: Dict) -> Dict:
    """Merge two ProductData objects recursively (product-analysis.tsx)."""
    result = dict(a)
    for key in b:
        b_val = b[key]
        if isinstance(b_val, (int, float)):
            result[key] = (result.get(key, 0) or 0) + int(b_val)
        elif isinstance(b_val, dict):
            if key in result and isinstance(result[key], dict):
                result[key] = merge_product_data(result[key], b_val)
            else:
                result[key] = b_val
        else:
            result[key] = b_val
    return result


def compute_product_analysis(
    records: Dict,
    start_date: str,
    end_date: str,
    product_name: str,
    selected_shops: List[str],
) -> Optional[Dict]:
    """Compute product analysis aggregation (product-analysis.tsx)."""
    dates = get_dates_in_range(start_date, end_date)
    merged = None

    for d_str in dates:
        record = records.get(d_str)
        if not record:
            continue
        raw_data = record.get('data', {}).get(product_name)
        if not raw_data:
            continue

        if selected_shops:
            shop_stats = raw_data.get('店铺分类', {}) or {}
            new_shop_stats = {}
            has_data = False
            for flag, shops in shop_stats.items():
                if not isinstance(shops, dict):
                    continue
                filtered_shops = {}
                for shop, shop_val in shops.items():
                    if shop in selected_shops:
                        filtered_shops[shop] = shop_val
                        has_data = True
                if filtered_shops:
                    new_shop_stats[flag] = filtered_shops
            if not has_data:
                continue
            filtered = build_product_data_from_shop_stats(new_shop_stats)
        else:
            filtered = raw_data

        if merged is None:
            merged = dict(filtered)
        else:
            merged = merge_product_data(merged, filtered)

    return merged


def compute_product_global_total(records: Dict, start_date: str, end_date: str) -> int:
    """Compute total orders across all products in date range."""
    total = 0
    dates = get_dates_in_range(start_date, end_date)
    for d_str in dates:
        record = records.get(d_str)
        if not record:
            continue
        for pd in record.get('data', {}).values():
            total += get_product_total(pd)
    return total


def compute_product_stats(product_data: Dict) -> Dict:
    """Compute product statistics (single ratio, top qty, etc.)."""
    total = get_product_total(product_data)
    qty_stats = get_product_qty_stats(product_data)
    single_count = qty_stats.get('1', 0)

    top_qty = '-'
    top_qty_val = 0
    for k, v in qty_stats.items():
        if v > top_qty_val:
            top_qty_val = v
            top_qty = k

    return {
        'total': total,
        'qtyStats': qty_stats,
        'singleRatio': f"{((single_count / total) * 100) if total > 0 else 0:.1f}",
        'topQty': top_qty,
        'topQtyVal': top_qty_val,
    }


# ==================== Region data ====================

def normalize_province_name(name: str) -> str:
    """Normalize Chinese province name by removing suffixes."""
    return (name
            .replace('省', '')
            .replace('市', '')
            .replace('壮族自治区', '')
            .replace('回族自治区', '')
            .replace('维吾尔自治区', '')
            .replace('自治区', '')
            .replace('特别行政区', ''))


def get_region_distribution_by_flag(item: Dict, flag_type: str = '红色旗子') -> Dict[str, Any]:
    """Get region distribution for a specific flag type."""
    province_flags = item.get('省份分类', {}) or {}
    if flag_type == '总数':
        result = {}
        for flag_name, provinces in province_flags.items():
            if not isinstance(provinces, dict):
                continue
            for prov_name, prov_item in provinces.items():
                if isinstance(prov_item, dict):
                    if prov_name not in result:
                        result[prov_name] = {'count': 0, 'town_village': 0}
                    result[prov_name]['count'] += prov_item.get('count', 0)
                    result[prov_name]['town_village'] += prov_item.get('town_village', 0)
        return result
    elif flag_type in province_flags:
        return province_flags[flag_type]
    return {}


def compute_region_aggregation(
    records: Dict,
    start_date: str,
    end_date: str,
    target_products: List[str],
    flag_type: str = '红色旗子',
) -> Optional[Dict]:
    """Aggregate region data across dates and products (region-distribution.tsx)."""
    dates = [d for d in sorted(records.keys()) if start_date <= d <= end_date]
    if not target_products or not dates:
        return None

    agg_region = {}
    agg_total = 0
    for d_str in dates:
        record = records.get(d_str)
        if not record:
            continue
        for pname in target_products:
            pd = record.get('data', {}).get(pname)
            if not pd:
                continue
            if flag_type == '总数':
                agg_total += get_product_total(pd)
            else:
                flags = get_flags(pd)
                agg_total += flags.get(flag_type, 0) or 0
            rg = get_region_distribution_by_flag(pd, flag_type)
            for region, item in rg.items():
                if region not in agg_region:
                    agg_region[region] = {'count': 0, 'town_village': 0}
                agg_region[region]['count'] += item['count']
                agg_region[region]['town_village'] += item['town_village']

    return {
        'region': agg_region,
        'total': agg_total,
        'count': len(target_products),
    }


def compute_region_trend_data(
    records: Dict,
    start_date: str,
    end_date: str,
    top_regions: List[str],
    target_products: List[str],
    flag_type: str = '红色旗子',
) -> List[Dict]:
    """Compute region trend data (region-distribution.tsx trend view)."""
    dates = [d for d in sorted(records.keys()) if start_date <= d <= end_date]
    result = []

    for d_str in dates:
        record = records.get(d_str)
        d_obj = date.fromisoformat(d_str)
        week_days = ['日', '一', '二', '三', '四', '五', '六']
        label = f"{d_obj.month}/{d_obj.day} 周{week_days[d_obj.weekday()]}"

        region_count = {}
        for pname in target_products:
            pd = record.get('data', {}).get(pname) if record else None
            if not pd:
                continue
            rg = get_region_distribution_by_flag(pd, flag_type)
            for region, item in rg.items():
                region_count[region] = region_count.get(region, 0) + item['count']

        point = {'date': d_str, 'label': label}
        for region in top_regions:
            point[region] = region_count.get(region, 0)
        result.append(point)

    return result


# ==================== Shop data ====================

def get_shop_distribution_by_flag(item: Dict, flag_type: str = '红色旗子') -> Dict[str, int]:
    """Get shop distribution for a specific flag type."""
    shop_flags = item.get('店铺分类', {}) or {}
    if flag_type == '总数':
        result = {}
        for flag_name, shops in shop_flags.items():
            if not isinstance(shops, dict):
                continue
            for shop, val in shops.items():
                if isinstance(val, dict) and 'count' in val:
                    result[shop] = result.get(shop, 0) + val['count']
                elif isinstance(val, (int, float)):
                    result[shop] = result.get(shop, 0) + int(val)
        return result
    elif flag_type in shop_flags:
        shops_dict = shop_flags[flag_type]
        if isinstance(shops_dict, dict):
            result = {}
            for shop, val in shops_dict.items():
                if isinstance(val, dict) and 'count' in val:
                    result[shop] = val['count']
                elif isinstance(val, (int, float)):
                    result[shop] = int(val)
            return result
    return {}


def get_shop_distribution(item: Dict) -> Dict[str, int]:
    """Get red flag shop distribution (backward compat)."""
    return get_shop_distribution_by_flag(item, '红色旗子')


def compute_shop_aggregation(
    records: Dict,
    start_date: str,
    end_date: str,
    target_products: List[str],
    flag_type: str = '红色旗子',
) -> Optional[Dict]:
    """Aggregate shop data across dates and products (shop-distribution.tsx)."""
    dates = [d for d in sorted(records.keys()) if start_date <= d <= end_date]
    if not target_products or not dates:
        return None

    agg_shop = {}
    agg_total = 0
    for d_str in dates:
        record = records.get(d_str)
        if not record:
            continue
        for pname in target_products:
            pd = record.get('data', {}).get(pname)
            if not pd:
                continue
            if flag_type == '总数':
                agg_total += get_product_total(pd)
            else:
                flags = get_flags(pd)
                agg_total += flags.get(flag_type, 0) or 0
            sh = get_shop_distribution_by_flag(pd, flag_type)
            for shop, count in sh.items():
                agg_shop[shop] = agg_shop.get(shop, 0) + count

    return {
        'shop': agg_shop,
        'total': agg_total,
        'count': len(target_products),
    }


def compute_shop_trend_data(
    records: Dict,
    start_date: str,
    end_date: str,
    top_shops: List[str],
    target_products: List[str],
    flag_type: str = '红色旗子',
) -> List[Dict]:
    """Compute shop trend data (shop-distribution.tsx trend view)."""
    dates = [d for d in sorted(records.keys()) if start_date <= d <= end_date]
    result = []

    for d_str in dates:
        record = records.get(d_str)
        d_obj = date.fromisoformat(d_str)
        week_days = ['日', '一', '二', '三', '四', '五', '六']
        label = f"{d_obj.month}/{d_obj.day} 周{week_days[d_obj.weekday()]}"

        shop_count = {}
        for pname in target_products:
            pd = record.get('data', {}).get(pname) if record else None
            if not pd:
                continue
            sh = get_shop_distribution_by_flag(pd, flag_type)
            for shop, count in sh.items():
                shop_count[shop] = shop_count.get(shop, 0) + count

        point = {'date': d_str, 'label': label}
        for shop in top_shops:
            point[shop] = shop_count.get(shop, 0)
        result.append(point)

    return result


def compute_shop_all_shops(
    records: Dict,
    start_date: str,
    end_date: str,
    product_names: List[str],
) -> List[Dict]:
    """Get all shops with their total counts (shop-distribution.tsx)."""
    dates = [d for d in sorted(records.keys()) if start_date <= d <= end_date]
    shop_totals = {}
    for d_str in dates:
        record = records.get(d_str)
        if not record:
            continue
        for pname in product_names:
            pd = record.get('data', {}).get(pname)
            if not pd:
                continue
            sh = get_shop_distribution(pd)
            for shop, count in sh.items():
                shop_totals[shop] = shop_totals.get(shop, 0) + count

    return sorted(
        [{'name': k, 'count': v} for k, v in shop_totals.items()],
        key=lambda x: x['count'], reverse=True
    )


def compute_shop_filtered_products(
    records: Dict,
    start_date: str,
    end_date: str,
    products_to_aggregate: List[str],
    selected_filter_shops: List[str],
) -> List[str]:
    """Filter products by shop presence (shop-distribution.tsx)."""
    if not selected_filter_shops:
        return products_to_aggregate

    result = []
    for pname in products_to_aggregate:
        has_shop = False
        dates = [d for d in sorted(records.keys()) if start_date <= d <= end_date]
        for d_str in dates:
            pd = records.get(d_str, {}).get('data', {}).get(pname)
            if not pd:
                continue
            sh = get_shop_distribution(pd)
            for shop in selected_filter_shops:
                if sh.get(shop, 0) > 0:
                    has_shop = True
                    break
            if has_shop:
                break
        if has_shop:
            result.append(pname)

    return result


# ==================== Merge ====================

def merge_records(local: Dict, cloud: Dict) -> Dict:
    """Merge two record sets, keeping the newer version by importedAt."""
    merged = dict(local)
    for date_key, cloud_record in cloud.items():
        if date_key not in merged:
            merged[date_key] = cloud_record
        elif cloud_record.get('importedAt', 0) > merged[date_key].get('importedAt', 0):
            merged[date_key] = cloud_record
    return merged
