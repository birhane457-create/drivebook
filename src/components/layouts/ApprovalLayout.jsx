import { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import SectionCard from '@/components/shared/SectionCard';
import StatusBadge from '@/components/shared/StatusBadge';
import Timeline from '@/components/enterprise/Timeline';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Check, X, ClipboardList } from 'lucide-react';

export default function ApprovalLayout({ title, subtitle, summaryFields = [], requester, history = [], onApprove, onReject, isPending, className }) {
  const [decision, setDecision] = useState('approve');
  const [comment, setComment] = useState('');
  const submit = () => (decision === 'approve' ? onApprove?.(comment) : onReject?.(comment));

  return (
    <div className={className}>
      <PageHeader title={title || 'Approval'} subtitle={subtitle} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Request Summary" icon={ClipboardList}>
            <div className="space-y-2.5">
              {summaryFields.map((f) => (
                <div key={f.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className={cn('font-medium text-right', f.mono && 'font-mono')}>{f.render ? f.render(f.value) : String(f.value ?? '—')}</span>
                </div>
              ))}
              {requester && (
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="text-muted-foreground">Requested by</span>
                  <span className="font-medium">{requester}</span>
                </div>
              )}
            </div>
          </SectionCard>
          {history.length > 0 && (
            <SectionCard title="Approval History">
              <Timeline items={history} />
            </SectionCard>
          )}
        </div>
        <div>
          <SectionCard title="Decision">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setDecision('approve')} className={cn('flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors', decision === 'approve' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-border hover:bg-muted/40')}><Check className="w-4 h-4" /> Approve</button>
                <button onClick={() => setDecision('reject')} className={cn('flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors', decision === 'reject' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border hover:bg-muted/40')}><X className="w-4 h-4" /> Reject</button>
              </div>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="Add a comment for the requester…" />
              <Button variant={decision === 'approve' ? 'default' : 'destructive'} onClick={submit} disabled={isPending} className="w-full">
                {decision === 'approve' ? 'Approve request' : 'Reject request'}
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}