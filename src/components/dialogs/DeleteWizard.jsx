import { useState, useEffect } from 'react';
import WizardDialog from './WizardDialog';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DEPENDENCIES = [
  { type: 'Sales Orders', count: 8 },
  { type: 'Purchase Orders', count: 3 },
  { type: 'Stock Levels', count: 5 },
  { type: 'Inventory Logs', count: 24 },
];

export default function DeleteWizard({ open, onOpenChange, itemName = 'Wireless Mouse (WM-001)', selectedCount, dependencies = DEPENDENCIES, onComplete }) {
  const [confirmText, setConfirmText] = useState('');
  useEffect(() => { if (open) setConfirmText(''); }, [open]);
  const single = Boolean(itemName && !selectedCount);
  const label = selectedCount ? `${selectedCount} records` : itemName;
  const canDelete = confirmText === 'DELETE';
  const totalDeps = dependencies.reduce((s, d) => s + d.count, 0);

  const finish = () => { if (!canDelete) return; onComplete?.(); toast.success(`Deleted ${label}`); onOpenChange?.(false); };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} title="Delete Records" description="Permanent deletion — this cannot be undone." steps={['Review', 'Dependencies', 'Confirm']} submitLabel="Delete" onSubmit={finish} >
      {(step) => (
        <>
          {step === 0 && (
            <div className="space-y-3">
              <div className="flex gap-2 items-start text-destructive bg-destructive/10 rounded-lg p-3 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>You are about to permanently delete <strong>{label}</strong>. This action is irreversible.</span>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Target</span>
                <span className="text-sm font-medium">{label}</span>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm"><Link2 className="w-4 h-4 text-muted-foreground" /><span className="font-medium">Related records</span></div>
              <p className="text-xs text-muted-foreground">These linked records reference the target. Deleting may orphan them.</p>
              <div className="space-y-2">
                {dependencies.map((d) => (
                  <div key={d.type} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm">{d.type}</span>
                    <span className={cn('text-xs font-medium rounded-md px-2 py-0.5', d.count > 0 ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600')}>{d.count} linked</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-600 bg-amber-500/10 rounded-lg p-3">{totalDeps} related record{totalDeps === 1 ? '' : 's'} found. Consider archiving instead if you may need this data later.</p>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm">Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm permanent deletion of <strong>{label}</strong>.</p>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE" className={cn(confirmText && !canDelete && 'border-destructive')} />
              <p className="text-xs text-muted-foreground">{totalDeps} related records will be detached.</p>
            </div>
          )}
        </>
      )}
    </WizardDialog>
  );
}