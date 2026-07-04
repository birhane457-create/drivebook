import { useState, useEffect } from 'react';
import WizardDialog from './WizardDialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import Field from '@/components/shared/Field';
import { Archive, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const POLICIES = [
  { value: '6m', label: '6 months', desc: 'Auto-purge after 6 months' },
  { value: '1y', label: '1 year', desc: 'Auto-purge after 12 months' },
  { value: '7y', label: '7 years', desc: 'Retain for compliance, then purge' },
  { value: 'indefinite', label: 'Indefinite', desc: 'Keep archived until manually deleted' },
];

export default function ArchiveWizard({ open, onOpenChange, selectedCount = 12, onComplete }) {
  const [policy, setPolicy] = useState('1y');
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) { setPolicy('1y'); setReason(''); } }, [open]);

  const finish = () => { onComplete?.({ policy, reason }); toast.success(`Archived ${selectedCount} records`); onOpenChange?.(false); };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} title="Archive Records" description="Move records out of active use while retaining them for history." steps={['Select', 'Retention', 'Confirm']} submitLabel="Archive" onSubmit={finish}>
      {(step) => (
        <>
          {step === 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Archive className="w-5 h-5 text-primary" /></div>
                <div><p className="text-sm font-medium">{selectedCount} records selected</p><p className="text-xs text-muted-foreground">These will be removed from active lists.</p></div>
              </div>
              <p className="text-xs text-muted-foreground">Archived records stay searchable and can be restored at any time.</p>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Retention policy</p>
                <RadioGroup value={policy} onValueChange={setPolicy} className="space-y-2">
                  {POLICIES.map((p) => (
                    <label key={p.value} className={cn('flex items-center gap-3 rounded-lg border p-3 cursor-pointer', policy === p.value && 'border-primary bg-primary/5')}>
                      <RadioGroupItem value={p.value} />
                      <div><p className="text-sm font-medium">{p.label}</p><p className="text-xs text-muted-foreground">{p.desc}</p></div>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <Field label="Reason (optional)" htmlFor="arch-reason"><Textarea id="arch-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why are these being archived?" /></Field>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Records</span><span className="font-medium">{selectedCount}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Retention</span><span className="font-medium">{POLICIES.find((p) => p.value === policy)?.label}</span></div>
              {reason && <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span className="font-medium text-right max-w-[60%]">{reason}</span></div>}
              <div className="flex gap-2 items-start text-amber-600 bg-amber-500/10 rounded-lg p-3 text-xs">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Records will no longer appear in active views, transactions, or reports. They remain in the audit trail.</span>
              </div>
            </div>
          )}
        </>
      )}
    </WizardDialog>
  );
}