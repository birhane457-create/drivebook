import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, AlertOctagon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  danger: { icon: AlertOctagon, cls: 'bg-destructive/10 text-destructive', btn: 'destructive' },
  warning: { icon: AlertTriangle, cls: 'bg-amber-500/10 text-amber-500', btn: 'default' },
  success: { icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-600', btn: 'default' },
  info: { icon: Info, cls: 'bg-primary/10 text-primary', btn: 'default' },
};

export default function ConfirmationDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'info', onConfirm, isPending }) {
  const v = VARIANTS[variant] || VARIANTS.info;
  const Icon = v.icon;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2', v.cls)}>
            <Icon className="w-6 h-6" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          {description && <DialogDescription className="text-center">{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isPending}>{cancelLabel}</Button>
          <Button variant={v.btn} onClick={onConfirm} disabled={isPending}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}