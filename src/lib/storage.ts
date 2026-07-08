/**
 * LocalStorage persistence layer.
 * Responsible only for reading/writing data to localStorage.
 * No business logic, no computation, no API calls.
 */
import type { AllRecords, ProductAliases } from './types';

const BASE_STORAGE_KEY = 'after-sales-records';
const BASE_ALIAS_KEY = 'after-sales-aliases';
const BASE_CLOUD_CACHE_KEY = 'after-sales-cloud-cache';
const BASE_CLOUD_HASH_KEY = 'after-sales-cloud-hash';

/** Current active user ID (for localStorage isolation) */
let activeUserId: string | null = null;

/** Set the active user; clears old user data only on explicit user switch (not logout) */
export function setActiveUser(userId: string | null): void {
  if (activeUserId && userId && activeUserId !== userId) {
    clearUserData(activeUserId);
  }
  activeUserId = userId;
}

export function getActiveUser(): string | null {
  return activeUserId;
}

function getStorageKey(): string {
  return activeUserId ? `${BASE_STORAGE_KEY}:${activeUserId}` : BASE_STORAGE_KEY;
}

function getAliasKey(): string {
  return activeUserId ? `${BASE_ALIAS_KEY}:${activeUserId}` : BASE_ALIAS_KEY;
}

function clearUserData(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${BASE_STORAGE_KEY}:${userId}`);
    localStorage.removeItem(`${BASE_ALIAS_KEY}:${userId}`);
  } catch {
    // ignore
  }
}

/** Load all records from localStorage */
export function loadAllRecords(): AllRecords {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      console.error('[storage] JSON解析失败，数据可能已损坏:', parseErr);
      // 尝试截断恢复 — 找到最后一个有效的完整记录
      let lastValid = 0;
      for (let i = raw.length - 1; i > 0; i--) {
        if (raw[i] === '}') {
          try { const partial = raw.slice(0, i + 1) + '}'; JSON.parse(partial); lastValid = i; break; } catch {}
        }
      }
      if (lastValid > 0) {
        try {
          const recovered = JSON.parse(raw.slice(0, lastValid) + '}}');
          console.warn('[storage] 数据部分恢复，成功恢复', Object.keys(recovered).length, '条记录');
          return recovered;
        } catch {}
      }
      return {};
    }
  } catch {
    return {};
  }
}

/** Save all records to localStorage */
export function saveAllRecords(records: AllRecords): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(records));
  } catch (e) {
    console.error('[storage] 保存失败，可能是数据量过大:', e);
    // localStorage 满时不要静默失败
    if (typeof window !== 'undefined') {
      alert('数据保存失败：数据量可能超出浏览器限制。请删除部分旧日期后重试。');
    }
  }
}

/** Load product aliases from localStorage */
export function loadProductAliases(): ProductAliases {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getAliasKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Save product aliases to localStorage */
export function saveProductAliases(aliases: ProductAliases): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getAliasKey(), JSON.stringify(aliases));
}

// ==================== Cloud cache ====================

function getCloudCacheKey(): string {
  return activeUserId ? `${BASE_CLOUD_CACHE_KEY}:${activeUserId}` : BASE_CLOUD_CACHE_KEY;
}

function getCloudHashKey(): string {
  return activeUserId ? `${BASE_CLOUD_HASH_KEY}:${activeUserId}` : BASE_CLOUD_HASH_KEY;
}

/** Load cached cloud records from localStorage */
export function loadCloudCache(): AllRecords | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getCloudCacheKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Save cloud records to localStorage cache */
export function saveCloudCache(records: AllRecords): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getCloudCacheKey(), JSON.stringify(records));
  } catch (e) {
    console.warn('[storage] 云端缓存保存失败，数据过大:', e);
    try { localStorage.removeItem(getCloudCacheKey()); } catch {}
  }
}

/** Load cached cloud hash from localStorage */
export function loadCloudHash(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(getCloudHashKey());
  } catch {
    return null;
  }
}

/** Save cloud hash to localStorage */
export function saveCloudHash(hash: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getCloudHashKey(), hash);
  } catch { /* ignore */ }
}

/** Clear cloud cache */
export function clearCloudCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getCloudCacheKey());
    localStorage.removeItem(getCloudHashKey());
  } catch { /* ignore */ }
}
