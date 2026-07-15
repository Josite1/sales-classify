'use client';

import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
// Data persistence
import { loadProductAliases, setActiveUser, loadCloudCache, saveCloudCache, loadCloudHash, saveCloudHash } from '@/lib/storage';
// Records management & cloud sync
import { syncToCloud, fetchFromCloud, fetchFromCloudTimestamps } from '@/lib/records-service';
// API client for backend computation
import { apiComputeFilteredSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getAccessToken } from '@/lib/auth';
import type { AllRecords, DateRecord, ProductAliases } from '@/lib/types';
import DateRecordsPanel from '@/components/date-records-panel';
import { ProductAnalysis } from '@/components/product-analysis';
import { RegionDistribution } from '@/components/region-distribution';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Package,
  FileJson,
  MapPin,
  Store,
  LogOut,
  User,
  KeyRound,
  AlertCircle,
  Type,
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

// ── Tab lazy-render: only mount the active tab's content ──
// This avoids initializing all 5 ECharts instances at once,
// which dramatically reduces mount time and memory usage.

function NoDataPrompt() {
  return (
    <div className="text-center py-16 text-muted-foreground text-sm">
      请在左侧选择一个日期查看数据
    </div>
  );
}

function TabContentRender({
  activeTab,
  records,
  selectedDate,
}: {
  activeTab: string;
  records: AllRecords;
  selectedDate: string | null;
}) {
  // Only render the active tab — other tabs are never mounted
  switch (activeTab) {
    case 'overview':
      if (!selectedDate) return <NoDataPrompt />;
      return <DayOverview records={records} selectedDate={selectedDate} />;
    case 'trend':
      return <WeeklyTrendChart records={records} selectedDate={selectedDate} />;
    case 'product':
      return <ProductAnalysis records={records} selectedDate={selectedDate} />;
    case 'region':
      return <RegionDistribution records={records} selectedDate={selectedDate} />;
    case 'shop':
      return <ShopDistribution records={records} selectedDate={selectedDate} />;
    default:
      return <NoDataPrompt />;
  }
}

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const [records, setRecords] = useState<AllRecords>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [customFont, setCustomFont] = useState(true);
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
    startTransition(() => {
      setActiveTab(val);
      try { localStorage.setItem(TAB_KEY, val); } catch {}
    });
  }, []);

  // Toggle between PingFang SC and system fallback
  const toggleFont = useCallback(() => {
    setCustomFont((prev) => {
      const next = !prev;
      document.documentElement.style.setProperty(
        '--font-sans',
        next
          ? '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
          : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      );
      try { localStorage.setItem('customFont', String(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    setMounted(true);
    // Restore font preference
    try {
      const saved = localStorage.getItem('customFont');
      if (saved === 'false') {
        setCustomFont(false);
        document.documentElement.style.setProperty(
          '--font-sans',
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        );
      }
    } catch {}
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

  // 当 records 变化时，重新计算顶部统计数字
  useEffect(() => {
    const dates = Object.keys(records);
    if (dates.length === 0) { setTotalOrders(0); setTotalProducts(0); return; }
    const sorted = dates.sort();
    (async () => {
      try {
        const result = await apiComputeFilteredSummary(
          records, sorted[0], sorted[sorted.length - 1], [], []
        );
        if (result.summary) {
          setTotalOrders(result.summary.totalOrders);
          setTotalProducts(result.summary.productBreakdown.length);
        }
      } catch {
        const ps = new Set<string>(); let os = 0;
        for (const r of Object.values(records)) {
          for (const [pn, pd] of Object.entries(r.data || {})) {
            ps.add(pn); os += (pd.total as number) || 0;
          }
        }
        setTotalOrders(os); setTotalProducts(ps.size);
      }
    })();
  }, [records]);

  // 当用户变化时重置并等待云端数据加载
  useEffect(() => {
    if (!mounted) return;
    setRecords({});
    setAliases({});
    setSelectedDate(null);
    setTotalOrders(0);
    setTotalProducts(0);

    if (user?.id) {
      setActiveUser(user.id);
    }
    // 重置 initialSyncDone，让新用户触发云端加载
    initialSyncDone.current = false;
  }, [mounted, user?.id]);

  // 登录时从云端拉取数据（优先使用 localStorage 缓存，避免每次刷新 10s 全量拉取）
  const initialSyncDone = useRef(false);
  useEffect(() => {
    if (!mounted || !isAuthenticated || authLoading || initialSyncDone.current) return;
    initialSyncDone.current = true;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) { initialSyncDone.current = false; return; }
        setSyncing(true);

        // 1. 先检查 localStorage 缓存
        const cached = loadCloudCache();
        const cachedHash = loadCloudHash();
        let cloudRecords: AllRecords;

        if (cached && Object.keys(cached).length > 0 && cachedHash) {
          // 先用缓存快速渲染
          setRecords(cached);
          const dates = Object.keys(cached).sort().reverse();
          if (dates.length > 0) setSelectedDate(dates[0]);

          // 2. 轻量检查云端是否有变更（~200ms）
          try {
            const timestamps = await fetchFromCloudTimestamps(token);
            const cloudHash = JSON.stringify(
              Object.keys(timestamps).sort().map(k => `${k}:${timestamps[k]}`)
            );
            if (cloudHash === cachedHash) {
              lastCloudHashRef.current = cloudHash;
              if (!cancelled) setSyncing(false);
              setAliases(loadProductAliases());
              return; // 缓存有效，跳过全量拉取
            }
          } catch {
            // 时间戳检查失败，降级到全量拉取
          }
        }

        // 3. 缓存无效，全量拉取（~10s）
        cloudRecords = await fetchFromCloud(token);
        if (cancelled) { initialSyncDone.current = false; return; }

        // 4. 更新缓存
        saveCloudCache(cloudRecords);
        const newHash = JSON.stringify(
          Object.keys(cloudRecords).sort().map(k => `${k}:${cloudRecords[k].importedAt}`)
        );
        saveCloudHash(newHash);
        lastCloudHashRef.current = newHash;

        setRecords(cloudRecords);
        setAliases(loadProductAliases());
        const dates = Object.keys(cloudRecords).sort().reverse();
        if (dates.length > 0) setSelectedDate(dates[0]);
      } catch (e) {
        setSyncError('登录同步失败: ' + String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mounted, isAuthenticated, authLoading]);

  // 实时轮询云端数据变更（每30秒，优先轻量检查）
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const pollingRef = useRef(false);
  const lastCloudHashRef = useRef<string>('');
  const syncingCloudRef = useRef(false);
  const pendingSyncDate = useRef<string | null>(null);

  useEffect(() => {
    if (!mounted || !isAuthenticated || authLoading || !initialSyncDone.current) return;

    const POLL_INTERVAL = 60000; // 60秒轮询

    const pollCloud = async () => {
      if (pollingRef.current || syncingCloudRef.current) return;
      pollingRef.current = true;
      try {
        const token = await getAccessToken();
        if (!token) return;

        // 轻量检查时间戳 ~200ms
        const timestamps = await fetchFromCloudTimestamps(token);
        const cloudHash = JSON.stringify(
          Object.keys(timestamps).sort().map(k => `${k}:${timestamps[k]}`)
        );
        if (cloudHash === lastCloudHashRef.current) return;
        lastCloudHashRef.current = cloudHash;

        // 有变更，全量拉取
        const cloudRecords = await fetchFromCloud(token);
        if (Object.keys(cloudRecords).length === 0) return;

        // 更新缓存
        saveCloudCache(cloudRecords);
        saveCloudHash(cloudHash);

        if (pendingSyncDate.current && !cloudRecords[pendingSyncDate.current]) return;
        pendingSyncDate.current = null;
        setRecords(cloudRecords);

        const curDate = selectedDateRef.current;
        if (curDate && !cloudRecords[curDate]) {
          const dates = Object.keys(cloudRecords).sort().reverse();
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

  const handleImported = useCallback((newRecords: AllRecords, newRecordsOnly?: AllRecords) => {
    setRecords(prev => ({ ...prev, ...newRecords }));
    const toSync = newRecordsOnly || newRecords;
    if (newRecordsOnly) {
      pendingSyncDate.current = Object.keys(newRecordsOnly)[0] || null;
    }
    // 选中最新导入的日期
    const importedDates = Object.keys(newRecords);
    if (importedDates.length > 0) setSelectedDate(importedDates.sort().reverse()[0]);
    // 增量同步：只上传新增日期
    syncingCloudRef.current = true;
    (async () => {
      try { const token = await getAccessToken(); if (token) await syncToCloud(toSync, token, false); }
      catch (e) { setSyncError('云端同步失败: ' + String(e instanceof Error ? e.message : e)); }
      finally { syncingCloudRef.current = false; }
    })();
  }, []);

  const handleRecordsChange = useCallback((updated: AllRecords) => {
    setRecords(updated);
    const curDate = selectedDateRef.current;
    const dates = Object.keys(updated).sort().reverse();
    if (curDate && !updated[curDate]) setSelectedDate(dates[0] || null);
    syncingCloudRef.current = true;
    (async () => {
      try { const token = await getAccessToken(); if (token) await syncToCloud(updated, token, true); }
      catch (e) { setSyncError('云端同步失败: ' + String(e instanceof Error ? e.message : e)); }
      finally { syncingCloudRef.current = false; }
    })();
  }, []);

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
        .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
        .loading-shimmer { background: linear-gradient(90deg, #e8f5e9 25%, #c8e6c9 50%, #e8f5e9 75%); background-size: 200% 100%; animation: shimmer 2s infinite; }
        .card-lift { transition: all 0.35s cubic-bezier(0.16,1,0.3,1); }
        .card-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(16,185,129,0.12), 0 2px 4px rgba(0,0,0,0.06); }
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

      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-primary/10 animate-fade-in">
        <div className="w-full px-2 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 animate-fade-in-left">
            <div className="bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground p-2.5 rounded-xl shadow-lg shadow-primary/20 pulse-glow">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">售后数据看板</h1>
              <p className="text-sm text-muted-foreground">产品售后数量统计与周趋势分析</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-5 animate-fade-in animate-delay-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <FileJson className="h-4 w-4" />
              <AnimatedNumber value={totalDays} className="font-bold text-foreground tabular-nums" /> <span>日期</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <AnimatedNumber value={totalProducts} className="font-bold text-foreground tabular-nums" /> <span>产品</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
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
            <Button onClick={toggleFont} variant="outline" size="sm" title="切换字体">
              <Type className="h-4 w-4 mr-1.5" />{customFont ? '苹方' : '系统默认'}
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

      <main className="max-w-full px-[5vw] py-3 flex-1 min-h-[calc(100vh-48px-50px)]">
        {totalDays === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground animate-scale-in">
            <FileJson className="h-16 w-16 mb-4 opacity-30" />
            <h2 className="text-lg font-semibold mb-2">尚未导入数据</h2>
            <p className="text-sm mb-6 text-center max-w-md">导入代表特定日期的 JSON 售后数据，系统将自动记录并支持周趋势分析</p>
            <Button onClick={() => setImportOpen(true)} size="lg"><Plus className="h-4 w-4 mr-1.5" />导入第一份数据</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-2 lg:h-[calc(100vh-60px)] animate-fade-in-up">
            <div className="lg:overflow-y-auto lg:sticky lg:top-[52px] lg:h-[calc(100vh-60px)] animate-fade-in-left">
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

            <div className="lg:flex lg:flex-col lg:h-[calc(100vh-60px)] pr-4 max-w-[70vw] animate-scale-in animate-delay-1">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col lg:flex-1 lg:overflow-hidden">
                <TabsList className="mb-3 shrink-0">
                  {tabs.map(({ value, icon: Icon, label }) => (
                    <TabsTrigger key={value} value={value} className={`gap-1.5 transition-all duration-200 ${activeTab === value ? 'tab-indicator-active' : ''}`}>
                      <Icon className="h-3.5 w-3.5" />{label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-visible">
                  <div key={activeTab} className="tab-content-enter">
                    <TabContentRender activeTab={activeTab} records={records} selectedDate={selectedDate} />
                  </div>
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
