# Python script to append remaining functions to store.ts
import os

code = '''

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
'''

path = 'D:/workplace/python/classify_sales/src/lib/store.ts'
with open(path, 'a', encoding='utf-8') as f:
    f.write(code)
print('part 1 done')
