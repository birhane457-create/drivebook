import { cn } from '@/lib/utils';
import { addDays, format } from 'date-fns';

export default function GanttChart({ tasks = [], days = 14, startDate = new Date(), className }) {
  const dayLabels = Array.from({ length: days }, (_, i) => format(addDays(startDate, i), 'EEE d'));

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid border-b border-border bg-muted/40" style={{ gridTemplateColumns: `180px repeat(${days}, 1fr)` }}>
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-r border-border">Task</div>
            {dayLabels.map((d, i) => (
              <div key={i} className={cn('px-1 py-2 text-[11px] text-center text-muted-foreground border-r border-border', i % 7 >= 5 && 'bg-muted/60')}>
                {d}
              </div>
            ))}
          </div>
          {tasks.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">No tasks scheduled</p>}
          {tasks.map((task) => {
            const left = (task.start / days) * 100;
            const width = (task.duration / days) * 100;
            return (
              <div key={task.id} className="grid border-b border-border last:border-0 hover:bg-muted/20" style={{ gridTemplateColumns: `180px repeat(${days}, 1fr)` }}>
                <div className="px-3 py-3 text-sm font-medium border-r border-border truncate">{task.name}</div>
                <div className="relative col-span-full" style={{ gridColumn: `2 / ${days + 2}` }}>
                  <div className="absolute inset-y-0 flex items-center" style={{ left: `${left}%`, width: `${width}%` }}>
                    <div className={cn('h-7 rounded-md flex items-center px-2 text-[11px] text-white font-medium shadow-sm', task.color || 'bg-primary')} style={{ width: '100%' }}>
                      <span className="truncate">{task.label || task.name}</span>
                      {typeof task.progress === 'number' && (
                        <div className="absolute left-0 top-0 bottom-0 rounded-md bg-black/20" style={{ width: `${task.progress}%` }} />
                      )}
                    </div>
                  </div>
                  <div className="h-11" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}