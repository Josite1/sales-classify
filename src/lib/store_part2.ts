export function aggregateRecordsByRange(records: AllRecords, startDate: string, endDate: string): DateRecord {
  let totalOrders = 0, redFlags = 0;
  const productMap: Record<string, any> = {};
  for (const dateStr of Object.keys(records).filter(d => d >= startDate && d <= endDate).sort()) {
    for (const [name, pd] of Object.entries(records[dateStr].data)) {
      const total = getProductTotal(pd);
      totalOrders += total;
      const rf = getFlags(pd)['红色旗子'] || 0;
      redFlags += rf;
      if (!productMap[name]) productMap[name] = { total:0, redFlags:0, reasons:{} };
      productMap[name].total += total;
      productMap[name].redFlags += rf;
      for (const [r,c] of Object.entries(getRedFlagReasons(pd))) productMap[name].reasons[r] = (productMap[name].reasons[r]||0) + c;
    }
  }
  return {
    date: startDate + '~' + endDate,
    data: Object.fromEntries(Object.entries(productMap).map(([n,d]) => [n, {total:d.total, 标旗分类:{红色旗子:d.redFlags}, 数量分类:{}, 客服备注分类:{红色旗子:d.reasons}, 省份分类:{}, 店铺分类:{}} as ProductData])),
    importedAt: Date.now(),
  };
}
