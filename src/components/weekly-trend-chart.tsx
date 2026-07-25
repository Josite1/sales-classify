'use client';

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { registerBrutalTheme, getBrutalTooltip, getBrutalGrid, getBrutalXAxis, getBrutalYAxis, BRUTAL_COLORS } from '@/lib/echarts-theme';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Search,
  BarChart3,
  TrendingUp,
  X,
  Package,
  CalendarDays,
  Store,
  ChevronsUpDown,
  Check,
  CornerDownLeft,
} from 'lucide-react';
import type { AllRecords, ProductAliases } from '@/lib/types';
import { loadProductAliases } from '@/lib/storage';
import { apiComputeTrendData, apiComputeOptions } from '@/lib/api';

/* ========== 日期范围工具函数（纯 UI 展示） ========== */
function getISOWeekRange(dateStr: string): { monday: string; sunday: string } {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { monday: fmt(monday), sunday: fmt(sunday) };
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

function getYearRange(dateStr: string): { start: string; end: string } {
  const year = new Date(dateStr).getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

type TimeMode = 'week' | 'month' | 'year' | 'custom';

const VIVID_COLORS = BRUTAL_COLORS;

interface WeeklyTrendChartProps {
  records: AllRecords;
  selectedDate: string | null;
  initialAliases?: ProductAliases;
}

/** 安全获取或创建 ECharts 实例 */
function getOrCreateChart(
  containerRef: React.RefObject<HTMLDivElement | null>,
  chartRef: React.MutableRefObject<echarts.ECharts | null>,
  domTrackRef: React.MutableRefObject<HTMLDivElement | null>,
): echarts.ECharts | null {
  const dom = containerRef.current;
  if (!dom) return null;
  if (domTrackRef.current !== dom) {
    if (chartRef.current) { try { chartRef.current.dispose(); } catch {} }
    chartRef.current = null;
    domTrackRef.current = dom;
  }
  if (!chartRef.current || chartRef.current.isDisposed()) {
    chartRef.current = echarts.init(dom, 'brutal');
  }
  return chartRef.current;
}

/* ========== 多选下拉组件（纯 UI） ========== */
function MultiSelect({
  title, options, selected, onChange, placeholder = '搜索...', highlighted = false, iconType = 'shop',
}: {
  title: string; options: { label: string; value: string; count: number }[]; selected: string[];
  onChange: (val: string[]) => void; placeholder?: string; highlighted?: boolean; iconType?: 'shop' | 'product';
}) {
  const [open, setOpen] = useState(false);
  const ItemIcon = iconType === 'shop' ? Store : Package;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`h-8 border-dashed flex gap-2 w-auto min-w-[130px] justify-between px-3 bg-background transition-all duration-200 ${highlighted ? 'border-primary/60 ring-1 ring-primary/25 shadow-sm shadow-primary/10' : ''} ${open ? 'border-primary/50 bg-primary/5' : ''} animate-fade-in`}>
          <div className="flex items-center gap-1.5 text-xs">
            {iconType === 'shop' ? <Store className={`h-3 w-3 ${highlighted ? 'text-primary' : 'text-muted-foreground'}`} /> : <Package className={`h-3 w-3 ${highlighted ? 'text-primary' : 'text-muted-foreground'}`} />}
            <span className={`font-medium ${highlighted ? 'text-primary' : 'text-muted-foreground'}`}>{title}</span>
            {selected.length > 0 && <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px] rounded-sm font-bold bg-primary/10 text-primary animate-pop">{selected.length}</Badge>}
          </div>
          <ChevronsUpDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-primary' : 'opacity-50'}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0 shadow-lg border-primary/10 animate-slide-up" align="start">
        <Command><CommandInput placeholder={placeholder} className="h-9 text-xs" /><CommandList className="max-h-[220px]"><CommandEmpty className="text-xs p-4 text-center text-muted-foreground">未找到匹配项</CommandEmpty><CommandGroup>
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (<CommandItem key={opt.value} value={opt.label} onSelect={() => { isSelected ? onChange(selected.filter((v) => v !== opt.value)) : onChange([...selected, opt.value]); }} className="text-xs flex items-center gap-2.5 cursor-pointer py-1.5 transition-colors duration-150">
              <div className={`flex h-4 w-4 items-center justify-center rounded-sm border shrink-0 transition-all duration-200 ${isSelected ? 'bg-primary border-primary text-primary-foreground scale-110' : 'border-input opacity-50'}`}>{isSelected && <Check className="h-3 w-3 animate-check" />}</div>
              <ItemIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{opt.label}</span>
              <Badge variant={opt.count === 0 ? 'outline' : 'secondary'} className={`ml-auto px-1.5 py-0 h-4 text-[10px] font-mono tabular-nums shrink-0 transition-all duration-300 ${opt.count === 0 ? 'border-yellow-300 bg-yellow-50 text-yellow-700' : ''}`}>{opt.count}</Badge>
            </CommandItem>);
          })}
        </CommandGroup></CommandList></Command>
      </PopoverContent>
    </Popover>
  );
}

