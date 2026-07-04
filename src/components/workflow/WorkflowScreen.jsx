import { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

const priorityMap = { high: 'critical', medium: 'pending', low: 'active' };

export default function WorkflowScreen({ title, subtitle, stages, items, onAdvance, actionLabel = 'Advance', renderItem, filters }) {
  const [selected, setSelected] = useState(null);
  const byStage = (key) => items.filter((i) => i.stage === key);

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle}>{filters}</PageHeader>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {stages.map((s) => {
          const list = byStage(s.key);
          return (
            <div key={s.key} className="flex-shrink-0 w-72">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-sm font-semibold">{s.label}</span>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((it) => (
                  <button key={it.id} onClick={() => setSelected(it)} className="w-full text-left rounded-lg border bg-card p-3 hover:shadow-md hover:border-primary/40 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-tight">{it.title}</span>
                      {it.priority && <StatusBadge status={priorityMap[it.priority] || 'active'} />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{it.subtitle}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">{it.assignee}</span>
                      {it.due && <span className="text-[10px] text-muted-foreground">{it.due}</span>}
                    </div>
                  </button>
                ))}
                {list.length === 0 && <div className="text-xs text-muted-foreground text-center py-8 border border-dashed rounded-lg">No items</div>}
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-md overflow-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>{selected.subtitle}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-2 text-sm">
                {renderItem ? renderItem(selected) : (
                  <>
                    {selected.assignee && <div className="flex justify-between"><span className="text-muted-foreground">Assignee</span><span className="font-medium">{selected.assignee}</span></div>}
                    {selected.due && <div className="flex justify-between"><span className="text-muted-foreground">Due</span><span className="font-medium">{selected.due}</span></div>}
                    {selected.priority && <div className="flex justify-between items-center"><span className="text-muted-foreground">Priority</span><StatusBadge status={priorityMap[selected.priority] || 'active'} /></div>}
                    {selected.meta && Object.entries(selected.meta).map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span><span className="font-medium text-right">{v}</span></div>
                    ))}
                  </>
                )}
              </div>
              <SheetFooter className="mt-6">
                <Button className="w-full" onClick={() => { onAdvance?.(selected); setSelected(null); }}>
                  {actionLabel} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}