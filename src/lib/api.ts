/**
 * API client for the FastAPI backend.
 * All business logic computation is handled by the backend via these endpoints.
 * Frontend only calls API and renders results.
 */
import type { AllRecords, ProductAliases } from './types';
import { safeFetch } from './fetch-utils';

async function request<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  // All requests go through Next.js proxy (rewrites in next.config.ts) — no direct backend calls
  const res = await safeFetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'API error: ' + res.status);
  }
  return res.json();
}

// ==================== Records API ====================

export async function loadAllRecords(): Promise<AllRecords> {
  const data = await request<{ records: AllRecords }>('/api/records');
  return data.records;
}

export async function saveAllRecords(records: AllRecords): Promise<void> {
  await request('/api/records/sync/upload', {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
}

export async function addDateRecord(
  date: string,
  data: Record<string, unknown>,
): Promise<AllRecords> {
  await request(`/api/records/${date}`, {
    method: 'POST',
    body: JSON.stringify({ data, importedAt: Date.now() }),
  });
  return loadAllRecords();
}

export async function removeDateRecord(date: string): Promise<AllRecords> {
  await request(`/api/records/${date}`, { method: 'DELETE' });
  return loadAllRecords();
}

// ==================== Aliases API ====================

export async function loadProductAliases(): Promise<ProductAliases> {
  const data = await request<{ aliases: ProductAliases }>('/api/aliases');
  return data.aliases;
}

export async function saveProductAliases(aliases: ProductAliases): Promise<void> {
  for (const [name, info] of Object.entries(aliases)) {
    await request(`/api/aliases/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(info),
    });
  }
}

export async function setProductAlias(
  originalName: string,
  alias: string,
  note: string,
): Promise<ProductAliases> {
  const data = await request<{ aliases: ProductAliases }>(`/api/aliases/${encodeURIComponent(originalName)}`, {
    method: 'PUT',
    body: JSON.stringify({ alias, note }),
  });
  return data.aliases;
}

// ==================== Compute API - Data Extraction ====================

export async function apiGetProductTotal(item: unknown): Promise<number> {
  const data = await request<{ result: number }>('/api/compute/extract/product-total', {
    method: 'POST',
    body: JSON.stringify({ item }),
  });
  return data.result;
}

export async function apiGetFlags(item: unknown): Promise<Record<string, number>> {
  const data = await request<{ result: Record<string, number> }>('/api/compute/extract/flags', {
    method: 'POST',
    body: JSON.stringify({ item }),
  });
  return data.result;
}

export async function apiGetFlagCount(item: unknown, flagType: string): Promise<number> {
  const data = await request<{ result: number }>('/api/compute/extract/flag-count', {
    method: 'POST',
    body: JSON.stringify({ item, flagType }),
  });
  return data.result;
}

export async function apiGetRedFlagReasons(item: unknown): Promise<Record<string, number>> {
  const data = await request<{ result: Record<string, number> }>('/api/compute/extract/red-flag-reasons', {
    method: 'POST',
    body: JSON.stringify({ item }),
  });
  return data.result;
}

export async function apiGetRegionDistribution(item: unknown): Promise<Record<string, unknown>> {
  const data = await request<{ result: Record<string, unknown> }>('/api/compute/extract/region-distribution', {
    method: 'POST',
    body: JSON.stringify({ item }),
  });
  return data.result;
}

export async function apiGetShopDistribution(item: unknown): Promise<Record<string, number>> {
  const data = await request<{ result: Record<string, number> }>('/api/compute/extract/shop-distribution', {
    method: 'POST',
    body: JSON.stringify({ item }),
  });
  return data.result;
}

export async function apiFlattenRemarkCounts(raw: Record<string, unknown>): Promise<Record<string, number>> {
  const data = await request<{ result: Record<string, number> }>('/api/compute/extract/flatten-remark', {
    method: 'POST',
    body: JSON.stringify({ raw }),
  });
  return data.result;
}

export async function apiGetProductQtyStats(productData: unknown): Promise<Record<string, number>> {
  const data = await request<{ result: Record<string, number> }>('/api/compute/extract/product-qty-stats', {
    method: 'POST',
    body: JSON.stringify({ productData }),
  });
  return data.result;
}

export async function apiGetRemarkOtherDetails(productData: unknown, flagType: string): Promise<Record<string, unknown> | null> {
  const data = await request<{ result: Record<string, unknown> | null }>('/api/compute/extract/remark-other-details', {
    method: 'POST',
    body: JSON.stringify({ productData, flagType }),
  });
  return data.result;
}

export async function apiGetProductDisplayName(originalName: string, aliases: ProductAliases): Promise<string> {
  const data = await request<{ result: string }>('/api/compute/extract/product-display-name', {
    method: 'POST',
    body: JSON.stringify({ originalName, aliases }),
  });
  return data.result;
}

// ==================== Compute API - Validation ====================

export async function apiValidateImportData(parsed: unknown): Promise<boolean> {
  const data = await request<{ valid: boolean }>('/api/compute/validate-import', {
    method: 'POST',
    body: JSON.stringify({ parsed }),
  });
  return data.valid;
}

export async function apiParseDirtyJson(raw: string): Promise<{ success: boolean; result?: unknown; error?: string }> {
  return request<{ success: boolean; result?: unknown; error?: string }>('/api/compute/parse-json', {
    method: 'POST',
    body: JSON.stringify({ raw }),
  });
}

// ==================== Compute API - Date Utilities ====================

export async function apiGetDateRangeWeek(date: string): Promise<{ start: string; end: string }> {
  return request(`/api/compute/date-range/week?date=${date}`);
}

export async function apiGetDateRangeMonth(date: string): Promise<{ start: string; end: string }> {
  return request(`/api/compute/date-range/month?date=${date}`);
}

export async function apiGetDateRangeYear(date: string): Promise<{ start: string; end: string }> {
  return request(`/api/compute/date-range/year?date=${date}`);
}

export async function apiGetDatesInRange(start: string, end: string): Promise<{ dates: string[] }> {
  return request(`/api/compute/dates-in-range?start=${start}&end=${end}`);
}

// ==================== Compute API - Summaries ====================

export async function apiComputeDaySummary(date: string, records: AllRecords): Promise<{ summary: unknown }> {
  return request('/api/compute/day-summary', {
    method: 'POST',
    body: JSON.stringify({ date, records }),
  });
}

export async function apiComputeFilteredSummary(
  records: AllRecords,
  startDate: string,
  endDate: string,
  selectedProducts: string[],
  selectedShops: string[],
): Promise<{ summary: { totalOrders: number; redFlags: number; productBreakdown: { name: string; total: number; redFlags: number }[]; topReasons: [string, number][] } | null }> {
  return request('/api/compute/filtered-summary', {
    method: 'POST',
    body: JSON.stringify({ records, startDate, endDate, selectedProducts, selectedShops }),
  });
}

export async function apiComputeOptions(
  records: AllRecords,
  startDate: string,
  endDate: string,
  selectedProducts: string[],
  selectedShops: string[],
  aliases: ProductAliases,
): Promise<{
  productOptions: { label: string; value: string; count: number }[];
  shopOptions: { label: string; value: string; count: number }[];
  allProducts: string[];
  allShops: string[];
}> {
  return request('/api/compute/options', {
    method: 'POST',
    body: JSON.stringify({ records, startDate, endDate, selectedProducts, selectedShops, aliases }),
  });
}

// ==================== Compute API - Trend Data ====================

export async function apiComputeTrendData(
  records: AllRecords,
  startDate: string,
  endDate: string,
  timeMode: string,
  selectedProducts: string[],
  selectedShops: string[],
  aliases: ProductAliases,
): Promise<{
  dailyData: { date: string; label: string; totalOrders: number; redFlags: number; greenFlags: number; greyFlags: number; products: Record<string, number>; reasons: Record<string, number> }[];
  topProducts: string[];
  topReasons: string[];
}> {
  return request('/api/compute/trend-data', {
    method: 'POST',
    body: JSON.stringify({ records, startDate, endDate, timeMode, selectedProducts, selectedShops, aliases }),
  });
}

// ==================== Compute API - Product Analysis ====================

export async function apiComputeProductAnalysis(
  records: AllRecords,
  startDate: string,
  endDate: string,
  productName: string,
  selectedShops: string[],
): Promise<{
  productData: Record<string, unknown>;
  globalTotal: number;
  stats: { total: number; qtyStats: Record<string, number>; singleRatio: string; topQty: string; topQtyVal: number };
}> {
  return request('/api/compute/product-analysis', {
    method: 'POST',
    body: JSON.stringify({ records, startDate, endDate, productName, selectedShops }),
  });
}

// ==================== Compute API - Region Distribution ====================

export async function apiComputeRegionAggregation(
  records: AllRecords,
  startDate: string,
  endDate: string,
  targetProducts: string[],
  flagType: string = '红色旗子',
): Promise<{ region: Record<string, { count: number; town_village: number }>; total: number; count: number }> {
  return request('/api/compute/region-aggregation', {
    method: 'POST',
    body: JSON.stringify({ records, startDate, endDate, targetProducts, flagType }),
  });
}

export async function apiComputeRegionTrend(
  records: AllRecords,
  startDate: string,
  endDate: string,
  topRegions: string[],
  targetProducts: string[],
  flagType: string = '红色旗子',
): Promise<{ trendData: { date: string; label: string; [region: string]: string | number }[] }> {
  return request('/api/compute/region-trend', {
    method: 'POST',
    body: JSON.stringify({ records, startDate, endDate, topRegions, targetProducts, flagType }),
  });
}

// ==================== Compute API - Shop Distribution ====================

export async function apiComputeShopAggregation(
  records: AllRecords,
  startDate: string,
  endDate: string,
  targetProducts: string[],
  flagType: string = '红色旗子',
): Promise<{ shop: Record<string, number>; total: number; count: number }> {
  return request('/api/compute/shop-aggregation', {
    method: 'POST',
    body: JSON.stringify({ records, startDate, endDate, targetProducts, flagType }),
  });
}

export async function apiComputeShopTrend(
  records: AllRecords,
  startDate: string,
  endDate: string,
  topShops: string[],
  targetProducts: string[],
  flagType: string = '红色旗子',
): Promise<{ trendData: { date: string; label: string; [shop: string]: string | number }[] }> {
  return request('/api/compute/shop-trend', {
    method: 'POST',
    body: JSON.stringify({ records, startDate, endDate, topShops, targetProducts, flagType }),
  });
}

export async function apiComputeShopAllShops(
  records: AllRecords,
  startDate: string,
  endDate: string,
  productNames: string[],
): Promise<{ allShops: { name: string; count: number }[] }> {
  return request('/api/compute/shop-all-shops', {
    method: 'POST',
    body: JSON.stringify({ records, startDate, endDate, productNames }),
  });
}

export async function apiComputeShopFilteredProducts(
  records: AllRecords,
  startDate: string,
  endDate: string,
  productsToAggregate: string[],
  selectedFilterShops: string[],
): Promise<{ products: string[] }> {
  return request('/api/compute/shop-filtered-products', {
    method: 'POST',
    body: JSON.stringify({ records, startDate, endDate, productsToAggregate, selectedFilterShops }),
  });
}

// ==================== Compute API - Build Product From Shops ====================

export async function apiBuildProductFromShops(shopStats: Record<string, unknown>): Promise<{ productData: Record<string, unknown> }> {
  return request('/api/compute/build-product-from-shops', {
    method: 'POST',
    body: JSON.stringify({ shopStats }),
  });
}

// ==================== Compute API - Merge Records ====================

export async function apiMergeRecords(local: AllRecords, cloud: AllRecords): Promise<{ records: AllRecords }> {
  return request('/api/compute/merge-records', {
    method: 'POST',
    body: JSON.stringify({ local, cloud }),
  });
}

// ==================== Keyword Rules API ====================

export async function appendReasonRule(category: string, keywords: string): Promise<{ reasons: { category: string; keywords: string }[] }> {
  return request('/api/excel/rules/reasons/append', {
    method: 'POST',
    body: JSON.stringify({ category, keywords }),
  });
}

// ==================== Health ====================

export async function checkHealth(): Promise<boolean> {
  try {
    const data = await request<{ status: string }>('/api/health');
    return data.status === 'ok';
  } catch {
    return false;
  }
}
