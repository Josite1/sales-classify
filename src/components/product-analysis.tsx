'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { registerBrutalTheme, getBrutalTooltip, getBrutalGrid, getBrutalXAxis, getBrutalYAxis, BRUTAL_COLORS } from '@/lib/echarts-theme';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Package, Flag, AlertTriangle, Search, Pencil, X, Check, ChevronsUpDown,
  ChevronLeft, ChevronRight, Store, CornerDownLeft, Plus, Trash2, Loader2,
} from 'lucide-react';
import type { AllRecords, ProductAliases, RemarkOtherDetail } from '@/lib/types';
import { loadProductAliases } from '@/lib/storage';
import { setProductAlias } from '@/lib/records-service';
import { apiComputeProductAnalysis, apiComputeOptions, appendReasonRule } from '@/lib/api';

// Register brutalist theme
if (typeof window !== 'undefined') { registerBrutalTheme(echarts); }

/* ========== 日期范围工具函数（纯 UI 展示） ========== */
function getISOWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr);
  const monday = d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1);
  const mon = new Date(d);
  mon.setDate(monday);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { start: fmt(mon), end: fmt(sun) };
}

function getMonthRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
}

type TimeMode = 'day' | 'week' | 'month' | 'custom';

const FLAG_COLOR_MAP: Record<string, string> = {
  红色旗子: '#ef4444', 绿色旗子: '#10b981', 灰色旗子: '#94a3b8', 黄色旗子: '#f59e0b',
  紫色旗子: '#8b5cf6', 橙色旗子: '#f97316', 蓝色旗子: '#3b82f6', 粉色旗子: '#ec4899',
  青色旗子: '#06b6d4', 玫红旗子: '#db2777', 靛蓝旗子: '#4f46e5', 翠绿旗子: '#059669',
  金色旗子: '#d97706', 棕色旗子: '#92400e', 深红旗子: '#b91c1c', 深蓝旗子: '#1e40af',
};

const VIVID_COLORS = BRUTAL_COLORS;
const TOOLTIP_STYLE = getBrutalTooltip();
type QtyChartType = 'rose' | 'pie' | 'bar' | 'treemap';
type FlagChartType = 'pie' | 'bar';
const QTY_CHART_OPTIONS: { value: QtyChartType; label: string }[] = [
  { value: 'rose', label: '玫瑰图' }, { value: 'bar', label: '柱状图' }, { value: 'treemap', label: '矩形树图' },
];
const FLAG_CHART_OPTIONS: { value: FlagChartType; label: string }[] = [
  { value: 'pie', label: '饼图' }, { value: 'bar', label: '柱状图' },
];
const QTY_FLAG_OPTIONS: { value: string; label: string }[] = [
  { value: '红色旗子', label: '红旗' },
  { value: '黄色旗子', label: '黄旗' },
  { value: '蓝色旗子', label: '蓝旗' },
  { value: '绿色旗子', label: '绿旗' },
  { value: '灰色旗子', label: '灰旗' },
  { value: '紫色旗子', label: '紫旗' },
  { value: '黑色旗子', label: '黑旗' },
];
const REMARK_PAGE_SIZE = 10;
const MAX_DATE_RANGE_DAYS = 90;

interface ProductAnalysisProps {
  records: AllRecords; selectedDate?: string | null; initialAliases?: ProductAliases; readOnly?: boolean;
}

