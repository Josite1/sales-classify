import { AllRecords, DateRecord, ProductData, WeekSummary, ProductTrendPoint, ProductAliases, RegionItem, RemarkValue, RemarkOtherValue, ShopItem, ShopFlagCategory } from './types';

const BASE_STORAGE_KEY = 'after-sales-records';
const BASE_ALIAS_KEY = 'after-sales-aliases';

/** 当前活跃的用户 ID（用于 localStorage 隔离） */
let activeUserId: string | null = null;

/** 设置当前活跃用户，切换用户时自动清理旧用户数据 */
export function setActiveUser(userId: string | null): void {
  if (activeUserId && activeUserId !== userId) {
    clearUserData(activeUserId);
  }
  activeUserId = userId;
}

/** 获取用户级别的 localStorage key */
function getStorageKey(): string {
  return activeUserId ? `${BASE_STORAGE_KEY}:${activeUserId}` : BASE_STORAGE_KEY;
}

function getAliasKey(): string {
  return activeUserId ? `${BASE_ALIAS_KEY}:${activeUserId}` : BASE_ALIAS_KEY;
}

/** 清理指定用户的 localStorage 数据 */
function clearUserData(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${BASE_STORAGE_KEY}:${userId}`);
    localStorage.removeItem(`${BASE_ALIAS_KEY}:${userId}`);
  } catch {
    // ignore
  }
}

/** 从 localStorage 读取所有记录 */
export function loadAllRecords(): AllRecords {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** 保存所有记录到 localStorage */
export function saveAllRecords(records: AllRecords): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getStorageKey(), JSON.stringify(records));
}

/** 从 localStorage 读取产品别名 */
export function loadProductAliases(): ProductAliases {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getAliasKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** 保存产品别名到 localStorage */
export function saveProductAliases(aliases: ProductAliases): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getAliasKey(), JSON.stringify(aliases));
}

/** 设置产品别名 */
export function setProductAlias(originalName: string, alias: string, note: string): ProductAliases {
  const aliases = loadProductAliases();
  aliases[originalName] = { alias, note };
  saveProductAliases(aliases);
  return aliases;
}

/** 获取产品显示名称（优先别名） */
export function getProductDisplayName(originalName: string, aliases: ProductAliases): string {
  return aliases[originalName]?.alias || originalName;
}

/** 更新某日期的 JSON 数据 */
export function updateDateRecord(date: string, data: Record<string, ProductData>): AllRecords {
  const records = loadAllRecords();
  records[date] = {
    date,
    data,
    importedAt: Date.now(),
  };
  saveAllRecords(records);
  return records;
}

/** 添加一条日期记录 */
export function addDateRecord(date: string, data: Record<string, ProductData>): AllRecords {
  const records = loadAllRecords();
  records[date] = {
    date,
    data,
    importedAt: Date.now(),
  };
  saveAllRecords(records);
  return records;
}

/** 删除一条日期记录 */
export function removeDateRecord(date: string): AllRecords {
  const records = loadAllRecords();
  delete records[date];
  saveAllRecords(records);
  return records;
}

/** 验证导入数据是否合法 */
export function validateImportData(parsed: unknown): parsed is Record<string, ProductData> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  let validCount = 0;
  for (const key in parsed as Record<string, unknown>) {
    const item = (parsed as Record<string, unknown>)[key];
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    if (obj.total !== undefined && !isNaN(Number(obj.total))) {
      validCount++;
    }
  }
  return validCount > 0;
}

/** 容错 JSON 解析 */
export function parseDirtyJson(rawStr: string): unknown {
  const str = rawStr.trim();
  try { return JSON.parse(str); } catch { /* continue */ }

  const objStart = str.indexOf('{');
  const objEnd = str.lastIndexOf('}');
  const arrStart = str.indexOf('[');
  const arrEnd = str.lastIndexOf(']');

  let start = -1, end = -1;
  if (objStart !== -1 && objEnd !== -1 && (arrStart === -1 || objStart < arrStart)) {
    start = objStart; end = objEnd;
  } else if (arrStart !== -1 && arrEnd !== -1) {
    start = arrStart; end = arrEnd;
  }

  if (start !== -1 && end !== -1 && end > start) {
    const cleanStr = str.substring(start, end + 1);
    try { return JSON.parse(cleanStr); } catch { /* continue */ }
    const noNewlineStr = cleanStr.replace(/[\r\n\t]+/g, ' ');
    try { return JSON.parse(noNewlineStr); } catch { /* continue */ }
  }

  throw new Error('格式严重损坏，无法解析');
}

/** 获取产品总数 */
export function getProductTotal(item: ProductData): number {
  return Number(item.total) || 0;
}

/** 获取产品的标旗分类 */
export function getFlags(item: ProductData): Record<string, number> {
  return item['标旗分类'] || {};
}

/** 获取产品数量分类（仅红色旗子） */
export function getProductQtyStats(item: ProductData): Record<string, number> {
  const qtyFlag = item['数量分类'];
  if (qtyFlag && typeof qtyFlag === 'object') {
    if (qtyFlag['红色旗子'] && typeof qtyFlag['红色旗子'] === 'object') {
      return qtyFlag['红色旗子'];
    }
    const firstVal = Object.values(qtyFlag)[0];
    if (firstVal !== undefined && typeof firstVal === 'number') {
      return qtyFlag as unknown as Record<string, number>;
    }
  }
  return {};
}

/** 获取产品的地域分布（仅红色旗子） */
export function getRegionDistribution(item: ProductData): Record<string, RegionItem> {
  if (item['省份分类']?.['红色旗子']) {
    return item['省份分类']['红色旗子'];
  }
  return item['地域分布'] || {};
}

/** 从店铺分类项中提取订单数（兼容旧数据 number 格式） */
export function getShopCount(shopValue: ShopItem | number | null | undefined): number {
  if (shopValue == null) return 0;
  if (typeof shopValue === 'number') return shopValue;
  if (typeof shopValue === 'object' && 'count' in shopValue) return shopValue.count;
  return 0;
}

/** 获取产品的店铺分布（仅红色旗子，返回 shop -> count） */
export function getShopDistribution(item: ProductData): Record<string, number> {
  if (item['店铺分类']?.['红色旗子']) {
    const flagData = item['店铺分类']['红色旗子'];
    const result: Record<string, number> = {};
    for (const [shop, val] of Object.entries(flagData)) {
      result[shop] = getShopCount(val as ShopItem | number);
    }
    return result;
  }
  return item['店铺分布'] || {};
}

/** 获取红色旗子的客服备注（将嵌套对象展平为 key: number） */
export function getRedFlagReasons(item: ProductData): Record<string, number> {
  if (item['客服备注分类'] && item['客服备注分类']['红色旗子']) {
    return flattenRemarkCounts(item['客服备注分类']['红色旗子']);
  }
  return {};
}

/**
 * 将客服备注分类展平为 key: number
 * 统计红色旗子下各个分类的订单数总和
 * 对于"其他"类型，只取订单数，不展开明细
 */
export function flattenRemarkCounts(raw: Record<string, RemarkValue>): Record<string, number> {
  const result: Record<string, number> = {};
  
  for (const [key, val] of Object.entries(raw)) {
    // 情况1：直接是数字
    if (typeof val === 'number') {
      result[key] = (result[key] || 0) + val;
      continue;
    }
    
    // 情况2：是对象，尝试提取订单数
    if (typeof val === 'object' && val !== null) {
      let count = 0;
      
      // 优先使用订单数
      if ('订单数' in val && typeof val['订单数'] === 'number') {
        count = val['订单数'];
      } 
      // 其次使用 total
      else if ('total' in val && typeof val.total === 'number') {
        count = val.total;
      }
      // 如果都没有，尝试从明细中统计数量
      else if ('明细' in val && Array.isArray(val['明细'])) {
        count = val['明细'].length;
      }
      
      if (count > 0) {
        result[key] = (result[key] || 0) + count;
      }
    }
  }
  
  return result;
}

/** 获取指定旗子颜色的客服备注分类 */
export function getRemarkByFlag(item: ProductData, flagType: string): Record<string, RemarkValue> {
  if (item['客服备注分类']?.[flagType]) {
    return item['客服备注分类'][flagType];
  }
  return {};
}

/** 获取"其他"明细数据 */
export function getRemarkOtherDetails(item: ProductData, flagType: string): RemarkOtherValue | null {
  const remarks = getRemarkByFlag(item, flagType);
  const otherVal = remarks['其他'];
  if (otherVal && typeof otherVal === 'object' && '明细' in otherVal) {
    return otherVal;
  }
  return null;
}

/** 获取指定旗子颜色的数量分类 */
export function getQtyStatsByFlag(item: ProductData, flagType: string): Record<string, number> {
  const qtyFlag = item['数量分类'];
  if (qtyFlag && typeof qtyFlag === 'object' && qtyFlag[flagType]) {
    return qtyFlag[flagType];
  }
  return {};
}

/** 获取 ISO 周标签 (YYYY-Www) */
function getISOWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** 获取某周的周一日期 */
function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

/** 获取某周的周日日期 */
function getWeekSunday(mondayStr: string): string {
  const d = new Date(mondayStr);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** 按周汇总所有记录数据 */
export function computeWeekSummaries(records: AllRecords): WeekSummary[] {
  const weekMap = new Map<string, { dates: string[]; products: Record<string, number>; redFlags: number; topReasons: Record<string, number> }>();

  const sortedDates = Object.keys(records).sort();
  for (const dateStr of sortedDates) {
    const record = records[dateStr];
    const weekLabel = getISOWeekLabel(dateStr);

    if (!weekMap.has(weekLabel)) {
      weekMap.set(weekLabel, { dates: [], products: {}, redFlags: 0, topReasons: {} });
    }
    const weekData = weekMap.get(weekLabel)!;
    weekData.dates.push(dateStr);

    for (const [productName, productData] of Object.entries(record.data)) {
      const total = getProductTotal(productData);
      weekData.products[productName] = (weekData.products[productName] || 0) + total;

      const flags = getFlags(productData);
      weekData.redFlags += flags['红色旗子'] || 0;

      const reasons = getRedFlagReasons(productData);
      for (const [reason, count] of Object.entries(reasons)) {
        weekData.topReasons[reason] = (weekData.topReasons[reason] || 0) + count;
      }
    }
  }

  const summaries: WeekSummary[] = [];
  for (const [weekLabel, data] of weekMap) {
    const monday = getWeekMonday(data.dates[0]);
    const sunday = getWeekSunday(monday);
    let totalOrders = 0;
    for (const count of Object.values(data.products)) {
      totalOrders += count;
    }

    summaries.push({
      weekLabel,
      weekStart: monday,
      weekEnd: sunday,
      totalOrders,
      productCount: Object.keys(data.products).length,
      products: data.products,
      redFlags: data.redFlags,
      topReasons: data.topReasons,
    });
  }

  return summaries.sort((a, b) => a.weekLabel.localeCompare(b.weekLabel));
}

/** 生成产品趋势数据（按周） */
export function computeProductTrends(records: AllRecords, topN = 8): ProductTrendPoint[] {
  const summaries = computeWeekSummaries(records);
  if (summaries.length === 0) return [];

  const productTotals = new Map<string, number>();
  for (const summary of summaries) {
    for (const [name, count] of Object.entries(summary.products)) {
      productTotals.set(name, (productTotals.get(name) || 0) + count);
    }
  }
  const topProducts = Array.from(productTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);

  return summaries.map(summary => {
    const point: ProductTrendPoint = { weekLabel: summary.weekLabel };
    for (const name of topProducts) {
      point[name] = summary.products[name] || 0;
    }
    return point;
  });
}

/** 计算某日记录的全局汇总 */
export function computeDaySummary(record: DateRecord) {
  let totalOrders = 0;
  let redFlags = 0;
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

  const topReasons = Object.entries(reasonAgg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return { totalOrders, redFlags, productBreakdown, topReasons };
}

/** 格式化日期显示 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${month}月${day}日 周${weekDays[d.getDay()]}`;
}

