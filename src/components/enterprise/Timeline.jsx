import { cn } from '@/lib/utils';
import StatusBadge from '@/components/shared/StatusBadge';

const STATUS_COLOR = {
  success: 'bg-emerald-500',
  info: 'bg-primary',
  warning: 'bg-amber-500',
  danger: 'bg-destructive',
  default: 'bg-muted-foreground',
};

export default function Timeline({ items = [], className }) {
  return (
    <div className={cn('relative', className)}>
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
      <ol className="space-y-5">
        {items.map((item) => {
          const dot = STATUS_COLOR[item.status] || STATUS_COLOR.default;
          const Icon = item.icon;
          return (
            <li key={item.id} className="relative pl-10">
              <div className={cn('absolute left-0 top-0 w-8 h-8 rounded-full ring-4 ring-background flex items-center justify-center text-white', dot)}>
                {Icon ? <Icon className="w-4 h-4" /> : <span className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.badge && <StatusBadge status={item.badge} />}
                </div>
                {item.subtitle && <p className="text-sm text-muted-foreground">{item.subtitle}</p>}
                {item.time && <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}