import { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';

export default function AdministrationLayout({ title = 'Administration', subtitle = 'Manage platform configuration', sections = [], className }) {
  const [active, setActive] = useState(sections[0]?.id);
  const current = sections.find((s) => s.id === active);

  return (
    <div className={className}>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="grid lg:grid-cols-4 gap-6">
        <nav className="space-y-1 lg:sticky lg:top-4 self-start">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setActive(s.id)} className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors', active === s.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50 text-foreground')}>
              {s.icon && <s.icon className="w-4 h-4 flex-shrink-0" />}
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="lg:col-span-3">{current?.content}</div>
      </div>
    </div>
  );
}