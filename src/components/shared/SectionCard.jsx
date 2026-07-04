import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function SectionCard({ title, description, icon: Icon, actions, children, className, contentClassName }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              {title && <h3 className="text-sm font-semibold tracking-tight truncate">{title}</h3>}
              {description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </Card>
  );
}