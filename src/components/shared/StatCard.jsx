import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, icon: Icon, trend, trendUp, className }) {
  return (
    <Card className={cn("p-5 relative overflow-hidden group card-hover", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium tracking-wide">{title}</p>
          <p className="text-[26px] font-semibold mt-1 tracking-tight leading-none">{value}</p>
          {trend && (
            <p className={cn("text-xs mt-2.5 font-semibold tracking-tight flex items-center gap-1", trendUp ? "text-emerald-600" : "text-red-500")}>
              {trend}
            </p>
          )}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/5">
            <Icon className="w-[18px] h-[18px] text-primary" />
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/30 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </Card>
  );
}