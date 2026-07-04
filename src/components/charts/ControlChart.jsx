import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

export default function ControlChart({ data, height = 300, dataKey = 'value', labelKey = 'x', center, ucl, lcl }) {
  const vals = data.map((d) => d[dataKey]);
  const mean = center ?? vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length || 1));
  const U = ucl ?? mean + 3 * sd;
  const L = lcl ?? mean - 3 * sd;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid className="stroke-border" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <ReferenceLine y={mean} stroke="hsl(var(--chart-1))" strokeDasharray="4 4" label={{ value: 'Mean', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
        <ReferenceLine y={U} stroke="hsl(var(--chart-5))" strokeDasharray="2 2" label={{ value: 'UCL', fontSize: 10, fill: 'hsl(var(--chart-5))' }} />
        <ReferenceLine y={L} stroke="hsl(var(--chart-5))" strokeDasharray="2 2" label={{ value: 'LCL', fontSize: 10, fill: 'hsl(var(--chart-5))' }} />
        <Line dataKey={dataKey} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}