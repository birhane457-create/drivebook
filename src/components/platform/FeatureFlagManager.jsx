import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Flag } from 'lucide-react';
import { toast } from 'sonner';

export default function FeatureFlagManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', description: '', is_enabled: false, rollout_pct: 0, environment: 'all' });

  const { data: flags = [], isLoading } = useQuery({ queryKey: ['feature_flags'], queryFn: () => base44.entities.FeatureFlag.list() });

  const createMut = useMutation({ mutationFn: d => base44.entities.FeatureFlag.create(d), onSuccess: () => { qc.invalidateQueries(['feature_flags']); setOpen(false); toast.success('Flag created'); } });
  const toggleMut = useMutation({ mutationFn: ({ id, v }) => base44.entities.FeatureFlag.update(id, { is_enabled: v }), onSuccess: () => qc.invalidateQueries(['feature_flags']) });

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Flag</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : flags.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Flag className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No feature flags yet.</p></div>
      ) : (
        <div className="space-y-2">
          {flags.map(f => (
            <Card key={f.id}>
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-sm font-bold">{f.key}</span>
                    <span className="text-sm text-muted-foreground">— {f.name}</span>
                    <Badge variant="outline" className="text-xs capitalize">{f.environment}</Badge>
                  </div>
                  {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                  <p className="text-xs text-muted-foreground">Rollout: {f.rollout_pct || 0}%</p>
                </div>
                <Switch checked={f.is_enabled} onCheckedChange={v => toggleMut.mutate({ id: f.id, v })} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Feature Flag</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Key</Label><Input className="font-mono" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s/g, '_') }))} placeholder="enable_new_feature" /></div>
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Rollout %</Label><Input type="number" min={0} max={100} value={form.rollout_pct} onChange={e => setForm(f => ({ ...f, rollout_pct: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Environment</Label>
                <select className="w-full h-9 border rounded px-2 text-sm" value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))}>
                  {['all', 'production', 'staging', 'dev'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate(form)}>Create Flag</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}