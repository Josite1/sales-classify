'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

  const KEYWORD_COLORS = ["bg-blue-100 text-blue-700", "bg-green-100 text-green-700", "bg-amber-100 text-amber-700", "bg-purple-100 text-purple-700", "bg-pink-100 text-pink-700", "bg-cyan-100 text-cyan-700", "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700", "bg-teal-100 text-teal-700", "bg-orange-100 text-orange-700"];

  const getKeywordColor = (idx: number) => KEYWORD_COLORS[idx % KEYWORD_COLORS.length];

  const renderKeywords = (keywords: string, sep: string) => {
    const parts = keywords.split(sep).filter(Boolean);
    return parts.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {parts.map((kw, i) => (
          <Badge key={i} variant="secondary" className={"text-xs font-normal " + getKeywordColor(i)}>
            {kw.trim()}
          </Badge>
        ))}
      </div>
    ) : <span className="text-muted-foreground text-xs">-</span>;
  };

    const PaginationBar = ({ page, pages, onPrev, onNext, label }: { page: number; pages: number; onPrev: () => void; onNext: () => void; label: string }) => {
    if (pages <= 1) return null;
    return (
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums min-w-[60px] text-center">{page} / {pages}</span>
          <Button variant="outline" size="sm" onClick={onNext} disabled={page >= pages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

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

  const saveReasons = async (list: KeywordRule[]) => {
    try {
      await fetch(API_BASE + '/api/excel/rules/reasons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasons: list }),
      });
      setReasons(list);
      showSuccess('售后原因规则已保存');
    } catch {
      setError('保存失败');
    }
  };

  const saveProducts = async (list: KeywordRule[]) => {
    try {
      await fetch(API_BASE + '/api/excel/rules/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: list }),
      });
      setProducts(list);
      showSuccess('品类规则已保存');
    } catch {
      setError('保存失败');
    }
  };

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

  return (
    <div className='max-w-[1200px] mx-auto px-4 py-6'>
      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center gap-4'>
          <Link href='/'>
            <Button variant='ghost' size='sm'>
              <ArrowLeft className='h-4 w-4 mr-1' />
              返回
            </Button>
          </Link>
          <h1 className='text-xl font-bold'>后台管理 - 关键词规则</h1>
        </div>
        <div className='flex items-center gap-2'>
          <input
            type='file'
            accept='.xlsx,.xls'
            onChange={handleImportRules}
            className='hidden'
            id='import-rules-file'
          />
          <label htmlFor='import-rules-file'>
            <Button variant='outline' size='sm' disabled={importing} asChild>
              <span>
                {importing ? (
                  <Loader2 className='h-4 w-4 mr-1 animate-spin' />
                ) : (
                  <Upload className='h-4 w-4 mr-1' />
                )}
                导入规则Excel
              </span>
            </Button>
          </label>
          <Button
            size='sm'
            onClick={() => {
              if (activeTab === 'reasons') {
                setEditingReason({ category: '', keywords: '' });
              } else {
                setEditingProduct({ category: '', keywords: '' });
              }
              setDialogOpen(true);
            }}
          >
            <Plus className='h-4 w-4 mr-1' />
            新增规则
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className='flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg mb-4'>
          <CheckCircle2 className='h-4 w-4' />
          {success}
        </div>
      )}
      {error && (
        <div className='flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg mb-4'>
          <AlertCircle className='h-4 w-4' />
          {error}
          <Button variant='ghost' size='sm' onClick={() => setError('')} className='ml-auto'>
            <X className='h-3 w-3' />
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setReasonPage(1); setProductPage(1); }}>
        <TabsList className='mb-4'>
          <TabsTrigger value='reasons'>
            售后原因 ({reasons.length})
          </TabsTrigger>
          <TabsTrigger value='products'>
            品类 ({products.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value='reasons'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm'>售后原因关键词规则</CardTitle>
              <CardDescription className='text-xs'>
                分类用关键词匹配，多个关键词用 - 分隔（如：变质-发酸-异味）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[180px]'>分类</TableHead>
                    <TableHead>关键词</TableHead>
                    <TableHead className='w-[120px] text-right'>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reasonsPaged.data.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className='font-medium'>{item.category}</TableCell>
                      <TableCell>
                        {renderKeywords(item.keywords, '-')}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => {
                            setEditingReason({ ...item });
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className='h-3.5 w-3.5' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='text-destructive hover:text-destructive'
                          onClick={() => {
                            const newList = reasons.filter((r) => r.category !== item.category);
                            saveReasons(newList);
                          }}
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {reasons.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className='text-center text-muted-foreground py-8'>
                        暂无规则，点击 新增规则或导入规则Excel
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <PaginationBar page={reasonPage} pages={reasonsPaged.pages}
                onPrev={() => setReasonPage(p => Math.max(1, p - 1))}
                onNext={() => setReasonPage(p => p + 1)}
                label={`共 ${reasons.length} 条，第 ${reasonPage}/${reasonsPaged.pages} 页`} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='products'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm'>品类关键词规则</CardTitle>
              <CardDescription className='text-xs'>
                品类用关键词匹配，多个关键词用 + 分隔（如：克洛帝亚地道肠_250+250g_克洛帝亚地道肠）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[220px]'>品类</TableHead>
                    <TableHead>关键词</TableHead>
                    <TableHead className='w-[120px] text-right'>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsPaged.data.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className='font-medium'>{item.category}</TableCell>
                      <TableCell>
                        {renderKeywords(item.keywords, '+')}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => {
                            setEditingProduct({ ...item });
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className='h-3.5 w-3.5' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='text-destructive hover:text-destructive'
                          onClick={() => {
                            const newList = products.filter((_, i) => i !== idx);
                            saveProducts(newList);
                          }}
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className='text-center text-muted-foreground py-8'>
                        暂无规则，点击新增规则或导入规则Excel
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <PaginationBar page={productPage} pages={productsPaged.pages}
                onPrev={() => setProductPage(p => Math.max(1, p - 1))}
                onNext={() => setProductPage(p => p + 1)}
                label={`共 ${reasons.length} 条，第 ${reasonPage}/${reasonsPaged.pages} 页`} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='sm:max-w-[480px]'>
          <DialogHeader>
            <DialogTitle>
              {editingReason ? '编辑售后原因' : editingProduct ? '编辑品类' : '新增规则'}
            </DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-2'>
            <div className='grid gap-2'>
              <Label>分类名称</Label>
              <Input
                value={
                  editingReason?.category ||
                  editingProduct?.category ||
                  ''
                }
                onChange={(e) => {
                  if (editingReason) {
                    setEditingReason({ ...editingReason, category: e.target.value });
                  } else if (editingProduct) {
                    setEditingProduct({ ...editingProduct, category: e.target.value });
                  }
                }}
                placeholder='例如：变质'
              />
            </div>
            <div className='grid gap-2'>
              <Label>关键词</Label>
              <Textarea
                value={
                  editingReason?.keywords ||
                  editingProduct?.keywords ||
                  ''
                }
                onChange={(e) => {
                  if (editingReason) {
                    setEditingReason({ ...editingReason, keywords: e.target.value });
                  } else if (editingProduct) {
                    setEditingProduct({ ...editingProduct, keywords: e.target.value });
                  }
                }}
                placeholder={
                  activeTab === 'reasons'
                    ? '多个关键词用 - 分隔，如：变质-发酸-异味'
                    : '多个关键词用 + 分隔，如：250g克洛帝亚地道肠+克洛帝亚地道肠_250'
                }
                className='min-h-[80px]'
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setEditingReason(null);
                setEditingProduct(null);
                setDialogOpen(false);
              }}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                if (editingReason) {
                  const idx = reasons.findIndex(
                    (r) => r.category === editingReason.category
                  );
                  let newList: KeywordRule[];
                  if (idx >= 0) {
                    newList = [...reasons];
                    newList[idx] = editingReason;
                  } else {
                    newList = [...reasons, editingReason];
                  }
                  saveReasons(newList);
                } else if (editingProduct) {
                  const idx = products.findIndex(
                    (p) => p.category === editingProduct.category
                  );
                  let newList: KeywordRule[];
                  if (idx >= 0) {
                    newList = [...products];
                    newList[idx] = editingProduct;
                  } else {
                    newList = [...products, editingProduct];
                  }
                  saveProducts(newList);
                }
                setEditingReason(null);
                setEditingProduct(null);
                setDialogOpen(false);
              }}
            >
              <Save className='h-4 w-4 mr-1' />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
