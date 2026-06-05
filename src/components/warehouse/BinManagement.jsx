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
import { Plus, MapPin, Grid3x3 } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY = { code: '', location_id: '', zone: '', aisle: '', rack: '', shelf: '', bin: '', type: 'storage', max_weight_kg: '', putaway_priority: 0 };

const TYPE_COLORS = { storage: 'default', receiving: 'secondary', staging: 'outline', shipping: 'destructive', cross_dock: 'default', pallet: 'secondary' };

export default function BinManagement() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState('all');

  const { data: bins = [], isLoading } = useQuery({ queryKey: ['bins'], queryFn: () => base44.entities.BinLocation.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.BinLocation.create(d),
    onSuccess: () => { qc.invalidateQueries(['bins']); setOpen(false); setForm(EMPTY); toast.success('Bin created'); },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const zones = ['all', ...new Set(bins.map(b => b.zone).filter(Boolean))];
  const filtered = bins.filter(b =>
    (filterZone === 'all' || b.zone === filterZone) &&
    (b.code?.toLowerCase().includes(search.toLowerCase()) || b.zone?.toLowerCase().includes(search.toLowerCase()))
  );

  // Group by zone
  const byZone = {};
  filtered.forEach(b => { const z = b.zone || 'Unzoned'; byZone[z] = byZone[z] || []; byZone[z].push(b); });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Input placeholder="Search bins..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
          <Select value={filterZone} onValueChange={setFilterZone}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{zones.map(z => <SelectItem key={z} value={z}>{z === 'all' ? 'All Zones' : z}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={() => setOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Add Bin</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground text-sm">Loading...</p> : Object.keys(byZone).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Grid3x3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No bins configured</p>
          <p className="text-sm">Add bins to set up your warehouse hierarchy (Zone → Aisle → Rack → Shelf → Bin)</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byZone).map(([zone, zoneBins]) => (
            <Card key={zone}>
              <CardHeader className="py-3 px-4 flex flex-row items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm">Zone: {zone}</CardTitle>
                <Badge variant="secondary" className="ml-auto">{zoneBins.length} bins</Badge>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {zoneBins.map(bin => (
                    <div key={bin.id} className="border rounded-lg p-2 text-xs hover:bg-muted/50 cursor-pointer">
                      <p className="font-mono font-bold">{bin.code}</p>
                      <p className="text-muted-foreground">{[bin.aisle, bin.rack, bin.shelf].filter(Boolean).join('-') || '—'}</p>
                      <Badge variant={TYPE_COLORS[bin.type] || 'outline'} className="mt-1 text-[10px]">{bin.type}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Bin Location</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Bin Code</Label><Input placeholder="A-01-02-03" value={form.code} onChange={e => set('code', e.target.value)} /></div>
            <div className="col-span-2">
              <Label>Warehouse / Location</Label>
              <Select value={form.location_id} onValueChange={v => set('location_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Zone</Label><Input placeholder="BULK / PICK / RECV" value={form.zone} onChange={e => set('zone', e.target.value)} /></div>
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['storage', 'receiving', 'staging', 'shipping', 'cross_dock', 'pallet'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {[['aisle', 'Aisle'], ['rack', 'Rack'], ['shelf', 'Shelf'], ['bin', 'Bin']].map(([k, l]) => (
              <div key={k}><Label>{l}</Label><Input value={form[k]} onChange={e => set(k, e.target.value)} /></div>
            ))}
            <div><Label>Max Weight (kg)</Label><Input type="number" value={form.max_weight_kg} onChange={e => set('max_weight_kg', parseFloat(e.target.value) || '')} /></div>
            <div><Label>Putaway Priority</Label><Input type="number" value={form.putaway_priority} onChange={e => set('putaway_priority', parseInt(e.target.value) || 0)} /></div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, is_active: true })}>Create Bin</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}