import SectionCard from '@/components/shared/SectionCard';
import EntityCard from '@/components/enterprise/EntityCard';
import AnalyticsCard from '@/components/enterprise/AnalyticsCard';
import ApprovalTimeline from '@/components/enterprise/ApprovalTimeline';
import FilterBuilder from '@/components/enterprise/FilterBuilder';
import QueryBuilder from '@/components/enterprise/QueryBuilder';
import DynamicFormBuilder from '@/components/enterprise/DynamicFormBuilder';
import { Package, User, ShoppingCart, DollarSign } from 'lucide-react';

const sparkline = [
  { value: 12 }, { value: 19 }, { value: 15 }, { value: 22 }, { value: 28 }, { value: 24 }, { value: 35 },
];

const approvalSteps = [
  { approverName: 'Sarah Chen', role: 'Department Manager', status: 'approved', timestamp: 'Jul 1, 9:32 AM', comment: 'Looks good, approved.' },
  { approverName: 'Mike Ross', role: 'Finance Director', status: 'approved', timestamp: 'Jul 2, 2:15 PM', comment: 'Budget confirmed.' },
  { approverName: 'Lisa Park', role: 'VP Operations', status: 'pending', comment: 'Awaiting review' },
  { approverName: 'James Wu', role: 'CFO', status: 'pending' },
];

const filterFields = [
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
  { value: 'price', label: 'Price' },
  { value: 'stock', label: 'Stock Level' },
  { value: 'status', label: 'Status' },
];

const queryFields = [
  { value: 'product_name', label: 'Product Name' },
  { value: 'sku', label: 'SKU' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'price', label: 'Price' },
  { value: 'category', label: 'Category' },
];

export default function EnterpriseLibraryShowcase() {
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <EntityCard
          title="Wireless Headphones Pro"
          subtitle="SKU: WH-2024"
          icon={Package}
          status="active"
          description="Noise-cancelling over-ear headphones with 30hr battery life."
          metadata={[{ label: 'Stock', value: '142' }, { label: 'Price', value: '$299' }]}
        />
        <EntityCard
          title="Jane Cooper"
          subtitle="jane.cooper@email.com"
          icon={User}
          status="active"
          metadata={[{ label: 'Orders', value: '28' }, { label: 'Loyalty', value: '1,240 pts' }]}
        />
        <EntityCard
          title="Order #4821"
          subtitle="Placed 2 hours ago"
          icon={ShoppingCart}
          status="pending"
          metadata={[{ label: 'Items', value: '5' }, { label: 'Total', value: '$458.00' }]}
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsCard title="Monthly Revenue" value="$48.2k" trend="up" trendValue="+12.4%" sparkline={sparkline} icon={DollarSign} />
        <AnalyticsCard title="Active Orders" value="1,284" trend="down" trendValue="-3.2%" sparkline={sparkline} icon={ShoppingCart} />
        <AnalyticsCard title="New Customers" value="342" trend="up" trendValue="+8.1%" sparkline={sparkline} icon={User} />
        <AnalyticsCard title="Avg. Order Value" value="$128" trend="flat" trendValue="0.0%" sparkline={sparkline} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Approval Timeline" description="Multi-step approval chain with status states">
          <ApprovalTimeline steps={approvalSteps} />
        </SectionCard>
        <SectionCard title="Filter Builder" description="Build AND-condition filters with field/operator/value">
          <FilterBuilder fields={filterFields} />
        </SectionCard>
      </div>

      <SectionCard title="Query Builder" description="Nested AND/OR condition groups for advanced queries">
        <QueryBuilder
          fields={queryFields}
          value={{ id: 'root', logic: 'AND', rules: [
            { id: '1', type: 'condition', field: 'quantity', op: 'lt', value: '10' },
            { id: '2', type: 'condition', field: 'category', op: 'equals', value: 'Electronics' },
            { id: 'g1', type: 'group', logic: 'OR', rules: [
              { id: '3', type: 'condition', field: 'price', op: 'gt', value: '100' },
              { id: '4', type: 'condition', field: 'sku', op: 'contains', value: 'PRO' },
            ] },
          ] }}
        />
      </SectionCard>

      <SectionCard title="Dynamic Form Builder" description="Drag-free schema editor with live preview">
        <DynamicFormBuilder
          schema={[
            { name: 'full_name', label: 'Full Name', type: 'text', placeholder: 'John Doe', required: true },
            { name: 'email', label: 'Email Address', type: 'email', placeholder: 'john@example.com', required: true },
            { name: 'role', label: 'Role', type: 'select', options: ['Admin', 'Manager', 'Staff'], required: false },
            { name: 'active', label: 'Active Account', type: 'boolean', required: false },
          ]}
        />
      </SectionCard>
    </div>
  );
}