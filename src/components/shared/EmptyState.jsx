import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Info, Plus } from 'lucide-react';
import Illustration from './Illustration';

export default function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  why,
  actionLabel,
  onAction,
  children,
  className,
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      {illustration
        ? (typeof illustration === 'string'
            ? <Illustration name={illustration} className="w-32 h-32 mb-5" />
            : <div className="mb-5">{illustration}</div>)
        : Icon && (
          <div className="relative w-20 h-20 mb-5">
            <div className="absolute inset-0 rounded-full bg-primary/10" />
            <div className="absolute inset-2 rounded-full bg-primary/5 flex items-center justify-center">
              <Icon className="w-8 h-8 text-primary" />
            </div>
          </div>
        )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {why && (
        <p className="mt-3 inline-flex items-start gap-1.5 text-left text-xs text-muted-foreground/80 max-w-sm bg-muted/50 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
          <span><span className="font-medium text-foreground">Why this matters: </span>{why}</span>
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5 gap-2">
          <Plus className="w-4 h-4" />{actionLabel}
        </Button>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}