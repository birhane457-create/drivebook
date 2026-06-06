import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Layers } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductVariantManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', product_name: '', sku: '', unit_cost: 0, selling_price: 0, attributes: {} });
  const [attrKey, setAttrKey] = useState('');
  const [attrVal, setAttrVal] = useState('');
  const [filterProduct, setFilterProduct] = useState('all');

  const { data: variants = [], isLoading } = useQuery({ queryKey: ['product_variants'], queryFn: () => base44.entities.ProductVariant.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.ProductVariant.create(d),
    onSuccess: () => { qc.invalidateQueries(['product_variants']); setOpen(false); toast.success('Variant created'); },
  });

  const addAttr = () => { if (attrKey && attrVal) { setForm(f => ({ ...f, attributes: { ...f.attributes, [attrKey]: attrVal } })); setAttrKey(''); setAttrVal(''); } };

  const filtered = variants.filter(v => filterProduct === 'all' || v.product_id === filterProduct);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by product" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Products</SelectItem>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Variant</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Layers className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No variants found.</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground">
              {['Product', 'SKU', 'Attributes', 'Cost', 'Price', 'Stock', 'Status'].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} className="border-b hover:bg-muted/40">
                  <td className="py-2 px-2">{v.product_name}</td>
                  <td className="py-2 px-2 font-mono text-xs">{v.sku}</td>
                  <td className="py-2 px-2">
                    <div className="flex gap-1 flex-wrap">
                      {v.attributes && Object.entries(v.attributes).map(([k, val]) => (
                        <Badge key={k} variant="outline" className="text-xs">{k}: {val}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-2">${v.unit_cost || 0}</td>
                  <td className="py-2 px-2">${v.selling_price || 0}</td>
                  <td className="py-2 px-2">{v.stock_quantity || 0}</td>
                  <td className="py-2 px-2"><Badge variant={v.is_active ? 'secondary' : 'outline'}>{v.is_active ? 'Active' : 'Inactive'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Product Variant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Parent Product</Label>
              <Select value={form.product_id} onValueChange={v => { const p = products.find(pr => pr.id === v); setForm(f => ({ ...f, product_id: v, product_name: p?.name || '', unit_cost: p?.unit_cost || 0, selling_price: p?.selling_price || 0 })); }}>
                <SelectTrigger><SelectValue placeholder="Select parent product" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Variant SKU</Label><Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. SHIRT-RED-L" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cost ($)</Label><Input type="number" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Price ($)</Label><Input type="number" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div>
              <Label>Attributes (e.g. Color: Red)</Label>
              <div className="flex flex-wrap gap-1 mb-2">{Object.entries(form.attributes).map(([k, v]) => <Badge key={k} variant="outline" className="text-xs">{k}: {v}</Badge>)}</div>
              <div className="flex gap-2"><Input className="flex-1 text-xs" placeholder="Key (e.g. Color)" value={attrKey} onChange={e => setAttrKey(e.target.value)} /><Input className="flex-1 text-xs" placeholder="Value (e.g. Red)" value={attrVal} onChange={e => setAttrVal(e.target.value)} /><Button size="sm" variant="outline" onClick={addAttr}><Plus className="w-3 h-3" /></Button></div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, is_active: true, stock_quantity: 0 })}>Create Variant</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}