/* ========== 主组件 ========== */
export function WeeklyTrendChart({ records, selectedDate, initialAliases }: WeeklyTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const productTrendRef = useRef<HTMLDivElement>(null);
  const reasonTrendRef = useRef<HTMLDivElement>(null);
  const overviewChartRef = useRef<echarts.ECharts | null>(null);
  const productTrendChartRef = useRef<echarts.ECharts | null>(null);
  const reasonTrendChartRef = useRef<echarts.ECharts | null>(null);
  const overviewInitDomRef = useRef<HTMLDivElement | null>(null);
  const productTrendInitDomRef = useRef<HTMLDivElement | null>(null);
  const reasonTrendInitDomRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [timeMode, setTimeMode] = useState<TimeMode>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedShops, setSelectedShops] = useState<string[]>([]);
  const [aggregateSearch, setAggregateSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aliases, setAliases] = useState<ProductAliases>({});

  // API-computed states
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<string[]>([]);
  const [topReasons, setTopReasons] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [productOptions, setProductOptions] = useState<{ label: string; value: string; count: number }[]>([]);
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string; count: number }[]>([]);
  const [allProducts, setAllProducts] = useState<string[]>([]);
  const [allStores, setAllStores] = useState<string[]>([]);

  useEffect(() => {
    setAliases(initialAliases || loadProductAliases());
  }, [initialAliases]);

  // 防抖
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => { setDebouncedSearch(aggregateSearch.trim()); }, 280);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [aggregateSearch]);

  useEffect(() => {
    if (selectedDate) { setCustomStart(selectedDate); setCustomEnd(selectedDate); }
  }, [selectedDate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsVisible(true);
        requestAnimationFrame(() => {
          [overviewChartRef, productTrendChartRef, reasonTrendChartRef].forEach((ref) => {
            if (ref.current && !ref.current.isDisposed()) ref.current.resize();
          });
        });
      } else { setIsVisible(false); }
    }, { threshold: 0.01 });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 日期范围
  const dateRange = useMemo(() => {
    if (!selectedDate && timeMode !== 'custom') return null;
    switch (timeMode) {
      case 'week': return selectedDate ? { start: getISOWeekRange(selectedDate).monday, end: getISOWeekRange(selectedDate).sunday } : null;
      case 'month': return selectedDate ? getMonthRange(selectedDate) : null;
      case 'year': return selectedDate ? getYearRange(selectedDate) : null;
      case 'custom': return customStart && customEnd ? { start: customStart, end: customEnd } : null;
      default: return null;
    }
  }, [selectedDate, timeMode, customStart, customEnd]);

  // Fetch options from backend
  useEffect(() => {
    if (!dateRange || Object.keys(records).length === 0) return;
    let cancelled = false;
    (async () => {
      const result = await apiComputeOptions(records, dateRange!.start, dateRange!.end, selectedProducts, selectedShops, aliases);
      if (!cancelled) {
        setProductOptions(result.productOptions);
        setShopOptions(result.shopOptions);
        setAllProducts(result.allProducts);
        setAllStores(result.allShops);
      }
    })();
    return () => { cancelled = true; };
  }, [records, dateRange, selectedProducts, selectedShops, aliases]);

  // 聚合搜索自动勾选
  useEffect(() => {
    const kw = debouncedSearch.toLowerCase();
    if (!kw || allStores.length === 0) return;
    const matchedShops = allStores.filter(s => s.toLowerCase().includes(kw));
    const matchedProducts = allProducts.filter(p => p.toLowerCase().includes(kw));
    if (matchedShops.length > 0 || matchedProducts.length > 0) {
      setSelectedShops(prev => { const set = new Set([...prev, ...matchedShops]); return set.size === prev.length && prev.every(v => set.has(v)) ? prev : Array.from(set); });
      setSelectedProducts(prev => { const set = new Set([...prev, ...matchedProducts]); return set.size === prev.length && prev.every(v => set.has(v)) ? prev : Array.from(set); });
    }
  }, [debouncedSearch, allStores, allProducts, aliases]);

  const aggregateMatchCount = useMemo(() => {
    const kw = aggregateSearch.trim().toLowerCase();
    if (!kw) return 0;
    return allStores.filter(s => s.toLowerCase().includes(kw)).length + allProducts.filter(p => p.toLowerCase().includes(kw)).length;
  }, [aggregateSearch, allStores, allProducts]);

  const handleClearAll = useCallback(() => { setSelectedProducts([]); setSelectedShops([]); setAggregateSearch(''); setDebouncedSearch(''); }, []);
  const handleClearSearch = useCallback(() => { setAggregateSearch(''); setDebouncedSearch(''); }, []);

  // Fetch trend data from backend
  useEffect(() => {
    if (!dateRange || Object.keys(records).length === 0) {
      setDailyData([]);
      setTopProducts([]);
      setTopReasons([]);
      return;
    }
    let cancelled = false;
    setDataLoading(true);
    (async () => {
      try {
        const result = await apiComputeTrendData(records, dateRange!.start, dateRange!.end, timeMode, selectedProducts, selectedShops, aliases);
        if (!cancelled) {
          setDailyData(result.dailyData);
          setTopProducts(result.topProducts);
          setTopReasons(result.topReasons);
        }
      } catch (e) {
        if (!cancelled) { setDailyData([]); setTopProducts([]); setTopReasons([]); }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dateRange, timeMode, selectedProducts, selectedShops, records, aliases]);

  // Register brutalist theme
  if (typeof window !== 'undefined') { registerBrutalTheme(echarts); }

  const tooltipStyle = getBrutalTooltip();

  // ResizeObserver
  useEffect(() => {
    const containers = [overviewRef.current, productTrendRef.current, reasonTrendRef.current];
    const charts = [overviewChartRef, productTrendChartRef, reasonTrendChartRef];
    const observer = new ResizeObserver(() => { charts.forEach(ref => { if (ref.current && !ref.current.isDisposed()) ref.current.resize(); }); });
    containers.forEach(c => c && observer.observe(c));
    resizeObserverRef.current = observer;
    return () => observer.disconnect();
  }, [dailyData]);

  // 1. 每日总览
  useEffect(() => {
    const chart = getOrCreateChart(overviewRef, overviewChartRef, overviewInitDomRef);
    if (!chart) return;
    if (dailyData.length === 0) { chart.clear(); return; }
    chart.setOption({
      tooltip: { ...tooltipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 12, color: '#64748b' }, itemGap: 20 },
      grid: { left: '3%', right: '4%', bottom: '14%', top: '14%', containLabel: true },
      xAxis: { type: 'category', data: dailyData.map(d => d.label), axisLabel: { fontSize: 11, color: '#64748b', rotate: dailyData.length > 10 ? 30 : 0, formatter: (val: string) => val.length > 8 ? val.slice(0, 8) + '…' : val }, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } },
      dataZoom: dailyData.length > 14 ? [{ type: 'slider', start: 0, end: 60, height: 20, bottom: 30 }, { type: 'inside' }] : undefined,
      series: [
        { name: '售后总单数', type: 'bar', barWidth: '35%', itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#14b8a6' }, { offset: 1, color: '#0d9488' }]) }, label: { show: true, position: 'top', fontSize: 11, fontWeight: 'bold', color: '#059669', formatter: '{c}' }, data: dailyData.map(d => d.totalOrders) },
        { name: '红旗标记数', type: 'line', smooth: true, symbol: 'circle', symbolSize: 8, lineStyle: { width: 2, color: '#ef4444' }, itemStyle: { color: '#ef4444', borderWidth: 2, borderColor: '#fff' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(239,68,68,0.15)' }, { offset: 1, color: 'rgba(239,68,68,0.01)' }]) }, label: { show: true, position: 'top', fontSize: 11, fontWeight: 'bold', color: '#ef4444', formatter: '{c}' }, data: dailyData.map(d => d.redFlags) },
        { name: '绿色旗子', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, lineStyle: { width: 2, color: '#22c55e' }, itemStyle: { color: '#22c55e', borderWidth: 2, borderColor: '#fff' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(34,197,94,0.12)' }, { offset: 1, color: 'rgba(34,197,94,0.01)' }]) }, label: { show: true, position: 'top', fontSize: 10, fontWeight: 'bold', color: '#22c55e', formatter: (p: { value: number }) => p.value > 0 ? `${p.value}` : '' }, data: dailyData.map(d => d.greenFlags) },
        { name: '灰色旗子', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, lineStyle: { width: 2, color: '#94a3b8' }, itemStyle: { color: '#94a3b8', borderWidth: 2, borderColor: '#fff' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(148,163,184,0.12)' }, { offset: 1, color: 'rgba(148,163,184,0.01)' }]) }, label: { show: true, position: 'top', fontSize: 10, fontWeight: 'bold', color: '#94a3b8', formatter: (p: { value: number }) => p.value > 0 ? `${p.value}` : '' }, data: dailyData.map(d => d.greyFlags) },
      ],
    }, true);
  }, [dailyData, isVisible]);

  // 2. 产品每日趋势
  useEffect(() => {
    const chart = getOrCreateChart(productTrendRef, productTrendChartRef, productTrendInitDomRef);
    if (!chart) return;
    if (dailyData.length === 0) { chart.clear(); return; }
    const displayProds = selectedProducts.length > 0 ? selectedProducts.map(name => aliases[name]?.alias || name) : topProducts;
    if (displayProds.length === 0) { chart.clear(); return; }
    chart.setOption({
      tooltip: { ...tooltipStyle, trigger: 'axis' },
      legend: displayProds.length > 1 ? { type: 'scroll', bottom: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11, color: '#64748b' }, itemGap: 16, pageIconSize: 12, pageTextStyle: { fontSize: 11, color: '#94a3b8' } } : undefined,
      grid: { left: '3%', right: '4%', bottom: displayProds.length > 1 ? '16%' : '8%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: dailyData.map(d => d.label), axisLabel: { fontSize: 11, color: '#64748b', rotate: dailyData.length > 10 ? 30 : 0, formatter: (val: string) => val.length > 8 ? val.slice(0, 8) + '…' : val }, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false }, boundaryGap: false },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } },
      dataZoom: dailyData.length > 14 ? [{ type: 'slider', start: 0, end: 60, height: 20, bottom: displayProds.length > 1 ? 40 : 10 }, { type: 'inside' }] : undefined,
      series: displayProds.map((name, i) => {
        const c = VIVID_COLORS[i % VIVID_COLORS.length];
        return { name: name.length > 10 ? name.slice(0, 10) + '...' : name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, lineStyle: { width: 2, color: c }, itemStyle: { color: c, borderWidth: 2, borderColor: '#fff' }, emphasis: { lineStyle: { width: 5 } }, areaStyle: displayProds.length === 1 ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: c + '30' }, { offset: 1, color: c + '05' }]) } : undefined, label: { show: true, position: 'top', fontSize: 10, fontWeight: 'bold', color: c, formatter: (p: { value: number }) => p.value > 0 ? `${p.value}` : '' }, data: dailyData.map(d => d.products[name] || 0) };
      }),
    }, true);
  }, [dailyData, topProducts, selectedProducts, aliases, isVisible]);

  // 3. 异常原因堆叠
  useEffect(() => {
    const chart = getOrCreateChart(reasonTrendRef, reasonTrendChartRef, reasonTrendInitDomRef);
    if (!chart) return;
    if (dailyData.length === 0 || topReasons.length === 0) { chart.clear(); return; }
    chart.setOption({
      tooltip: { ...tooltipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { type: 'scroll', bottom: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11, color: '#64748b' }, itemGap: 16, pageIconSize: 12, pageTextStyle: { fontSize: 11, color: '#94a3b8' } },
      grid: { left: '3%', right: '4%', bottom: '14%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: dailyData.map(d => d.label), axisLabel: { fontSize: 11, color: '#64748b', rotate: dailyData.length > 10 ? 30 : 0, formatter: (val: string) => val.length > 8 ? val.slice(0, 8) + '…' : val }, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false } },
      dataZoom: dailyData.length > 14 ? [{ type: 'slider', start: 0, end: 60, height: 20, bottom: 30 }, { type: 'inside' }] : undefined,
      series: topReasons.map((reason, i) => ({ name: reason, type: 'bar', stack: 'reasons', barWidth: '50%', itemStyle: { color: VIVID_COLORS[(i + 2) % VIVID_COLORS.length], borderRadius: i === topReasons.length - 1 ? [4, 4, 0, 0] : undefined }, emphasis: { focus: 'series' }, label: { show: true, position: 'inside', fontSize: 10, fontWeight: 'bold', color: '#fff', formatter: (p: { value: number }) => p.value > 0 ? `${p.value}` : '' }, data: dailyData.map(d => d.reasons[reason] || 0) })),
    }, true);
  }, [dailyData, topReasons, isVisible]);

  // 清理
  useEffect(() => {
    return () => {
      [overviewChartRef, productTrendChartRef, reasonTrendChartRef].forEach(ref => { if (ref.current) try { ref.current.dispose(); } catch {} ref.current = null; });
      overviewInitDomRef.current = null; productTrendInitDomRef.current = null; reasonTrendInitDomRef.current = null;
    };
  }, []);

  if (Object.keys(records).length === 0) {
    return (<Card className="animate-fade-in-up"><CardContent className="flex items-center justify-center py-16 text-muted-foreground"><div className="text-center"><TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="text-sm">导入多日数据后可查看变化趋势</p><p className="text-xs mt-1">至少需要 1 条日期记录</p></div></CardContent></Card>);
  }

  const timeModeLabels: Record<TimeMode, string> = { week: '周', month: '月', year: '年', custom: '自定义' };

  return (
    <div ref={containerRef} className="space-y-6">
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes checkDraw { from { stroke-dashoffset: 20; } to { stroke-dashoffset: 0; } }
        .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-scale-in { animation: scaleIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards; }
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }
        .animate-pop { animation: pop 0.3s ease-out; }
      `}</style>

      <div className="sticky top-0 z-30 pb-2 -mt-2 pt-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 animate-fade-in-up">
        <Card className="card-hover-effect border-primary/20 shadow-sm overflow-hidden">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg animate-scale-in">
                  {(['week', 'month', 'year', 'custom'] as TimeMode[]).map(mode => (
                    <button key={mode} onClick={() => setTimeMode(mode)} className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ripple-btn ${timeMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/40'}`}>{timeModeLabels[mode]}</button>
                  ))}
                </div>
                {timeMode === 'custom' && (<div className="flex items-center gap-2 animate-fade-in-up"><Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-7 text-xs w-[130px] font-mono animate-glow-pulse" /><span className="text-xs text-muted-foreground">~</span><Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-7 text-xs w-[130px] font-mono animate-glow-pulse" /></div>)}
                {dateRange && <Badge variant="outline" className="text-xs tabular-nums font-mono ml-auto bg-background border-primary/15 text-primary/80 animate-fade-in-up">{dateRange.start} ~ {dateRange.end}</Badge>}
              </div>
              <div className="flex items-center gap-3 flex-wrap border-t pt-3.5">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 shrink-0"><Search className="h-3.5 w-3.5" /> 聚合搜索:</span>
                <div className="relative flex-1 min-w-[240px] max-w-[420px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input type="text" value={aggregateSearch} onChange={e => setAggregateSearch(e.target.value)} placeholder="输入关键词，自动匹配店铺和产品..." className="h-8 !pl-9 pr-[72px] text-xs border-dashed border-primary/30 bg-primary/[0.02] focus:border-primary/60 focus:ring-1 focus:ring-primary/20 focus:bg-background hover:border-primary/40 transition-all duration-200 animate-glow-pulse" />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {aggregateSearch.trim() && (<>{aggregateMatchCount > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-sm font-bold bg-primary/10 text-primary animate-pop">{aggregateMatchCount}</Badge>}<Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-muted/60 rounded-full transition-transform duration-200 hover:rotate-90" onClick={handleClearSearch}><X className="h-3 w-3 text-muted-foreground" /></Button></>)}
                    {!aggregateSearch.trim() && <span className="text-[10px] text-muted-foreground/50 px-1.5"><CornerDownLeft className="h-2.5 w-2.5 inline mr-0.5" />回车匹配</span>}
                  </div>
                </div>
                <MultiSelect title="店铺" placeholder="搜索店铺名称..." options={shopOptions} selected={selectedShops} onChange={setSelectedShops} highlighted={debouncedSearch.length > 0} iconType="shop" />
                <MultiSelect title="产品" placeholder="搜索产品名称..." options={productOptions} selected={selectedProducts} onChange={setSelectedProducts} highlighted={debouncedSearch.length > 0} iconType="product" />
                {(selectedProducts.length > 0 || selectedShops.length > 0 || aggregateSearch.trim()) && <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 ml-1 shrink-0 transition-all duration-200 animate-fade-in-up" onClick={handleClearAll}><X className="h-3.5 w-3.5 mr-1" />清空筛选</Button>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(!dateRange || dailyData.length === 0) ? (dataLoading ? (
          <Card className="animate-fade-in-up"><CardContent className="py-16 space-y-4">
            <div className="mx-auto h-4 w-40 rounded-full bg-muted-foreground/15 animate-pulse" />
            <div className="mx-auto h-64 w-full max-w-3xl rounded-xl bg-muted-foreground/8 animate-pulse" style={{ animationDelay: '0.1s' }} />
          </CardContent></Card>
        ) : (
          <Card className="animate-fade-in-up"><CardContent className="flex items-center justify-center py-16 text-muted-foreground"><p className="text-sm">当前筛选条件下暂无数据</p></CardContent></Card>
        )) : (
        <>
          <Card className="card-hover-effect animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="pb-2"><CardTitle className="text-base font-bold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary animate-bounce-slow" />{timeMode === 'week' ? '当周每日趋势' : timeMode === 'month' ? '当月按周趋势' : timeMode === 'year' ? '当年按月趋势' : '自定义时段趋势'}{selectedProducts.length === 1 && <Badge variant="secondary" className="ml-2 text-xs animate-pop">{aliases[selectedProducts[0]]?.alias || selectedProducts[0]}</Badge>}{selectedShops.length === 1 && <Badge variant="secondary" className="ml-2 text-xs animate-pop">{selectedShops[0]}</Badge>}</CardTitle><CardDescription className="text-xs mt-1">{dateRange.start} ~ {dateRange.end} {timeMode === 'month' ? '按周汇总' : timeMode === 'year' ? '按月汇总' : '每日明细'}</CardDescription></CardHeader>
            <CardContent className="px-3"><div ref={overviewRef} className="w-full h-[340px]" /></CardContent>
          </Card>

          {topProducts.length > 0 && (
            <Card className="card-hover-effect animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader className="pb-2"><CardTitle className="text-base font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary animate-bounce-slow" />{selectedProducts.length > 0 ? `已选 ${selectedProducts.length} 产品趋势` : `Top ${topProducts.length} 产品趋势`}</CardTitle><CardDescription className="text-xs mt-1">基于当前聚合粒度的趋势变化</CardDescription></CardHeader>
              <CardContent className="px-3"><div ref={productTrendRef} className="w-full h-[380px]" /></CardContent>
            </Card>
          )}

          {topReasons.length > 0 && (
            <Card className="card-hover-effect animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <CardHeader className="pb-2"><CardTitle className="text-base font-bold flex items-center gap-2">异常归因变化 (Top {topReasons.length})</CardTitle><CardDescription className="text-xs mt-1">按当前粒度汇总的 Top 异常原因</CardDescription></CardHeader>
              <CardContent className="px-3"><div ref={reasonTrendRef} className="w-full h-[420px]" /></CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
