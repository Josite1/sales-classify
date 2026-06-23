'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { registerBrutalTheme, getBrutalTooltip, getBrutalGrid, getBrutalXAxis, getBrutalYAxis, BRUTAL_COLORS } from '@/lib/echarts-theme';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Package,
  Flag,
  AlertTriangle,
  Search,
  Pencil,
  X,
  Check,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Store,
  CornerDownLeft,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  AllRecords,
  ProductAliases,
  RemarkOtherDetail,
  ProductData,
  ShopItem,
  ShopFlagCategory,
  QtyFlagCategory,
  RemarkFlagCategory,
} from '@/lib/types';
import {

  getProductTotal,
  getFlags,
  getProductQtyStats,
  getRedFlagReasons,
  loadProductAliases,
  setProductAlias,
  getProductDisplayName,
  getRemarkByFlag,
  flattenRemarkCounts,
  getRemarkOtherDetails,
  getShopCount,
} from '@/lib/store';
// Register brutalist theme
if (typeof window !== 'undefined') {
  registerBrutalTheme(echarts);
}


/* ========== 工具函数 ========== */

/**
 * 根据过滤后的店铺分类（按旗子分组）重新构建完整的 ProductData。
 * 自动聚合：总数、各旗子数量、数量分布、客服备注分类。
 */
function buildProductDataFromShopStats(
  shopStats: Record<string, ShopFlagCategory>
): ProductData {
  const flags: Record<string, number> = {};
  const qtyFlagCategory: QtyFlagCategory = {};
  const remarkFlagCategory: RemarkFlagCategory = {};

  for (const [flagName, shops] of Object.entries(shopStats)) {
    if (!shops || typeof shops !== 'object') continue;

    flags[flagName] = 0;
    qtyFlagCategory[flagName] = {};
    remarkFlagCategory[flagName] = {};

    for (const [, shopVal] of Object.entries(shops)) {
      if (shopVal == null) continue;

      // 兼容旧数据：店铺值可能是纯数字
      if (typeof shopVal === 'number') {
        flags[flagName] += shopVal;
        continue;
      }

      const shop = shopVal as ShopItem;
      flags[flagName] += shop.count;

      // 聚合数量分布
      if (shop.数量分布) {
        for (const [qty, cnt] of Object.entries(shop.数量分布)) {
          qtyFlagCategory[flagName][qty] =
            (qtyFlagCategory[flagName][qty] || 0) + cnt;
        }
      }

      // 聚合客服备注分类
      if (shop.客服备注分类) {
        for (const [reason, val] of Object.entries(shop.客服备注分类)) {
          if (typeof val === 'number') {
            remarkFlagCategory[flagName][reason] =
              ((remarkFlagCategory[flagName][reason] as number) || 0) + val;
          } else if (val && typeof val === 'object' && '订单数' in val) {
            remarkFlagCategory[flagName][reason] =
              ((remarkFlagCategory[flagName][reason] as number) || 0) + val.订单数;
          }
        }
      }
    }
  }

  const total = Object.values(flags).reduce((a, b) => a + b, 0);

  return {
    total,
    标旗分类: flags,
    数量分类: qtyFlagCategory,
    客服备注分类: remarkFlagCategory,
    省份分类: {}, // 省份无法从店铺反推，置空
    店铺分类: shopStats,
  };
}

function getISOWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

function getMonthRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (dt: Date) => {
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return { start: fmt(start), end: fmt(end) };
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function mergeProductData(a: ProductData, b: ProductData): ProductData {
  const result = { ...a } as unknown as Record<string, unknown>;
  const bObj = b as unknown as Record<string, unknown>;
  for (const key of Object.keys(b)) {
    if (typeof bObj[key] === 'number') {
      result[key] = ((result[key] as number) || 0) + (bObj[key] as number);
    } else if (typeof bObj[key] === 'object' && bObj[key] !== null) {
      if (key in result && typeof result[key] === 'object' && result[key] !== null) {
        if (Array.isArray(bObj[key])) {
          result[key] = bObj[key];
        } else {
          result[key] = mergeProductData(
            result[key] as unknown as ProductData,
            bObj[key] as unknown as ProductData
          );
        }
      } else {
        result[key] = bObj[key];
      }
    } else {
      result[key] = bObj[key];
    }
  }
  return result as unknown as ProductData;
}

type TimeMode = 'day' | 'week' | 'month' | 'custom';

const FLAG_COLOR_MAP: Record<string, string> = {
  红色旗子: '#ef4444',
  绿色旗子: '#10b981',
  灰色旗子: '#94a3b8',
  黄色旗子: '#f59e0b',
  紫色旗子: '#8b5cf6',
  橙色旗子: '#f97316',
  蓝色旗子: '#3b82f6',
  粉色旗子: '#ec4899',
  青色旗子: '#06b6d4',
  玫红旗子: '#db2777',
  靛蓝旗子: '#4f46e5',
  翠绿旗子: '#059669',
  金色旗子: '#d97706',
  棕色旗子: '#92400e',
  深红旗子: '#b91c1c',
  深蓝旗子: '#1e40af',
};

const VIVID_COLORS = BRUTAL_COLORS;

const TOOLTIP_STYLE = getBrutalTooltip();

type QtyChartType = 'rose' | 'pie' | 'bar' | 'treemap';
type FlagChartType = 'pie' | 'bar';

const QTY_CHART_OPTIONS: { value: QtyChartType; label: string }[] = [
  { value: 'rose', label: '玫瑰图' },
  { value: 'bar', label: '柱状图' },
  { value: 'treemap', label: '矩形树图' },
];

const FLAG_CHART_OPTIONS: { value: FlagChartType; label: string }[] = [
  { value: 'pie', label: '饼图' },
  { value: 'bar', label: '柱状图' },
];

const REMARK_PAGE_SIZE = 10;
const MAX_DATE_RANGE_DAYS = 90;

interface ProductAnalysisProps {
  records: AllRecords;
  selectedDate?: string | null;
  initialAliases?: ProductAliases;
  readOnly?: boolean;
}

export function ProductAnalysis({
  records,
  selectedDate,
  initialAliases,
  readOnly,
}: ProductAnalysisProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qtyChartRef = useRef<HTMLDivElement>(null);
  const flagChartRef = useRef<HTMLDivElement>(null);
  const reasonBarRef = useRef<HTMLDivElement>(null);
  const qtyChartInstanceRef = useRef<echarts.ECharts | null>(null);
  const flagChartInstanceRef = useRef<echarts.ECharts | null>(null);
  const reasonBarChartRef = useRef<echarts.ECharts | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [aliases, setAliases] = useState<ProductAliases>({});

  const [timeMode, setTimeMode] = useState<TimeMode>('day');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedShops, setSelectedShops] = useState<string[]>([]);
  const [aggregateSearch, setAggregateSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [qtyChartType, setQtyChartType] = useState<QtyChartType>('rose');
  const [flagChartType, setFlagChartType] = useState<FlagChartType>('pie');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAlias, setEditAlias] = useState('');
  const [editNote, setEditNote] = useState('');
  const [remarkFlagType, setRemarkFlagType] = useState<string>('红色旗子');
  const [remarkPage, setRemarkPage] = useState(0);

  // 手动归类状态
  const [manualClassification, setManualClassification] = useState<Record<string, string>>({});
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');

  // 加载别名
  useEffect(() => {
    setAliases(initialAliases || loadProductAliases());
  }, [initialAliases]);

  // 日期跟随
  useEffect(() => {
    if (selectedDate) {
      if (timeMode === 'day') {
        setCustomStart(selectedDate);
        setCustomEnd(selectedDate);
      } else if (timeMode === 'week') {
        const { start, end } = getISOWeekRange(selectedDate);
        setCustomStart(start);
        setCustomEnd(end);
      } else if (timeMode === 'month') {
        const { start, end } = getMonthRange(selectedDate);
        setCustomStart(start);
        setCustomEnd(end);
      }
    }
  }, [selectedDate, timeMode]);

  const effectiveDate = useMemo(() => {
    if (selectedDate) return selectedDate;
    const dates = Object.keys(records).sort();
    return dates.length > 0 ? dates[dates.length - 1] : null;
  }, [selectedDate, records]);

  // 防抖搜索
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(aggregateSearch.trim());
    }, 280);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [aggregateSearch]);

  // IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsVisible(true);
          requestAnimationFrame(() => {
            [qtyChartInstanceRef, flagChartInstanceRef, reasonBarChartRef].forEach((ref) => {
              if (ref.current && !ref.current.isDisposed()) ref.current.resize();
            });
          });
        } else {
          setIsVisible(false);
        }
      },
      { threshold: 0.01 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 日期范围
  const dateRange = useMemo(() => {
    const baseDate = effectiveDate;
    if (!baseDate && timeMode !== 'custom') return null;
    switch (timeMode) {
      case 'day':
        return baseDate ? { start: baseDate, end: baseDate } : null;
      case 'week':
        return baseDate
          ? { start: getISOWeekRange(baseDate).start, end: getISOWeekRange(baseDate).end }
          : null;
      case 'month':
        return baseDate ? getMonthRange(baseDate) : null;
      case 'custom': {
        if (!customStart || !customEnd) return null;
        const start = new Date(customStart);
        const end = new Date(customEnd);
        const diffDays = Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays >= MAX_DATE_RANGE_DAYS) {
          const clampedEnd = new Date(start);
          clampedEnd.setDate(clampedEnd.getDate() + MAX_DATE_RANGE_DAYS - 1);
          const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
          return { start: customStart, end: fmt(clampedEnd) };
        }
        return { start: customStart, end: customEnd };
      }
      default:
        return null;
    }
  }, [effectiveDate, timeMode, customStart, customEnd]);

  const customRangeExceeded = useMemo(() => {
    if (timeMode !== 'custom' || !customStart || !customEnd) return false;
    const start = new Date(customStart);
    const end = new Date(customEnd);
    const diffDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays >= MAX_DATE_RANGE_DAYS;
  }, [timeMode, customStart, customEnd]);

  const { allProductNames, allStoreNames } = useMemo(() => {
    const nameSet = new Set<string>();
    const storeSet = new Set<string>();
    for (const record of Object.values(records)) {
      for (const [name, data] of Object.entries(record.data)) {
        nameSet.add(name);
        const shopStats = data['店铺分类'] || {};
        Object.values(shopStats).forEach((shopsInFlag) => {
          if (!shopsInFlag || typeof shopsInFlag !== 'object') return;
          Object.keys(shopsInFlag as Record<string, ShopItem | number>).forEach((s) =>
            storeSet.add(s)
          );
        });
      }
    }
    return {
      allProductNames: Array.from(nameSet).sort(),
      allStoreNames: Array.from(storeSet).sort(),
    };
  }, [records]);

  // 动态选项（产品/店铺列表）
  const { productOptions, shopOptions } = useMemo(() => {
    if (!dateRange) return { productOptions: [], shopOptions: [] };
    const productCount: Record<string, number> = {};
    const shopCount: Record<string, number> = {};
    allProductNames.forEach((p) => (productCount[p] = 0));
    allStoreNames.forEach((s) => (shopCount[s] = 0));

    const dates = Object.keys(records).filter(
      (d) => d >= dateRange.start && d <= dateRange.end
    );

    dates.forEach((d) => {
      const record = records[d];
      Object.entries(record.data).forEach(([pName, pData]) => {
        const shopStats = pData['店铺分类'] || {};
        if (selectedShops.length > 0) {
          let pTotal = 0;
          Object.entries(shopStats).forEach(([, shopsInFlag]) => {
            if (!shopsInFlag || typeof shopsInFlag !== 'object') return;
            Object.entries(
              shopsInFlag as Record<string, ShopItem | number>
            ).forEach(([sName, shopVal]) => {
              if (selectedShops.includes(sName)) pTotal += getShopCount(shopVal);
            });
          });
          if (pTotal > 0) productCount[pName] += pTotal;
        } else {
          productCount[pName] += getProductTotal(pData);
        }
        if (selectedProduct && pName !== selectedProduct) return;
        Object.entries(shopStats).forEach(([, shopsInFlag]) => {
          if (!shopsInFlag || typeof shopsInFlag !== 'object') return;
          Object.entries(
            shopsInFlag as Record<string, ShopItem | number>
          ).forEach(([sName, shopVal]) => {
            shopCount[sName] += getShopCount(shopVal);
          });
        });
      });
    });

    const productOptions = allProductNames
      .filter((p) => productCount[p] > 0)
      .map((p) => ({
        label: getProductDisplayName(p, aliases),
        value: p,
        count: productCount[p],
      }))
      .sort((a, b) => b.count - a.count);

    const shopOptions = allStoreNames
      .filter((s) => shopCount[s] > 0)
      .map((s) => ({ label: s, value: s, count: shopCount[s] || 0 }))
      .sort((a, b) => b.count - a.count);

    return { productOptions, shopOptions };
  }, [records, dateRange, selectedShops, selectedProduct, aliases, allProductNames, allStoreNames]);

  // 聚合搜索自动匹配
  useEffect(() => {
    const kw = debouncedSearch.toLowerCase();
    if (!kw) return;
    if (allStoreNames.length > 0) {
      const matchedShops = allStoreNames.filter((s) =>
        s.toLowerCase().includes(kw)
      );
      if (matchedShops.length > 0) {
        setSelectedShops((prev) => {
          const set = new Set([...prev, ...matchedShops]);
          return set.size === prev.length && prev.every((v) => set.has(v))
            ? prev
            : Array.from(set);
        });
      }
    }
    const matchedProducts = allProductNames.filter((p) => {
      const display = getProductDisplayName(p, aliases);
      return p.toLowerCase().includes(kw) || display.toLowerCase().includes(kw);
    });
    if (matchedProducts.length > 0 && !selectedProduct) {
      setSelectedProduct(matchedProducts[0]);
    }
  }, [debouncedSearch, allStoreNames, allProductNames, aliases, selectedProduct]);

  const aggregateMatchCount = useMemo(() => {
    const kw = aggregateSearch.trim().toLowerCase();
    if (!kw) return 0;
    let count = 0;
    count += allStoreNames.filter((s) => s.toLowerCase().includes(kw)).length;
    count += allProductNames.filter((p) => {
      const display = getProductDisplayName(p, aliases);
      return p.toLowerCase().includes(kw) || display.toLowerCase().includes(kw);
    }).length;
    return count;
  }, [aggregateSearch, allStoreNames, allProductNames, aliases]);

  const handleClearAll = useCallback(() => {
    if (qtyChartInstanceRef.current) {
      qtyChartInstanceRef.current.dispose();
      qtyChartInstanceRef.current = null;
    }
    if (flagChartInstanceRef.current) {
      flagChartInstanceRef.current.dispose();
      flagChartInstanceRef.current = null;
    }
    if (reasonBarChartRef.current) {
      reasonBarChartRef.current.dispose();
      reasonBarChartRef.current = null;
    }

    setSelectedProduct('');
    setSelectedShops([]);
    setAggregateSearch('');
    setDebouncedSearch('');
  }, []);

  const handleClearSearch = useCallback(() => {
    setAggregateSearch('');
    setDebouncedSearch('');
  }, []);

  // 自动选择第一个产品
  useEffect(() => {
    if (
      selectedProduct &&
      productOptions.length > 0 &&
      !productOptions.find((p) => p.value === selectedProduct)
    ) {
      setSelectedProduct(productOptions[0]?.value || '');
    } else if (!selectedProduct && productOptions.length > 0) {
      setSelectedProduct(productOptions[0].value);
    }
  }, [productOptions, selectedProduct]);

  // 清理无效店铺
  useEffect(() => {
    if (selectedShops.length === 0) return;
    const validValues = new Set(shopOptions.map((s) => s.value));
    const filtered = selectedShops.filter((s) => validValues.has(s));
    if (filtered.length !== selectedShops.length) {
      setSelectedShops(filtered);
    }
  }, [shopOptions, selectedShops]);

  // ===== 核心聚合 =====
  const aggregatedProductData = useMemo(() => {
    if (!dateRange || !selectedProduct) return null;
    const dates = getDatesInRange(dateRange.start, dateRange.end);
    let merged: ProductData | null = null;

    for (const date of dates) {
      const record = records[date];
      if (!record || !record.data[selectedProduct]) continue;
      const rawData = record.data[selectedProduct];

      let filtered: ProductData;

      if (selectedShops.length > 0) {
        const shopStats = rawData['店铺分类'] || {};
        const newShopStats: Record<string, ShopFlagCategory> = {};
        let hasData = false;

        for (const [flag, shops] of Object.entries(shopStats)) {
          if (!shops || typeof shops !== 'object') continue;
          const filteredShops: Record<string, ShopItem | number> = {};
          for (const [shop, shopVal] of Object.entries(
            shops as Record<string, ShopItem | number>
          )) {
            if (selectedShops.includes(shop)) {
              filteredShops[shop] = shopVal;
              hasData = true;
            }
          }
          if (Object.keys(filteredShops).length > 0) {
            newShopStats[flag] = filteredShops;
          }
        }

        if (!hasData) continue;
        filtered = buildProductDataFromShopStats(newShopStats);
      } else {
        filtered = rawData;
      }

      if (!merged) {
        merged = { ...filtered };
      } else {
        merged = mergeProductData(merged, filtered);
      }
    }

    return merged;
  }, [dateRange, selectedProduct, selectedShops, records]);

  const productData = aggregatedProductData;

  // 手抓饼单位判断
