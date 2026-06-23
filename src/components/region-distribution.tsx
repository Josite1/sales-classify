'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { registerBrutalTheme, getBrutalTooltip, getBrutalGrid, getBrutalXAxis, getBrutalYAxis, BRUTAL_COLORS } from '@/lib/echarts-theme';
import * as echarts from 'echarts';
import chinaGeoJson from 'echarts-china-map/lib/china.json';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { MapPin, Search, X, Check, ChevronsUpDown, Map as MapIcon, BarChart3, TrendingUp, CalendarDays } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import type { AllRecords, ProductData, ProductAliases, RegionItem } from '@/lib/types';
import {

  getProductTotal, getRegionDistribution,
  loadProductAliases, getProductDisplayName,
} from '@/lib/store';
// Register brutalist theme
if (typeof window !== 'undefined') {
  registerBrutalTheme(echarts);
}


const TOOLTIP_STYLE = getBrutalTooltip();

type RegionChartType = 'map' | 'groupedBar';
type TimePeriod = 'day' | 'week' | 'month' | 'custom';
type ViewMode = 'distribution' | 'trend';

const CHART_OPTIONS: { value: RegionChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'map', label: '地图', icon: <MapIcon className="h-3.5 w-3.5" /> },
  { value: 'groupedBar', label: '柱状图', icon: <BarChart3 className="h-3.5 w-3.5" /> },
];

const VIVID_COLORS = BRUTAL_COLORS;

// 省份名映射
function normalizeProvinceName(name: string): string {
  return name
    .replace(/省$/, '')
    .replace(/市$/, '')
    .replace(/壮族自治区$/, '')
    .replace(/回族自治区$/, '')
    .replace(/维吾尔自治区$/, '')
    .replace(/自治区$/, '')
    .replace(/特别行政区$/, '');
}

// 从 GeoJSON 提取省份信息
interface ProvinceInfo {
  fullName: string;
  normalizedName: string;
  cp: [number, number];
}

const provinceInfoList: ProvinceInfo[] = ((chinaGeoJson as unknown as { features: { properties: { name: string; cp: number[] } }[] }).features).map(
  (f) => ({
    fullName: f.properties.name,
    normalizedName: normalizeProvinceName(f.properties.name),
    cp: [f.properties.cp[0], f.properties.cp[1]] as [number, number],
  })
);

const normalizedToInfo: Record<string, ProvinceInfo> = {};
for (const info of provinceInfoList) {
  normalizedToInfo[info.normalizedName] = info;
}

function mapProvinceName(userProvince: string): string {
  if (normalizedToInfo[userProvince]) return normalizedToInfo[userProvince].fullName;
  const norm = normalizeProvinceName(userProvince);
  if (normalizedToInfo[norm]) return normalizedToInfo[norm].fullName;
  for (const [key, info] of Object.entries(normalizedToInfo)) {
    if (key.includes(norm) || norm.includes(key)) return info.fullName;
  }
  return userProvince;
}

let mapRegistered = false;
function registerChinaMap() {
  if (!mapRegistered) {
    echarts.registerMap('china', chinaGeoJson as Parameters<typeof echarts.registerMap>[1]);
    mapRegistered = true;
  }
}

/** 获取某日期所在 ISO 周的周一 ~ 周日 */
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

