import WorkflowScreen from '@/components/workflow/WorkflowScreen';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const stages = [
  { key: 'scheduled', label: 'Scheduled', color: 'hsl(var(--muted-foreground))' },
  { key: 'in_transit', label: 'In Transit', color: 'hsl(var(--chart-2))' },
  { key: 'docked', label: 'Docked', color: 'hsl(var(--chart-4))' },
  { key: 'inspected', label: 'Inspected', color: 'hsl(var(--chart-3))' },
  { key: 'put_away', label: 'Put Away', color: 'hsl(var(--chart-1))' },
];

const items = [
  { id: 'r1', stage: 'scheduled', title: 'PO-2041 · Acme', subtitle: '120 cartons · 3 pallets', assignee: 'Dock 3', due: 'Today 14:00', priority: 'high', meta: { supplier: 'Acme Supplies', value: '$48,200', expected: 'Jul 5' } },
  { id: 'r2', stage: 'in_transit', title: 'PO-2050 · Globex', subtitle: '80 cartons', assignee: 'Carrier FMG', due: 'Jul 6', priority: 'medium', meta: { supplier: 'Globex', value: '$22,400', expected: 'Jul 6' } },
  { id: 'r3', stage: 'docked', title: 'PO-2038 · Initech', subtitle: '24 cartons', assignee: 'Dock 1', due: 'Now', priority: 'high', meta: { supplier: 'Initech', value: '$7,800', expected: 'Jul 4' } },
  { id: 'r4', stage: 'inspected', title: 'PO-2031 · Hooli', subtitle: '200 cartons · passed', assignee: 'QC Team', due: 'Today', priority: 'low', meta: { supplier: 'Hooli', value: '$61,000', expected: 'Jul 3' } },
  { id: 'r5', stage: 'put_away', title: 'PO-2025 · Acme', subtitle: 'Bin A14 · complete', assignee: 'WMS', due: 'Done', priority: 'low', meta: { supplier: 'Acme Supplies', value: '$18,400', expected: 'Jul 2' } },
];

export default function ReceivingWorkflow() {
  return (
    <WorkflowScreen
      title="Receiving Workflow"
      subtitle="Inbound shipments from dock to shelf"
      stages={stages}
      items={items}
      actionLabel="Receive next"
      onAdvance={() => {}}
      filters={<Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" /> Export</Button>}
    />
  );
}