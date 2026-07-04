import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ParetoChart({ data, height = 300, dataKey = 'count', labelKey = 'category' }) {
  const sorted = [...data].sort((a, b) => b[dataKey] - a[dataKey]);
  const total = sorted.reduce((s, d) => s + d[dataKey], 0) || 1;
  let acc = 0;
  const rows = sorted.map((d) => {
    acc += d[dataKey];
    return { ...d, cumulative: Math.round((acc / total) * 100) };
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid className="stroke-border" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 10 }} />
        <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="l" dataKey={dataKey} fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
        <Line yAxisId="r" dataKey="cumulative" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}