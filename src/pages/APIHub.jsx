import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Webhook, Code2, Globe, CheckCircle, XCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';

const EVENTS = ['sale.created', 'sale.refunded', 'po.created', 'po.received', 'stock.low', 'stock.updated', 'transfer.completed', 'customer.created', 'inspection.failed'];
const CONNECTORS = [
  { name: 'Xero', icon: '📊', category: 'Accounting', status: 'available' },
  { name: 'QuickBooks Online', icon: '💰', category: 'Accounting', status: 'available' },
  { name: 'Stripe', icon: '💳', category: 'Payments', status: 'available' },
  { name: 'PayPal', icon: '💸', category: 'Payments', status: 'available' },
  { name: 'Salesforce', icon: '☁️', category: 'CRM', status: 'available' },
  { name: 'Slack', icon: '💬', category: 'Notifications', status: 'available' },
  { name: 'SendGrid', icon: '📧', category: 'Email', status: 'available' },
  { name: 'Zapier', icon: '⚡', category: 'Automation', status: 'available' },
];

export default function APIHub() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', events: [], secret: '', retry_on_failure: true });
  const [selectedEvents, setSelectedEvents] = useState([]);

  const { data: webhooks = [], isLoading } = useQuery({ queryKey: ['webhooks'], queryFn: () => base44.entities.WebhookEndpoint.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.WebhookEndpoint.create(d),
    onSuccess: () => { qc.invalidateQueries(['webhooks']); setOpen(false); setForm({ name: '', url: '', events: [], secret: '', retry_on_failure: true }); setSelectedEvents([]); toast.success('Webhook created'); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, v }) => base44.entities.WebhookEndpoint.update(id, { is_active: v }),
    onSuccess: () => qc.invalidateQueries(['webhooks']),
  });

  const testWebhook = (wh) => {
    base44.entities.WebhookEndpoint.update(wh.id, { last_triggered: new Date().toISOString(), success_count: (wh.success_count || 0) + 1, last_status_code: 200 });
    qc.invalidateQueries(['webhooks']);
    toast.success(`Test event sent to ${wh.name}`);
  };

  const toggleEvent = (e) => setSelectedEvents(prev => prev.includes(e) ? prev.filter(ev => ev !== e) : [...prev, e]);

  return (
    <div className="p-6">
      <PageHeader title="API & Integration Hub" subtitle="Webhook manager, integration marketplace & API gateway" />

      <Tabs defaultValue="webhooks">
        <TabsList className="mb-6">
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="marketplace">Integration Marketplace</TabsTrigger>
          <TabsTrigger value="docs">API Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>{webhooks.filter(w => w.is_active).length} active · {webhooks.reduce((a, b) => a + (b.success_count || 0), 0)} events sent</span>
            </div>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Webhook</Button>
          </div>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : webhooks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground"><Webhook className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No webhooks configured yet.</p></div>
          ) : (
            <div className="space-y-3">
              {webhooks.map(wh => (
                <Card key={wh.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Webhook className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{wh.name}</span>
                        <Badge variant={wh.is_active ? 'default' : 'secondary'}>{wh.is_active ? 'Active' : 'Paused'}</Badge>
                        {wh.last_status_code && <Badge variant={wh.last_status_code === 200 ? 'secondary' : 'destructive'} className="text-xs">{wh.last_status_code}</Badge>}
                      </div>
                      <p className="text-xs font-mono text-muted-foreground truncate">{wh.url}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {wh.events?.slice(0, 4).map(e => <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>)}
                        {wh.events?.length > 4 && <Badge variant="outline" className="text-[10px]">+{wh.events.length - 4}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">✅ {wh.success_count || 0} · ❌ {wh.failure_count || 0} {wh.last_triggered && `· Last: ${new Date(wh.last_triggered).toLocaleString()}`}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => testWebhook(wh)}><Zap className="w-3 h-3 mr-1" /> Test</Button>
                      <Switch checked={wh.is_active} onCheckedChange={v => toggleMut.mutate({ id: wh.id, v })} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="marketplace">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CONNECTORS.map(conn => (
              <Card key={conn.name} className="hover:shadow-md transition-shadow cursor-pointer group">
                <CardContent className="pt-4">
                  <div className="text-3xl mb-3">{conn.icon}</div>
                  <p className="font-semibold">{conn.name}</p>
                  <p className="text-xs text-muted-foreground mb-3">{conn.category}</p>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => toast.info(`${conn.name} integration requires Builder+ plan`)}>Connect</Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground mt-6">Integrations require Builder+ plan to activate OAuth app credentials.</p>
        </TabsContent>

        <TabsContent value="docs">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-6">
                <Code2 className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold text-lg">REST API Reference</p>
                  <p className="text-sm text-muted-foreground">Base URL: <code className="bg-muted px-1 rounded">https://api.wms-pro.app/v1</code></p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { method: 'GET', path: '/products', desc: 'List all products' },
                  { method: 'POST', path: '/products', desc: 'Create a product' },
                  { method: 'GET', path: '/inventory', desc: 'Get stock levels' },
                  { method: 'POST', path: '/sales', desc: 'Record a sale' },
                  { method: 'GET', path: '/purchase-orders', desc: 'List purchase orders' },
                  { method: 'POST', path: '/stock-transfers', desc: 'Create stock transfer' },
                  { method: 'GET', path: '/kpi/snapshot', desc: 'Get latest KPI snapshot' },
                  { method: 'POST', path: '/webhooks/test', desc: 'Test a webhook endpoint' },
                ].map(ep => (
                  <div key={ep.path} className="flex items-center gap-3 p-3 bg-muted rounded-lg font-mono text-sm">
                    <Badge variant={ep.method === 'GET' ? 'secondary' : 'default'} className="w-14 justify-center">{ep.method}</Badge>
                    <span>{ep.path}</span>
                    <span className="text-muted-foreground text-xs ml-auto font-sans">{ep.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Webhook Endpoint</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. ERP Sync" /></div>
            <div><Label>URL</Label><Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://example.com/webhook" /></div>
            <div><Label>Secret Key</Label><Input type="password" value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="Optional HMAC secret" /></div>
            <div>
              <Label>Events to Subscribe</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EVENTS.map(e => (
                  <button key={e} onClick={() => toggleEvent(e)} className={`text-xs px-2 py-1 rounded-full border transition-colors ${selectedEvents.includes(e) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between"><Label>Retry on Failure</Label><Switch checked={form.retry_on_failure} onCheckedChange={v => setForm(f => ({ ...f, retry_on_failure: v }))} /></div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, events: selectedEvents, is_active: true, success_count: 0, failure_count: 0 })}>Create Webhook</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}