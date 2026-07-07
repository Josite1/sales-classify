'use client';

import { useState, useCallback } from 'react';
import { safeFetch } from '@/lib/fetch-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Upload, FileSpreadsheet, Loader2, ExternalLink } from 'lucide-react';
import { addDateRecord } from '@/lib/records-service';;
import type { AllRecords, ProductData } from '@/lib/types';
import Link from 'next/link';

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (records: AllRecords) => void;
}

export function ExcelImportDialog({ open, onOpenChange, onImported }: ExcelImportDialogProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImport = useCallback(async () => {
    setError('');
    if (!salesFile) {
      setError('请选择销售Excel');
      return;
    }
    if (!date) {
      setError('请选择日期');
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('sales_file', salesFile);
      const res = await safeFetch('/api/excel/import-with-rules', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        setError(err.detail || 'Excel处理失败，请检查文件格式');
        return;
      }
      const data = await res.json();
      if (!data.success || !data.data) {
        setError('处理结果不正确');
        return;
      }
      const records = addDateRecord(date, data.data as Record<string, ProductData>);
      setSalesFile(null);
      onImported(records);
      onOpenChange(false);
    } catch (err) {
      setError('Excel处理异常: ' + (err as Error).message);
    } finally {
      setImporting(false);
    }
  }, [date, salesFile, onImported, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <FileSpreadsheet className='h-5 w-5 text-green-600' />
            导入Excel数据
          </DialogTitle>
          <DialogDescription>
            上传销售Excel自动分类，关键词规则在
            <Link href='/admin/keywords' className='text-primary underline mx-1' target='_blank'>
              后台管理
              <ExternalLink className='h-3 w-3 inline ml-0.5' />
            </Link>
            中配置
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-5 py-2'>
          <div className='grid gap-2'>
            <Label htmlFor='excel-date' className='text-sm font-semibold'>数据日期</Label>
            <Input id='excel-date' type='date' value={date}
              onChange={(e) => setDate(e.target.value)} className='font-mono' />
          </div>

          <div className='grid gap-2'>
            <Label className='text-sm font-semibold'>销售数据 Excel</Label>
            <div className='border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-green-400/50 transition-colors'>
              <input type='file' accept='.xlsx,.xls'
                onChange={(e) => setSalesFile(e.target.files?.[0] || null)}
                className='hidden' id='excel-sales' />
              <label htmlFor='excel-sales' className='cursor-pointer'>
                <Upload className='h-6 w-6 mx-auto mb-2 text-muted-foreground' />
                <p className='text-sm text-muted-foreground'>
                  {salesFile ? salesFile.name : '点击选择销售记录Excel'}
                </p>
              </label>
            </div>
          </div>

          {error && (
            <div className='flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg'>
              <AlertCircle className='h-4 w-4 mt-0.5 shrink-0' />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className='pt-2 border-t border-border'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleImport} disabled={!salesFile || !date || importing}>
            {importing ? (<><Loader2 className='h-4 w-4 mr-1 animate-spin' />处理中...</>) : '导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
