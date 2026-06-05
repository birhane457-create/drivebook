import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function PurchaseOrderForm({ suppliers, locations, onSave, isLoading }) {
  const [form, setForm] = useState({
    supplier_id: '',
    destination_location_id: '',
    items: [{ product_id: '', product_name: '', quantity_ordered: 1, unit_cost: 0 }],
    notes: '',
    expected_date: '',
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const addItem = () => {
    setForm(prev => ({ ...prev, items: [...prev.items, { product_id: '', product_name: '', quantity_ordered: 1, unit_cost: 0 }] }));
  };

  const removeItem = (idx) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        items[idx].product_name = product?.name || '';
        items[idx].unit_cost = product?.unit_cost || 0;
      }
      return { ...prev, items };
    });
  };

  const total = form.items.reduce((sum, i) => sum + (i.quantity_ordered * i.unit_cost), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      po_number: `PO-${Date.now().toString(36).toUpperCase()}`,
      total_amount: total,
      status: 'submitted',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Supplier *</Label>
          <Select value={form.supplier_id} onValueChange={(v) => setForm(p => ({ ...p, supplier_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
            <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Destination *</Label>
          <Select value={form.destination_location_id} onValueChange={(v) => setForm(p => ({ ...p, destination_location_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
            <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.type})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Expected Date</Label>
          <Input type="date" value={form.expected_date} onChange={(e) => setForm(p => ({ ...p, expected_date: e.target.value }))} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Add Item</Button>
        </div>
        <div className="space-y-2">
          {form.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select value={item.product_id} onValueChange={(v) => updateItem(idx, 'product_id', v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" placeholder="Qty" value={item.quantity_ordered} onChange={(e) => updateItem(idx, 'quantity_ordered', parseInt(e.target.value) || 0)} className="w-20" />
              <Input type="number" step="0.01" placeholder="Cost" value={item.unit_cost} onChange={(e) => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)} className="w-24" />
              <span className="text-sm font-medium w-20 text-right">${(item.quantity_ordered * item.unit_cost).toFixed(2)}</span>
              {form.items.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              )}
            </div>
          ))}
        </div>
        <p className="text-right font-bold mt-2">Total: ${total.toFixed(2)}</p>
      </div>

      <Textarea placeholder="Notes..." value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />

      <Button type="submit" className="w-full" disabled={isLoading || !form.supplier_id || !form.destination_location_id}>
        {isLoading ? 'Creating...' : 'Create Purchase Order'}
      </Button>
    </form>
  );
}