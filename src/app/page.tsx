'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
// Data persistence
import { loadAllRecords, saveAllRecords, loadProductAliases, setActiveUser } from '@/lib/storage';
// Records management & cloud sync
import { syncToCloud, fetchFromCloud, mergeRecords } from '@/lib/records-service';
// API client for backend computation
import { apiComputeFilteredSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getAccessToken } from '@/lib/auth';
import type { AllRecords, DateRecord, ProductAliases } from '@/lib/types';
import DateRecordsPanel from '@/components/date-records-panel';
import { ProductAnalysis } from '@/components/product-analysis';
import { RegionDistribution } from '@/components/region-distribution';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Package,
  FileJson,
  MapPin,
  Store,
  Share2,
  LogOut,
  User,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
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

import { DayOverview } from '@/components/day-overview';
import { WeeklyTrendChart } from '@/components/weekly-trend-chart';
import { ShopDistribution } from '@/components/shop-distribution';

const ExcelImportDialog = dynamic(
  () => import('@/components/excel-import-dialog').then(m => m.ExcelImportDialog), { ssr: false }
);
const DataImportDialog = dynamic(
  () => import('@/components/data-import-dialog').then(m => m.DataImportDialog), { ssr: false }
);
const ShareDialog = dynamic(
  () => import('@/components/share-dialog').then(m => m.ShareDialog), { ssr: false }
);
const ChangePasswordDialog = dynamic(
  () => import('@/components/change-password-dialog').then(m => m.ChangePasswordDialog), { ssr: false }
);

const SCROLL_KEY = 'dashboard_scroll';
const TAB_KEY = 'dashboard_active_tab';

