import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToastMutation } from '@/hooks/useToastMutation';
import {
  Plus, Check, X, ArrowLeftRight, Clock, Truck, CheckCircle2, Package, Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import FormDialog from '@/components/dialogs/FormDialog';
import FormSection from '@/components/shared/FormSection';
import Field from '@/components/shared/Field';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';

const EMPTY_FORM = {
  from_location_id: '',
  to_location_id: '',
  items: [{ product_id: '', product_name: '', quantity: 1 }],
  notes: '',
};

export default function Transfers() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: transfers = [], isLoading, error, refetch } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => base44.entities.StockTransfer.list('-created_date'),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const createMutation = useToastMutation({
    mutationFn: (data) => base44.entities.StockTransfer.create(data),
    queryKeys: [['transfers']],
    successMessage: 'Transfer created',
    onSuccess: () => { setShowForm(false); setForm(EMPTY_FORM); },
  });

  const statusMutation = useToastMutation({
    mutationFn: async ({ transfer, newStatus }) => {
      const res = await base44.functions.invoke('processTransfer', { transfer_id: transfer.id, new_status: newStatus });
      return res.data;
    },
    queryKeys: [['transfers'], ['stock-levels']],
    successMessage: 'Transfer updated',
  });

  const enriched = transfers.map((t) => ({
    ...t,
    from_name: locations.find((l) => l.id === t.from_location_id)?.name || 'Unknown',
    to_name: locations.find((l) => l.id === t.to_location_id)?.name || 'Unknown',
  }));

  const kpis = [
    { label: 'Total Transfers', value: transfers.length, icon: ArrowLeftRight },
    { label: 'Pending Approval', value: transfers.filter((t) => t.status === 'pending').length, icon: Clock },
    { label: 'In Transit', value: transfers.filter((t) => t.status === 'in_transit').length, icon: Truck },
    { label: 'Received', value: transfers.filter((t) => t.status === 'received').length, icon: CheckCircle2 },
  ];

  const columns = [
    { key: 'transfer_number', label: 'Transfer #', render: (row) => <span className="font-mono font-medium">{row.transfer_number}</span> },
    { key: 'from_name', label: 'From' },
    { key: 'to_name', label: 'To' },
    { key: 'items', label: 'Items', render: (row) => `${row.items?.length || 0} items` },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'created_date', label: 'Date', render: (row) => (row.created_date ? format(new Date(row.created_date), 'MMM d, yyyy') : '—') },
    {
      key: 'actions',
      label: '',
      type: 'actions',
      align: 'right',
      actions: [
        { label: 'Approve', icon: Check, onClick: (row) => statusMutation.mutate({ transfer: row, newStatus: 'approved' }), show: (row) => row.status === 'pending' },
        { label: 'Cancel', icon: X, onClick: (row) => statusMutation.mutate({ transfer: row, newStatus: 'cancelled' }), show: (row) => row.status === 'pending' },
        { label: 'In Transit', onClick: (row) => statusMutation.mutate({ transfer: row, newStatus: 'in_transit' }), show: (row) => row.status === 'approved' },
        { label: 'Received', onClick: (row) => statusMutation.mutate({ transfer: row, newStatus: 'received' }), show: (row) => row.status === 'in_transit' },
      ],
    },
  ];

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { product_id: '', product_name: '', quantity: 1 }] }));
  const removeItem = (idx) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'product_id') items[idx].product_name = products.find((p) => p.id === value)?.name || '';
      return { ...prev, items };
    });
  };

  const handleSubmit = () => {
    createMutation.mutate({
      ...form,
      transfer_number: `TR-${Date.now().toString(36).toUpperCase()}`,
      status: 'pending',
    });
  };

  const openForm = () => { setForm(EMPTY_FORM); setShowForm(true); };

  return (
    <EnterprisePageLayout
      title="Stock Transfers"
      description="Transfer inventory between locations"
      primaryAction={{ label: 'New Transfer', icon: Plus, onClick: openForm }}
      kpis={kpis}
    >
      <AdvancedDataTable
        tableId="transfers"
        columns={columns}
        data={enriched}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        emptyMessage="No transfers yet. Move stock between locations to get started."
      />

      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title="New Stock Transfer"
        submitLabel="Create Transfer"
        isPending={createMutation.isPending}
        submitDisabled={!form.from_location_id || !form.to_location_id}
        onSubmit={handleSubmit}
      >
        <FormSection title="Route" icon={ArrowLeftRight} columns={2}>
          <Field label="From Location" required htmlFor="from-loc">
            <Select value={form.from_location_id} onValueChange={(v) => setForm((p) => ({ ...p, from_location_id: v }))}>
              <SelectTrigger id="from-loc"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="To Location" required htmlFor="to-loc">
            <Select value={form.to_location_id} onValueChange={(v) => setForm((p) => ({ ...p, to_location_id: v }))}>
              <SelectTrigger id="to-loc"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {locations.filter((l) => l.id !== form.from_location_id).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </FormSection>

        <FormSection title="Items" icon={Package} className="mt-4">
          <div className="space-y-2">
            {form.items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={item.product_id} onValueChange={(v) => updateItem(idx, 'product_id', v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                  className="w-24"
                />
                {form.items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="p-2 rounded-md hover:bg-muted text-destructive" aria-label="Remove item">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add item
            </button>
          </div>
        </FormSection>

        <FormSection title="Notes" className="mt-4">
          <Field htmlFor="transfer-notes">
            <Textarea
              id="transfer-notes"
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
            />
          </Field>
        </FormSection>
      </FormDialog>
    </EnterprisePageLayout>
  );
}