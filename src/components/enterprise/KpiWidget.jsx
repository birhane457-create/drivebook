import { cn } from '@/lib/utils';
import { ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KpiWidget({ title, value, unit, target, trend, trendUp = true, spark = [], className }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : null;
  return (
    <div className={cn('rounded-xl border bg-card p-4 flex flex-col gap-3', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight mt-1">
            {value}{unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
          </p>
        </div>
        {typeof trend === 'number' || typeof trend === 'string' ? (
          <span className={cn('inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1', trendUp ? 'text-emerald-600 bg-emerald-500/10' : 'text-destructive bg-destructive/10')}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend}
          </span>
        ) : null}
      </div>
      {spark.length > 1 && (
        <div className="-mb-1">
          <ResponsiveContainer width="100%" height={48}>
            <AreaChart data={spark}>
              <Area type="monotone" dataKey="y" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1) / 0.12)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {pct !== null && (
        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>{pct}% of target</span>
            <span>{unit}{target}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}