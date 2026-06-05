import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
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

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleActive = (product) => {
    updateMutation.mutate({ id: product.id, data: { is_active: !product.is_active } });
  };

  const columns = [
    { key: 'name', label: 'Product', render: (row) => (
      <div className="flex items-center gap-3">
        {row.image_url ? (
          <img src={row.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {row.name?.[0]}
          </div>
        )}
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.sku}</p>
        </div>
      </div>
    )},
    { key: 'category', label: 'Category', render: (row) => (
      <Badge variant="secondary" className="font-normal">{row.category || '—'}</Badge>
    )},
    { key: 'brand', label: 'Brand' },
    { key: 'unit_cost', label: 'Cost', render: (row) => `$${(row.unit_cost || 0).toFixed(2)}` },
    { key: 'selling_price', label: 'Price', render: (row) => (
      <span className="font-semibold">${(row.selling_price || 0).toFixed(2)}</span>
    )},
    { key: 'is_active', label: 'Status', render: (row) => (
      <Badge className={row.is_active !== false ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0' : 'bg-muted text-muted-foreground border-0'}>
        {row.is_active !== false ? 'Active' : 'Inactive'}
      </Badge>
    )},
    { key: 'actions', label: '', render: (row) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditing(row); setShowForm(true); }}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleActive(row); }}>
          {row.is_active !== false ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
        </Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Products" subtitle={`${products.length} total products`}>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={products} isLoading={isLoading} searchField="name" />

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Product' : 'New Product'}</DialogTitle>
          </DialogHeader>
          <ProductForm 
            product={editing} 
            onSave={handleSave} 
            isLoading={createMutation.isPending || updateMutation.isPending} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}