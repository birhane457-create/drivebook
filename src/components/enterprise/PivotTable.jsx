import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowDown } from 'lucide-react';

function aggregate(rows, valueField, agg) {
  const vals = rows.map((r) => Number(r[valueField]) || 0);
  if (agg === 'count') return vals.length;
  if (agg === 'avg') return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  return vals.reduce((a, b) => a + b, 0);
}

export default function PivotTable({ data = [], fields = [], rowField, colField, valueField, agg = 'sum', className }) {
  const [rowDim, setRowDim] = useState(rowField || fields[0]?.value);
  const [colDim, setColDim] = useState(colField || fields[1]?.value);
  const [val, setVal] = useState(valueField || fields[0]?.value);
  const [func, setFunc] = useState(agg);

  const { rowKeys, colKeys, cells, grandTotal } = useMemo(() => {
    const rowSet = new Set(), colSet = new Set();
    data.forEach((r) => { rowSet.add(r[rowDim]); colSet.add(r[colDim]); });
    const rowKeys = [...rowSet];
    const colKeys = [...colSet];
    const cells = {};
    let grandTotal = 0;
    rowKeys.forEach((rk) => {
      colKeys.forEach((ck) => {
        const rows = data.filter((r) => r[rowDim] === rk && r[colDim] === ck);
        const v = aggregate(rows, val, func);
        cells[`${rk}|${ck}`] = v;
        grandTotal += v;
      });
    });
    return { rowKeys, colKeys, cells, grandTotal };
  }, [data, rowDim, colDim, val, func]);

  const fmt = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n);

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span>Rows</span><Select value={rowDim} onValueChange={setRowDim}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent>{fields.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span>Columns</span><Select value={colDim} onValueChange={setColDim}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent>{fields.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span>Value</span><Select value={val} onValueChange={setVal}><SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger><SelectContent>{fields.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span>Aggregation</span><Select value={func} onValueChange={setFunc}><SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger><SelectContent>{['sum', 'avg', 'count'].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-3 py-2 font-semibold border-b border-r border-border">{rowDim}</th>
              {colKeys.map((ck) => <th key={ck} className="text-right px-3 py-2 font-semibold border-b border-r border-border">{ck}</th>)}
              <th className="text-right px-3 py-2 font-semibold border-b border-border">Total</th>
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((rk) => {
              const rowTotal = colKeys.reduce((s, ck) => s + cells[`${rk}|${ck}`], 0);
              return (
                <tr key={rk} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium border-b border-r border-border">{rk}</td>
                  {colKeys.map((ck) => <td key={ck} className="text-right px-3 py-2 tabular-nums border-b border-r border-border">{fmt(cells[`${rk}|${ck}`])}</td>)}
                  <td className="text-right px-3 py-2 font-semibold tabular-nums border-b border-border">{fmt(rowTotal)}</td>
                </tr>
              );
            })}
            <tr className="bg-muted/40 font-semibold">
              <td className="px-3 py-2 border-r border-border">Total</td>
              {colKeys.map((ck) => {
                const colTotal = rowKeys.reduce((s, rk) => s + cells[`${rk}|${ck}`], 0);
                return <td key={ck} className="text-right px-3 py-2 tabular-nums border-r border-border">{fmt(colTotal)}</td>;
              })}
              <td className="text-right px-3 py-2 tabular-nums">{fmt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}