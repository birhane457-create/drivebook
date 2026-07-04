import PageHeader from '@/components/shared/PageHeader';
import SectionCard from '@/components/shared/SectionCard';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

export default function ExecutiveLayout({ title, subtitle, actions, kpis = [], children, modules = [], className }) {
  return (
    <div className={className}>
      <PageHeader title={title} subtitle={subtitle}>{actions}</PageHeader>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {kpis.map((k, i) => <StatCard key={i} {...k} />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">{children}</div>
      {modules.length > 0 && (
        <SectionCard title="Module Health" description="Operational status across the platform" icon={Activity}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {modules.map((m) => (
              <div key={m.name} className={cn('rounded-lg border p-4 flex items-center justify-between', m.status === 'critical' && 'border-destructive/40 bg-destructive/5')}>
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.metric}</p>
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}