const isHandGraspCake = useMemo(() => {
  return ['手抓饼', '葱油饼'].some(keyword => selectedProduct?.includes(keyword)) ?? false;
}, [selectedProduct]);

  const unitLabel = isHandGraspCake ? '片' : '袋';

  const total = useMemo(
    () => (productData ? getProductTotal(productData) : 0),
    [productData]
  );
  const flags = useMemo(
    () => (productData ? getFlags(productData) : ({} as Record<string, number>)),
    [productData]
  );
  const qtyStats = useMemo(
    () =>
      productData ? getProductQtyStats(productData) : ({} as Record<string, number>),
    [productData]
  );

  const globalTotal = useMemo(() => {
    if (!dateRange) return 0;
    const dates = getDatesInRange(dateRange.start, dateRange.end);
    let sum = 0;
    for (const date of dates) {
      const record = records[date];
      if (!record) continue;
      for (const pd of Object.values(record.data)) {
        sum += getProductTotal(pd);
      }
    }
    return sum;
  }, [dateRange, records]);

  const ratio = globalTotal > 0 ? ((total / globalTotal) * 100).toFixed(1) : '0';
  const singleRatio =
    total > 0 ? (((qtyStats['1'] || 0) / total) * 100).toFixed(1) : '0';
  const { topQty, topQtyVal } = useMemo(() => {
    let topK = '-';
    let topV = 0;
    for (const [k, v] of Object.entries(qtyStats)) {
      if (v > topV) {
        topV = v;
        topK = k;
      }
    }
    return { topQty: topK, topQtyVal: topV };
  }, [qtyStats]);

  const flagData = useMemo(
    () =>
      Object.entries(flags).map(([name, value]) => ({
        name,
        value,
        itemStyle: { color: FLAG_COLOR_MAP[name] || VIVID_COLORS[0] },
      })),
    [flags]
  );

  const qtyData = useMemo(
    () =>
      Object.entries(qtyStats)
        .map(([k, v]) => ({ name: `${k}${unitLabel}`, value: v }))
        .sort((a, b) => b.value - a.value),
    [qtyStats, unitLabel]
  );

  const remarkDataByFlag = useMemo(() => {
    if (!productData) return {} as Record<string, number>;
    const raw = getRemarkByFlag(productData, remarkFlagType);
    return flattenRemarkCounts(raw);
  }, [productData, remarkFlagType]);

  const remarkFlagTypes = useMemo(() => {
    if (!productData?.['客服备注分类']) return [];
    return Object.keys(productData['客服备注分类']);
  }, [productData]);

  const otherDetails = useMemo((): RemarkOtherDetail[] => {
    if (!productData) return [];
    const otherData = getRemarkOtherDetails(productData, remarkFlagType);
    return otherData?.明细 || [];
  }, [productData, remarkFlagType]);

  // 手动归类合并
  const mergedRemarkData = useMemo(() => {
    const base = { ...remarkDataByFlag };
    if (!productData || otherDetails.length === 0) return base;

    const otherKeys = Object.keys(base).filter((k) => k.includes('其他'));
    const otherKey = otherKeys.length > 0 ? otherKeys[0] : null;

    otherDetails.forEach((detail) => {
      const orderId = detail.订单号;
      const manualCat = manualClassification[orderId];
      if (manualCat) {
        if (otherKey && base[otherKey] > 0) {
          base[otherKey] = Math.max(0, base[otherKey] - 1);
        }
        base[manualCat] = (base[manualCat] || 0) + 1;
      }
    });

    return base;
  }, [remarkDataByFlag, otherDetails, manualClassification, productData]);

  const remarkBarData = useMemo(
    () =>
      Object.entries(mergedRemarkData)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    [mergedRemarkData]
  );

  const totalRemarkPages = Math.max(1, Math.ceil(otherDetails.length / REMARK_PAGE_SIZE));
  const pagedOtherDetails = useMemo(() => {
    const start = remarkPage * REMARK_PAGE_SIZE;
    return otherDetails.slice(start, start + REMARK_PAGE_SIZE);
  }, [otherDetails, remarkPage]);

  useEffect(() => {
    setRemarkPage(0);
  }, [remarkFlagType, selectedProduct]);

  // 改名操作
  const handleOpenEdit = useCallback(() => {
    const current = aliases[selectedProduct];
    setEditAlias(current?.alias || '');
    setEditNote(current?.note || '');
    setEditDialogOpen(true);
  }, [selectedProduct, aliases]);

  const handleSaveAlias = useCallback(() => {
    const updated = setProductAlias(selectedProduct, editAlias, editNote);
    setAliases(updated);
    setEditDialogOpen(false);
  }, [selectedProduct, editAlias, editNote]);

  // 手动归类操作
  const handleStartEditCategory = useCallback(
    (orderId: string, currentCat: string) => {
      setEditingOrderId(orderId);
      setEditCategory(currentCat || '');
    },
    []
  );

  const handleSaveCategory = useCallback(
    (orderId: string) => {
      if (!editCategory.trim()) {
        setManualClassification((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
      } else {
        setManualClassification((prev) => ({
          ...prev,
          [orderId]: editCategory.trim(),
        }));
      }
      setEditingOrderId(null);
    },
    [editCategory]
  );

  const handleDeleteCategory = useCallback(
    (orderId: string) => {
      setManualClassification((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      if (editingOrderId === orderId) {
        setEditingOrderId(null);
      }
    },
    [editingOrderId]
  );

  const availableCategories = useMemo(() => {
    const cats = new Set(Object.keys(remarkDataByFlag));
    Object.values(manualClassification).forEach((c) => cats.add(c));
    return Array.from(cats).sort();
  }, [remarkDataByFlag, manualClassification]);

  // ========== 图表渲染函数 ==========
  const renderChart = useCallback(
    (
      ref: React.RefObject<HTMLDivElement | null>,
      instanceRef: React.MutableRefObject<echarts.ECharts | null>,
      data: {
        name: string;
        value: number;
        itemStyle?: { color: string };
        town_village?: number;
      }[],
      chartType: QtyChartType
    ) => {
      if (!ref.current || data.length === 0) return;
      if (!instanceRef.current || instanceRef.current.isDisposed()) {
        instanceRef.current = echarts.init(ref.current, 'brutal');
      }
      const chart = instanceRef.current;

      const dataWithColor = data.map((d, i) => ({
        ...d,
        itemStyle: d.itemStyle || { color: VIVID_COLORS[i % VIVID_COLORS.length] },
      }));

      let option: echarts.EChartsOption;

      if (chartType === 'rose') {
        option = {
          tooltip: {
            ...TOOLTIP_STYLE,
            trigger: 'item',
            formatter: (p: unknown) => {
              const params = p as {
                name: string;
                value: number;
                percent: number;
              };
              const tv = (
                data.find((d) => d.name === params.name) as
                  | { town_village?: number }
                  | undefined
              )?.town_village;
              const tvStr =
                tv !== undefined ? `<br/>乡镇/村: ${tv}单` : '';
              return `<b>${params.name}</b><br/>${params.value}单 (${params.percent}%)${tvStr}`;
            },
          },
          legend: {
            bottom: 0,
            type: 'scroll',
            textStyle: { fontSize: 11, color: '#64748b' },
            itemWidth: 10,
            itemHeight: 10,
            itemGap: 8,
          },
          series: [
            {
              type: 'pie',
              roseType: 'area',
              radius: ['20%', '70%'],
              center: ['50%', '45%'],
              avoidLabelOverlap: true,
              itemStyle: {
                borderColor: '#fff',
                borderWidth: 2,
              },
              label: {
                show: true,
                fontSize: 11,
                fontWeight: 'bold' as const,
                color: '#334155',
                formatter: '{b}\n{c}单 ({d}%)',
                lineHeight: 16,
              },
              labelLine: {
                length: 14,
                length2: 10,
                smooth: true,
              },
              emphasis: {
                label: {
                  show: true,
                  fontSize: 13,
                  fontWeight: 'bold' as const,
                },
                itemStyle: {
                  shadowBlur: 16,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(0,0,0,0.18)',
                },
              },
              data: dataWithColor,
            },
          ],
        };
      } else if (chartType === 'pie') {
        option = {
          tooltip: {
            ...TOOLTIP_STYLE,
            trigger: 'item',
            formatter: (p: unknown) => {
              const params = p as {
                name: string;
                value: number;
                percent: number;
              };
              const tv = (
                data.find((d) => d.name === params.name) as
                  | { town_village?: number }
                  | undefined
              )?.town_village;
              const tvStr =
                tv !== undefined ? `<br/>乡镇/村: ${tv}单` : '';
              return `<b>${params.name}</b><br/>${params.value}单 (${params.percent}%)${tvStr}`;
            },
          },
          legend: {
            bottom: 0,
            type: 'scroll',
            textStyle: { fontSize: 11, color: '#64748b' },
            itemWidth: 10,
            itemHeight: 10,
          },
          series: [
            {
              type: 'pie',
              radius: ['35%', '65%'],
              center: ['50%', '45%'],
              avoidLabelOverlap: true,
              itemStyle: {
                borderColor: '#fff',
                borderWidth: 2,
              },
              label: {
                show: true,
                fontSize: 11,
                fontWeight: 'bold' as const,
                color: '#334155',
                formatter: '{b}: {c}单 ({d}%)',
              },
              labelLine: {
                length: 14,
                length2: 10,
                smooth: true,
              },
              emphasis: {
                label: {
                  show: true,
                  fontSize: 13,
                  fontWeight: 'bold' as const,
                },
                itemStyle: {
                  shadowBlur: 16,
                  shadowColor: 'rgba(0,0,0,0.18)',
                },
              },
              data: dataWithColor,
            },
          ],
        };
      } else if (chartType === 'bar') {
        const sorted = [...dataWithColor].sort((a, b) => b.value - a.value);
        const isHorizontal = sorted.length > 6;
        if (isHorizontal) {
          const reversed = [...sorted].reverse();
          option = {
            tooltip: {
              ...TOOLTIP_STYLE,
              trigger: 'axis',
              axisPointer: { type: 'shadow' },
              formatter: (params: unknown) => {
                const ps = params as {
                  name: string;
                  value: number;
                  data: { town_village?: number };
                }[];
                if (!ps || ps.length === 0) return '';
                const p = ps[0];
                const tv = p.data?.town_village;
                const tvStr =
                  tv !== undefined ? `<br/>乡镇/村: ${tv}单` : '';
                return `<b>${p.name}</b><br/>${p.value}单${tvStr}`;
              },
            },
            grid: {
              left: '3%',
              right: '12%',
              bottom: '3%',
              top: '3%',
              containLabel: true,
            },
            dataZoom:
              sorted.length > 10
                ? [
                    {
                      type: 'slider',
                      yAxisIndex: 0,
                      right: 4,
                      width: 12,
                      startValue: 0,
                      endValue: 14,
                      borderColor: 'transparent',
                      backgroundColor: '#f1f5f9',
                      fillerColor: 'rgba(16,185,129,0.2)',
                      handleStyle: { color: '#14b8a6' },
                      textStyle: { fontSize: 10, color: '#94a3b8' },
                    },
                  ]
                : undefined,
            xAxis: {
              type: 'value',
              axisLabel: { color: '#94a3b8', fontSize: 11 },
              splitLine: {
                lineStyle: { color: '#f1f5f9', type: 'dashed' },
              },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            yAxis: {
              type: 'category',
              data: reversed.map((d) => d.name),
              axisLabel: {
                color: '#475569',
                fontSize: 11,
                width: 100,
                overflow: 'truncate',
              },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            series: [
              {
                type: 'bar',
                data: reversed.map((d, i) => ({
                  value: d.value,
                  town_village: (d as { town_village?: number }).town_village,
                  itemStyle: {
                    color:
                      VIVID_COLORS[(reversed.length - 1 - i) % VIVID_COLORS.length],
                                      },
                })),
                barWidth: '60%',
                label: {
                  show: true,
                  position: 'right' as const,
                  fontSize: 11,
                  fontWeight: 'bold' as const,
                  color: '#475569',
                  formatter: '{c}',
                },
              },
            ],
          };
        } else {
          option = {
            tooltip: {
              ...TOOLTIP_STYLE,
              trigger: 'axis',
              axisPointer: { type: 'shadow' },
            },
            grid: {
              left: '3%',
              right: '8%',
              bottom: '3%',
              top: '8%',
              containLabel: true,
            },
            xAxis: {
              type: 'category',
              data: sorted.map((d) => d.name),
              axisLabel: { color: '#64748b', fontSize: 11 },
              axisLine: { lineStyle: { color: '#e2e8f0' } },
              axisTick: { show: false },
            },
            yAxis: {
              type: 'value',
              axisLabel: { color: '#94a3b8', fontSize: 11 },
              splitLine: {
                lineStyle: { color: '#f1f5f9', type: 'dashed' },
              },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            series: [
              {
                type: 'bar',
                data: sorted.map((d, i) => ({
                  value: d.value,
                  itemStyle: {
                    color: VIVID_COLORS[i % VIVID_COLORS.length],
                                      },
                })),
                barWidth: '50%',
                label: {
                  show: true,
                  position: 'top' as const,
                  fontSize: 11,
                  fontWeight: 'bold' as const,
                  color: '#475569',
                  formatter: '{c}',
                },
              },
            ],
          };
        }
      } else {
        // treemap
        option = {
          tooltip: {
            ...TOOLTIP_STYLE,
            formatter: (p: unknown) => {
              const params = p as { name: string; value: number };
              return `<b>${params.name}</b><br/>${params.value}单`;
            },
          },
          series: [
            {
              type: 'treemap',
              width: '95%',
              height: '85%',
              top: 5,
              roam: false,
              nodeClick: false,
              breadcrumb: { show: false },
              label: {
                show: true,
                fontSize: 12,
                fontWeight: 'bold' as const,
                color: '#fff',
                formatter: (p: unknown) => {
                  const params = p as { name: string; value: number };
                  return `${params.name}\n${params.value}单`;
                },
              },
              itemStyle: {
                borderColor: '#fff',
                borderWidth: 3,
                gapWidth: 3,
              },
              emphasis: {
                label: { fontSize: 14 },
              },
              data: dataWithColor,
            },
          ],
        };
      }

      chart.setOption(option, true);

      const handleResize = () => chart.resize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    },
    []
  );

  // 图表 Effects
  useEffect(() => {
    if (!isVisible) return;
    return renderChart(qtyChartRef, qtyChartInstanceRef, qtyData, qtyChartType);
  }, [qtyData, qtyChartType, renderChart, isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    if (!flagChartRef.current || flagData.length === 0) return;
    if (
      !flagChartInstanceRef.current ||
      flagChartInstanceRef.current.isDisposed()
    ) {
      flagChartInstanceRef.current = echarts.init(flagChartRef.current, 'brutal');
    }
    const chart = flagChartInstanceRef.current;
    const sortedFlag = [...flagData].sort((a, b) => b.value - a.value);

    let option: echarts.EChartsOption;
    if (flagChartType === 'pie') {
      option = {
        tooltip: {
          ...TOOLTIP_STYLE,
          trigger: 'item',
          formatter: (p: unknown) => {
            const params = p as {
              name: string;
              value: number;
              percent: number;
            };
            return `<b>${params.name}</b><br/>${params.value}单 (${params.percent}%)`;
          },
        },
        legend: {
          bottom: 0,
          textStyle: { fontSize: 11, color: '#64748b' },
          itemWidth: 10,
          itemHeight: 10,
        },
        series: [
          {
            type: 'pie',
            radius: ['35%', '65%'],
            center: ['50%', '45%'],
            avoidLabelOverlap: true,
            itemStyle: {
              borderColor: '#fff',
              borderWidth: 2,
            },
            label: {
              show: true,
              fontSize: 11,
              fontWeight: 'bold' as const,
              color: '#334155',
              formatter: '{b}: {c}单 ({d}%)',
            },
            labelLine: {
              length: 14,
              length2: 10,
              smooth: true,
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 13,
                fontWeight: 'bold' as const,
              },
              itemStyle: {
                shadowBlur: 16,
                shadowColor: 'rgba(0,0,0,0.18)',
              },
            },
            data: sortedFlag.map((d) => ({
              name: d.name,
              value: d.value,
              itemStyle: {
                color: FLAG_COLOR_MAP[d.name] || VIVID_COLORS[0],
              },
            })),
          },
        ],
      };
    } else {
      const barSorted = [...sortedFlag].sort((a, b) => a.value - b.value);
      option = {
        tooltip: {
          ...TOOLTIP_STYLE,
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
        },
        grid: {
          left: '3%',
          right: '8%',
          bottom: '3%',
          top: '8%',
          containLabel: true,
        },
        xAxis: {
          type: 'value',
          axisLabel: { color: '#94a3b8', fontSize: 11 },
          splitLine: {
            lineStyle: { color: '#f1f5f9', type: 'dashed' },
          },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'category',
          data: barSorted.map((d) => d.name),
          axisLabel: { color: '#475569', fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [
          {
            type: 'bar',
            data: barSorted.map((d) => ({
              value: d.value,
              itemStyle: {
                color: FLAG_COLOR_MAP[d.name] || VIVID_COLORS[0],
                              },
            })),
            barWidth: '60%',
            label: {
              show: true,
              position: 'right' as const,
              fontSize: 11,
              fontWeight: 'bold' as const,
              color: '#475569',
              formatter: '{c}',
            },
          },
        ],
      };
    }

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [flagData, flagChartType, isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    if (!reasonBarRef.current || remarkBarData.length === 0) return;
    if (
      !reasonBarChartRef.current ||
      reasonBarChartRef.current.isDisposed()
    ) {
      reasonBarChartRef.current = echarts.init(reasonBarRef.current, 'brutal');
    }
    const chart = reasonBarChartRef.current;
    const sortedReasons = [...remarkBarData].sort((a, b) => a.value - b.value);

    chart.setOption(
      {
        tooltip: {
          ...TOOLTIP_STYLE,
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
        },
        grid: {
          left: '3%',
          right: '8%',
          bottom: '3%',
          top: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'value',
          axisLabel: { color: '#94a3b8', fontSize: 11 },
          splitLine: {
            lineStyle: { color: '#f1f5f9', type: 'dashed' },
          },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'category',
          data: sortedReasons.map((d) => d.name),
          axisLabel: {
            color: '#475569',
            fontSize: 11,
            width: 80,
            overflow: 'truncate',
          },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [
          {
            type: 'bar',
            data: sortedReasons.map((d, i) => ({
              value: d.value,
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: VIVID_COLORS[(i + 2) % VIVID_COLORS.length] },
                  { offset: 1, color: VIVID_COLORS[(i + 3) % VIVID_COLORS.length] },
                ]),
                              },
            })),
            barWidth: '60%',
            label: {
              show: true,
              position: 'right' as const,
              fontSize: 11,
              fontWeight: 'bold' as const,
              color: '#475569',
              formatter: '{c}',
            },
          },
        ],
      },
      true
    );

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [remarkBarData, isVisible]);

  // ========== 渲染 ==========
  if (allProductNames.length === 0) {
    return (
      <Card className="brutal-card-lift rounded-xl shadow-sm">
        <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">该日期记录中暂无产品数据</p>
        </CardContent>
      </Card>
    );
  }

  const displayName = selectedProduct
    ? getProductDisplayName(selectedProduct, aliases)
    : '';

  const metricCards = [
    { label: '产品名称', value: displayName, color: '#14b8a6', isText: true },
    { label: '售后总数', value: total, color: '#3b82f6' },
    { label: '全局占比', value: `${ratio}%`, color: '#8b5cf6' },
    {
      label: '峰值数量段',
      value: topQty !== '-' ? `${topQty}${unitLabel} (${topQtyVal}次)` : '-',
      color: '#f59e0b',
      isText: true,
    },
  ];

  const timeModeLabels: Record<TimeMode, string> = {
    day: '日',
    week: '周',
    month: '月',
    custom: '自定义',
  };

  return (
    <div ref={containerRef} className="space-y-6">
      {/* 筛选区 */}
      <div className="sticky top-0 z-30 pb-2 -mt-2 pt-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Card className="brutal-card-lift border-primary/20 shadow-sm rounded-xl overflow-hidden transition-all">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg">
                  {(['day', 'week', 'month', 'custom'] as TimeMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setTimeMode(mode)}
                      className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                        timeMode === mode
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                      }`}
                    >
                      {timeModeLabels[mode]}
                    </button>
                  ))}
                </div>

                {timeMode === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="h-7 text-xs w-[130px] font-mono transition-colors hover:border-primary/30 focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">~</span>
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="h-7 text-xs w-[130px] font-mono transition-colors hover:border-primary/30 focus:border-primary"
                    />
                    {customRangeExceeded && (
                      <Badge variant="destructive" className="text-[10px] px-1.5">
                        最多{MAX_DATE_RANGE_DAYS}天
                      </Badge>
                    )}
                  </div>
                )}

                {dateRange && (
                  <Badge
                    variant="outline"
                    className="text-xs tabular-nums font-mono ml-auto bg-background border-primary/15 text-primary/80"
                  >
                    {dateRange.start} ~ {dateRange.end}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap border-t pt-3.5">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
                  <Search className="h-3.5 w-3.5" /> 聚合搜索:
                </span>

                <div className="relative flex-1 min-w-[200px] max-w-[360px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    value={aggregateSearch}
                    onChange={(e) => setAggregateSearch(e.target.value)}
                    placeholder="搜索店铺/产品..."
                    className="h-8 !pl-9 pr-[72px] text-xs border-dashed border-primary/30 bg-primary/[0.02] focus:border-primary/60 focus:ring-1 focus:ring-primary/20 focus:bg-background hover:border-primary/40 transition-all duration-200 rounded-lg"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {aggregateSearch.trim() && (
                      <>
                        {aggregateMatchCount > 0 && (
                          <Badge
                            variant="secondary"
                            className="h-5 px-1.5 text-[10px] rounded-sm font-bold bg-primary/10 text-primary"
                          >
                            {aggregateMatchCount}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-muted/60 rounded-full"
                          onClick={handleClearSearch}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </>
                    )}
                    {!aggregateSearch.trim() && (
                      <span className="text-[10px] text-muted-foreground/50 px-1.5">
                        <CornerDownLeft className="h-2.5 w-2.5 inline mr-0.5" />
                        回车匹配
                      </span>
                    )}
                  </div>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`h-8 border-dashed flex gap-2 w-auto min-w-[130px] justify-between px-3 bg-background transition-all duration-200 rounded-lg hover:border-primary/40 ${
                        selectedShops.length > 0
                          ? 'border-primary/60 ring-1 ring-primary/25'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <Store className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-muted-foreground">店铺</span>
                        {selectedShops.length > 0 && (
                          <Badge
                            variant="secondary"
                            className="ml-1 px-1.5 py-0 h-4 text-[10px] rounded-sm font-bold bg-primary/10 text-primary"
                          >
                            {selectedShops.length}
                          </Badge>
                        )}
                      </div>
                      <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0 shadow-lg rounded-lg" align="start">
                    <Command>
                      <CommandInput placeholder="搜索店铺..." className="h-9 text-xs" />
                      <CommandList className="max-h-[220px]">
                        <CommandEmpty className="text-xs p-4 text-center">
                          未找到店铺
                        </CommandEmpty>
                        <CommandGroup>
                          {shopOptions.map((opt) => {
                            const isSelected = selectedShops.includes(opt.value);
                            return (
                              <CommandItem
                                key={opt.value}
                                value={opt.label}
                                onSelect={() => {
                                  setSelectedShops((prev) =>
                                    isSelected
                                      ? prev.filter((v) => v !== opt.value)
                                      : [...prev, opt.value]
                                  );
                                }}
                                className="text-xs flex items-center gap-2.5 cursor-pointer transition-colors hover:bg-muted/50"
                              >
                                <div
                                  className={`flex h-4 w-4 items-center justify-center rounded-sm border shrink-0 ${
                                    isSelected
                                      ? 'bg-primary border-primary text-primary-foreground'
                                      : 'border-input opacity-50'
                                  }`}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                </div>
                                <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="flex-1 truncate">{opt.label}</span>
                                <Badge
                                  variant="secondary"
                                  className="px-1.5 py-0 h-4 text-[10px] font-mono shrink-0"
                                >
                                  {opt.count}
                                </Badge>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 border-dashed flex gap-2 w-auto min-w-[160px] justify-between px-3 bg-background transition-all duration-200 rounded-lg hover:border-primary/40"
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-muted-foreground">产品</span>
                        {selectedProduct && (
                          <Badge
                            variant="secondary"
                            className="ml-1 px-1.5 py-0 h-4 text-[10px] rounded-sm font-bold bg-primary/10 text-primary"
                          >
                            1
                          </Badge>
                        )}
                      </div>
                      <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0 shadow-lg rounded-lg" align="start">
                    <Command>
                      <CommandInput placeholder="搜索产品..." className="h-9 text-xs" />
                      <CommandList className="max-h-[220px]">
                        <CommandEmpty className="text-xs p-4 text-center">
                          未找到产品
                        </CommandEmpty>
                        <CommandGroup>
                          {productOptions.map((opt) => {
                            const isSelected = selectedProduct === opt.value;
                            return (
                              <CommandItem
                                key={opt.value}
                                value={opt.label}
                                onSelect={() => setSelectedProduct(opt.value)}
                                className="text-xs flex items-center gap-2.5 cursor-pointer transition-colors hover:bg-muted/50"
                              >
                                <div
                                  className={`flex h-4 w-4 items-center justify-center rounded-sm border shrink-0 ${
                                    isSelected
                                      ? 'bg-primary border-primary text-primary-foreground'
                                      : 'border-input opacity-50'
                                  }`}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                </div>
                                <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="flex-1 truncate">{opt.label}</span>
                                <Badge
                                  variant="secondary"
                                  className="px-1.5 py-0 h-4 text-[10px] font-mono shrink-0"
                                >
                                  {opt.count}
                                </Badge>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {(selectedProduct ||
                  selectedShops.length > 0 ||
                  aggregateSearch.trim()) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 ml-1 shrink-0 active:scale-95 transition-transform rounded-lg"
                    onClick={handleClearAll}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />清空筛选
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 内容区 */}
      {!productData ? (
        <Card className="brutal-card-lift rounded-xl shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
            <Search className="h-10 w-10 animate-pulse opacity-30" />
            <p className="text-sm">
              {selectedShops.length > 0
                ? '所选店铺下暂无该产品的数据'
                : '当前筛选条袋下暂无数据'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="brutal-card-lift rounded-xl shadow-sm overflow-hidden border-l-4 border-l-primary/30 transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    产品分析
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    基于 {dateRange?.start} ~ {dateRange?.end} 的聚合数据
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {!readOnly && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 rounded-lg transition-colors hover:bg-primary/5"
                      onClick={handleOpenEdit}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {metricCards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl p-4 relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02]"
                    style={{
                      background: `linear-gradient(135deg, ${card.color}10 0%, ${card.color}05 100%)`,
                      borderLeft: `4px solid ${card.color}`,
                      boxShadow: `0 2px 8px ${card.color}15`,
                    }}
                  >
                    <p className="text-xs text-muted-foreground font-medium">
                      {card.label}
                    </p>
                    <p
                      className={`mt-1 font-black tabular-nums ${
                        card.isText ? 'text-sm line-clamp-2' : 'text-2xl'
                      }`}
                      style={{ color: card.color }}
                    >
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card className="brutal-card-lift rounded-xl shadow-sm border-t-4 border-t-emerald-400/60 transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    数量分布
                    <Badge variant="destructive" className="ml-1 text-[10px] px-1.5">
                      红色旗子
                    </Badge>
                    <Badge variant="outline" className="ml-1 text-xs tabular-nums">
                      单{unitLabel}占比 {singleRatio}%
                    </Badge>
                  </CardTitle>
                  <div className="flex gap-1">
                    {QTY_CHART_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        variant={qtyChartType === opt.value ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 px-2 text-[10px] rounded-lg transition-all"
                        onClick={() => setQtyChartType(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {qtyData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground space-y-2">
                    <Package className="h-10 w-10 animate-bounce opacity-30" />
                    <p className="text-xs">无红色旗子数量数据</p>
                  </div>
                ) : (
                  <div ref={qtyChartRef} className="w-full h-[340px]" />
                )}
              </CardContent>
            </Card>

            <Card className="brutal-card-lift rounded-xl shadow-sm border-t-4 border-t-amber-400/60 transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Flag className="h-4 w-4 text-primary" />
                    标旗分类
                  </CardTitle>
                  <div className="flex gap-1">
                    {FLAG_CHART_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        variant={flagChartType === opt.value ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 px-2 text-[10px] rounded-lg transition-all"
                        onClick={() => setFlagChartType(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {flagData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground space-y-2">
                    <Flag className="h-10 w-10 animate-bounce opacity-30" />
                    <p className="text-xs">无标旗数据</p>
                  </div>
                ) : (
                  <div ref={flagChartRef} className="w-full h-[340px]" />
                )}
              </CardContent>
            </Card>
          </div>

          {remarkBarData.length > 0 && (
            <Card className="brutal-card-lift mt-6 rounded-xl shadow-sm border-t-4 border-t-red-400/60 transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    客服备注分类
                  </CardTitle>
                  <Select value={remarkFlagType} onValueChange={setRemarkFlagType}>
                    <SelectTrigger className="w-[130px] h-7 text-xs rounded-lg transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {remarkFlagTypes.map((ft) => (
                        <SelectItem key={ft} value={ft}>
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: FLAG_COLOR_MAP[ft] || '#94a3b8',
                              }}
                            />
                            {ft}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CardDescription className="text-xs">
                  {remarkFlagType}客服备注原因排名（含手动归类）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={reasonBarRef} className="w-full" style={{ height: Math.max(480, remarkBarData.length * 36 + 24) }} />
              </CardContent>
            </Card>
          )}
          {otherDetails.length > 0 && (
  <Card className="brutal-card-lift mt-6 rounded-xl shadow-sm border-t-4 border-t-orange-400/60 transition-shadow hover:shadow-md">
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          &quot;其他&quot;备注明细
          <Badge variant="outline" className="text-[10px]">
            {remarkFlagType}
          </Badge>
          <Badge variant="secondary" className="text-[10px] tabular-nums">
            共 {otherDetails.length} 条
          </Badge>
        </CardTitle>
      </div>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px] text-xs">订单号</TableHead>
            <TableHead className="w-[140px] text-xs">品类</TableHead>
            <TableHead className="text-xs">客服备注</TableHead>
            <TableHead className="w-[200px] text-xs">手动归类</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedOtherDetails.map((detail, idx) => {
            const orderId = detail.订单号;
            const currentCat = manualClassification[orderId] || '';
            const isEditing = editingOrderId === orderId;

            return (
              <TableRow key={`${orderId}-${idx}`} className="transition-colors hover:bg-muted/30">
                <TableCell className="text-xs font-mono tabular-nums">
                  {orderId}
                </TableCell>
                <TableCell className="text-xs">{detail.品类}</TableCell>
                <TableCell
                  className="text-xs text-muted-foreground max-w-[200px] truncate"
                  title={detail.客服备注}
                >
                  {detail.客服备注}
                </TableCell>
                <TableCell className="text-xs py-1.5">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-[150px]">
                        <Input
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          placeholder="输入或选择类别"
                          className="h-8 text-xs pr-8 rounded-lg border-muted-foreground/20 focus:border-primary/60"
                          onKeyDown={(e) =>
                            e.key === 'Enter' && handleSaveCategory(orderId)
                          }
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-8 w-8 p-0 rounded-r-lg hover:bg-muted/50"
                            >
                              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[180px] p-0 rounded-lg shadow-lg" align="end">
                            <Command>
                              <CommandInput
                                placeholder="搜索已有类别..."
                                className="h-8 text-xs"
                              />
                              <CommandList>
                                <CommandEmpty className="text-xs p-2 text-center">
                                  无匹配类别
                                </CommandEmpty>
                                <CommandGroup>
                                  {availableCategories.map((cat) => (
                                    <CommandItem
                                      key={cat}
                                      value={cat}
                                      onSelect={() => setEditCategory(cat)}
                                      className="text-xs py-2 px-3 cursor-pointer hover:bg-muted/40"
                                    >
                                      {cat}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 rounded-full"
                        onClick={() => handleSaveCategory(orderId)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted/50 rounded-full"
                        onClick={() => setEditingOrderId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-h-[32px]">
                      {currentCat ? (
                        <>
                          <Badge
                            variant="secondary"
                            className="text-xs px-3 py-1 h-7 font-medium border border-border/50"
                          >
                            {currentCat}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-full hover:bg-muted/60"
                            onClick={() =>
                              handleStartEditCategory(orderId, currentCat)
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:bg-red-50 rounded-full"
                            onClick={() => handleDeleteCategory(orderId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-3 rounded-lg border-dashed hover:border-primary/50 hover:text-primary transition-colors"
                          onClick={() =>
                            handleStartEditCategory(orderId, '')
                          }
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> 归类
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {totalRemarkPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground tabular-nums">
            第 {remarkPage + 1} / {totalRemarkPages} 页
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 rounded-lg"
              disabled={remarkPage === 0}
              onClick={() => setRemarkPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 rounded-lg"
              disabled={remarkPage >= totalRemarkPages - 1}
              onClick={() =>
                setRemarkPage((p) => Math.min(totalRemarkPages - 1, p + 1))
              }
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
)}
        </>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              修改产品名称/备注
            </DialogTitle>
            <DialogDescription>原名: {selectedProduct}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-sm font-semibold">显示别名</Label>
              <Input
                placeholder="输入自定义名称（留空则使用原名）"
                value={editAlias}
                onChange={(e) => setEditAlias(e.target.value)}
                className="rounded-lg transition-colors"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-semibold">备注</Label>
              <Textarea
                placeholder="添加备注信息..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="min-h-[80px] text-sm rounded-lg transition-colors"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-lg">
              取消
            </Button>
            <Button onClick={handleSaveAlias} className="rounded-lg">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}