/** 按日期范围聚合多条记录为一个虚拟 DateRecord */
export function aggregateRecordsByRange(
  records: AllRecords,
  startDate: string,
  endDate: string,
): DateRecord {
  let totalOrders = 0;
  let redFlags = 0;
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
    date: `${startDate}~${endDate}`,
    data: Object.fromEntries(
      Object.entries(productMap).map(([name, data]) => [
        name,
        {
          total: data.total,
          标旗分类: { 红色旗子: data.redFlags, 绿色旗子: data.greenFlags, 灰色旗子: data.greyFlags },
          数量分类: {},
          客服备注分类: { 红色旗子: data.reasons },
          省份分类: {},
          店铺分类: {},
        } as ProductData,
      ])
    ),
    importedAt: Date.now(),
  };
}

/** 从聚合记录中获取汇总信息 */
export function computeAggregatedSummary(record: DateRecord) {
  let totalOrders = 0;
  let redFlags = 0;
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

  const topReasons = Object.entries(reasonAgg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return { totalOrders, redFlags, productBreakdown, topReasons };
}

/** 将本地数据同步到云端 */
export async function syncToCloud(records: AllRecords, token: string): Promise<{ synced: number }> {
  const res = await fetch('/api/user-records/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session': token },
    body: JSON.stringify({ records }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '同步失败');
  return { synced: data.synced };
}

/** 从云端拉取数据 */
export async function fetchFromCloud(token: string): Promise<AllRecords> {
  const res = await fetch('/api/user-records/sync', {
    method: 'GET',
    headers: { 'x-session': token },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '拉取失败');
  return data.records as AllRecords;
}

/** 合并本地与云端数据（以较新的 importedAt 为准） */
export function mergeRecords(local: AllRecords, cloud: AllRecords): AllRecords {
  const merged: AllRecords = { ...local };
  for (const [date, cloudRecord] of Object.entries(cloud)) {
    if (!merged[date]) {
      merged[date] = cloudRecord;
    } else if (cloudRecord.importedAt > merged[date].importedAt) {
      merged[date] = cloudRecord;
    }
  }
  return merged;
}