import WorkflowScreen from '@/components/workflow/WorkflowScreen';

const stages = [
  { key: 'requested', label: 'Requested', color: 'hsl(var(--muted-foreground))' },
  { key: 'approved', label: 'Approved', color: 'hsl(var(--chart-4))' },
  { key: 'received', label: 'Received', color: 'hsl(var(--chart-2))' },
  { key: 'inspected', label: 'Inspected', color: 'hsl(var(--chart-3))' },
  { key: 'refunded', label: 'Refunded', color: 'hsl(var(--chart-1))' },
];

const items = [
  { id: 'rt1', stage: 'requested', title: 'RMA-412 · Damaged item', subtitle: '2 units · Electronics', assignee: 'J. Lee', due: 'Today', priority: 'high', meta: { order: 'SO-8801', reason: 'Damaged', value: '$420' } },
  { id: 'rt2', stage: 'approved', title: 'RMA-410 · Wrong size', subtitle: '1 unit', assignee: 'CS Team', due: 'Jul 6', priority: 'medium', meta: { order: 'SO-8795', reason: 'Wrong size', value: '$120' } },
  { id: 'rt3', stage: 'received', title: 'RMA-408 · Defective', subtitle: '5 units · awaiting QC', assignee: 'QC', due: 'Today', priority: 'medium', meta: { order: 'SO-8790', reason: 'Defective', value: '$980' } },
  { id: 'rt4', stage: 'inspected', title: 'RMA-405 · Restockable', subtitle: '3 units passed', assignee: 'QC', due: 'Done', priority: 'low', meta: { order: 'SO-8782', reason: 'Changed mind', value: '$210' } },
  { id: 'rt5', stage: 'refunded', title: 'RMA-401 · Refunded', subtitle: '$640 credited', assignee: 'Finance', due: 'Closed', priority: 'low', meta: { order: 'SO-8770', reason: 'Damaged', value: '$640' } },
];

export default function ReturnsWorkflow() {
  return (
    <WorkflowScreen
      title="Returns Workflow"
      subtitle="Reverse logistics from request to refund"
      stages={stages}
      items={items}
      actionLabel="Process next"
      onAdvance={() => {}}
    />
  );
}