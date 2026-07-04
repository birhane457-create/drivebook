import { Check, Loader2, AlertCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const cfg = {
  idle: { icon: Circle, text: 'No changes', cls: 'text-muted-foreground' },
  saving: { icon: Loader2, text: 'Saving...', cls: 'text-muted-foreground', spin: true },
  saved: { icon: Check, text: 'All changes saved', cls: 'text-emerald-600 dark:text-emerald-400' },
  error: { icon: AlertCircle, text: 'Save failed', cls: 'text-destructive' },
};

export default function AutoSaveIndicator({ status = 'idle', className }) {
  const c = cfg[status] || cfg.idle;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", c.cls, className)}>
      <Icon className={cn("w-3.5 h-3.5", c.spin && "animate-spin")} />
      {c.text}
    </span>
  );
}