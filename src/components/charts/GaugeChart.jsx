export default function GaugeChart({ value = 70, label, height = 200, color }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 80;
  const cx = 100;
  const cy = 100;
  const polar = (a) => {
    const rad = (a * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
  };
  const [sx, sy] = polar(180);
  const [ex, ey] = polar(0);
  const [vx, vy] = polar(180 - (v / 100) * 180);
  const largeArc = (v / 100) * 180 > 180 ? 1 : 0;
  const bgArc = `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`;
  const valArc = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${vx} ${vy}`;
  const c = color || (v < 33 ? 'hsl(var(--chart-5))' : v < 66 ? 'hsl(var(--chart-4))' : 'hsl(var(--chart-3))');
  return (
    <div className="flex flex-col items-center">
      <svg width="200" height={Math.min(height, 120)} viewBox="0 0 200 110">
        <path d={bgArc} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" strokeLinecap="round" />
        <path d={valArc} fill="none" stroke={c} strokeWidth="14" strokeLinecap="round" />
        <text x="100" y="92" textAnchor="middle" className="fill-foreground" style={{ fontSize: 22, fontWeight: 700 }}>{v}%</text>
      </svg>
      {label && <p className="text-xs text-muted-foreground -mt-1">{label}</p>}
    </div>
  );
}