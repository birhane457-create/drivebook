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
import { Plus, MapPin, Truck, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = { planned: 'secondary', dispatched: 'default', in_transit: 'default', completed: 'secondary', failed: 'destructive' };

export default function DeliveryRouteList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', driver_name: '', driver_phone: '', vehicle_plate: '', scheduled_date: new Date().toISOString().split('T')[0] });

  const { data: routes = [], isLoading } = useQuery({ queryKey: ['delivery_routes'], queryFn: () => base44.entities.DeliveryRoute.list('-created_date') });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.DeliveryRoute.create(d),
    onSuccess: () => { qc.invalidateQueries(['delivery_routes']); setOpen(false); toast.success('Route created'); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DeliveryRoute.update(id, data),
    onSuccess: () => qc.invalidateQueries(['delivery_routes']),
  });

  const dispatch = (route) => { updateMut.mutate({ id: route.id, data: { status: 'dispatched', departure_time: new Date().toISOString() } }); toast.success('Route dispatched!'); };
  const complete = (route) => { updateMut.mutate({ id: route.id, data: { status: 'completed', arrival_time: new Date().toISOString() } }); toast.success('Route completed!'); };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Route</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : routes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Truck className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No delivery routes yet.</p></div>
      ) : (
        <div className="space-y-3">
          {routes.map(route => {
            const pct = route.total_stops > 0 ? Math.round((route.completed_stops / route.total_stops) * 100) : 0;
            return (
              <Card key={route.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{route.name}</span>
                      <Badge variant={STATUS_COLORS[route.status] || 'outline'}>{route.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {route.driver_name && `Driver: ${route.driver_name}`}
                      {route.vehicle_plate && ` · ${route.vehicle_plate}`}
                      {route.scheduled_date && ` · ${route.scheduled_date}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" /> {route.total_stops || 0} stops · {route.completed_stops || 0} completed
                    </div>
                    {route.status === 'in_transit' && <Progress value={pct} className="h-1.5 mt-1" />}
                  </div>
                  <div className="flex gap-2">
                    {route.status === 'planned' && <Button size="sm" onClick={() => dispatch(route)}><Truck className="w-3 h-3 mr-1" /> Dispatch</Button>}
                    {(route.status === 'dispatched' || route.status === 'in_transit') && <Button size="sm" variant="outline" onClick={() => complete(route)}><CheckCircle className="w-3 h-3 mr-1" /> Complete</Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Delivery Route</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Route Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. North Zone Route" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Driver Name</Label><Input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} /></div>
              <div><Label>Driver Phone</Label><Input value={form.driver_phone} onChange={e => setForm(f => ({ ...f, driver_phone: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Vehicle</Label>
              <Select value={form.vehicle_id} onValueChange={v => { const vh = vehicles.find(vv => vv.id === v); setForm(f => ({ ...f, vehicle_id: v, vehicle_plate: vh?.plate_number || '' })); }}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.plate_number})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Scheduled Date</Label><Input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} /></div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, status: 'planned', total_stops: 0, completed_stops: 0 })}>Create Route</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}