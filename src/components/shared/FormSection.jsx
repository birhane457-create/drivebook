import { cn } from '@/lib/utils';

const colClass = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

export default function FormSection({ title, description, icon: Icon, children, columns = 1, className }) {
  return (
    <div className="rounded-xl border bg-card">
      {(title || description) && (
        <div className="flex items-start gap-3 px-5 py-4 border-b">
          {Icon && (
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          )}
          <div>
            {title && <h3 className="font-semibold">{title}</h3>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
      )}
      <div className={cn("p-5 gap-4", colClass[columns] || '', columns > 1 ? 'grid' : 'space-y-4', className)}>
        {children}
      </div>
    </div>
  );
}