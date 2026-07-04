import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function PropertyPanel({ title = 'Properties', properties = [], className }) {
  return (
    <div className={cn('rounded-xl border bg-card flex flex-col', className)}>
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {properties.map((p) => (
            <div key={p.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{p.label}</p>
                {p.hint && <p className="text-[11px] text-muted-foreground/70">{p.hint}</p>}
              </div>
              <div className="text-right">
                {p.render ? p.render(p.value) : (
                  <p className={cn('text-sm font-medium', p.mono && 'font-mono')}>{String(p.value ?? '—')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}