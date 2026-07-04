import PageHeader from '@/components/shared/PageHeader';
import MasterDetail from '@/components/enterprise/MasterDetail';

export default function MasterDetailLayout({ title, subtitle, items, renderDetail, className }) {
  return (
    <div className={className}>
      <PageHeader title={title} subtitle={subtitle} />
      <MasterDetail items={items} renderDetail={renderDetail} />
    </div>
  );
}