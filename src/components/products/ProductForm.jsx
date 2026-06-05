import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const CATEGORIES = ['Electronics', 'Clothing', 'Food & Beverage', 'Health & Beauty', 'Home & Garden', 'Sports', 'Automotive', 'Office Supplies', 'Other'];
const UNITS = ['piece', 'kg', 'liter', 'box', 'pack', 'meter'];

export default function ProductForm({ product, onSave, isLoading }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    category: product?.category || '',
    brand: product?.brand || '',
    unit_cost: product?.unit_cost || '',
    selling_price: product?.selling_price || '',
    tax_rate: product?.tax_rate || 0,
    reorder_level: product?.reorder_level || 10,
    unit: product?.unit || 'piece',
    description: product?.description || '',
    is_active: product?.is_active !== false,
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      unit_cost: parseFloat(form.unit_cost) || 0,
      selling_price: parseFloat(form.selling_price) || 0,
      tax_rate: parseFloat(form.tax_rate) || 0,
      reorder_level: parseInt(form.reorder_level) || 10,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Product Name *</Label>
          <Input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </div>
        <div>
          <Label>SKU *</Label>
          <Input value={form.sku} onChange={(e) => update('sku', e.target.value)} required />
        </div>
        <div>
          <Label>Barcode</Label>
          <Input value={form.barcode} onChange={(e) => update('barcode', e.target.value)} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => update('category', v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Brand</Label>
          <Input value={form.brand} onChange={(e) => update('brand', e.target.value)} />
        </div>
        <div>
          <Label>Unit Cost ($)</Label>
          <Input type="number" step="0.01" value={form.unit_cost} onChange={(e) => update('unit_cost', e.target.value)} />
        </div>
        <div>
          <Label>Selling Price ($) *</Label>
          <Input type="number" step="0.01" value={form.selling_price} onChange={(e) => update('selling_price', e.target.value)} required />
        </div>
        <div>
          <Label>Tax Rate (%)</Label>
          <Input type="number" step="0.01" value={form.tax_rate} onChange={(e) => update('tax_rate', e.target.value)} />
        </div>
        <div>
          <Label>Reorder Level</Label>
          <Input type="number" value={form.reorder_level} onChange={(e) => update('reorder_level', e.target.value)} />
        </div>
        <div>
          <Label>Unit</Label>
          <Select value={form.unit} onValueChange={(v) => update('unit', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITS.map(u => <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.is_active} onCheckedChange={(v) => update('is_active', v)} />
          <Label>Active</Label>
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={2} />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Saving...' : (product ? 'Update Product' : 'Create Product')}
      </Button>
    </form>
  );
}