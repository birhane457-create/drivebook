import { useState, useEffect } from 'react';
import WizardDialog from './WizardDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Field from '@/components/shared/Field';
import StatusBadge from '@/components/shared/StatusBadge';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

const SOURCE = { id: 'src1', name: 'Wireless Mouse', sku: 'WM-001', category: 'Electronics', unit_cost: 8.4, selling_price: 24.99, status: 'active' };
const FIELD_LABELS = { name: 'Name', sku: 'SKU', category: 'Category', unit_cost: 'Unit Cost', selling_price: 'Selling Price', status: 'Status' };

export default function DuplicateWizard({ open, onOpenChange, onComplete }) {
  const [copy, setCopy] = useState({});
  useEffect(() => { if (open) setCopy({ ...SOURCE, name: `${SOURCE.name} (copy)`, sku: '' }); }, [open]);

  const set = (k, v) => setCopy((c) => ({ ...c, [k]: v }));
  const finish = () => { onComplete?.(copy); toast.success('Duplicate record created'); onOpenChange?.(false); };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} title="Duplicate Record" description="Create a copy of an existing record with a new identity." steps={['Source', 'Copy Fields', 'Confirm']} submitLabel="Create Duplicate" onSubmit={finish}>
      {(step) => (
        <>
          {step === 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Copy className="w-5 h-5 text-primary" /></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{SOURCE.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{SOURCE.sku} · {SOURCE.category}</p>
                </div>
                <StatusBadge status={SOURCE.status} />
              </div>
              <p className="text-xs text-muted-foreground">This record will be copied. In the next step, give the duplicate a unique name and SKU.</p>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Name" htmlFor="dup-name" required><Input id="dup-name" value={copy.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="SKU" htmlFor="dup-sku" required help="Must be unique — leave blank to auto-generate."><Input id="dup-sku" value={copy.sku || ''} onChange={(e) => set('sku', e.target.value)} placeholder="Auto-generate" /></Field>
              <Field label="Category" htmlFor="dup-cat">
                <Select value={copy.category} onValueChange={(v) => set('category', v)}>
                  <SelectTrigger id="dup-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>{['Electronics', 'Office', 'Furniture'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unit Cost ($)" htmlFor="dup-uc"><Input id="dup-uc" type="number" value={copy.unit_cost || 0} onChange={(e) => set('unit_cost', Number(e.target.value))} /></Field>
                <Field label="Selling Price ($)" htmlFor="dup-sp"><Input id="dup-sp" type="number" value={copy.selling_price || 0} onChange={(e) => set('selling_price', Number(e.target.value))} /></Field>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">A new record will be created with these values:</p>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
                {Object.keys(FIELD_LABELS).map((f) => (
                  <div key={f} className="flex justify-between"><span className="text-muted-foreground">{FIELD_LABELS[f]}</span><span className="font-medium">{String(copy[f] ?? '—')}</span></div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </WizardDialog>
  );
}