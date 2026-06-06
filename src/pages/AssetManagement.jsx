import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Wrench, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = { active: 'secondary', maintenance: 'default', repair: 'destructive', retired: 'outline', reserved: 'secondary' };
const TYPE_ICONS = { forklift: '🏗️', vehicle: '🚛', scanner: '📱', printer: '🖨️', conveyor: '⚙️', racking: '🏢', computer: '💻', other: '📦' };
const EMPTY = { name: '', type: 'other', serial_number: '', purchase_cost: 0, useful_life_years: 5, depreciation_method: 'straight_line', maintenance_interval_days: 90, assigned_to: '', purchase_date: '', next_maintenance_date: '' };

function calcDepreciation(asset) {
  if (!asset.purchase_date || !asset.purchase_cost) return 0;
  const years = (Date.now() - new Date(asset.purchase_date)) / (1000 * 60 * 60 * 24 * 365);
  if (asset.depreciation_method === 'straight_line') {
    return Math.max(0, asset.purchase_cost - (asset.purchase_cost / (asset.useful_life_years || 5)) * years);
  }
  return asset.purchase_cost * Math.pow(0.8, years);
}

export default function AssetManagement() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [filterType, setFilterType] = useState('all');

  const { data: assets = [], isLoading } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list('-created_date') });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });

  const createMut = useMutation({ mutationFn: d => base44.entities.Asset.create(d), onSuccess: () => { qc.invalidateQueries(['assets']); setOpen(false); setForm(EMPTY); toast.success('Asset added'); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.Asset.update(id, data), onSuccess: () => qc.invalidateQueries(['assets']) });

  const setMaintenance = (asset) => {
    const next = new Date();
    next.setDate(next.getDate() + (asset.maintenance_interval_days || 90));
    updateMut.mutate({ id: asset.id, data: { status: 'active', next_maintenance_date: next.toISOString().split('T')[0] } });
    toast.success('Maintenance logged');
  };

  const filtered = assets.filter(a => filterType === 'all' || a.type === filterType);
  const overdue = assets.filter(a => a.next_maintenance_date && new Date(a.next_maintenance_date) < new Date());
  const totalValue = assets.reduce((acc, a) => acc + calcDepreciation(a), 0);

  return (
    <div className="p-6">
      <PageHeader title="Asset Management" subtitle="Track equipment, maintenance schedules, depreciation & utilization">
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add Asset</Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Assets', value: assets.length },
          { label: 'Active', value: assets.filter(a => a.status === 'active').length },
          { label: 'Maintenance Due', value: overdue.length },
          { label: 'Book Value', value: `$${Math.round(totalValue).toLocaleString()}` },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-4"><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      {overdue.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{overdue.length} asset(s) have overdue maintenance: {overdue.map(a => a.name).join(', ')}</span>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {['all', 'forklift', 'vehicle', 'scanner', 'printer', 'computer', 'other'].map(t => (
          <Button key={t} size="sm" variant={filterType === t ? 'default' : 'outline'} onClick={() => setFilterType(t)} className="capitalize">
            {t === 'all' ? 'All' : `${TYPE_ICONS[t] || ''} ${t}`}
          </Button>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No assets found.</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(asset => {
            const bookValue = Math.round(calcDepreciation(asset));
            const depPct = asset.purchase_cost > 0 ? Math.round((1 - bookValue / asset.purchase_cost) * 100) : 0;
            const isOverdue = asset.next_maintenance_date && new Date(asset.next_maintenance_date) < new Date();
            return (
              <Card key={asset.id} className={isOverdue ? 'border-yellow-300' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{TYPE_ICONS[asset.type] || '📦'}</span>
                      <div>
                        <p className="font-semibold">{asset.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{asset.asset_number || asset.serial_number || '—'}</p>
                      </div>
                    </div>
                    <Badge variant={STATUS_COLORS[asset.status] || 'outline'}>{asset.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1 mb-3">
                    {asset.assigned_to && <p>Assigned: {asset.assigned_to}</p>}
                    <p>Purchase Cost: ${(asset.purchase_cost || 0).toLocaleString()}</p>
                    <p>Book Value: ${bookValue.toLocaleString()} ({depPct}% depreciated)</p>
                    {asset.next_maintenance_date && <p className={isOverdue ? 'text-yellow-600 font-medium' : ''}>Next Service: {asset.next_maintenance_date}{isOverdue ? ' ⚠️ OVERDUE' : ''}</p>}
                  </div>
                  {asset.purchase_cost > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1 text-muted-foreground"><span>Depreciation</span><span>{depPct}%</span></div>
                      <Progress value={depPct} className="h-1" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setMaintenance(asset)}><Wrench className="w-3 h-3 mr-1" /> Log Service</Button>
                    <Button size="sm" variant="ghost" onClick={() => updateMut.mutate({ id: asset.id, data: { status: asset.status === 'active' ? 'maintenance' : 'active' } })}>
                      {asset.status === 'active' ? '→ Maint.' : '→ Active'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Asset Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Forklift #3" /></div>
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['forklift', 'vehicle', 'scanner', 'printer', 'conveyor', 'racking', 'computer', 'other'].map(t => <SelectItem key={t} value={t}>{TYPE_ICONS[t]} {t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Serial Number</Label><Input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} /></div>
            <div><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} /></div>
            <div><Label>Purchase Cost ($)</Label><Input type="number" value={form.purchase_cost} onChange={e => setForm(f => ({ ...f, purchase_cost: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>Useful Life (years)</Label><Input type="number" value={form.useful_life_years} onChange={e => setForm(f => ({ ...f, useful_life_years: parseInt(e.target.value) || 5 }))} /></div>
            <div><Label>Maint. Interval (days)</Label><Input type="number" value={form.maintenance_interval_days} onChange={e => setForm(f => ({ ...f, maintenance_interval_days: parseInt(e.target.value) || 90 }))} /></div>
            <div><Label>Next Maintenance</Label><Input type="date" value={form.next_maintenance_date} onChange={e => setForm(f => ({ ...f, next_maintenance_date: e.target.value }))} /></div>
            <div><Label>Assigned To</Label><Input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} /></div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, status: 'active', current_value: form.purchase_cost })}>Add Asset</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}