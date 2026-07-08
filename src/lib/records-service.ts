/**
 * Records management service.
 * Handles CRUD operations on records, alias management, cloud sync.
 * All business logic (merge) is delegated to the backend API.
 * Depends on storage.ts for persistence and api.ts for cloud operations.
 */
import type { AllRecords, ProductData, ProductAliases } from './types';
import { loadAllRecords, saveAllRecords, loadProductAliases, saveProductAliases } from './storage';
import { apiMergeRecords } from './api';
import { safeFetch } from './fetch-utils';

// ==================== Record CRUD ====================

export function updateDateRecord(date: string, data: Record<string, ProductData>): AllRecords {
  const records = loadAllRecords();
  records[date] = { date, data, importedAt: Date.now() };
  saveAllRecords(records);
  return records;
}

export function addDateRecord(date: string, data: Record<string, ProductData>): AllRecords {
  const records = loadAllRecords();
  records[date] = { date, data, importedAt: Date.now() };
  saveAllRecords(records);
  return records;
}

export function removeDateRecord(date: string): AllRecords {
  const records = loadAllRecords();
  delete records[date];
  saveAllRecords(records);
  return records;
}

// ==================== Aliases ====================

export function setProductAlias(originalName: string, alias: string, note: string): ProductAliases {
  const aliases = loadProductAliases();
  aliases[originalName] = { alias, note };
  saveProductAliases(aliases);
  return aliases;
}

// ==================== Merge (delegated to backend) ====================

export async function mergeRecords(local: AllRecords, cloud: AllRecords): Promise<AllRecords> {
  const data = await apiMergeRecords(local, cloud);
  return data.records;
}

// ==================== Cloud Sync ====================

export async function syncToCloud(records: AllRecords, token: string, fullSync = false): Promise<{ synced: number }> {
  const res = await safeFetch('/api/user-records/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session': token },
    body: JSON.stringify({ records, fullSync }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Sync failed');
  return { synced: data.synced };
}

export async function fetchFromCloud(token: string): Promise<AllRecords> {
  const res = await safeFetch('/api/user-records/sync', {
    method: 'GET',
    headers: { 'x-session': token },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Fetch failed');
  return data.records as AllRecords;
}

/**
 * 轻量检查云端记录是否有变更。
 * 仅返回日期和更新时间戳，无需加载全部子表数据（~500ms vs ~10s）。
 */
export async function fetchFromCloudTimestamps(token: string): Promise<Record<string, number>> {
  const res = await safeFetch('/api/user-records/sync/timestamps', {
    method: 'GET',
    headers: { 'x-session': token },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Fetch timestamps failed');
  return data.timestamps as Record<string, number>;
}
