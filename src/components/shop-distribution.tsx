'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Store, Search, X, Check, ChevronsUpDown, BarChart3, TrendingUp, CalendarDays } from 'lucide-react';
import type { AllRecords, ProductAliases } from '@/lib/types';
import {
  getProductTotal, getShopDistribution,
  loadProductAliases, getProductDisplayName,
} from '@/lib/store';

const VIVID_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.96)',
  borderColor: '#d1fae5',
  borderWidth: 1,
  textStyle: { color: '#1e293b', fontSize: 12 },
  padding: [10, 14] as [number, number],
  extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-radius: 12px;',
};

type ShopChartType = 'bar' | 'line';
type TimePeriod = 'day' | 'week' | 'month';
type ViewMode = 'distribution' | 'trend';

const CHART_OPTIONS: { value: ShopChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'bar', label: '柱状图', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { value: 'line', label: '折线图', icon: <TrendingUp className="h-3.5 w-3.5" /> },
];

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

interface ShopDistributionProps {
  records: AllRecords;
  selectedDate: string | null;
  initialAliases?: ProductAliases;
}

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

  useEffect(() => {
    setAliases(initialAliases || loadProductAliases());
  }, [initialAliases]);

  // 根据时间段获取日期范围
  const dateRange = useMemo(() => {
    if (!selectedDate) return { start: '', end: '' };
    switch (timePeriod) {
      case 'day': return { start: selectedDate, end: selectedDate };
      case 'week': return getISOWeekRange(selectedDate);
      case 'month': return getMonthRange(selectedDate);
      default: return { start: selectedDate, end: selectedDate };
    }
  }, [selectedDate, timePeriod]);

  // 时间段内的日期列表
  const filteredDates = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    return Object.keys(records)
      .sort()
      .filter((d) => d >= dateRange.start && d <= dateRange.end);
  }, [records, dateRange]);

  // 所有产品名称
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
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
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

  // 时间段内所有可用店铺（用于趋势筛选下拉）
  const allShops = useMemo(() => {
    const shopTotals = new Map<string, number>();
    for (const dateStr of filteredDates) {
      const record = records[dateStr];
      if (!record) continue;
      for (const pname of productNames) {
        const pd = record.data[pname];
        if (!pd) continue;
        const sh = getShopDistribution(pd);
        for (const [shop, count] of Object.entries(sh)) {
          shopTotals.set(shop, (shopTotals.get(shop) || 0) + count);
        }
      }
    }
    return Array.from(shopTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [filteredDates, records, productNames]);

  // 按店铺筛选后的产品列表（仅趋势视图使用）
  const shopFilteredProducts = useMemo(() => {
    if (selectedFilterShops.length === 0) return productsToAggregate;
    const result: string[] = [];
    for (const pname of productsToAggregate) {
      let hasShop = false;
      for (const dateStr of filteredDates) {
        const pd = records[dateStr]?.data?.[pname];
        if (!pd) continue;
        const sh = getShopDistribution(pd);
        for (const shop of selectedFilterShops) {
          if (sh[shop] > 0) { hasShop = true; break; }
        }
        if (hasShop) break;
      }
      if (hasShop) result.push(pname);
    }
    return result;
  }, [selectedFilterShops, productsToAggregate, filteredDates, records]);

  // 聚合时间段内所有日期的店铺数据
  const aggregatedData = useMemo(() => {
    const targetProducts = searchKeyword.trim()
      ? filteredProductNames
      : productsToAggregate;
    if (targetProducts.length === 0 || filteredDates.length === 0) return null;

    const aggShop: Record<string, number> = {};
    let aggTotal = 0;

    for (const dateStr of filteredDates) {
      const record = records[dateStr];
      if (!record) continue;
      for (const pname of targetProducts) {
        const pd = record.data[pname];
        if (!pd) continue;
        aggTotal += getProductTotal(pd);
        const sh = getShopDistribution(pd);
        for (const [shop, count] of Object.entries(sh)) {
          aggShop[shop] = (aggShop[shop] || 0) + count;
        }
      }
    }

    return { shop: aggShop, total: aggTotal, count: targetProducts.length };
  }, [searchKeyword, filteredProductNames, productsToAggregate, filteredDates, records]);

  const displayShop = aggregatedData ? aggregatedData.shop : ({} as Record<string, number>);

  const chartData = useMemo(() =>
    Object.entries(displayShop)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    [displayShop]
  );

  // 趋势数据：按日期拆分 Top 8 店铺
  const topShops = useMemo(() => {
    return chartData.slice(0, 8).map((d) => d.name);
  }, [chartData]);

  // 趋势专用：受店铺筛选影响的聚合
  const trendAggShop = useMemo(() => {
    const targetProducts = searchKeyword.trim()
      ? filteredProductNames
      : shopFilteredProducts;
    if (targetProducts.length === 0 || filteredDates.length === 0) return {} as Record<string, number>;

    const aggShop: Record<string, number> = {};
    for (const dateStr of filteredDates) {
      const record = records[dateStr];
      if (!record) continue;
      for (const pname of targetProducts) {
        const pd = record.data[pname];
        if (!pd) continue;
        const sh = getShopDistribution(pd);
        for (const [shop, count] of Object.entries(sh)) {
          aggShop[shop] = (aggShop[shop] || 0) + count;
        }
      }
    }
    return aggShop;
  }, [searchKeyword, filteredProductNames, shopFilteredProducts, filteredDates, records]);

  const trendTopShops = useMemo(() => {
    // 如果手动选了店铺，直接使用选中的店铺（按总量排序）
    if (selectedFilterShops.length > 0) {
      return selectedFilterShops
        .map((name) => ({ name, count: trendAggShop[name] || 0 }))
        .sort((a, b) => b.count - a.count)
        .map((s) => s.name);
    }
    return Object.entries(trendAggShop)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [trendAggShop, selectedFilterShops]);

  const trendData = useMemo(() => {
    if (filteredDates.length === 0 || trendTopShops.length === 0) return [];
    const targetProducts = searchKeyword.trim()
      ? filteredProductNames
      : shopFilteredProducts;

    return filteredDates.map((dateStr) => {
      const record = records[dateStr];
      const d = new Date(dateStr);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
      const label = `${month}/${day} 周${weekDays[d.getDay()]}`;

      const shopCount: Record<string, number> = {};
      for (const pname of targetProducts) {
        const pd = record?.data?.[pname];
        if (!pd) continue;
        const sh = getShopDistribution(pd);
        for (const [shop, count] of Object.entries(sh)) {
          shopCount[shop] = (shopCount[shop] || 0) + count;
        }
      }

      const point: { date: string; label: string; [shop: string]: string | number } = { date: dateStr, label };
      for (const shop of trendTopShops) {
        point[shop] = shopCount[shop] || 0;
      }
      return point;
    });
  }, [filteredDates, trendTopShops, searchKeyword, filteredProductNames, shopFilteredProducts, records]);

  // 时间段标签
  const periodLabel = useMemo(() => {
    switch (timePeriod) {
      case 'day': return '当日';
      case 'week': return '当周';
      case 'month': return '当月';
    }
  }, [timePeriod]);

  // 分布图表渲染
  useEffect(() => {
    if (viewMode !== 'distribution') return;
    if (!chartRef.current || chartData.length === 0) return;

    // 确保 chart 实例绑定到当前 DOM（视图切换后 DOM 会重建）
    if (chartInstanceRef.current) {
      try { chartInstanceRef.current.dispose(); } catch { /* ignore */ }
      chartInstanceRef.current = null;
    }
    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const sorted = [...chartData].sort((a, b) => b.value - a.value);
    const names = sorted.map((d) => d.name);
    const values = sorted.map((d) => d.value);
    const total = values.reduce((s, v) => s + v, 0);

    let option: echarts.EChartsOption;

    if (chartType === 'bar') {
      chartRef.current.style.height = `${Math.max(420, chartData.length > 10 ? 500 : 420)}px`;

      option = {
        tooltip: {
          ...TOOLTIP_STYLE,
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: unknown) => {
            const ps = params as { name: string; value: number; seriesName: string }[];
            if (!ps || ps.length === 0) return '';
            const p = ps[0];
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0';
            return `<b>${p.name}</b><br/>` +
              `<span style="color:#10b981;">●</span> 售后单数: <b>${p.value}</b><br/>` +
              `<span style="color:#8b5cf6;">●</span> 占比: <b>${pct}%</b>`;
          },
        },
        grid: { left: '3%', right: '8%', bottom: chartData.length > 8 ? '16%' : '8%', top: '12%', containLabel: true },
        dataZoom: chartData.length > 8 ? [
          {
            type: 'slider', xAxisIndex: 0, bottom: 8, height: 18,
            startValue: 0, endValue: 7,
            borderColor: 'transparent', backgroundColor: '#f1f5f9',
            fillerColor: 'rgba(16,185,129,0.15)',
            handleStyle: { color: '#10b981' },
            textStyle: { fontSize: 10, color: '#94a3b8' },
          },
          { type: 'inside', xAxisIndex: 0 },
        ] : undefined,
        xAxis: {
          type: 'category',
          data: names,
          axisLabel: {
            color: '#475569', fontSize: 11,
            rotate: chartData.length > 6 ? 35 : 0,
            width: 80, overflow: 'truncate',
          },
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${Math.round(v)}` },
          splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [{
          name: '售后单数',
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 1, 0, 0, [
                { offset: 0, color: VIVID_COLORS[i % VIVID_COLORS.length] + '88' },
                { offset: 1, color: VIVID_COLORS[i % VIVID_COLORS.length] },
              ]),
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: '50%',
        }],
      };
    } else {
      // 折线图
      chartRef.current.style.height = '440px';

      const pcts = values.map((v) => (total > 0 ? Math.round((v / total) * 100) : 0));

      option = {
        tooltip: {
          ...TOOLTIP_STYLE,
          trigger: 'axis',
          formatter: (params: unknown) => {
            const ps = params as { name: string; value: number; seriesName: string; marker: string }[];
            if (!ps || ps.length === 0) return '';
            const name = ps[0].name;
            let html = `<b>${name}</b><br/>`;
            for (const p of ps) {
              html += `${p.marker} ${p.seriesName}: <b>${p.value}${p.seriesName === '占比' ? '%' : ''}</b><br/>`;
            }
            return html;
          },
        },
        legend: {
          top: 4, right: 10,
          textStyle: { fontSize: 11, color: '#64748b' },
          itemWidth: 14, itemHeight: 8,
        },
        grid: { left: '3%', right: '8%', bottom: chartData.length > 8 ? '16%' : '8%', top: '14%', containLabel: true },
        dataZoom: chartData.length > 8 ? [
          {
            type: 'slider', xAxisIndex: 0, bottom: 8, height: 18,
            startValue: 0, endValue: 7,
            borderColor: 'transparent', backgroundColor: '#f1f5f9',
            fillerColor: 'rgba(16,185,129,0.15)',
            handleStyle: { color: '#10b981' },
            textStyle: { fontSize: 10, color: '#94a3b8' },
          },
          { type: 'inside', xAxisIndex: 0 },
        ] : undefined,
        xAxis: {
          type: 'category',
          data: names,
          axisLabel: {
            color: '#475569', fontSize: 11,
            rotate: chartData.length > 6 ? 35 : 0,
            width: 80, overflow: 'truncate',
          },
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          axisTick: { show: false },
        },
        yAxis: [
          {
            type: 'value',
            axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${Math.round(v)}` },
            splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
            axisLine: { show: false },
            axisTick: { show: false },
          },
          {
            type: 'value',
            name: '',
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
            name: '售后单数',
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 7,
            lineStyle: { width: 2.5, color: '#10b981' },
            itemStyle: { color: '#10b981' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(16,185,129,0.25)' },
                { offset: 1, color: 'rgba(16,185,129,0.02)' },
              ]),
            },
            data: values,
          },
          {
            name: '占比',
            type: 'line',
            smooth: true,
            symbol: 'diamond',
            symbolSize: 6,
            yAxisIndex: 1,
            lineStyle: { width: 2.5, color: '#8b5cf6' },
            itemStyle: { color: '#8b5cf6' },
            data: pcts,
          },
        ],
      };
    }

    chart.setOption(option, true);
    chart.resize();

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      try { chart.dispose(); } catch { /* ignore */ }
      chartInstanceRef.current = null;
    };
  }, [chartData, chartType, viewMode]);

  // 趋势图表渲染
  useEffect(() => {
    if (viewMode !== 'trend') return;
    if (!trendChartRef.current || trendData.length === 0 || trendTopShops.length === 0) return;

    // 确保 chart 实例绑定到当前 DOM
    if (trendChartInstanceRef.current) {
      try { trendChartInstanceRef.current.dispose(); } catch { /* ignore */ }
      trendChartInstanceRef.current = null;
    }
    const chart = echarts.init(trendChartRef.current);
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
      series: trendTopShops.map((shop, i) => {
        const c = VIVID_COLORS[i % VIVID_COLORS.length];
        return {
          name: shop,
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
          data: trendData.map((d) => (d[shop] as number) || 0),
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
  }, [trendData, trendTopShops, viewMode]);

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
    <div className="space-y-4">
      {/* 筛选控件 */}
      <Card className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                店铺分布
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                按店铺查看红色旗子售后分布，支持搜索聚合
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
	              </div>

              {/* 视图切换 */}
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
              <div className="relative w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索产品聚合..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
                {searchKeyword && (
                  <button onClick={() => setSearchKeyword('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* 产品选择 */}
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-[220px] h-8 justify-between text-xs font-medium border-primary/20 hover:border-primary/40 bg-primary/5"
                  >
                    <span className="truncate">
                      {selectedProduct === '__ALL__'
                        ? `全部产品 (${productNames.reduce((s, n) => {
                            let total = 0;
                            for (const dateStr of filteredDates) {
                              const pd = records[dateStr]?.data?.[n];
                              if (pd) total += getProductTotal(pd);
                            }
                            return s + total;
                          }, 0)}单)`
                        : `${getProductDisplayName(selectedProduct, aliases)} (${(() => {
                            let total = 0;
                            for (const dateStr of filteredDates) {
                              const pd = records[dateStr]?.data?.[selectedProduct];
                              if (pd) total += getProductTotal(pd);
                            }
                            return total;
                          })()}单)`}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="搜索产品..." className="h-8" />
                    <CommandList className="max-h-[200px]">
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


          {/* 搜索聚合提示 */}
          {aggregatedData && aggregatedData.count > 1 && (
            <div className="mt-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
              {searchKeyword.trim()
                ? `关键词「${searchKeyword}」匹配 ${aggregatedData.count} 个产品，${periodLabel}合计 ${aggregatedData.total} 单 — 店铺数据已聚合显示`
                : `${periodLabel}已聚合 ${aggregatedData.count} 个产品，合计 ${aggregatedData.total} 单 · ${filteredDates.length}天数据`
              }
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 分布视图 */}
      {viewMode === 'distribution' && (
        <Card className="border-primary/10">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                店铺分布图
                <Badge className="ml-1 text-xs bg-primary/15 text-primary border-0">
                  {periodLabel} · {filteredDates.length}天
                </Badge>
              </CardTitle>
              <div className="flex gap-1">
                {CHART_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={chartType === opt.value ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 px-3 gap-1.5 text-xs ${chartType === opt.value ? 'shadow-sm' : ''}`}
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
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                无店铺分布数据
              </div>
            ) : (
              <div ref={chartRef} className="w-full" style={{ minHeight: '420px' }} />
            )}
          </CardContent>
        </Card>
      )}

      {/* 趋势视图 */}
      {viewMode === 'trend' && (
        <Card className="border-primary/10">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  店铺趋势分布
                  <Badge className="ml-1.5 text-xs bg-primary/15 text-primary border-0">
                    {periodLabel} · {selectedFilterShops.length > 0 ? `已选店铺 · ` : ''}Top {trendTopShops.length} 店铺
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {selectedFilterShops.length > 0
                    ? `${periodLabel} 已选 ${selectedFilterShops.length} 家店铺每日趋势`
                    : `${periodLabel} Top ${trendTopShops.length} 店铺每日售后单数变化趋势`}
                </CardDescription>
              </div>
              {/* 店铺筛选器 - 仅趋势视图 */}
              <Popover open={shopComboOpen} onOpenChange={setShopComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-7 text-xs gap-1.5 border-primary/20 hover:border-primary/40 bg-primary/5 max-w-[260px]">
                    <Store className="h-3 w-3 text-primary shrink-0" />
                    <span className="truncate">
                      {selectedFilterShops.length === 0
                        ? '全部店铺'
                        : `已选 ${selectedFilterShops.length} 家店铺`}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="搜索店铺..." className="h-8" />
                    <CommandList className="max-h-[240px]">
                      <CommandEmpty>未找到店铺</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__ALL__"
                          onSelect={() => {
                            setSelectedFilterShops([]);
                            setShopComboOpen(false);
                          }}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Check className={`h-3.5 w-3.5 shrink-0 ${selectedFilterShops.length === 0 ? 'text-primary opacity-100' : 'opacity-0'}`} />
                          <span className="text-xs font-bold text-primary">全部店铺</span>
                        </CommandItem>
                        {allShops.map((s) => (
                          <CommandItem
                            key={s.name}
                            value={s.name}
                            onSelect={() => {
                              setSelectedFilterShops((prev) =>
                                prev.includes(s.name)
                                  ? prev.filter((x) => x !== s.name)
                                  : [...prev, s.name]
                              );
                            }}
                            className="flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Check className={`h-3.5 w-3.5 shrink-0 ${selectedFilterShops.includes(s.name) ? 'text-primary opacity-100' : 'opacity-0'}`} />
                              <span className="truncate text-xs">{s.name}</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] shrink-0 px-1.5 py-0 tabular-nums font-bold bg-primary/10 text-primary">
                              {s.count}单
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
            {trendData.length === 0 || trendTopShops.length === 0 ? (
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