// Animated number counter
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = display;
    const diff = value - start;
    const duration = 600;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <span className={className}>{display.toLocaleString()}</span>;
}

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const [records, setRecords] = useState<AllRecords>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [aliases, setAliases] = useState<ProductAliases>({});
  const [mounted, setMounted] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollRestoredRef = useRef(false);

  // Restore active tab from localStorage
  useEffect(() => {
    let saved = '';
    try { saved = localStorage.getItem(TAB_KEY) || ''; } catch {}
    if (saved) setActiveTab(saved);
  }, []);

  // Save active tab to localStorage on change
  const handleTabChange = useCallback((val: string) => {
    setActiveTab(val);
    try { localStorage.setItem(TAB_KEY, val); } catch {}
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Save scroll position before unload
  useEffect(() => {
    const save = () => {
      const el = scrollContainerRef.current;
      if (el) {
        try { sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop)); } catch {}
      }
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, []);

  // Restore scroll position after content rendered
  useEffect(() => {
    if (scrollRestoredRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    try {
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) {
        const top = parseInt(saved, 10);
        // Wait for charts to render
        const timer = setTimeout(() => {
          el.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
          scrollRestoredRef.current = true;
        }, 200);
        return () => clearTimeout(timer);
      }
    } catch {}
    scrollRestoredRef.current = true;
  }, [records, activeTab]);

  // Periodically save scroll position during session
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          try { sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop)); } catch {}
          ticking = false;
        });
        ticking = true;
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // 当用户状态变化时，加载用户数据
  useEffect(() => {
    if (!mounted) return;
    setRecords({});
    setAliases({});
    setSelectedDate(null);

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

    if (Object.keys(loaded).length > 0) {
      const dates_sorted = Object.keys(loaded).sort();
      const firstDate = dates_sorted[0];
      const lastDate = dates_sorted[dates_sorted.length - 1];
      (async () => {
        try {
          const result = await apiComputeFilteredSummary(loaded, firstDate, lastDate, [], []);
          if (result.summary) {
            setTotalOrders(result.summary.totalOrders);
            setTotalProducts(result.summary.productBreakdown.length);
          }
        } catch (e) {
          const productSet = new Set<string>();
          let orderSum = 0;
          for (const record of Object.values(loaded)) {
            for (const [pName, pData] of Object.entries(record.data || {})) {
              productSet.add(pName);
              orderSum += (pData.total as number) || 0;
            }
          }
          setTotalOrders(orderSum);
          setTotalProducts(productSet.size);
        }
      })();
    }
  }, [mounted, user?.id]);

  // 登录时从云端拉取并合并数据
  useEffect(() => {
    if (!mounted || !isAuthenticated || authLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        setSyncing(true);
        const cloudRecords = await fetchFromCloud(token);
        if (cancelled) return;
        const localRecords = loadAllRecords();
        const merged = await mergeRecords(localRecords, cloudRecords);
        saveAllRecords(merged);
        setRecords(merged);
        const dates = Object.keys(merged).sort().reverse();
        if (dates.length > 0) setSelectedDate(dates[0]);
        if (Object.keys(cloudRecords).length < Object.keys(merged).length) {
          await syncToCloud(merged, token);
        }
      } catch (e) {
        setSyncError('登录同步失败: ' + String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mounted, isAuthenticated, authLoading]);

  // 实时轮询云端数据变更（每10秒）
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const pollingRef = useRef(false);
  const lastCloudHashRef = useRef<string>('');

  useEffect(() => {
    if (!mounted || !isAuthenticated || authLoading) return;

    const POLL_INTERVAL = 10000; // 10秒轮询一次

    const pollCloud = async () => {
      if (pollingRef.current) return; // 防止并发轮询
      pollingRef.current = true;
      try {
        const token = await getAccessToken();
        if (!token) return;
        const cloudRecords = await fetchFromCloud(token);
        const cloudHash = JSON.stringify(
          Object.keys(cloudRecords).sort().map(k => `${k}:${cloudRecords[k].importedAt}`)
        );
        if (cloudHash === lastCloudHashRef.current) return; // 无变化，跳过
        lastCloudHashRef.current = cloudHash;

        const currentRecords = recordsRef.current;
        const merged = await mergeRecords(currentRecords, cloudRecords);

        // 检查是否有实际变化
        const mergedKeys = Object.keys(merged).sort().join(',');
        const currentKeys = Object.keys(currentRecords).sort().join(',');
        if (mergedKeys === currentKeys) return;

        saveAllRecords(merged);
        setRecords(merged);

        // 如果当前选中的日期被删除，自动切换到最近的日期
        const curDate = selectedDateRef.current;
        if (curDate && !merged[curDate]) {
          const dates = Object.keys(merged).sort().reverse();
          setSelectedDate(dates[0] || null);
        }
      } catch {
        // 静默忽略轮询错误
      } finally {
        pollingRef.current = false;
      }
    };

    const interval = setInterval(pollCloud, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [mounted, isAuthenticated, authLoading]);

  useEffect(() => {
    if (mounted && !authLoading && !isAuthenticated) router.replace('/login');
  }, [mounted, authLoading, isAuthenticated, router]);

  const handleImported = useCallback((newRecords: AllRecords) => {
    setRecords(newRecords);
    saveAllRecords(newRecords);
    const dates = Object.keys(newRecords).sort().reverse();
    if (dates.length > 0) setSelectedDate(dates[0]);
    const dates_sorted = Object.keys(newRecords).sort();
    if (dates_sorted.length > 0) {
      (async () => {
        try {
          const result = await apiComputeFilteredSummary(newRecords, dates_sorted[0], dates_sorted[dates_sorted.length - 1], [], []);
          if (result.summary) {
            setTotalOrders(result.summary.totalOrders);
            setTotalProducts(result.summary.productBreakdown.length);
          }
        } catch (e) {
          const ps = new Set<string>(); let os = 0;
          for (const r of Object.values(newRecords)) for (const [pn, pd] of Object.entries(r.data || {})) { ps.add(pn); os += (pd.total as number) || 0; }
          setTotalOrders(os); setTotalProducts(ps.size);
        }
      })();
    }
    (async () => {
      try { const token = await getAccessToken(); if (token) await syncToCloud(newRecords, token); }
      catch (e) { setSyncError('云端同步失败: ' + String(e instanceof Error ? e.message : e)); }
    })();
  }, []);

  const handleRecordsChange = useCallback((updated: AllRecords) => {
    setRecords(updated);
    saveAllRecords(updated);
    const dates = Object.keys(updated).sort().reverse();
    if (selectedDate && !updated[selectedDate]) setSelectedDate(dates[0] || null);
    (async () => {
      try { const token = await getAccessToken(); if (token) await syncToCloud(updated, token); }
      catch (e) { setSyncError('云端同步失败: ' + String(e instanceof Error ? e.message : e)); }
    })();
  }, [selectedDate]);

  const totalDays = Object.keys(records).length;

  // Loading state with pulse animation
  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-primary/20 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">加载中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">正在跳转到登录页...</p>
      </div>
    );
  }

  const tabs = [
    { value: 'overview', icon: BarChart3, label: '数据总览' },
    { value: 'trend', icon: TrendingUp, label: '每日趋势' },
    { value: 'product', icon: Package, label: '产品分析' },
    { value: 'region', icon: MapPin, label: '地域分布' },
    { value: 'shop', icon: Store, label: '店铺分布' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.3); } 50% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out both; }
        .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-fade-in-left { animation: fadeInLeft 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-scale-in { animation: scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-delay-1 { animation-delay: 0.1s; }
        .animate-delay-2 { animation-delay: 0.2s; }
        .animate-delay-3 { animation-delay: 0.3s; }
        .animate-delay-4 { animation-delay: 0.4s; }
        .animate-delay-5 { animation-delay: 0.5s; }
        .tab-content-enter { animation: fadeIn 0.35s ease-out both; }
        .tab-indicator-active { position: relative; }
        .tab-indicator-active::after { content: ''; position: absolute; bottom: -1px; left: 10%; right: 10%; height: 2px; background: var(--primary); border-radius: 2px 2px 0 0; animation: scaleIn 0.25s ease-out; }
        .scrollbar-visible { scrollbar-gutter: stable; }
        .scrollbar-visible::-webkit-scrollbar { width: 6px; }
        .scrollbar-visible::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-visible::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 3px; }
        .scrollbar-visible::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.5); }
        .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
        .loading-shimmer { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 2s infinite; }
        .card-lift { transition: all 0.35s cubic-bezier(0.16,1,0.3,1); }
        .card-lift:hover { transform: translateY(-2px); box-shadow: 0 12px 24px -8px rgba(0,0,0,0.1); }
        /* Accessibility: disable animations for users who prefer reduced motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
          .pulse-glow, .loading-shimmer { animation: none !important; }
        }
        /* Smooth page-level transitions */
        .page-transition-enter { animation: fadeIn 0.35s ease-out both; }
        .page-content { will-change: transform, opacity; }
      `}</style>

      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/60 animate-fade-in">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 animate-fade-in-left">
            <div className="bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground p-2 rounded-lg shadow-md pulse-glow">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">售后数据看板</h1>
              <p className="text-xs text-muted-foreground">产品售后数量统计与周趋势分析</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 animate-fade-in animate-delay-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileJson className="h-3.5 w-3.5" />
              <AnimatedNumber value={totalDays} className="font-bold text-foreground tabular-nums" /> <span>日期</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              <AnimatedNumber value={totalProducts} className="font-bold text-foreground tabular-nums" /> <span>产品</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              <AnimatedNumber value={totalOrders} className="font-bold text-foreground tabular-nums" /> <span>总单</span>
            </div>
          </div>

          {syncError && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-destructive bg-destructive/10 rounded-md border border-destructive/20 animate-scale-in">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{syncError}</span>
              <button onClick={() => setSyncError(null)} className="ml-1 hover:text-destructive/80">&times;</button>
            </div>
          )}
          <div className="flex items-center gap-2 animate-fade-in animate-delay-2">
            <Button onClick={() => setShareOpen(true)} variant="outline" size="sm" disabled={totalDays === 0}>
              <Share2 className="h-4 w-4 mr-1.5" />分享
            </Button>
            <Button onClick={() => setExcelImportOpen(true)} variant="outline" size="sm" className="shrink-0">
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />导入Excel
            </Button>
            <Button onClick={() => setImportOpen(true)} size="sm" className="shrink-0">
              <Plus className="h-4 w-4 mr-1.5" />导入
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
                <div className="px-2 py-1.5"><p className="text-xs text-muted-foreground">已登录</p><p className="text-sm font-medium truncate">{user?.email}</p></div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}><KeyRound className="h-4 w-4 mr-2" />修改密码</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setLogoutConfirm(true)}><LogOut className="h-4 w-4 mr-2" />退出登录</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-3 sm:px-4 py-3 flex-1">
        {totalDays === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground animate-scale-in">
            <FileJson className="h-16 w-16 mb-4 opacity-30" />
            <h2 className="text-lg font-semibold mb-2">尚未导入数据</h2>
            <p className="text-sm mb-6 text-center max-w-md">导入代表特定日期的 JSON 售后数据，系统将自动记录并支持周趋势分析</p>
            <Button onClick={() => setImportOpen(true)} size="lg"><Plus className="h-4 w-4 mr-1.5" />导入第一份数据</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-60px)] animate-fade-in-up">
            <div className="lg:col-span-3 lg:overflow-y-auto lg:sticky lg:top-[52px] lg:h-[calc(100vh-60px)] lg:pr-1 animate-fade-in-left">
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

            <div className="lg:col-span-9 lg:flex lg:flex-col lg:h-[calc(100vh-60px)] lg:pl-1 animate-scale-in animate-delay-1">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col lg:flex-1 lg:overflow-hidden">
                <TabsList className="mb-3 shrink-0">
                  {tabs.map(({ value, icon: Icon, label }) => (
                    <TabsTrigger key={value} value={value} className={`gap-1.5 transition-all duration-200 ${activeTab === value ? 'tab-indicator-active' : ''}`}>
                      <Icon className="h-3.5 w-3.5" />{label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-visible">
                  <TabsContent value="overview" className="tab-content-enter">
                    {selectedDate ? <DayOverview records={records} selectedDate={selectedDate} /> : (
                      <div className="text-center py-16 text-muted-foreground text-sm">请在左侧选择一个日期查看数据</div>
                    )}
                  </TabsContent>
                  <TabsContent value="trend" className="tab-content-enter">
                    <WeeklyTrendChart records={records} selectedDate={selectedDate} />
                  </TabsContent>
                  <TabsContent value="product" className="tab-content-enter">
                    <ProductAnalysis records={records} selectedDate={selectedDate} />
                  </TabsContent>
                  <TabsContent value="region" className="tab-content-enter">
                    <RegionDistribution records={records} selectedDate={selectedDate} />
                  </TabsContent>
                  <TabsContent value="shop" className="tab-content-enter">
                    <ShopDistribution records={records} selectedDate={selectedDate} />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border py-1.5 text-center animate-fade-in" style={{ animationDelay: '0.6s' }}>
        <div className="max-w-[100vw] mx-auto px-3 text-[10px] text-muted-foreground">
          {totalDays} 日期记录
        </div>
      </footer>

      <DataImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={handleImported} />
      <ExcelImportDialog open={excelImportOpen} onOpenChange={setExcelImportOpen} onImported={handleImported} />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} records={records} aliases={aliases} />
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

      <AlertDialog open={logoutConfirm} onOpenChange={setLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出登录</AlertDialogTitle>
            <AlertDialogDescription>退出后本地数据仍保留，重新登录即可查看。确定要退出吗？</AlertDialogDescription>
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
            >退出登录</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
