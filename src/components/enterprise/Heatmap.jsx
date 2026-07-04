import { cn } from '@/lib/utils';
import { subWeeks, startOfWeek, addDays, format, eachDayOfInterval, isSameDay } from 'date-fns';

function intensityClass(v, max) {
  if (!v) return 'bg-muted/40';
  const r = v / max;
  if (r > 0.75) return 'bg-primary';
  if (r > 0.5) return 'bg-primary/70';
  if (r > 0.25) return 'bg-primary/40';
  return 'bg-primary/20';
}

export default function Heatmap({ data = {}, weeks = 16, className }) {
  const today = new Date();
  const gridStart = startOfWeek(subWeeks(today, weeks - 1), { weekStartsOn: 1 });
  const columns = [];
  for (let w = 0; w < weeks; w++) {
    const start = addDays(gridStart, w * 7);
    columns.push(eachDayOfInterval({ start, end: addDays(start, 6) }));
  }
  const max = Math.max(1, ...Object.values(data));
  const monthLabels = [];
  let lastMonth = -1;
  columns.forEach((col) => {
    const m = col[0].getMonth();
    if (m !== lastMonth) { monthLabels.push({ label: format(col[0], 'MMM'), offset: columns.indexOf(col) }); lastMonth = m; }
  });

  return (
    <div className={cn('rounded-xl border bg-card p-4 overflow-x-auto', className)}>
      <div className="flex gap-1 min-w-fit">
        <div className="flex flex-col justify-end pr-2 text-[10px] text-muted-foreground">
          <span className="h-3" />
          {['Mon', 'Wed', 'Fri'].map((d) => <span key={d} className="h-3">{d}</span>)}
        </div>
        <div>
          <div className="flex gap-1 mb-1 h-4 relative">
            {monthLabels.map((m, i) => (
              <span key={i} className="text-[10px] text-muted-foreground absolute" style={{ left: `${m.offset * 15}px` }}>{m.label}</span>
            ))}
          </div>
          <div className="flex gap-1">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-1">
                {col.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const v = data[key] || 0;
                  return (
                    <div
                      key={key}
                      title={`${key}: ${v}`}
                      className={cn('w-3 h-3 rounded-sm', intensityClass(v, max), isSameDay(day, today) && 'ring-1 ring-primary ring-offset-1 ring-offset-card')}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm bg-muted/40" />
        <div className="w-3 h-3 rounded-sm bg-primary/20" />
        <div className="w-3 h-3 rounded-sm bg-primary/40" />
        <div className="w-3 h-3 rounded-sm bg-primary/70" />
        <div className="w-3 h-3 rounded-sm bg-primary" />
        <span>More</span>
      </div>
    </div>
  );
}