/** 获取某日期所在月份的第一天和最后一天 */
function getMonthRange(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error('Invalid date');
  
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

interface RegionDistributionProps {
  records: AllRecords;
  selectedDate: string | null;
  initialAliases?: ProductAliases;
}

export function RegionDistribution({ records, selectedDate, initialAliases }: RegionDistributionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const trendChartInstanceRef = useRef<echarts.ECharts | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<string>('__ALL__');
  const [chartType, setChartType] = useState<RegionChartType>('map');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [aliases, setAliases] = useState<ProductAliases>({});
  const [comboOpen, setComboOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('distribution');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [regionComboOpen, setRegionComboOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setAliases(initialAliases || loadProductAliases());
  }, [initialAliases]);

  // 使用 IntersectionObserver 检测组件可见性
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsVisible(true);
          requestAnimationFrame(() => {
            const charts = [chartInstanceRef, trendChartInstanceRef];
            for (const chartRef of charts) {
              if (chartRef.current && !chartRef.current.isDisposed()) {
                chartRef.current.resize();
              }
            }
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

  // 根据时间段获取日期范围
  const dateRange = useMemo(() => {
    if (!selectedDate) return { start: '', end: '' };
    switch (timePeriod) {
      case 'day': return { start: selectedDate, end: selectedDate };
      case 'week': return getISOWeekRange(selectedDate);
      case 'month': return getMonthRange(selectedDate);
      case 'custom': {
        const start = calendarRange?.from ? format(calendarRange.from, 'yyyy-MM-dd') : '';
        const end = calendarRange?.to ? format(calendarRange.to, 'yyyy-MM-dd') : '';
        return { start, end };
      }
    }
  }, [selectedDate, timePeriod, calendarRange]);

  // 时间段内的日期列表
  const filteredDates = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    return Object.keys(records)
      .sort()
      .filter((d) => d >= dateRange.start && d <= dateRange.end);
  }, [records, dateRange]);

  // 所有产品名称（跨时间段内所有日期聚合排序）
  const productNames = useMemo(() => {
    const totals = new Map<string, number>();
    for (const dateStr of filteredDates) {
      const record = records[dateStr];
      if (!record) continue;
      for (const [name, data] of Object.entries(record.data)) {
        totals.set(name, (totals.get(name) || 0) + getProductTotal(data));
      }
    }
    return Array.from(totals.entries())
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .map(([name]: [string, number]) => name);
  }, [filteredDates, records]);

  const filteredProductNames = useMemo(() => {
    if (!searchKeyword.trim()) return productNames;
    const kw = searchKeyword.trim().toLowerCase();
    return productNames.filter((name) => {
      const displayName = getProductDisplayName(name, aliases);
      return name.toLowerCase().includes(kw) || displayName.toLowerCase().includes(kw);
    });
  }, [productNames, searchKeyword, aliases]);

  const productsToAggregate = useMemo(() => {
    if (selectedProduct === '__ALL__') return productNames;
    return [selectedProduct];
  }, [selectedProduct, productNames]);

  // 聚合时间段内所有日期的地域数据
  const aggregatedData = useMemo(() => {
    const targetProducts = searchKeyword.trim()
      ? filteredProductNames
      : productsToAggregate;
    if (targetProducts.length === 0 || filteredDates.length === 0) return null;

    const aggRegion: Record<string, RegionItem> = {};
    let aggTotal = 0;

    for (const dateStr of filteredDates) {
      const record = records[dateStr];
      if (!record) continue;
      for (const pname of targetProducts) {
        const pd = record.data[pname];
        if (!pd) continue;
        aggTotal += getProductTotal(pd);
        const rg = getRegionDistribution(pd);
        for (const [region, item] of Object.entries(rg)) {
          if (!aggRegion[region]) {
            aggRegion[region] = { count: 0, town_village: 0 };
          }
          aggRegion[region].count += item.count;
          aggRegion[region].town_village += item.town_village;
        }
      }
    }

    return { region: aggRegion, total: aggTotal, count: targetProducts.length };
  }, [searchKeyword, filteredProductNames, productsToAggregate, filteredDates, records]);

  const displayRegion: Record<string, RegionItem> = aggregatedData ? aggregatedData.region : {};

  const chartData = useMemo(() =>
    Object.entries(displayRegion)
      .map(([name, item]) => ({ name, value: item.count, town_village: item.town_village, nonTown: item.count - item.town_village }))
      .sort((a, b) => b.value - a.value),
    [displayRegion]
  );

  const mapData = useMemo(() =>
    chartData.map((d) => ({
      name: mapProvinceName(d.name),
      value: d.value,
      town_village: d.town_village,
      nonTown: d.nonTown,
      originalName: d.name,
    })),
    [chartData]
  );

  const totalValue = useMemo(() => chartData.reduce((s, d) => s + d.value, 0), [chartData]);
  const totalTownVillage = useMemo(() => chartData.reduce((s, d) => s + d.town_village, 0), [chartData]);

  // 趋势数据：按日期拆分 Top 8 地域或用户选择的省份
  const topRegions = useMemo(() => {
    if (selectedRegions.length > 0) return selectedRegions;
    return chartData.slice(0, 8).map((d) => d.name);
  }, [chartData, selectedRegions]);

  const trendData = useMemo(() => {
    if (filteredDates.length === 0 || topRegions.length === 0) return [];
    const targetProducts = searchKeyword.trim()
      ? filteredProductNames
      : productsToAggregate;

    return filteredDates.map((dateStr) => {
      const record = records[dateStr];
      const d = new Date(dateStr);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
      const label = `${month}/${day} 周${weekDays[d.getDay()]}`;

      const regionCount: Record<string, number> = {};
      for (const pname of targetProducts) {
        const pd = record?.data?.[pname];
        if (!pd) continue;
        const rg = getRegionDistribution(pd);
        for (const [region, item] of Object.entries(rg)) {
          regionCount[region] = (regionCount[region] || 0) + item.count;
        }
      }

      const point: { date: string; label: string; [region: string]: string | number } = { date: dateStr, label };
      for (const region of topRegions) {
        point[region] = regionCount[region] || 0;
      }
      return point;
    });
  }, [filteredDates, topRegions, searchKeyword, filteredProductNames, productsToAggregate, records]);

  // 通用乡镇占比 Tooltip HTML
  function buildTooltipHtml(name: string, total: number, townVillage: number): string {
    const tvRatio = total > 0 ? ((townVillage / total) * 100).toFixed(1) : '0.0';
    const tvBarWidth = Math.round(Number(tvRatio));
    const nonTownVillage = total - townVillage;
    const nonRatio = total > 0 ? ((nonTownVillage / total) * 100).toFixed(1) : '0.0';
    return `<div style="min-width:200px">
      <b style="font-size:14px">${name}</b>
      <div style="margin-top:6px;font-size:13px">
        <span style="color:#64748b">售后总数：</span><b style="color:#10b981;font-size:15px">${total}</b> 单
      </div>
      <div style="margin-top:4px;font-size:12px">
        <span style="color:#64748b">乡镇：</span><b style="color:#f59e0b">${townVillage}</b> 单
        <span style="color:#94a3b8;margin-left:2px">(${tvRatio}%)</span>
      </div>
      <div style="margin-top:5px;height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;display:flex">
        <div style="width:${tvBarWidth}%;height:100%;background:linear-gradient(90deg,#f59e0b,#f97316);border-radius:4px 0 0 4px"></div>
        <div style="width:${100 - tvBarWidth}%;height:100%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:0 4px 4px 0"></div>
      </div>
    </div>`;
  }

  // 分布图表渲染
  useEffect(() => {
    if (!isVisible) return;
    if (viewMode !== 'distribution') return;
    if (!chartRef.current || chartData.length === 0) return;

    // 确保 chart 实例绑定到当前 DOM（视图切换后 DOM 会重建）
    if (chartInstanceRef.current) {
      try { chartInstanceRef.current.dispose(); } catch { /* ignore */ }
      chartInstanceRef.current = null;
    }
    const chart = echarts.init(chartRef.current, 'brutal');
    chartInstanceRef.current = chart;

    if (chartType === 'map') {
      registerChinaMap();
      chartRef.current.style.height = '620px';

      const option: echarts.EChartsOption = {
        tooltip: {
          ...TOOLTIP_STYLE,
          trigger: 'item',
          formatter: (p: unknown) => {
            const params = p as { name: string; value?: number | [number, number, number]; data?: { total?: number; town_village?: number } };
            if (params.value === undefined || params.value === null) {
              return `<b>${params.name}</b><br/>暂无数据`;
            }
            const tv = (params.data as { town_village?: number })?.town_village || 0;
            const total = (params.data as { total?: number })?.total || 0;
            return buildTooltipHtml(params.name, total, tv);
          },
        },
        visualMap: {
          show: true,
          left: 16,
          bottom: 16,
          min: 0,
          max: 100,
          text: ['高', '低'],
          textStyle: { fontSize: 10, color: '#64748b' },
          inRange: {
            color: ['#d1fae5', '#6ee7b7', '#fde68a', '#fbbf24', '#f59e0b', '#ef4444'],
          },
          formatter: (val: unknown) => `${Number(val).toFixed(0)}`,
          calculable: true,
          orient: 'vertical',
          itemWidth: 12,
          itemHeight: 120,
        },
        geo: {
          map: 'china',
          roam: true,
          scaleLimit: { min: 0.8, max: 6 },
          zoom: 1.2,
          label: {
            show: true,
            fontSize: 9,
            color: '#94a3b8',
            formatter: (p: unknown) => {
              const params = p as { name: string };
              const short = params.name.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, '').substring(0, 3);
              return short;
            },
          },
          emphasis: {
            label: { show: true, fontSize: 12, fontWeight: 'bold', color: '#fff' },
            itemStyle: {
              areaColor: '#f97316',
              shadowBlur: 20,
              shadowColor: 'rgba(249,115,22,0.4)',
            },
          },
          itemStyle: {
            areaColor: '#f0fdf4',
            borderColor: '#a7f3d0',
            borderWidth: 0.8,
          },
        },
        series: [
          {
            type: 'map',
            map: 'china',
            geoIndex: 0,
            data: mapData.map((d) => {
              // 综合评分：省份总数据量(60%) + 乡镇数据占比(40%)
              const maxCount = Math.max(...mapData.map((m) => m.value), 1);
              const countScore = d.value / maxCount; // 0~1
              const tvRatio = d.value > 0 ? d.town_village / d.value : 0; // 0~1
              const compositeScore = Math.round((countScore * 0.6 + tvRatio * 0.4) * 100);
              return {
                name: d.name,
                value: compositeScore,
                total: d.value,
                town_village: d.town_village,
              };
            }),
            label: {
              show: true,
              fontSize: 8,
              color: '#334155',
              formatter: (p: unknown) => {
                const params = p as { name: string; value?: number; data?: { total?: number; town_village?: number } };
                if (params.value === undefined || params.value === null) return '';
                const short = params.name.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, '').substring(0, 3);
                const total = params.data?.total ?? 0;
                return total > 0 ? `${short}\n${total}单` : short;
              },
            },
          },
        ],
      };

      chart.setOption(option, true);
    } else if (chartType === 'groupedBar') {
      chartRef.current.style.height = '460px';

      const names = chartData.map((d) => d.name);
      const maxVal = Math.max(...chartData.map((d) => d.value), 1);
      const townRatios = chartData.map((d) => (d.value > 0 ? Math.round((d.town_village / d.value) * 100) : 0));

      const option: echarts.EChartsOption = {
        tooltip: {
          ...TOOLTIP_STYLE,
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: unknown) => {
            const ps = params as { name: string; value: number; seriesName: string; dataIndex: number }[];
            if (!ps || ps.length === 0) return '';
            const name = ps[0].name;
            const d = chartData[ps[0].dataIndex];
            if (!d) return '';
            return buildTooltipHtml(name, d.value, d.town_village);
          },
        },
        legend: {
          top: 0,
          textStyle: { fontSize: 11, color: '#64748b' },
          itemWidth: 14,
          itemHeight: 10,
          itemGap: 16,
          data: [
            { name: '总数', icon: 'roundRect', itemStyle: { color: '#14b8a6' } },
            { name: '乡镇/村', icon: 'roundRect', itemStyle: { color: '#f59e0b' } },
            { name: '乡镇占比', icon: 'line', itemStyle: { color: '#8b5cf6' } },
          ],
        },
        grid: { left: '3%', right: '6%', bottom: '12%', top: '14%', containLabel: true },
        dataZoom: chartData.length > 8 ? [
          {
            type: 'slider',
            xAxisIndex: 0,
            bottom: 8,
            height: 16,
            startValue: 0,
            endValue: 7,
            borderColor: 'transparent',
            backgroundColor: '#f1f5f9',
            fillerColor: 'rgba(16,185,129,0.15)',
            handleStyle: { color: '#14b8a6', borderColor: '#14b8a6' },
            textStyle: { fontSize: 10, color: '#94a3b8' },
          },
          { type: 'inside', xAxisIndex: 0 },
        ] : undefined,
        xAxis: {
          type: 'category',
          data: names,
          axisLabel: {
            color: '#475569',
            fontSize: 10,
            rotate: names.length > 6 ? 30 : 0,
            width: 80,
            overflow: 'truncate',
          },
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          axisTick: { show: false },
        },
        yAxis: [
          {
            type: 'value',
            max: maxVal * 1.2,
            axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => Math.round(v).toString() },
            splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
            axisLine: { show: false },
            axisTick: { show: false },
          },
          {
            type: 'value',
            min: 0,
            max: 100,
            axisLabel: { color: '#8b5cf6', fontSize: 11, formatter: (v: number) => `${Math.round(v)}%` },
            splitLine: { show: false },
            axisLine: { show: true, lineStyle: { color: '#c4b5fd' } },
            axisTick: { show: false },
          },
        ],
        series: [
          {
            name: '总数',
            type: 'bar',
            barWidth: '25%',
            barGap: '10%',
            yAxisIndex: 0,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#34d399' },
                { offset: 1, color: '#14b8a6' },
              ]),
              borderRadius: [4, 4, 0, 0],
            },
            data: chartData.map((d) => d.value),
          },
          {
            name: '乡镇/村',
            type: 'bar',
            barWidth: '25%',
            yAxisIndex: 0,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#fbbf24' },
                { offset: 1, color: '#f59e0b' },
              ]),
              borderRadius: [4, 4, 0, 0],
            },
            data: chartData.map((d) => d.town_village),
          },
          {
            name: '乡镇占比',
            type: 'line',
            yAxisIndex: 1,
            symbol: 'circle',
            symbolSize: 6,
            smooth: true,
            lineStyle: { color: '#8b5cf6', width: 2.5 },
            itemStyle: { color: '#8b5cf6' },
            data: townRatios,
          },
        ],
      };

      chart.setOption(option, true);
    }

    chart.resize();

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      try { chart.dispose(); } catch { /* ignore */ }
      chartInstanceRef.current = null;
    };
  }, [chartData, chartType, mapData, viewMode, isVisible]);

  // 趋势图表渲染
  useEffect(() => {
    if (!isVisible) return;
    if (viewMode !== 'trend') return;
    if (!trendChartRef.current || trendData.length === 0 || topRegions.length === 0) return;

    // 确保 chart 实例绑定到当前 DOM
    if (trendChartInstanceRef.current) {
      try { trendChartInstanceRef.current.dispose(); } catch { /* ignore */ }
      trendChartInstanceRef.current = null;
    }
    const chart = echarts.init(trendChartRef.current, 'brutal');
    trendChartInstanceRef.current = chart;

    const option: echarts.EChartsOption = {
      tooltip: {
        ...TOOLTIP_STYLE,
        trigger: 'axis',
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        icon: 'roundRect',
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { fontSize: 11, color: '#64748b' },
        itemGap: 16,
        pageIconSize: 12,
        pageTextStyle: { fontSize: 11, color: '#94a3b8' },
      },
      grid: { left: '3%', right: '4%', bottom: '16%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: trendData.map((d) => d.label),
        axisLabel: { fontSize: 11, color: '#64748b', rotate: trendData.length > 10 ? 30 : 0 },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      dataZoom: trendData.length > 14
        ? [{ type: 'slider', start: 0, end: 60, height: 20, bottom: 40 }, { type: 'inside' }]
        : undefined,
      series: topRegions.map((region, i) => {
        const c = VIVID_COLORS[i % VIVID_COLORS.length];
        return {
          name: region,
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 3, color: c },
          itemStyle: { color: c, borderWidth: 2, borderColor: '#fff' },
          emphasis: { lineStyle: { width: 5 } },
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 10,
            fontWeight: 'bold' as const,
            color: c,
            formatter: (params: { value: number }) => params.value > 0 ? `${params.value}` : '',
          },
          data: trendData.map((d) => (d[region] as number) || 0),
        };
      }) as echarts.EChartsOption['series'],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      try { chart.dispose(); } catch { /* ignore */ }
      trendChartInstanceRef.current = null;
    };
  }, [trendData, topRegions, viewMode, isVisible]);

  // 时间段标签
  const periodLabel = useMemo(() => {
    switch (timePeriod) {
      case 'day': return '当日';
      case 'week': return '当周';
      case 'month': return '当月';
      case 'custom': {
        const start = calendarRange?.from ? format(calendarRange.from, 'MM/dd') : '?';
        const end = calendarRange?.to ? format(calendarRange.to, 'MM/dd') : '?';
        return `${start} ~ ${end}`;
      }
    }
  }, [timePeriod, calendarRange]);

  if (productNames.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">该时间段内暂无产品数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4">
      {/* 筛选与控制卡片 */}
      <Card className="brutal-card-lift sticky top-0 z-10 bg-background/98 backdrop-blur-md border-primary/10">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                地域分布分析
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                按省份查看红色旗子售后地域分布，颜色深浅综合数据量与乡镇占比
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* 时间段选择 */}
              <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg p-0.5">
                <Button
                  variant={timePeriod === 'day' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimePeriod('day')}
                  className="h-7 text-xs px-2.5"
                >
                  当日
                </Button>
                <Button
                  variant={timePeriod === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimePeriod('week')}
                  className="h-7 text-xs px-2.5"
                >
                  <CalendarDays className="h-3.5 w-3.5 mr-1" />
                  当周
                </Button>
                <Button
                  variant={timePeriod === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimePeriod('month')}
                  className="h-7 text-xs px-2.5"
                >
                  当月
                </Button>
                <Button
                  variant={timePeriod === 'custom' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimePeriod('custom')}
                  className="h-7 text-xs px-2.5"
                >
                  自定义
                </Button>
              </div>

              {/* 视图切换：分布/趋势 */}
              <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg p-0.5">
                <Button
                  variant={viewMode === 'distribution' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('distribution')}
                  className="h-7 text-xs px-2.5"
                >
                  <BarChart3 className="h-3.5 w-3.5 mr-1" />
                  分布
                </Button>
                <Button
                  variant={viewMode === 'trend' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('trend')}
                  className="h-7 text-xs px-2.5"
                >
                  <TrendingUp className="h-3.5 w-3.5 mr-1" />
                  趋势
                </Button>
              </div>

              {/* 搜索框 */}
              <div className="relative w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索产品聚合..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="!pl-9 h-8 text-xs"
                />
                {searchKeyword && (
                  <button onClick={() => setSearchKeyword('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* 产品选择下拉框 */}
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-[240px] h-8 justify-between text-xs font-medium border-primary/20 hover:border-primary/40 bg-primary/5"
                  >
                    <span className="truncate">
                      {selectedProduct === '__ALL__'
                        ? `全部产品 · ${productNames.reduce((s, n) => {
                            let total = 0;
                            for (const dateStr of filteredDates) {
                              const pd = records[dateStr]?.data?.[n];
                              if (pd) total += getProductTotal(pd);
                            }
                            return s + total;
                          }, 0)}单`
                        : `${getProductDisplayName(selectedProduct, aliases)} · ${(() => {
                            let total = 0;
                            for (const dateStr of filteredDates) {
                              const pd = records[dateStr]?.data?.[selectedProduct];
                              if (pd) total += getProductTotal(pd);
                            }
                            return total;
                          })()}单`}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="搜索产品..." className="h-8" />
                    <CommandList className="max-h-[220px]">
                      <CommandEmpty>未找到产品</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__ALL__"
                          onSelect={() => {
                            setSelectedProduct('__ALL__');
                            setComboOpen(false);
                          }}
                          className="flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Check className={`h-3.5 w-3.5 shrink-0 ${selectedProduct === '__ALL__' ? 'text-primary opacity-100' : 'opacity-0'}`} />
                            <span className="truncate text-xs font-bold text-primary">
                              全部产品
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0 px-1.5 py-0 tabular-nums font-bold bg-primary/10 text-primary">
                            {productNames.reduce((s, n) => {
                              let total = 0;
                              for (const dateStr of filteredDates) {
                                const pd = records[dateStr]?.data?.[n];
                                if (pd) total += getProductTotal(pd);
                              }
                              return s + total;
                            }, 0)}单
                          </Badge>
                        </CommandItem>
                        {filteredProductNames.map((name) => {
                          const dn = getProductDisplayName(name, aliases);
                          let count = 0;
                          for (const dateStr of filteredDates) {
                            const pd = records[dateStr]?.data?.[name];
                            if (pd) count += getProductTotal(pd);
                          }
                          return (
                            <CommandItem
                              key={name}
                              value={name}
                              onSelect={() => {
                                setSelectedProduct(name);
                                setComboOpen(false);
                              }}
                              className="flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Check className={`h-3.5 w-3.5 shrink-0 ${selectedProduct === name ? 'text-primary opacity-100' : 'opacity-0'}`} />
                                <span className="truncate text-xs font-medium">
                                  {dn !== name ? `${dn} (${name})` : name}
                                </span>
                              </div>
                              <Badge variant="secondary" className="text-[10px] shrink-0 px-1.5 py-0 tabular-nums font-bold bg-primary/10 text-primary">
                                {count}单
                              </Badge>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* 自定义时间段选择器 - 日历选择 */}
          {timePeriod === 'custom' && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 text-xs gap-1.5 border-primary/20 hover:border-primary/40 bg-primary/5">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    {calendarRange?.from ? (
                      calendarRange.to ? (
                        <>{format(calendarRange.from, 'yyyy/MM/dd')} — {format(calendarRange.to, 'yyyy/MM/dd')}</>
                      ) : (
                        format(calendarRange.from, 'yyyy/MM/dd')
                      )
                    ) : (
                      '选择日期范围'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={calendarRange}
                    onSelect={setCalendarRange}
                    numberOfMonths={2}
                    defaultMonth={calendarRange?.from}
                  />
                </PopoverContent>
              </Popover>
              {calendarRange?.from && calendarRange?.to && (
                <Badge variant="outline" className="text-xs">
                  {filteredDates.length} 天数据
                </Badge>
              )}
            </div>
          )}

          {aggregatedData && aggregatedData.count > 1 && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 text-primary text-xs font-medium border border-primary/20">
              {searchKeyword.trim()
                ? <>关键词「{searchKeyword}」匹配 <span className="font-bold">{aggregatedData.count}</span> 个产品，{periodLabel}合计 <span className="font-bold">{aggregatedData.total}</span> 单 · 地域数据已聚合显示</>
                : <>{periodLabel}已聚合 <span className="font-bold">{aggregatedData.count}</span> 个产品，合计 <span className="font-bold">{aggregatedData.total}</span> 单 · {filteredDates.length} 天数据</>
              }
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 上面板：统计卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4 shadow-sm">
            <div className="text-[11px] text-muted-foreground mb-1.5">覆盖省份</div>
            <div className="text-2xl font-black text-primary tabular-nums">{chartData.length}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4 shadow-sm">
            <div className="text-[11px] text-muted-foreground mb-1.5">售后总数</div>
            <div className="text-2xl font-black text-emerald-600 tabular-nums">{totalValue}</div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 shadow-sm">
            <div className="text-[11px] text-muted-foreground mb-1.5">乡镇/村</div>
            <div className="text-2xl font-black text-amber-600 tabular-nums">{totalTownVillage}</div>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-500/5 p-4 shadow-sm">
            <div className="text-[11px] text-muted-foreground mb-1.5">乡镇占比</div>
            <div className="text-2xl font-black text-orange-600 tabular-nums">
              {totalValue > 0 ? ((totalTownVillage / totalValue) * 100).toFixed(1) : '0.0'}%
            </div>
          </div>
        </div>
      </div>

      {/* 分布视图 */}
      {viewMode === 'distribution' && (
        <Card className="brutal-card-lift border-primary/10">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  {chartType === 'map' ? <MapIcon className="h-4 w-4 text-primary" /> : <BarChart3 className="h-4 w-4 text-primary" />}
                  {chartType === 'map' ? '中国地域分布图' : '纵向分组柱状图'}
                  <Badge className="ml-1.5 text-xs bg-primary/15 text-primary border-0">
                    {periodLabel} · {filteredDates.length}天
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {chartType === 'map' ? '支持缩放拖拽查看，hover查看详情' : '乡镇/村与非乡镇紧挨着对比显示'}
                </CardDescription>
              </div>
              <div className="flex gap-1.5">
                {CHART_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={chartType === opt.value ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 px-3 text-[11px] gap-1.5 ${chartType === opt.value ? 'bg-primary text-primary-foreground shadow-md' : ''}`}
                    onClick={() => setChartType(opt.value)}
                  >
                    {opt.icon}
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[360px] text-muted-foreground text-sm">
                暂无地域分布数据
              </div>
            ) : (
              <div ref={chartRef} className="w-full" style={{ minHeight: '400px' }} />
            )}
          </CardContent>
        </Card>
      )}

      {/* 趋势视图 */}
      {viewMode === 'trend' && (
        <Card className="brutal-card-lift border-primary/10">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  地域趋势分布
                  <Badge className="ml-1.5 text-xs bg-primary/15 text-primary border-0">
                    {periodLabel} · {selectedRegions.length > 0 ? `已选 ${selectedRegions.length}` : `Top ${topRegions.length}`} 省份
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {selectedRegions.length > 0
                    ? `${periodLabel} 已选 ${selectedRegions.length} 个省份每日售后单数变化趋势`
                    : `${periodLabel} Top ${topRegions.length} 省份每日售后单数变化趋势`}
                </CardDescription>
              </div>
              {/* 省份筛选器 - 仅趋势视图 */}
              <Popover open={regionComboOpen} onOpenChange={setRegionComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-7 text-xs gap-1.5 border-primary/20 hover:border-primary/40 bg-primary/5 max-w-[260px]">
                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                    <span className="truncate">
                      {selectedRegions.length === 0
                        ? '全部省份 (Top 8)'
                        : `已选 ${selectedRegions.length} 个省份`}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="搜索省份..." className="h-8" />
                    <CommandList className="max-h-[240px]">
                      <CommandEmpty>未找到省份</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__ALL__"
                          onSelect={() => {
                            setSelectedRegions([]);
                            setRegionComboOpen(false);
                          }}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Check className={`h-3.5 w-3.5 shrink-0 ${selectedRegions.length === 0 ? 'text-primary opacity-100' : 'opacity-0'}`} />
                          <span className="text-xs font-bold text-primary">全部 (Top 8)</span>
                        </CommandItem>
                        {chartData.map((d) => (
                          <CommandItem
                            key={d.name}
                            value={d.name}
                            onSelect={() => {
                              setSelectedRegions((prev) =>
                                prev.includes(d.name)
                                  ? prev.filter((r) => r !== d.name)
                                  : [...prev, d.name]
                              );
                            }}
                            className="flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Check className={`h-3.5 w-3.5 shrink-0 ${selectedRegions.includes(d.name) ? 'text-primary opacity-100' : 'opacity-0'}`} />
                              <span className="truncate text-xs">{d.name}</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] shrink-0 px-1.5 py-0 tabular-nums font-bold bg-primary/10 text-primary">
                              {d.value}单
                            </Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {trendData.length === 0 || topRegions.length === 0 ? (
              <div className="flex items-center justify-center h-[360px] text-muted-foreground text-sm">
                暂无趋势数据
              </div>
            ) : (
              <div ref={trendChartRef} className="w-full h-[420px]" />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
