'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as echarts from 'echarts';
import {
  loadAllRecords,
  saveAllRecords,
  computeDaySummary,
  getProductTotal,
  loadProductAliases,
  getProductDisplayName,
  syncToCloud,
  fetchFromCloud,
  mergeRecords,
  setActiveUser,
} from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { getAccessToken } from '@/lib/auth';
import type { AllRecords, DateRecord, ProductAliases } from '@/lib/types';
import { DataImportDialog } from '@/components/data-import-dialog';
import { ShareDialog } from '@/components/share-dialog';
import { ChangePasswordDialog } from '@/components/change-password-dialog';
import DateRecordsPanel from '@/components/date-records-panel';
import { WeeklyTrendChart } from '@/components/weekly-trend-chart';
import { ProductAnalysis } from '@/components/product-analysis';
import { RegionDistribution } from '@/components/region-distribution';
import { ShopDistribution } from '@/components/shop-distribution';
import { DayOverview } from '@/components/day-overview';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  BarChart3,
  TrendingUp,
  Package,
  FileJson,
  MapPin,
  Store,
  Trophy,
  Share2,
  LogOut,
  User,
  KeyRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const [records, setRecords] = useState<AllRecords>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [aliases, setAliases] = useState<ProductAliases>({});
  const [mounted, setMounted] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // 客户端挂载后加载数据
  useEffect(() => {
    setMounted(true);
  }, []);

  // 当用户状态变化时，加载用户数据
  useEffect(() => {
    if (!mounted) return;

    // 先重置数据状态，防止旧用户数据闪现
    setRecords({});
    setAliases({});
    setSelectedDate(null);

    // 设置当前用户，确保 localStorage 按用户隔离
    if (user?.id) {
      setActiveUser(user.id);
    }

    const loaded = loadAllRecords();
    setRecords(loaded);
    setAliases(loadProductAliases());
    const dates = Object.keys(loaded).sort().reverse();
    if (dates.length > 0) {
      setSelectedDate(dates[0]);
    }
  }, [mounted, user?.id]);

  // 登录后从云端拉取数据并合并
  useEffect(() => {
    if (!mounted || !isAuthenticated || authLoading) return;

    // 设置当前用户，确保 localStorage 按用户隔离
    if (user?.id) {
      setActiveUser(user.id);
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;

        setSyncing(true);
        // 从云端拉取数据
        const cloudRecords = await fetchFromCloud(token);
        if (cancelled) return;

        const localRecords = loadAllRecords();
        // 合并本地与云端
        const merged = mergeRecords(localRecords, cloudRecords);
        // 保存到本地
        saveAllRecords(merged);
        setRecords(merged);

        const dates = Object.keys(merged).sort().reverse();
        if (dates.length > 0) {
          setSelectedDate(dates[0]);
        }

        // 将合并后的数据同步回云端
        if (Object.keys(cloudRecords).length < Object.keys(merged).length) {
          await syncToCloud(merged, token);
        }
      } catch {
        // 同步失败不阻塞页面
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, isAuthenticated, authLoading]);

  // 未登录跳转到登录页
  useEffect(() => {
    if (mounted && !authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, authLoading, isAuthenticated, router]);

  const handleImported = useCallback((newRecords: AllRecords) => {
    setRecords(newRecords);
    saveAllRecords(newRecords);
    const dates = Object.keys(newRecords).sort().reverse();
    if (dates.length > 0) {
      setSelectedDate(dates[0]);
    }
    // 同步到云端
    (async () => {
      try {
        const token = await getAccessToken();
        if (token) await syncToCloud(newRecords, token);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleRecordsChange = useCallback(
    (updated: AllRecords) => {
      setRecords(updated);
      saveAllRecords(updated);
      const dates = Object.keys(updated).sort().reverse();
      if (selectedDate && !updated[selectedDate]) {
        setSelectedDate(dates[0] || null);
      }
      // 同步到云端
      (async () => {
        try {
          const token = await getAccessToken();
          if (token) await syncToCloud(updated, token);
        } catch {
          /* ignore */
        }
      })();
    },
    [selectedDate]
  );

  // 当前选中日期的记录
  const currentRecord = selectedDate ? records[selectedDate] : null;
  const sortedDates = Object.keys(records).sort();
  const prevDate = selectedDate
    ? sortedDates.filter((d) => d < selectedDate).pop()
    : undefined;

  // 全局统计
  const totalDays = Object.keys(records).length;
  const totalProducts = new Set(
    Object.values(records).flatMap((r) => Object.keys(r.data))
  ).size;
  const totalOrders = Object.values(records).reduce(
    (sum, r) => sum + Object.values(r.data).reduce((s, p) => s + getProductTotal(p), 0),
    0
  );

  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">正在跳转到登录页...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground p-2 rounded-lg shadow-md">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">售后数据看板</h1>
              <p className="text-xs text-muted-foreground">产品售后数量统计与周趋势分析</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileJson className="h-3.5 w-3.5" />
              <span className="font-bold text-foreground tabular-nums">{totalDays}</span> 日期
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              <span className="font-bold text-foreground tabular-nums">{totalProducts}</span> 产品
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="font-bold text-foreground tabular-nums">{totalOrders}</span> 总单
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShareOpen(true)}
              variant="outline"
              size="sm"
              disabled={totalDays === 0}
            >
              <Share2 className="h-4 w-4 mr-1.5" />
              分享
            </Button>
            <Button onClick={() => setImportOpen(true)} size="sm" className="shrink-0">
              <Plus className="h-4 w-4 mr-1.5" />
              导入
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 px-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="hidden sm:inline text-xs max-w-[120px] truncate">{user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-xs text-muted-foreground">已登录</p>
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  修改密码
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setLogoutConfirm(true)}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {totalDays === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <FileJson className="h-16 w-16 mb-4 opacity-30" />
            <h2 className="text-lg font-semibold mb-2">尚未导入数据</h2>
            <p className="text-sm mb-6 text-center max-w-md">
              导入代表特定日期的 JSON 售后数据，系统将自动记录并支持周趋势分析
            </p>
            <Button onClick={() => setImportOpen(true)} size="lg">
              <Plus className="h-4 w-4 mr-1.5" />
              导入第一份数据
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-140px)]">
            {/* 左侧面板 - 固定 */}
            <div className="lg:col-span-3 lg:overflow-y-auto lg:sticky lg:top-[73px] lg:h-[calc(100vh-140px)] lg:pr-2 scrollbar-thin">
              <DateRecordsPanel
                records={records}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onDeleteDate={(date: string) => {
                  const newRecords = { ...records };
                  delete newRecords[date];
                  handleRecordsChange(newRecords);
                }}
                onUpdateRecords={(updated: Record<string, DateRecord>) => {
                  handleRecordsChange(updated as AllRecords);
                }}
              />
            </div>

            {/* 右侧主区域 - 独立滚动 */}
            <div className="lg:col-span-9 lg:flex lg:flex-col lg:h-[calc(100vh-140px)] lg:pl-2">
              <Tabs defaultValue="overview" className="w-full flex flex-col lg:flex-1 lg:overflow-hidden">
                <TabsList className="mb-4 shrink-0">
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

                <div className="flex-1 overflow-y-auto scrollbar-visible">
                  <TabsContent value="overview">
                    {selectedDate ? (
                      <DayOverview records={records} selectedDate={selectedDate} />
                    ) : (
                      <div className="text-center py-16 text-muted-foreground text-sm">
                        请在左侧选择一个日期查看数据
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="trend">
                    <WeeklyTrendChart records={records} selectedDate={selectedDate} />
                  </TabsContent>

                  <TabsContent value="product">
                    <ProductAnalysis records={records} selectedDate={selectedDate} />
                  </TabsContent>

                  <TabsContent value="region">
                    <RegionDistribution records={records} selectedDate={selectedDate} />
                  </TabsContent>

                  <TabsContent value="shop">
                    <ShopDistribution records={records} selectedDate={selectedDate} />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-8 py-6">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-muted-foreground">
          <p>售后数据看板 &bull; 数据本地+云端存储</p>
          <p className="tabular-nums">{totalDays} 日期记录</p>
        </div>
      </footer>

      <DataImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={handleImported} />

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} records={records} aliases={aliases} />

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

      <AlertDialog open={logoutConfirm} onOpenChange={setLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出登录</AlertDialogTitle>
            <AlertDialogDescription>
              退出后本地数据仍保留，重新登录即可查看。确定要退出吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setLogoutConfirm(false);
                setActiveUser(null);
                await logout();
                router.replace('/login');
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              退出登录
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}