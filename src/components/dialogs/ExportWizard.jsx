import { useState, useEffect } from 'react';
import WizardDialog from './WizardDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import Field from '@/components/shared/Field';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const FIELDS = ['name', 'sku', 'category', 'quantity', 'unit_cost', 'selling_price', 'status', 'created_date'];
const FORMATS = [
  { value: 'csv', label: 'CSV', desc: 'Comma-separated values' },
  { value: 'xlsx', label: 'Excel (XLSX)', desc: 'Spreadsheet with formatting' },
  { value: 'json', label: 'JSON', desc: 'Structured key-value' },
];

export default function ExportWizard({ open, onOpenChange, selectedCount, onComplete }) {
  const [selected, setSelected] = useState(FIELDS);
  const [statusFilter, setStatusFilter] = useState('all');
  const [format, setFormat] = useState('csv');
  useEffect(() => { if (open) { setSelected(FIELDS); setStatusFilter('all'); setFormat('csv'); } }, [open]);

  const toggle = (f) => setSelected((s) => s.includes(f) ? s.filter((x) => x !== f) : [...s, f]);
  const finish = () => { onComplete?.({ fields: selected, format, statusFilter }); toast.success(`Exported ${selectedCount ?? 'all'} records as ${format.toUpperCase()}`); onOpenChange?.(false); };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} title="Export Data" description="Choose fields, filters and format." steps={['Fields', 'Filters', 'Format', 'Confirm']} submitLabel="Export" onSubmit={finish}>
      {(step) => (
        <>
          {step === 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Select the columns to include in the export.</p>
              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map((f) => (
                  <label key={f} className="flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/40">
                    <Checkbox checked={selected.includes(f)} onCheckedChange={() => toggle(f)} />
                    <span className="text-sm font-mono">{f}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Filter by status" htmlFor="exp-status">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="exp-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{['all', 'active', 'pending', 'critical'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Search term (optional)" htmlFor="exp-search"><Input id="exp-search" placeholder="Filter records by name or SKU…" /></Field>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-2">
              {FORMATS.map((f) => (
                <button key={f.value} onClick={() => setFormat(f.value)} className={cn('w-full text-left rounded-lg border p-3 transition-colors', format === f.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40')}>
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </button>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Records</span><span className="font-medium">{selectedCount ?? 'All'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fields</span><span className="font-medium">{selected.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status filter</span><span className="font-medium capitalize">{statusFilter}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Format</span><span className="font-medium uppercase">{format}</span></div>
            </div>
          )}
        </>
      )}
    </WizardDialog>
  );
}