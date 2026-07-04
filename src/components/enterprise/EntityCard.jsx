import { cn } from '@/lib/utils';
import StatusBadge from '@/components/shared/StatusBadge';
import { MoreHorizontal } from 'lucide-react';

const fallbackImg = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop';

export default function EntityCard({
  title,
  subtitle,
  image,
  icon: Icon,
  status,
  metadata = [],
  description,
  actions,
  onClick,
  selected,
  className,
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-xl border bg-card p-4 transition-all hover:shadow-md',
        onClick && 'cursor-pointer',
        selected && 'ring-2 ring-primary border-primary',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {image ? (
          <img src={image || fallbackImg} alt={title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        ) : Icon ? (
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6" />
          </div>
        ) : null}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{title}</p>
              {subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {status && <StatusBadge status={status} />}
              {actions && <div className="opacity-0 group-hover:opacity-100 transition-opacity">{actions}</div>}
            </div>
          </div>

          {description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{description}</p>}

          {metadata.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3">
              {metadata.map((m) => (
                <div key={m.label} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</dt>
                  <dd className="text-xs font-medium truncate">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}