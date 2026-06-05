import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';

export default function TransferForm({ locations, onSave, isLoading }) {
  const [form, setForm] = useState({
    from_location_id: '',
    to_location_id: '',
    items: [{ product_id: '', product_name: '', quantity: 1 }],
    notes: '',
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { product_id: '', product_name: '', quantity: 1 }] }));
  const removeItem = (idx) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'product_id') {
        items[idx].product_name = products.find(p => p.id === value)?.name || '';
      }
      return { ...prev, items };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, transfer_number: `TR-${Date.now().toString(36).toUpperCase()}`, status: 'pending' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>From Location *</Label>
          <Select value={form.from_location_id} onValueChange={(v) => setForm(p => ({ ...p, from_location_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>To Location *</Label>
          <Select value={form.to_location_id} onValueChange={(v) => setForm(p => ({ ...p, to_location_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{locations.filter(l => l.id !== form.from_location_id).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Add</Button>
        </div>
        {form.items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <Select value={item.product_id} onValueChange={(v) => updateItem(idx, 'product_id', v)}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)} className="w-24" />
            {form.items.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            )}
          </div>
        ))}
      </div>

      <Textarea placeholder="Notes..." value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />

      <Button type="submit" className="w-full" disabled={isLoading || !form.from_location_id || !form.to_location_id}>
        {isLoading ? 'Creating...' : 'Create Transfer'}
      </Button>
    </form>
  );
}