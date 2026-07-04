import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function BubbleChart({ data, height = 300, xKey = 'x', yKey = 'y', zKey = 'z', name = 'Series' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid className="stroke-border" />
        <XAxis type="number" dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis type="number" dataKey={yKey} tick={{ fontSize: 11 }} />
        <ZAxis type="number" dataKey={zKey} range={[40, 400]} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Legend />
        <Scatter name={name} data={data} fill="hsl(var(--chart-1))" fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}