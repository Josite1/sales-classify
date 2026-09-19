/**
 * 应用级常量
 * 全局配置项统一管理
 */

/**
 * 数据保留窗口天数（按日历天，含首尾）。
 *
 * 窗口定义：`[今天 - (N-1) 天, ∞)`，即"今天"与"往前推 N-1 天"这一天共同构成 N 天。
 * N = 60 时，窗口起点 = 今天往前 59 天；**恰好落在起点这一天的数据保留**（边界包含）。
 */
export const RETENTION_DAYS = 60;

/** 日期字符串格式（YYYY-MM-DD） */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 按**本地时区**把 Date 格式化为 YYYY-MM-DD。
 *
 * 不要用 `toISOString()`：它按 UTC 输出，在东八区的 00:00–08:00 之间会比本地日期少一天，
 * 直接导致窗口边界错位（多删或少删一整天）。
 */
export function formatLocalDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 计算保留窗口的**起始日期（含边界）**。
 *
 * `days = 60` → 起点 = 今天往前 59 天，与今天一起恰好 60 天。
 * 例：今天 2026-09-19 → 起点 2026-07-22，7/22 这天的数据保留。
 */
export function windowStart(days: number = RETENTION_DAYS, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - (days - 1));
  return formatLocalDate(d);
}

/**
 * 判断某个 YYYY-MM-DD 日期是否落在保留窗口内（边界包含）。
 * 未来日期视为窗口内（不会因为时钟偏差被误删）。
 */
export function isWithinWindow(
  date: string,
  days: number = RETENTION_DAYS,
  now: Date = new Date()
): boolean {
  if (!DATE_PATTERN.test(date)) return true; // 非法键不参与裁剪，避免误删
  return date >= windowStart(days, now);
}

/**
 * 裁剪记录，只保留窗口内的日期。
 *
 * 与旧实现的区别：旧版按"条数"保留最新 N 条（`sort().reverse().slice(0, N)`），
 * 一旦数据存在缺口，实际窗口会被拉长到超过 N 个日历天；新版按**日历天**判定，
 * 严格对齐 N 天窗口，且边界日（恰好第 N 天）保留。
 *
 * 返回修剪后的新对象（不修改原对象）。
 */
export function trimRecords<T extends Record<string, unknown>>(
  records: T,
  days: number = RETENTION_DAYS,
  now: Date = new Date()
): T {
  const start = windowStart(days, now);
  const trimmed: Record<string, unknown> = {};
  for (const [date, value] of Object.entries(records)) {
    // 非法日期键一律保留，避免因格式异常静默丢数据
    if (!DATE_PATTERN.test(date) || date >= start) {
      trimmed[date] = value;
    }
  }
  return trimmed as T;
}
