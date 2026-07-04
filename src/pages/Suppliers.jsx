import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToastMutation } from '@/hooks/useToastMutation';
import { Plus, Building2, Users, Wallet, AlertTriangle, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import FormDialog from '@/components/dialogs/FormDialog';
import FormSection from '@/components/shared/FormSection';
import Field from '@/components/shared/Field';

export default function Suppliers() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', contact_person: '', email: '', phone: '', address: '' });
  const { data: suppliers = [], isLoading, error, refetch } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('-created_date'),
  });

  const saveMutation = useToastMutation({
    mutationFn: (data) => editing ? base44.entities.Supplier.update(editing.id, data) : base44.entities.Supplier.create(data),
    queryKeys: [['suppliers']],
    successMessage: editing ? 'Supplier updated' : 'Supplier added',
    optimisticUpdater: (qc, data) => {
      if (!editing) return undefined;
      const key = ['suppliers'];
      qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old = []) => old.map(r => r.id === editing.id ? { ...r, ...data } : r));
      return () => qc.setQueryData(key, prev);
    },
    onSuccess: () => { setShowForm(false); setEditing(null); },
  });

  const openForm = (supplier = null) => {
    setEditing(supplier);
    setForm(supplier
      ? { name: supplier.name, contact_person: supplier.contact_person || '', email: supplier.email || '', phone: supplier.phone || '', address: supplier.address || '' }
      : { name: '', contact_person: '', email: '', phone: '', address: '' });
    setShowForm(true);
  };

  const activeCount = suppliers.filter(s => s.is_active !== false).length;
  const totalPayable = suppliers.reduce((a, s) => a + (s.balance || 0), 0);
  const withBalance = suppliers.filter(s => (s.balance || 0) > 0).length;

  const kpis = [
    { label: 'Suppliers', value: suppliers.length, icon: Building2 },
    { label: 'Active', value: activeCount, icon: Users },
    { label: 'Outstanding', value: `$${totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Wallet },
    { label: 'With Balance', value: withBalance, icon: AlertTriangle },
  ];

  const columns = [
    { key: 'name', label: 'Supplier', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'contact_person', label: 'Contact', render: (r) => r.contact_person || '—' },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'balance', label: 'Balance', align: 'right', filterType: 'select', filterOptions: [{ value: 'due', label: 'Has balance' }], render: (r) => (
      <span className={r.balance > 0 ? 'text-red-500 font-medium' : ''}>${(r.balance || 0).toFixed(2)}</span>
    )},
    { key: 'is_active', label: 'Status', filterType: 'select', filterOptions: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }], render: (r) => <StatusBadge status={r.is_active !== false ? 'active' : 'inactive'} /> },
    { key: 'actions', label: '', type: 'actions', align: 'right', actions: [{ label: 'Edit', icon: null, onClick: (r) => openForm(r) }] },
  ];

  return (
    <EnterprisePageLayout
      title="Suppliers"
      description="Manage your vendor database and outstanding payables."
      primaryAction={{ label: 'Add Supplier', icon: Plus, onClick: () => openForm() }}
      kpis={kpis}
    >
      <AdvancedDataTable
        tableId="suppliers"
        columns={columns}
        data={suppliers}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        emptyMessage="No suppliers yet. Add your first vendor to start purchasing."
      />

      <FormDialog
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}
        title={editing ? 'Edit Supplier' : 'New Supplier'}
        description={editing ? 'Update the supplier details below.' : 'Fill in the details to add a new supplier.'}
        submitLabel={editing ? 'Update' : 'Create Supplier'}
        isPending={saveMutation.isPending}
        submitDisabled={!form.name.trim()}
        onSubmit={() => saveMutation.mutate(form)}
      >
        <FormSection title="Supplier Details" icon={User} columns={2}>
          <Field label="Company Name" htmlFor="sup-name" required>
            <Input id="sup-name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Contact Person" htmlFor="sup-contact">
            <Input id="sup-contact" value={form.contact_person} onChange={(e) => setForm(p => ({ ...p, contact_person: e.target.value }))} />
          </Field>
          <Field label="Email" htmlFor="sup-email">
            <Input id="sup-email" type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
          </Field>
          <Field label="Phone" htmlFor="sup-phone">
            <Input id="sup-phone" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} />
          </Field>
          <Field label="Address" htmlFor="sup-address" className="sm:col-span-2">
            <Input id="sup-address" value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} />
          </Field>
        </FormSection>
      </FormDialog>
    </EnterprisePageLayout>
  );
}