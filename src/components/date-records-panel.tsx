'use client';

import { useState, useEffect, useMemo } from 'react';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Pencil, Trash2, FileJson, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import type { DateRecord } from '@/lib/types';
import { saveAllRecords } from '@/lib/storage';

interface DateRecordsPanelProps {
  records: Record<string, DateRecord>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onDeleteDate: (date: string) => void;
  onUpdateRecords: (records: Record<string, DateRecord>) => void;
}

type ViewLevel = 'year' | 'month' | 'week' | 'day';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const LIST_PAGE_SIZE = 30;

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() + (1 - dayOfWeek) + (week - 1) * 7);
  return monday;
}

function toDateString(d: Date): string {
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekdays[d.getDay()]}`;
}

export default function DateRecordsPanel({
  records,
  selectedDate,
  onSelectDate,
  onDeleteDate,
  onUpdateRecords,
}: DateRecordsPanelProps) {
  const allDates = useMemo(() => Object.keys(records).sort(), [records]);

  const [viewLevel, setViewLevel] = useState<ViewLevel>('day');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [editDate, setEditDate] = useState<string | null>(null);
  const [editJson, setEditJson] = useState('');
  const [showAllListItems, setShowAllListItems] = useState(false);

  // Auto init year
  useEffect(() => {
    if (allDates.length > 0 && !selectedYear) {
      const y = allDates[0].slice(0, 4);
      setSelectedYear(y);
      setCalYear(parseInt(y, 10));
    }
  }, [allDates, selectedYear]);

  // Available years/months/weeks/days from uploaded data
  const availableYears = useMemo(() => {
    const years = new Set(allDates.map((d) => d.slice(0, 4)));
    return Array.from(years).sort();
  }, [allDates]);

  const effectiveYear = selectedYear || (availableYears.length > 0 ? availableYears[0] : '');

  const availableMonths = useMemo(() => {
    if (!effectiveYear) return [];
    const months = new Set(
      allDates.filter((d) => d.slice(0, 4) === effectiveYear).map((d) => d.slice(5, 7))
    );
    return Array.from(months).sort();
  }, [allDates, effectiveYear]);

  const availableWeeks = useMemo(() => {
    if (!effectiveYear) return [];
    const weeks = new Set<number>();
    allDates
      .filter((d) => d.slice(0, 4) === effectiveYear)
      .forEach((d) => {
        const dt = new Date(d + 'T00:00:00');
        weeks.add(getISOWeek(dt));
      });
    return Array.from(weeks).sort((a, b) => a - b);
  }, [allDates, effectiveYear]);

  const availableDays = useMemo(() => {
    if (!effectiveYear) return [];
    let dates = allDates.filter((d) => d.slice(0, 4) === effectiveYear);
    if (viewLevel === 'month' && selectedMonth) {
      dates = dates.filter((d) => d.slice(5, 7) === selectedMonth);
    }
    if (viewLevel === 'week' && selectedWeek) {
      const monday = getWeekMonday(parseInt(effectiveYear, 10), parseInt(selectedWeek, 10));
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      const mStr = monday.toISOString().slice(0, 10);
      const sStr = sunday.toISOString().slice(0, 10);
      dates = dates.filter((d) => d >= mStr && d <= sStr);
    }
    return dates.sort();
  }, [allDates, effectiveYear, viewLevel, selectedMonth, selectedWeek]);

  const dataDates = useMemo(() => new Set(allDates), [allDates]);

  const calendarHighlightDates = useMemo(() => {
    if (viewLevel === 'week' && selectedWeek) {
      const monday = getWeekMonday(parseInt(effectiveYear, 10), parseInt(selectedWeek, 10));
      const set = new Set<string>();
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setUTCDate(monday.getUTCDate() + i);
        set.add(d.toISOString().slice(0, 10));
      }
      return set;
    }
    if (viewLevel === 'month' && selectedMonth) {
      const prefix = `${effectiveYear}-${selectedMonth}`;
      return new Set(allDates.filter((d) => d.startsWith(prefix)));
    }
    return new Set<string>();
  }, [viewLevel, selectedWeek, selectedMonth, effectiveYear, allDates]);

  // Calendar
  const monthLabel = `${calYear}年${calMonth + 1}月`;
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [calYear, calMonth]);

  function handlePrevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  }
  function handleNextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  }

  function handleYearChange(y: string) {
    setSelectedYear(y);
    setSelectedMonth('');
    setSelectedWeek('');
    setSelectedDay('');
    setCalYear(parseInt(y, 10));
    setCalMonth(0);
  }
  function handleMonthChange(m: string) {
    setSelectedMonth(m);
    setSelectedDay('');
    setCalMonth(parseInt(m, 10) - 1);
  }
  function handleWeekChange(w: string) {
    setSelectedWeek(w);
    setSelectedDay('');
    const monday = getWeekMonday(parseInt(effectiveYear, 10), parseInt(w, 10));
    setCalYear(monday.getUTCFullYear());
    setCalMonth(monday.getUTCMonth());
  }
  function handleDayChange(d: string) {
    setSelectedDay(d);
    onSelectDate(d);
  }

  function handleViewLevelChange(level: ViewLevel) {
    setViewLevel(level);
    setSelectedMonth('');
    setSelectedWeek('');
    setSelectedDay('');
  }

  function handleEdit(date: string) {
    setEditDate(date);
    setEditJson(JSON.stringify(records[date], null, 2));
  }
  function handleSaveEdit() {
    if (!editDate) return;
    try {
      const parsed = JSON.parse(editJson) as DateRecord;
      const newRecords = { ...records, [editDate]: parsed };
      saveAllRecords(newRecords);
      onUpdateRecords(newRecords);
      setEditDate(null);
    } catch {
      // JSON parse error - keep dialog open
    }
  }

  function getDateInfo(date: string) {
    const record = records[date];
    if (!record) return null;
    const productCount = Object.keys(record.data).length;
    let totalOrders = 0;
    for (const productData of Object.values(record.data)) {
      const t = (productData as any)?.total;
      if (typeof t === 'number') totalOrders += t;
    }
    return { productCount, totalOrders };
  }

  const getDateTotal = (date: string) => {
    const info = getDateInfo(date);
    return info ? info.totalOrders : 0;
  };

  const selectedDateInfo = selectedDate ? getDateInfo(selectedDate) : null;

  // Group available days by month for compact display
  const dateListGroupedByMonth = useMemo(() => {
    const reversed = availableDays.slice().reverse();
    const groups: { monthKey: string; monthLabel: string; dates: string[] }[] = [];
    for (const date of reversed) {
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
  }, [availableDays]);

  // Flat list for display with pagination
  const flatDateList = useMemo(() => {
    return availableDays.slice().reverse();
  }, [availableDays]);

  const visibleDateList = showAllListItems ? flatDateList : flatDateList.slice(0, LIST_PAGE_SIZE);
  const hasMoreListItems = flatDateList.length > LIST_PAGE_SIZE;

  return (
    <>
      <CardContent className="p-3 flex flex-col gap-3">
        {/* Header: compact title + selected date info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">数据记录</span>
          </div>
          {selectedDateInfo && (
            <div className="text-[10px] text-muted-foreground">
              <span className="font-bold text-foreground tabular-nums">{selectedDateInfo.productCount}</span>品
              <span className="mx-1">·</span>
              <span className="font-bold text-foreground tabular-nums">{selectedDateInfo.totalOrders}</span>单
            </div>
          )}
        </div>

        {/* Row 1: View level buttons */}
        <div className="flex rounded-md border border-border overflow-hidden">
          {(['year', 'month', 'week', 'day'] as ViewLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => handleViewLevelChange(level)}
              className={`flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors ${
                viewLevel === level
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {level === 'year' ? '年' : level === 'month' ? '月' : level === 'week' ? '周' : '日'}
            </button>
          ))}
        </div>

        {/* Row 2: Dropdown selector based on view level */}
        {viewLevel === 'year' && (
          <Select value={selectedYear} onValueChange={handleYearChange}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="选择年份" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y} className="text-xs">{y}年</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {viewLevel === 'month' && (
          <div className="flex gap-1.5">
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue placeholder="年份" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y} className="text-xs">{y}年</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue placeholder="月份" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">{parseInt(m, 10)}月</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {viewLevel === 'week' && (
          <div className="flex gap-1.5">
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue placeholder="年份" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y} className="text-xs">{y}年</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedWeek} onValueChange={handleWeekChange}>
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue placeholder="选择周" />
              </SelectTrigger>
              <SelectContent>
                {availableWeeks.map((w) => {
                  const monday = getWeekMonday(parseInt(effectiveYear, 10), w);
                  const sunday = new Date(monday);
                  sunday.setUTCDate(monday.getUTCDate() + 6);
                  return (
                    <SelectItem key={w} value={String(w)} className="text-xs">
                      第{w}周 ({toDateString(monday)}~{toDateString(sunday)})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
        {viewLevel === 'day' && (
          <Select value={selectedDay} onValueChange={handleDayChange}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="选择日期" />
            </SelectTrigger>
            <SelectContent>
              {availableDays.map((d) => (
                <SelectItem key={d} value={d} className="text-xs">
                  {formatDate(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Year view: 12 month cards */}
        {viewLevel === 'year' && effectiveYear && (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1).padStart(2, '0');
              const monthKey = `${effectiveYear}-${m}`;
              const monthDates = allDates.filter((d) => d.slice(0, 7) === monthKey);
              const hasData = monthDates.length > 0;
              let total = 0;
              monthDates.forEach((d) => { total += getDateTotal(d); });
              return (
                <button
                  key={m}
                  onClick={() => { setViewLevel('month'); setSelectedMonth(m); setCalMonth(i); }}
                  disabled={!hasData}
                  className={`p-1.5 rounded-md text-center transition-all ${
                    hasData
                      ? 'bg-primary/10 hover:bg-primary/20 cursor-pointer border border-primary/15'
                      : 'bg-muted/20 text-muted-foreground/30 cursor-default'
                  }`}
                >
                  <div className="text-[11px] font-bold">{i + 1}月</div>
                  {hasData && (
                    <div className="text-[9px] text-muted-foreground tabular-nums">
                      <span className="font-bold text-foreground">{total}</span>单
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Calendar (month/week/day view) */}
        {viewLevel !== 'year' && (
          <div>
            {/* Month nav */}
            <div className="flex items-center justify-between mb-1.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePrevMonth}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-bold">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNextMonth}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-0 mb-0.5">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="text-center text-[9px] font-semibold text-muted-foreground py-0.5">
                  {wd}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="h-7" />;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasData = dataDates.has(dateStr);
                const inRange = calendarHighlightDates.has(dateStr);
                const isSelected = dateStr === selectedDate;

                return (
                  <button
                    key={dateStr}
                    onClick={() => hasData && onSelectDate(dateStr)}
                    disabled={!hasData}
                    className={`h-7 w-full flex items-center justify-center text-[11px] relative rounded transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-bold'
                        : hasData && inRange
                          ? 'bg-primary/12 font-semibold hover:bg-primary/20 cursor-pointer'
                          : hasData
                            ? 'bg-primary/5 text-foreground/50 hover:bg-primary/12 cursor-pointer'
                            : 'text-muted-foreground/25 cursor-default'
                    }`}
                  >
                    {day}
                    {hasData && !isSelected && (
                      <span className="absolute bottom-0 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {viewLevel === 'week' && selectedWeek && (
              <div className="mt-1 text-[9px] text-muted-foreground text-center">
                高亮为第{selectedWeek}周
              </div>
            )}
          </div>
        )}

        {/* Date list with records - grouped by month */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2">
            {dateListGroupedByMonth.map((group) => {
              const groupDates = showAllListItems
                ? group.dates
                : group.dates.slice(0, LIST_PAGE_SIZE);
              return (
                <div key={group.monthKey}>
                  <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                    {group.monthLabel}
                  </div>
                  <div className="space-y-0.5">
                    {(showAllListItems ? group.dates : group.dates).map((date) => {
                      const record = records[date];
                      if (!record) return null;
                      const productCount = Object.keys(record.data).length;
                      let totalOrders = 0;
                      for (const productData of Object.values(record.data)) {
                        const t = (productData as any)?.total;
                        if (typeof t === 'number') totalOrders += t;
                      }
                      const isSelected = date === selectedDate;

                      return (
                        <div
                          key={date}
                          onClick={() => onSelectDate(date)}
                          className={`group px-2 py-1 rounded-md border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/8 ring-1 ring-primary/20'
                              : 'border-transparent hover:bg-muted/50 hover:border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[11px] font-medium truncate">{formatDate(date)}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                <span className="font-bold text-foreground tabular-nums">{productCount}</span>品
                                <span className="mx-0.5">·</span>
                                <span className="font-bold text-foreground tabular-nums">{totalOrders}</span>单
                              </span>
                            </div>
                            <div className="flex gap-0 opacity-0 group-hover:opacity-100 shrink-0">
                              <Button
                                variant="ghost" size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-primary"
                                onClick={(e) => { e.stopPropagation(); handleEdit(date); }}
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); onDeleteDate(date); }}
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {availableDays.length === 0 && (
              <div className="text-center py-3 text-muted-foreground text-[11px]">
                无数据
              </div>
            )}
            {flatDateList.length > LIST_PAGE_SIZE && (
              <button
                type="button"
                onClick={() => setShowAllListItems(!showAllListItems)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAllListItems ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    收起
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    显示全部 {flatDateList.length} 条
                  </>
                )}
              </button>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* JSON edit dialog */}
      <Dialog open={editDate !== null} onOpenChange={(open) => { if (!open) setEditDate(null); }}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" />
              编辑数据 - {editDate}
            </DialogTitle>
            <DialogDescription>
              修改此日期的 JSON 售后数据，保存后自动更新分析
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Textarea
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
              className="font-mono text-xs min-h-[300px] max-h-[50vh] resize-y"
            />
          </div>
          <DialogFooter className="shrink-0 border-t pt-3">
            <Button variant="outline" onClick={() => setEditDate(null)}>取消</Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}