import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function MobileLayout({ title = 'WMS Mobile', nav = [], children, className }) {
  const [active, setActive] = useState(nav[0]?.id);
  return (
    <div className={cn('mx-auto max-w-[400px] rounded-[2rem] border-4 border-foreground/80 bg-background overflow-hidden shadow-xl', className)} style={{ height: 700 }}>
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <div className="w-8 h-8 rounded-full bg-primary-foreground/20" />
      </div>
      <div className="overflow-auto p-4 bg-muted/20" style={{ height: 'calc(100% - 112px)' }}>
        {children}
      </div>
      <div className="border-t border-border bg-card flex">
        {nav.map((n) => (
          <button key={n.id} onClick={() => setActive(n.id)} className={cn('flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium', active === n.id ? 'text-primary' : 'text-muted-foreground')}>
            {n.icon && <n.icon className="w-5 h-5" />}
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}