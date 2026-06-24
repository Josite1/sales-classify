/**
 * LocalStorage persistence layer.
 * Responsible only for reading/writing data to localStorage.
 * No business logic, no computation, no API calls.
 */
import type { AllRecords, ProductAliases } from './types';

const BASE_STORAGE_KEY = 'after-sales-records';
const BASE_ALIAS_KEY = 'after-sales-aliases';

/** Current active user ID (for localStorage isolation) */
let activeUserId: string | null = null;

/** Set the active user; clears old user data on switch */
export function setActiveUser(userId: string | null): void {
  if (activeUserId && activeUserId !== userId) {
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
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Save all records to localStorage */
export function saveAllRecords(records: AllRecords): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getStorageKey(), JSON.stringify(records));
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
