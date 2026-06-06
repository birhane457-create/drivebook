import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Star, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function VendorCatalogManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', supplier_name: '', product_id: '', product_name: '', vendor_sku: '', unit_cost: 0, min_order_qty: 1, lead_time_days: 7, is_preferred: false });

  const { data: catalog = [], isLoading } = useQuery({ queryKey: ['vendor_catalog'], queryFn: () => base44.entities.VendorCatalog.list() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.VendorCatalog.create(d),
    onSuccess: () => { qc.invalidateQueries(['vendor_catalog']); setOpen(false); toast.success('Vendor item added'); },
  });

  const togglePreferred = (id, val) => { base44.entities.VendorCatalog.update(id, { is_preferred: !val }); qc.invalidateQueries(['vendor_catalog']); };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Vendor Item</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : catalog.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No vendor catalog entries. Add supplier-product mappings here.</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground">
              {['Supplier', 'Product', 'Vendor SKU', 'Unit Cost', 'Min Qty', 'Lead Time', 'Preferred', ''].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {catalog.map(item => (
                <tr key={item.id} className="border-b hover:bg-muted/40">
                  <td className="py-2 px-2 font-medium">{item.supplier_name}</td>
                  <td className="py-2 px-2">{item.product_name}</td>
                  <td className="py-2 px-2 font-mono text-xs">{item.vendor_sku || '—'}</td>
                  <td className="py-2 px-2">${item.unit_cost}</td>
                  <td className="py-2 px-2">{item.min_order_qty}</td>
                  <td className="py-2 px-2">{item.lead_time_days}d</td>
                  <td className="py-2 px-2">
                    <button onClick={() => togglePreferred(item.id, item.is_preferred)}>
                      <Star className={`w-4 h-4 ${item.is_preferred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    </button>
                  </td>
                  <td className="py-2 px-2"><Badge variant={item.is_active ? 'secondary' : 'outline'}>{item.is_active ? 'Active' : 'Inactive'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Vendor Catalog Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Supplier</Label>
              <Select value={form.supplier_id} onValueChange={v => { const s = suppliers.find(s => s.id === v); setForm(f => ({ ...f, supplier_id: v, supplier_name: s?.name || '' })); }}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Product</Label>
              <Select value={form.product_id} onValueChange={v => { const p = products.find(pr => pr.id === v); setForm(f => ({ ...f, product_id: v, product_name: p?.name || '', unit_cost: p?.unit_cost || 0 })); }}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vendor SKU</Label><Input value={form.vendor_sku} onChange={e => setForm(f => ({ ...f, vendor_sku: e.target.value }))} /></div>
              <div><Label>Unit Cost ($)</Label><Input type="number" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Min Order Qty</Label><Input type="number" value={form.min_order_qty} onChange={e => setForm(f => ({ ...f, min_order_qty: parseInt(e.target.value) || 1 }))} /></div>
              <div><Label>Lead Time (days)</Label><Input type="number" value={form.lead_time_days} onChange={e => setForm(f => ({ ...f, lead_time_days: parseInt(e.target.value) || 7 }))} /></div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, is_active: true, last_price_date: new Date().toISOString().split('T')[0] })}>Add to Catalog</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}