export function ProductAnalysis({ records, selectedDate, initialAliases, readOnly }: ProductAnalysisProps) {
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
  const [qtyFlagType, setQtyFlagType] = useState<string>('红色旗子');
  const [flagChartType, setFlagChartType] = useState<FlagChartType>('pie');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAlias, setEditAlias] = useState('');
  const [editNote, setEditNote] = useState('');
  const [remarkFlagType, setRemarkFlagType] = useState<string>('红色旗子');
  const [remarkPage, setRemarkPage] = useState(0);
  const [manualClassification, setManualClassification] = useState<Record<string, string>>({});
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [savingRule, setSavingRule] = useState(false);

  // API-computed states
  const [productData, setProductData] = useState<Record<string, unknown> | null>(null);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [stats, setStats] = useState<{ total: number; qtyStats: Record<string, number>; singleRatio: string; topQty: string; topQtyVal: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [productOptions, setProductOptions] = useState<{ label: string; value: string; count: number }[]>([]);
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string; count: number }[]>([]);
  const [allProductNames, setAllProductNames] = useState<string[]>([]);
  const [allStoreNames, setAllStoreNames] = useState<string[]>([]);

  // 加载别名
  useEffect(() => { setAliases(initialAliases || loadProductAliases()); }, [initialAliases]);

  // 日期跟随
  useEffect(() => {
    if (selectedDate) {
      if (timeMode === 'day') { setCustomStart(selectedDate); setCustomEnd(selectedDate); }
      else if (timeMode === 'week') { const r = getISOWeekRange(selectedDate); setCustomStart(r.start); setCustomEnd(r.end); }
      else if (timeMode === 'month') { const r = getMonthRange(selectedDate); setCustomStart(r.start); setCustomEnd(r.end); }
    }
  }, [selectedDate, timeMode]);

  // 防抖搜索
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => { setDebouncedSearch(aggregateSearch.trim()); }, 280);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [aggregateSearch]);

  // IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsVisible(true);
        requestAnimationFrame(() => { [qtyChartInstanceRef, flagChartInstanceRef, reasonBarChartRef].forEach((ref) => { if (ref.current && !ref.current.isDisposed()) ref.current.resize(); }); });
      } else { setIsVisible(false); }
    }, { threshold: 0.01 });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 日期范围
  const dateRange = useMemo(() => {
    switch (timeMode) {
      case 'day': return (selectedDate || customStart) ? { start: selectedDate || customStart, end: selectedDate || customStart } : null;
      case 'week': return customStart && customEnd ? { start: customStart, end: customEnd } : null;
      case 'month': return customStart && customEnd ? { start: customStart, end: customEnd } : null;
      case 'custom': {
        if (!customStart || !customEnd) return null;
        const start = new Date(customStart); const end = new Date(customEnd);
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= MAX_DATE_RANGE_DAYS) {
          const clampedEnd = new Date(start); clampedEnd.setDate(clampedEnd.getDate() + MAX_DATE_RANGE_DAYS - 1);
          return { start: customStart, end: clampedEnd.toISOString().slice(0, 10) };
        }
        return { start: customStart, end: customEnd };
      }
      default: return null;
    }
  }, [selectedDate, timeMode, customStart, customEnd]);

  // Fetch options from backend
  useEffect(() => {
    if (!dateRange || Object.keys(records).length === 0) return;
    let cancelled = false;
    (async () => {
      const result = await apiComputeOptions(records, dateRange!.start, dateRange!.end, selectedProduct ? [selectedProduct] : [], selectedShops, aliases);
      if (!cancelled) {
        setProductOptions(result.productOptions.filter((p: any) => p.count > 0));
        setShopOptions(result.shopOptions.filter((s: any) => s.count > 0));
        setAllProductNames(result.allProducts);
        setAllStoreNames(result.allShops);
      }
    })();
    return () => { cancelled = true; };
  }, [records, dateRange, selectedShops, aliases, selectedProduct]);

  // 自动选择第一个产品
  useEffect(() => {
    if (productOptions.length > 0 && (!selectedProduct || !productOptions.find(p => p.value === selectedProduct))) {
      setSelectedProduct(productOptions[0].value);
    }
  }, [productOptions, selectedProduct]);

  // Fetch product analysis from backend
  useEffect(() => {
    if (!dateRange || !selectedProduct || Object.keys(records).length === 0) { setProductData(null); setGlobalTotal(0); setStats(null); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await apiComputeProductAnalysis(records, dateRange!.start, dateRange!.end, selectedProduct, selectedShops);
        if (!cancelled) {
          setProductData(result.productData);
          setGlobalTotal(result.globalTotal);
          setStats(result.stats);
        }
      } catch (e) {
        if (!cancelled) { setProductData(null); setGlobalTotal(0); setStats(null); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [dateRange, selectedProduct, selectedShops, records]);

  // 聚合搜索自动匹配
  useEffect(() => {
    const kw = debouncedSearch.toLowerCase();
    if (!kw) return;
    const matchedShops = allStoreNames.filter(s => s.toLowerCase().includes(kw));
    if (matchedShops.length > 0) { setSelectedShops(prev => { const set = new Set([...prev, ...matchedShops]); return set.size === prev.length && prev.every(v => set.has(v)) ? prev : Array.from(set); }); }
    const matchedProducts = allProductNames.filter(p => p.toLowerCase().includes(kw));
    if (matchedProducts.length > 0 && !selectedProduct) { setSelectedProduct(matchedProducts[0]); }
  }, [debouncedSearch, allStoreNames, allProductNames, aliases, selectedProduct]);

  const aggregateMatchCount = useMemo(() => {
    const kw = aggregateSearch.trim().toLowerCase();
    if (!kw) return 0;
    return allStoreNames.filter(s => s.toLowerCase().includes(kw)).length + allProductNames.filter(p => p.toLowerCase().includes(kw)).length;
  }, [aggregateSearch, allStoreNames, allProductNames]);

  const handleClearAll = useCallback(() => {
    setSelectedProduct(''); setSelectedShops([]); setAggregateSearch(''); setDebouncedSearch('');
  }, []);

  const handleClearSearch = useCallback(() => { setAggregateSearch(''); setDebouncedSearch(''); }, []);

  // Derived data from productData (pure UI rendering, no business logic)
  const total = useMemo(() => (productData ? (productData.total as number || 0) : 0), [productData]);
  const flags = useMemo(() => (productData ? (productData['标旗分类'] as Record<string, number> || {}) : {}), [productData]);
  const qtyStats = useMemo(() => stats?.qtyStats || {}, [stats]);
  const ratio = globalTotal > 0 ? ((total / globalTotal) * 100).toFixed(1) : '0';

  // 按选定旗子类型筛选数量分布
  const flagPrefix = qtyFlagType + '_';

  // 从 qtyStats 中提取实际存在的旗子类型
  const availableFlagTypes = useMemo(() => {
    const types = new Set<string>();
    for (const k of Object.keys(qtyStats)) {
      const idx = k.indexOf('_');
      if (idx > 0) types.add(k.slice(0, idx));
    }
    return types;
  }, [qtyStats]);
  const availableQtyFlagOptions = useMemo(
    () => QTY_FLAG_OPTIONS.filter(opt => availableFlagTypes.has(opt.value)),
    [availableFlagTypes]
  );

  // 当前选中的旗子类型不存在时自动切换到第一个
  useEffect(() => {
    if (availableQtyFlagOptions.length > 0 && !availableFlagTypes.has(qtyFlagType)) {
      setQtyFlagType(availableQtyFlagOptions[0].value);
    }
  }, [availableQtyFlagOptions, availableFlagTypes, qtyFlagType]);
  const filteredQtyStats = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(qtyStats)) {
      if (k.startsWith(flagPrefix)) result[k.slice(flagPrefix.length)] = v;
    }
    return result;
  }, [qtyStats, flagPrefix]);
  const filteredQtyTotal = useMemo(() => Object.values(filteredQtyStats).reduce((s, v) => s + v, 0), [filteredQtyStats]);
  const filteredSingleCount = filteredQtyStats['1'] || 0;
  const filteredSingleRatio = filteredQtyTotal > 0 ? ((filteredSingleCount / filteredQtyTotal) * 100).toFixed(1) : '0';
  const filteredTopQty = useMemo(() => {
    let top = '-'; let topV = 0;
    for (const [k, v] of Object.entries(filteredQtyStats)) { if (v > topV) { topV = v; top = k; } }
    return top;
  }, [filteredQtyStats]);

  const isHandGraspCake = selectedProduct && ['手抓饼', '葱油饼'].some(keyword => selectedProduct.includes(keyword)) || false;
  const unitLabel = isHandGraspCake ? '片' : '袋';

  const flagData = useMemo(() =>
    Object.entries(flags).map(([name, value]) => ({ name, value, itemStyle: { color: FLAG_COLOR_MAP[name] || VIVID_COLORS[0] } })),
    [flags]);

  const qtyData = useMemo(() =>
    Object.entries(filteredQtyStats).map(([k, v]) => ({ name: `${k}${unitLabel}`, value: v })).sort((a, b) => b.value - a.value),
    [filteredQtyStats, unitLabel]);

  const remarkDataByFlag = useMemo(() => {
    if (!productData) return {} as Record<string, number>;
    const raw = (productData['客服备注分类'] as Record<string, any>) || {};
    const remarks = (raw[remarkFlagType] as Record<string, any>) || {};
    const result: Record<string, number> = {};
    for (const [key, val] of Object.entries(remarks)) {
      if (typeof val === 'number') result[key] = (result[key] || 0) + val;
      else if (typeof val === 'object' && val !== null) {
        let count = 0;
        if ('订单数' in val && typeof val['订单数'] === 'number') count = val['订单数'];
        else if ('明细' in val && Array.isArray(val['明细'])) count = val['明细'].length;
        if (count > 0) result[key] = (result[key] || 0) + count;
      }
    }
    return result;
  }, [productData, remarkFlagType]);

  const remarkFlagTypes = useMemo(() => {
    if (!productData?.['客服备注分类']) return [];
    return Object.keys(productData['客服备注分类'] as Record<string, unknown>);
  }, [productData]);

  const otherDetails = useMemo((): RemarkOtherDetail[] => {
    if (!productData) return [];
    const remarks = (productData['客服备注分类'] as Record<string, any>) || {};
    const flagRemarks = (remarks[remarkFlagType] as Record<string, any>) || {};
    const otherVal = flagRemarks['其他'];
    if (typeof otherVal === 'object' && otherVal !== null && '明细' in otherVal) {
      return otherVal['明细'] || [];
    }
    return [];
  }, [productData, remarkFlagType]);

  // 手动归类合并
  const mergedRemarkData = useMemo(() => {
    const base = { ...remarkDataByFlag };
    if (!productData || otherDetails.length === 0) return base;
    const otherKeys = Object.keys(base).filter(k => k.includes('其他'));
    const otherKey = otherKeys.length > 0 ? otherKeys[0] : null;
    otherDetails.forEach((detail) => {
      const orderId = detail.订单号;
      const manualCat = manualClassification[orderId];
      if (manualCat) {
        if (otherKey && base[otherKey] > 0) base[otherKey] = Math.max(0, base[otherKey] - 1);
        base[manualCat] = (base[manualCat] || 0) + 1;
      }
    });
    return base;
  }, [remarkDataByFlag, otherDetails, manualClassification, productData]);

  const remarkBarData = useMemo(() =>
    Object.entries(mergedRemarkData).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    [mergedRemarkData]);

  const totalRemarkPages = Math.max(1, Math.ceil(otherDetails.length / REMARK_PAGE_SIZE));
  const pagedOtherDetails = useMemo(() => {
    const start = remarkPage * REMARK_PAGE_SIZE;
    return otherDetails.slice(start, start + REMARK_PAGE_SIZE);
  }, [otherDetails, remarkPage]);

  useEffect(() => { setRemarkPage(0); }, [remarkFlagType, selectedProduct]);

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

  // Extract keywords from a remark text (remove noise like status codes, timestamps, names)
  const extractKeywords = useCallback((text: string): string => {
    // Remove status code prefix (e.g., BC2, bc4, bc1)
    let clean = text.replace(/^(BC\d+|bc\d+)\s*/i, '');
    // Remove timestamps in brackets or parentheses
    clean = clean.replace(/[\[\(].*?\d{2}-\d{2}.*?[\]\)]/g, '');
    clean = clean.replace(/\d{2}-\d{2}\s+\d{2}:\d{2}/g, '');
    // Remove common noise words
    clean = clean.replace(/鲜食达|慧慧|璐璐/g, '');
    // Extract core keywords: take first meaningful segment
    clean = clean.trim();
    // If text contains Chinese characters, try to extract key phrases
    // Simple heuristic: find words like "冰箱", "口味", "破损" etc.
    const keyPhrases = ['冰箱', '口味', '破损', '变质', '漏发', '制作', '包装', '物流', '退款', '退货'];
    for (const phrase of keyPhrases) {
      if (clean.includes(phrase)) return phrase;
    }
    // Fallback: return first 2-4 Chinese characters
    const match = clean.match(/[\u4e00-\u9fa5]{2,4}/);
    return match ? match[0] : clean.slice(0, 4);
  }, []);

  const handleStartEditCategory = useCallback((orderId: string, currentCat: string) => {
    setEditingOrderId(orderId);
    setEditCategory(currentCat || '');
    // Auto-extract keywords from the remark text
    const detail = otherDetails.find(d => d.订单号 === orderId);
    if (detail) {
      setEditKeywords(extractKeywords(detail.客服备注));
    } else {
      setEditKeywords('');
    }
  }, [otherDetails, extractKeywords]);

  const handleSaveCategory = useCallback(async (orderId: string) => {
    const category = editCategory.trim();
    if (!category) {
      setManualClassification(prev => { const n = { ...prev }; delete n[orderId]; return n; });
      setEditingOrderId(null);
      return;
    }
    // Save manual classification
    setManualClassification(prev => ({ ...prev, [orderId]: category }));
    // Save keyword rule to backend and auto-classify similar remarks
    const keywords = editKeywords.trim();
    if (keywords && keywords.length >= 1) {
      try {
        setSavingRule(true);
        await appendReasonRule(category, keywords);
        // Auto-classify other unclassified remarks containing the same keyword
        setManualClassification(prev => {
          const next = { ...prev };
          for (const detail of otherDetails) {
            const otherId = detail.订单号;
            // Skip already classified or current item
            if (otherId === orderId || next[otherId]) continue;
            // Check if remark contains the keyword
            if (detail.客服备注.includes(keywords)) {
              next[otherId] = category;
            }
          }
          return next;
        });
      } catch (err) {
        console.error('Failed to save keyword rule:', err);
      } finally {
        setSavingRule(false);
      }
    }
    setEditingOrderId(null);
  }, [editCategory, editKeywords, otherDetails]);

  const handleDeleteCategory = useCallback((orderId: string) => {
    setManualClassification(prev => { const n = { ...prev }; delete n[orderId]; return n; });
    if (editingOrderId === orderId) setEditingOrderId(null);
  }, [editingOrderId]);

  const availableCategories = useMemo(() => {
    const cats = new Set(Object.keys(remarkDataByFlag));
    Object.values(manualClassification).forEach(c => cats.add(c));
    return Array.from(cats).sort();
  }, [remarkDataByFlag, manualClassification]);

  // Chart rendering
  const renderChart = useCallback((ref: React.RefObject<HTMLDivElement | null>, instanceRef: React.MutableRefObject<echarts.ECharts | null>, data: any[], chartType: QtyChartType) => {
    if (!ref.current || data.length === 0) return;
    if (!instanceRef.current || instanceRef.current.isDisposed()) { instanceRef.current = echarts.init(ref.current, 'brutal'); }
    const chart = instanceRef.current;
    const dataWithColor = data.map((d, i) => ({ ...d, itemStyle: d.itemStyle || { color: VIVID_COLORS[i % VIVID_COLORS.length] } }));
    let option: echarts.EChartsOption;
    if (chartType === 'rose') {
      option = { tooltip: { ...TOOLTIP_STYLE, trigger: 'item', formatter: (p: any) => `<b>${p.name}</b><br/>${p.value}单 (${p.percent}%)` }, legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11, color: '#64748b' }, itemWidth: 10, itemHeight: 10 }, series: [{ type: 'pie', roseType: 'area', radius: ['20%', '70%'], center: ['50%', '45%'], itemStyle: { borderColor: '#fff', borderWidth: 2 }, label: { show: true, fontSize: 12, fontWeight: 'bold' as const, color: '#334155', formatter: '{b}\n{c}单 ({d}%)', lineHeight: 16 }, data: dataWithColor }] };
    } else if (chartType === 'pie') {
      option = { tooltip: { ...TOOLTIP_STYLE, trigger: 'item', formatter: (p: any) => `<b>${p.name}</b><br/>${p.value}单 (${p.percent}%)` }, legend: { bottom: 0, textStyle: { fontSize: 11, color: '#64748b' }, itemWidth: 10, itemHeight: 10 }, series: [{ type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'], itemStyle: { borderColor: '#fff', borderWidth: 2 }, label: { show: true, fontSize: 12, fontWeight: 'bold' as const, color: '#334155', formatter: '{b}\n{c}单 ({d}%)', lineHeight: 16 }, data: dataWithColor }] };
    } else if (chartType === 'bar') {
      const sorted = [...dataWithColor].sort((a, b) => b.value - a.value);
      option = { tooltip: { ...TOOLTIP_STYLE, trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: '3%', right: '8%', bottom: '3%', top: '8%', containLabel: true }, xAxis: { type: 'category', data: sorted.map(d => d.name), axisLabel: { color: '#64748b', fontSize: 11 } }, yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }, axisLine: { show: false } }, series: [{ type: 'bar', data: sorted.map((d, i) => ({ value: d.value, itemStyle: { color: VIVID_COLORS[i % VIVID_COLORS.length] } })), barWidth: '50%', label: { show: true, position: 'top', fontSize: 11, fontWeight: 'bold', color: '#475569', formatter: '{c}' } }] };
    } else {
      option = { tooltip: { ...TOOLTIP_STYLE, formatter: (p: any) => `<b>${p.name}</b><br/>${p.value}单` }, series: [{ type: 'treemap', width: '95%', height: '85%', top: 5, roam: false, nodeClick: false, breadcrumb: { show: false }, label: { show: true, fontSize: 12, fontWeight: 'bold' as const, color: '#fff', formatter: (p: any) => `${p.name}\n${p.value}单` }, itemStyle: { borderColor: '#fff', borderWidth: 3 }, data: dataWithColor }] };
    }
    chart.setOption(option, true);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // 如果 DOM 元素已变化（清空筛选导致 div 卸载后重建），销毁旧实例
    if (qtyChartInstanceRef.current && qtyChartRef.current && qtyChartInstanceRef.current.getDom() !== qtyChartRef.current) {
      qtyChartInstanceRef.current.dispose();
      qtyChartInstanceRef.current = null;
    }
    return renderChart(qtyChartRef, qtyChartInstanceRef, qtyData, qtyChartType);
  }, [qtyData, qtyChartType, renderChart]);

  useEffect(() => {
    // 如果 DOM 元素已变化，销毁旧实例
    if (flagChartInstanceRef.current && flagChartRef.current && flagChartInstanceRef.current.getDom() !== flagChartRef.current) {
      flagChartInstanceRef.current.dispose();
      flagChartInstanceRef.current = null;
    }
    if (!flagChartRef.current || flagData.length === 0) return;
    if (!flagChartInstanceRef.current || flagChartInstanceRef.current.isDisposed()) { flagChartInstanceRef.current = echarts.init(flagChartRef.current, 'brutal'); }
    const chart = flagChartInstanceRef.current;
    const sortedFlag = [...flagData].sort((a, b) => b.value - a.value);
    let option: echarts.EChartsOption;
    if (flagChartType === 'pie') {
      option = { tooltip: { ...TOOLTIP_STYLE, trigger: 'item', formatter: (p: any) => `<b>${p.name}</b><br/>${p.value}单 (${p.percent}%)` }, legend: { bottom: 0, orient: 'horizontal', itemGap: 14, textStyle: { fontSize: 11, color: '#64748b' }, itemWidth: 12, itemHeight: 12 }, series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'], avoidLabelOverlap: true, padAngle: 2, itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 }, label: { show: false }, labelLine: { show: false }, data: sortedFlag.map(d => ({ name: d.name, value: d.value, itemStyle: { color: FLAG_COLOR_MAP[d.name] || VIVID_COLORS[0] } })) }] };
    } else {
      const barSorted = [...sortedFlag].sort((a, b) => a.value - b.value);
      option = { tooltip: { ...TOOLTIP_STYLE, trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: '3%', right: '8%', bottom: '3%', top: '8%', containLabel: true }, xAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } }, yAxis: { type: 'category', data: barSorted.map(d => d.name), axisLabel: { color: '#475569', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } }, series: [{ type: 'bar', data: barSorted.map(d => ({ value: d.value, itemStyle: { color: FLAG_COLOR_MAP[d.name] || VIVID_COLORS[0] } })), barWidth: '60%', label: { show: true, position: 'right', fontSize: 11, fontWeight: 'bold', color: '#475569', formatter: '{c}' } }] };
    }
    chart.setOption(option, true);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [flagData, flagChartType]);

  useEffect(() => {
    // 如果 DOM 元素已变化，销毁旧实例
    if (reasonBarChartRef.current && reasonBarRef.current && reasonBarChartRef.current.getDom() !== reasonBarRef.current) {
      reasonBarChartRef.current.dispose();
      reasonBarChartRef.current = null;
    }
    if (!reasonBarRef.current || remarkBarData.length === 0) return;
    if (!reasonBarChartRef.current || reasonBarChartRef.current.isDisposed()) { reasonBarChartRef.current = echarts.init(reasonBarRef.current, 'brutal'); }
    const chart = reasonBarChartRef.current;
    const sortedReasons = [...remarkBarData].sort((a, b) => a.value - b.value);
    chart.setOption({ tooltip: { ...TOOLTIP_STYLE, trigger: 'axis', axisPointer: { type: 'shadow' } }, grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true }, xAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }, axisLine: { show: false } }, yAxis: { type: 'category', data: sortedReasons.map(d => d.name), axisLabel: { color: '#475569', fontSize: 11, width: 80, overflow: 'truncate' }, axisLine: { show: false }, axisTick: { show: false } }, series: [{ type: 'bar', data: sortedReasons.map((d, i) => ({ value: d.value, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: VIVID_COLORS[(i + 2) % VIVID_COLORS.length] }, { offset: 1, color: VIVID_COLORS[(i + 3) % VIVID_COLORS.length] }]) } })), barWidth: '60%', label: { show: true, position: 'right' as const, fontSize: 11, fontWeight: 'bold', color: '#475569', formatter: '{c}' } }] }, true);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [remarkBarData]);

  if (allProductNames.length === 0) {
    return (<Card className="brutal-card-lift rounded-xl shadow-sm"><CardContent className="flex items-center justify-center py-16 text-muted-foreground"><p className="text-sm">暂无产品数据</p></CardContent></Card>);
  }

  const displayName = selectedProduct ? (aliases[selectedProduct]?.alias || selectedProduct) : '';
  const metricCards = [
    { label: '产品名称', value: displayName, color: '#14b8a6', isText: true },
    { label: '售后总数', value: stats?.total || 0, color: '#3b82f6' },
    { label: '全局占比', value: `${ratio}%`, color: '#8b5cf6' },
    { label: `${qtyFlagType.replace('旗子', '旗')}峰值`, value: filteredTopQty !== '-' ? `${filteredTopQty}${unitLabel} (${filteredQtyTotal}单)` : '-', color: '#f59e0b', isText: true },
  ];
  const timeModeLabels: Record<TimeMode, string> = { day: '日', week: '周', month: '月', custom: '自定义' };

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="sticky top-0 z-30 pb-2 -mt-2 pt-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Card className="brutal-card-lift border-primary/20 shadow-sm rounded-xl overflow-hidden transition-all">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg">
                  {(['day', 'week', 'month', 'custom'] as TimeMode[]).map((mode) => (
                    <button key={mode} onClick={() => setTimeMode(mode)} className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${timeMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/40'}`}>{timeModeLabels[mode]}</button>
                  ))}
                </div>
                {timeMode === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-7 text-xs w-[130px] font-mono" />
                    <span className="text-xs text-muted-foreground">~</span>
                    <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-7 text-xs w-[130px] font-mono" />
                  </div>
                )}
                {dateRange && <Badge variant="outline" className="text-xs tabular-nums font-mono ml-auto bg-background border-primary/15 text-primary/80">{dateRange.start} ~ {dateRange.end}</Badge>}
              </div>
              <div className="flex items-center gap-3 flex-wrap border-t pt-3.5">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 shrink-0"><Search className="h-3.5 w-3.5" /> 聚合搜索:</span>
                <div className="relative flex-1 min-w-[200px] max-w-[360px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input type="text" value={aggregateSearch} onChange={e => setAggregateSearch(e.target.value)} placeholder="搜索店铺/产品..." className="h-8 !pl-9 pr-[72px] text-xs border-dashed border-primary/30 bg-primary/[0.02] focus:border-primary/60 focus:ring-1 focus:ring-primary/20 focus:bg-background hover:border-primary/40 transition-all duration-200 rounded-lg" />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {aggregateSearch.trim() && (<>{aggregateMatchCount > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-sm font-bold bg-primary/10 text-primary">{aggregateMatchCount}</Badge>}<Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-muted/60 rounded-full" onClick={handleClearSearch}><X className="h-3 w-3 text-muted-foreground" /></Button></>)}
                    {!aggregateSearch.trim() && <span className="text-[10px] text-muted-foreground/50 px-1.5"><CornerDownLeft className="h-2.5 w-2.5 inline mr-0.5" />回车匹配</span>}
                  </div>
                </div>
                {/* Shop multi-select */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`h-8 border-dashed flex gap-2 w-auto min-w-[130px] justify-between px-3 bg-background rounded-lg ${selectedShops.length > 0 ? 'border-primary/60 ring-1 ring-primary/25' : ''}`}>
                      <div className="flex items-center gap-1.5 text-xs"><Store className="h-3 w-3 text-muted-foreground" /><span className="font-medium text-muted-foreground">店铺</span>{selectedShops.length > 0 && <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px] rounded-sm font-bold bg-primary/10 text-primary">{selectedShops.length}</Badge>}</div>
                      <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0 shadow-lg rounded-lg" align="start">
                    <Command><CommandInput placeholder="搜索店铺..." className="h-9 text-xs" /><CommandList className="max-h-[220px]"><CommandEmpty className="text-xs p-4 text-center">未找到店铺</CommandEmpty><CommandGroup>{shopOptions.map(opt => { const isSelected = selectedShops.includes(opt.value); return (<CommandItem key={opt.value} value={opt.label} onSelect={() => { setSelectedShops(prev => isSelected ? prev.filter(v => v !== opt.value) : [...prev, opt.value]); }} className="text-xs flex items-center gap-2.5 cursor-pointer"><div className={`flex h-4 w-4 items-center justify-center rounded-sm border shrink-0 ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input opacity-50'}`}>{isSelected && <Check className="h-3 w-3" />}</div><Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="flex-1 truncate">{opt.label}</span><Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] font-mono shrink-0">{opt.count}</Badge></CommandItem>); })}</CommandGroup></CommandList></Command>
                  </PopoverContent>
                </Popover>
                {/* Product select */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 border-dashed flex gap-2 w-auto min-w-[160px] justify-between px-3 bg-background rounded-lg">
                      <div className="flex items-center gap-1.5 text-xs"><Package className="h-3 w-3 text-muted-foreground" /><span className="font-medium text-muted-foreground">产品</span>{selectedProduct && <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px] rounded-sm font-bold bg-primary/10 text-primary">1</Badge>}</div>
                      <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0 shadow-lg rounded-lg" align="start">
                    <Command><CommandInput placeholder="搜索产品..." className="h-9 text-xs" /><CommandList className="max-h-[220px]"><CommandEmpty className="text-xs p-4 text-center">未找到产品</CommandEmpty><CommandGroup>{productOptions.map(opt => (<CommandItem key={opt.value} value={opt.label} onSelect={() => setSelectedProduct(opt.value)} className="text-xs flex items-center gap-2.5 cursor-pointer"><div className={`flex h-4 w-4 items-center justify-center rounded-sm border shrink-0 ${selectedProduct === opt.value ? 'bg-primary border-primary text-primary-foreground' : 'border-input opacity-50'}`}>{selectedProduct === opt.value && <Check className="h-3 w-3" />}</div><Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="flex-1 truncate">{opt.label}</span><Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] font-mono shrink-0">{opt.count}</Badge></CommandItem>))}</CommandGroup></CommandList></Command>
                  </PopoverContent>
                </Popover>
                {(selectedProduct || selectedShops.length > 0 || aggregateSearch.trim()) && <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 ml-1 shrink-0 rounded-lg" onClick={handleClearAll}><X className="h-3.5 w-3.5 mr-1" />清空筛选</Button>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!productData ? (
        <Card className="brutal-card-lift rounded-xl shadow-sm"><CardContent className="flex items-center justify-center py-16 text-muted-foreground"><p className="text-sm">{loading ? '计算中...' : '请选择一个产品查看详细分析'}</p></CardContent></Card>
      ) : (
        <>
          <Card className="brutal-card-lift rounded-xl shadow-sm overflow-hidden border-l-4 border-l-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div><CardTitle className="text-lg font-bold flex items-center gap-2"><Package className="h-5 w-5 text-primary" />产品分析</CardTitle><CardDescription className="text-sm mt-1">基于 {dateRange?.start} ~ {dateRange?.end} 的聚合数据</CardDescription></div>
                <div className="flex items-center gap-2">{!readOnly && <Button variant="outline" size="sm" className="h-8 px-2.5 rounded-lg" onClick={handleOpenEdit}><Pencil className="h-3.5 w-3.5" /></Button>}</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                {metricCards.map(card => (
                  <div key={card.label} className="rounded-xl p-5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${card.color}10 0%, ${card.color}05 100%)`, borderLeft: `4px solid ${card.color}` }}>
                    <p className="text-sm text-muted-foreground font-semibold">{card.label}</p>
                    <p className={`mt-2 font-black tabular-nums ${card.isText ? 'text-base line-clamp-2' : 'text-3xl'}`} style={{ color: card.color }}>{card.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mt-6">
            <Card className="brutal-card-lift rounded-xl shadow-sm border-t-4 border-t-emerald-400/60 lg:col-span-6">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2 flex-wrap"><Package className="h-5 w-5 text-primary" />数量分布
                    <Select value={qtyFlagType} onValueChange={setQtyFlagType}>
                      <SelectTrigger className="h-6 px-2 text-[10px] w-auto gap-1 rounded-md border-destructive/30 bg-destructive/10 text-destructive font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableQtyFlagOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="outline" className="ml-0 text-xs tabular-nums">单{unitLabel}占比 {filteredSingleRatio}%</Badge></CardTitle>
                  <div className="flex gap-1">{QTY_CHART_OPTIONS.map(opt => <Button key={opt.value} variant={qtyChartType === opt.value ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-[10px] rounded-lg" onClick={() => setQtyChartType(opt.value)}>{opt.label}</Button>)}</div>
                </div>
              </CardHeader>
              <CardContent>{qtyData.length === 0 ? (<div className="flex items-center justify-center h-[300px] text-muted-foreground"><p className="text-xs">无{qtyFlagType.replace('旗子', '旗')}数量数据</p></div>) : (<div ref={qtyChartRef} className="w-full h-[340px]" />)}</CardContent>
            </Card>
            <Card className="brutal-card-lift rounded-xl shadow-sm border-t-4 border-t-amber-400/60 lg:col-span-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><Flag className="h-4 w-4 text-primary" />标旗分类</CardTitle>
                  <div className="flex gap-1">{FLAG_CHART_OPTIONS.map(opt => <Button key={opt.value} variant={flagChartType === opt.value ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-[10px] rounded-lg" onClick={() => setFlagChartType(opt.value)}>{opt.label}</Button>)}</div>
                </div>
              </CardHeader>
              <CardContent>{flagData.length === 0 ? (<div className="flex items-center justify-center h-[300px] text-muted-foreground"><p className="text-xs">无标旗数据</p></div>) : (<div ref={flagChartRef} className="w-full h-[440px]" />)}</CardContent>
            </Card>
          </div>

          {remarkBarData.length > 0 && (
            <Card className="brutal-card-lift mt-6 rounded-xl shadow-sm border-t-4 border-t-red-400/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />客服备注分类</CardTitle>
                  <Select value={remarkFlagType} onValueChange={setRemarkFlagType}>
                    <SelectTrigger className="w-[130px] h-7 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>{remarkFlagTypes.map(ft => (<SelectItem key={ft} value={ft}><span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: FLAG_COLOR_MAP[ft] || '#94a3b8' }} />{ft}</span></SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <CardDescription className="text-xs">{remarkFlagType}客服备注原因排名（含手动归类）</CardDescription>
              </CardHeader>
              <CardContent><div ref={reasonBarRef} className="w-full" style={{ height: Math.max(480, remarkBarData.length * 36 + 24) }} /></CardContent>
            </Card>
          )}

          {otherDetails.length > 0 && (
            <Card className="brutal-card-lift mt-6 rounded-xl shadow-sm border-t-4 border-t-orange-400/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />&quot;其他&quot;备注明细
                  <Badge variant="outline" className="text-[10px]">{remarkFlagType}</Badge>
                  <Badge variant="secondary" className="text-[10px] tabular-nums">共 {otherDetails.length} 条</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[80px] text-xs">订单号</TableHead><TableHead className="w-[140px] text-xs">品类</TableHead><TableHead className="text-xs">客服备注</TableHead><TableHead className="w-[200px] text-xs">手动归类</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pagedOtherDetails.map((detail, idx) => {
                      const orderId = detail.订单号;
                      const currentCat = manualClassification[orderId] || '';
                      const isEditing = editingOrderId === orderId;
                      return (
                        <TableRow key={`${orderId}-${idx}`}>
                          <TableCell className="text-xs font-mono">{orderId}</TableCell>
                          <TableCell className="text-xs">{detail.品类}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={detail.客服备注}>{detail.客服备注}</TableCell>
                          <TableCell className="text-xs py-1.5">
                            {isEditing ? (
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="relative w-[150px]">
                                    <Input value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="输入或选择类别" className="h-8 text-xs pr-8 rounded-lg" onKeyDown={e => e.key === 'Enter' && handleSaveCategory(orderId)} />
                                    <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="absolute right-0 top-0 h-8 w-8 p-0 rounded-r-lg"><ChevronsUpDown className="h-4 w-4 text-muted-foreground" /></Button></PopoverTrigger><PopoverContent className="w-[180px] p-0 rounded-lg shadow-lg" align="end"><Command><CommandInput placeholder="搜索已有类别..." className="h-8 text-xs" /><CommandList><CommandEmpty className="text-xs p-2 text-center">无匹配类别</CommandEmpty><CommandGroup>{availableCategories.map(cat => <CommandItem key={cat} value={cat} onSelect={() => setEditCategory(cat)} className="text-xs py-2 px-3 cursor-pointer">{cat}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>
                                  </div>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 rounded-full" onClick={() => handleSaveCategory(orderId)} disabled={savingRule}>
                                    {savingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted/50 rounded-full" onClick={() => setEditingOrderId(null)}><X className="h-4 w-4" /></Button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">关键词:</span>
                                  <Input value={editKeywords} onChange={e => setEditKeywords(e.target.value)} placeholder="自动提取" className="h-6 text-[10px] w-[120px] rounded-md" />
                                  <span className="text-[10px] text-muted-foreground/60">自动匹配</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 min-h-[32px]">
                                {currentCat ? (<><Badge variant="secondary" className="text-xs px-3 py-1 h-7 font-medium">{currentCat}</Badge><Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full" onClick={() => handleStartEditCategory(orderId, currentCat)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-red-50 rounded-full" onClick={() => handleDeleteCategory(orderId)}><Trash2 className="h-3.5 w-3.5" /></Button></>) : (<Button variant="outline" size="sm" className="h-8 text-xs px-3 rounded-lg border-dashed" onClick={() => handleStartEditCategory(orderId, '')}><Plus className="h-3.5 w-3.5 mr-1.5" /> 归类</Button>)}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {totalRemarkPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button variant="outline" size="sm" disabled={remarkPage === 0} onClick={() => setRemarkPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-xs text-muted-foreground tabular-nums">{remarkPage + 1} / {totalRemarkPages}</span>
                    <Button variant="outline" size="sm" disabled={remarkPage >= totalRemarkPages - 1} onClick={() => setRemarkPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>编辑产品显示名</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label>显示名称</Label><Input value={editAlias} onChange={e => setEditAlias(e.target.value)} placeholder="输入新的显示名称" /></div>
            <div className="grid gap-2"><Label>备注</Label><Textarea value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="添加备注说明" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button><Button onClick={handleSaveAlias}>保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
