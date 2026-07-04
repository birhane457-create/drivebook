import { FunnelChart as RechartsFunnelChart, Funnel, LabelList, Tooltip, ResponsiveContainer } from 'recharts';

export default function FunnelChart({ data, height = 300, dataKey = 'value' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsFunnelChart>
        <Tooltip />
        <Funnel data={data} dataKey={dataKey} isAnimationActive>
          <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" fontSize={12} />
        </Funnel>
      </RechartsFunnelChart>
    </ResponsiveContainer>
  );
}