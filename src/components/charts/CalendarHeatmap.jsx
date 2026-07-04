export default function CalendarHeatmap({ data = [], weeks = 22 }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - weeks * 7);
  const map = {};
  data.forEach((d) => { map[d.date] = d.value; });
  const cells = [];
  const d = new Date(start);
  while (d <= today) {
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: iso, value: map[iso] || 0 });
    d.setDate(d.getDate() + 1);
  }
  const max = Math.max(...cells.map((c) => c.value), 1);
  const cols = Math.ceil(cells.length / 7);
  return (
    <div className="overflow-auto">
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 pr-1">
          {days.map((dd) => <div key={dd} className="h-3 text-[8px] text-muted-foreground leading-3">{dd}</div>)}
        </div>
        {Array.from({ length: cols }).map((_, ci) => (
          <div key={ci} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((_, ri) => {
              const c = cells[ci * 7 + ri];
              if (!c) return <div key={ri} className="w-3 h-3" />;
              const o = c.value / max;
              return (
                <div key={ri} title={`${c.date}: ${c.value}`} className="w-3 h-3 rounded-sm"
                  style={{ background: c.value === 0 ? 'hsl(var(--muted))' : `hsl(var(--chart-1) / ${0.2 + o * 0.8})` }} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}