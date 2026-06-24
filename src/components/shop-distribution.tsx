'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { registerBrutalTheme, getBrutalTooltip, BRUTAL_COLORS } from '@/lib/echarts-theme';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Store, Search, X, Check, ChevronsUpDown, BarChart3, TrendingUp, CalendarDays } from 'lucide-react';
import type { AllRecords, ProductAliases } from '@/lib/types';
import { loadProductAliases } from '@/lib/storage';
import { apiComputeShopAggregation, apiComputeShopTrend, apiComputeShopAllShops, apiComputeShopFilteredProducts, apiComputeOptions } from '@/lib/api';

// Register brutalist theme
if (typeof window !== 'undefined') { registerBrutalTheme(echarts); }

const VIVID_COLORS = BRUTAL_COLORS;
const TOOLTIP_STYLE = getBrutalTooltip();
type ShopChartType = 'bar' | 'line';
type TimePeriod = 'day' | 'week' | 'month';
type ViewMode = 'distribution' | 'trend';
const CHART_OPTIONS: { value: ShopChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'bar', label: '柱状图', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { value: 'line', label: '折线图', icon: <TrendingUp className="h-3.5 w-3.5" /> },
];

/* ========== 日期范围工具函数（纯 UI 展示） ========== */
function getISOWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr);
  const monday = d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1);
  const mon = new Date(d); mon.setDate(monday);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
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

interface ShopDistributionProps { records: AllRecords; selectedDate: string | null; initialAliases?: ProductAliases; }

