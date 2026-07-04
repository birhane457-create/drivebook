import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

export default function WizardLayout({ title, subtitle, steps = [], currentStep = 0, onNext, onBack, onFinish, isLast, isPending, children, className }) {
  const last = isLast ?? currentStep === steps.length - 1;
  return (
    <div className={className}>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="flex items-center mb-6">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border flex-shrink-0',
              i < currentStep ? 'bg-primary text-primary-foreground border-primary' : i === currentStep ? 'border-primary text-primary' : 'border-border text-muted-foreground')}>
              {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn('text-sm ml-2 whitespace-nowrap', i === currentStep ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s}</span>
            {i < steps.length - 1 && <div className={cn('h-px flex-1 mx-2', i < currentStep ? 'bg-primary' : 'bg-border')} />}
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-6 min-h-[300px] mb-4">{children}</div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={currentStep === 0 || isPending}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
        {last ? (
          <Button onClick={onFinish} disabled={isPending}><Check className="w-4 h-4 mr-1" /> Finish</Button>
        ) : (
          <Button onClick={onNext}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
        )}
      </div>
    </div>
  );
}