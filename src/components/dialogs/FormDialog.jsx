import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function FormDialog({ open, onOpenChange, title, description, submitLabel = 'Save', onSubmit, isPending, submitDisabled, children }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto py-1">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isPending || submitDisabled}>{submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}