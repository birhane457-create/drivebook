import WorkflowScreen from '@/components/workflow/WorkflowScreen';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const stages = [
  { key: 'picked', label: 'Picked', color: 'hsl(var(--chart-2))' },
  { key: 'packed', label: 'Packed', color: 'hsl(var(--chart-4))' },
  { key: 'labeled', label: 'Labeled', color: 'hsl(var(--chart-3))' },
  { key: 'dispatched', label: 'Dispatched', color: 'hsl(var(--chart-1))' },
  { key: 'delivered', label: 'Delivered', color: 'hsl(var(--chart-3))' },
];

const items = [
  { id: 's1', stage: 'picked', title: 'SO-8821 · Perth', subtitle: '12 lines · 48 units', assignee: 'Picker B', due: 'Today 15:00', priority: 'high', meta: { customer: 'Retail Co', carrier: 'StarTrack', value: '$3,420' } },
  { id: 's2', stage: 'packed', title: 'SO-8820 · Sydney', subtitle: '4 cartons', assignee: 'Packer A', due: 'Today', priority: 'medium', meta: { customer: 'Globex', carrier: 'Toll', value: '$1,180' } },
  { id: 's3', stage: 'labeled', title: 'SO-8815 · Brisbane', subtitle: 'Awaiting carrier scan', assignee: 'Labeling', due: '14:30', priority: 'medium', meta: { customer: 'Initech', carrier: 'DHL', value: '$2,640' } },
  { id: 's4', stage: 'dispatched', title: 'SO-8809 · Melbourne', subtitle: 'Tracking 1Z·993', assignee: 'StarTrack', due: 'ETA Jul 5', priority: 'low', meta: { customer: 'Hooli', carrier: 'StarTrack', value: '$8,900' } },
  { id: 's5', stage: 'delivered', title: 'SO-8801 · Adelaide', subtitle: 'Signed by R. Patel', assignee: 'Toll', due: 'Delivered', priority: 'low', meta: { customer: 'Acme', carrier: 'Toll', value: '$4,210' } },
];

export default function ShippingWorkflow() {
  return (
    <WorkflowScreen
      title="Shipping Workflow"
      subtitle="Outbound orders from pick to delivery"
      stages={stages}
      items={items}
      actionLabel="Ship next"
      onAdvance={() => {}}
      filters={<Button size="sm"><Plus className="w-4 h-4 mr-1" /> New shipment</Button>}
    />
  );
}