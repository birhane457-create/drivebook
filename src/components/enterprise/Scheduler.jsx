import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8am - 6pm

export default function Scheduler({ resources = [], events = [], className }) {
  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid border-b border-border bg-muted/40" style={{ gridTemplateColumns: `160px repeat(${HOURS.length}, 1fr)` }}>
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-r border-border">Resource</div>
            {HOURS.map((h) => (
              <div key={h} className="px-1 py-2 text-[11px] text-center text-muted-foreground border-r border-border">{formatHour(h)}</div>
            ))}
          </div>
          {resources.map((res) => (
            <div key={res.id} className="grid border-b border-border last:border-0" style={{ gridTemplateColumns: `160px repeat(${HOURS.length}, 1fr)` }}>
              <div className="px-3 py-3 text-sm font-medium border-r border-border truncate">{res.name}</div>
              <div className="relative col-span-full" style={{ gridColumn: `2 / ${HOURS.length + 2}` }}>
                {HOURS.map((h, i) => (
                  <div key={h} className={cn('absolute top-0 bottom-0 border-r border-border', i % 2 === 1 && 'bg-muted/20')} style={{ left: `${(i / HOURS.length) * 100}%`, width: `${(1 / HOURS.length) * 100}%` }} />
                ))}
                {events.filter((e) => e.resourceId === res.id).map((e, i) => {
                  const left = ((e.startHour - HOURS[0]) / HOURS.length) * 100;
                  const width = (e.duration / HOURS.length) * 100;
                  return (
                    <div key={i} className={cn('absolute top-1 bottom-1 rounded-md px-2 py-1 text-[11px] text-white font-medium shadow-sm overflow-hidden', e.color || 'bg-primary')} style={{ left: `${left}%`, width: `${width}%` }}>
                      <span className="truncate block">{e.title}</span>
                    </div>
                  );
                })}
                <div className="h-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatHour(h) {
  const ampm = h >= 12 ? 'p' : 'a';
  const hr = h > 12 ? h - 12 : h;
  return `${hr}${ampm}`;
}