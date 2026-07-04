import WorkflowScreen from '@/components/workflow/WorkflowScreen';

const stages = [
  { key: 'released', label: 'Released', color: 'hsl(var(--muted-foreground))' },
  { key: 'assigned', label: 'Assigned', color: 'hsl(var(--chart-4))' },
  { key: 'in_progress', label: 'In Progress', color: 'hsl(var(--chart-2))' },
  { key: 'picked', label: 'Picked', color: 'hsl(var(--chart-3))' },
  { key: 'verified', label: 'Verified', color: 'hsl(var(--chart-1))' },
];

const items = [
  { id: 'pk1', stage: 'released', title: 'Wave 42 · 28 lines', subtitle: 'Batch pick route', assignee: 'Unassigned', due: '15:00', priority: 'high', meta: { zone: 'A', units: 96, type: 'Batch' } },
  { id: 'pk2', stage: 'assigned', title: 'Wave 41 · 18 lines', subtitle: 'Single order', assignee: 'Picker A', due: '14:30', priority: 'medium', meta: { zone: 'B', units: 48, type: 'Single' } },
  { id: 'pk3', stage: 'in_progress', title: 'Wave 40 · 60 lines', subtitle: 'Cluster pick', assignee: 'Picker C', due: 'Now', priority: 'high', meta: { zone: 'C', units: 140, type: 'Cluster' } },
  { id: 'pk4', stage: 'picked', title: 'Wave 39 · 12 lines', subtitle: 'Awaiting verify', assignee: 'Picker B', due: 'Done', priority: 'low', meta: { zone: 'A', units: 24, type: 'Batch' } },
  { id: 'pk5', stage: 'verified', title: 'Wave 38 · 40 lines', subtitle: 'Complete', assignee: 'Lead', due: 'Closed', priority: 'low', meta: { zone: 'D', units: 80, type: 'Batch' } },
];

export default function PickingWorkflow() {
  return (
    <WorkflowScreen
      title="Picking Workflow"
      subtitle="Warehouse pick waves from release to verification"
      stages={stages}
      items={items}
      actionLabel="Pick next"
      onAdvance={() => {}}
    />
  );
}