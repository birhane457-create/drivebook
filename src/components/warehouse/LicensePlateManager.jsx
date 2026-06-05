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
import { Plus, Tag, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function LicensePlateManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ lp_number: '', pallet_type: 'none', weight_kg: '' });
  const [search, setSearch] = useState('');

  const { data: lps = [], isLoading } = useQuery({ queryKey: ['license_plates'], queryFn: () => base44.entities.LicensePlate.list('-created_date') });

  const createMut = useMutation({
    mutationFn: d => base44.entities.LicensePlate.create(d),
    onSuccess: () => { qc.invalidateQueries(['license_plates']); setOpen(false); setForm({ lp_number: '', pallet_type: 'none', weight_kg: '' }); toast.success('License plate created'); },
  });

  const STATUS_COLOR = { active: 'default', in_transit: 'secondary', empty: 'outline', closed: 'destructive' };
  const filtered = lps.filter(l => l.lp_number?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Input placeholder="Search LPN..." value={search} onChange={e => setSearch(e.target.value)} className="w-56" />
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New LPN</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No license plates yet. Create LPNs to track pallets and containers.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(lp => (
            <Card key={lp.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono font-bold">{lp.lp_number}</p>
                    <p className="text-xs text-muted-foreground capitalize">{lp.pallet_type?.replace('_', ' ')} pallet</p>
                  </div>
                  <Badge variant={STATUS_COLOR[lp.status] || 'outline'}>{lp.status}</Badge>
                </div>
                {lp.weight_kg && <p className="text-xs text-muted-foreground">Weight: {lp.weight_kg} kg</p>}
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Package className="w-3 h-3" />
                  <span>{lp.items?.length || 0} SKUs</span>
                  {lp.items?.length > 0 && <span>· {lp.items.reduce((a, b) => a + (b.quantity || 0), 0)} units</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create License Plate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>LPN Number</Label><Input placeholder="LP-0001" value={form.lp_number} onChange={e => setForm(f => ({ ...f, lp_number: e.target.value }))} /></div>
            <div><Label>Pallet Type</Label>
              <Select value={form.pallet_type} onValueChange={v => setForm(f => ({ ...f, pallet_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['euro', 'us_standard', 'custom', 'none'].map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Weight (kg)</Label><Input type="number" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: parseFloat(e.target.value) || '' }))} /></div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, status: 'active', items: [] })}>Create LPN</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}