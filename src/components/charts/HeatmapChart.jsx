export default function HeatmapChart({ data = [], rowLabels = [], colLabels = [], height = 280, colorVar = '--primary' }) {
  const max = Math.max(...data.flat(), 1);
  return (
    <div className="overflow-auto" style={{ maxHeight: height }}>
      <div className="inline-block min-w-full">
        <div className="flex">
          <div className="w-12" />
          <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${colLabels.length}, minmax(44px, 1fr))` }}>
            {colLabels.map((c) => <div key={c} className="text-[10px] text-muted-foreground text-center px-1 pb-1">{c}</div>)}
          </div>
        </div>
        {data.map((row, ri) => (
          <div key={ri} className="flex items-center">
            <div className="w-12 text-[10px] text-muted-foreground pr-2 text-right">{rowLabels[ri] || ri}</div>
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(44px, 1fr))` }}>
              {row.map((v, ci) => {
                const o = v / max;
                return (
                  <div key={ci} title={String(v)} className="m-0.5 rounded aspect-square flex items-center justify-center text-[10px] font-medium"
                    style={{ background: `hsl(var(${colorVar}) / ${0.12 + o * 0.75})`, color: o > 0.5 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))' }}>
                    {v || ''}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}