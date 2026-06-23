import textwrap, os

code = textwrap.dedent('''

/** 按日期范围聚合多条记录为一个虚拟 DateRecord */
export function aggregateRecordsByRange(
  records: AllRecords, startDate: string, endDate: string,
): DateRecord {
  let totalOrders = 0, redFlags = 0;
  const productMap: Record<string, { total: number; redFlags: number; greenFlags: number; greyFlags: number; reasons: Record<string, number> }> = {};
  const sortedDates = Object.keys(records).filter((d) => d >= startDate && d <= endDate).sort();
  for (const dateStr of sortedDates) {
    const record = records[dateStr];
    for (const [name, productData] of Object.entries(record.data)) {
      const total = getProductTotal(productData);
      totalOrders += total;
      const flags = getFlags(productData);
      const rf = flags['红色旗子'] || 0;
      const gf = flags['绿色旗子'] || 0;
      const greyf = flags['灰色旗子'] || 0;
      redFlags += rf;
      if (!productMap[name]) {
        productMap[name] = { total: 0, redFlags: 0, greenFlags: 0, greyFlags: 0, reasons: {} };
      }
      productMap[name].total += total;
      productMap[name].redFlags += rf;
      productMap[name].greenFlags += gf;
      productMap[name].greyFlags += greyf;
      const reasons = getRedFlagReasons(productData);
      for (const [reason, count] of Object.entries(reasons)) {
        productMap[name].reasons[reason] = (productMap[name].reasons[reason] || 0) + count;
      }
    }
  }
  const productBreakdown = Object.entries(productMap)
    .map(([name, data]) => ({ name, total: data.total, redFlags: data.redFlags }))
    .sort((a, b) => b.total - a.total);
  const reasonAgg: Record<string, number> = {};
  for (const data of Object.values(productMap)) {
    for (const [reason, count] of Object.entries(data.reasons)) {
      reasonAgg[reason] = (reasonAgg[reason] || 0) + count;
    }
  }
  const topReasons = Object.entries(reasonAgg).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return {
    date: startDate + '~' + endDate,
    data: Object.fromEntries(
      Object.entries(productMap).map(([name, data]) => [
        name, {
          total: data.total,
          标旗分类: { 红色旗子: data.redFlags, 绿色旗子: data.greenFlags, 灰色旗子: data.greyFlags },
          数量分类: {}, 客服备注分类: { 红色旗子: data.reasons }, 省份分类: {}, 店铺分类: {},
        } as ProductData,
      ])
    ),
    importedAt: Date.now(),
  };
}

/** 从聚合记录中获取汇总信息 */
export function computeAggregatedSummary(record: DateRecord) {
  let totalOrders = 0, redFlags = 0;
  const productBreakdown: { name: string; total: number; redFlags: number }[] = [];
  const reasonAgg: Record<string, number> = {};
  for (const [name, productData] of Object.entries(record.data)) {
    const total = getProductTotal(productData);
    totalOrders += total;
    const flags = getFlags(productData);
    const rf = flags['红色旗子'] || 0;
    redFlags += rf;
    const reasons = getRedFlagReasons(productData);
    for (const [reason, count] of Object.entries(reasons)) {
      reasonAgg[reason] = (reasonAgg[reason] || 0) + count;
    }
    productBreakdown.push({ name, total, redFlags: rf });
  }
  productBreakdown.sort((a, b) => b.total - a.total);
  const topReasons = Object.entries(reasonAgg).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return { totalOrders, redFlags, productBreakdown, topReasons };
}

/**
 * 从云端加载所有记录（登录用户）
 * 直接从数据库读取，绕过 localStorage
 */
export async function cloudLoadAllRecords(token: string): Promise<AllRecords> {
  const res = await fetch('/api/user-records/sync', {
    method: 'GET',
    headers: { 'x-session': token },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '拉取失败');
  return data.records as AllRecords;
}

/**
 * 保存所有记录到云端（登录用户）
 * 直接写入数据库，绕过 localStorage
 */
export async function cloudSaveAllRecords(records: AllRecords, token: string): Promise<{ synced: number }> {
  const res = await fetch('/api/user-records/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session': token },
    body: JSON.stringify({ records }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '同步失败');
  return { synced: data.synced };
}

/**
 * 合并两组记录（以较新的 importedAt 为准）
 * 仅用于匿名数据迁移到云端的场景
 */
export function mergeRecords(a: AllRecords, b: AllRecords): AllRecords {
  const merged: AllRecords = { ...a };
  for (const [date, record] of Object.entries(b)) {
    if (!merged[date] || record.importedAt > merged[date].importedAt) {
      merged[date] = record;
    }
  }
  return merged;
}
''')

with open('D:/workplace/python/classify_sales/src/lib/store.ts', 'a', encoding='utf-8') as f:
    f.write(code)

print('Done')

