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
import { Progress } from '@/components/ui/progress';
import { Plus, Factory, Play, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = { draft: 'secondary', scheduled: 'outline', in_progress: 'default', completed: 'secondary', cancelled: 'destructive' };

export default function ProductionOrderList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'production', quantity_planned: 1, finished_product_id: '', finished_product_name: '', bom_id: '', location_id: '' });

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['production_orders'], queryFn: () => base44.entities.ProductionOrder.list('-created_date') });
  const { data: boms = [] } = useQuery({ queryKey: ['boms'], queryFn: () => base44.entities.BillOfMaterials.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.ProductionOrder.create(d),
    onSuccess: () => { qc.invalidateQueries(['production_orders']); setOpen(false); toast.success('Production order created'); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionOrder.update(id, data),
    onSuccess: () => qc.invalidateQueries(['production_orders']),
  });

  const selectBOM = (bomId) => {
    const bom = boms.find(b => b.id === bomId);
    if (bom) setForm(f => ({ ...f, bom_id: bomId, bom_name: bom.name, finished_product_id: bom.finished_product_id, finished_product_name: bom.finished_product_name }));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{orders.length} production orders</p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Order</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No production orders. Create a BOM first, then schedule production.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => {
            const pct = o.quantity_planned > 0 ? Math.round((o.quantity_produced / o.quantity_planned) * 100) : 0;
            return (
              <Card key={o.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Factory className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-sm">{o.order_number || `PRD-${o.id?.slice(-6).toUpperCase()}`}</span>
                      <Badge variant={STATUS_COLORS[o.status] || 'outline'}>{o.status}</Badge>
                      <Badge variant="outline" className="capitalize">{o.type}</Badge>
                    </div>
                    <p className="text-sm font-medium">{o.finished_product_name}</p>
                    <p className="text-xs text-muted-foreground">Planned: {o.quantity_planned} · Produced: {o.quantity_produced || 0}</p>
                    {o.status === 'in_progress' && <Progress value={pct} className="h-1.5 mt-2" />}
                  </div>
                  <div className="flex gap-2">
                    {o.status === 'draft' && <Button size="sm" variant="outline" onClick={() => updateMut.mutate({ id: o.id, data: { status: 'scheduled' } })}>Schedule</Button>}
                    {o.status === 'scheduled' && <Button size="sm" onClick={() => updateMut.mutate({ id: o.id, data: { status: 'in_progress', actual_start: new Date().toISOString() } })}><Play className="w-3 h-3 mr-1" /> Start</Button>}
                    {o.status === 'in_progress' && <Button size="sm" variant="outline" onClick={() => { updateMut.mutate({ id: o.id, data: { status: 'completed', quantity_produced: o.quantity_planned, actual_end: new Date().toISOString() } }); toast.success('Production completed!'); }}><CheckCircle className="w-3 h-3 mr-1" /> Complete</Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Production Order</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['production', 'assembly', 'kitting', 'work_order'].map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Bill of Materials</Label>
              <Select value={form.bom_id} onValueChange={selectBOM}>
                <SelectTrigger><SelectValue placeholder="Select BOM" /></SelectTrigger>
                <SelectContent>{boms.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!form.bom_id && (
              <div><Label>Finished Product (no BOM)</Label>
                <Select value={form.finished_product_id} onValueChange={v => { const p = products.find(pr => pr.id === v); if (p) setForm(f => ({ ...f, finished_product_id: v, finished_product_name: p.name })); }}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Planned Quantity</Label><Input type="number" value={form.quantity_planned} onChange={e => setForm(f => ({ ...f, quantity_planned: parseFloat(e.target.value) || 1 }))} /></div>
            <div><Label>Production Location</Label>
              <Select value={form.location_id} onValueChange={v => setForm(f => ({ ...f, location_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, status: 'draft', quantity_produced: 0 })}>Create Order</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}