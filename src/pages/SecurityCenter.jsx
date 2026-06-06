import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import PageHeader from '@/components/shared/PageHeader';
import {
  Shield, Key, Lock, AlertTriangle, CheckCircle, Eye, EyeOff, Plus,
  RefreshCw, Smartphone, Activity, XCircle, Trash2
} from 'lucide-react';

const THREAT_FEEDS = [
  { id: 1, type: 'Brute Force', source: '185.220.101.x', target: 'Login API', severity: 'high', count: 847, status: 'blocked', time: '3 min ago' },
  { id: 2, type: 'SQL Injection', source: '92.63.197.x', target: 'Inventory API', severity: 'critical', count: 12, status: 'blocked', time: '15 min ago' },
  { id: 3, type: 'Unusual Access', source: 'Internal', target: 'Finance Module', severity: 'medium', count: 1, status: 'investigating', time: '1 hr ago' },
  { id: 4, type: 'API Abuse', source: '34.201.x.x', target: 'Reports API', severity: 'low', count: 2340, status: 'rate_limited', time: '2 hr ago' },
];

const DEVICE_TRUST = [
  { device: 'MacBook Pro - Admin', user: 'John Admin', status: 'trusted', last_seen: '2 min ago', os: 'macOS 14.2', location: 'New York, US' },
  { device: 'Windows Laptop - Finance', user: 'Sarah CFO', status: 'trusted', last_seen: '45 min ago', os: 'Windows 11', location: 'Chicago, US' },
  { device: 'iPhone 15 - Ops', user: 'Mike Ops', status: 'trusted', last_seen: '2 hr ago', os: 'iOS 17', location: 'Los Angeles, US' },
  { device: 'Unknown Device', user: 'tom@supplier.com', status: 'pending', last_seen: '30 min ago', os: 'Unknown', location: 'Kyiv, UA' },
];

const SECURITY_SCORE = {
  overall: 84,
  categories: [
    { name: 'Identity & Access', score: 92, issues: 1 },
    { name: 'Data Encryption', score: 95, issues: 0 },
    { name: 'Network Security', score: 78, issues: 3 },
    { name: 'Secrets Management', score: 88, issues: 2 },
    { name: 'Device Trust', score: 72, issues: 4 },
    { name: 'Audit & Compliance', score: 90, issues: 1 },
  ]
};

