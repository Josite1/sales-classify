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
import type { AllRecords, ProductData, ProductAliases, ShopItem } from '@/lib/types';
import {
  getProductTotal,
  getRedFlagReasons,
  loadProductAliases,
  getProductDisplayName,
  getFlags,
  getShopCount,
} from '@/lib/store';

/* ========== 工具函数 ========== */
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

type TimeMode = 'week' | 'month' | 'year' | 'custom';

const VIVID_COLORS = BRUTAL_COLORS;

interface WeeklyTrendChartProps {
  records: AllRecords;
  selectedDate: string | null;
  initialAliases?: ProductAliases;
}

interface DayData {
  date: string;
  label: string;
  totalOrders: number;
  redFlags: number;
  greenFlags: number;
  greyFlags: number;
  products: Record<string, number>;
  reasons: Record<string, number>;
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
    if (chartRef.current) {
      try { chartRef.current.dispose(); } catch { /* ignore */ }
      chartRef.current = null;
    }
    domTrackRef.current = dom;
  }

  if (!chartRef.current || chartRef.current.isDisposed()) {
    chartRef.current = echarts.init(dom, 'brutal');
  }

  return chartRef.current;
}

/* ========== 多选下拉组件 ========== */
function MultiSelect({
  title,
  options,
  selected,
  onChange,
  placeholder = '搜索...',
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
          } ${open ? 'border-primary/50 bg-primary/5' : ''}`}
        >
          <div className="flex items-center gap-1.5 text-xs">
            {iconType === 'shop' ? (   <Store className={`h-3 w-3 ${highlighted ? 'text-primary' : 'text-muted-foreground'}`} /> ) : (   <Package className={`h-3 w-3 ${highlighted ? 'text-primary' : 'text-muted-foreground'}`} /> )}
            <span className={`font-medium ${highlighted ? 'text-primary' : 'text-muted-foreground'}`}>
              {title}
            </span>
            {selected.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0 h-4 text-[10px] rounded-sm font-bold bg-primary/10 text-primary"
              >
                {selected.length}
              </Badge>
            )}
          </div>
          <ChevronsUpDown className={`h-3 w-3 shrink-0 ${open ? 'text-primary' : 'opacity-50'}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0 shadow-lg border-primary/10" align="start">
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
                    className="text-xs flex items-center gap-2.5 cursor-pointer py-1.5"
                  >
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-sm border shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input opacity-50'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <ItemIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{opt.label}</span>
                    <Badge
                      variant={isZero ? 'outline' : 'secondary'}
                      className={`ml-auto px-1.5 py-0 h-4 text-[10px] font-mono tabular-nums shrink-0 ${
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

  useEffect(() => {
    setAliases(initialAliases || loadProductAliases());
  }, [initialAliases]);

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

  useEffect(() => {
    if (selectedDate) {
      setCustomStart(selectedDate);
      setCustomEnd(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsVisible(true);
          requestAnimationFrame(() => {
            [overviewChartRef, productTrendChartRef, reasonTrendChartRef].forEach((ref) => {
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
    if (!selectedDate && timeMode !== 'custom') return null;
    switch (timeMode) {
      case 'week':
        return selectedDate ? {
          start: getISOWeekRange(selectedDate).monday,
          end: getISOWeekRange(selectedDate).sunday,
        } : null;
      case 'month':
        return selectedDate ? getMonthRange(selectedDate) : null;
      case 'year':
        return selectedDate ? getYearRange(selectedDate) : null;
      case 'custom':
        return customStart && customEnd ? { start: customStart, end: customEnd } : null;
      default:
        return null;
    }
  }, [selectedDate, timeMode, customStart, customEnd]);

  // 全集
  const { allProductNames, allStoreNames } = useMemo(() => {
    const nameSet = new Set<string>();
    const storeSet = new Set<string>();
    for (const record of Object.values(records)) {
      for (const [name, data] of Object.entries(record.data)) {
        nameSet.add(name);
        const shopStats = data['店铺分类'] || {};
        Object.values(shopStats).forEach((shopsInFlag) => {
          Object.keys(shopsInFlag as Record<string, number>).forEach((s) => storeSet.add(s));
        });
      }
    }
    return {
      allProductNames: Array.from(nameSet).sort(),
      allStoreNames: Array.from(storeSet).sort(),
    };
  }, [records]);

  // 动态选项
  const { productOptions, shopOptions } = useMemo(() => {
    if (!dateRange) return { productOptions: [], shopOptions: [] };
    const productCount: Record<string, number> = {};
    const shopCount: Record<string, number> = {};
    allProductNames.forEach(p => productCount[p] = 0);
    allStoreNames.forEach(s => shopCount[s] = 0);

    const dates = Object.keys(records).filter(d => d >= dateRange.start && d <= dateRange.end);

    dates.forEach(d => {
      const record = records[d];
      Object.entries(record.data).forEach(([pName, pData]) => {
        const shopStats = pData['店铺分类'] || {};

        if (selectedShops.length > 0) {
          let pTotal = 0;
          Object.entries(shopStats).forEach(([, shopsInFlag]) => {
            Object.entries(shopsInFlag as Record<string, ShopItem | number>).forEach(([sName, shopVal]) => {
              if (selectedShops.includes(sName)) pTotal += getShopCount(shopVal);
            });
          });
          if (pTotal > 0) productCount[pName] += pTotal;
        } else {
          productCount[pName] += getProductTotal(pData);
        }

        if (selectedProducts.length > 0 && !selectedProducts.includes(pName)) return;
        Object.entries(shopStats).forEach(([, shopsInFlag]) => {
          Object.entries(shopsInFlag as Record<string, ShopItem | number>).forEach(([sName, shopVal]) => {
            shopCount[sName] += getShopCount(shopVal);
          });
        });
      });
    });

    return {
      productOptions: allProductNames
        .map(p => ({ label: getProductDisplayName(p, aliases), value: p, count: productCount[p] || 0 }))
        .sort((a, b) => b.count - a.count),
      shopOptions: allStoreNames
        .map(s => ({ label: s, value: s, count: shopCount[s] || 0 }))
        .sort((a, b) => b.count - a.count),
    };
  }, [records, dateRange, selectedProducts, selectedShops, aliases, allProductNames, allStoreNames]);

  // 聚合搜索自动勾选
  useEffect(() => {
    const kw = debouncedSearch.toLowerCase();
    if (!kw || allStoreNames.length === 0) return;
    const matchedShops = allStoreNames.filter(s => s.toLowerCase().includes(kw));
    const matchedProducts = allProductNames.filter(p => {
      const display = getProductDisplayName(p, aliases);
      return p.toLowerCase().includes(kw) || display.toLowerCase().includes(kw);
    });
    if (matchedShops.length > 0 || matchedProducts.length > 0) {
      setSelectedShops(prev => {
        const set = new Set([...prev, ...matchedShops]);
        return set.size === prev.length && prev.every(v => set.has(v)) ? prev : Array.from(set);
      });
      setSelectedProducts(prev => {
        const set = new Set([...prev, ...matchedProducts]);
        return set.size === prev.length && prev.every(v => set.has(v)) ? prev : Array.from(set);
      });
    }
  }, [debouncedSearch, allStoreNames, allProductNames, aliases]);

  const aggregateMatchCount = useMemo(() => {
    const kw = aggregateSearch.trim().toLowerCase();
    if (!kw) return 0;
    let count = 0;
    count += allStoreNames.filter(s => s.toLowerCase().includes(kw)).length;
    count += allProductNames.filter(p => {
      const display = getProductDisplayName(p, aliases);
      return p.toLowerCase().includes(kw) || display.toLowerCase().includes(kw);
    }).length;
    return count;
  }, [aggregateSearch, allStoreNames, allProductNames, aliases]);

  const isAggregateSearchActive = debouncedSearch.length > 0;

  const handleClearAll = useCallback(() => {
    setSelectedProducts([]);
    setSelectedShops([]);
    setAggregateSearch('');
    setDebouncedSearch('');
  }, []);

  const handleClearSearch = useCallback(() => {
    setAggregateSearch('');
    setDebouncedSearch('');
  }, []);

  // ==================== 核心修正：computeDaySummary ====================
  const computeDaySummary = useCallback(
    (dateStr: string, record: AllRecords[string] | undefined, selProds: string[], selShops: string[]) => {
      const empty = {
        totalOrders: 0,
        redFlags: 0,
        greenFlags: 0,
        greyFlags: 0,
        products: {} as Record<string, number>,
        reasons: {} as Record<string, number>,
      };
      if (!record) return empty;

      let totalOrders = 0,
        redFlags = 0,
        greenFlags = 0,
        greyFlags = 0;
      const products: Record<string, number> = {};
      const reasons: Record<string, number> = {};

      Object.entries(record.data).forEach(([pName, pData]) => {
        if (selProds.length > 0 && !selProds.includes(pName)) return;

        let pTotal = 0,
          pRed = 0,
          pGreen = 0,
          pGrey = 0;
        const shopStats = pData['店铺分类'] || {};

        if (selShops.length > 0) {
          // 筛选店铺
          Object.entries(shopStats).forEach(([flag, shopsInFlag]) => {
            if (!shopsInFlag || typeof shopsInFlag !== 'object') return;
            let flagCount = 0;
            Object.entries(shopsInFlag as Record<string, ShopItem | number>).forEach(([sName, shopVal]) => {
              if (!selShops.includes(sName)) return;
              const count = getShopCount(shopVal);
              if (count === 0) return;
              flagCount += count;

              // 仅红色旗子聚合原因（直接使用店铺的客服备注分类）
              if (flag === '红色旗子' && typeof shopVal === 'object' && shopVal !== null) {
                const shop = shopVal as ShopItem;
                if (shop.客服备注分类) {
                  for (const [reason, val] of Object.entries(shop.客服备注分类)) {
                    if (typeof val === 'number') {
                      reasons[reason] = (reasons[reason] || 0) + val;
                    } else if (val && typeof val === 'object' && '订单数' in val) {
                      reasons[reason] = (reasons[reason] || 0) + val.订单数;
                    }
                  }
                }
              }
            });

            if (flagCount === 0) return;
            pTotal += flagCount;
            if (flag === '红色旗子') pRed += flagCount;
            else if (flag === '绿色旗子') pGreen += flagCount;
            else if (flag === '灰色旗子') pGrey += flagCount;
          });
        } else {
          // 无店铺筛选：产品整体数据
          pTotal = getProductTotal(pData);
          const flags = getFlags(pData);
          pRed = flags['红色旗子'] || 0;
          pGreen = flags['绿色旗子'] || 0;
          pGrey = flags['灰色旗子'] || 0;

          const redReasons = getRedFlagReasons(pData);
          Object.entries(redReasons).forEach(([reason, count]) => {
            reasons[reason] = (reasons[reason] || 0) + count;
          });
        }

        if (pTotal === 0) return;

        totalOrders += pTotal;
        redFlags += pRed;
        greenFlags += pGreen;
        greyFlags += pGrey;

        const dn = getProductDisplayName(pName, aliases);
        products[dn] = (products[dn] || 0) + pTotal;
      });

      return { totalOrders, redFlags, greenFlags, greyFlags, products, reasons };
    },
    [aliases],
  );

  // 聚合后的日数据
  const dailyData = useMemo(() => {
    if (!dateRange) return [];

    if (timeMode === 'week') {
      const dates = getDatesInRange(dateRange.start, dateRange.end);
      return dates.map(dateStr => {
        const summary = computeDaySummary(dateStr, records[dateStr], selectedProducts, selectedShops);
        const d = new Date(dateStr);
        const label = `${d.getMonth() + 1}/${d.getDate()} 周${['日','一','二','三','四','五','六'][d.getDay()]}`;
        return { date: dateStr, label, ...summary };
      });
    }

    if (timeMode === 'month') {
      const dates = getDatesInRange(dateRange.start, dateRange.end);
      const weekMap = new Map<string, { days: string[]; weekStart: string; weekEnd: string }>();
      dates.forEach(dateStr => {
        const { monday, sunday } = getISOWeekRange(dateStr);
        const key = monday;
        if (!weekMap.has(key)) {
          weekMap.set(key, { days: [], weekStart: monday, weekEnd: sunday });
        }
        weekMap.get(key)!.days.push(dateStr);
      });

      const weeks = Array.from(weekMap.entries())
        .map(([monday, info]) => ({ monday, ...info }))
        .sort((a, b) => a.monday.localeCompare(b.monday));

      return weeks.map((week, idx) => {
        let agg = { totalOrders: 0, redFlags: 0, greenFlags: 0, greyFlags: 0, products: {} as Record<string, number>, reasons: {} as Record<string, number> };
        week.days.forEach(dateStr => {
          const s = computeDaySummary(dateStr, records[dateStr], selectedProducts, selectedShops);
          agg.totalOrders += s.totalOrders;
          agg.redFlags += s.redFlags;
          agg.greenFlags += s.greenFlags;
          agg.greyFlags += s.greyFlags;
          Object.entries(s.products).forEach(([k, v]) => agg.products[k] = (agg.products[k] || 0) + v);
          Object.entries(s.reasons).forEach(([k, v]) => agg.reasons[k] = (agg.reasons[k] || 0) + v);
        });

        const startStr = week.weekStart.slice(5);
        const endStr = week.weekEnd.slice(5);
        const label = `W${idx + 1} ${startStr}~${endStr}`;
        return { date: week.monday, label, ...agg };
      });
    }

    if (timeMode === 'year') {
      const months = Array.from({ length: 12 }, (_, i) => {
        const m = new Date(dateRange.start.substring(0, 4) + '-01-01');
        m.setMonth(i);
        const start = new Date(m.getFullYear(), m.getMonth(), 1);
        const end = new Date(m.getFullYear(), m.getMonth() + 1, 0);
        return {
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
          label: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
        };
      });

      return months.map(month => {
        const dates = getDatesInRange(month.start, month.end);
        let agg = { totalOrders: 0, redFlags: 0, greenFlags: 0, greyFlags: 0, products: {} as Record<string, number>, reasons: {} as Record<string, number> };
        dates.forEach(dateStr => {
          const s = computeDaySummary(dateStr, records[dateStr], selectedProducts, selectedShops);
          agg.totalOrders += s.totalOrders;
          agg.redFlags += s.redFlags;
          agg.greenFlags += s.greenFlags;
          agg.greyFlags += s.greyFlags;
          Object.entries(s.products).forEach(([k, v]) => agg.products[k] = (agg.products[k] || 0) + v);
          Object.entries(s.reasons).forEach(([k, v]) => agg.reasons[k] = (agg.reasons[k] || 0) + v);
        });
        return { date: month.start, label: month.label, ...agg };
      });
    }

    if (timeMode === 'custom') {
      const dates = getDatesInRange(dateRange.start, dateRange.end);
      return dates.map(dateStr => {
        const summary = computeDaySummary(dateStr, records[dateStr], selectedProducts, selectedShops);
        const d = new Date(dateStr);
        const label = `${d.getMonth() + 1}/${d.getDate()} 周${['日','一','二','三','四','五','六'][d.getDay()]}`;
        return { date: dateStr, label, ...summary };
      });
    }

    return [];
  }, [dateRange, timeMode, selectedProducts, selectedShops, records, computeDaySummary]);

  const topProducts = useMemo(() => {
    const totals = new Map<string, number>();
    dailyData.forEach(d => {
      Object.entries(d.products).forEach(([n, c]) => totals.set(n, (totals.get(n) || 0) + c));
    });
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
  }, [dailyData]);

  const topReasons = useMemo(() => {
    const totals = new Map<string, number>();
    dailyData.forEach(d => {
      Object.entries(d.reasons).forEach(([r, c]) => totals.set(r, (totals.get(r) || 0) + c));
    });
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
  }, [dailyData]);

  // Register brutalist theme once
if (typeof window !== 'undefined') {
  registerBrutalTheme(echarts);
}

const tooltipStyle = getBrutalTooltip();

  // ResizeObserver
  useEffect(() => {
    const containers = [overviewRef.current, productTrendRef.current, reasonTrendRef.current];
    const charts = [overviewChartRef, productTrendChartRef, reasonTrendChartRef];
    const observer = new ResizeObserver(() => {
      charts.forEach(ref => {
        if (ref.current && !ref.current.isDisposed()) ref.current.resize();
      });
    });
    containers.forEach(c => c && observer.observe(c));
    resizeObserverRef.current = observer;
    return () => observer.disconnect();
  }, [dailyData]);

  // ==================== 图表渲染 ====================

  // 1. 每日总览
  useEffect(() => {
    const chart = getOrCreateChart(overviewRef, overviewChartRef, overviewInitDomRef);
    if (!chart) return;
    if (dailyData.length === 0) { chart.clear(); return; }

    chart.setOption({
      tooltip: { ...tooltipStyle, trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {
        bottom: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 8,
        textStyle: { fontSize: 12, color: '#64748b' }, itemGap: 20,
      },
      grid: { left: '3%', right: '4%', bottom: '14%', top: '14%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dailyData.map(d => d.label),
        axisLabel: {
          fontSize: 11,
          color: '#64748b',
          rotate: dailyData.length > 10 ? 30 : 0,
          formatter: (val: string) => val.length > 8 ? val.slice(0, 8) + '…' : val,
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLine: { show: false }, axisTick: { show: false },
      },
      dataZoom: dailyData.length > 14
        ? [{ type: 'slider', start: 0, end: 60, height: 20, bottom: 30 }, { type: 'inside' }]
        : undefined,
      series: [
        {
          name: '售后总单数',
          type: 'bar',
          barWidth: '35%',
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#14b8a6' }, { offset: 1, color: '#0d9488' }
            ]),
            borderRadius: [6, 6, 0, 0],
          },
          label: { show: true, position: 'top', fontSize: 11, fontWeight: 'bold', color: '#059669', formatter: '{c}' },
          data: dailyData.map(d => d.totalOrders),
        },
        {
          name: '红旗标记数',
          type: 'line', smooth: true, symbol: 'circle', symbolSize: 8,
          lineStyle: { width: 3, color: '#ef4444' },
          itemStyle: { color: '#ef4444', borderWidth: 2, borderColor: '#fff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(239,68,68,0.15)' }, { offset: 1, color: 'rgba(239,68,68,0.01)' }
            ]),
          },
          label: { show: true, position: 'top', fontSize: 11, fontWeight: 'bold', color: '#ef4444', formatter: '{c}' },
          data: dailyData.map(d => d.redFlags),
        },
        {
          name: '绿色旗子',
          type: 'line', smooth: true, symbol: 'circle', symbolSize: 7,
          lineStyle: { width: 3, color: '#22c55e' },
          itemStyle: { color: '#22c55e', borderWidth: 2, borderColor: '#fff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(34,197,94,0.12)' }, { offset: 1, color: 'rgba(34,197,94,0.01)' }
            ]),
          },
          label: { show: true, position: 'top', fontSize: 10, fontWeight: 'bold', color: '#22c55e', formatter: (p: { value: number }) => p.value > 0 ? `${p.value}` : '' },
          data: dailyData.map(d => d.greenFlags),
        },
        {
          name: '灰色旗子',
          type: 'line', smooth: true, symbol: 'circle', symbolSize: 7,
          lineStyle: { width: 3, color: '#94a3b8' },
          itemStyle: { color: '#94a3b8', borderWidth: 2, borderColor: '#fff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(148,163,184,0.12)' }, { offset: 1, color: 'rgba(148,163,184,0.01)' }
            ]),
          },
          label: { show: true, position: 'top', fontSize: 10, fontWeight: 'bold', color: '#94a3b8', formatter: (p: { value: number }) => p.value > 0 ? `${p.value}` : '' },
          data: dailyData.map(d => d.greyFlags),
        },
      ],
    }, true);
  }, [dailyData, isVisible]);

  // 2. 产品每日趋势
  useEffect(() => {
    const chart = getOrCreateChart(productTrendRef, productTrendChartRef, productTrendInitDomRef);
    if (!chart) return;
    if (dailyData.length === 0) { chart.clear(); return; }

    const displayProducts = selectedProducts.length > 0
      ? selectedProducts.map(name => getProductDisplayName(name, aliases))
      : topProducts;

    if (displayProducts.length === 0) { chart.clear(); return; }

    chart.setOption({
      tooltip: { ...tooltipStyle, trigger: 'axis' },
      legend: displayProducts.length > 1 ? {
        type: 'scroll', bottom: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 8,
        textStyle: { fontSize: 11, color: '#64748b' }, itemGap: 16,
        pageIconSize: 12, pageTextStyle: { fontSize: 11, color: '#94a3b8' },
      } : undefined,
      grid: {
        left: '3%', right: '4%',
        bottom: displayProducts.length > 1 ? '16%' : '8%',
        top: '8%', containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dailyData.map(d => d.label),
        axisLabel: {
          fontSize: 11, color: '#64748b',
          rotate: dailyData.length > 10 ? 30 : 0,
          formatter: (val: string) => val.length > 8 ? val.slice(0, 8) + '…' : val,
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLine: { show: false }, axisTick: { show: false },
      },
      dataZoom: dailyData.length > 14
        ? [{ type: 'slider', start: 0, end: 60, height: 20, bottom: displayProducts.length > 1 ? 40 : 10 }, { type: 'inside' }]
        : undefined,
      series: displayProducts.map((name, i) => {
        const c = VIVID_COLORS[i % VIVID_COLORS.length];
        return {
          name: name.length > 10 ? name.slice(0, 10) + '...' : name,
          type: 'line', smooth: true, symbol: 'circle', symbolSize: 7,
          lineStyle: { width: 3, color: c },
          itemStyle: { color: c, borderWidth: 2, borderColor: '#fff' },
          emphasis: { lineStyle: { width: 5 } },
          areaStyle: displayProducts.length === 1 ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: c + '30' }, { offset: 1, color: c + '05' }
            ]),
          } : undefined,
          label: {
            show: true, position: 'top', fontSize: 10, fontWeight: 'bold', color: c,
            formatter: (p: { value: number }) => p.value > 0 ? `${p.value}` : '',
          },
          data: dailyData.map(d => d.products[name] || 0),
        };
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
      legend: {
        type: 'scroll', bottom: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 8,
        textStyle: { fontSize: 11, color: '#64748b' }, itemGap: 16,
        pageIconSize: 12, pageTextStyle: { fontSize: 11, color: '#94a3b8' },
      },
      grid: { left: '3%', right: '4%', bottom: '14%', top: '8%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dailyData.map(d => d.label),
        axisLabel: {
          fontSize: 11, color: '#64748b',
          rotate: dailyData.length > 10 ? 30 : 0,
          formatter: (val: string) => val.length > 8 ? val.slice(0, 8) + '…' : val,
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLine: { show: false }, axisTick: { show: false },
      },
      dataZoom: dailyData.length > 14
        ? [{ type: 'slider', start: 0, end: 60, height: 20, bottom: 30 }, { type: 'inside' }]
        : undefined,
      series: topReasons.map((reason, i) => ({
        name: reason,
        type: 'bar',
        stack: 'reasons',
        barWidth: '50%',
        itemStyle: {
          color: VIVID_COLORS[(i + 2) % VIVID_COLORS.length],
          borderRadius: i === topReasons.length - 1 ? [4, 4, 0, 0] : undefined,
        },
        emphasis: { focus: 'series' },
        label: {
          show: true, position: 'inside', fontSize: 10, fontWeight: 'bold', color: '#fff',
          formatter: (p: { value: number }) => p.value > 0 ? `${p.value}` : '',
        },
        data: dailyData.map(d => d.reasons[reason] || 0),
      })),
    }, true);
  }, [dailyData, topReasons, isVisible]);

  // 清理
  useEffect(() => {
    return () => {
      [overviewChartRef, productTrendChartRef, reasonTrendChartRef].forEach(ref => {
        if (ref.current) try { ref.current.dispose(); } catch { /* ignore */ }
        ref.current = null;
      });
      overviewInitDomRef.current = null;
      productTrendInitDomRef.current = null;
      reasonTrendInitDomRef.current = null;
    };
  }, []);

  if (Object.keys(records).length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
          <div className="text-center">
            <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">导入多日数据后可查看变化趋势</p>
            <p className="text-xs mt-1">至少需要 1 条日期记录</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const timeModeLabels: Record<TimeMode, string> = {
    week: '周',
    month: '月',
    year: '年',
    custom: '自定义',
  };

  return (
    <div ref={containerRef} className="space-y-6">
      {/* 筛选区 */}
      <div className="sticky top-0 z-30 pb-2 -mt-2 pt-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Card className="border-primary/20 shadow-sm overflow-hidden">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg">
                  {(['week', 'month', 'year', 'custom'] as TimeMode[]).map(mode => (
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
                    <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-7 text-xs w-[130px] font-mono" />
                    <span className="text-xs text-muted-foreground">~</span>
                    <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-7 text-xs w-[130px] font-mono" />
                  </div>
                )}

                {dateRange && (
                  <Badge variant="outline" className="text-xs tabular-nums font-mono ml-auto bg-background border-primary/15 text-primary/80">
                    {dateRange.start} ~ {dateRange.end}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap border-t pt-3.5">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
                  <Search className="h-3.5 w-3.5" /> 聚合搜索:
                </span>

                <div className="relative flex-1 min-w-[240px] max-w-[420px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    value={aggregateSearch}
                    onChange={e => setAggregateSearch(e.target.value)}
                    placeholder="输入关键词，自动匹配店铺和产品..."
                    className="h-8 pl-9 pr-[72px] text-xs border-dashed border-primary/30 bg-primary/[0.02] focus:border-primary/60 focus:ring-1 focus:ring-primary/20 focus:bg-background hover:border-primary/40 transition-all duration-200"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {aggregateSearch.trim() && (
                      <>
                        {aggregateMatchCount > 0 && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-sm font-bold bg-primary/10 text-primary">
                            {aggregateMatchCount}
                          </Badge>
                        )}
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-muted/60 rounded-full" onClick={handleClearSearch}>
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

                <MultiSelect title="店铺" placeholder="搜索店铺名称..." options={shopOptions} selected={selectedShops} onChange={setSelectedShops} highlighted={isAggregateSearchActive} iconType="shop" />
                <MultiSelect title="产品" placeholder="搜索产品名称..." options={productOptions} selected={selectedProducts} onChange={setSelectedProducts} highlighted={isAggregateSearchActive} iconType="product" />

                {(selectedProducts.length > 0 || selectedShops.length > 0 || aggregateSearch.trim()) && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 ml-1 shrink-0" onClick={handleClearAll}>
                    <X className="h-3.5 w-3.5 mr-1" />清空筛选
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!dateRange || dailyData.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">当前筛选条件下暂无数据</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                {timeMode === 'week' ? '当周每日趋势' : timeMode === 'month' ? '当月按周趋势' : timeMode === 'year' ? '当年按月趋势' : '自定义时段趋势'}
                {selectedProducts.length === 1 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {getProductDisplayName(selectedProducts[0], aliases)}
                  </Badge>
                )}
                {selectedShops.length ===1 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                   {selectedShops[0]}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {dateRange.start} ~ {dateRange.end} {timeMode === 'month' ? '按周汇总' : timeMode === 'year' ? '按月汇总' : '每日明细'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={overviewRef} className="w-full h-[340px]" />
            </CardContent>
          </Card>

          {topProducts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {selectedProducts.length > 0 ? `已选 ${selectedProducts.length} 产品趋势` : `Top ${topProducts.length} 产品趋势`}
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  基于当前聚合粒度的趋势变化
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={productTrendRef} className="w-full h-[380px]" />
              </CardContent>
            </Card>
          )}

          {topReasons.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  异常归因变化 (Top {topReasons.length})
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  按当前粒度汇总的 Top 异常原因
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div ref={reasonTrendRef} className="w-full h-[420px]" />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}