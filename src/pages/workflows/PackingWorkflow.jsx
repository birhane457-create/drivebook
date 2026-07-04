import WorkflowScreen from '@/components/workflow/WorkflowScreen';

const stages = [
  { key: 'picked', label: 'Picked', color: 'hsl(var(--chart-2))' },
  { key: 'packing', label: 'Packing', color: 'hsl(var(--chart-4))' },
  { key: 'packed', label: 'Packed', color: 'hsl(var(--chart-3))' },
  { key: 'sealed', label: 'Sealed', color: 'hsl(var(--chart-1))' },
  { key: 'staged', label: 'Staged', color: 'hsl(var(--chart-3))' },
];

const items = [
  { id: 'pa1', stage: 'picked', title: 'Cart 14 · 8 orders', subtitle: 'Awaiting pack station', assignee: 'Station 1', due: '14:00', priority: 'high', meta: { station: '1', cartons: 8, weight: '12kg' } },
  { id: 'pa2', stage: 'packing', title: 'Cart 13 · 4 orders', subtitle: 'Packing in progress', assignee: 'Packer A', due: 'Now', priority: 'medium', meta: { station: '2', cartons: 4, weight: '6kg' } },
  { id: 'pa3', stage: 'packed', title: 'Cart 12 · 6 orders', subtitle: 'Awaiting seal', assignee: 'Packer B', due: '13:30', priority: 'medium', meta: { station: '2', cartons: 6, weight: '9kg' } },
  { id: 'pa4', stage: 'sealed', title: 'Cart 11 · 10 orders', subtitle: 'Labels applied', assignee: 'Labeling', due: 'Done', priority: 'low', meta: { station: '3', cartons: 10, weight: '18kg' } },
  { id: 'pa5', stage: 'staged', title: 'Cart 10 · 14 orders', subtitle: 'At bay 2', assignee: 'Staging', due: 'Closed', priority: 'low', meta: { station: '3', cartons: 14, weight: '24kg' } },
];

export default function PackingWorkflow() {
  return (
    <WorkflowScreen
      title="Packing Workflow"
      subtitle="Orders from pick cart to staging bay"
      stages={stages}
      items={items}
      actionLabel="Pack next"
      onAdvance={() => {}}
    />
  );
}