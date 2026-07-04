import PageHeader from '@/components/shared/PageHeader';
import FilterBar from '@/components/shared/FilterBar';
import StatCard from '@/components/shared/StatCard';

export default function AnalyticsLayout({ title, subtitle, actions, searchValue, onSearch, searchPlaceholder, filters, kpis = [], children, className }) {
  return (
    <div className={className}>
      <PageHeader title={title} subtitle={subtitle}>{actions}</PageHeader>
      <FilterBar searchValue={searchValue} onSearchChange={onSearch} searchPlaceholder={searchPlaceholder} filters={filters} className="mb-6" />
      {kpis.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((k, i) => <StatCard key={i} {...k} />)}
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-6">{children}</div>
    </div>
  );
}