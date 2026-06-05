import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Layers, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_BOM = { name: '', finished_product_id: '', finished_product_name: '', output_quantity: 1, type: 'manufacture', status: 'active', components: [], labor_cost: 0, overhead_cost: 0 };

export default function BOMList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_BOM);
  const [compRow, setCompRow] = useState({ product_id: '', product_name: '', sku: '', quantity: 1, unit: 'piece', scrap_rate: 0 });

  const { data: boms = [], isLoading } = useQuery({ queryKey: ['boms'], queryFn: () => base44.entities.BillOfMaterials.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.BillOfMaterials.create(d),
    onSuccess: () => { qc.invalidateQueries(['boms']); setOpen(false); setForm(EMPTY_BOM); toast.success('BOM created'); },
  });

  const addComponent = () => {
    if (!compRow.product_id) return;
    setForm(f => ({ ...f, components: [...f.components, { ...compRow }] }));
    setCompRow({ product_id: '', product_name: '', sku: '', quantity: 1, unit: 'piece', scrap_rate: 0 });
  };

  const selectFinished = (id) => {
    const p = products.find(pr => pr.id === id);
    if (p) setForm(f => ({ ...f, finished_product_id: id, finished_product_name: p.name }));
  };

  const selectComponent = (id) => {
    const p = products.find(pr => pr.id === id);
    if (p) setCompRow(r => ({ ...r, product_id: id, product_name: p.name, sku: p.sku || '' }));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{boms.length} BOMs configured</p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New BOM</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : boms.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No Bills of Materials yet. Create a BOM to enable production orders.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {boms.map(bom => (
            <Card key={bom.id}>
              <CardContent className="flex items-start gap-4 py-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{bom.name}</span>
                    <Badge variant="outline" className="capitalize">{bom.type}</Badge>
                    <Badge variant={bom.status === 'active' ? 'default' : 'secondary'} className="capitalize">{bom.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Produces: {bom.finished_product_name} × {bom.output_quantity}</p>
                  <p className="text-xs text-muted-foreground mt-1">{bom.components?.length || 0} components · Labor: ${bom.labor_cost} · Overhead: ${bom.overhead_cost}</p>
                  {bom.components?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {bom.components.slice(0, 5).map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{c.product_name} × {c.quantity}</Badge>
                      ))}
                      {bom.components.length > 5 && <Badge variant="outline" className="text-xs">+{bom.components.length - 5} more</Badge>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Bill of Materials</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>BOM Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Widget Assembly v1" /></div>
              <div className="col-span-2"><Label>Finished Product</Label>
                <Select value={form.finished_product_id} onValueChange={selectFinished}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['manufacture', 'kit', 'assembly'].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Output Qty</Label><Input type="number" value={form.output_quantity} onChange={e => setForm(f => ({ ...f, output_quantity: parseFloat(e.target.value) || 1 }))} /></div>
              <div><Label>Labor Cost ($)</Label><Input type="number" value={form.labor_cost} onChange={e => setForm(f => ({ ...f, labor_cost: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Overhead Cost ($)</Label><Input type="number" value={form.overhead_cost} onChange={e => setForm(f => ({ ...f, overhead_cost: parseFloat(e.target.value) || 0 }))} /></div>
            </div>

            <div>
              <Label className="text-base font-semibold">Components</Label>
              <div className="border rounded-lg p-3 mt-2 space-y-2">
                {form.components.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{c.product_name}</span>
                    <span className="text-muted-foreground">× {c.quantity} {c.unit}</span>
                    <button onClick={() => setForm(f => ({ ...f, components: f.components.filter((_, j) => j !== i) }))}><Trash2 className="w-3 h-3 text-destructive" /></button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2 border-t">
                  <Select value={compRow.product_id} onValueChange={selectComponent}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Add component..." /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" className="w-20" placeholder="Qty" value={compRow.quantity} onChange={e => setCompRow(r => ({ ...r, quantity: parseFloat(e.target.value) || 1 }))} />
                  <Button size="sm" variant="outline" onClick={addComponent}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate(form)}>Create BOM</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}