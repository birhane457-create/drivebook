import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

const accents = {
  primary: 'text-primary bg-primary/10',
  emerald: 'text-emerald-600 bg-emerald-500/10',
  amber: 'text-amber-600 bg-amber-500/10',
  red: 'text-red-600 bg-red-500/10',
  blue: 'text-blue-600 bg-blue-500/10',
  purple: 'text-purple-600 bg-purple-500/10',
};

export default function WidgetCard({ title, value, unit, icon: Icon, accent = 'primary', trend, trendUp, subtitle, children, footer, className }) {
  return (
    <Card className={cn('p-4 relative overflow-hidden hover:shadow-md transition-shadow', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight">{value}</span>
            {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {Icon && <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', accents[accent])}><Icon className="w-4 h-4" /></div>}
      </div>
      {trend && (
        <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trendUp ? 'text-emerald-600' : 'text-red-600')}>
          {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend}
        </div>
      )}
      {children && <div className="mt-3">{children}</div>}
      {footer && <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground">{footer}</div>}
    </Card>
  );
}