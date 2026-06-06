import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Clock, Play, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const JOB_TYPES = [
  { value: 'inventory_optimization', label: '📦 Inventory Optimization', cron: '0 2 * * *', desc: 'Nightly EOQ & safety stock recalculation' },
  { value: 'forecast_generation', label: '🧠 Forecast Generation', cron: '0 3 * * 1', desc: 'Weekly AI demand forecast update' },
  { value: 'repricing', label: '💰 Dynamic Repricing', cron: '0 6 * * *', desc: 'Apply pricing rules to all products daily' },
  { value: 'data_warehouse_refresh', label: '🗄️ Data Warehouse Refresh', cron: '0 1 * * *', desc: 'Nightly KPI snapshot capture' },
  { value: 'kpi_snapshot', label: '📊 KPI Snapshot', cron: '0 0 1 * *', desc: 'Monthly KPI data capture' },
  { value: 'low_stock_alert', label: '🔔 Low Stock Alerts', cron: '0 8 * * *', desc: 'Daily low stock check and notifications' },
  { value: 'report_email', label: '📧 Report Email', cron: '0 9 * * 1', desc: 'Weekly performance report to managers' },
  { value: 'po_auto_create', label: '🛒 Auto PO Creation', cron: '0 7 * * *', desc: 'Auto-create POs for items at reorder point' },
];

const STATUS_ICONS = { success: CheckCircle, failed: XCircle, running: RefreshCw, skipped: Clock };
const STATUS_COLORS = { success: 'text-green-500', failed: 'text-red-500', running: 'text-blue-500', skipped: 'text-muted-foreground' };

function parseCron(cron) {
  const cronMap = {
    '0 2 * * *': 'Daily at 2:00 AM',
    '0 3 * * 1': 'Every Monday at 3:00 AM',
    '0 6 * * *': 'Daily at 6:00 AM',
    '0 1 * * *': 'Daily at 1:00 AM',
    '0 0 1 * *': '1st of every month',
    '0 8 * * *': 'Daily at 8:00 AM',
    '0 9 * * 1': 'Every Monday at 9:00 AM',
    '0 7 * * *': 'Daily at 7:00 AM',
  };
  return cronMap[cron] || cron;
}

export default function SchedulerEngine() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'custom', cron: '0 2 * * *', timeout_minutes: 30, notify_on_failure: '' });

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['scheduled_jobs'], queryFn: () => base44.entities.ScheduledJob.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.ScheduledJob.create(d),
    onSuccess: () => { qc.invalidateQueries(['scheduled_jobs']); setOpen(false); toast.success('Job scheduled'); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, v }) => base44.entities.ScheduledJob.update(id, { is_active: v }),
    onSuccess: () => qc.invalidateQueries(['scheduled_jobs']),
  });

  const runNow = (job) => {
    base44.entities.ScheduledJob.update(job.id, { last_run: new Date().toISOString(), last_status: 'success', run_count: (job.run_count || 0) + 1 });
    qc.invalidateQueries(['scheduled_jobs']);
    toast.success(`${job.name} executed`);
  };

  const selectJobType = (type) => {
    const meta = JOB_TYPES.find(j => j.value === type);
    if (meta) setForm(f => ({ ...f, type, name: f.name || meta.label.replace(/^.+ /, ''), cron: meta.cron }));
  };

  return (
    <div className="p-6">
      <PageHeader title="Scheduler & Job Engine" subtitle="Nightly optimization, forecast generation, repricing, reports & automated workflows">
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Schedule Job</Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Jobs', value: jobs.filter(j => j.is_active).length },
          { label: 'Total Runs', value: jobs.reduce((a, b) => a + (b.run_count || 0), 0) },
          { label: 'Failed Runs', value: jobs.reduce((a, b) => a + (b.error_count || 0), 0) },
          { label: 'Success Rate', value: (() => { const t = jobs.reduce((a, b) => a + (b.run_count || 0), 0); const e = jobs.reduce((a, b) => a + (b.error_count || 0), 0); return t > 0 ? `${Math.round(((t - e) / t) * 100)}%` : '—'; })() },
        ].map(s => <Card key={s.label}><CardContent className="pt-4"><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>)}
      </div>

      {/* Suggested Jobs */}
      {jobs.length < JOB_TYPES.length && (
        <div className="mb-6">
          <p className="text-sm font-medium mb-3 text-muted-foreground">Recommended Jobs</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {JOB_TYPES.filter(jt => !jobs.find(j => j.type === jt.value)).slice(0, 4).map(jt => (
              <Card key={jt.value} className="border-dashed opacity-70 hover:opacity-100 cursor-pointer hover:shadow-md transition-all" onClick={() => { selectJobType(jt.value); setOpen(true); }}>
                <CardContent className="py-3 px-3">
                  <p className="text-sm font-medium">{jt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{jt.desc}</p>
                  <p className="text-xs font-mono text-primary mt-1">{parseCron(jt.cron)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : jobs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Clock className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No scheduled jobs. Use recommended jobs above or create a custom one.</p></div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const StatusIcon = STATUS_ICONS[job.last_status] || Clock;
            return (
              <Card key={job.id} className={!job.is_active ? 'opacity-60' : ''}>
                <CardContent className="flex items-center gap-4 py-4">
                  <StatusIcon className={`w-5 h-5 flex-shrink-0 ${STATUS_COLORS[job.last_status] || 'text-muted-foreground'} ${job.last_status === 'running' ? 'animate-spin' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{job.name}</span>
                      <Badge variant="outline" className="capitalize text-xs">{job.type?.replace(/_/g, ' ')}</Badge>
                      {!job.is_active && <Badge variant="secondary">Paused</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{parseCron(job.cron)} · timeout: {job.timeout_minutes}m</p>
                    <p className="text-xs text-muted-foreground">
                      Runs: {job.run_count || 0} · Errors: {job.error_count || 0}
                      {job.last_run && ` · Last: ${new Date(job.last_run).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => runNow(job)}><Play className="w-3 h-3 mr-1" /> Run</Button>
                    <Switch checked={job.is_active} onCheckedChange={v => toggleMut.mutate({ id: job.id, v })} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule New Job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Job Type</Label>
              <Select value={form.type} onValueChange={selectJobType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{JOB_TYPES.map(j => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}<SelectItem value="custom">⚙️ Custom</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Job Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Cron Expression</Label><Input value={form.cron} onChange={e => setForm(f => ({ ...f, cron: e.target.value }))} className="font-mono" placeholder="0 2 * * *" /></div>
            {form.cron && <p className="text-xs text-primary">{parseCron(form.cron)}</p>}
            <div><Label>Timeout (minutes)</Label><Input type="number" value={form.timeout_minutes} onChange={e => setForm(f => ({ ...f, timeout_minutes: parseInt(e.target.value) || 30 }))} /></div>
            <div><Label>Notify on Failure (email)</Label><Input value={form.notify_on_failure} onChange={e => setForm(f => ({ ...f, notify_on_failure: e.target.value }))} placeholder="admin@company.com" /></div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, is_active: true, run_count: 0, error_count: 0 })}>Schedule Job</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}