import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Users, Star, Wallet, ShoppingBag, UserCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import Field from '@/components/shared/Field';
import FormDialog from '@/components/dialogs/FormDialog';
import FormSection from '@/components/shared/FormSection';

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
    mutationFn: (data) => editing ? base44.entities.Customer.update(editing.id, data) : base44.entities.Customer.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); setEditing(null); },
  });

  const openForm = (customer = null) => {
    setEditing(customer);
    setForm(customer ? { name: customer.name, email: customer.email || '', phone: customer.phone || '', address: customer.address || '' } : { name: '', email: '', phone: '', address: '' });
    setShowForm(true);
  };

  const totalLoyalty = customers.reduce((a, c) => a + (c.loyalty_points || 0), 0);
  const totalCredit = customers.reduce((a, c) => a + (c.credit_balance || 0), 0);
  const totalPurchases = customers.reduce((a, c) => a + (c.total_purchases || 0), 0);

  const kpis = [
    { label: 'Customers', value: customers.length, icon: Users },
    { label: 'Loyalty Points', value: totalLoyalty.toLocaleString(), icon: Star },
    { label: 'Store Credit', value: `$${totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Wallet },
    { label: 'Lifetime Sales', value: `$${totalPurchases.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: ShoppingBag },
  ];

  const columns = [
    { key: 'name', label: 'Customer', render: (r) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{r.name?.[0]}</div>
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.email || r.phone || '—'}</p>
        </div>
      </div>
    )},
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'loyalty_points', label: 'Loyalty', align: 'right', render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <Star className="w-3 h-3 text-amber-500" />
        <span>{r.loyalty_points || 0}</span>
      </div>
    )},
    { key: 'credit_balance', label: 'Credit', align: 'right', render: (r) => (
      <span className={r.credit_balance > 0 ? 'text-emerald-600 font-medium' : ''}>${(r.credit_balance || 0).toFixed(2)}</span>
    )},
    { key: 'total_purchases', label: 'Total Spent', align: 'right', render: (r) => `$${(r.total_purchases || 0).toFixed(2)}` },
    { key: 'actions', label: '', type: 'actions', align: 'right', actions: [{ label: 'Edit', icon: null, onClick: (r) => openForm(r) }] },
  ];

  return (
    <EnterprisePageLayout
      title="Customers"
      description="Manage your customer database, loyalty points, and store credit."
      primaryAction={{ label: 'Add Customer', icon: Plus, onClick: () => openForm() }}
      kpis={kpis}
    >
      <AdvancedDataTable
        tableId="customers"
        columns={columns}
        data={customers}
        isLoading={isLoading}
        emptyMessage="No customers yet. Add your first customer to start tracking loyalty."
      />

      <FormDialog
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}
        title={editing ? 'Edit Customer' : 'New Customer'}
        description={editing ? 'Update the customer details below.' : 'Fill in the details to add a new customer.'}
        submitLabel={editing ? 'Update' : 'Create Customer'}
        isPending={saveMutation.isPending}
        submitDisabled={!form.name.trim()}
        onSubmit={() => saveMutation.mutate(form)}
      >
        <FormSection title="Customer Details" icon={UserCircle} columns={2}>
          <Field label="Name" htmlFor="cust-name" required>
            <Input id="cust-name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Email" htmlFor="cust-email">
            <Input id="cust-email" type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
          </Field>
          <Field label="Phone" htmlFor="cust-phone">
            <Input id="cust-phone" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} />
          </Field>
          <Field label="Address" htmlFor="cust-address" className="sm:col-span-2">
            <Input id="cust-address" value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} />
          </Field>
        </FormSection>
      </FormDialog>
    </EnterprisePageLayout>
  );
}