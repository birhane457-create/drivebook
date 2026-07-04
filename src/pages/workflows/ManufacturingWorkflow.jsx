import WorkflowScreen from '@/components/workflow/WorkflowScreen';

const stages = [
  { key: 'planned', label: 'Planned', color: 'hsl(var(--muted-foreground))' },
  { key: 'released', label: 'Released', color: 'hsl(var(--chart-4))' },
  { key: 'in_progress', label: 'In Progress', color: 'hsl(var(--chart-2))' },
  { key: 'qa', label: 'QA', color: 'hsl(var(--chart-3))' },
  { key: 'completed', label: 'Completed', color: 'hsl(var(--chart-1))' },
];

const items = [
  { id: 'm1', stage: 'planned', title: 'MO-3001 · Widget A', subtitle: '1,200 units · Line 1', assignee: 'Planner', due: 'Jul 6', priority: 'medium', meta: { bom: 'BOM-12', duration: '8h', material: 'OK' } },
  { id: 'm2', stage: 'released', title: 'MO-3000 · Widget B', subtitle: '800 units · Line 2', assignee: 'Supervisor', due: 'Today', priority: 'high', meta: { bom: 'BOM-18', duration: '6h', material: 'OK' } },
  { id: 'm3', stage: 'in_progress', title: 'MO-2998 · Widget C', subtitle: '520 / 1,000 done', assignee: 'Line 1', due: 'Now', priority: 'high', meta: { bom: 'BOM-24', duration: '10h', material: 'Low' } },
  { id: 'm4', stage: 'qa', title: 'MO-2995 · Widget A', subtitle: 'Sampling 5%', assignee: 'QA', due: '13:00', priority: 'medium', meta: { bom: 'BOM-12', duration: '8h', material: 'OK' } },
  { id: 'm5', stage: 'completed', title: 'MO-2990 · Widget D', subtitle: '1,500 units done', assignee: 'Line 2', due: 'Closed', priority: 'low', meta: { bom: 'BOM-31', duration: '12h', material: 'OK' } },
];

export default function ManufacturingWorkflow() {
  return (
    <WorkflowScreen
      title="Manufacturing Workflow"
      subtitle="Production orders from plan to completion"
      stages={stages}
      items={items}
      actionLabel="Advance order"
      onAdvance={() => {}}
    />
  );
}