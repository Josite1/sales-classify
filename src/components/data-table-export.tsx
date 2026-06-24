'use client';

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Download, Table2 } from 'lucide-react';

export interface DataRow {
  [key: string]: string | number | null | undefined;
}

interface Column {
  key: string;
  label: string;
  width?: string;
  render?: (value: any, row: DataRow) => React.ReactNode;
}

interface DataTableExportProps {
  columns: Column[];
  data: DataRow[];
  title: string;
  sheetOptions: { value: string; label: string }[];
  defaultSheetBy: string;
}

const PAGE_SIZE = 20;

function exportToExcel(data: DataRow[], columns: Column[], title: string, sheetBy: string) {
  if (data.length === 0) return;

  const headers = columns.map(c => c.label);
  const keys = columns.map(c => c.key);

  if (sheetBy === 'none') {
    const rows = data.map(row => keys.map(k => row[k] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = columns.map(c => ({ wch: c.width ? Math.max(parseInt(c.width) / 8, 10) : 15 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
    XLSX.writeFile(wb, `${title}.xlsx`);
    return;
  }

  const groups = new Map<string, DataRow[]>();
  for (const row of data) {
    const key = String(row[sheetBy] ?? '未知');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const wb = XLSX.utils.book_new();
  for (const [group, rows] of groups) {
    const sheetRows = rows.map(row => keys.map(k => row[k] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetRows]);
    ws['!cols'] = columns.map(c => ({ wch: c.width ? Math.max(parseInt(c.width) / 8, 10) : 15 }));
    const name = group.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, `${title}.xlsx`);
}

export function DataTableExport({ columns, data, title, sheetOptions, defaultSheetBy }: DataTableExportProps) {
  const [page, setPage] = useState(0);
  const [sheetBy, setSheetBy] = useState(defaultSheetBy);
  const [expanded, setExpanded] = useState(false);

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const pagedData = useMemo(() => data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [data, page]);

  if (data.length === 0 && !expanded) {
    return (
      <div className="text-center py-4">
        <button onClick={() => setExpanded(true)} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mx-auto">
          <Table2 className="h-3 w-3" /> 展开数据表格
        </button>
      </div>
    );
  }

  return (
    <Card className="brutal-card-lift border-primary/10 animate-fade-in-up">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Table2 className="h-4 w-4 text-primary" />{title}
            <Badge variant="secondary" className="text-xs tabular-nums">{data.length} 条</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={sheetBy} onValueChange={setSheetBy}>
              <SelectTrigger className="h-7 text-xs w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sheetOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => exportToExcel(data, columns, title, sheetBy)}>
              <Download className="h-3.5 w-3.5" />导出
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(col => (
                  <TableHead key={col.key} className="text-xs whitespace-nowrap" style={col.width ? { width: col.width } : undefined}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedData.map((row, i) => (
                <TableRow key={i} className="text-xs">
                  {columns.map(col => (
                    <TableCell key={col.key} className="whitespace-nowrap">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-border/50">
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">{page + 1} / {totalPages}</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
