'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Save,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Package,
  BarChart3,
  Pencil,
  AlertTriangle,
  Check,
  MapPin,
  Store,
} from 'lucide-react';
import type { AllRecords, DateRecord, ProductData } from '@/lib/types';
import { loadAllRecords, saveAllRecords } from '@/lib/storage';
import { toast } from 'sonner';

interface EditableProduct {
  name: string;
  data: ProductData;
}

export default function EditDatePage() {
  const router = useRouter();
  const params = useParams();
  const date = params.date as string;

  const [record, setRecord] = useState<DateRecord | null>(null);
  const [products, setProducts] = useState<EditableProduct[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    const allRecords = loadAllRecords();
    const existingRecord = allRecords[date];
    if (existingRecord) {
      setRecord(existingRecord);
      const prods = Object.entries(existingRecord.data).map(([name, data]) => ({
        name,
        data: JSON.parse(JSON.stringify(data)) as ProductData,
      }));
      setProducts(prods);
    } else {
      // Create new record
      const newRecord: DateRecord = {
        date,
        data: {},
        importedAt: Date.now(),
      };
      setRecord(newRecord);
      setProducts([]);
    }
    setIsLoading(false);
  }, [date]);

  // Track changes
  useEffect(() => {
    if (!record) return;
    const currentData: Record<string, ProductData> = {};
    products.forEach(p => {
      currentData[p.name] = p.data;
    });
    const currentRecord = { ...record, data: currentData };
    const originalData = JSON.stringify(record);
    const currentDataStr = JSON.stringify(currentRecord);
    setHasChanges(originalData !== currentDataStr);
  }, [products, record]);

  const updateProduct = useCallback((index: number, updater: (p: EditableProduct) => EditableProduct) => {
    setProducts(prev => prev.map((p, i) => (i === index ? updater(p) : p)));
  }, []);

  const updateProductName = useCallback((index: number, newName: string) => {
    updateProduct(index, p => ({ ...p, name: newName }));
  }, [updateProduct]);

  const updateProductTotal = useCallback((index: number, total: number) => {
    updateProduct(index, p => ({ ...p, data: { ...p.data, total } }));
  }, [updateProduct]);

  const addProduct = useCallback(() => {
    const newProduct: EditableProduct = {
      name: '新产品',
      data: {
        total: 0,
        标旗分类: {},
        数量分类: {},
        客服备注分类: {},
        省份分类: {},
        店铺分类: {},
      },
    };
    setProducts(prev => [...prev, newProduct]);
    setExpandedProduct('新产品');
  }, []);

  const removeProduct = useCallback((index: number) => {
    setProducts(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    if (!record) return;
    const data: Record<string, ProductData> = {};
    products.forEach(p => {
      data[p.name] = p.data;
    });
    const allRecords = loadAllRecords();
    const updatedRecords: AllRecords = {
      ...allRecords,
      [date]: { ...record, data, importedAt: Date.now() },
    };
    saveAllRecords(updatedRecords);
    toast.success('保存成功', { description: `${date} 的数据已更新` });
    router.push('/');
  }, [record, products, date, router]);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setShowCancelDialog(true);
    } else {
      router.push('/');
    }
  }, [hasChanges, router]);

  const confirmCancel = useCallback(() => {
    setShowCancelDialog(false);
    router.push('/');
  }, [router]);

  const totalOrders = products.reduce((sum, p) => sum + (p.data.total || 0), 0);
  const totalProducts = products.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-primary/10">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              <h1 className="text-lg font-bold tracking-tight">编辑数据</h1>
            </div>
            <Badge variant="secondary" className="text-sm font-semibold">
              {date}
            </Badge>
            {hasChanges && (
              <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600 bg-amber-50">
                有未保存变更
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span className="font-bold text-foreground tabular-nums">{totalProducts}</span> 产品
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="font-bold text-foreground tabular-nums">{totalOrders}</span> 单
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-6 space-y-6">
        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button onClick={addProduct} className="gap-1.5">
            <Plus className="h-4 w-4" />
            添加产品
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel} className="gap-1.5">
              <X className="h-4 w-4" />
              取消
            </Button>
            <Button onClick={handleSave} className="gap-1.5" disabled={!hasChanges}>
              <Save className="h-4 w-4" />
              保存
            </Button>
          </div>
        </div>

        {/* Products */}
        <div className="space-y-4">
          {products.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="py-12 text-center">
                <Package className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">暂无产品数据</p>
                <Button onClick={addProduct} variant="outline" className="mt-3 gap-1">
                  <Plus className="h-3.5 w-3.5" /> 添加产品
                </Button>
              </CardContent>
            </Card>
          )}

          {products.map((product, index) => (
            <ProductCard
              key={index}
              product={product}
              index={index}
              isExpanded={expandedProduct === product.name}
              onToggle={() => setExpandedProduct(expandedProduct === product.name ? null : product.name)}
              onUpdateName={(name) => updateProductName(index, name)}
              onUpdateTotal={(total) => updateProductTotal(index, total)}
              onUpdateData={(data) => updateProduct(index, () => ({ ...product, data }))}
              onRemove={() => removeProduct(index)}
            />
          ))}
        </div>
      </main>

      {/* Cancel confirm dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认放弃修改？</DialogTitle>
            <DialogDescription>您有未保存的变更，取消后将丢失所有修改。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>继续编辑</Button>
            <Button variant="destructive" onClick={confirmCancel}>放弃修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== ProductCard Component ====================

interface ProductCardProps {
  product: EditableProduct;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateName: (name: string) => void;
  onUpdateTotal: (total: number) => void;
  onUpdateData: (data: ProductData) => void;
  onRemove: () => void;
}

function ProductCard({ product, index, isExpanded, onToggle, onUpdateName, onUpdateTotal, onUpdateData, onRemove }: ProductCardProps) {
  const flagColors: Record<string, string> = {
    '红色旗子': '#ef4444',
    '绿色旗子': '#10b981',
    '灰色旗子': '#9ca3af',
    '黄色旗子': '#f59e0b',
    '紫色旗子': '#8b5cf6',
    '蓝色旗子': '#3b82f6',
    '黑色旗子': '#1a1a1a',
  };

  const addFlagCount = (flagColor: string) => {
    const current = product.data['标旗分类'] || {};
    onUpdateData({
      ...product.data,
      '标旗分类': { ...current, [flagColor]: (current[flagColor] || 0) + 1 },
    });
  };

  const removeFlagCount = (flagColor: string) => {
    const current = { ...product.data['标旗分类'] };
    delete current[flagColor];
    onUpdateData({ ...product.data, '标旗分类': current });
  };

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Badge variant="outline" className="text-xs font-mono tabular-nums shrink-0">
              #{index + 1}
            </Badge>
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground">产品名称</Label>
              <Input
                value={product.name}
                onChange={(e) => onUpdateName(e.target.value)}
                className="h-8 text-sm font-semibold mt-0.5"
                placeholder="产品名称"
              />
            </div>
            <div className="w-32 shrink-0">
              <Label className="text-xs text-muted-foreground">售后总数</Label>
              <Input
                type="number"
                value={product.data.total || 0}
                onChange={(e) => onUpdateTotal(parseInt(e.target.value) || 0)}
                className="h-8 text-sm font-bold tabular-nums mt-0.5"
              />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={onToggle} className="h-8 w-8 p-0">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onRemove} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-5">
          <Separator />

          {/* 标旗分类 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">标旗分类</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(product.data['标旗分类'] || {}).map(([flag, count]) => (
                <div key={flag} className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: flagColors[flag] || '#94a3b8' }} />
                  <span className="text-sm font-medium">{flag}</span>
                  <Input
                    type="number"
                    value={count}
                    onChange={(e) => {
                      const updated = { ...product.data['标旗分类'], [flag]: parseInt(e.target.value) || 0 };
                      onUpdateData({ ...product.data, '标旗分类': updated });
                    }}
                    className="h-6 w-14 text-xs font-bold tabular-nums"
                  />
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeFlagCount(flag)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-1">
                {Object.keys(flagColors).filter(f => !(product.data['标旗分类'] || {})[f]).map(flag => (
                  <Button key={flag} variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addFlagCount(flag)}>
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: flagColors[flag] }} />
                    {flag.replace('旗子', '')}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* 客服备注分类 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">客服备注分类</h3>
            </div>
            <RemarkEditor
              remarks={product.data['客服备注分类'] || {}}
              onUpdate={(remarks) => onUpdateData({ ...product.data, '客服备注分类': remarks })}
            />
          </div>

          {/* 省份分类 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-semibold">省份分类</h3>
            </div>
            <ProvinceEditor
              provinces={product.data['省份分类'] || {}}
              onUpdate={(provinces) => onUpdateData({ ...product.data, '省份分类': provinces })}
            />
          </div>

          {/* 店铺分类 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Store className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold">店铺分类</h3>
            </div>
            <ShopEditor
              shops={product.data['店铺分类'] || {}}
              onUpdate={(shops) => onUpdateData({ ...product.data, '店铺分类': shops })}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ==================== RemarkEditor ====================

function RemarkEditor({ remarks, onUpdate }: { remarks: Record<string, Record<string, any>>; onUpdate: (v: Record<string, Record<string, any>>) => void }) {
  const [newFlag, setNewFlag] = useState('红色旗子');
  const [newCat, setNewCat] = useState('');
  const [newCount, setNewCount] = useState('1');

  const addRemark = () => {
    if (!newCat.trim()) return;
    const updated = { ...remarks };
    if (!updated[newFlag]) updated[newFlag] = {};
    updated[newFlag] = { ...updated[newFlag], [newCat]: parseInt(newCount) || 0 };
    onUpdate(updated);
    setNewCat('');
    setNewCount('1');
  };

  const removeRemark = (flag: string, cat: string) => {
    const updated = { ...remarks };
    if (updated[flag]) {
      const copy = { ...updated[flag] };
      delete copy[cat];
      updated[flag] = copy;
      if (Object.keys(copy).length === 0) delete updated[flag];
    }
    onUpdate(updated);
  };

  return (
    <div className="space-y-2">
      {Object.entries(remarks).map(([flag, cats]) => (
        <div key={flag} className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs font-semibold text-muted-foreground mb-1.5">{flag}</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(cats).map(([cat, val]) => (
              <div key={cat} className="flex items-center gap-1.5 bg-background rounded-md px-2 py-1 border">
                <span className="text-sm font-medium">{cat}</span>
                <span className="text-xs font-bold tabular-nums text-primary">{typeof val === 'number' ? val : val['订单数'] || 0}</span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeRemark(flag, cat)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <select value={newFlag} onChange={(e) => setNewFlag(e.target.value)} className="h-8 text-xs rounded-md border px-2">
          <option>红色旗子</option>
          <option>绿色旗子</option>
          <option>灰色旗子</option>
          <option>黄色旗子</option>
          <option>紫色旗子</option>
          <option>蓝色旗子</option>
          <option>黑色旗子</option>
        </select>
        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="分类名称" className="h-8 text-xs w-32" />
        <Input type="number" value={newCount} onChange={(e) => setNewCount(e.target.value)} className="h-8 text-xs w-16 tabular-nums" />
        <Button size="sm" className="h-8 text-xs" onClick={addRemark}>
          <Plus className="h-3 w-3 mr-1" /> 添加
        </Button>
      </div>
    </div>
  );
}

// ==================== ProvinceEditor ====================

function ProvinceEditor({ provinces, onUpdate }: { provinces: Record<string, Record<string, any>>; onUpdate: (v: Record<string, Record<string, any>>) => void }) {
  const [newFlag, setNewFlag] = useState('红色旗子');
  const [newProvince, setNewProvince] = useState('');
  const [newCount, setNewCount] = useState('1');
  const [newTown, setNewTown] = useState('0');

  const addProvince = () => {
    if (!newProvince.trim()) return;
    const updated = { ...provinces };
    if (!updated[newFlag]) updated[newFlag] = {};
    updated[newFlag] = {
      ...updated[newFlag],
      [newProvince]: { count: parseInt(newCount) || 0, town_village: parseInt(newTown) || 0 },
    };
    onUpdate(updated);
    setNewProvince('');
    setNewCount('1');
    setNewTown('0');
  };

  const removeProvince = (flag: string, prov: string) => {
    const updated = { ...provinces };
    if (updated[flag]) {
      const copy = { ...updated[flag] };
      delete copy[prov];
      updated[flag] = copy;
      if (Object.keys(copy).length === 0) delete updated[flag];
    }
    onUpdate(updated);
  };

  return (
    <div className="space-y-2">
      {Object.entries(provinces).map(([flag, provs]) => (
        <div key={flag} className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs font-semibold text-muted-foreground mb-1.5">{flag}</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(provs).map(([prov, info]) => (
              <div key={prov} className="flex items-center gap-1.5 bg-background rounded-md px-2 py-1 border">
                <span className="text-sm font-medium">{prov}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {typeof info === 'object' ? info.count || 0 : info}单
                  {(typeof info === 'object' ? info.town_village || 0 : 0) > 0 && (
                    <span className="text-emerald-600"> · {(typeof info === 'object' ? info.town_village || 0 : 0)}乡镇</span>
                  )}
                </span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeProvince(flag, prov)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={newFlag} onChange={(e) => setNewFlag(e.target.value)} className="h-8 text-xs rounded-md border px-2">
          <option>红色旗子</option>
          <option>绿色旗子</option>
          <option>灰色旗子</option>
          <option>黄色旗子</option>
          <option>紫色旗子</option>
          <option>蓝色旗子</option>
          <option>黑色旗子</option>
        </select>
        <Input value={newProvince} onChange={(e) => setNewProvince(e.target.value)} placeholder="省份" className="h-8 text-xs w-24" />
        <Input type="number" value={newCount} onChange={(e) => setNewCount(e.target.value)} placeholder="单数" className="h-8 text-xs w-16 tabular-nums" />
        <Input type="number" value={newTown} onChange={(e) => setNewTown(e.target.value)} placeholder="乡镇" className="h-8 text-xs w-16 tabular-nums" />
        <Button size="sm" className="h-8 text-xs" onClick={addProvince}>
          <Plus className="h-3 w-3 mr-1" /> 添加
        </Button>
      </div>
    </div>
  );
}

// ==================== ShopEditor ====================

function ShopEditor({ shops, onUpdate }: { shops: Record<string, Record<string, any>>; onUpdate: (v: Record<string, Record<string, any>>) => void }) {
  const [newFlag, setNewFlag] = useState('红色旗子');
  const [newShop, setNewShop] = useState('');
  const [newCount, setNewCount] = useState('1');

  const addShop = () => {
    if (!newShop.trim()) return;
    const updated = { ...shops };
    if (!updated[newFlag]) updated[newFlag] = {};
    updated[newFlag] = {
      ...updated[newFlag],
      [newShop]: { count: parseInt(newCount) || 0, 数量分布: {}, 客服备注分类: {} },
    };
    onUpdate(updated);
    setNewShop('');
    setNewCount('1');
  };

  const removeShop = (flag: string, shop: string) => {
    const updated = { ...shops };
    if (updated[flag]) {
      const copy = { ...updated[flag] };
      delete copy[shop];
      updated[flag] = copy;
      if (Object.keys(copy).length === 0) delete updated[flag];
    }
    onUpdate(updated);
  };

  return (
    <div className="space-y-2">
      {Object.entries(shops).map(([flag, shopList]) => (
        <div key={flag} className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs font-semibold text-muted-foreground mb-1.5">{flag}</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(shopList).map(([shop, info]) => (
              <div key={shop} className="flex items-center gap-1.5 bg-background rounded-md px-2 py-1 border">
                <span className="text-sm font-medium">{shop}</span>
                <span className="text-xs font-bold tabular-nums text-primary">
                  {typeof info === 'object' ? info.count || 0 : info}单
                </span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeShop(flag, shop)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <select value={newFlag} onChange={(e) => setNewFlag(e.target.value)} className="h-8 text-xs rounded-md border px-2">
          <option>红色旗子</option>
          <option>绿色旗子</option>
          <option>灰色旗子</option>
          <option>黄色旗子</option>
          <option>紫色旗子</option>
          <option>蓝色旗子</option>
          <option>黑色旗子</option>
        </select>
        <Input value={newShop} onChange={(e) => setNewShop(e.target.value)} placeholder="店铺名称" className="h-8 text-xs w-32" />
        <Input type="number" value={newCount} onChange={(e) => setNewCount(e.target.value)} className="h-8 text-xs w-16 tabular-nums" />
        <Button size="sm" className="h-8 text-xs" onClick={addShop}>
          <Plus className="h-3 w-3 mr-1" /> 添加
        </Button>
      </div>
    </div>
  );
}
