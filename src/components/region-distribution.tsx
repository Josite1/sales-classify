'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { registerBrutalTheme, getBrutalTooltip, getBrutalGrid, getBrutalXAxis, getBrutalYAxis, BRUTAL_COLORS } from '@/lib/echarts-theme';
import * as echarts from 'echarts';
import chinaGeoJson from 'echarts-china-map/lib/china.json';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { MapPin, Search, X, Check, ChevronsUpDown, Map as MapIcon, BarChart3, TrendingUp } from 'lucide-react';

// Smooth animated number counter (lightweight, no external deps)
function AnimatedValue({ value, className, suffix = '' }: { value: number; className?: string; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    if (value === prevRef.current) return;
    const start = prevRef.current;
    const diff = value - start;
    const duration = 500;
    const startTime = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      // Spring-like easing: 1 - (1-t)^4
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(Math.round(start + diff * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    prevRef.current = value;
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <span className={className}>{display.toLocaleString()}{suffix}</span>;
}
import type { AllRecords, ProductAliases, RegionItem } from '@/lib/types';
import { loadProductAliases } from '@/lib/storage';
import { apiComputeRegionAggregation, apiComputeRegionTrend, apiComputeOptions } from '@/lib/api';

// Register brutalist theme
if (typeof window !== 'undefined') { registerBrutalTheme(echarts); }

const TOOLTIP_STYLE = getBrutalTooltip();
type RegionChartType = 'map' | 'groupedBar';
type TimePeriod = 'day' | 'week' | 'month' | 'custom';
type ViewMode = 'distribution' | 'trend';
const CHART_OPTIONS: { value: RegionChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'map', label: '地图', icon: <MapIcon className="h-3.5 w-3.5" /> },
  { value: 'groupedBar', label: '柱状图', icon: <BarChart3 className="h-3.5 w-3.5" /> },
];
const VIVID_COLORS = BRUTAL_COLORS;

// 省份名映射（纯 UI 展示逻辑）
function normalizeProvinceName(name: string): string {
  return name.replace(/省$/, '').replace(/市$/, '').replace(/壮族自治区$/, '').replace(/回族自治区$/, '').replace(/维吾尔自治区$/, '').replace(/自治区$/, '').replace(/特别行政区$/, '');
}

interface ProvinceInfo { fullName: string; normalizedName: string; cp: [number, number]; }
const provinceInfoList: ProvinceInfo[] = ((chinaGeoJson as any).features).map((f: any) => ({ fullName: f.properties.name, normalizedName: normalizeProvinceName(f.properties.name), cp: [f.properties.cp[0], f.properties.cp[1]] as [number, number] }));
const normalizedToInfo: Record<string, ProvinceInfo> = {};
for (const info of provinceInfoList) { normalizedToInfo[info.normalizedName] = info; }

function mapProvinceName(userProvince: string): string {
  if (normalizedToInfo[userProvince]) return normalizedToInfo[userProvince].fullName;
  const norm = normalizeProvinceName(userProvince);
  if (normalizedToInfo[norm]) return normalizedToInfo[norm].fullName;
  for (const [, info] of Object.entries(normalizedToInfo)) {
    if (info.normalizedName.includes(norm) || norm.includes(info.normalizedName)) return info.fullName;
  }
  return userProvince;
}

let mapRegistered = false;
function registerChinaMap() { if (!mapRegistered) { echarts.registerMap('china', chinaGeoJson as any); mapRegistered = true; } }

/* ========== 日期范围工具函数（纯 UI） ========== */
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

function buildTooltipHtml(name: string, total: number, townVillage: number): string {
  const tvRatio = total > 0 ? ((townVillage / total) * 100).toFixed(1) : '0.0';
  return `<div style="min-width:200px"><b style="font-size:14px">${name}</b><div style="margin-top:6px;font-size:13px"><span style="color:#64748b">售后总数：</span><b style="color:#10b981;font-size:15px">${total}</b> 单</div><div style="margin-top:4px;font-size:12px"><span style="color:#64748b">乡镇：</span><b style="color:#f59e0b">${townVillage}</b> 单 (${tvRatio}%)</div></div>`;
}

interface RegionDistributionProps { records: AllRecords; selectedDate: string | null; initialAliases?: ProductAliases; }

export function RegionDistribution({ records, selectedDate, initialAliases }: RegionDistributionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const trendChartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('__ALL__');
  const [chartType, setChartType] = useState<RegionChartType>('map');
  const [chartTransitioning, setChartTransitioning] = useState(false);
  const [flagType, setFlagType] = useState('红色旗子');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [aliases, setAliases] = useState<ProductAliases>({});
  const [comboOpen, setComboOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Auto-initialize custom dates when switching to custom mode
  useEffect(() => {
    if (timePeriod === 'custom' && selectedDate) {
      const d = new Date(selectedDate);
      // Default to the selected date's week range
      const day = d.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(d); monday.setDate(d.getDate() + diffToMonday);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
      setCustomStart(fmt(monday));
      setCustomEnd(fmt(sunday));
    }
  }, [timePeriod, selectedDate]);
  const [viewMode, setViewMode] = useState<ViewMode>('distribution');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [regionComboOpen, setRegionComboOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<{ name: string; total: number; townVillage: number } | null>(null);
  const [chartContainerWidth, setChartContainerWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // API-computed states
  const [aggregatedData, setAggregatedData] = useState<{ region: Record<string, { count: number; town_village: number }>; total: number; count: number } | null>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [filteredProductNames, setFilteredProductNames] = useState<string[]>([]);
  const [allProductNames, setAllProductNames] = useState<string[]>([]);

  useEffect(() => { setAliases(initialAliases || loadProductAliases()); }, [initialAliases]);

  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setIsVisible(true); requestAnimationFrame(() => { [chartInstanceRef, trendChartInstanceRef].forEach(ref => { if (ref.current && !ref.current.isDisposed()) ref.current.resize(); }); }); } else { setIsVisible(false); }
    }, { threshold: 0.01 });
    observer.observe(container); return () => observer.disconnect();
  }, []);

  // 柱状图左右拖拽缩放
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = chartContainerWidth ?? (chartRef.current?.offsetWidth ?? 800);
  }, [chartContainerWidth]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartX.current;
      const newWidth = Math.max(480, Math.min(window.innerWidth - 40, resizeStartWidth.current + dx));
      setChartContainerWidth(newWidth);
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        requestAnimationFrame(() => chartInstanceRef.current?.resize());
      }
    };
    const handleMouseUp = () => { setIsResizing(false); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // 日期范围
  const dateRange = useMemo(() => {
    if (!selectedDate) return { start: '', end: '' };
    switch (timePeriod) {
      case 'day': return { start: selectedDate, end: selectedDate };
      case 'week': return getISOWeekRange(selectedDate);
      case 'month': return getMonthRange(selectedDate);
      case 'custom': return customStart && customEnd ? { start: customStart, end: customEnd } : { start: '', end: '' };
    }
  }, [selectedDate, timePeriod, customStart, customEnd]);

  const filteredRecords = useMemo((): AllRecords => {
    if (!dateRange.start || !dateRange.end) return records;
    const f: AllRecords = {};
    for (const [d, r] of Object.entries(records)) {
      if (d >= dateRange.start && d <= dateRange.end) f[d] = r;
    }
    return f;
  }, [records, dateRange]);

  const regionCacheRef = useRef<Map<string, any>>(new Map());
  useEffect(() => { regionCacheRef.current.clear(); }, [records]);

  const filteredDates = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    return Object.keys(records).sort().filter(d => d >= dateRange.start && d <= dateRange.end);
  }, [records, dateRange]);

  // Fetch options & compute product names from backend
  useEffect(() => {
    if (filteredDates.length === 0 || Object.keys(records).length === 0) return;
    let cancelled = false;
    (async () => {
      const result = await apiComputeOptions(filteredRecords, dateRange.start, dateRange.end, [], [], aliases);
      if (!cancelled) {
        setAllProductNames(result.allProducts);
        const names = result.allProducts;
        setProductNames(names);
        if (searchKeyword.trim()) {
          const kw = searchKeyword.trim().toLowerCase();
          setFilteredProductNames(names.filter(n => n.toLowerCase().includes(kw)));
        } else {
          setFilteredProductNames(names);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [filteredDates, records, dateRange, searchKeyword, aliases]);

  // 搜索过滤
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

  // Fetch region aggregation from backend
  useEffect(() => {
    if (targetProducts.length === 0 || filteredDates.length === 0 || Object.keys(records).length === 0) { setAggregatedData(null); return; }
    const cacheKey = `agg|${dateRange.start}|${dateRange.end}|${[...targetProducts].sort()}|${flagType}`;
    const cached = regionCacheRef.current.get(cacheKey);
    if (cached) { setAggregatedData(cached); return; }
    let cancelled = false;
    setLoading(true);
    if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
      chartInstanceRef.current.showLoading({ text: '加载中...', color: '#14b8a6', maskColor: 'rgba(255,255,255,0.7)', fontSize: 14 });
    }
    (async () => {
      try {
        const result = await apiComputeRegionAggregation(filteredRecords, dateRange.start, dateRange.end, targetProducts, flagType);
        if (!cancelled) { regionCacheRef.current.set(cacheKey, result); setAggregatedData(result); }
      } catch (e) { if (!cancelled) setAggregatedData(null); }
      finally {
        if (!cancelled) {
          setLoading(false);
          if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) chartInstanceRef.current.hideLoading();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [targetProducts, filteredDates, records, dateRange, flagType]);

  // Fetch trend data from backend
  useEffect(() => {
    if (!aggregatedData || filteredDates.length === 0) return;
    let topRegions: string[];
    if (selectedRegions.length > 0) topRegions = selectedRegions;
    else topRegions = Object.entries(aggregatedData.region).sort((a, b) => b[1].count - a[1].count).slice(0, 8).map(e => e[0]);

    let cancelled = false;
    (async () => {
      try {
        const result = await apiComputeRegionTrend(filteredRecords, dateRange.start, dateRange.end, topRegions, targetProducts, flagType);
        if (!cancelled) setTrendData(result.trendData);
      } catch (e) { if (!cancelled) setTrendData([]); }
    })();
    return () => { cancelled = true; };
  }, [aggregatedData, selectedRegions, filteredDates, records, dateRange, targetProducts, flagType]);

  const displayRegion = aggregatedData ? aggregatedData.region : {};
  const chartData = useMemo(() =>
    Object.entries(displayRegion).map(([name, item]) => ({ name, value: item.count, town_village: item.town_village })).sort((a, b) => b.value - a.value),
    [displayRegion]);
  const mapData = useMemo(() =>
    chartData.map(d => ({ name: mapProvinceName(d.name), value: d.value, town_village: d.town_village, originalName: d.name })),
    [chartData]);
  const totalValue = useMemo(() => chartData.reduce((s, d) => s + d.value, 0), [chartData]);
  const totalTownVillage = useMemo(() => chartData.reduce((s, d) => s + d.town_village, 0), [chartData]);
  const topRegions = useMemo(() => {
    if (selectedRegions.length > 0) return selectedRegions;
    return chartData.slice(0, 8).map(d => d.name);
  }, [chartData, selectedRegions]);

  // Distribution chart
  useEffect(() => {
    if (viewMode !== 'distribution' || !chartRef.current || chartData.length === 0) return;

    const needsReinit = !chartInstanceRef.current || chartInstanceRef.current.isDisposed();

    if (!needsReinit && chartType === 'map') {
      // Update data only — smooth morph transition
      const maxCount = Math.max(...mapData.map(m => m.value), 1);
      const sortedMapData = [...mapData].sort((a, b) => b.value - a.value);
      const animatedMapData = sortedMapData.map((d, i) => {
        const countScore = d.value / maxCount;
        const tvRatio = d.value > 0 ? d.town_village / d.value : 0;
        return { name: d.name, value: Math.round((countScore * 0.6 + tvRatio * 0.4) * 100), total: d.value, town_village: d.town_village };
      });
      chartInstanceRef.current?.setOption({
        animation: true,
        animationDuration: 600,
        animationDurationUpdate: 400,
        animationEasing: 'cubicInOut' as const,
        animationEasingUpdate: 'cubicInOut' as const,
        series: [{ type: 'map', map: 'china', data: animatedMapData }]
      }, false);
      return;
    }

    if (!needsReinit && chartType === 'groupedBar') {
      const townRatios = chartData.map(d => d.value > 0 ? Math.round((d.town_village / d.value) * 100) : 0);
      chartInstanceRef.current?.setOption({
        animation: true, animationDuration: 600, animationEasing: 'cubicInOut' as const, animationDurationUpdate: 400,
        xAxis: { data: chartData.map(d => d.name) },
        series: [
          { type: 'bar', data: chartData.map(d => d.value) },
          { type: 'bar', data: chartData.map(d => d.town_village) },
          { type: 'line', data: townRatios }
        ]
      }, false);
      return;
    }

    // Full re-init for new chart type or first render
    if (chartInstanceRef.current) { try { chartInstanceRef.current.dispose(); } catch {} chartInstanceRef.current = null; }
    const chart = echarts.init(chartRef.current, 'brutal');
    chartInstanceRef.current = chart;

    if (chartType === 'map') {
      registerChinaMap();
      chartRef.current.style.height = '620px';
      const maxCount = Math.max(...mapData.map(m => m.value), 1);
      // Build data with animation delays for sequential highlight
      const sortedMapData = [...mapData].sort((a, b) => b.value - a.value);
      const animatedMapData = sortedMapData.map((d, i) => {
        const countScore = d.value / maxCount;
        const tvRatio = d.value > 0 ? d.town_village / d.value : 0;
        const composite = Math.round((countScore * 0.6 + tvRatio * 0.4) * 100);
        return { name: d.name, value: composite, total: d.value, town_village: d.town_village, animationDelay: i * 40 };
      });
      chart.setOption({
        tooltip: { ...TOOLTIP_STYLE, trigger: 'item', formatter: (p: any) => { if (p.value === undefined || p.value === null) return `<b>${p.name}</b><br/>暂无数据`; return buildTooltipHtml(p.name, p.data?.total || 0, p.data?.town_village || 0); } },
        visualMap: { show: true, left: 16, bottom: 16, min: 0, max: 100, text: ['高', '低'], textStyle: { fontSize: 10, color: '#64748b' }, inRange: { color: ['#d1fae5', '#6ee7b7', '#fde68a', '#fbbf24', '#f59e0b', '#ef4444'] }, calculable: true, orient: 'vertical', itemWidth: 12, itemHeight: 120 },
        geo: { map: 'china', roam: true, zoom: 1.2, label: { show: true, fontSize: 9, color: '#94a3b8', formatter: (p: any) => p.name.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, '').substring(0, 3) }, emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' as const, color: '#fff' }, itemStyle: { areaColor: '#f97316', shadowBlur: 30, shadowColor: 'rgba(249,115,22,0.5)', shadowOffsetX: 0, shadowOffsetY: 0 }, scale: 1.05, transitionDuration: 0.3 }, itemStyle: { areaColor: '#f0fdf4', borderColor: '#a7f3d0', borderWidth: 0.8 }, animation: true, animationDuration: 800, animationDurationUpdate: 400, animationEasing: 'sinusoidalInOut' as const, animationEasingUpdate: 'cubicInOut' as const },
        series: [{ type: 'map', map: 'china', geoIndex: 0, animationDelay: (idx: number) => idx * 60, silent: false, data: animatedMapData, label: { show: true, fontSize: 8, color: '#334155', formatter: (p: any) => { const short = p.name.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, '').substring(0, 3); const total = p.data?.total ?? 0; return total > 0 ? `${short}\n${total}单` : short; } }, emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' as const, color: '#fff' }, itemStyle: { areaColor: '#ea580c', shadowBlur: 40, shadowColor: 'rgba(249,115,22,0.6)' }, transitionDuration: 0.25 } }],
      }, true);
      // Click handler for province detail
      chart.off('click');
      chart.on('click', (params: any) => {
        if (params.componentType === 'series' && params.data) {
          const d = params.data;
          const total = d.total ?? 0;
          const tv = d.town_village ?? 0;
          if (total > 0) {
            setSelectedProvince({ name: d.name, total, townVillage: tv });
          }
        }
      });
    } else {
      chartRef.current.style.height = chartData.length > 12 ? '560px' : '460px';
      const townRatios = chartData.map(d => d.value > 0 ? Math.round((d.town_village / d.value) * 100) : 0);
      chart.setOption({
        tooltip: { ...TOOLTIP_STYLE, trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params: any) => { const d = chartData[params[0]?.dataIndex]; return d ? buildTooltipHtml(d.name, d.value, d.town_village) : ''; } },
        legend: { top: 0, textStyle: { fontSize: 11, color: '#64748b' }, data: [{ name: '总数', icon: 'roundRect', itemStyle: { color: '#14b8a6' } }, { name: '乡镇/村', icon: 'roundRect', itemStyle: { color: '#f59e0b' } }, { name: '乡镇占比', icon: 'line', itemStyle: { color: '#8b5cf6' } }] },
        animation: true, animationDuration: 700, animationEasing: 'elasticOut' as const, animationDelay: (idx: number) => idx * 50,
        grid: { left: '3%', right: '6%', bottom: chartData.length > 12 ? '18%' : '12%', top: '14%', containLabel: true },
        dataZoom: chartData.length > 6 ? [{ type: 'slider', xAxisIndex: 0, bottom: 6, height: 20, start: 0, end: Math.min(100, Math.round((8 / chartData.length) * 100)), borderColor: 'transparent', backgroundColor: '#f1f5f9', fillerColor: 'rgba(16,185,129,0.15)', handleStyle: { color: '#14b8a6' }, textStyle: { fontSize: 10, color: '#94a3b8' } }, { type: 'inside', xAxisIndex: 0 }] : undefined,
        xAxis: { type: 'category', data: chartData.map(d => d.name), axisLabel: { color: '#475569', fontSize: 10, rotate: chartData.length > 6 ? 30 : 0 }, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false } },
        yAxis: [{ type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } } }, { type: 'value', min: 0, max: 100, axisLabel: { color: '#8b5cf6', fontSize: 11, formatter: (v: number) => `${Math.round(v)}%` }, splitLine: { show: false }, axisLine: { show: true, lineStyle: { color: '#c4b5fd' } } }],
        series: [{ name: '总数', type: 'bar', barWidth: '25%', yAxisIndex: 0, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#34d399' }, { offset: 1, color: '#14b8a6' }]), borderRadius: [3, 3, 0, 0] }, emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(20,184,166,0.4)', shadowOffsetY: 2 } }, data: chartData.map(d => d.value) }, { name: '乡镇/村', type: 'bar', barWidth: '25%', yAxisIndex: 0, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#fbbf24' }, { offset: 1, color: '#f59e0b' }]), borderRadius: [3, 3, 0, 0] }, emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(245,158,11,0.4)', shadowOffsetY: 2 } }, data: chartData.map(d => d.town_village) }, { name: '乡镇占比', type: 'line', yAxisIndex: 1, symbol: 'circle', symbolSize: 6, smooth: true, lineStyle: { color: '#8b5cf6', width: 2.5 }, emphasis: { symbolSize: 10, lineStyle: { width: 4 } }, data: townRatios }],
      }, true);
    }
    chart.resize();
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); try { chart.dispose(); } catch {} chartInstanceRef.current = null; };
  }, [chartData, chartType, mapData, viewMode]);

  // Trend chart
  useEffect(() => {
    if (viewMode !== 'trend' || !trendChartRef.current || trendData.length === 0 || topRegions.length === 0) return;

    const needsReinit = !trendChartInstanceRef.current || trendChartInstanceRef.current.isDisposed();

    if (!needsReinit) {
      // Smooth data update without re-init
      trendChartInstanceRef.current?.setOption({
        animation: true, animationDuration: 600, animationEasing: 'cubicInOut' as const,
        xAxis: { data: trendData.map(d => d.label) },
        series: topRegions.map((region, i) => {
          const c = VIVID_COLORS[i % VIVID_COLORS.length];
          return { name: region, data: trendData.map((d: any) => (d[region] as number) || 0) };
        }),
      }, false);
      return;
    }

    if (trendChartInstanceRef.current) { try { trendChartInstanceRef.current.dispose(); } catch {} trendChartInstanceRef.current = null; }
    const chart = echarts.init(trendChartRef.current, 'brutal');
    trendChartInstanceRef.current = chart;
    chart.setOption({
      tooltip: { ...TOOLTIP_STYLE, trigger: 'axis' },
      legend: { type: 'scroll', bottom: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11, color: '#64748b' } },
      animation: true, animationDuration: 800, animationEasing: 'sinusoidalInOut' as const, animationDelay: (idx: number) => idx * 80,
      grid: { left: '3%', right: '4%', bottom: '16%', top: '8%', containLabel: true },
      xAxis: { type: 'category', data: trendData.map(d => d.label), axisLabel: { fontSize: 11, color: '#64748b', rotate: trendData.length > 10 ? 30 : 0 } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } } },
      series: topRegions.map((region, i) => { const c = VIVID_COLORS[i % VIVID_COLORS.length]; return { name: region, type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, lineStyle: { width: 3, color: c }, emphasis: { symbolSize: 10, lineStyle: { width: 5 } }, data: trendData.map((d: any) => (d[region] as number) || 0) }; }) as any,
    }, true);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); try { chart.dispose(); } catch {} trendChartInstanceRef.current = null; };
  }, [trendData, topRegions, viewMode]);

  const periodLabel = useMemo(() => {
    switch (timePeriod) {
      case 'day': return '当日';
      case 'week': return '当周';
      case 'month': return '当月';
      case 'custom': return `${customStart || '?'} ~ ${customEnd || '?'}`;
    }
  }, [timePeriod, customStart, customEnd]);

  if (productNames.length === 0) {
    return (<Card><CardContent className="flex items-center justify-center py-16 text-muted-foreground"><p className="text-sm">该时间段内暂无产品数据</p></CardContent></Card>);
  }

  return (
    <div ref={containerRef} className="space-y-4">
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes countUp { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes chartReveal { from { opacity: 0; transform: translateY(24px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-slide-up { animation: slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out both; }
        .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-scale-in { animation: scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-chart-reveal { animation: chartReveal 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-count-up { animation: countUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.8s infinite; border-radius: 8px; }
        .skeleton-card { height: 80px; }
        .skeleton-chart { height: 420px; margin-top: 16px; }
        .skeleton-text { height: 14px; width: 60%; margin-bottom: 8px; }
        .skeleton-number { height: 28px; width: 40%; }
        @keyframes breathe { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes loadingDots { 0%, 20% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes ripple { 0% { transform: scale(0); opacity: 0.6; } 100% { transform: scale(4); opacity: 0; } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .animate-breathe { background-size: 200% 200%; animation: breathe 4s ease-in-out infinite; }
        .loading-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--primary); animation: loadingDots 1.4s infinite ease-in-out both; }
        .loading-dot:nth-child(1) { animation-delay: 0s; }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }
        .ripple-effect { position: relative; overflow: hidden; }
        .ripple-effect::after { content: ''; position: absolute; border-radius: 50%; background: rgba(249,115,22,0.3); width: 20px; height: 20px; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0); opacity: 0; pointer-events: none; }
        .ripple-effect:active::after { animation: ripple 0.6s ease-out; }
        .tab-btn { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
        .tab-btn:active { transform: scale(0.95); }
        .tab-btn-active { background: linear-gradient(135deg, var(--primary), #059669); background-size: 200% 200%; animation: gradientShift 3s ease infinite; }
        .animate-delay-1 { animation-delay: 0.05s; }
        .animate-delay-2 { animation-delay: 0.12s; }
        .animate-delay-3 { animation-delay: 0.19s; }
        .animate-delay-4 { animation-delay: 0.26s; }
        .animate-delay-5 { animation-delay: 0.33s; }
        .animate-delay-6 { animation-delay: 0.40s; }
        .pulse-on-update { transition: all 0.3s ease; }
        .chart-container { transition: opacity 0.3s cubic-bezier(0.4,0,0.2,1); }
        .chart-fading { opacity: 0.15; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) {
          .animate-slide-up, .animate-fade-in, .animate-fade-in-up, .animate-scale-in, .animate-chart-reveal, .animate-count-up { animation: none; opacity: 1; transform: none; }
          .skeleton { animation: none; background: #f1f5f9; }
        }
      `}</style>
      <Card className="brutal-card-lift sticky top-0 z-10 bg-background/98 backdrop-blur-md border-primary/10">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 whitespace-nowrap"><MapPin className="h-4 w-4 text-primary shrink-0" />地域分布分析</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0 bg-muted/60 rounded-lg p-0.5 text-xs shrink-0">
                {(['day', 'week', 'month', 'custom'] as TimePeriod[]).map((p, i) => (
                  <span key={p}>
                    {i > 0 && <span className="text-muted-foreground/40 px-1">/</span>}
                    <button
                      onClick={() => setTimePeriod(p)}
                      className={`tab-btn px-1.5 py-1 rounded-md ${timePeriod === p ? 'tab-btn-active text-primary-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {p === 'day' ? '当日' : p === 'week' ? '当周' : p === 'month' ? '当月' : '自定义'}
                    </button>
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
              <div className="relative w-[150px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="搜索..." value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} className="!pl-7 h-7 text-xs" />
                {searchKeyword && <button onClick={() => setSearchKeyword('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>}
              </div>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] h-7 justify-between text-xs font-medium border-primary/20 hover:border-primary/40 bg-primary/5"><span className="truncate">{selectedProduct === '__ALL__' ? '全部产品' : aliases[selectedProduct]?.alias || selectedProduct}</span><ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command><CommandInput placeholder="搜索产品..." className="h-8" /><CommandList className="max-h-[220px]"><CommandEmpty>未找到产品</CommandEmpty><CommandGroup>
                    <CommandItem value="__ALL__" onSelect={() => { setSelectedProduct('__ALL__'); setComboOpen(false); }} className="flex items-center gap-2 cursor-pointer"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedProduct === '__ALL__' ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="text-xs font-bold text-primary">全部产品</span></CommandItem>
                    {filteredProductNames.map(name => (<CommandItem key={name} value={name} onSelect={() => { setSelectedProduct(name); setComboOpen(false); }} className="flex items-center justify-between gap-2 cursor-pointer"><div className="flex items-center gap-2"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedProduct === name ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="truncate text-xs font-medium">{aliases[name]?.alias || name}</span></div></CommandItem>))}
                  </CommandGroup></CommandList></Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {aggregatedData && aggregatedData.count > 1 && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-gradient-to-r from-primary/15 via-primary/10 to-emerald-500/10 to-primary/15 text-primary text-xs font-medium border border-primary/20 animate-breathe">
              {searchKeyword.trim() ? <>关键词「{searchKeyword}」匹配 <span className="font-bold">{aggregatedData.count}</span> 个产品，{periodLabel}合计 <span className="font-bold">{aggregatedData.total}</span> 单</> : <>{periodLabel}已聚合 <span className="font-bold">{aggregatedData.count}</span> 个产品，合计 <span className="font-bold">{aggregatedData.total}</span> 单 · {filteredDates.length} 天数据</>}
            </div>
          )}
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {loading ? (
            <>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="rounded-xl border border-border/30 p-4 shadow-sm">
                  <div className="skeleton skeleton-text" />
                  <div className="skeleton skeleton-number" style={{ marginTop: 12 }} />
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up animate-delay-1 pulse-on-update ripple-effect">
                <div className="text-xs text-muted-foreground font-normal mb-1.5">覆盖省份</div>
                <AnimatedValue value={chartData.length} className="text-2xl font-normal text-primary tabular-nums" />
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up animate-delay-2 pulse-on-update">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground font-normal">售后总数</span>
                  <select value={flagType} onChange={e => setFlagType(e.target.value)}
                    className="text-xs px-1.5 py-0 h-5 rounded-sm font-medium cursor-pointer outline-none"
                    style={flagType === '总数' ? { borderColor: '#94a3b8', color: '#475569', backgroundColor: '#f8fafc' }
                      : flagType === '红色旗子' ? { borderColor: '#fca5a5', color: '#dc2626', backgroundColor: '#fef2f2' }
                      : flagType === '绿色旗子' ? { borderColor: '#86efac', color: '#16a34a', backgroundColor: '#f0fdf4' }
                      : { borderColor: '#d1d5db', color: '#6b7280', backgroundColor: '#f9fafb' }}>
                    <option value="红色旗子">红旗</option>
                    <option value="绿色旗子">绿旗</option>
                    <option value="灰色旗子">灰旗</option>
                    <option value="总数">总数</option>
                  </select>
                </div>
                <AnimatedValue value={aggregatedData?.total || 0} className="text-2xl font-normal text-emerald-600 tabular-nums" />
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up animate-delay-3 pulse-on-update">
                <div className="text-xs text-muted-foreground font-normal mb-1.5">乡镇/村</div>
                <AnimatedValue value={totalTownVillage} className="text-2xl font-normal text-amber-600 tabular-nums" />
              </div>
              <div className="rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-500/5 p-4 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up animate-delay-4 pulse-on-update">
                <div className="text-xs text-muted-foreground font-normal mb-1.5">乡镇占比</div>
                <span className="text-2xl font-normal text-orange-600 tabular-nums">{totalValue > 0 ? ((totalTownVillage / totalValue) * 100).toFixed(1) : '0.0'}%</span>
              </div>
            </>
          )}
        </div>

      {viewMode === 'distribution' && (
        <Card className="brutal-card-lift border-primary/10 animate-chart-reveal animate-delay-3">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div><CardTitle className="text-sm font-bold flex items-center gap-2">{chartType === 'map' ? <MapIcon className="h-4 w-4 text-primary" /> : <BarChart3 className="h-4 w-4 text-primary" />}{chartType === 'map' ? '中国地域分布图' : '纵向分组柱状图'}<Badge className="ml-1.5 text-xs bg-primary/15 text-primary border-0">{periodLabel} · {filteredDates.length}天</Badge></CardTitle></div>
              <div className="flex gap-1.5">{CHART_OPTIONS.map(opt => (<Button key={opt.value} variant={chartType === opt.value ? 'default' : 'outline'} size="sm" className={`h-7 px-3 text-[11px] gap-1.5 transition-all duration-200 ${chartType === opt.value ? 'bg-primary text-primary-foreground shadow-md' : ''}`} onClick={() => {
                if (chartType !== (opt.value as RegionChartType)) {
                  setChartTransitioning(true);
                  setTimeout(() => {
                    setChartType(opt.value as RegionChartType);
                    setTimeout(() => setChartTransitioning(false), 50);
                  }, 200);
                }
              }}>{opt.icon}{opt.label}</Button>))}</div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 px-3">
            {loading ? (
              <div className="skeleton skeleton-chart" style={{ borderRadius: 12 }}>
                <div className="flex items-center justify-center h-full gap-2">
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[360px] text-muted-foreground gap-3 animate-fade-in">
                <MapPin className="h-10 w-10 opacity-20" />
                <p className="text-sm">暂无地域分布数据</p>
              </div>
            ) : (
            <div className="relative">
              {/* Province detail overlay */}
              {selectedProvince && chartType === 'map' && (
                <div className="absolute top-3 right-3 z-20 animate-slide-up">
                  <div className="bg-background/95 backdrop-blur-md border border-primary/20 rounded-xl shadow-lg p-4 min-w-[200px]">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-primary">{selectedProvince.name}</h4>
                      <button onClick={() => setSelectedProvince(null)} className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">售后总数</span><span className="font-bold tabular-nums text-emerald-600">{selectedProvince.total}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">乡镇/村</span><span className="font-bold tabular-nums text-amber-600">{selectedProvince.townVillage}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">乡镇占比</span><span className="font-bold tabular-nums text-orange-600">{selectedProvince.total > 0 ? ((selectedProvince.townVillage / selectedProvince.total) * 100).toFixed(1) : '0.0'}%</span></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chartRef} className={`w-full chart-container ${chartTransitioning ? 'chart-fading' : ''}`} style={{ minHeight: chartType === 'map' ? '620px' : '460px', ...(chartTransitioning ? { pointerEvents: 'none' } : {}) }} />
              {chartType === 'groupedBar' && (
                <div
                  onMouseDown={handleResizeStart}
                  className="absolute top-0 right-0 w-2 -mr-0.5 h-full cursor-col-resize z-10 group"
                  style={{ background: 'transparent' }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-16 rounded-full bg-primary/20 group-hover:bg-primary/60 group-active:bg-primary transition-colors" />
                </div>
              )}
            </div>
          )}</CardContent>
        </Card>
      )}

      {viewMode === 'trend' && (
        <Card className="brutal-card-lift border-primary/10 animate-chart-reveal animate-delay-3">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div><CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />地域趋势分布<Badge className="ml-1.5 text-xs bg-primary/15 text-primary border-0">{periodLabel} · {selectedRegions.length > 0 ? `已选 ${selectedRegions.length}` : `Top ${topRegions.length}`} 省份</Badge></CardTitle></div>
              <Popover open={regionComboOpen} onOpenChange={setRegionComboOpen}>
                <PopoverTrigger asChild><Button variant="outline" className="h-7 text-xs gap-1.5 border-primary/20 hover:border-primary/40 bg-primary/5 max-w-[260px]"><MapPin className="h-3 w-3 text-primary shrink-0" /><span className="truncate">{selectedRegions.length === 0 ? '全部省份 (Top 8)' : `已选 ${selectedRegions.length} 个省份`}</span><ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" /></Button></PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="end">
                  <Command><CommandInput placeholder="搜索省份..." className="h-8" /><CommandList className="max-h-[240px]"><CommandEmpty>未找到省份</CommandEmpty><CommandGroup>
                    <CommandItem value="__ALL__" onSelect={() => { setSelectedRegions([]); setRegionComboOpen(false); }} className="flex items-center gap-2 cursor-pointer"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedRegions.length === 0 ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="text-xs font-bold text-primary">全部 (Top 8)</span></CommandItem>
                    {chartData.map(d => (<CommandItem key={d.name} value={d.name} onSelect={() => { setSelectedRegions(prev => prev.includes(d.name) ? prev.filter(r => r !== d.name) : [...prev, d.name]); }} className="flex items-center justify-between gap-2 cursor-pointer"><Check className={`h-3.5 w-3.5 shrink-0 ${selectedRegions.includes(d.name) ? 'text-primary opacity-100' : 'opacity-0'}`} /><span className="truncate text-xs">{d.name}</span><Badge variant="secondary" className="text-[10px] shrink-0 px-1.5 py-0 tabular-nums">{d.value}单</Badge></CommandItem>))}
                  </CommandGroup></CommandList></Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="pt-4 px-3">{trendData.length === 0 || topRegions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[360px] text-muted-foreground gap-3 animate-fade-in">
              <TrendingUp className="h-10 w-10 opacity-20" />
              <p className="text-sm">暂无趋势数据</p>
            </div>
          ) : (<div ref={trendChartRef} className="w-full h-[420px]" />)}</CardContent>
        </Card>
      )}
    </div>
  );
}
