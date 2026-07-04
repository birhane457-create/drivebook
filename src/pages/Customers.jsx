import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2, Star, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import Field from '@/components/shared/Field';
import { Badge } from '@/components/ui/badge';

export default function Customers() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.Customer.update(editing.id, data)
      : base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const openForm = (customer = null) => {
    setEditing(customer);
    setForm(customer ? { name: customer.name, email: customer.email || '', phone: customer.phone || '', address: customer.address || '' } : { name: '', email: '', phone: '', address: '' });
    setShowForm(true);
  };

  const columns = [
    { key: 'name', label: 'Customer', render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{row.name?.[0]}</div>
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.email || row.phone || '—'}</p>
        </div>
      </div>
    )},
    { key: 'loyalty_points', label: 'Loyalty', render: (row) => (
      <div className="flex items-center gap-1">
        <Star className="w-3 h-3 text-amber-500" />
        <span>{row.loyalty_points || 0} pts</span>
      </div>
    )},
    { key: 'credit_balance', label: 'Credit', render: (row) => (
      <span className={row.credit_balance > 0 ? 'text-emerald-600 font-medium' : ''}>
        ${(row.credit_balance || 0).toFixed(2)}
      </span>
    )},
    { key: 'total_purchases', label: 'Total Purchases', render: (row) => `$${(row.total_purchases || 0).toFixed(2)}` },
    { key: 'actions', label: '', render: (row) => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openForm(row); }}>
        <Edit2 className="w-4 h-4" />
      </Button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${customers.length} registered customers`}>
        <Button onClick={() => openForm()}>
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={customers} isLoading={isLoading} searchField="name" />

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Customer' : 'New Customer'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <Field label="Name" htmlFor="cust-name" required>
              <Input id="cust-name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required />
            </Field>
            <Field label="Email" htmlFor="cust-email">
              <Input id="cust-email" type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
            </Field>
            <Field label="Phone" htmlFor="cust-phone">
              <Input id="cust-phone" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} />
            </Field>
            <Field label="Address" htmlFor="cust-address">
              <Input id="cust-address" value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} />
            </Field>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : (editing ? 'Update' : 'Create Customer')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}