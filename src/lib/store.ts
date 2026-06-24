/**
 * @deprecated - This module is being split into focused modules.
 * All business logic now lives in the backend API.
 * Frontend only imports UI helpers from storage.ts and async wrappers from compute-service.ts
 *
 * Import directly from:
 *   - ./storage       (localStorage persistence)
 *   - ./compute-service (async API wrappers for backend computation)
 *   - ./records-service (records CRUD, aliases, sync)
 *   - ./api           (backend API client)
 */

// Storage layer (persistence only)
export {
  setActiveUser,
  getActiveUser,
  loadAllRecords,
  saveAllRecords,
  loadProductAliases,
  saveProductAliases,
} from './storage';

// Computation / business logic (async wrappers calling backend API)
export {
  getProductTotal,
  getFlags,
  getFlagCount,
  getRedFlagReasons,
  getRemarkByFlag,
  getRegionDistribution,
  getShopDistribution,
  validateImportData,
  parseDirtyJson,
  computeDaySummary,
  computeFilteredSummary,
  computeOptions,
  computeTrendData,
  computeProductAnalysis,
  getProductQtyStats,
  flattenRemarkCounts,
  getRemarkOtherDetails,
  getProductDisplayName,
  getISOWeekRange,
  getMonthRange,
  getYearRange,
  getDatesInRange,
  buildProductDataFromShopStats,
  computeRegionAggregation,
  computeRegionTrend,
  computeShopAggregation,
  computeShopTrend,
  computeShopAllShops,
  computeShopFilteredProducts,
} from './compute-service';

// Record operations & sync
export {
  updateDateRecord,
  addDateRecord,
  removeDateRecord,
  setProductAlias,
  mergeRecords,
  syncToCloud,
  fetchFromCloud,
} from './records-service';
