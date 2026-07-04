import WorkflowScreen from '@/components/workflow/WorkflowScreen';

const stages = [
  { key: 'scheduled', label: 'Scheduled', color: 'hsl(var(--muted-foreground))' },
  { key: 'sampling', label: 'Sampling', color: 'hsl(var(--chart-4))' },
  { key: 'testing', label: 'Testing', color: 'hsl(var(--chart-2))' },
  { key: 'review', label: 'Review', color: 'hsl(var(--chart-3))' },
  { key: 'approved', label: 'Approved', color: 'hsl(var(--chart-1))' },
];

const items = [
  { id: 'q1', stage: 'scheduled', title: 'Lot 9921 · Incoming', subtitle: 'AQL 1.0 · 500 units', assignee: 'QC-1', due: 'Today', priority: 'high', meta: { supplier: 'Acme', sample_size: 50, spec: 'IPC-A-610' } },
  { id: 'q2', stage: 'sampling', title: 'Lot 9918 · In-process', subtitle: 'Drawing samples', assignee: 'QC-2', due: '14:00', priority: 'medium', meta: { line: 'Line 1', sample_size: 32, spec: 'ISO 2859' } },
  { id: 'q3', stage: 'testing', title: 'Lot 9915 · Final', subtitle: 'Functional + visual', assignee: 'QC-3', due: 'Now', priority: 'high', meta: { line: 'Line 2', sample_size: 25, spec: 'Internal' } },
  { id: 'q4', stage: 'review', title: 'Lot 9910 · Finished', subtitle: '2 minor defects', assignee: 'QA Lead', due: '13:30', priority: 'medium', meta: { line: 'Line 1', sample_size: 50, spec: 'IPC-A-610' } },
  { id: 'q5', stage: 'approved', title: 'Lot 9905 · Released', subtitle: 'Passed · 0 critical', assignee: 'QA Lead', due: 'Closed', priority: 'low', meta: { line: 'Line 2', sample_size: 40, spec: 'ISO 2859' } },
];

export default function InspectionWorkflow() {
  return (
    <WorkflowScreen
      title="Inspection Workflow"
      subtitle="Quality inspections from schedule to release"
      stages={stages}
      items={items}
      actionLabel="Approve"
      onAdvance={() => {}}
    />
  );
}