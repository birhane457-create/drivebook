import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Building2, Users, Wallet, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import StatusBadge from '@/components/shared/StatusBadge';

export default function Suppliers() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', contact_person: '', email: '', phone: '', address: '' });
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Supplier.update(editing.id, data) : base44.entities.Supplier.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); setShowForm(false); setEditing(null); },
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
        emptyMessage="No suppliers yet. Add your first vendor to start purchasing."
      />

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Supplier' : 'New Supplier'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div><Label>Company Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
            <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm(p => ({ ...p, contact_person: e.target.value }))} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : (editing ? 'Update' : 'Create Supplier')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </EnterprisePageLayout>
  );
}