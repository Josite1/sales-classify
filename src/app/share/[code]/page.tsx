'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lock, Eye, EyeOff, BarChart3, Loader2, TrendingUp, Package, MapPin, Store, FileJson, CalendarDays } from 'lucide-react';
import { DayOverview } from '@/components/day-overview';
import { WeeklyTrendChart } from '@/components/weekly-trend-chart';
import { ProductAnalysis } from '@/components/product-analysis';
import { RegionDistribution } from '@/components/region-distribution';
import { ShopDistribution } from '@/components/shop-distribution';
import type { AllRecords, ProductAliases } from '@/lib/types';


const APP_ICON = 'https://coze-coding-project.tos.coze.site/gen_project_icon/2026-05-30/7645517311235096639_1780111991.png?sign=4902517311-4ba811436f-0-6207045dfb96dda9f5cfb2c0edb03ab52b738bcf67e23aa39efb51d47ce44009';

interface SharedData {
  title: string;
  data: AllRecords;
  aliases: ProductAliases;
  created_at: string;
}

/** Shared dashboard - renders full read-only dashboard */
function SharedDashboard({ sharedData }: { sharedData: SharedData }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dates = useMemo(() => Object.keys(sharedData.data).sort().reverse(), [sharedData.data]);
  const totalOrders = useMemo(() =>
    Object.values(sharedData.data).reduce(
      (sum, r) => sum + Object.values(r.data).reduce((s, p) => s + (Number(p.total) || 0), 0),
      0
    ), [sharedData.data]);
  const totalProducts = useMemo(() =>
    new Set(Object.values(sharedData.data).flatMap((r) => Object.keys(r.data))).size,
    [sharedData.data]);

  const currentRecord = selectedDate ? sharedData.data[selectedDate] : null;
  const sortedDates = useMemo(() => Object.keys(sharedData.data).sort(), [sharedData.data]);
  const prevDate = useMemo(() =>
    selectedDate ? sortedDates.filter((d) => d < selectedDate).pop() : undefined,
    [selectedDate, sortedDates]);

  // Initialize selected date
  useEffect(() => {
    if (!selectedDate && dates.length > 0) {
      setSelectedDate(dates[0]);
    }
  }, [dates, selectedDate]);

  // Year/month grouping for compact display
  const dateGroups = useMemo(() => {
    const groups: { monthKey: string; monthLabel: string; dates: string[] }[] = [];
    for (const date of dates) {
      const monthKey = date.slice(0, 7);
      const [y, m] = monthKey.split('-');
      const monthLabel = `${y}年${parseInt(m, 10)}月`;
      let group = groups.find((g) => g.monthKey === monthKey);
      if (!group) {
        group = { monthKey, monthLabel, dates: [] };
        groups.push(group);
      }
      group.dates.push(date);
    }
    return groups;
  }, [dates]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground p-2 rounded-lg shadow-md">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">{sharedData.title}</h1>
              <p className="text-xs text-muted-foreground">分享数据 · 只读查看</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileJson className="h-3.5 w-3.5" />
              <span className="font-bold text-foreground tabular-nums">{dates.length}</span> 日期
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              <span className="font-bold text-foreground tabular-nums">{totalProducts}</span> 产品
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="font-bold text-foreground tabular-nums">{totalOrders}</span> 总单
            </div>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
              <EyeOff className="h-3 w-3 mr-1" />
              只读
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Left panel - date selector */}
          <div className="lg:w-[280px] lg:sticky lg:top-[73px] lg:h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-2 scrollbar-visible lg:shrink-0">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold">数据记录</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    <span className="font-bold text-foreground tabular-nums">{dates.length}</span> 条
                  </span>
                </div>

                <ScrollArea className="max-h-[calc(100vh-240px)]">
                  <div className="space-y-3">
                    {dateGroups.map((group) => (
                      <div key={group.monthKey}>
                        <div className="text-[10px] font-semibold text-muted-foreground mb-1.5 sticky top-0 bg-background py-0.5">
                          {group.monthLabel}
                        </div>
                        <div className="space-y-0.5">
                          {group.dates.map((date) => {
                            const record = sharedData.data[date];
                            if (!record) return null;
                            let dayTotal = 0;
                            for (const pd of Object.values(record.data)) {
                              dayTotal += Number((pd as unknown as Record<string, unknown>).total || 0);
                            }
                            const isSelected = date === selectedDate;

                            return (
                              <button
                                key={date}
                                onClick={() => setSelectedDate(date)}
                                className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-all ${
                                  isSelected
                                    ? 'bg-primary/10 border border-primary/20 font-semibold'
                                    : 'hover:bg-muted/50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={isSelected ? 'text-primary' : 'text-foreground'}>
                                    {date.slice(5)}
                                  </span>
                                  <span className="text-muted-foreground tabular-nums">
                                    <span className={isSelected ? 'text-primary font-bold' : 'font-bold text-foreground'}>{dayTotal}</span>单
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right panel - dashboard */}
          <div>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="overview" className="gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  数据总览
                </TabsTrigger>
                <TabsTrigger value="trend" className="gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  每日趋势
                </TabsTrigger>
                <TabsTrigger value="product" className="gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  产品分析
                </TabsTrigger>
                <TabsTrigger value="region" className="gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  地域分布
                </TabsTrigger>
                <TabsTrigger value="shop" className="gap-1.5">
                  <Store className="h-3.5 w-3.5" />
                  店铺分布
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                {currentRecord ? (
                  <DayOverview
                    records={sharedData.data}
                    selectedDate={selectedDate}
                  />
                ) : (
                  <div className="text-center py-16 text-muted-foreground text-sm">
                    请在左侧选择一个日期查看数据
                  </div>
                )}
              </TabsContent>

              <TabsContent value="trend">
                <WeeklyTrendChart
                  records={sharedData.data}
                  selectedDate={selectedDate}
                  initialAliases={sharedData.aliases}
                />
              </TabsContent>

              <TabsContent value="product">
                {currentRecord ? (
                  <ProductAnalysis
                    records={sharedData.data}
                    selectedDate={selectedDate}
                    initialAliases={sharedData.aliases}
                    readOnly
                  />
                ) : (
                  <div className="text-center py-16 text-muted-foreground text-sm">
                    请在左侧选择一个日期查看产品分析
                  </div>
                )}
              </TabsContent>

              <TabsContent value="region">
                <RegionDistribution
                  records={sharedData.data}
                  selectedDate={selectedDate}
                  initialAliases={sharedData.aliases}
                />
              </TabsContent>

              <TabsContent value="shop">
                <ShopDistribution
                  records={sharedData.data}
                  selectedDate={selectedDate}
                  initialAliases={sharedData.aliases}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-8 py-6">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-muted-foreground">
          <p>{sharedData.title} · 只读查看</p>
          <p className="tabular-nums">{dates.length} 日期记录</p>
        </div>
      </footer>
    </div>
  );
}

export default function ShareAccessPage() {
  const params = useParams();
  const code = params.code as string;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharedData, setSharedData] = useState<SharedData | null>(null);

  const handleAccess = useCallback(async () => {
    if (!password) {
      setError('请输入密码');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/share-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareCode: code, password }),
      });
      const result = await res.json();
      if (result.success) {
        const data: SharedData = {
          title: result.record.title,
          data: result.record.data,
          aliases: result.record.aliases || {},
          created_at: result.record.created_at,
        };
        setSharedData(data);
      } else {
        setError(result.error || '访问失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [code, password]);

  if (sharedData) {
    return <SharedDashboard sharedData={sharedData} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card className="border-border shadow-lg">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="flex justify-center mb-3">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-md">
                <Image
                  src={APP_ICON}
                  alt="售后数据看板"
                  fill
                  sizes="64px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            <h1 className="text-xl font-bold tracking-tight">查看分享数据</h1>
            <p className="text-xs text-muted-foreground mt-1">
              请输入密码以查看分享的数据
            </p>
          </CardHeader>

          <CardContent className="pt-4 pb-8 px-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">分享码</Label>
                <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-md">
                  <span className="font-mono text-sm tracking-wider">{code}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="share-password" className="text-xs font-medium">
                  访问密码
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="share-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="输入分享密码"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAccess()}
                    className="pl-9 pr-10 h-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </div>
              )}

              <Button
                onClick={handleAccess}
                disabled={!password || loading}
                className="w-full h-10"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    验证中...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-1.5" />
                    查看数据
                  </>
                )}
              </Button>
            </div>

            <div className="mt-4 pt-4 border-t border-border text-center">
              <p className="text-xs text-muted-foreground">
                数据受密码保护，仅可查看
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
