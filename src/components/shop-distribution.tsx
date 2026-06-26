'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { registerBrutalTheme, getBrutalTooltip, BRUTAL_COLORS } from '@/lib/echarts-theme';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Store, Search, X, Check, ChevronsUpDown, BarChart3, TrendingUp } from 'lucide-react';
import type { AllRecords, ProductAliases } from '@/lib/types';
import { loadProductAliases } from '@/lib/storage';
import { apiComputeShopAggregation, apiComputeShopTrend, apiComputeShopAllShops, apiComputeShopFilteredProducts, apiComputeOptions } from '@/lib/api';

if (typeof window !== 'undefined') { registerBrutalTheme(echarts); }

const VIVID_COLORS = BRUTAL_COLORS;
const TOOLTIP_STYLE = getBrutalTooltip();
type ShopChartType = 'bar' | 'line';
type TimePeriod = 'day' | 'week' | 'month' | 'custom';
type ViewMode = 'distribution' | 'trend';
const CHART_OPTIONS: { value: ShopChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'bar', label: '柱状图', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { value: 'line', label: '折线图', icon: <TrendingUp className="h-3.5 w-3.5" /> },
];

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

function AnimatedValue({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef(0);
  useEffect(() => {
    if (value === prevRef.current) return;
    const start = prevRef.current; const diff = value - start; const duration = 500; const st = performance.now();
    const anim = (now: number) => { const t = Math.min((now - st) / duration, 1); setDisplay(Math.round(start + diff * (1 - Math.pow(1 - t, 4)))); if (t < 1) rafRef.current = requestAnimationFrame(anim); };
    rafRef.current = requestAnimationFrame(anim); prevRef.current = value;
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);
  return <span className={className}>{display.toLocaleString()}</span>;
}

interface ShopDistributionProps { records: AllRecords; selectedDate: string | null; initialAliases?: ProductAliases; }

export function ShopDistribution({ records, selectedDate, initialAliases }: ShopDistributionProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const trendChartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [selectedProduct, setSelectedProduct] = useState('__ALL__');
  const [chartType, setChartType] = useState<ShopChartType>('bar');
  const [chartTransitioning, setChartTransitioning] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [aliases, setAliases] = useState<ProductAliases>({});
  const [comboOpen, setComboOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Auto-init custom dates
  useEffect(() => {
    if (timePeriod === 'custom' && selectedDate) {
      const d = new Date(selectedDate);
      const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
      const mon = new Date(d); mon.setDate(d.getDate() + diff);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
      setCustomStart(fmt(mon)); setCustomEnd(fmt(sun));
    }
  }, [timePeriod, selectedDate]);
  const [viewMode, setViewMode] = useState<ViewMode>('distribution');
  const [selectedFilterShops, setSelectedFilterShops] = useState<string[]>([]);
  const [shopComboOpen, setShopComboOpen] = useState(false);
  const [flagType, setFlagType] = useState('红色旗子');

  const [aggregatedData, setAggregatedData] = useState<{ shop: Record<string, number>; total: number; count: number } | null>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [allShops, setAllShops] = useState<{ name: string; count: number }[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [filteredProductNames, setFilteredProductNames] = useState<string[]>([]);
  const [allProductNames, setAllProductNames] = useState<string[]>([]);
  const [shopFilteredProducts, setShopFilteredProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setAliases(initialAliases || loadProductAliases()); }, [initialAliases]);

  const dateRange = useMemo(() => {
    if (!selectedDate) return { start: '', end: '' };
    switch (timePeriod) { case 'day': return { start: selectedDate, end: selectedDate }; case 'week': return getISOWeekRange(selectedDate); case 'month': return getMonthRange(selectedDate); case 'custom': return customStart && customEnd ? { start: customStart, end: customEnd } : { start: '', end: '' }; default: return { start: selectedDate, end: selectedDate }; }
  }, [selectedDate, timePeriod, customStart, customEnd]);

  const filteredDates = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    return Object.keys(records).sort().filter(d => d >= dateRange.start && d <= dateRange.end);
  }, [records, dateRange]);

  useEffect(() => {
    if (filteredDates.length === 0 || Object.keys(records).length === 0) return;
    let c = false; (async () => { const r = await apiComputeOptions(records, dateRange.start, dateRange.end, [], [], aliases); if (!c) { setAllProductNames(r.allProducts); setProductNames(r.allProducts); if (searchKeyword.trim()) setFilteredProductNames(r.allProducts.filter((n: string) => n.toLowerCase().includes(searchKeyword.trim().toLowerCase()))); else setFilteredProductNames(r.allProducts); } })();
    return () => { c = true; };
  }, [filteredDates, records, dateRange, searchKeyword, aliases]);

  useEffect(() => { if (searchKeyword.trim()) { const kw = searchKeyword.trim().toLowerCase(); setFilteredProductNames(allProductNames.filter(n => n.toLowerCase().includes(kw))); } else setFilteredProductNames(allProductNames); }, [searchKeyword, allProductNames]);

  const productsToAggregate = useMemo(() => selectedProduct === '__ALL__' ? productNames : [selectedProduct], [selectedProduct, productNames]);
  const targetProducts = useMemo(() => searchKeyword.trim() ? filteredProductNames : productsToAggregate, [searchKeyword, filteredProductNames, productsToAggregate]);

  useEffect(() => {
    if (targetProducts.length === 0 || filteredDates.length === 0 || Object.keys(records).length === 0) { setAggregatedData(null); return; }
    let c = false; setLoading(true);
    if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) chartInstanceRef.current.showLoading({ text: '', color: '#14b8a6', maskColor: 'rgba(255,255,255,0.6)' });
    (async () => { try { const r = await apiComputeShopAggregation(records, dateRange.start, dateRange.end, targetProducts, flagType); if (!c) setAggregatedData(r); } catch (e) { if (!c) setAggregatedData(null); } finally { if (!c) { setLoading(false); if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) chartInstanceRef.current.hideLoading(); } } })();
    return () => { c = true; };
  }, [targetProducts, filteredDates, records, dateRange, flagType]);

  useEffect(() => {
    if (filteredDates.length === 0 || productNames.length === 0) return;
    let c = false; (async () => { const r = await apiComputeShopAllShops(records, dateRange.start, dateRange.end, productNames); if (!c) setAllShops(r.allShops); })();
    return () => { c = true; };
  }, [filteredDates, records, dateRange, productNames]);

  useEffect(() => {
    if (filteredDates.length === 0 || productsToAggregate.length === 0) { setShopFilteredProducts(productsToAggregate); return; }
    let c = false; (async () => { const r = await apiComputeShopFilteredProducts(records, dateRange.start, dateRange.end, productsToAggregate, selectedFilterShops); if (!c) setShopFilteredProducts(r.products); })();
    return () => { c = true; };
  }, [filteredDates, records, dateRange, productsToAggregate, selectedFilterShops]);

  useEffect(() => {
    if (aggregatedData && filteredDates.length > 0 && targetProducts.length > 0) {
      let tops: string[]; if (selectedFilterShops.length > 0) tops = selectedFilterShops.map(n => ({ name: n, count: aggregatedData.shop[n] || 0 })).sort((a, b) => b.count - a.count).map(s => s.name);
      else tops = Object.entries(aggregatedData.shop).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
      const tp = searchKeyword.trim() ? filteredProductNames : shopFilteredProducts;
      if (tp.length > 0) { let c = false; (async () => { const r = await apiComputeShopTrend(records, dateRange.start, dateRange.end, tops, tp, flagType); if (!c) setTrendData(r.trendData); })(); return () => { c = true; }; }
    }
  }, [aggregatedData, selectedFilterShops, filteredDates, records, dateRange, searchKeyword, filteredProductNames, shopFilteredProducts, targetProducts, flagType]);

  const displayShop = aggregatedData ? aggregatedData.shop : {};
  const chartData = useMemo(() => Object.entries(displayShop).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value), [displayShop]);
  const totalValue = useMemo(() => chartData.reduce((s, d) => s + d.value, 0), [chartData]);

  const topShops = useMemo(() => {
    if (selectedFilterShops.length > 0) return selectedFilterShops.map(n => ({ name: n, count: displayShop[n] || 0 })).sort((a, b) => b.count - a.count).map(s => s.name);
    return chartData.slice(0, 8).map(d => d.name);
  }, [chartData, selectedFilterShops, displayShop]);

  // Distribution chart — smooth update without re-init
  useEffect(() => {
    if (viewMode !== 'distribution' || !chartRef.current || chartData.length === 0) return;
    const needsReinit = !chartInstanceRef.current || chartInstanceRef.current.isDisposed();

    if (!needsReinit) {
      const sorted = [...chartData].sort((a, b) => b.value - a.value);
      const names = sorted.map(d => d.name);
      const values = sorted.map(d => d.value);
      const total = values.reduce((s, v) => s + v, 0);

      if (chartType === 'bar') {
        chartInstanceRef.current?.setOption({
          animation: true, animationDuration: 600, animationEasing: 'cubicInOut' as const,
          xAxis: { data: names }, series: [{ data: values.map((v, i) => ({ value: v, itemStyle: { color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [{ offset: 0, color: VIVID_COLORS[i % VIVID_COLORS.length] + '88' }, { offset: 1, color: VIVID_COLORS[i % VIVID_COLORS.length] }]), borderRadius: [4, 4, 0, 0] } })) }]
        }, false);
      } else {
        const pcts = values.map(v => total > 0 ? Math.round((v / total) * 100) : 0);
        chartInstanceRef.current?.setOption({
          animation: true, animationDuration: 600, animationEasing: 'cubicInOut' as const,
          xAxis: { data: names }, series: [{ data: values }, { data: pcts }]
        }, false);
      }
      return;
    }

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
        tooltip: { ...TOOLTIP_STYLE, trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: any) => `<b>${p[0].name}</b><br/>售后单数: <b>${p[0].value}</b><br/>占比: <b>${total > 0 ? ((p[0].value / total) * 100).toFixed(1) : '0'}%</b>` },
        animation: true, animationDuration: 600, animationEasing: 'cubicInOut' as const, animationDelay: (idx: number) => idx * 50,
        grid: { left: '3%', right: '8%', bottom: chartData.length > 8 ? '16%' : '8%', top: '12%', containLabel: true },
        dataZoom: chartData.length > 8 ? [{ type: 'slider', xAxisIndex: 0, bottom: 8, height: 18, startValue: 0, endValue: 7, borderColor: 'transparent', backgroundColor: '#f1f5f9', fillerColor: 'rgba(16,185,129,0.15)', handleStyle: { color: '#14b8a6' }, textStyle: { fontSize: 10, color: '#94a3b8' } }, { type: 'inside' }] : undefined,
        xAxis: { type: 'category', data: names, axisLabel: { color: '#475569', fontSize: 11, rotate: chartData.length > 6 ? 35 : 0, width: 80, overflow: 'truncate' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
        yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } } },
        series: [{ name: '售后单数', type: 'bar', barWidth: '50%', emphasis: { itemStyle: { shadowBlur: 14, shadowOffsetY: 3, shadowColor: 'rgba(0,0,0,0.15)' }, scale: true }, data: values.map((v, i) => ({ value: v, itemStyle: { color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [{ offset: 0, color: VIVID_COLORS[i % VIVID_COLORS.length] + '88' }, { offset: 1, color: VIVID_COLORS[i % VIVID_COLORS.length] }]), borderRadius: [4, 4, 0, 0] } })) }],
      }, true);
    } else {
      const pcts = values.map(v => total > 0 ? Math.round((v / total) * 100) : 0);
      chartRef.current.style.height = '440px';
      chart.setOption({
        tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' }, legend: { top: 4, right: 10, textStyle: { fontSize: 11, color: '#64748b' }, itemWidth: 14, itemHeight: 8 },
        animation: true, animationDuration: 600, animationEasing: 'cubicInOut' as const, animationDelay: (idx: number) => idx * 50,
        grid: { left: '3%', right: '8%', bottom: chartData.length > 8 ? '18%' : '8%', top: '14%', containLabel: true },
        dataZoom: chartData.length > 6 ? [{ type: 'slider', xAxisIndex: 0, bottom: 6, height: 18, start: 0, end: Math.min(100, Math.round((8 / chartData.length) * 100)), borderColor: 'transparent', backgroundColor: '#f1f5f9', fillerColor: 'rgba(16,185,129,0.15)', handleStyle: { color: '#14b8a6' }, textStyle: { fontSize: 10, color: '#94a3b8' } }, { type: 'inside' }] : undefined,
        xAxis: { type: 'category', data: names, axisLabel: { color: '#475569', fontSize: 11, rotate: chartData.length > 6 ? 35 : 0, width: 80, overflow: 'truncate' } },
        yAxis: [{ type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } } }, { type: 'value', min: 0, max: 100, axisLabel: { color: '#8b5cf6', fontSize: 11, formatter: (v: number) => `${Math.round(v)}%` }, splitLine: { show: false }, axisLine: { show: true, lineStyle: { color: '#c4b5fd' } } }],
        series: [{ name: '售后单数', type: 'line', smooth: true, symbolSize: 7, lineStyle: { color: '#14b8a6' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(16,185,129,0.25)' }, { offset: 1, color: 'rgba(16,185,129,0.02)' }]) }, emphasis: { symbolSize: 12, lineStyle: { width: 4 } }, data: values }, { name: '占比', type: 'line', smooth: true, symbol: 'diamond', symbolSize: 6, yAxisIndex: 1, lineStyle: { color: '#8b5cf6' }, emphasis: { symbolSize: 10, lineStyle: { width: 3 } }, data: pcts }],
      }, true);
    }
    chart.resize();
    const h = () => chart.resize(); window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); };
  }, [chartData, chartType, viewMode]);

  // Trend chart — smooth update
  useEffect(() => {
    if (viewMode !== 'trend' || !trendChartRef.current || trendData.length === 0 || topShops.length === 0) return;
    const needsReinit = !trendChartInstanceRef.current || trendChartInstanceRef.current.isDisposed();
    if (!needsReinit) {
      trendChartInstanceRef.current?.setOption({
        animation: true, animationDuration: 600, animationEasing: 'cubicInOut' as const,
        xAxis: { data: trendData.map(d => d.label) },
        series: topShops.map((s, i) => { const c = VIVID_COLORS[i % VIVID_COLORS.length]; return { name: s, data: trendData.map((d: any) => (d[s] as number) || 0) }; }),
      }, false);
      return;
    }
    if (trendChartInstanceRef.current) { try { trendChartInstanceRef.current.dispose(); } catch {} trendChartInstanceRef.current = null; }
    const chart = echarts.init(trendChartRef.current, 'brutal'); trendChartInstanceRef.current = chart;
    chart.setOption({
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' }, legend: { type: 'scroll', bottom: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11, color: '#64748b' } },
      animation: true, animationDuration: 800, animationEasing: 'sinusoidalInOut' as const, animationDelay: (idx: number) => idx * 80,
      grid: { left: '3%', right: '4%', bottom: '16%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: trendData.map(d => d.label), axisLabel: { fontSize: 11, color: '#64748b', rotate: trendData.length > 10 ? 30 : 0 } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } } },
      series: topShops.map((s, i) => { const c = VIVID_COLORS[i % VIVID_COLORS.length]; return { name: s, type: 'line', smooth: true, symbolSize: 7, lineStyle: { width: 3, color: c }, emphasis: { symbolSize: 10, lineStyle: { width: 5 } }, data: trendData.map((d: any) => (d[s] as number) || 0) }; }) as any,
    }, true);
    const h = () => chart.resize(); window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); };
  }, [trendData, topShops, viewMode]);

  // Cleanup on unmount
  useEffect(() => () => {
    [chartInstanceRef, trendChartInstanceRef].forEach(r => { if (r.current) try { r.current.dispose(); } catch {} r.current = null; });
  }, []);

  const periodLabel = useMemo(() => { switch (timePeriod) { case 'day': return '当日'; case 'week': return '当周'; case 'month': return '当月'; case 'custom': return `${customStart || '?'} ~ ${customEnd || '?'}`; } }, [timePeriod, customStart, customEnd]);

  if (productNames.length === 0) return (<Card><CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 animate-fade-in"><Store className="h-10 w-10 opacity-20" /><p className="text-sm">该时间段内暂无产品数据</p></CardContent></Card>);

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes chartReveal { from { opacity: 0; transform: translateY(24px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out both; }
        .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-scale-in { animation: scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-chart-reveal { animation: chartReveal 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.8s infinite; border-radius: 8px; }
        .skeleton-chart { height: 420px; margin-top: 16px; }
        .tab-btn { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
        .tab-btn:active { transform: scale(0.95); }
        .tab-btn-active { background: linear-gradient(135deg, #14b8a6, #059669); background-size: 200% 200%; animation: gradientShift 3s ease infinite; color: #fff; }
        .chart-container { transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1); }
        .chart-fading { opacity: 0.15; pointer-events: none; }
        .pulse-on-update { transition: all 0.3s ease; }
        .animate-delay-1 { animation-delay: 0.05s; }
        .animate-delay-2 { animation-delay: 0.12s; }
        .animate-delay-3 { animation-delay: 0.19s; }
        .animate-delay-4 { animation-delay: 0.26s; }
        .animate-delay-5 { animation-delay: 0.33s; }
        @media (prefers-reduced-motion: reduce) { .animate-fade-in,.animate-fade-in-up,.animate-scale-in,.animate-chart-reveal { animation: none; opacity: 1; transform: none; } .skeleton { animation: none; background: #f1f5f9; } }
      `}</style>

      <Card className="brutal-card-lift sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-primary/10">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 whitespace-nowrap"><Store className="h-4 w-4 text-primary shrink-0" />店铺分布</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0 bg-muted/60 rounded-lg p-0.5 text-xs shrink-0">
                {(['day', 'week', 'month', 'custom'] as TimePeriod[]).map((p, i) => (
                  <span key={p}>
                    {i > 0 && <span className="text-muted-foreground/40 px-1">/</span>}
                    <button onClick={() => setTimePeriod(p)} className={`tab-btn px-1.5 py-1 rounded-md ${timePeriod === p ? 'tab-btn-active font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{p === 'day' ? '当日' : p === 'week' ? '当周' : p === 'month' ? '当月' : '自定义'}</button>
                  </span>
                ))}
              </div>
              {timePeriod === 'custom' && (
                <div className="flex items-center gap-1 animate-fade-in shrink-0">
                  <Input type="date" value={customStart || (selectedDate || '')} onChange={e => setCustomStart(e.target.value)} className="h-7 text-xs w-[130px] font-mono px-1.5" />
                  <span className="text-xs text-muted-foreground">~</span>
                  <Input type="date" value={customEnd || (selectedDate || '')} onChange={e => setCustomEnd(e.target.value)} className="h-7 text-xs w-[130px] font-mono px-1.5" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5">
                <Button variant={viewMode === 'distribution' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('distribution')} className="h-7 text-xs px-2"><BarChart3 className="h-3.5 w-3.5 mr-1" />分布</Button>
                <Button variant={viewMode === 'trend' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('trend')} className="h-7 text-xs px-2"><TrendingUp className="h-3.5 w-3.5 mr-1" />趋势</Button>
              </div>
              <div className="relative w-[130px]"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="搜索..." value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} className="!pl-7 h-7 text-xs" />{searchKeyword && <button onClick={() => setSearchKeyword('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>}</div>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild><Button variant="outline" className="w-[180px] h-7 justify-between text-xs font-medium border-primary/20 hover:border-primary/40 bg-primary/5"><span className="truncate">{selectedProduct === '__ALL__' ? '全部产品' : aliases[selectedProduct]?.alias || selectedProduct}</span><ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" /></Button></PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command><CommandInput placeholder="搜索产品..." className="h-8" /><CommandList className="max-h-[200px]"><CommandEmpty>未找到产品</CommandEmpty><CommandGroup>
                    <CommandItem value="__ALL__" onSelect={() => { setSelectedProduct('__ALL__'); setComboOpen(false); }} className="flex items-center gap-2 cursor-pointer"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedProduct === '__ALL__' ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="text-xs font-bold text-primary">全部产品</span></CommandItem>
                    {filteredProductNames.map(n => (<CommandItem key={n} value={n} onSelect={() => { setSelectedProduct(n); setComboOpen(false); }} className="flex items-center justify-between gap-2 cursor-pointer"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedProduct === n ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="truncate text-xs font-medium">{aliases[n]?.alias || n}</span></CommandItem>))}
                  </CommandGroup></CommandList></Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {aggregatedData && aggregatedData.count > 1 && (
            <div className="mt-2 px-3 py-1.5 rounded-md bg-gradient-to-r from-primary/15 to-emerald-500/10 text-primary text-xs font-medium border border-primary/20">
              {searchKeyword.trim() ? <>关键词「{searchKeyword}」匹配 {aggregatedData.count} 个产品，{periodLabel}合计 {aggregatedData.total} 单</> : <>{periodLabel}已聚合 {aggregatedData.count} 个产品，合计 {aggregatedData.total} 单 · {filteredDates.length}天数据</>}
            </div>
          )}
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {loading ? (
          <>{[0, 1, 2].map(i => (<div key={i} className="rounded-xl border border-border/30 p-4 shadow-sm"><div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 8 }} /><div className="skeleton" style={{ height: 28, width: '40%', marginTop: 12 }} /></div>))}</>
        ) : (
          <>
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4 shadow-sm hover:shadow-md transition-all duration-300 pulse-on-update animate-fade-in-up animate-delay-1"><div className="text-[11px] text-muted-foreground mb-1.5">覆盖店铺</div><AnimatedValue value={chartData.length} className="text-2xl font-black text-primary tabular-nums" /></div>
            <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4 shadow-sm hover:shadow-md transition-all duration-300 pulse-on-update animate-fade-in-up animate-delay-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] text-muted-foreground">售后总数</span>
                <select
                  value={flagType}
                  onChange={e => setFlagType(e.target.value)}
                  className="text-[10px] px-1.5 py-0 h-4 rounded-sm font-medium cursor-pointer outline-none"
                  style={flagType === '总数' ? { borderColor: '#94a3b8', color: '#475569', backgroundColor: '#f8fafc' }
                    : flagType === '红色旗子' ? { borderColor: '#fca5a5', color: '#dc2626', backgroundColor: '#fef2f2' }
                    : flagType === '绿色旗子' ? { borderColor: '#86efac', color: '#16a34a', backgroundColor: '#f0fdf4' }
                    : { borderColor: '#d1d5db', color: '#6b7280', backgroundColor: '#f9fafb' }}
                >
                  <option value="红色旗子">红旗</option>
                  <option value="绿色旗子">绿旗</option>
                  <option value="灰色旗子">灰旗</option>
                  <option value="总数">总数</option>
                </select>
              </div>
              <AnimatedValue value={aggregatedData?.total || 0} className="text-2xl font-black text-emerald-600 tabular-nums" /></div>
            <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 shadow-sm hover:shadow-md transition-all duration-300 pulse-on-update animate-fade-in-up animate-delay-3"><div className="text-[11px] text-muted-foreground mb-1.5">Top 店铺</div><span className="text-2xl font-black text-amber-600 tabular-nums line-clamp-1 text-sm" title={topShops[0]}>{topShops[0] || '-'}</span></div>
          </>
        )}
      </div>

      {viewMode === 'distribution' && (
        <Card className="brutal-card-lift border-primary/10 animate-chart-reveal animate-delay-3">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><Store className="h-4 w-4 text-primary" />店铺分布图<Badge className="ml-1 text-xs bg-primary/15 text-primary border-0">{periodLabel} · {filteredDates.length}天</Badge></CardTitle>
              <div className="flex gap-1">{CHART_OPTIONS.map(opt => (<Button key={opt.value} variant={chartType === opt.value ? 'default' : 'outline'} size="sm" className={`h-7 px-3 gap-1.5 text-xs transition-all duration-200 ${chartType === opt.value ? 'shadow-sm' : ''}`} onClick={() => { if (chartType !== opt.value) { setChartTransitioning(true); setTimeout(() => { setChartType(opt.value); setTimeout(() => setChartTransitioning(false), 50); }, 200); } }}>{opt.icon}{opt.label}</Button>))}</div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="skeleton skeleton-chart" style={{ borderRadius: 12 }} />
            ) : chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-3 animate-fade-in"><Store className="h-10 w-10 opacity-20" /><p className="text-sm">无店铺分布数据</p></div>
            ) : (
              <div ref={chartRef} className={`w-full chart-container ${chartTransitioning ? 'chart-fading' : ''}`} style={{ minHeight: chartType === 'line' ? '440px' : '420px' }} />
            )}
          </CardContent>
        </Card>
      )}

      {viewMode === 'trend' && (
        <Card className="brutal-card-lift border-primary/10 animate-chart-reveal animate-delay-3">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div><CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />店铺趋势分布<Badge className="ml-1.5 text-xs bg-primary/15 text-primary border-0">{periodLabel} · Top {topShops.length} 店铺</Badge></CardTitle></div>
              <Popover open={shopComboOpen} onOpenChange={setShopComboOpen}>
                <PopoverTrigger asChild><Button variant="outline" className="h-7 text-xs gap-1.5 border-primary/20 hover:border-primary/40 bg-primary/5 max-w-[260px]"><Store className="h-3 w-3 text-primary shrink-0" /><span className="truncate">{selectedFilterShops.length === 0 ? '全部店铺' : `已选 ${selectedFilterShops.length} 家店铺`}</span><ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" /></Button></PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="end">
                  <Command><CommandInput placeholder="搜索店铺..." className="h-8" /><CommandList className="max-h-[240px]"><CommandEmpty>未找到店铺</CommandEmpty><CommandGroup>
                    <CommandItem value="__ALL__" onSelect={() => { setSelectedFilterShops([]); setShopComboOpen(false); }} className="flex items-center gap-2 cursor-pointer"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedFilterShops.length === 0 ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="text-xs font-bold text-primary">全部店铺</span></CommandItem>
                    {allShops.map(s => (<CommandItem key={s.name} value={s.name} onSelect={() => { setSelectedFilterShops(p => p.includes(s.name) ? p.filter(x => x !== s.name) : [...p, s.name]); }} className="flex items-center justify-between gap-2 cursor-pointer"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedFilterShops.includes(s.name) ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="truncate text-xs">{s.name}</span><Badge variant="secondary" className="text-[10px] shrink-0 px-1.5 py-0 tabular-nums">{s.count}单</Badge></CommandItem>))}
                  </CommandGroup></CommandList></Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="pt-4">{trendData.length === 0 || topShops.length === 0 ? (<div className="flex flex-col items-center justify-center h-[360px] text-muted-foreground gap-3 animate-fade-in"><TrendingUp className="h-10 w-10 opacity-20" /><p className="text-sm">暂无趋势数据</p></div>) : (<div ref={trendChartRef} className="w-full h-[420px]" />)}</CardContent>
        </Card>
      )}
    </div>
  );
}
