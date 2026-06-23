import { AllRecords, DateRecord, ProductData, WeekSummary, ProductTrendPoint, ProductAliases, RegionItem, RemarkValue, RemarkOtherValue, ShopItem, ShopFlagCategory } from './types';

const BASE_STORAGE_KEY = 'after-sales-records';
const BASE_ALIAS_KEY = 'after-sales-aliases';

/** localStorage 仅在匿名用户时作为回退存储 */
const STORAGE_KEY = BASE_STORAGE_KEY;
const ALIAS_KEY = BASE_ALIAS_KEY;

/** 从 localStorage 读取所有记录 */
export function loadAllRecords(): AllRecords {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** 保存所有记录到 localStorage */
export function saveAllRecords(records: AllRecords): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
