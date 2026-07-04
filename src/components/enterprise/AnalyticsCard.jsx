import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ResponsiveContainer, Area, AreaChart, Tooltip, YAxis } from 'recharts';

export default function AnalyticsCard({
  title,
  value,
  unit,
  trend, // 'up' | 'down' | 'flat'
  trendValue,
  sparkline = [],
  icon: Icon,
  className,
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';
  const sparkColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : 'hsl(var(--primary))';

  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4 h-4" /></div>}
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tracking-tight">
            {value}
            {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
          </p>
          {trendValue && (
            <div className={cn('flex items-center gap-1 text-xs font-medium mt-1', trendColor)}>
              <TrendIcon className="w-3 h-3" />
              {trendValue}
            </div>
          )}
        </div>
        {sparkline.length > 1 && (
          <div className="w-24 h-12 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <Tooltip
                  contentStyle={{ fontSize: '11px', padding: '4px 8px', borderRadius: 6, border: 'none' }}
                  formatter={(v) => [v, title]}
                />
                <Area type="monotone" dataKey="value" stroke={sparkColor} strokeWidth={1.5} fill={`url(#spark-${title})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}