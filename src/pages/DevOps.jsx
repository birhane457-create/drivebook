import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/shared/PageHeader';
import { GitBranch, CheckCircle, XCircle, Clock, RefreshCw, RotateCcw, Play, Plus, Server, Layers } from 'lucide-react';

const ENV_COLORS = {
  development: 'bg-blue-100 text-blue-800',
  staging: 'bg-yellow-100 text-yellow-800',
  production: 'bg-green-100 text-green-800',
  hotfix: 'bg-red-100 text-red-800',
};

const STATUS_ICON = {
  success: <CheckCircle className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  running: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
  pending: <Clock className="w-4 h-4 text-yellow-500" />,
  rolled_back: <RotateCcw className="w-4 h-4 text-orange-500" />,
};

const SAMPLE_DEPLOYMENTS = [
  { version: 'v2.14.3', environment: 'production', status: 'success', branch: 'main', commit_sha: 'a1b2c3d', deployed_by: 'CI/CD Pipeline', duration_seconds: 127, health_check_passed: true, changes: ['Fix: inventory sync race condition', 'Feat: AI copilot integration', 'Perf: reduce API latency by 40%'], created_date: new Date(Date.now() - 3600000).toISOString() },
  { version: 'v2.14.2', environment: 'production', status: 'success', branch: 'main', commit_sha: 'e4f5g6h', deployed_by: 'CI/CD Pipeline', duration_seconds: 115, health_check_passed: true, changes: ['Fix: PO approval workflow bug'], created_date: new Date(Date.now() - 86400000).toISOString() },
  { version: 'v2.14.3-rc1', environment: 'staging', status: 'success', branch: 'release/2.14.3', commit_sha: 'a1b2c3c', deployed_by: 'DevOps Team', duration_seconds: 89, health_check_passed: true, changes: ['RC build for staging validation'], created_date: new Date(Date.now() - 7200000).toISOString() },
  { version: 'v2.14.1', environment: 'production', status: 'rolled_back', branch: 'main', commit_sha: 'x9y8z7w', deployed_by: 'CI/CD Pipeline', duration_seconds: 200, health_check_passed: false, rollback_version: 'v2.14.0', changes: ['Feat: new pricing engine'], created_date: new Date(Date.now() - 172800000).toISOString() },
  { version: 'v2.15.0-dev', environment: 'development', status: 'running', branch: 'feature/event-bus', commit_sha: 'b2c3d4e', deployed_by: 'Dev Team', duration_seconds: null, health_check_passed: null, changes: ['WIP: event bus implementation'], created_date: new Date(Date.now() - 600000).toISOString() },
];

const ENVIRONMENTS = [
  { name: 'Production', env: 'production', version: 'v2.14.3', health: 'healthy', pods: 12, cpu: 42, mem: 68 },
  { name: 'Staging', env: 'staging', version: 'v2.14.3-rc1', health: 'healthy', pods: 4, cpu: 28, mem: 45 },
  { name: 'Development', env: 'development', version: 'v2.15.0-dev', health: 'degraded', pods: 2, cpu: 78, mem: 82 },
];

const PIPELINE_STAGES = [
  { name: 'Source', status: 'success', duration: '0:05' },
  { name: 'Build', status: 'success', duration: '1:32' },
  { name: 'Unit Tests', status: 'success', duration: '2:14' },
  { name: 'Integration Tests', status: 'success', duration: '3:47' },
  { name: 'Security Scan', status: 'success', duration: '1:20' },
  { name: 'Deploy Staging', status: 'success', duration: '1:29' },
  { name: 'Smoke Tests', status: 'success', duration: '0:45' },
  { name: 'Deploy Production', status: 'success', duration: '2:07' },
];

