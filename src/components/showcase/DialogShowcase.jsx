import { useState } from 'react';
import { Input } from '@/components/ui/input';
import Field from '@/components/shared/Field';
import CreateDialog from '@/components/dialogs/CreateDialog';
import EditDialog from '@/components/dialogs/EditDialog';
import ApprovalDialog from '@/components/dialogs/ApprovalDialog';
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog';
import BulkEditDialog from '@/components/dialogs/BulkEditDialog';
import ImportWizard from '@/components/dialogs/ImportWizard';
import ExportWizard from '@/components/dialogs/ExportWizard';
import MergeWizard from '@/components/dialogs/MergeWizard';
import DuplicateWizard from '@/components/dialogs/DuplicateWizard';
import ArchiveWizard from '@/components/dialogs/ArchiveWizard';
import DeleteWizard from '@/components/dialogs/DeleteWizard';
import { Plus, Pencil, CheckCircle2, AlertTriangle, Upload, Download, GitMerge, Copy, Archive, Trash2, Edit3 } from 'lucide-react';

const DIALOGS = [
  { key: 'create', label: 'Create Dialog', icon: Plus },
  { key: 'edit', label: 'Edit Dialog', icon: Pencil },
  { key: 'approval', label: 'Approval Dialog', icon: CheckCircle2 },
  { key: 'confirmation', label: 'Confirmation Dialog', icon: AlertTriangle },
  { key: 'import', label: 'Import Wizard', icon: Upload },
  { key: 'export', label: 'Export Wizard', icon: Download },
  { key: 'merge', label: 'Merge Wizard', icon: GitMerge },
  { key: 'duplicate', label: 'Duplicate Wizard', icon: Copy },
  { key: 'archive', label: 'Archive Wizard', icon: Archive },
  { key: 'delete', label: 'Delete Wizard', icon: Trash2 },
  { key: 'bulk', label: 'Bulk Edit Dialog', icon: Edit3 },
];

export default function DialogShowcase() {
  const [open, setOpen] = useState(null);
  const close = () => setOpen(null);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {DIALOGS.map((d) => (
          <button
            key={d.key}
            onClick={() => setOpen(d.key)}
            className="rounded-lg border bg-card p-3 text-left hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <d.icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs font-medium">{d.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Click to open</p>
          </button>
        ))}
      </div>

      <CreateDialog open={open === 'create'} onOpenChange={close} onSubmit={close}>
        <div className="space-y-4">
          <Field label="Name" htmlFor="cr-name" required><Input id="cr-name" placeholder="Product name" /></Field>
          <Field label="SKU" htmlFor="cr-sku" required><Input id="cr-sku" placeholder="WM-001" /></Field>
          <Field label="Selling Price" htmlFor="cr-price"><Input id="cr-price" type="number" placeholder="24.99" /></Field>
        </div>
      </CreateDialog>

      <EditDialog open={open === 'edit'} onOpenChange={close} onSubmit={close}>
        <div className="space-y-4">
          <Field label="Name" htmlFor="ed-name"><Input id="ed-name" defaultValue="Wireless Mouse" /></Field>
          <Field label="SKU" htmlFor="ed-sku"><Input id="ed-sku" defaultValue="WM-001" /></Field>
          <Field label="Stock on hand" htmlFor="ed-stock"><Input id="ed-stock" type="number" defaultValue="48" /></Field>
        </div>
      </EditDialog>

      <ApprovalDialog
        open={open === 'approval'}
        onOpenChange={close}
        title="Approve PO-2041"
        recordSummary={<><div className="flex justify-between"><span className="text-muted-foreground">Supplier</span><span className="font-medium">Acme Supplies</span></div><div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium font-mono">$48,200</span></div><div className="flex justify-between"><span className="text-muted-foreground">Requested by</span><span className="font-medium">James Lee</span></div></>}
        onApprove={close}
        onReject={close}
      />

      <ConfirmationDialog
        open={open === 'confirmation'}
        onOpenChange={close}
        variant="danger"
        title="Delete this product?"
        description="This will permanently remove the record and cannot be undone."
        confirmLabel="Delete"
        onConfirm={close}
      />

      <ImportWizard open={open === 'import'} onOpenChange={close} onComplete={() => {}} />
      <ExportWizard open={open === 'export'} onOpenChange={close} selectedCount={124} onComplete={() => {}} />
      <MergeWizard open={open === 'merge'} onOpenChange={close} onComplete={() => {}} />
      <DuplicateWizard open={open === 'duplicate'} onOpenChange={close} onComplete={() => {}} />
      <ArchiveWizard open={open === 'archive'} onOpenChange={close} selectedCount={8} onComplete={() => {}} />
      <DeleteWizard open={open === 'delete'} onOpenChange={close} selectedCount={3} onComplete={() => {}} />

      <BulkEditDialog
        open={open === 'bulk'}
        onOpenChange={close}
        selectedCount={5}
        fields={[{ value: 'category', label: 'Category' }, { value: 'status', label: 'Status' }, { value: 'reorder_level', label: 'Reorder Level' }]}
        onApply={() => close()}
      />
    </div>
  );
}