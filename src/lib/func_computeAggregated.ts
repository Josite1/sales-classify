export function computeAggregatedSummary(record: DateRecord) {
  let totalOrders = 0, redFlags = 0;
  const productBreakdown: { name: string; total: number; redFlags: number }[] = [];
  const reasonAgg: Record<string, number> = {};
  for (const [name, pd] of Object.entries(record.data)) {
    const total = getProductTotal(pd);
    totalOrders += total;
    const rf = getFlags(pd)['红色旗子'] || 0;
    redFlags += rf;
    for (const [r,c] of Object.entries(getRedFlagReasons(pd))) reasonAgg[r] = (reasonAgg[r]||0) + c;
    productBreakdown.push({name, total, redFlags: rf});
  }
  productBreakdown.sort((a,b) => b.total - a.total);
  return { totalOrders, redFlags, productBreakdown, topReasons: Object.entries(reasonAgg).sort((a,b)=>b[1]-a[1]).slice(0,10) };
}
