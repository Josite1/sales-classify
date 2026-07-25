/**
 * 应用级常量
 * 全局配置项统一管理
 */

/** 最大保留的日期记录数（超出部分自动清除旧数据） */
export const MAX_RECORDS = 60;

/**
 * 裁剪记录，只保留最新 N 条（按日期倒序）。
 * 当记录数超出上限时，丢弃最早的记录。
 * 返回修剪后的新对象（不修改原对象）。
 */
export function trimRecords<T extends Record<string, unknown>>(
  records: T,
  maxCount: number = MAX_RECORDS
): T {
  const dates = Object.keys(records).sort().reverse();
  if (dates.length <= maxCount) return records;
  const trimmed: Record<string, unknown> = {};
  for (const d of dates.slice(0, maxCount)) {
    trimmed[d] = records[d];
  }
  return trimmed as T;
}
