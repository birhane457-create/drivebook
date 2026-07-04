import { useState, useMemo, useEffect, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorState from '@/components/shared/ErrorState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown,
  Download, Rows3, Inbox,
} from 'lucide-react';
import ColumnChooser from './ColumnChooser';
import SavedViewsBar from './SavedViewsBar';
import FilterPanel from './FilterPanel';
import BulkActionBar from './BulkActionBar';

const DENSITY = {
  compact: { cell: 'py-1.5 px-2 text-xs', head: 'py-1.5 px-2 text-xs' },
  comfortable: { cell: 'py-2.5 px-3 text-sm', head: 'py-2.5 px-3 text-xs' },
  spacious: { cell: 'py-4 px-4 text-sm', head: 'py-3.5 px-4 text-xs' },
};

const PAGE_SIZES = [10, 15, 25, 50, 100];

export default function AdvancedDataTable({
  tableId = 'default',
  columns,
  data,
  isLoading,
  error,
  onRetry,
  onRowClick,
  emptyMessage = 'No data found',
  getRowId = (r) => r.id ?? r._id,
  bulkActions = [],
  enableSelection = false,
  defaultDensity = 'comfortable',
  toolbarActions,
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [density, setDensity] = useState(defaultDensity);
  const [hidden, setHidden] = useState([]);
  const [widths, setWidths] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [views, setViews] = useState([]);
  const [activeViewName, setActiveViewName] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`wms-view-${tableId}`);
      if (raw) setViews(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [tableId]);

  const persistViews = (next) => {
    setViews(next);
    try { localStorage.setItem(`wms-view-${tableId}`, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const visibleColumns = useMemo(
    () => columns.filter(c => !hidden.includes(c.key)),
    [columns, hidden]
  );

  const searchableKeys = useMemo(
    () => columns.filter(c => c.searchable !== false && c.type !== 'actions').map(c => c.key),
    [columns]
  );

  const filtered = useMemo(() => {
    let rows = data || [];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => searchableKeys.some(k => {
        const v = r[k];
        return v != null && String(v).toLowerCase().includes(q);
      }));
    }
    rows = rows.filter(r => Object.entries(filters).every(([key, val]) => {
      if (val === '' || val == null) return true;
      const col = columns.find(c => c.key === key);
      const cell = r[key];
      if (col?.filterType === 'select') return String(cell) === String(val);
      if (typeof cell === 'number') return String(cell).includes(String(val));
      return cell != null && String(cell).toLowerCase().includes(String(val).toLowerCase());
    }));
    if (sort) {
      const { key, dir } = sort;
      rows = [...rows].sort((a, b) => {
        const av = a[key], bv = b[key];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av;
        return dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return rows;
  }, [data, search, filters, sort, columns, searchableKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  useEffect(() => { setPage(0); }, [search, filters, sort, pageSize]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(getRowId(r)));

  const toggleRow = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev);
    if (allFilteredSelected) {
      filtered.forEach(r => next.delete(getRowId(r)));
    } else {
      filtered.forEach(r => next.add(getRowId(r)));
    }
    return next;
  });

  const startResize = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widths[key] || e.currentTarget.parentElement.getBoundingClientRect().width;
    const onMove = (ev) => {
      const w = Math.max(80, Math.min(600, startW + (ev.clientX - startX)));
      setWidths(prev => ({ ...prev, [key]: w }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const exportCsv = () => {
    const cols = visibleColumns.filter(c => c.type !== 'actions');
    const header = cols.map(c => `"${c.label}"`).join(',');
    const rows = filtered.map(r => cols.map(c => {
      const v = c.exportValue ? c.exportValue(r) : (c.render ? c.render(r) : r[c.key]);
      const s = v == null ? '' : String(v).replace(/"/g, '""');
      return `"${s}"`;
    }).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableId}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const captureConfig = () => ({ hidden, filters, sort, density, pageSize, search });
  const applyView = (view) => {
    const c = view.config || {};
    setHidden(c.hidden || []);
    setFilters(c.filters || {});
    setSort(c.sort || null);
    setDensity(c.density || 'comfortable');
    setPageSize(c.pageSize || 15);
    setSearch(c.search || '');
    setActiveViewName(view.name);
  };
  const saveView = (name) => {
    const view = { name, config: captureConfig() };
    persistViews(views.some(v => v.name === name)
      ? views.map(v => (v.name === name ? view : v))
      : [...views, view]);
    setActiveViewName(name);
  };
  const deleteView = (name) => {
    persistViews(views.filter(v => v.name !== name));
    if (activeViewName === name) setActiveViewName(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      </div>
    );
  }

  if (error && (!data || data.length === 0)) {
    return (
      <ErrorState
        title="Couldn't load this data"
        message={error?.message || 'An unexpected error occurred while fetching.'}
        onRetry={onRetry}
      />
    );
  }

  const dc = DENSITY[density];
  const colCount = visibleColumns.length + (enableSelection ? 1 : 0);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SavedViewsBar
          views={views}
          activeName={activeViewName}
          onApply={applyView}
          onSave={saveView}
          onDelete={deleteView}
        />
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <FilterPanel
          columns={columns}
          filters={filters}
          onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))}
          onClear={() => setFilters({})}
        />
        <ColumnChooser
          columns={columns}
          hiddenKeys={hidden}
          onToggle={(key) => setHidden(h => h.includes(key) ? h.filter(k => k !== key) : [...h, key])}
          onReset={() => setHidden([])}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm"><Rows3 className="w-4 h-4 mr-2" />Density</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-40 p-1">
            {Object.keys(DENSITY).map(d => (
              <button
                key={d}
                onClick={() => setDensity(d)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-sm capitalize hover:bg-muted/60",
                  density === d && "bg-muted font-medium"
                )}
              >
                {d}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-2" />Export
        </Button>
        {toolbarActions}
      </div>

      {enableSelection && (
        <BulkActionBar count={selected.size} actions={bulkActions} onClear={() => setSelected(new Set())} />
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-auto max-h-[70vh]">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/95 backdrop-blur sticky top-0 z-10 hover:bg-muted/95">
              {enableSelection && (
                <TableHead className="w-10 sticky left-0 z-20 bg-muted/95 backdrop-blur">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
              )}
              {visibleColumns.map((col) => {
                const isSorted = sort?.key === col.key;
                return (
                  <TableHead
                    key={col.key}
                    className={cn("relative select-none", dc.head, col.headClassName, col.align === 'right' && 'text-right')}
                    style={{ width: widths[col.key] || col.width, minWidth: 80 }}
                  >
                    <button
                      className={cn(
                        "flex items-center gap-1",
                        col.align === 'right' && 'ml-auto',
                        col.sortable !== false && 'cursor-pointer hover:text-foreground'
                      )}
                      disabled={col.sortable === false}
                      onClick={() => {
                        if (col.sortable === false) return;
                        setSort(prev => prev?.key === col.key
                          ? (prev.dir === 'asc' ? { key: col.key, dir: 'desc' } : null)
                          : { key: col.key, dir: 'asc' });
                      }}
                    >
                      {col.label}
                      {col.sortable !== false && (
                        isSorted
                          ? (sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                          : <ChevronsUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                    {col.resizable !== false && (
                      <span
                        onMouseDown={(e) => startResize(e, col.key)}
                        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 z-20"
                      />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox className="w-8 h-8 opacity-40" />
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row, idx) => {
                const id = getRowId(row) ?? `row-${idx}`;
                const isSelected = selected.has(id);
                return (
                  <TableRow
                    key={id}
                    data-state={isSelected && 'selected'}
                    className={cn(onRowClick && 'cursor-pointer', isSelected && 'bg-primary/5')}
                    onClick={() => onRowClick?.(row)}
                  >
                    {enableSelection && (
                      <TableCell className={cn("sticky left-0 z-10 bg-card", dc.cell)} onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(id)} aria-label="Select row" />
                      </TableCell>
                    )}
                    {visibleColumns.map((col) => {
                      if (col.type === 'actions') {
                        return (
                          <TableCell
                            key={col.key}
                            className={cn("text-right", dc.cell, col.cellClassName)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className={cn("flex items-center gap-1", col.align === 'right' ? 'justify-end' : '')}>
                              {(col.actions || [])
                                .filter(a => (a.show ? a.show(row) : true))
                                .map((a, i) => (
                                  <Button
                                    key={i}
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={a.disabled?.(row)}
                                    onClick={() => a.onClick(row)}
                                    title={a.label}
                                  >
                                    {a.icon ? <a.icon className="w-3.5 h-3.5" /> : a.label}
                                  </Button>
                                ))}
                            </div>
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell
                          key={col.key}
                          className={cn(dc.cell, col.cellClassName, col.align === 'right' && 'text-right')}
                        >
                          {col.render ? col.render(row) : (row[col.key] ?? '')}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length === 0 ? 0 : safePage * pageSize + 1}-{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" disabled={safePage === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {safePage + 1} of {totalPages}</span>
          <Button variant="outline" size="icon" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}