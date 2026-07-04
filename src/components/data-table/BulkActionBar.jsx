import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export default function BulkActionBar({ count, actions, onClear }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-xl mb-3">
      <span className="text-sm font-semibold">{count} selected</span>
      <div className="h-4 w-px bg-primary/30" />
      <div className="flex items-center gap-1.5 flex-wrap">
        {actions.map((a, i) => (
          <Button key={i} variant={a.variant || 'outline'} size="sm" onClick={a.onClick} disabled={a.disabled}>
            {a.icon && <a.icon className="w-3.5 h-3.5 mr-1.5" />}
            {a.label}
          </Button>
        ))}
      </div>
      <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={onClear}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}