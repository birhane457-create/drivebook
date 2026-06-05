import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
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
    mutationFn: (data) => editing
      ? base44.entities.Supplier.update(editing.id, data)
      : base44.entities.Supplier.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); setShowForm(false); setEditing(null); },
  });

  const openForm = (supplier = null) => {
    setEditing(supplier);
    setForm(supplier ? { name: supplier.name, contact_person: supplier.contact_person || '', email: supplier.email || '', phone: supplier.phone || '', address: supplier.address || '' } : { name: '', contact_person: '', email: '', phone: '', address: '' });
    setShowForm(true);
  };

  const columns = [
    { key: 'name', label: 'Supplier', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'contact_person', label: 'Contact', render: (row) => row.contact_person || '—' },
    { key: 'email', label: 'Email', render: (row) => row.email || '—' },
    { key: 'phone', label: 'Phone', render: (row) => row.phone || '—' },
    { key: 'balance', label: 'Balance', render: (row) => (
      <span className={row.balance > 0 ? 'text-red-500 font-medium' : ''}>${(row.balance || 0).toFixed(2)}</span>
    )},
    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active !== false ? 'active' : 'inactive'} /> },
    { key: 'actions', label: '', render: (row) => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openForm(row); }}>
        <Edit2 className="w-4 h-4" />
      </Button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Manage your vendor database">
        <Button onClick={() => openForm()}>
          <Plus className="w-4 h-4 mr-2" /> Add Supplier
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={suppliers} isLoading={isLoading} searchField="name" />

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
    </div>
  );
}