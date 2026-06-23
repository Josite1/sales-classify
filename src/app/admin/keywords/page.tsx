'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Save,
  X,
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Check,
} from 'lucide-react';
import Link from 'next/link';

interface KeywordRule {
  category: string;
  keywords: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function KeywordsAdminPage() {
  const [reasons, setReasons] = useState<KeywordRule[]>([]);
  const [products, setProducts] = useState<KeywordRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('reasons');
  const [editingReason, setEditingReason] = useState<KeywordRule | null>(null);
  const [editingProduct, setEditingProduct] = useState<KeywordRule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reasonPage, setReasonPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const PAGE_SIZE = 10;

  // 单个关键词编辑状态
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null);
  const [newKeywordText, setNewKeywordText] = useState('');

  // 提示信息平滑淡出
  const [fadingOut, setFadingOut] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 删除行渐隐
  const [deletingReasonKey, setDeletingReasonKey] = useState<string | null>(null);
  const [deletingProductIdx, setDeletingProductIdx] = useState<number | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 新增行高亮
  const [highlightedReason, setHighlightedReason] = useState<string | null>(null);
  const [highlightedProductIdx, setHighlightedProductIdx] = useState<number | null>(null);

  // 保存状态引用，用于乐观更新后的异步保存
  const savingRef = useRef<boolean>(false);

  const KEYWORD_COLORS = ["bg-blue-50 text-blue-700 border-blue-200", "bg-green-50 text-green-700 border-green-200", "bg-amber-50 text-amber-700 border-amber-200", "bg-purple-50 text-purple-700 border-purple-200", "bg-pink-50 text-pink-700 border-pink-200", "bg-cyan-50 text-cyan-700 border-cyan-200", "bg-rose-50 text-rose-700 border-rose-200", "bg-indigo-50 text-indigo-700 border-indigo-200", "bg-teal-50 text-teal-700 border-teal-200", "bg-orange-50 text-orange-700 border-orange-200"];

  const getKeywordColor = (idx: number) => KEYWORD_COLORS[idx % KEYWORD_COLORS.length];

