import { cn } from '@/lib/utils';
import { Check, X, Clock, MinusCircle } from 'lucide-react';

const STEP_STATE = {
  approved: { icon: Check, color: 'bg-emerald-500', ring: 'ring-emerald-500/20', label: 'Approved' },
  rejected: { icon: X, color: 'bg-destructive', ring: 'ring-destructive/20', label: 'Rejected' },
  pending: { icon: Clock, color: 'bg-amber-500', ring: 'ring-amber-500/20', label: 'Pending' },
  skipped: { icon: MinusCircle, color: 'bg-muted-foreground', ring: 'ring-muted-foreground/20', label: 'Skipped' },
};

export default function ApprovalTimeline({ steps = [], className }) {
  return (
    <div className={cn('relative', className)}>
      <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border" />
      <ol className="space-y-4">
        {steps.map((step, i) => {
          const cfg = STEP_STATE[step.status] || STEP_STATE.pending;
          const Icon = cfg.icon;
          const isLast = i === steps.length - 1;
          return (
            <li key={i} className="relative pl-12">
              <div className={cn('absolute left-0 top-0 w-10 h-10 rounded-full ring-4 ring-background flex items-center justify-center text-white', cfg.color, cfg.ring)}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{step.approverName || step.approver}</p>
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide',
                    step.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' :
                    step.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                    step.status === 'pending' ? 'bg-amber-500/10 text-amber-600' :
                    'bg-muted text-muted-foreground'
                  )}>{cfg.label}</span>
                </div>
                {step.role && <p className="text-xs text-muted-foreground">{step.role}</p>}
                {step.comment && <p className="text-sm text-muted-foreground mt-1 italic">"{step.comment}"</p>}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {step.timestamp || (step.status === 'pending' ? 'Awaiting decision' : '—')}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}