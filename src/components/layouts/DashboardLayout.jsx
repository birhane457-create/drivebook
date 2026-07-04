import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';

export default function DashboardLayout({ title, subtitle, actions, stats, children, className }) {
  return (
    <div className={className}>
      <PageHeader title={title} subtitle={subtitle}>{actions}</PageHeader>
      {stats?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      )}
      <div className="grid gap-4">{children}</div>
    </div>
  );
}