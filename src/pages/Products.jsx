import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2, ToggleLeft, ToggleRight, Package, Layers, DollarSign, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import ProductForm from '@/components/products/ProductForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Products() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); setShowForm(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); setShowForm(false); setEditing(null); },
  });

  const handleSave = (data) => editing ? updateMutation.mutate({ id: editing.id, data }) : createMutation.mutate(data);
  const toggleActive = (product) => updateMutation.mutate({ id: product.id, data: { is_active: !product.is_active } });

  const activeCount = products.filter(p => p.is_active !== false).length;
  const categoryCount = useMemo(() => new Set(products.map(p => p.category).filter(Boolean)).size, [products]);
  const inventoryValue = products.reduce((a, p) => a + (p.selling_price || 0) * (p.total_on_hand || 0), 0);
  const avgMargin = products.length
    ? products.reduce((a, p) => a + ((p.selling_price || 0) - (p.unit_cost || 0)), 0) / products.length
    : 0;

  const kpis = [
    { label: 'Products', value: products.length, icon: Package },
    { label: 'Active', value: activeCount, icon: Layers },
    { label: 'Categories', value: categoryCount, icon: TrendingUp },
    { label: 'Inventory Value', value: `$${inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign },
  ];

  const categoryOptions = useMemo(() =>
    [...new Set(products.map(p => p.category).filter(Boolean))].map(c => ({ value: c, label: c })),
  [products]);

  const columns = [
    { key: 'name', label: 'Product', render: (r) => (
      <div className="flex items-center gap-3">
        {r.image_url
          ? <img src={r.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
          : <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{r.name?.[0]}</div>}
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.sku}</p>
        </div>
      </div>
    )},
    { key: 'category', label: 'Category', filterType: 'select', filterOptions: categoryOptions, render: (r) => <Badge variant="secondary" className="font-normal">{r.category || '—'}</Badge> },
    { key: 'brand', label: 'Brand' },
    { key: 'unit_cost', label: 'Cost', align: 'right', render: (r) => `$${(r.unit_cost || 0).toFixed(2)}` },
    { key: 'selling_price', label: 'Price', align: 'right', render: (r) => <span className="font-semibold">${(r.selling_price || 0).toFixed(2)}</span> },
    { key: 'total_on_hand', label: 'On Hand', align: 'right', render: (r) => r.total_on_hand || 0 },
    { key: 'is_active', label: 'Status', filterType: 'select', filterOptions: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }], render: (r) => (
      <Badge className={r.is_active !== false ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0' : 'bg-muted text-muted-foreground border-0'}>
        {r.is_active !== false ? 'Active' : 'Inactive'}
      </Badge>
    )},
    { key: 'actions', label: '', type: 'actions', align: 'right', actions: [
      { label: 'Edit', icon: Edit2, onClick: (r) => { setEditing(r); setShowForm(true); } },
      { label: 'Deactivate', icon: ToggleRight, onClick: (r) => toggleActive(r), show: (r) => r.is_active !== false },
      { label: 'Activate', icon: ToggleLeft, onClick: (r) => toggleActive(r), show: (r) => r.is_active === false },
    ]},
  ];

  return (
    <EnterprisePageLayout
      title="Products"
      description="Manage your product catalog, pricing, and stock-keeping units."
      primaryAction={{ label: 'Add Product', icon: Plus, onClick: () => { setEditing(null); setShowForm(true); } }}
      kpis={kpis}
    >
      <AdvancedDataTable
        tableId="products"
        columns={columns}
        data={products}
        isLoading={isLoading}
        emptyMessage="No products yet. Add your first product to start selling."
      />

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Product' : 'New Product'}</DialogTitle></DialogHeader>
          <ProductForm product={editing} onSave={handleSave} isLoading={createMutation.isPending || updateMutation.isPending} />
        </DialogContent>
      </Dialog>
    </EnterprisePageLayout>
  );
}