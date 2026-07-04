import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/shared/StatusBadge';

export default function MasterDetail({ items = [], renderDetail, className }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const selected = items.find((i) => i.id === selectedId);

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden h-[420px] flex', className)}>
      <div className="w-1/2 border-r border-border overflow-auto">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            className={cn(
              'w-full text-left px-3 py-3 border-b border-border hover:bg-muted/50 transition-colors',
              item.id === selectedId && 'bg-primary/10 border-l-2 border-l-primary'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{item.title}</p>
              {item.status && <StatusBadge status={item.status} />}
            </div>
            {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {selected ? (renderDetail ? renderDetail(selected) : (
          <div className="space-y-3">
            <h3 className="text-base font-semibold">{selected.title}</h3>
            <Input defaultValue={selected.title} />
            <p className="text-sm text-muted-foreground">{selected.subtitle}</p>
          </div>
        )) : <p className="text-sm text-muted-foreground">Select an item</p>}
      </div>
    </div>
  );
}