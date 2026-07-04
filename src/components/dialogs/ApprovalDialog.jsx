import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Field from '@/components/shared/Field';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

export default function ApprovalDialog({ open, onOpenChange, title = 'Approval Request', recordSummary, onApprove, onReject, isPending }) {
  const [decision, setDecision] = useState('approve');
  const [comment, setComment] = useState('');
  useEffect(() => { if (open) { setDecision('approve'); setComment(''); } }, [open]);

  const submit = () => (decision === 'approve' ? onApprove?.(comment) : onReject?.(comment));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Review the request and record your decision.</DialogDescription>
        </DialogHeader>
        {recordSummary && <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">{recordSummary}</div>}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDecision('approve')}
            className={cn('flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors', decision === 'approve' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-border hover:bg-muted/40')}
          ><Check className="w-4 h-4" /> Approve</button>
          <button
            onClick={() => setDecision('reject')}
            className={cn('flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors', decision === 'reject' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border hover:bg-muted/40')}
          ><X className="w-4 h-4" /> Reject</button>
        </div>
        <Field label="Comment" htmlFor="approval-comment" help="Recorded in the audit trail.">
          <Textarea id="approval-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Add a comment for the requester…" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isPending}>Cancel</Button>
          <Button variant={decision === 'approve' ? 'default' : 'destructive'} onClick={submit} disabled={isPending}>
            {decision === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}