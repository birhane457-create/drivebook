import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WizardDialog({ open, onOpenChange, title, description, steps = [], submitLabel = 'Finish', onSubmit, isPending, children }) {
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex items-center">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border flex-shrink-0',
                i < step ? 'bg-primary text-primary-foreground border-primary' : i === step ? 'border-primary text-primary' : 'border-border text-muted-foreground')}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={cn('text-xs ml-2 whitespace-nowrap', i === step ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s}</span>
              {i < steps.length - 1 && <div className={cn('h-px flex-1 mx-2', i < step ? 'bg-primary' : 'bg-border')} />}
            </div>
          ))}
        </div>
        <div className="min-h-[220px] max-h-[55vh] overflow-auto py-2">
          {typeof children === 'function' ? children(step, setStep) : children}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isPending}>Cancel</Button>
          {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={isPending}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>}
          {isLast ? (
            <Button onClick={onSubmit} disabled={isPending}><Check className="w-4 h-4 mr-1" /> {submitLabel}</Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}