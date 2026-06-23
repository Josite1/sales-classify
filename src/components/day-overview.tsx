'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  ShoppingCart,
  Zap,
  CalendarDays,
  ChevronsUpDown,
  Check,
  Trophy,
  X,
  Filter,
  Search,
  Store,
  CornerDownLeft
} from 'lucide-react';
import { registerBrutalTheme, getBrutalTooltip, getBrutalGrid, getBrutalXAxis, getBrutalYAxis, BRUTAL_COLORS } from '@/lib/echarts-theme';
import * as echarts from 'echarts';
import type { AllRecords, ProductAliases, ShopItem } from '@/lib/types';
import {
  getProductTotal,
  getProductDisplayName,
  loadProductAliases,
  getFlags,
  getRedFlagReasons,
  getShopCount
} from '@/lib/store';

// Register brutalist theme
if (typeof window !== 'undefined') {
  registerBrutalTheme(echarts);
}

type TimeMode = 'day' | 'week' | 'month' | 'year' | 'custom';

interface DayOverviewProps {
  records: AllRecords;
  selectedDate: string | null;
}

// ============ 日期范围工具函数（保持不变） ============
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

function getYearRange(dateStr: string): { start: string; end: string } {
  const year = new Date(dateStr).getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

// ============ 多选下拉组件（保持不变） ============
function MultiSelect({
  title,
  options,
  selected,
  onChange,
  placeholder = "搜索...",
  highlighted = false,
  iconType = 'shop',
}: {
  title: string;
  options: { label: string; value: string; count: number }[];
  selected: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
  highlighted?: boolean;
  iconType?: 'shop' | 'product';
}) {
  const [open, setOpen] = useState(false);
  const ItemIcon = iconType === 'shop' ? Store : Package;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-8 border-dashed flex gap-2 w-auto min-w-[130px] justify-between px-3 bg-background transition-all duration-200 ${
            highlighted
              ? 'border-primary/60 ring-1 ring-primary/25 shadow-sm shadow-primary/10'
              : ''
          } ${open ? 'border-primary/50 bg-primary/5' : ''} animate-fade-in`}
        >
          <div className="flex items-center gap-1.5 text-xs">
            {iconType === 'shop' ? (
              <Store className={`h-3 w-3 ${highlighted ? 'text-primary' : 'text-muted-foreground'}`} />
            ) : (
              <Package className={`h-3 w-3 ${highlighted ? 'text-primary' : 'text-muted-foreground'}`} />
            )}
            <span className={`font-medium ${highlighted ? 'text-primary' : 'text-muted-foreground'}`}>
              {title}
            </span>
            {selected.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0 h-4 text-[10px] rounded-sm font-bold bg-primary/10 text-primary animate-pop"
              >
                {selected.length}
              </Badge>
            )}
          </div>
          <ChevronsUpDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-primary' : 'opacity-50'}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0 shadow-lg border-primary/10 animate-slide-up" align="start">
        <Command>
          <CommandInput placeholder={placeholder} className="h-9 text-xs" />
          <CommandList className="max-h-[220px]">
            <CommandEmpty className="text-xs p-4 text-center text-muted-foreground">
              未找到匹配项
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selected.includes(opt.value);
                const isZero = opt.count === 0;
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => {
                      if (isSelected) {
                        onChange(selected.filter((v) => v !== opt.value));
                      } else {
                        onChange([...selected, opt.value]);
                      }
                    }}
                    className="text-xs flex items-center gap-2.5 cursor-pointer py-1.5 transition-colors duration-150"
                  >
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-sm border shrink-0 transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground scale-110'
                          : 'border-input opacity-50'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 animate-check" />}
                    </div>
                    <ItemIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{opt.label}</span>
                    <Badge
                      variant={isZero ? 'outline' : 'secondary'}
                      className={`ml-auto px-1.5 py-0 h-4 text-[10px] font-mono tabular-nums shrink-0 transition-all duration-300 ${
                        isZero
                          ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                          : ''
                      }`}
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
  );
}

// ============ 数据聚合函数（保持不变） ============
interface FilteredSummary {
  totalOrders: number;
  redFlags: number;
  productBreakdown: { name: string; total: number; redFlags: number }[];
  topReasons: [string, number][];
}

function computeFilteredSummary(
  records: AllRecords,
  startDate: string,
  endDate: string,
  selectedProducts: string[],
  selectedShops: string[]
): FilteredSummary | null {
  let totalOrders = 0;
  let redFlags = 0;
  const productMap: Record<string, { total: number; redFlags: number; reasons: Record<string, number> }> = {};

  const dates = Object.keys(records).filter((d) => d >= startDate && d <= endDate);
  if (dates.length === 0) return null;

  dates.forEach((d) => {
    const record = records[d];
    Object.entries(record.data).forEach(([pName, pData]) => {
      if (selectedProducts.length > 0 && !selectedProducts.includes(pName)) return;

      let pTotal = 0;
      let pRedFlags = 0;

      if (selectedShops.length > 0) {
        const shopStats = pData['店铺分类'] || {};
        let hasMatch = false;

        Object.entries(shopStats).forEach(([flag, shopsInFlag]) => {
          if (!shopsInFlag || typeof shopsInFlag !== 'object') return;
          Object.entries(shopsInFlag as Record<string, ShopItem | number>).forEach(([sName, shopVal]) => {
            if (selectedShops.includes(sName)) {
              const count = getShopCount(shopVal);
              hasMatch = true;
              pTotal += count;
              if (flag === '红色旗子') pRedFlags += count;
            }
          });
        });

        if (!hasMatch) return;
      } else {
        pTotal = getProductTotal(pData);
        pRedFlags = getFlags(pData)['红色旗子'] || 0;
      }

      if (pTotal === 0) return;

      totalOrders += pTotal;
      redFlags += pRedFlags;

      if (!productMap[pName]) productMap[pName] = { total: 0, redFlags: 0, reasons: {} };
      productMap[pName].total += pTotal;
      productMap[pName].redFlags += pRedFlags;

      const reasons = getRedFlagReasons(pData);
      Object.entries(reasons).forEach(([r, c]) => {
        productMap[pName].reasons[r] = (productMap[pName].reasons[r] || 0) + c;
      });
    });
  });

  if (totalOrders === 0) return null;

  const productBreakdown = Object.entries(productMap)
    .map(([name, data]) => ({ name, total: data.total, redFlags: data.redFlags }))
    .sort((a, b) => b.total - a.total);

  const reasonAgg: Record<string, number> = {};
  Object.values(productMap).forEach((d) => {
    Object.entries(d.reasons).forEach(([r, c]) => {
      reasonAgg[r] = (reasonAgg[r] || 0) + c;
    });
  });
  const topReasons = Object.entries(reasonAgg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return { totalOrders, redFlags, productBreakdown, topReasons };
}

// ============ 产品售后排名柱状图组件（保持不变） ============
interface GlobalProductColumnProps {
  products: { originalName: string; name: string; value: number }[];
  dateLabel: string;
}

const BAR_COLORS = BRUTAL_COLORS;

function GlobalProductColumn({ products, dateLabel }: GlobalProductColumnProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || products.length === 0) return;
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current, 'brutal');
    }
    const chart = chartInstanceRef.current;

    const medals = ['🥇', '🥈', '🥉'];

    chart.setOption(
      {
        tooltip: { ...getBrutalTooltip(), trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: {
          left: '2%',
          right: '2%',
          bottom: products.length > 10 ? '15%' : '5%',
          top: '12%',
          containLabel: true,
        },
        dataZoom:
          products.length > 10
            ? [
                {
                  type: 'slider',
                  xAxisIndex: 0,
                  bottom: 0,
                  height: 18,
                  start: 0,
                  end: Math.min(100, (15 / products.length) * 100),
                  borderColor: 'transparent',
                  backgroundColor: '#f0fdf4',
                  fillerColor: 'rgba(16,185,129,0.2)',
                  handleStyle: { color: '#14b8a6', borderColor: '#14b8a6' },
                  textStyle: { color: '#64748b', fontSize: 10 },
                },
                { type: 'inside', xAxisIndex: 0 },
              ]
            : undefined,
        xAxis: {
          type: 'category',
          data: products.map((p) => p.name),
          axisLabel: {
            interval: 0,
            rotate: 30,
            formatter: (value: string, index: number) => {
              const medal = index < 3 ? medals[index] + ' ' : '';
              const label = value.length > 8 ? value.slice(0, 8) + '...' : value;
              return medal + label;
            },
            color: (value: string, index: number) => {
              if (index === 0) return '#f59e0b';
              if (index === 1) return '#94a3b8';
              if (index === 2) return '#cd7f32';
              return '#475569';
            },
            fontSize: 11,
            fontWeight: 'bold',
          },
          axisTick: { alignWithLabel: true },
          axisLine: { lineStyle: { color: '#e2e8f0' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#94a3b8', fontSize: 11 },
          splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [
          {
            name: '售后数',
            type: 'bar',
            data: products.map((p, i) => {
              const c = BAR_COLORS[i % BAR_COLORS.length];
              return {
                value: p.value,
                name: p.name,
                itemStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: c },
                    { offset: 0.5, color: c + 'cc' },
                    { offset: 1, color: c + '44' },
                  ]),
                },
              };
            }),
            barMaxWidth: 45,
            label: {
              show: true,
              position: 'top',
              fontSize: 12,
              fontWeight: 'bold',
              fontFamily: 'tabular-nums',
              color: '#1e293b',
            },
          },
        ],
        animationDuration: 800,
        animationEasing: 'cubicOut',
      },
      true
    );

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [products]);

  return (
    <Card className="border-primary/10 shadow-sm animate-slide-up">
      <CardHeader className="pb-1 pt-4">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500 animate-bounce-slow" />
          产品售后排名
          <Badge variant="outline" className="ml-auto text-xs tabular-nums">
            {dateLabel} · {products.length} 产品
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-1 pb-1">
        <div ref={chartRef} className="w-full h-[450px]" />
      </CardContent>
    </Card>
  );
}

// ============ 主组件 DayOverview ============
export function DayOverview({ records, selectedDate }: DayOverviewProps) {
  const [timeMode, setTimeMode] = useState<TimeMode>('day');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedShops, setSelectedShops] = useState<string[]>([]);

  const [aggregateSearch, setAggregateSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [aliases, setAliases] = useState<ProductAliases>({});

  useEffect(() => {
    setAliases(loadProductAliases());
  }, []);

  // 防抖
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(aggregateSearch.trim());
    }, 280);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [aggregateSearch]);

  // 重置自定义范围
  useEffect(() => {
    if (selectedDate) {
      setCustomStart(selectedDate);
      setCustomEnd(selectedDate);
    }
  }, [selectedDate]);

  // 日期范围
  const dateRange = useMemo(() => {
    if (!selectedDate) return null;
    switch (timeMode) {
      case 'day':
        return { start: selectedDate, end: selectedDate };
      case 'week':
        return getISOWeekRange(selectedDate);
      case 'month':
        return getMonthRange(selectedDate);
      case 'year':
        return getYearRange(selectedDate);
      case 'custom':
        if (customStart && customEnd) return { start: customStart, end: customEnd };
        return null;
      default:
        return null;
    }
  }, [selectedDate, timeMode, customStart, customEnd]);

  // 动态选项数量（逻辑不变）
  const { productOptions, shopOptions, allShops, allProducts } = useMemo(() => {
    const productCount: Record<string, number> = {};
    const shopCount: Record<string, number> = {};
    const productsSet = new Set<string>();
    const shopsSet = new Set<string>();

    if (!dateRange) {
      return {
        productOptions: [],
        shopOptions: [],
        allShops: [] as string[],
        allProducts: [] as string[],
      };
    }

    const dates = Object.keys(records).filter(
      (d) => d >= dateRange.start && d <= dateRange.end
    );

    // 收集全集
    dates.forEach((d) => {
      const record = records[d];
      Object.entries(record.data).forEach(([pName, pData]) => {
        productsSet.add(pName);
        const shopStats = pData['店铺分类'] || {};
        Object.values(shopStats).forEach((shopsInFlag) => {
          if (!shopsInFlag || typeof shopsInFlag !== 'object') return;
          Object.keys(shopsInFlag as Record<string, ShopItem | number>).forEach((s) => shopsSet.add(s));
        });
      });
    });

    productsSet.forEach((p) => (productCount[p] = 0));
    shopsSet.forEach((s) => (shopCount[s] = 0));

    dates.forEach((d) => {
      const record = records[d];
      Object.entries(record.data).forEach(([pName, pData]) => {
        const shopStats = pData['店铺分类'] || {};

        if (selectedShops.length > 0) {
          let pTotal = 0;
          Object.entries(shopStats).forEach(([, shopsInFlag]) => {
            if (!shopsInFlag || typeof shopsInFlag !== 'object') return;
            Object.entries(shopsInFlag as Record<string, ShopItem | number>).forEach(([sName, shopVal]) => {
              if (selectedShops.includes(sName)) {
                pTotal += getShopCount(shopVal);
              }
            });
          });
          if (pTotal > 0) productCount[pName] += pTotal;
        } else {
          productCount[pName] += getProductTotal(pData);
        }

        if (selectedProducts.length > 0 && !selectedProducts.includes(pName)) {
          return;
        }
        Object.entries(shopStats).forEach(([, shopsInFlag]) => {
          if (!shopsInFlag || typeof shopsInFlag !== 'object') return;
          Object.entries(shopsInFlag as Record<string, ShopItem | number>).forEach(([sName, shopVal]) => {
            shopCount[sName] += getShopCount(shopVal);
          });
        });
      });
    });

    const productOptions = Array.from(productsSet)
      .map((p) => ({
        label: getProductDisplayName(p, aliases),
        value: p,
        count: productCount[p] || 0,
      }))
      .sort((a, b) => b.count - a.count);

    const shopOptions = Array.from(shopsSet)
      .map((s) => ({
        label: s,
        value: s,
        count: shopCount[s] || 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      productOptions,
      shopOptions,
      allShops: Array.from(shopsSet),
      allProducts: Array.from(productsSet),
    };
  }, [records, dateRange, selectedProducts, selectedShops, aliases]);

  // 聚合搜索自动选中（逻辑不变）
  useEffect(() => {
    const keyword = debouncedSearch.toLowerCase();
    if (!keyword || allShops.length === 0) return;

    const matchedShops = allShops.filter((s) =>
      s.toLowerCase().includes(keyword)
    );
    const matchedProducts = allProducts.filter((p) => {
      const displayName = getProductDisplayName(p, aliases);
      return (
        p.toLowerCase().includes(keyword) || displayName.toLowerCase().includes(keyword)
      );
    });

    if (matchedShops.length > 0 || matchedProducts.length > 0) {
      setSelectedShops((prev) => {
        const newSet = new Set([...prev, ...matchedShops]);
        if (newSet.size === prev.length && prev.every((v) => newSet.has(v))) return prev;
        return Array.from(newSet);
      });
      setSelectedProducts((prev) => {
        const newSet = new Set([...prev, ...matchedProducts]);
        if (newSet.size === prev.length && prev.every((v) => newSet.has(v))) return prev;
        return Array.from(newSet);
      });
    }
  }, [debouncedSearch, allShops, allProducts, aliases]);

  const aggregateMatchCount = useMemo(() => {
    const keyword = aggregateSearch.trim().toLowerCase();
    if (!keyword) return 0;
    let count = 0;
    count += allShops.filter((s) => s.toLowerCase().includes(keyword)).length;
    count += allProducts.filter((p) => {
      const displayName = getProductDisplayName(p, aliases);
      return p.toLowerCase().includes(keyword) || displayName.toLowerCase().includes(keyword);
    }).length;
    return count;
  }, [aggregateSearch, allShops, allProducts, aliases]);

  const isAggregateSearchActive = debouncedSearch.length > 0;

  // 汇总数据
  const summary = useMemo(() => {
    if (!dateRange) return null;
    return computeFilteredSummary(
      records,
      dateRange.start,
      dateRange.end,
      selectedProducts,
      selectedShops
    );
  }, [records, dateRange, selectedProducts, selectedShops]);

  // 前一周期汇总
  const prevSummary = useMemo(() => {
    if (!dateRange || !selectedDate) return null;
    let prevRange: { start: string; end: string } | null = null;
    switch (timeMode) {
      case 'day': {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - 1);
        const prev = d.toISOString().slice(0, 10);
        prevRange = { start: prev, end: prev };
        break;
      }
      case 'week': {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - 7);
        prevRange = getISOWeekRange(d.toISOString().slice(0, 10));
        break;
      }
      case 'month': {
        const d = new Date(selectedDate);
        d.setMonth(d.getMonth() - 1);
        prevRange = getMonthRange(d.toISOString().slice(0, 10));
        break;
      }
      case 'year': {
        const d = new Date(selectedDate);
        d.setFullYear(d.getFullYear() - 1);
        prevRange = getYearRange(d.toISOString().slice(0, 10));
        break;
      }
      case 'custom':
        return null;
    }
    if (!prevRange) return null;
    return computeFilteredSummary(
      records,
      prevRange.start,
      prevRange.end,
      selectedProducts,
      selectedShops
    );
  }, [records, selectedDate, timeMode, dateRange, selectedProducts, selectedShops]);

  const dateLabel = useMemo(() => {
    if (!dateRange) return '';
    if (dateRange.start === dateRange.end) return dateRange.start;
    return `${dateRange.start} ~ ${dateRange.end}`;
  }, [dateRange]);

  const handleClearAllFilters = useCallback(() => {
    setSelectedProducts([]);
    setSelectedShops([]);
    setAggregateSearch('');
    setDebouncedSearch('');
  }, []);

  const handleClearAggregateSearch = useCallback(() => {
    setAggregateSearch('');
    setDebouncedSearch('');
  }, []);

  if (!dateRange) {
    return (
      <Card className="animate-fade-in">
        <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">请选择日期查看数据总览</p>
        </CardContent>
      </Card>
    );
  }

  const orderChange =
    prevSummary && summary ? summary.totalOrders - prevSummary.totalOrders : null;
  const orderChangePercent =
    prevSummary && prevSummary.totalOrders > 0 && orderChange !== null
      ? ((orderChange / prevSummary.totalOrders) * 100).toFixed(1)
      : null;
  const redFlagChange =
    prevSummary && summary ? summary.redFlags - prevSummary.redFlags : null;

  const cards = summary
    ? [
        {
          label: '总售后单数',
          value: summary.totalOrders,
          icon: ShoppingCart,
          accentColor: '#14b8a6',
          iconBg: 'rgba(16,185,129,0.12)',
          change: orderChange,
          changePercent: orderChangePercent,
          changeUp: orderChange !== null && orderChange >= 0,
        },
        {
          label: '涉及产品',
          value: summary.productBreakdown.length,
          icon: Package,
          accentColor: '#3b82f6',
          iconBg: 'rgba(59,130,246,0.12)',
        },
        {
          label: '红旗标记',
          value: summary.redFlags,
          icon: AlertTriangle,
          accentColor: '#ef4444',
          iconBg: 'rgba(239,68,68,0.12)',
          change: redFlagChange,
          changeUp: redFlagChange !== null && redFlagChange >= 0,
          isRedFlag: true,
        },
        {
          label: 'Top 异常原因',
          icon: Zap,
          accentColor: '#f59e0b',
          iconBg: 'rgba(245,158,11,0.12)',
          isTopReason: true,
        },
      ]
    : [];

  const timeModeLabels: Record<TimeMode, string> = {
    day: '日',
    week: '周',
    month: '月',
    year: '年',
    custom: '自定义',
  };

  return (
    <div className="space-y-4">
      {/* ========== 注入全局动画样式 ========== */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes ripple {
          to { transform: scale(4); opacity: 0; }
        }
        @keyframes glowPulse {
          0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.3); }
          100% { box-shadow: 0 0 0 6px rgba(59,130,246,0); }
        }
        @keyframes bounceSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes numberPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); color: var(--accent); }
          100% { transform: scale(1); }
        }
        @keyframes borderGlow {
          0% { border-color: rgba(59,130,246,0.2); }
          50% { border-color: rgba(59,130,246,0.5); }
          100% { border-color: rgba(59,130,246,0.2); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-scale-in {
          animation: scaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-pop {
          animation: pop 0.3s ease-out;
        }
        .animate-check {
          stroke-dasharray: 20;
          stroke-dashoffset: 20;
          animation: checkDraw 0.3s ease forwards 0.1s;
        }
        .animate-bounce-slow {
          animation: bounceSlow 2s infinite ease-in-out;
        }
        .animate-shimmer {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        .animate-glow-pulse:focus {
          animation: glowPulse 1.2s ease-out;
        }
        .animate-number-pop {
          animation: numberPop 0.4s ease-out;
        }
        .animate-border-glow {
          animation: borderGlow 2s infinite;
        }
        .ripple-btn {
          position: relative;
          overflow: hidden;
        }
        .ripple-btn::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 10px;
          height: 10px;
          background: rgba(255,255,255,0.4);
          opacity: 0;
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(1);
          pointer-events: none;
        }
        .ripple-btn:active::after {
          animation: ripple 0.5s ease-out;
        }
        .card-hover-effect {
          transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .card-hover-effect:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 24px -8px rgba(0,0,0,0.12);
        }
        .bg-gradient-card {
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        }
        .dark .bg-gradient-card {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        }
        .stat-icon-glow {
          transition: all 0.3s ease;
        }
        .card-hover-effect:hover .stat-icon-glow {
          transform: scale(1.1);
          box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.3);
        }
      `}</style>

      {/* 顶部固定筛选区 */}
      <div className="sticky top-0 z-30 pb-2 -mt-2 pt-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 animate-fade-in-up">
        <Card className="border-primary/20 shadow-sm overflow-hidden transition-shadow duration-300 hover:shadow-md">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-3.5">
              {/* 第一行：时间维度 */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium mr-1">时间维度:</span>
                  {(['day', 'week', 'month', 'year', 'custom'] as TimeMode[]).map((mode) => (
                    <Button
                      key={mode}
                      variant={timeMode === mode ? 'default' : 'outline'}
                      size="sm"
                      className={`h-7 px-2.5 text-xs transition-all duration-150 ripple-btn ${
                        timeMode === mode ? 'shadow-sm' : 'hover:bg-muted/60 active:scale-95'
                      }`}
                      onClick={() => setTimeMode(mode)}
                    >
                      {timeModeLabels[mode]}
                    </Button>
                  ))}
                </div>

                {timeMode === 'custom' && (
                  <div className="flex items-center gap-2 animate-fade-in-up">
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="h-7 text-xs w-[130px] font-mono animate-glow-pulse"
                    />
                    <span className="text-xs text-muted-foreground">~</span>
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="h-7 text-xs w-[130px] font-mono animate-glow-pulse"
                    />
                  </div>
                )}

                <Badge
                  variant="outline"
                  className="text-xs tabular-nums font-mono ml-auto bg-background border-primary/15 text-primary/80 animate-fade-in-up"
                >
                  {dateRange.start} ~ {dateRange.end}
                </Badge>
              </div>

              {/* 第二行：聚合搜索 + 多选筛选 */}
              <div className="flex items-center gap-3 flex-wrap border-t pt-3.5">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
                  <Search className="h-3.5 w-3.5" /> 聚合搜索:
                </span>

                <div className="relative flex-1 min-w-[240px] max-w-[420px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    value={aggregateSearch}
                    onChange={(e) => setAggregateSearch(e.target.value)}
                    placeholder="输入关键词，自动匹配店铺和产品..."
                    className="h-8 !pl-11 pr-[72px] text-xs border-dashed border-primary/30 bg-primary/[0.02]
                               focus:border-primary/60 focus:ring-1 focus:ring-primary/20 focus:bg-background
                               hover:border-primary/40 transition-all duration-200 animate-glow-pulse"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {aggregateSearch.trim() && (
                      <>
                        {aggregateMatchCount > 0 && (
                          <Badge
                            variant="secondary"
                            className="h-5 px-1.5 text-[10px] rounded-sm font-bold bg-primary/10 text-primary animate-pop"
                          >
                            {aggregateMatchCount}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-muted/60 rounded-full transition-transform duration-200 hover:rotate-90"
                          onClick={handleClearAggregateSearch}
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

                <MultiSelect
                  title="店铺"
                  placeholder="搜索店铺名称..."
                  options={shopOptions}
                  selected={selectedShops}
                  onChange={setSelectedShops}
                  highlighted={isAggregateSearchActive}
                  iconType="shop"
                />

                <MultiSelect
                  title="产品"
                  placeholder="搜索产品名称..."
                  options={productOptions}
                  selected={selectedProducts}
                  onChange={setSelectedProducts}
                  highlighted={isAggregateSearchActive}
                  iconType="product"
                />

                {(selectedProducts.length > 0 ||
                  selectedShops.length > 0 ||
                  aggregateSearch.trim()) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 ml-1 shrink-0 transition-all duration-200 animate-fade-in-up"
                    onClick={handleClearAllFilters}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    清空筛选
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 指标卡片（核心优化区域） */}
      {!summary ? (
        <Card className="animate-fade-in-up">
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">当前筛选条件下暂无数据</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, idx) => {
              const Icon = card.icon;

              // 通用卡片样式增强
              const baseCardClass = `
                overflow-hidden relative card-hover-effect bg-gradient-card
                border border-opacity-50 rounded-xl
                transition-all duration-300
                group
              `;

              const iconContainerClass = `
                p-2 rounded-xl stat-icon-glow
                transition-all duration-300
                group-hover:scale-110 group-hover:shadow-md
              `;

              const valueClass = `
                text-3xl font-black tabular-nums
                animate-number-pop
              `;

              // 变化趋势箭头和文字样式
              const trendBaseClass = "flex items-center gap-1 mt-1 animate-fade-in-up";

              // 特殊处理 Top 异常原因卡片
              if (card.isTopReason) {
                return (
                  <Card
                    key={card.label}
                    className={baseCardClass}
                    style={{
                      borderLeft: `4px solid ${card.accentColor}`,
                      backgroundImage: `radial-gradient(circle at 10% 10%, ${card.accentColor}10 0%, transparent 50%)`
                    }}
                  >
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{card.label}</p>
                        <div className={iconContainerClass} style={{ backgroundColor: card.iconBg }}>
                          <Icon className="h-4 w-4" style={{ color: card.accentColor }} />
                        </div>
                      </div>
                      {summary.topReasons.length > 0 ? (
                        <div className="mt-3">
                          <p
                            className={`${valueClass} truncate`}
                            style={{ color: card.accentColor }}
                            title={summary.topReasons[0][0]}
                          >
                            {summary.topReasons[0][0]}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs font-mono" style={{ backgroundColor: card.iconBg, color: card.accentColor, borderColor: 'transparent' }}>
                              {summary.topReasons[0][1]} 单
                            </Badge>

                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-2">无异常</p>
                      )}
                    </CardContent>
                    {/* 装饰性微光 */}
                    <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-10 blur-xl" style={{ backgroundColor: card.accentColor }} />
                  </Card>
                );
              }

              // 普通数值卡片
              return (
                <Card
                  key={card.label}
                  className={baseCardClass}
                  style={{
                    borderLeft: `4px solid ${card.accentColor}`,
                    backgroundImage: `radial-gradient(circle at 10% 10%, ${card.accentColor}10 0%, transparent 50%)`
                  }}
                >
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{card.label}</p>
                      <div className={iconContainerClass} style={{ backgroundColor: card.iconBg }}>
                        <Icon className="h-4 w-4" style={{ color: card.accentColor }} />
                      </div>
                    </div>
                    <div className="mt-3">
                      <p
                        className={valueClass}
                        style={{ color: card.accentColor }}
                      >
                        {card.value}
                      </p>
                      {card.change !== null && (
                        <div className={trendBaseClass}>
                          {card.isRedFlag ? (
                            card.changeUp ? (
                              <TrendingUp className="h-3.5 w-3.5 text-destructive" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                            )
                          ) : card.changeUp ? (
                            <TrendingUp className="h-3.5 w-3.5 text-destructive" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              (card.isRedFlag ? card.changeUp : card.changeUp)
                                ? 'text-destructive'
                                : 'text-emerald-500'
                            }`}
                          >
                            {card.changePercent !== undefined
                              ? `${card.changeUp ? '+' : ''}${card.changePercent}%`
                              : `${card.changeUp ? '+' : ''}${card.change}`}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* 装饰性微光 */}
                    <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-10 blur-xl" style={{ backgroundColor: card.accentColor }} />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 产品售后排名图 */}
          {summary.productBreakdown.length > 0 && (
            <GlobalProductColumn
              products={summary.productBreakdown.map((p) => ({
                originalName: p.name,
                name: getProductDisplayName(p.name, aliases),
                value: p.total,
              }))}
              dateLabel={dateLabel}
            />
          )}
        </>
      )}
    </div>
  );
}