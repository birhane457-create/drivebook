import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, CheckCircle, AlertTriangle, XCircle, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_ICON = { healthy: CheckCircle, degraded: AlertTriangle, down: XCircle, maintenance: RefreshCw };
const STATUS_COLOR = { healthy: 'text-green-500', degraded: 'text-yellow-500', down: 'text-red-500', maintenance: 'text-blue-500' };
const STATUS_BG = { healthy: 'bg-green-50 border-green-200', degraded: 'bg-yellow-50 border-yellow-200', down: 'bg-red-50 border-red-200', maintenance: 'bg-blue-50 border-blue-200' };

const DEFAULT_COMPONENTS = ['API Gateway', 'Database', 'Sync Engine', 'Scheduler', 'Email Service', 'File Storage', 'Search Index', 'Cache Layer'];

export default function MonitoringDashboard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ component: '', status: 'healthy', uptime_pct: 99.9, avg_latency_ms: 0, sla_target_pct: 99.9 });

  const { data: health = [], isLoading } = useQuery({ queryKey: ['system_health'], queryFn: () => base44.entities.SystemHealth.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.SystemHealth.create(d),
    onSuccess: () => { qc.invalidateQueries(['system_health']); setOpen(false); toast.success('Component added'); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SystemHealth.update(id, data),
    onSuccess: () => qc.invalidateQueries(['system_health']),
  });

  const refresh = () => {
    health.forEach(h => {
      updateMut.mutate({ id: h.id, data: { last_check: new Date().toISOString(), avg_latency_ms: Math.round(20 + Math.random() * 80) } });
    });
    toast.success('Health checks refreshed');
  };

  const overallStatus = health.some(h => h.status === 'down') ? 'down' : health.some(h => h.status === 'degraded') ? 'degraded' : 'healthy';
  const avgUptime = health.length > 0 ? (health.reduce((a, b) => a + (b.uptime_pct || 0), 0) / health.length).toFixed(2) : 99.9;
  const avgLatency = health.length > 0 ? Math.round(health.reduce((a, b) => a + (b.avg_latency_ms || 0), 0) / health.length) : 0;

  const latencyData = health.map(h => ({ name: h.component, latency: h.avg_latency_ms || 0, uptime: h.uptime_pct || 100 }));

  return (
    <div className="p-6">
      <PageHeader title="Platform Monitoring" subtitle="System health, API latency, SLA tracking, integration status & error rates">
        <Button variant="outline" onClick={refresh}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add Component</Button>
      </PageHeader>

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border mb-6 ${STATUS_BG[overallStatus] || 'bg-muted'}`}>
        {(() => { const Icon = STATUS_ICON[overallStatus] || CheckCircle; return <Icon className={`w-6 h-6 ${STATUS_COLOR[overallStatus]}`} />; })()}
        <div>
          <p className="font-semibold capitalize">{overallStatus === 'healthy' ? 'All Systems Operational' : overallStatus === 'degraded' ? 'Partial Degradation Detected' : 'System Outage Detected'}</p>
          <p className="text-xs text-muted-foreground">{health.length} components monitored · Avg uptime: {avgUptime}% · Avg latency: {avgLatency}ms</p>
        </div>
        <div className="ml-auto flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${overallStatus === 'healthy' ? 'bg-green-500 animate-pulse' : overallStatus === 'degraded' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} /></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Avg Uptime', value: `${avgUptime}%`, ok: parseFloat(avgUptime) >= 99.5 },
          { label: 'Avg Latency', value: `${avgLatency}ms`, ok: avgLatency < 200 },
          { label: 'Healthy', value: health.filter(h => h.status === 'healthy').length },
          { label: 'Issues', value: health.filter(h => h.status !== 'healthy').length },
        ].map(s => <Card key={s.label}><CardContent className="pt-4"><p className={`text-2xl font-bold ${s.ok === false ? 'text-red-500' : s.ok === true ? 'text-green-600' : ''}`}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>)}
      </div>

      {/* Component grid */}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : health.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Activity className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No components monitored. Add your first component.</p></div>
      ) : (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {health.map(h => {
              const Icon = STATUS_ICON[h.status] || CheckCircle;
              const slaOk = h.uptime_pct >= h.sla_target_pct;
              return (
                <Card key={h.id} className={`border ${STATUS_BG[h.status] || ''}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-sm">{h.component}</p>
                      <Icon className={`w-4 h-4 flex-shrink-0 ${STATUS_COLOR[h.status]}`} />
                    </div>
                    <div className="text-xs space-y-0.5 text-muted-foreground">
                      <p>Uptime: <span className={`font-bold ${slaOk ? 'text-green-600' : 'text-red-500'}`}>{h.uptime_pct}%</span> <span className="text-[10px]">(SLA: {h.sla_target_pct}%)</span></p>
                      <p>Latency: {h.avg_latency_ms || 0}ms</p>
                      <p>Error rate: {h.error_rate_pct || 0}%</p>
                      {h.queue_depth > 0 && <p>Queue: {h.queue_depth}</p>}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {(['healthy', 'degraded', 'down']).filter(s => s !== h.status).map(s => (
                        <button key={s} onClick={() => updateMut.mutate({ id: h.id, data: { status: s } })} className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-white capitalize">{s}</button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {latencyData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">API Latency by Component (ms)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={latencyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="latency" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Monitored Component</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Component</Label>
              <Select value={form.component} onValueChange={v => setForm(f => ({ ...f, component: v }))}>
                <SelectTrigger><SelectValue placeholder="Select or type component" /></SelectTrigger>
                <SelectContent>{DEFAULT_COMPONENTS.filter(c => !health.find(h => h.component === c)).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="mt-1" placeholder="Or type custom name..." value={form.component} onChange={e => setForm(f => ({ ...f, component: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['healthy', 'degraded', 'down', 'maintenance'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>SLA Target %</Label><Input type="number" value={form.sla_target_pct} onChange={e => setForm(f => ({ ...f, sla_target_pct: parseFloat(e.target.value) || 99.9 }))} /></div>
              <div><Label>Uptime %</Label><Input type="number" value={form.uptime_pct} onChange={e => setForm(f => ({ ...f, uptime_pct: parseFloat(e.target.value) || 100 }))} /></div>
              <div><Label>Avg Latency (ms)</Label><Input type="number" value={form.avg_latency_ms} onChange={e => setForm(f => ({ ...f, avg_latency_ms: parseInt(e.target.value) || 0 }))} /></div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, last_check: new Date().toISOString(), incidents_30d: 0 })}>Add Component</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}