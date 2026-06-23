
/** 按日期范围聚合多条记录为一个虚拟 DateRecord */
export function aggregateRecordsByRange(
  records: AllRecords, startDate: string, endDate: string,
): DateRecord {
  let totalOrders = 0, redFlags = 0;
  const productMap: Record<string, { total: number; redFlags: number; greenFlags: number; greyFlags: number; reasons: Record<string, number> }> = {};
  const sortedDates = Object.keys(records).filter((d) => d >= startDate && d <= endDate).sort();
