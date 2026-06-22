/**
 * API client for the FastAPI backend.
 * Replaces localStorage-based store.ts for data persistence.
 */
import type { AllRecords, DateRecord, ProductData, ProductAliases, WeekSummary } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'API error: ' + res.status);
  }
  return res.json();
}

// ---- Records ----

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
  data: Record<string, ProductData>,
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

export async function updateDateRecord(
  date: string,
  data: Record<string, ProductData>,
): Promise<AllRecords> {
  return addDateRecord(date, data);
}

// ---- Aliases ----

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

// ---- Summary (can be computed locally or via API) ----

export async function fetchDaySummary(date: string) {
  return request<{ summary: unknown }>(`/api/records/summary/day/${date}`);
}

export async function fetchWeekSummaries(): Promise<WeekSummary[]> {
  const data = await request<{ summaries: WeekSummary[] }>('/api/records/summary/weeks');
  return data.summaries;
}

export async function fetchRangeSummary(start: string, end: string) {
  return request<{ summary: unknown }>(`/api/records/summary/range?start=${start}&end=${end}`);
}

// ---- Merge ----

export async function mergeRecords(
  local: AllRecords,
  cloud: AllRecords,
): Promise<AllRecords> {
  const data = await request<{ records: AllRecords }>('/api/records/sync/merge', {
    method: 'POST',
    body: JSON.stringify({ local, cloud }),
  });
  return data.records;
}

// ---- Health ----

export async function checkHealth(): Promise<boolean> {
  try {
    const data = await request<{ status: string }>('/api/health');
    return data.status === 'ok';
  } catch {
    return false;
  }
}