  // 异步保存售后原因
  const saveReasonsAsync = async (list: KeywordRule[], newCategory?: string) => {
    try {
      await fetch(API_BASE + '/api/excel/rules/reasons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasons: list }),
      });
      showSuccess('售后原因规则已保存');
      if (newCategory) {
        setHighlightedReason(newCategory);
        setTimeout(() => setHighlightedReason(null), 1500);
      }
    } catch {
      setError('保存失败');
    }
  };

  // 异步保存品类
  const saveProductsAsync = async (list: KeywordRule[], newIdx?: number) => {
    try {
      await fetch(API_BASE + '/api/excel/rules/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: list }),
      });
      showSuccess('品类规则已保存');
      if (newIdx !== undefined) {
        setHighlightedProductIdx(newIdx);
        setTimeout(() => setHighlightedProductIdx(null), 1500);
      }
    } catch {
      setError('保存失败');
    }
  };

  // 核心：更新某个规则的关键词（乐观更新）
  const handleUpdateKeywords = (type: 'reasons' | 'products', category: string, newKeywords: string) => {
    if (type === 'reasons') {
      const newList = reasons.map(r => r.category === category ? { ...r, keywords: newKeywords } : r);
      setReasons(newList); // 立即更新 UI
      saveReasonsAsync(newList); // 异步保存
    } else {
      const newList = products.map(p => p.category === category ? { ...p, keywords: newKeywords } : p);
      setProducts(newList); // 立即更新 UI
      saveProductsAsync(newList); // 异步保存
    }
  };

  // 渲染可交互的关键词区域
  const renderInteractiveKeywords = (item: KeywordRule, type: 'reasons' | 'products', sep: string) => {
    const parts = item.keywords.split(sep).filter(Boolean);
    const editKey = `${type}-${item.category}`;
    const isEditing = editingKeyword === editKey;

    const handleAdd = () => {
      if (!newKeywordText.trim()) return;
      const newKeywords = [...parts, newKeywordText.trim()].join(sep);
      handleUpdateKeywords(type, item.category, newKeywords);
      setNewKeywordText('');
      setEditingKeyword(null);
    };

    const handleDelete = (kw: string) => {
      const newKeywords = parts.filter(k => k !== kw).join(sep);
      handleUpdateKeywords(type, item.category, newKeywords);
    };

    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {parts.map((kw, i) => (
          <Badge
            key={i}
            variant="outline"
            className={`text-xs font-medium pl-2.5 pr-1 py-0.5 flex items-center gap-1 rounded-full transition-all duration-300 ease-out hover:scale-110 hover:shadow-lg hover:-translate-y-0.5 group ${getKeywordColor(i)}`}
            style={{ animation: `bounceIn 0.4s ${i * 0.05}s both` }}
          >
            {kw.trim()}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-transparent hover:text-red-500 ml-0.5"
              onClick={(e) => { e.stopPropagation(); handleDelete(kw.trim()); }}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        {isEditing ? (
          <div className="flex items-center gap-1 animate-fadeIn">
            <Input
              value={newKeywordText}
              onChange={(e) => setNewKeywordText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              className="h-7 w-28 text-xs rounded-full px-3 input-glow"
              autoFocus
            />
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:text-green-700" onClick={handleAdd}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => setEditingKeyword(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-full border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 hover:scale-110 ripple-btn"
            onClick={() => { setEditingKeyword(editKey); setNewKeywordText(''); }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  const PaginationBar = ({ page, pages, onPrev, onNext, label }: { page: number; pages: number; onPrev: () => void; onNext: () => void; label: string }) => {
    if (pages <= 1) return null;
    return (
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1} className="transition-all duration-300 ease-out active:scale-90 hover:shadow-md hover:-translate-y-0.5">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums min-w-[60px] text-center font-medium transition-all duration-300 ease-out hover:scale-110">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" onClick={onNext} disabled={page >= pages} className="transition-all duration-300 ease-out active:scale-90 hover:shadow-md hover:-translate-y-0.5">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const showSuccess = (msg: string) => {
    if (successTimer.current) clearTimeout(successTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setFadingOut(false);
    setSuccess(msg);
    fadeTimer.current = setTimeout(() => setFadingOut(true), 2800);
    successTimer.current = setTimeout(() => {
      setSuccess('');
      setFadingOut(false);
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    };
  }, []);

  const reasonsPaged = useMemo(() => {
    const start = (reasonPage - 1) * PAGE_SIZE;
    return { data: reasons.slice(start, start + PAGE_SIZE), total: reasons.length, pages: Math.ceil(reasons.length / PAGE_SIZE) };
  }, [reasons, reasonPage]);

  const productsPaged = useMemo(() => {
    const start = (productPage - 1) * PAGE_SIZE;
    return { data: products.slice(start, start + PAGE_SIZE), total: products.length, pages: Math.ceil(products.length / PAGE_SIZE) };
  }, [products, productPage]);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch(API_BASE + '/api/excel/rules/all');
      const data = await res.json();
      setReasons(data.reasons || []);
      setProducts(data.products || []);
    } catch {
      setError('无法连接后端，请确保后端已启动');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // 删除整行规则（乐观更新）
  const handleDeleteReason = (category: string) => {
    setDeletingReasonKey(category);
    deleteTimer.current = setTimeout(() => {
      const newList = reasons.filter((r) => r.category !== category);
      setReasons(newList); // 立即移除
      setDeletingReasonKey(null);
      saveReasonsAsync(newList); // 异步保存
    }, 350);
  };

  const handleDeleteProduct = (idx: number) => {
    setDeletingProductIdx(idx);
    deleteTimer.current = setTimeout(() => {
      const newList = products.filter((_, i) => i !== idx);
      setProducts(newList); // 立即移除
      setDeletingProductIdx(null);
      saveProductsAsync(newList); // 异步保存
    }, 350);
  };

  // 导入规则（保持原有同步模式，因为涉及文件上传，不可乐观）
  const handleImportRules = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('rules_file', file);
      const res = await fetch(API_BASE + '/api/excel/rules/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setReasons(data.reasons || []);
        setProducts(data.products || []);
        showSuccess('规则导入成功');
      }
    } catch {
      setError('规则导入失败');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const getStaggerDelay = (index: number) => `${index * 0.06}s`;

  return (
    <>
      {/* 全部动画注入 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { opacity: 1; transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes rowFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ripple {
          to { transform: scale(4); opacity: 0; }
        }
        @keyframes inputGlow {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.2); }
          100% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0); }
        }
        @keyframes numberPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); color: #3b82f6; }
          100% { transform: scale(1); }
        }
        @keyframes successPop {
          0% { transform: scale(0.9); opacity: 0; }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes rowHighlight {
          0% { background-color: rgba(59, 130, 246, 0.08); }
          100% { background-color: transparent; }
        }
        .animate-fadeIn { animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fadeOut { animation: fadeOut 0.4s ease-in forwards; }
        .animate-slideDown { animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slideUp { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-scaleIn { animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-shimmer {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.8s infinite ease-in-out;
        }
        .deleting-row {
          animation: fadeOut 0.35s ease-in forwards, shrinkOut 0.35s ease-in forwards;
        }
        @keyframes shrinkOut {
          from { transform: scaleY(1); opacity: 1; }
          to { transform: scaleY(0.8); opacity: 0; }
        }
        .tab-underline {
          position: relative;
        }
        .tab-underline::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -2px;
          width: 100%;
          height: 2px;
          background: currentColor;
          transform: scaleX(0);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tab-underline[data-state="active"]::after {
          transform: scaleX(1);
        }
        .card-hover {
          transition: box-shadow 0.3s ease, transform 0.3s ease;
        }
        .card-hover:hover {
          box-shadow: 0 8px 25px rgba(0,0,0,0.06);
          transform: translateY(-1px);
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
          background: rgba(255, 255, 255, 0.4);
          opacity: 0;
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(1);
          pointer-events: none;
        }
        .ripple-btn:active::after {
          animation: ripple 0.6s ease-out;
        }
        .input-glow:focus {
          animation: inputGlow 1.5s ease-out;
        }
        .number-pop {
          display: inline-block;
          animation: numberPop 0.4s ease-out;
        }
        .success-pop {
          animation: successPop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .highlight-row {
          animation: rowHighlight 1.5s ease-out;
        }
      `}</style>

      <div className='max-w-[1200px] mx-auto px-4 py-6 animate-fadeIn'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-4'>
            <Link href='/'>
              <Button variant='ghost' size='sm' className="transition-all duration-300 ease-out hover:bg-muted/50 active:scale-95 hover:-translate-y-px">
                <ArrowLeft className='h-4 w-4 mr-1' />
                返回
              </Button>
            </Link>
            <h1 className='text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent transition-all duration-500 hover:scale-[1.02]'>
              后台管理 - 关键词规则
            </h1>
          </div>
          <div className='flex items-center gap-2'>
            <input type='file' accept='.xlsx,.xls' onChange={handleImportRules} className='hidden' id='import-rules-file' />
            <label htmlFor='import-rules-file'>
              <Button variant='outline' size='sm' disabled={importing} asChild className="ripple-btn transition-all duration-300 ease-out active:scale-95 hover:shadow-md">
                <span>
                  {importing ? <Loader2 className='h-4 w-4 mr-1 animate-spin' /> : <Upload className='h-4 w-4 mr-1' />}
                  导入规则Excel
                </span>
              </Button>
            </label>
            <Button size='sm' onClick={() => {
              if (activeTab === 'reasons') setEditingReason({ category: '', keywords: '' });
              else setEditingProduct({ category: '', keywords: '' });
              setDialogOpen(true);
            }} className="ripple-btn transition-all duration-300 ease-out active:scale-95 hover:shadow-md">
              <Plus className='h-4 w-4 mr-1' />
              新增规则
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {success && (
          <div className={`flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg mb-4 transition-opacity duration-500 ease-out ${fadingOut ? 'opacity-0' : 'opacity-100 success-pop'}`}>
            <CheckCircle2 className='h-4 w-4' />
            {success}
          </div>
        )}
        {error && (
          <div className='flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg mb-4 animate-slideDown'>
            <AlertCircle className='h-4 w-4' />
            {error}
            <Button variant='ghost' size='sm' onClick={() => setError('')} className='ml-auto transition-all duration-300 ease-out hover:bg-destructive/20 active:scale-90 hover:rotate-90'>
              <X className='h-3 w-3' />
            </Button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-4 animate-fadeIn">
            <div className="h-10 w-64 animate-shimmer rounded-md" />
            <div className="border rounded-lg p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 w-full animate-shimmer rounded" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setReasonPage(1); setProductPage(1); }}>
            <TabsList className='mb-4'>
              <TabsTrigger value='reasons' className="tab-underline transition-all duration-300 ease-out data-[state=active]:shadow-sm">
                售后原因 (<span className="number-pop">{reasons.length}</span>)
              </TabsTrigger>
              <TabsTrigger value='products' className="tab-underline transition-all duration-300 ease-out data-[state=active]:shadow-sm">
                品类 (<span className="number-pop">{products.length}</span>)
              </TabsTrigger>
            </TabsList>

            <TabsContent value='reasons'>
              <div className="animate-fadeIn" key="reasons-content">
                <Card className="card-hover rounded-xl border-muted/60">
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-base'>售后原因关键词规则</CardTitle>
                    <CardDescription className='text-xs'>
                      分类用关键词匹配，多个关键词用 - 分隔（如：变质-发酸-异味）
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className='w-[180px] text-sm'>分类</TableHead>
                          <TableHead className='text-sm'>关键词</TableHead>
                          <TableHead className='w-[120px] text-right text-sm'>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reasonsPaged.data.map((item, idx) => (
                          <TableRow
                            key={item.category}
                            className={`transition-colors duration-200 ease-out hover:bg-muted/30 ${deletingReasonKey === item.category ? 'deleting-row' : ''} ${highlightedReason === item.category ? 'highlight-row' : ''}`}
                            style={{ animation: `rowFadeIn 0.4s ${getStaggerDelay(idx)} both` }}
                          >
                            <TableCell className='font-medium text-sm'>{item.category}</TableCell>
                            <TableCell>{renderInteractiveKeywords(item, 'reasons', '-')}</TableCell>
                            <TableCell className='text-right'>
                              <Button variant='ghost' size='sm' onClick={() => { setEditingReason({ ...item }); setDialogOpen(true); }} className="ripple-btn transition-all duration-300 ease-out hover:scale-110 active:scale-90 hover:text-primary">
                                <Pencil className='h-4 w-4' />
                              </Button>
                              <Button variant='ghost' size='sm' className='ripple-btn text-destructive hover:text-destructive transition-all duration-300 ease-out hover:scale-110 active:scale-90' onClick={() => handleDeleteReason(item.category)}>
                                <Trash2 className='h-4 w-4' />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {reasons.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className='text-center text-muted-foreground py-8 text-sm'>
                              暂无规则，点击 新增规则或导入规则Excel
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    <PaginationBar page={reasonPage} pages={reasonsPaged.pages} onPrev={() => setReasonPage(p => Math.max(1, p - 1))} onNext={() => setReasonPage(p => p + 1)} label={`共 ${reasons.length} 条，第 ${reasonPage}/${reasonsPaged.pages} 页`} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value='products'>
              <div className="animate-fadeIn" key="products-content">
                <Card className="card-hover rounded-xl border-muted/60">
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-base'>品类关键词规则</CardTitle>
                    <CardDescription className='text-xs'>
                      品类用关键词匹配，多个关键词用 + 分隔（如：克洛帝亚地道肠_250+250g_克洛帝亚地道肠）
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className='w-[220px] text-sm'>品类</TableHead>
                          <TableHead className='text-sm'>关键词</TableHead>
                          <TableHead className='w-[120px] text-right text-sm'>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productsPaged.data.map((item, idx) => {
                          const globalIdx = (productPage - 1) * PAGE_SIZE + idx;
                          return (
                            <TableRow
                              key={idx}
                              className={`transition-colors duration-200 ease-out hover:bg-muted/30 ${deletingProductIdx === globalIdx ? 'deleting-row' : ''} ${highlightedProductIdx === globalIdx ? 'highlight-row' : ''}`}
                              style={{ animation: `rowFadeIn 0.4s ${getStaggerDelay(idx)} both` }}
                            >
                              <TableCell className='font-medium text-sm'>{item.category}</TableCell>
                              <TableCell>{renderInteractiveKeywords(item, 'products', '+')}</TableCell>
                              <TableCell className='text-right'>
                                <Button variant='ghost' size='sm' onClick={() => { setEditingProduct({ ...item }); setDialogOpen(true); }} className="ripple-btn transition-all duration-300 ease-out hover:scale-110 active:scale-90 hover:text-primary">
                                  <Pencil className='h-4 w-4' />
                                </Button>
                                <Button variant='ghost' size='sm' className='ripple-btn text-destructive hover:text-destructive transition-all duration-300 ease-out hover:scale-110 active:scale-90' onClick={() => handleDeleteProduct(globalIdx)}>
                                  <Trash2 className='h-4 w-4' />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {products.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className='text-center text-muted-foreground py-8 text-sm'>
                              暂无规则，点击新增规则或导入规则Excel
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    <PaginationBar page={productPage} pages={productsPaged.pages} onPrev={() => setProductPage(p => Math.max(1, p - 1))} onNext={() => setProductPage(p => p + 1)} label={`共 ${products.length} 条，第 ${productPage}/${productsPaged.pages} 页`} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className='sm:max-w-[480px] animate-slideUp'>
            <DialogHeader>
              <DialogTitle className="animate-fadeIn">
                {editingReason ? '编辑售后原因' : editingProduct ? '编辑品类' : '新增规则'}
              </DialogTitle>
            </DialogHeader>
            <div className='grid gap-4 py-2'>
              <div className='grid gap-2'>
                <Label className="text-sm">分类名称</Label>
                <Input
                  value={editingReason?.category || editingProduct?.category || ''}
                  onChange={(e) => {
                    if (editingReason) setEditingReason({ ...editingReason, category: e.target.value });
                    else if (editingProduct) setEditingProduct({ ...editingProduct, category: e.target.value });
                  }}
                  placeholder='例如：变质'
                  className="input-glow transition-all duration-300 ease-out focus:ring-2 focus:ring-primary/20 focus:scale-[1.01]"
                />
              </div>
              <div className='grid gap-2'>
                <Label className="text-sm">关键词</Label>
                <Textarea
                  value={editingReason?.keywords || editingProduct?.keywords || ''}
                  onChange={(e) => {
                    if (editingReason) setEditingReason({ ...editingReason, keywords: e.target.value });
                    else if (editingProduct) setEditingProduct({ ...editingProduct, keywords: e.target.value });
                  }}
                  placeholder={activeTab === 'reasons' ? '多个关键词用 - 分隔，如：变质-发酸-异味' : '多个关键词用 + 分隔，如：250g克洛帝亚地道肠+克洛帝亚地道肠_250'}
                  className='min-h-[80px] input-glow transition-all duration-300 ease-out focus:ring-2 focus:ring-primary/20 focus:scale-[1.01]'
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant='outline' onClick={() => { setEditingReason(null); setEditingProduct(null); setDialogOpen(false); }} className="ripple-btn transition-all duration-300 ease-out active:scale-95 hover:shadow-sm">
                取消
              </Button>
              <Button onClick={() => {
                if (editingReason) {
                  const idx = reasons.findIndex(r => r.category === editingReason.category);
                  let newList: KeywordRule[];
                  const isNew = idx < 0;
                  if (isNew) {
                    newList = [...reasons, editingReason];
                  } else {
                    newList = [...reasons];
                    newList[idx] = editingReason;
                  }
                  setReasons(newList); // 乐观更新
                  setEditingReason(null);
                  setEditingProduct(null);
                  setDialogOpen(false);
                  saveReasonsAsync(newList, isNew ? editingReason.category : undefined);
                } else if (editingProduct) {
                  const idx = products.findIndex(p => p.category === editingProduct.category);
                  let newList: KeywordRule[];
                  const isNew = idx < 0;
                  if (isNew) {
                    newList = [...products, editingProduct];
                  } else {
                    newList = [...products];
                    newList[idx] = editingProduct;
                  }
                  setProducts(newList); // 乐观更新
                  setEditingReason(null);
                  setEditingProduct(null);
                  setDialogOpen(false);
                  saveProductsAsync(newList, isNew ? newList.length - 1 : undefined);
                }
              }} className="ripple-btn transition-all duration-300 ease-out active:scale-95 hover:shadow-md">
                <Save className='h-4 w-4 mr-1' />
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
