import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { Check, AlertCircle } from 'lucide-react';

const statusStyle = {
  complete: 'bg-primary border-primary text-primary-foreground',
  current: 'border-primary text-primary bg-card ring-4 ring-primary/15',
  pending: 'border-border text-muted-foreground bg-card',
  error: 'border-destructive text-destructive bg-destructive/5',
};

export default function WorkflowStepper({ steps, currentStep, orientation = 'horizontal', className }) {
  const vertical = orientation === 'vertical';
  const resolveStatus = (s, i) =>
    s.status || (i < currentStep ? 'complete' : i === currentStep ? 'current' : 'pending');

  if (vertical) {
    return (
      <div className={cn("flex flex-col", className)}>
        {steps.map((s, i) => {
          const status = resolveStatus(s, i);
          const Icon = s.icon;
          return (
            <div key={s.key || i} className="flex gap-3 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors", statusStyle[status])}>
                  {status === 'complete' ? <Check className="w-4 h-4" /> : status === 'error' ? <AlertCircle className="w-4 h-4" /> : Icon ? <Icon className="w-4 h-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn("w-0.5 flex-1 min-h-[1.5rem] mt-1 rounded", status === 'complete' ? 'bg-primary' : 'bg-border')} />
                )}
              </div>
              <div className="pt-1 pb-1">
                <p className={cn("text-sm font-medium", status === 'pending' && "text-muted-foreground")}>{s.title}</p>
                {s.description && <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">{s.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex", className)}>
      {steps.map((s, i) => {
        const status = resolveStatus(s, i);
        const Icon = s.icon;
        const last = i === steps.length - 1;
        return (
          <Fragment key={s.key || i}>
            <div className="flex flex-col items-center" style={{ flex: last ? '0 0 auto' : '1 1 0' }}>
              <div className="flex items-center w-full">
                <div className={cn("h-0.5 flex-1", i === 0 && "opacity-0")} style={{ backgroundColor: status === 'complete' ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} />
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors", statusStyle[status])}>
                  {status === 'complete' ? <Check className="w-4 h-4" /> : status === 'error' ? <AlertCircle className="w-4 h-4" /> : Icon ? <Icon className="w-4 h-4" /> : i + 1}
                </div>
                <div className={cn("h-0.5 flex-1", last && "opacity-0")} style={{ backgroundColor: status === 'complete' ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} />
              </div>
              <div className="mt-2 text-center px-1">
                <p className={cn("text-sm font-medium", status === 'pending' && "text-muted-foreground")}>{s.title}</p>
                {s.description && <p className="text-xs text-muted-foreground mt-0.5 max-w-[10rem]">{s.description}</p>}
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}