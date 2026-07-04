export default function TimelineChart({ events = [], height = 180 }) {
  return (
    <div className="relative" style={{ height }}>
      <div className="absolute left-3 right-3 top-1/2 h-0.5 bg-border" />
      <div className="flex justify-between items-center h-full">
        {events.map((e, i) => (
          <div key={i} className="flex flex-col items-center" style={{ flex: 1 }}>
            <div className="text-[10px] text-muted-foreground mb-1 whitespace-nowrap">{e.time}</div>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-background z-10" style={{ background: e.color || 'hsl(var(--primary))' }} />
            <div className="text-[10px] mt-1 text-center max-w-[90px] leading-tight">{e.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}