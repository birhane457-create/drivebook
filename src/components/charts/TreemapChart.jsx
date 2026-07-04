import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

const palette = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function Cell(props) {
  const { x, y, width, height, index, payload } = props;
  const fill = payload?.color || palette[index % palette.length];
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill, stroke: 'hsl(var(--background))', strokeWidth: 2 }} />
      {width > 50 && height > 24 && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="hsl(var(--primary-foreground))" fontSize={Math.min(width / 6, 13)} fontWeight={600}>
          {payload?.name}
        </text>
      )}
    </g>
  );
}

export default function TreemapChart({ data, height = 300, dataKey = 'size' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap data={data} dataKey={dataKey} aspectRatio={4 / 3} stroke="hsl(var(--background))" content={<Cell />} isAnimationActive={false}>
        <Tooltip />
      </Treemap>
    </ResponsiveContainer>
  );
}