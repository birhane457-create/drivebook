import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import WorkflowStepper from '@/components/shared/WorkflowStepper';
import { FileText, PackageCheck, Search, Warehouse as WarehouseIcon, CheckCircle2, ChevronRight, RotateCcw } from 'lucide-react';

const FLOW = [
  { key: 'po', title: 'Purchase Order', icon: FileText, description: 'PO received from supplier' },
  { key: 'receive', title: 'Receive', icon: PackageCheck, description: 'Goods arrive at dock' },
  { key: 'inspect', title: 'Inspect', icon: Search, description: 'Quality & quantity check' },
  { key: 'putaway', title: 'Putaway', icon: WarehouseIcon, description: 'Move to bin location' },
  { key: 'complete', title: 'Complete', icon: CheckCircle2, description: 'Stock available' },
];

const STEP_PANELS = {
  po: {
    title: 'Purchase Order #PO-2041',
    detail: 'Supplier: Acme Distributors · 12 line items · Expected today',
    hint: 'Review the PO before goods arrive so the dock team knows what to expect.',
  },
  receive: {
    title: 'Receive goods',
    detail: 'Scan ASN / delivery note, confirm line quantities against the PO.',
    hint: 'Receiving against the PO keeps your inventory accurate and triggers 3-way matching.',
  },
  inspect: {
    title: 'Inspect for quality',
    detail: 'Check for damage, expiry, and conformance. Quarantine failures.',
    hint: 'Catching defects here prevents bad stock reaching customers and shelves.',
  },
  putaway: {
    title: 'Putaway to bin',
    detail: 'System suggests the optimal bin. Scan license plate to confirm.',
    hint: 'Directed putaway maximises space and makes picking faster later.',
  },
  complete: {
    title: 'Receipt complete',
    detail: 'Stock is now available across all channels. Inventory log updated.',
    hint: 'You can now fulfil orders and the supplier scorecard is updated automatically.',
  },
};

export default function ReceivingWorkflowDemo() {
  const [current, setCurrent] = useState(0);
  const isLast = current === FLOW.length - 1;
  const panel = STEP_PANELS[FLOW[current].key];
  const CurrentIcon = FLOW[current].icon;

  return (
    <div className="space-y-6">
      <WorkflowStepper steps={FLOW} currentStep={current} orientation="horizontal" />

      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        <div className="md:border-r md:pr-6">
          <WorkflowStepper steps={FLOW} currentStep={current} orientation="vertical" />
        </div>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
              <CurrentIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold">{panel.title}</h4>
              <p className="text-sm text-muted-foreground mt-1">{panel.detail}</p>
              <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded-lg px-3 py-2">
                <span className="font-medium text-foreground">Why: </span>{panel.hint}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setCurrent(0)} disabled={current === 0}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
            </Button>
            <Button size="sm" onClick={() => !isLast && setCurrent(c => c + 1)} disabled={isLast}>
              {isLast ? 'Done' : 'Advance step'} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}