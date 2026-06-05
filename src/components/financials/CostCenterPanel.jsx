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
import { Plus, Target } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_COLORS = { cost_center: 'secondary', profit_center: 'default', investment_center: 'outline' };

export default function CostCenterPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'cost_center', manager: '', budget: 0, description: '' });

  const { data: centers = [], isLoading } = useQuery({ queryKey: ['cost_centers'], queryFn: () => base44.entities.CostCenter.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.CostCenter.create(d),
    onSuccess: () => { qc.invalidateQueries(['cost_centers']); setOpen(false); toast.success('Cost center created'); },
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Center</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : centers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Target className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No cost centers yet.</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {centers.map(c => {
            const pct = c.budget > 0 ? Math.min(100, Math.round(((c.actual_spend || 0) / c.budget) * 100)) : 0;
            return (
              <Card key={c.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <div><p className="font-semibold">{c.name}</p><p className="text-xs font-mono text-muted-foreground">{c.code}</p></div>
                    <Badge variant={TYPE_COLORS[c.type] || 'outline'} className="text-xs capitalize">{c.type.replace('_', ' ')}</Badge>
                  </div>
                  {c.manager && <p className="text-xs text-muted-foreground mb-2">Manager: {c.manager}</p>}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs"><span>Budget</span><span>${(c.budget || 0).toLocaleString()}</span></div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Spent: ${(c.actual_spend || 0).toLocaleString()}</span>
                      <span className={pct > 90 ? 'text-red-500' : ''}>{pct}%</span>
                    </div>
                    {c.type === 'profit_center' && <p className="text-xs text-green-600">Revenue: ${(c.revenue || 0).toLocaleString()}</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Cost/Profit Center</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="CC-001" /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['cost_center', 'profit_center', 'investment_center'].map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Manager</Label><Input value={form.manager} onChange={e => setForm(f => ({ ...f, manager: e.target.value }))} /></div>
            <div><Label>Budget ($)</Label><Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, actual_spend: 0, revenue: 0, is_active: true })}>Create</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}