function DeploymentRow({ dep, onRollback }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{STATUS_ICON[dep.status] || STATUS_ICON.pending}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-sm">{dep.version}</span>
              <Badge className={`text-[10px] ${ENV_COLORS[dep.environment]}`}>{dep.environment}</Badge>
              <Badge variant="outline" className="text-[10px] font-mono">{dep.commit_sha}</Badge>
              <span className="text-[10px] text-muted-foreground">↗ {dep.branch}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              By {dep.deployed_by} · {dep.created_date ? new Date(dep.created_date).toLocaleString() : ''}
              {dep.duration_seconds && ` · ${dep.duration_seconds}s`}
            </p>
            <div className="flex gap-1 mt-1 flex-wrap">
              {dep.changes?.slice(0, 2).map((c, i) => (
                <span key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded">{c}</span>
              ))}
              {dep.changes?.length > 2 && <span className="text-[10px] text-muted-foreground">+{dep.changes.length - 2} more</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dep.health_check_passed === false && (
              <Badge variant="destructive" className="text-[10px]">Health Check Failed</Badge>
            )}
            {dep.status === 'success' && dep.environment === 'production' && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onRollback(dep)}>
                <RotateCcw className="w-3 h-3" /> Rollback
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DevOps() {
  const [envFilter, setEnvFilter] = useState('all');
  const [showDeploy, setShowDeploy] = useState(false);
  const [deployForm, setDeployForm] = useState({ version: '', environment: 'staging', branch: 'main', notes: '' });
  const qc = useQueryClient();

  const { data: deployments = [] } = useQuery({
    queryKey: ['deployments'],
    queryFn: () => base44.entities.DeploymentRecord.list('-created_date', 50),
  });

  const deployMut = useMutation({
    mutationFn: (d) => base44.entities.DeploymentRecord.create({ ...d, status: 'pending', deployed_by: 'Manual Trigger', started_at: new Date().toISOString() }),
    onSuccess: () => { qc.invalidateQueries(['deployments']); setShowDeploy(false); },
  });

  const rollbackMut = useMutation({
    mutationFn: (dep) => base44.entities.DeploymentRecord.create({
      version: dep.rollback_version || 'previous',
      environment: dep.environment,
      branch: dep.branch,
      deployed_by: 'Rollback Trigger',
      status: 'pending',
      notes: `Rollback from ${dep.version}`,
    }),
    onSuccess: () => qc.invalidateQueries(['deployments']),
  });

  const allDeps = [...SAMPLE_DEPLOYMENTS.map((d, i) => ({ ...d, id: `s-${i}` })), ...deployments];
  const filtered = allDeps.filter(d => envFilter === 'all' || d.environment === envFilter);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="DevOps" subtitle="Environment management · CI/CD tracking · Deployment history · Rollback controls">
        <Button size="sm" className="gap-2" onClick={() => setShowDeploy(true)}>
          <Play className="w-4 h-4" /> Trigger Deploy
        </Button>
      </PageHeader>

      {/* Environments */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ENVIRONMENTS.map(env => (
          <Card key={env.env}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">{env.name}</h4>
                <Badge className={`ml-auto text-[10px] ${ENV_COLORS[env.env]}`}>{env.env}</Badge>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono font-medium">{env.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pods</span>
                  <span>{env.pods} running</span>
                </div>
                <div>
                  <div className="flex justify-between mb-1"><span className="text-muted-foreground">CPU</span><span>{env.cpu}%</span></div>
                  <Progress value={env.cpu} className={`h-1 ${env.cpu > 70 ? '[&>div]:bg-orange-500' : ''}`} />
                </div>
                <div>
                  <div className="flex justify-between mb-1"><span className="text-muted-foreground">Memory</span><span>{env.mem}%</span></div>
                  <Progress value={env.mem} className={`h-1 ${env.mem > 70 ? '[&>div]:bg-orange-500' : ''}`} />
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <span className={`w-2 h-2 rounded-full ${env.health === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className={env.health === 'healthy' ? 'text-green-600' : 'text-yellow-600'}>{env.health}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Deployment History</TabsTrigger>
          <TabsTrigger value="pipeline">CI/CD Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-3">
          <div className="flex gap-2">
            <Select value={envFilter} onValueChange={setEnvFilter}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                {['production', 'staging', 'development', 'hotfix'].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {filtered.map((dep, i) => (
            <DeploymentRow key={dep.id || i} dep={dep} onRollback={(d) => rollbackMut.mutate(d)} />
          ))}
        </TabsContent>

        <TabsContent value="pipeline">
          <Card>
            <CardHeader><CardTitle className="text-sm">Latest Pipeline: v2.14.3 → Production</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                {PIPELINE_STAGES.map((stage, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="text-center">
                      <div className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${stage.status === 'success' ? 'bg-green-50 border-green-200 text-green-700' : stage.status === 'running' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        {STATUS_ICON[stage.status]}
                        {stage.name}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stage.duration}</p>
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && <div className="w-6 h-px bg-border" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Deploy Dialog */}
      <Dialog open={showDeploy} onOpenChange={setShowDeploy}>
        <DialogContent>
          <DialogHeader><DialogTitle>Trigger Deployment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Version</Label><Input value={deployForm.version} onChange={e => setDeployForm(p => ({ ...p, version: e.target.value }))} placeholder="e.g. v2.15.0" /></div>
            <div>
              <Label>Environment</Label>
              <Select value={deployForm.environment} onValueChange={v => setDeployForm(p => ({ ...p, environment: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['development', 'staging', 'production'].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Branch</Label><Input value={deployForm.branch} onChange={e => setDeployForm(p => ({ ...p, branch: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeploy(false)}>Cancel</Button>
              <Button onClick={() => deployMut.mutate(deployForm)} disabled={!deployForm.version}>Deploy</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}