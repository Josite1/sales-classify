'use client';

import { useState, useCallback } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Upload, FileJson } from 'lucide-react';
import { parseDirtyJson, validateImportData } from '@/lib/compute-service';
import type { AllRecords, ProductData } from '@/lib/types';

interface DataImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (records: AllRecords, newRecordsOnly?: AllRecords) => void;
}

export function DataImportDialog({ open, onOpenChange, onImported }: DataImportDialogProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [importMode, setImportMode] = useState<'paste' | 'file'>('paste');
  const [importing, setImporting] = useState(false);

  const handleImport = useCallback(async () => {
    setError('');
    setImporting(true);
    try {
      if (!jsonText.trim()) {
        setError('请输入 JSON 数据');
        setImporting(false);
        return;
      }
      if (!date) {
        setError('请选择日期');
        setImporting(false);
        return;
      }

      // Delegate parsing to backend
      const parseResult = await parseDirtyJson(jsonText);
      if (!parseResult.success) {
        setError('JSON 解析失败，请检查格式是否正确');
        setImporting(false);
        return;
      }

      // Delegate validation to backend
      const isValid = await validateImportData(parseResult.result);
      if (!isValid) {
        setError('数据结构不匹配：未找到包含 total 字段的有效商品数据');
        setImporting(false);
        return;
      }

      const newRecord = { date, data: parseResult.result as Record<string, ProductData>, importedAt: Date.now() };
      const newRecordsOnly: AllRecords = { [date]: newRecord };
      setJsonText('');
      onImported(newRecordsOnly, newRecordsOnly);
      onOpenChange(false);
    } catch (err) {
      setError('导入失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setImporting(false);
    }
  }, [jsonText, date, onImported, onOpenChange]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setJsonText(text);
      setImportMode('paste');
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            导入日期数据
          </DialogTitle>
          <DialogDescription>
            选择日期并导入对应日期的 JSON 售后数据，系统将自动记录并纳入周趋势分析
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2 overflow-y-auto min-h-0 flex-1">
          {/* 日期选择 */}
          <div className="grid gap-2 shrink-0">
            <Label htmlFor="import-date" className="text-sm font-semibold">
              数据所属日期
            </Label>
            <Input
              id="import-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="font-mono"
            />
          </div>

          {/* 导入方式切换 */}
          <div className="grid gap-2 min-h-0 flex-1 flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <Label className="text-sm font-semibold">JSON 数据</Label>
              <div className="flex gap-2">
                <Button
                  variant={importMode === 'paste' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setImportMode('paste')}
                >
                  粘贴输入
                </Button>
                <Button
                  variant={importMode === 'file' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setImportMode('file')}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  上传文件
                </Button>
              </div>
            </div>

            {importMode === 'file' ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors shrink-0">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">点击选择 .json 文件</p>
                </label>
              </div>
            ) : (
              <Textarea
                placeholder='将 JSON 格式的数据粘贴至此处...'
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="font-mono text-xs min-h-[120px] max-h-[40vh] leading-relaxed resize-y overflow-auto"
              />
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg shrink-0">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleImport} disabled={!jsonText.trim() || !date || importing}>
            {importing ? '导入中...' : '确认导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
