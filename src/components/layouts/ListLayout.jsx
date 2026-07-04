import PageHeader from '@/components/shared/PageHeader';
import FilterBar from '@/components/shared/FilterBar';

export default function ListLayout({ title, subtitle, actions, searchValue, onSearch, searchPlaceholder, filters, toolbar, children, className }) {
  return (
    <div className={className}>
      <PageHeader title={title} subtitle={subtitle}>{actions}</PageHeader>
      <FilterBar
        searchValue={searchValue}
        onSearchChange={onSearch}
        searchPlaceholder={searchPlaceholder}
        filters={filters}
        className="mb-4"
      >
        {toolbar}
      </FilterBar>
      {children}
    </div>
  );
}