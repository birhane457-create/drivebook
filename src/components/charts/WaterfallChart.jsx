import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function WaterfallChart({ data, height = 300 }) {
  let running = 0;
  const rows = data.map((d) => {
    const start = running;
    running += d.value;
    return {
      label: d.label,
      base: start,
      profit: d.value > 0 ? d.value : 0,
      loss: d.value < 0 ? -d.value : 0,
      total: d.isTotal ? d.value : 0,
    };
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="profit" stackId="a" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
        <Bar dataKey="loss" stackId="a" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}