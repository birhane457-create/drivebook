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
import { Plus, Truck } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = { available: 'secondary', on_route: 'default', maintenance: 'destructive', inactive: 'outline' };
const VEHICLE_ICONS = { van: '🚐', truck: '🚛', motorcycle: '🏍️', car: '🚗', forklift: '🏗️' };

export default function VehicleManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ plate_number: '', name: '', type: 'van', capacity_kg: '', fuel_type: 'diesel', assigned_driver: '' });

  const { data: vehicles = [], isLoading } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.Vehicle.create(d),
    onSuccess: () => { qc.invalidateQueries(['vehicles']); setOpen(false); toast.success('Vehicle added'); },
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Vehicle</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : vehicles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Truck className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No vehicles in fleet yet.</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map(v => (
            <Card key={v.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{VEHICLE_ICONS[v.type] || '🚗'}</span>
                    <div>
                      <p className="font-semibold">{v.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{v.plate_number}</p>
                    </div>
                  </div>
                  <Badge variant={STATUS_COLORS[v.status] || 'outline'}>{v.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {v.capacity_kg && <p>Capacity: {v.capacity_kg} kg</p>}
                  <p>Fuel: {v.fuel_type}</p>
                  {v.assigned_driver && <p>Driver: {v.assigned_driver}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Plate Number</Label><Input value={form.plate_number} onChange={e => setForm(f => ({ ...f, plate_number: e.target.value }))} /></div>
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Truck #1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['van', 'truck', 'motorcycle', 'car', 'forklift'].map(t => <SelectItem key={t} value={t} className="capitalize">{VEHICLE_ICONS[t]} {t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Fuel Type</Label>
                <Select value={form.fuel_type} onValueChange={v => setForm(f => ({ ...f, fuel_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['petrol', 'diesel', 'electric', 'hybrid'].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Capacity (kg)</Label><Input type="number" value={form.capacity_kg} onChange={e => setForm(f => ({ ...f, capacity_kg: parseFloat(e.target.value) || '' }))} /></div>
              <div><Label>Assigned Driver</Label><Input value={form.assigned_driver} onChange={e => setForm(f => ({ ...f, assigned_driver: e.target.value }))} /></div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, status: 'available' })}>Add Vehicle</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}