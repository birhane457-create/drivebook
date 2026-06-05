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
import { Progress } from '@/components/ui/progress';
import { Plus, Waves, Play, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = { planned: 'secondary', released: 'outline', in_progress: 'default', completed: 'secondary', cancelled: 'destructive' };
const TYPE_COLORS = { wave: '#6366f1', zone: '#10b981', batch: '#f59e0b', single: '#6b7280' };

export default function PickWaveManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'wave', priority: 'normal', location_id: '', zone: '', assigned_to: '' });

  const { data: waves = [], isLoading } = useQuery({ queryKey: ['pick_waves'], queryFn: () => base44.entities.PickWave.list('-created_date') });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.PickWave.create(d),
    onSuccess: () => { qc.invalidateQueries(['pick_waves']); setOpen(false); toast.success('Wave created'); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PickWave.update(id, data),
    onSuccess: () => qc.invalidateQueries(['pick_waves']),
  });

  const release = (wave) => { updateMut.mutate({ id: wave.id, data: { status: 'released' } }); toast.success('Wave released'); };
  const start = (wave) => { updateMut.mutate({ id: wave.id, data: { status: 'in_progress' } }); };
  const complete = (wave) => { updateMut.mutate({ id: wave.id, data: { status: 'completed', completed_date: new Date().toISOString() } }); toast.success('Wave completed!'); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-4">
          {['wave', 'zone', 'batch', 'single'].map(t => (
            <div key={t} className="flex items-center gap-1 text-xs">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[t] }} />
              <span className="capitalize">{t}</span>
            </div>
          ))}
        </div>
        <Button onClick={() => setOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> New Wave</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground text-sm">Loading...</p> : waves.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Waves className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No pick waves yet. Create a wave to start directed picking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {waves.map(wave => {
            const pct = wave.total_lines > 0 ? Math.round((wave.completed_lines / wave.total_lines) * 100) : 0;
            return (
              <Card key={wave.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="w-2 h-12 rounded-full" style={{ background: TYPE_COLORS[wave.type] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-sm">{wave.wave_number || `WAVE-${wave.id?.slice(-6).toUpperCase()}`}</span>
                      <Badge variant={STATUS_COLORS[wave.status] || 'outline'}>{wave.status}</Badge>
                      <Badge variant="outline" className="capitalize">{wave.type}</Badge>
                      <Badge variant={wave.priority === 'urgent' ? 'destructive' : 'outline'} className="capitalize">{wave.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {wave.zone && `Zone: ${wave.zone} · `}
                      {wave.assigned_to && `Assigned to: ${wave.assigned_to} · `}
                      {wave.total_lines} lines
                    </p>
                    {wave.status === 'in_progress' && (
                      <div className="mt-2">
                        <Progress value={pct} className="h-1.5" />
                        <p className="text-xs text-muted-foreground mt-0.5">{pct}% picked ({wave.completed_lines}/{wave.total_lines})</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {wave.status === 'planned' && <Button size="sm" variant="outline" onClick={() => release(wave)}>Release</Button>}
                    {wave.status === 'released' && <Button size="sm" onClick={() => start(wave)}><Play className="w-3 h-3 mr-1" /> Start</Button>}
                    {wave.status === 'in_progress' && <Button size="sm" variant="outline" onClick={() => complete(wave)}><CheckCircle className="w-3 h-3 mr-1" /> Complete</Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Pick Wave</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[['wave', 'Wave Picking'], ['zone', 'Zone Picking'], ['batch', 'Batch Picking'], ['single', 'Single Order']].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Location</Label>
              <Select value={form.location_id} onValueChange={v => setForm(f => ({ ...f, location_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Zone (optional)</Label><Input value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} placeholder="e.g. PICK-A" /></div>
            <div><Label>Assign To</Label><Input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Picker name" /></div>
            <div><Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['low', 'normal', 'high', 'urgent'].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, status: 'planned', scheduled_date: new Date().toISOString().split('T')[0] })}>Create Wave</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}