export function ShopDistribution({ records, selectedDate, initialAliases }: ShopDistributionProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const trendChartInstanceRef = useRef<echarts.ECharts | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('__ALL__');
  const [chartType, setChartType] = useState<ShopChartType>('bar');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [aliases, setAliases] = useState<ProductAliases>({});
  const [comboOpen, setComboOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');
  const [viewMode, setViewMode] = useState<ViewMode>('distribution');
  const [selectedFilterShops, setSelectedFilterShops] = useState<string[]>([]);
  const [shopComboOpen, setShopComboOpen] = useState(false);

  // API-computed states
  const [aggregatedData, setAggregatedData] = useState<{ shop: Record<string, number>; total: number; count: number } | null>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [allShops, setAllShops] = useState<{ name: string; count: number }[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [filteredProductNames, setFilteredProductNames] = useState<string[]>([]);
  const [allProductNames, setAllProductNames] = useState<string[]>([]);
  const [shopFilteredProducts, setShopFilteredProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setAliases(initialAliases || loadProductAliases()); }, [initialAliases]);

  // 日期范围
  const dateRange = useMemo(() => {
    if (!selectedDate) return { start: '', end: '' };
    switch (timePeriod) {
      case 'day': return { start: selectedDate, end: selectedDate };
      case 'week': return getISOWeekRange(selectedDate);
      case 'month': return getMonthRange(selectedDate);
      default: return { start: selectedDate, end: selectedDate };
    }
  }, [selectedDate, timePeriod]);

  const filteredDates = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    return Object.keys(records).sort().filter(d => d >= dateRange.start && d <= dateRange.end);
  }, [records, dateRange]);

  // Fetch product names from backend
  useEffect(() => {
    if (filteredDates.length === 0 || Object.keys(records).length === 0) return;
    let cancelled = false;
    (async () => {
      const result = await apiComputeOptions(records, dateRange.start, dateRange.end, [], [], aliases);
      if (!cancelled) {
        setAllProductNames(result.allProducts);
        setProductNames(result.allProducts);
        if (searchKeyword.trim()) setFilteredProductNames(result.allProducts.filter((n: string) => n.toLowerCase().includes(searchKeyword.trim().toLowerCase())));
        else setFilteredProductNames(result.allProducts);
      }
    })();
    return () => { cancelled = true; };
  }, [filteredDates, records, dateRange, searchKeyword, aliases]);

  // Search filter
  useEffect(() => {
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      setFilteredProductNames(allProductNames.filter(n => n.toLowerCase().includes(kw)));
    } else {
      setFilteredProductNames(allProductNames);
    }
  }, [searchKeyword, allProductNames]);

  const productsToAggregate = useMemo(() => {
    if (selectedProduct === '__ALL__') return productNames;
    return [selectedProduct];
  }, [selectedProduct, productNames]);

  const targetProducts = useMemo(() => {
    return searchKeyword.trim() ? filteredProductNames : productsToAggregate;
  }, [searchKeyword, filteredProductNames, productsToAggregate]);

  // Fetch shop aggregation from backend
  useEffect(() => {
    if (targetProducts.length === 0 || filteredDates.length === 0 || Object.keys(records).length === 0) { setAggregatedData(null); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await apiComputeShopAggregation(records, dateRange.start, dateRange.end, targetProducts);
        if (!cancelled) setAggregatedData(result);
      } catch (e) { if (!cancelled) setAggregatedData(null); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [targetProducts, filteredDates, records, dateRange]);

  // Fetch all shops
  useEffect(() => {
    if (filteredDates.length === 0 || productNames.length === 0) return;
    let cancelled = false;
    (async () => {
      const result = await apiComputeShopAllShops(records, dateRange.start, dateRange.end, productNames);
      if (!cancelled) setAllShops(result.allShops);
    })();
    return () => { cancelled = true; };
  }, [filteredDates, records, dateRange, productNames]);

  // Fetch shop filtered products
  useEffect(() => {
    if (filteredDates.length === 0 || productsToAggregate.length === 0) { setShopFilteredProducts(productsToAggregate); return; }
    let cancelled = false;
    (async () => {
      const result = await apiComputeShopFilteredProducts(records, dateRange.start, dateRange.end, productsToAggregate, selectedFilterShops);
      if (!cancelled) setShopFilteredProducts(result.products);
    })();
    return () => { cancelled = true; };
  }, [filteredDates, records, dateRange, productsToAggregate, selectedFilterShops]);

  // Fetch trend data from backend
  useEffect(() => {
    if (aggregatedData && filteredDates.length > 0 && targetProducts.length > 0) {
      let topShops: string[];
      if (selectedFilterShops.length > 0) {
        topShops = selectedFilterShops.map(name => ({ name, count: aggregatedData.shop[name] || 0 })).sort((a, b) => b.count - a.count).map(s => s.name);
      } else {
        topShops = Object.entries(aggregatedData.shop).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
      }
      const trendProducts = searchKeyword.trim() ? filteredProductNames : shopFilteredProducts;
      if (trendProducts.length > 0) {
        let cancelled = false;
        (async () => {
          const result = await apiComputeShopTrend(records, dateRange.start, dateRange.end, topShops, trendProducts);
          if (!cancelled) setTrendData(result.trendData);
        })();
        return () => { cancelled = true; };
      }
    }
  }, [aggregatedData, selectedFilterShops, filteredDates, records, dateRange, searchKeyword, filteredProductNames, shopFilteredProducts, targetProducts]);

  const displayShop = aggregatedData ? aggregatedData.shop : {};
  const chartData = useMemo(() =>
    Object.entries(displayShop).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    [displayShop]);

  const topShops = useMemo(() => {
    if (selectedFilterShops.length > 0) {
      return selectedFilterShops.map(name => ({ name, count: displayShop[name] || 0 })).sort((a, b) => b.count - a.count).map(s => s.name);
    }
    return chartData.slice(0, 8).map(d => d.name);
  }, [chartData, selectedFilterShops, displayShop]);

  // Distribution chart
  useEffect(() => {
    if (viewMode !== 'distribution' || !chartRef.current || chartData.length === 0) return;
    if (chartInstanceRef.current) { try { chartInstanceRef.current.dispose(); } catch {} chartInstanceRef.current = null; }
    const chart = echarts.init(chartRef.current, 'brutal');
    chartInstanceRef.current = chart;
    const sorted = [...chartData].sort((a, b) => b.value - a.value);
    const names = sorted.map(d => d.name);
    const values = sorted.map(d => d.value);
    const total = values.reduce((s, v) => s + v, 0);

    if (chartType === 'bar') {
      chartRef.current.style.height = `${Math.max(420, chartData.length > 10 ? 500 : 420)}px`;
      chart.setOption({
        tooltip: { ...TOOLTIP_STYLE, trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params: any) => `<b>${params[0].name}</b><br/>售后单数: <b>${params[0].value}</b><br/>占比: <b>${total > 0 ? ((params[0].value / total) * 100).toFixed(1) : '0'}%</b>` },
        animation: true, animationDuration: 500, animationEasing: 'cubicOut' as const, animationDelay: (idx: number) => idx * 50,
        grid: { left: '3%', right: '8%', bottom: chartData.length > 8 ? '16%' : '8%', top: '12%', containLabel: true },
        dataZoom: chartData.length > 8 ? [{ type: 'slider', xAxisIndex: 0, bottom: 8, height: 18, startValue: 0, endValue: 7, borderColor: 'transparent', backgroundColor: '#f1f5f9', fillerColor: 'rgba(16,185,129,0.15)', handleStyle: { color: '#14b8a6' }, textStyle: { fontSize: 10, color: '#94a3b8' } }, { type: 'inside', xAxisIndex: 0 }] : undefined,
        xAxis: { type: 'category', data: names, axisLabel: { color: '#475569', fontSize: 11, rotate: chartData.length > 6 ? 35 : 0, width: 80, overflow: 'truncate' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
        yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }, axisLine: { show: false } },
        series: [{ name: '售后单数', type: 'bar', barWidth: '50%', emphasis: { itemStyle: { shadowBlur: 14, shadowOffsetY: 3, shadowColor: 'rgba(0,0,0,0.15)' }, scale: true }, data: values.map((v, i) => ({ value: v, itemStyle: { color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [{ offset: 0, color: VIVID_COLORS[i % VIVID_COLORS.length] + '88' }, { offset: 1, color: VIVID_COLORS[i % VIVID_COLORS.length] }]), borderRadius: [4, 4, 0, 0] } })) }],
      }, true);
    } else {
      const pcts = values.map(v => total > 0 ? Math.round((v / total) * 100) : 0);
      chartRef.current.style.height = '440px';
      chart.setOption({
        tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' },
        legend: { top: 4, right: 10, textStyle: { fontSize: 11, color: '#64748b' }, itemWidth: 14, itemHeight: 8 },
        animation: true, animationDuration: 500, animationEasing: 'cubicOut' as const, animationDelay: (idx: number) => idx * 50,
        grid: { left: '3%', right: '8%', bottom: chartData.length > 8 ? '18%' : '8%', top: '14%', containLabel: true },
        dataZoom: chartData.length > 6 ? [
          { type: 'slider', xAxisIndex: 0, bottom: 6, height: 18, start: 0, end: Math.min(100, Math.round((8 / chartData.length) * 100)), borderColor: 'transparent', backgroundColor: '#f1f5f9', fillerColor: 'rgba(16,185,129,0.15)', handleStyle: { color: '#14b8a6' }, textStyle: { fontSize: 10, color: '#94a3b8' } },
          { type: 'inside', xAxisIndex: 0 },
        ] : undefined,
        xAxis: { type: 'category', data: names, axisLabel: { color: '#475569', fontSize: 11, rotate: chartData.length > 6 ? 35 : 0, width: 80, overflow: 'truncate' } },
        yAxis: [{ type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } } }, { type: 'value', min: 0, max: 100, axisLabel: { color: '#8b5cf6', fontSize: 11, formatter: (v: number) => `${Math.round(v)}%` }, splitLine: { show: false }, axisLine: { show: true, lineStyle: { color: '#c4b5fd' } } }],
        series: [{ name: '售后单数', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, lineStyle: { color: '#14b8a6' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(16,185,129,0.25)' }, { offset: 1, color: 'rgba(16,185,129,0.02)' }]) }, emphasis: { symbolSize: 12, lineStyle: { width: 4 } }, data: values }, { name: '占比', type: 'line', smooth: true, symbol: 'diamond', symbolSize: 6, yAxisIndex: 1, lineStyle: { color: '#8b5cf6' }, emphasis: { symbolSize: 10, lineStyle: { width: 3 } }, data: pcts }],
      }, true);
    }
    chart.resize();
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); try { chart.dispose(); } catch {} chartInstanceRef.current = null; };
  }, [chartData, chartType, viewMode]);

  // Trend chart
  useEffect(() => {
    if (viewMode !== 'trend' || !trendChartRef.current || trendData.length === 0 || topShops.length === 0) return;
    if (trendChartInstanceRef.current) { try { trendChartInstanceRef.current.dispose(); } catch {} trendChartInstanceRef.current = null; }
    const chart = echarts.init(trendChartRef.current, 'brutal');
    trendChartInstanceRef.current = chart;
    chart.setOption({
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' },
      legend: { type: 'scroll', bottom: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11, color: '#64748b' } },
      grid: { left: '3%', right: '4%', bottom: '16%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: trendData.map(d => d.label), axisLabel: { fontSize: 11, color: '#64748b', rotate: trendData.length > 10 ? 30 : 0 } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } } },
      series: topShops.map((shop, i) => { const c = VIVID_COLORS[i % VIVID_COLORS.length]; return { name: shop, type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, lineStyle: { width: 3, color: c }, data: trendData.map((d: any) => (d[shop] as number) || 0) }; }) as any,
    }, true);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); try { chart.dispose(); } catch {} trendChartInstanceRef.current = null; };
  }, [trendData, topShops, viewMode]);

  const periodLabel = useMemo(() => {
    switch (timePeriod) { case 'day': return '当日'; case 'week': return '当周'; case 'month': return '当月'; }
  }, [timePeriod]);

  if (productNames.length === 0) {
    return (<Card><CardContent className="flex items-center justify-center py-16 text-muted-foreground"><p className="text-sm">该时间段内暂无产品数据</p></CardContent></Card>);
  }

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-slide-up { animation: slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out both; }
        .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-scale-in { animation: scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-delay-1 { animation-delay: 0.05s; }
        .animate-delay-2 { animation-delay: 0.12s; }
        .animate-delay-3 { animation-delay: 0.19s; }
        .animate-delay-4 { animation-delay: 0.26s; }
        .animate-delay-5 { animation-delay: 0.33s; }
        @media (prefers-reduced-motion: reduce) {
          .animate-slide-up, .animate-fade-in, .animate-fade-in-up, .animate-scale-in { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
      <Card className="brutal-card-lift sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div><CardTitle className="text-base font-bold flex items-center gap-2"><Store className="h-4 w-4 text-primary" />店铺分布</CardTitle><CardDescription className="text-xs mt-1">按店铺查看红色旗子售后分布</CardDescription></div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg p-0.5">
                <Button variant={timePeriod === 'day' ? 'default' : 'ghost'} size="sm" onClick={() => setTimePeriod('day')} className="h-7 text-xs px-2.5">当日</Button>
                <Button variant={timePeriod === 'week' ? 'default' : 'ghost'} size="sm" onClick={() => setTimePeriod('week')} className="h-7 text-xs px-2.5"><CalendarDays className="h-3.5 w-3.5 mr-1" />当周</Button>
                <Button variant={timePeriod === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setTimePeriod('month')} className="h-7 text-xs px-2.5">当月</Button>
              </div>
              <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg p-0.5">
                <Button variant={viewMode === 'distribution' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('distribution')} className="h-7 text-xs px-2.5"><BarChart3 className="h-3.5 w-3.5 mr-1" />分布</Button>
                <Button variant={viewMode === 'trend' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('trend')} className="h-7 text-xs px-2.5"><TrendingUp className="h-3.5 w-3.5 mr-1" />趋势</Button>
              </div>
              <div className="relative w-[180px]"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="搜索产品聚合..." value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} className="!pl-9 h-8 text-xs" />{searchKeyword && <button onClick={() => setSearchKeyword('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>}</div>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild><Button variant="outline" className="w-[220px] h-8 justify-between text-xs font-medium border-primary/20 hover:border-primary/40 bg-primary/5"><span className="truncate">{selectedProduct === '__ALL__' ? '全部产品' : `${aliases[selectedProduct]?.alias || selectedProduct}`}</span><ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" /></Button></PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command><CommandInput placeholder="搜索产品..." className="h-8" /><CommandList className="max-h-[200px]"><CommandEmpty>未找到产品</CommandEmpty><CommandGroup>
                    <CommandItem value="__ALL__" onSelect={() => { setSelectedProduct('__ALL__'); setComboOpen(false); }} className="flex items-center gap-2 cursor-pointer"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedProduct === '__ALL__' ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="text-xs font-bold text-primary">全部产品</span></CommandItem>
                    {filteredProductNames.map(name => (<CommandItem key={name} value={name} onSelect={() => { setSelectedProduct(name); setComboOpen(false); }} className="flex items-center justify-between gap-2 cursor-pointer"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedProduct === name ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="truncate text-xs font-medium">{aliases[name]?.alias || name}</span></CommandItem>))}
                  </CommandGroup></CommandList></Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {aggregatedData && aggregatedData.count > 1 && (
            <div className="mt-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
              {searchKeyword.trim() ? `关键词「${searchKeyword}」匹配 ${aggregatedData.count} 个产品，${periodLabel}合计 ${aggregatedData.total} 单` : `${periodLabel}已聚合 ${aggregatedData.count} 个产品，合计 ${aggregatedData.total} 单 · ${filteredDates.length}天数据`}
            </div>
          )}
        </CardHeader>
      </Card>

      {viewMode === 'distribution' && (
        <Card className="brutal-card-lift border-primary/10 animate-fade-in-up animate-delay-2">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><Store className="h-4 w-4 text-primary" />店铺分布图<Badge className="ml-1 text-xs bg-primary/15 text-primary border-0">{periodLabel} · {filteredDates.length}天</Badge></CardTitle>
              <div className="flex gap-1">{CHART_OPTIONS.map(opt => <Button key={opt.value} variant={chartType === opt.value ? 'default' : 'outline'} size="sm" className={`h-7 px-3 gap-1.5 text-xs ${chartType === opt.value ? 'shadow-sm' : ''}`} onClick={() => setChartType(opt.value)}>{opt.icon}{opt.label}</Button>)}</div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">{chartData.length === 0 ? (<div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">{loading ? '计算中...' : '无店铺分布数据'}</div>) : (<div ref={chartRef} className="w-full" style={{ minHeight: '420px' }} />)}</CardContent>
        </Card>
      )}

      {viewMode === 'trend' && (
        <Card className="brutal-card-lift border-primary/10 animate-fade-in-up animate-delay-3">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div><CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />店铺趋势分布<Badge className="ml-1.5 text-xs bg-primary/15 text-primary border-0">{periodLabel} · Top {topShops.length} 店铺</Badge></CardTitle></div>
              <Popover open={shopComboOpen} onOpenChange={setShopComboOpen}>
                <PopoverTrigger asChild><Button variant="outline" className="h-7 text-xs gap-1.5 border-primary/20 hover:border-primary/40 bg-primary/5 max-w-[260px]"><Store className="h-3 w-3 text-primary shrink-0" /><span className="truncate">{selectedFilterShops.length === 0 ? '全部店铺' : `已选 ${selectedFilterShops.length} 家店铺`}</span><ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" /></Button></PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="end">
                  <Command><CommandInput placeholder="搜索店铺..." className="h-8" /><CommandList className="max-h-[240px]"><CommandEmpty>未找到店铺</CommandEmpty><CommandGroup>
                    <CommandItem value="__ALL__" onSelect={() => { setSelectedFilterShops([]); setShopComboOpen(false); }} className="flex items-center gap-2 cursor-pointer"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedFilterShops.length === 0 ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="text-xs font-bold text-primary">全部店铺</span></CommandItem>
                    {allShops.map(s => (<CommandItem key={s.name} value={s.name} onSelect={() => { setSelectedFilterShops(prev => prev.includes(s.name) ? prev.filter(x => x !== s.name) : [...prev, s.name]); }} className="flex items-center justify-between gap-2 cursor-pointer"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedFilterShops.includes(s.name) ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="truncate text-xs">{s.name}</span><Badge variant="secondary" className="text-[10px] shrink-0 px-1.5 py-0 tabular-nums">{s.count}单</Badge></CommandItem>))}
                  </CommandGroup></CommandList></Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="pt-4">{trendData.length === 0 || topShops.length === 0 ? (<div className="flex items-center justify-center h-[360px] text-muted-foreground text-sm">暂无趋势数据</div>) : (<div ref={trendChartRef} className="w-full h-[420px]" />)}</CardContent>
        </Card>
      )}
    </div>
  );
}
