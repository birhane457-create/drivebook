import { useState, useEffect } from 'react';
import WizardDialog from './WizardDialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusBadge from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const RECORDS = [
  { id: 'r1', name: 'Wireless Mouse', sku: 'WM-001', category: 'Electronics', stock: 48, status: 'active' },
  { id: 'r2', name: 'Wireless Mouse (dup)', sku: 'WM-001-D', category: 'Electronics', stock: 12, status: 'active' },
  { id: 'r3', name: 'Wless Mouse', sku: 'WM-001B', category: 'Electronics', stock: 5, status: 'pending' },
];
const FIELDS = ['name', 'sku', 'category', 'stock', 'status'];
const FIELD_LABELS = { name: 'Name', sku: 'SKU', category: 'Category', stock: 'Stock', status: 'Status' };

export default function MergeWizard({ open, onOpenChange, onComplete }) {
  const [primary, setPrimary] = useState('r1');
  const [duplicates, setDuplicates] = useState(['r2', 'r3']);
  const [resolution, setResolution] = useState({});
  useEffect(() => { if (open) { setPrimary('r1'); setDuplicates(['r2', 'r3']); setResolution({}); } }, [open]);

  const toggleDup = (id) => setDuplicates((d) => d.includes(id) ? d.filter((x) => x !== id) : [...d, id]);
  const merged = RECORDS.find((r) => r.id === primary);
  const finish = () => {
    const res = FIELDS.reduce((acc, f) => ({ ...acc, [f]: resolution[f] || merged[f] }), {});
    onComplete?.({ primary, duplicates, resolution: res });
    toast.success(`Merged ${duplicates.length} duplicate${duplicates.length === 1 ? '' : 's'} into ${merged.name}`);
    onOpenChange?.(false);
  };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} title="Merge Records" description="Combine duplicate records into a single master record." steps={['Primary', 'Duplicates', 'Resolve', 'Confirm']} submitLabel="Merge" onSubmit={finish}>
      {(step) => (
        <>
          {step === 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Select the primary record — its identity will be kept.</p>
              <RadioGroup value={primary} onValueChange={setPrimary} className="space-y-2">
                {RECORDS.map((r) => (
                  <label key={r.id} className={cn('flex items-center gap-3 rounded-lg border p-3 cursor-pointer', primary === r.id && 'border-primary bg-primary/5')}>
                    <RadioGroupItem value={r.id} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.sku} · {r.category}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
          {step === 1 && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Select the duplicates to merge into the primary.</p>
              <div className="space-y-2">
                {RECORDS.filter((r) => r.id !== primary).map((r) => (
                  <label key={r.id} className={cn('flex items-center gap-3 rounded-lg border p-3 cursor-pointer', duplicates.includes(r.id) && 'border-primary bg-primary/5')}>
                    <Checkbox checked={duplicates.includes(r.id)} onCheckedChange={() => toggleDup(r.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.sku}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </label>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">For each field, choose which record's value to keep.</p>
              {FIELDS.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">{FIELD_LABELS[f]}</span>
                  <Select value={resolution[f] || merged[f]} onValueChange={(v) => setResolution((s) => ({ ...s, [f]: v }))}>
                    <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={merged[f]}><span className="text-muted-foreground">primary:</span> {String(merged[f])}</SelectItem>
                      {RECORDS.filter((r) => duplicates.includes(r.id)).map((r) => (
                        <SelectItem key={r.id} value={r[f]}><span className="text-muted-foreground">{r.id}:</span> {String(r[f])}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Primary</span><span className="font-medium">{merged.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Merging</span><span className="font-medium">{duplicates.length} duplicates</span></div>
              <div className="rounded-lg border p-3 space-y-1 bg-muted/30">
                {FIELDS.map((f) => (
                  <div key={f} className="flex justify-between"><span className="text-muted-foreground">{FIELD_LABELS[f]}</span><span className="font-medium">{String(resolution[f] || merged[f])}</span></div>
                ))}
              </div>
              <p className="text-xs text-amber-600 bg-amber-500/10 rounded-lg p-3">Duplicate records will be permanently removed after merge.</p>
            </div>
          )}
        </>
      )}
    </WizardDialog>
  );
}