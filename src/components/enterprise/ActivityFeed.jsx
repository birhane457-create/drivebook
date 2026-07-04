import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function ActivityFeed({ activities = [], className }) {
  return (
    <div className={cn('rounded-xl border bg-card', className)}>
      <div className="divide-y divide-border">
        {activities.map((a) => {
          const Icon = a.icon;
          return (
            <div key={a.id} className="flex items-start gap-3 px-4 py-3">
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white', a.color || 'bg-primary')}>
                {Icon ? <Icon className="w-4 h-4" /> : <span className="text-xs font-semibold">{a.user?.charAt(0)}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{a.user}</span>{' '}
                  <span className="text-muted-foreground">{a.action}</span>{' '}
                  {a.target && <span className="font-medium">{a.target}</span>}
                </p>
                {a.detail && <p className="text-xs text-muted-foreground mt-0.5">{a.detail}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">{a.time ? formatDistanceToNow(new Date(a.time), { addSuffix: true }) : ''}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}