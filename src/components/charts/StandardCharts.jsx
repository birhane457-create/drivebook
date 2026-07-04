import {
  AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const tooltipStyle = { borderRadius: '0.625rem', border: '1px solid hsl(var(--border))' };

export function TrendAreaChart({ data, dataKey = 'value', xKey = 'label', height = 220, color, format, name }) {
  const c = color || CHART_COLORS[0];
  const id = `grad-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={c} stopOpacity={0.3} />
            <stop offset="95%" stopColor={c} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={format ? (v) => [format(v), name || dataKey] : undefined} />
        <Area type="monotone" dataKey={dataKey} stroke={c} fill={`url(#${id})`} strokeWidth={2} name={name} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 220, nameKey = 'name', valueKey = 'value', colors = CHART_COLORS }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey={valueKey} nameKey={nameKey}>
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BarSeriesChart({ data, keys = [], xKey = 'label', height = 220, colors = CHART_COLORS, format }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={format ? (v) => format(v) : undefined} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}