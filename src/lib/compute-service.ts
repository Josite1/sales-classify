/**
 * Pure computation/business logic service.
 * No business logic exists here - all computation is delegated to the backend API.
 * This module provides thin async wrappers around API calls for convenience.
 */
import type { AllRecords, ProductAliases } from './types';
import {
  apiGetProductTotal,
  apiGetFlags,
  apiGetFlagCount,
  apiGetRedFlagReasons,
  apiGetRegionDistribution,
  apiGetShopDistribution,
  apiFlattenRemarkCounts,
  apiGetProductQtyStats,
  apiGetRemarkOtherDetails,
  apiGetProductDisplayName,
  apiValidateImportData,
  apiParseDirtyJson,
  apiComputeDaySummary,
  apiComputeFilteredSummary,
  apiComputeOptions,
  apiComputeTrendData,
  apiComputeProductAnalysis,
  apiComputeRegionAggregation,
  apiComputeRegionTrend,
  apiComputeShopAggregation,
  apiComputeShopTrend,
  apiComputeShopAllShops,
  apiComputeShopFilteredProducts,
  apiBuildProductFromShops,
  apiGetDateRangeWeek,
  apiGetDateRangeMonth,
  apiGetDateRangeYear,
  apiGetDatesInRange,
} from './api';

// ==================== Data extraction helpers (async API wrappers) ====================

export async function getProductTotal(item: unknown): Promise<number> {
  return apiGetProductTotal(item);
}

export async function getFlags(item: unknown): Promise<Record<string, number>> {
  return apiGetFlags(item);
}

export async function getFlagCount(item: unknown, flagType: string): Promise<number> {
  return apiGetFlagCount(item, flagType);
}

export async function getRedFlagReasons(item: unknown): Promise<Record<string, number>> {
  return apiGetRedFlagReasons(item);
}

export async function getRegionDistribution(item: unknown): Promise<Record<string, unknown>> {
  return apiGetRegionDistribution(item);
}

export async function getShopDistribution(item: unknown): Promise<Record<string, number>> {
  return apiGetShopDistribution(item);
}

export async function flattenRemarkCounts(raw: Record<string, unknown>): Promise<Record<string, number>> {
  return apiFlattenRemarkCounts(raw);
}

export async function getProductQtyStats(productData: unknown): Promise<Record<string, number>> {
  return apiGetProductQtyStats(productData);
}

export async function getRemarkOtherDetails(productData: unknown, flagType: string): Promise<Record<string, unknown> | null> {
  return apiGetRemarkOtherDetails(productData, flagType);
}

export async function getProductDisplayName(originalName: string, aliases: ProductAliases): Promise<string> {
  return apiGetProductDisplayName(originalName, aliases);
}

// ==================== Validation ====================

export async function validateImportData(parsed: unknown): Promise<boolean> {
  return apiValidateImportData(parsed);
}

export async function parseDirtyJson(rawStr: string): Promise<{ success: boolean; result?: unknown; error?: string }> {
  return apiParseDirtyJson(rawStr);
}

// ==================== Summary & Aggregation ====================

export async function computeDaySummary(dateStr: string, records: AllRecords): Promise<unknown> {
  const data = await apiComputeDaySummary(dateStr, records);
  return data.summary;
}

export async function computeFilteredSummary(
  records: AllRecords,
  startDate: string,
  endDate: string,
  selectedProducts: string[],
  selectedShops: string[],
): Promise<unknown> {
  const data = await apiComputeFilteredSummary(records, startDate, endDate, selectedProducts, selectedShops);
  return data.summary;
}

export async function computeOptions(
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
  return apiComputeOptions(records, startDate, endDate, selectedProducts, selectedShops, aliases);
}

export async function computeTrendData(
  records: AllRecords,
  startDate: string,
  endDate: string,
  timeMode: string,
  selectedProducts: string[],
  selectedShops: string[],
  aliases: ProductAliases,
): Promise<{
  dailyData: any[];
  topProducts: string[];
  topReasons: string[];
}> {
  return apiComputeTrendData(records, startDate, endDate, timeMode, selectedProducts, selectedShops, aliases);
}

export async function computeProductAnalysis(
  records: AllRecords,
  startDate: string,
  endDate: string,
  productName: string,
  selectedShops: string[],
): Promise<{
  productData: any;
  globalTotal: number;
  stats: any;
}> {
  return apiComputeProductAnalysis(records, startDate, endDate, productName, selectedShops);
}

export async function computeRegionAggregation(
  records: AllRecords,
  startDate: string,
  endDate: string,
  targetProducts: string[],
): Promise<{ region: Record<string, { count: number; town_village: number }>; total: number; count: number }> {
  return apiComputeRegionAggregation(records, startDate, endDate, targetProducts);
}

export async function computeRegionTrend(
  records: AllRecords,
  startDate: string,
  endDate: string,
  topRegions: string[],
  targetProducts: string[],
): Promise<{ trendData: { date: string; label: string; [k: string]: string | number }[] }> {
  return apiComputeRegionTrend(records, startDate, endDate, topRegions, targetProducts);
}

export async function computeShopAggregation(
  records: AllRecords,
  startDate: string,
  endDate: string,
  targetProducts: string[],
): Promise<{ shop: Record<string, number>; total: number; count: number }> {
  return apiComputeShopAggregation(records, startDate, endDate, targetProducts);
}

export async function computeShopTrend(
  records: AllRecords,
  startDate: string,
  endDate: string,
  topShops: string[],
  targetProducts: string[],
): Promise<{ trendData: { date: string; label: string; [k: string]: string | number }[] }> {
  return apiComputeShopTrend(records, startDate, endDate, topShops, targetProducts);
}

export async function computeShopAllShops(
  records: AllRecords,
  startDate: string,
  endDate: string,
  productNames: string[],
): Promise<{ allShops: { name: string; count: number }[] }> {
  return apiComputeShopAllShops(records, startDate, endDate, productNames);
}

export async function computeShopFilteredProducts(
  records: AllRecords,
  startDate: string,
  endDate: string,
  productsToAggregate: string[],
  selectedFilterShops: string[],
): Promise<{ products: string[] }> {
  return apiComputeShopFilteredProducts(records, startDate, endDate, productsToAggregate, selectedFilterShops);
}

export async function buildProductDataFromShopStats(shopStats: Record<string, unknown>): Promise<any> {
  const data = await apiBuildProductFromShops(shopStats);
  return data.productData;
}

// ==================== Date utilities (async API wrappers) ====================

export async function getISOWeekRange(dateStr: string): Promise<{ start: string; end: string }> {
  return apiGetDateRangeWeek(dateStr);
}

export async function getMonthRange(dateStr: string): Promise<{ start: string; end: string }> {
  return apiGetDateRangeMonth(dateStr);
}

export async function getYearRange(dateStr: string): Promise<{ start: string; end: string }> {
  return apiGetDateRangeYear(dateStr);
}

export async function getDatesInRange(start: string, end: string): Promise<string[]> {
  const data = await apiGetDatesInRange(start, end);
  return data.dates;
}
