import { Sankey, Tooltip, ResponsiveContainer } from 'recharts';

export default function SankeyChart({ data, height = 300, nodeWidth = 12, nodePadding = 20 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={data}
        nodeWidth={nodeWidth}
        nodePadding={nodePadding}
        link={{ stroke: 'hsl(var(--muted-foreground) / 0.25)' }}
        node={{ stroke: 'hsl(var(--primary))', fill: 'hsl(var(--primary) / 0.5)' }}
      >
        <Tooltip />
      </Sankey>
    </ResponsiveContainer>
  );
}