export default function SecurityCenter() {
  const [showSecret, setShowSecret] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState({});
  const [secretForm, setSecretForm] = useState({ name: '', key: '', type: 'api_key', environment: 'all', rotation_policy: '90d' });
  const qc = useQueryClient();

  const { data: secrets = [] } = useQuery({
    queryKey: ['secrets'],
    queryFn: () => base44.entities.SecretEntry.list('-created_date', 50),
  });

  const createSecretMut = useMutation({
    mutationFn: (d) => base44.entities.SecretEntry.create(d),
    onSuccess: () => { qc.invalidateQueries(['secrets']); setShowSecret(false); setSecretForm({ name: '', key: '', type: 'api_key', environment: 'all', rotation_policy: '90d' }); },
  });

  const deleteSecretMut = useMutation({
    mutationFn: (id) => base44.entities.SecretEntry.delete(id),
    onSuccess: () => qc.invalidateQueries(['secrets']),
  });

  function maskKey(key) {
    if (!key) return '••••••••••••••••';
    return key.slice(0, 4) + '••••••••••••' + key.slice(-4);
  }

  const severityColor = { critical: 'bg-red-100 text-red-800', high: 'bg-orange-100 text-orange-800', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-blue-100 text-blue-800' };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Security Center" subtitle="Secrets · Encryption · Device trust · Threat monitoring · Security dashboard">
        <Button size="sm" className="gap-2" onClick={() => setShowSecret(true)}>
          <Plus className="w-4 h-4" /> Add Secret
        </Button>
      </PageHeader>

      {/* Security Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-6 text-center">
            <div className="text-6xl font-bold text-green-600 mb-2">{SECURITY_SCORE.overall}</div>
            <p className="text-sm font-medium text-green-700">Security Score</p>
            <p className="text-xs text-muted-foreground mt-1">Good — 11 issues to review</p>
          </CardContent>
        </Card>
        <div className="md:col-span-2 grid grid-cols-2 gap-3">
          {SECURITY_SCORE.categories.map(cat => (
            <Card key={cat.name}>
              <CardContent className="p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium">{cat.name}</span>
                  <span className={`text-xs font-bold ${cat.score >= 90 ? 'text-green-600' : cat.score >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>{cat.score}</span>
                </div>
                <Progress value={cat.score} className="h-1.5" />
                {cat.issues > 0 && <p className="text-[10px] text-orange-600 mt-1">{cat.issues} issue{cat.issues > 1 ? 's' : ''}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Tabs defaultValue="secrets">
        <TabsList>
          <TabsTrigger value="secrets">Secrets Management</TabsTrigger>
          <TabsTrigger value="threats">Threat Monitoring</TabsTrigger>
          <TabsTrigger value="devices">Device Trust</TabsTrigger>
          <TabsTrigger value="encryption">Encryption Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="secrets" className="space-y-3">
          {secrets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No secrets configured. <button onClick={() => setShowSecret(true)} className="text-primary underline">Add one</button>
            </div>
          )}
          {secrets.map(secret => (
            <Card key={secret.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <Key className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{secret.name}</span>
                    <Badge variant="outline" className="text-[10px]">{secret.type}</Badge>
                    <Badge variant="outline" className="text-[10px]">{secret.environment}</Badge>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {revealedKeys[secret.id] ? secret.key : maskKey(secret.key)}
                  </p>
                  {secret.last_rotated && (
                    <p className="text-[10px] text-muted-foreground">Last rotated: {secret.last_rotated} · Policy: {secret.rotation_policy}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRevealedKeys(p => ({ ...p, [secret.id]: !p[secret.id] }))}>
                    {revealedKeys[secret.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteSecretMut.mutate(secret.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="threats" className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-600">Live threat monitoring active</span>
          </div>
          {THREAT_FEEDS.map(threat => (
            <Card key={threat.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${threat.severity === 'critical' ? 'text-red-600' : threat.severity === 'high' ? 'text-orange-500' : 'text-yellow-500'}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{threat.type}</span>
                    <Badge className={`text-[10px] ${severityColor[threat.severity]}`}>{threat.severity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{threat.source} → {threat.target} · {threat.count} events · {threat.time}</p>
                </div>
                <Badge variant={threat.status === 'blocked' ? 'outline' : 'secondary'} className={`text-[10px] ${threat.status === 'blocked' ? 'text-green-600' : threat.status === 'investigating' ? 'text-yellow-600' : ''}`}>
                  {threat.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="devices" className="space-y-3">
          {DEVICE_TRUST.map((device, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-4">
                <Smartphone className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{device.device}</span>
                    <Badge className={`text-[10px] ${device.status === 'trusted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{device.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{device.user} · {device.os} · {device.location} · {device.last_seen}</p>
                </div>
                <div className="flex gap-1">
                  {device.status === 'pending' && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-green-600">Trust</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600">Block</Button>
                    </>
                  )}
                  {device.status === 'trusted' && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground">Revoke</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="encryption">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Database Encryption Key', algo: 'AES-256-GCM', rotated: '2025-04-01', expires: '2026-04-01', status: 'active' },
              { name: 'API Token Signing Key', algo: 'RS256', rotated: '2025-05-15', expires: '2026-05-15', status: 'active' },
              { name: 'File Storage Key', algo: 'AES-256-CBC', rotated: '2025-03-01', expires: '2025-09-01', status: 'expiring_soon' },
              { name: 'Backup Encryption Key', algo: 'ChaCha20', rotated: '2025-01-01', expires: '2026-01-01', status: 'active' },
            ].map((key, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{key.name}</p>
                      <p className="text-xs text-muted-foreground">{key.algo}</p>
                    </div>
                    <Badge className={`text-[10px] ${key.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{key.status.replace('_', ' ')}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Rotated: {key.rotated}</div>
                    <div>Expires: {key.expires}</div>
                  </div>
                  <Button size="sm" variant="outline" className="mt-3 h-7 text-xs gap-1">
                    <RefreshCw className="w-3 h-3" /> Rotate Key
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Secret Dialog */}
      <Dialog open={showSecret} onOpenChange={setShowSecret}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Secret</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={secretForm.name} onChange={e => setSecretForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Stripe API Key" /></div>
            <div><Label>Secret Value</Label><Input type="password" value={secretForm.key} onChange={e => setSecretForm(p => ({ ...p, key: e.target.value }))} placeholder="sk_live_..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={secretForm.type} onValueChange={v => setSecretForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['api_key', 'db_credential', 'oauth_token', 'encryption_key', 'certificate', 'webhook_secret'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rotation Policy</Label>
                <Select value={secretForm.rotation_policy} onValueChange={v => setSecretForm(p => ({ ...p, rotation_policy: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['never', '30d', '60d', '90d', '180d'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSecret(false)}>Cancel</Button>
              <Button onClick={() => createSecretMut.mutate(secretForm)} disabled={!secretForm.name || !secretForm.key}>Save Secret</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}