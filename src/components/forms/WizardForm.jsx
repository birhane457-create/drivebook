import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react';
import AutoSaveIndicator from '@/components/shared/AutoSaveIndicator';

export default function WizardForm({
  steps = [],
  onSubmit,
  title,
  autoSaveStatus = 'idle',
  submitLabel = 'Finish',
}) {
  const [current, setCurrent] = useState(0);
  const [stepErrors, setStepErrors] = useState(null);

  const isLast = current === steps.length - 1;
  const step = steps[current];

  const goNext = () => {
    if (step?.validate) {
      const errs = step.validate();
      if (errs && Object.keys(errs).length > 0) {
        setStepErrors(errs);
        return;
      }
    }
    setStepErrors(null);
    if (isLast) { onSubmit?.(); return; }
    setCurrent(c => Math.min(c + 1, steps.length - 1));
  };

  const goPrev = () => {
    setStepErrors(null);
    setCurrent(c => Math.max(c - 1, 0));
  };

  const errorCount = stepErrors ? Object.keys(stepErrors).length : 0;
  const progress = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 100;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">Step {current + 1} of {steps.length} — {step?.title}</p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="px-5 pt-4">
        <div className="flex items-center">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 border-2 transition-colors",
                i < current && "bg-primary border-primary text-primary-foreground",
                i === current && "border-primary text-primary",
                i > current && "border-border text-muted-foreground"
              )}>
                {i < current ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-2 rounded", i < current ? "bg-primary" : "bg-border")} />
              )}
            </div>
          ))}
        </div>
        <Progress value={progress} className="mt-3 h-1" />
      </div>

      <div className="p-5 min-h-[160px]">
        {step?.description && <p className="text-sm text-muted-foreground mb-4">{step.description}</p>}
        {typeof step?.content === 'function' ? step.content({ errors: stepErrors }) : step?.content}
        {errorCount > 0 && (
          <div className="mt-4 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            Please fix {errorCount} field{errorCount > 1 ? 's' : ''} before continuing.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-4 border-t bg-muted/30">
        <Button variant="ghost" onClick={goPrev} disabled={current === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <span className="text-xs text-muted-foreground">{current} of {steps.length} complete</span>
        <Button onClick={goNext}>
          {isLast ? submitLabel : 'Continue'}
          {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}