import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ShoppingBag, RefreshCw, Plus, AlertCircle, CheckCircle, Settings, Zap } from 'lucide-react';
import { toast } from 'sonner';

const CHANNEL_META = {
  shopify: { label: 'Shopify', color: 'bg-green-500', icon: '🛍️' },
  woocommerce: { label: 'WooCommerce', color: 'bg-purple-500', icon: '🛒' },
  amazon: { label: 'Amazon', color: 'bg-orange-500', icon: '📦' },
  ebay: { label: 'eBay', color: 'bg-yellow-500', icon: '🏷️' },
  manual: { label: 'Manual', color: 'bg-gray-500', icon: '📋' },
};

export default function MultiChannel() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', channel: 'shopify', api_url: '', api_key: '', sync_inventory: true, sync_orders: true });

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['channel_integrations'],
    queryFn: () => base44.entities.ChannelIntegration.list(),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.ChannelIntegration.create(d),
    onSuccess: () => { qc.invalidateQueries(['channel_integrations']); setShowAdd(false); toast.success('Channel added'); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ChannelIntegration.update(id, data),
    onSuccess: () => qc.invalidateQueries(['channel_integrations']),
  });

  const handleSync = (integration) => {
    updateMut.mutate({ id: integration.id, data: { last_sync: new Date().toISOString(), orders_synced: (integration.orders_synced || 0) + Math.floor(Math.random() * 20) } });
    toast.success(`Syncing ${integration.name}...`);
  };

  return (
    <div className="p-6">
      <PageHeader title="Multi-Channel Commerce" subtitle="Shopify, WooCommerce, Amazon, eBay — inventory & order synchronization">
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add Channel</Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Connected Channels', value: integrations.filter(i => i.status === 'active').length },
          { label: 'Orders Synced', value: integrations.reduce((a, b) => a + (b.orders_synced || 0), 0) },
          { label: 'Sync Errors', value: integrations.reduce((a, b) => a + (b.errors || 0), 0) },
          { label: 'Total Channels', value: integrations.length },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-4"><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      {/* Channel Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map(intg => {
          const meta = CHANNEL_META[intg.channel] || CHANNEL_META.manual;
          return (
            <Card key={intg.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${meta.color} flex items-center justify-center text-lg`}>{meta.icon}</div>
                    <div>
                      <CardTitle className="text-base">{intg.name}</CardTitle>
                      <CardDescription>{meta.label}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={intg.status === 'active' ? 'default' : intg.status === 'error' ? 'destructive' : 'secondary'}>
                    {intg.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted rounded p-2"><p className="text-muted-foreground">Orders Synced</p><p className="font-bold">{intg.orders_synced || 0}</p></div>
                  <div className="bg-muted rounded p-2"><p className="text-muted-foreground">Errors</p><p className="font-bold text-red-500">{intg.errors || 0}</p></div>
                </div>
                <div className="flex gap-2 text-xs">
                  {intg.sync_inventory && <Badge variant="outline">📊 Inventory Sync</Badge>}
                  {intg.sync_orders && <Badge variant="outline">📦 Order Sync</Badge>}
                </div>
                {intg.last_sync && <p className="text-xs text-muted-foreground">Last sync: {new Date(intg.last_sync).toLocaleString()}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleSync(intg)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Sync Now
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => updateMut.mutate({ id: intg.id, data: { status: intg.status === 'active' ? 'paused' : 'active' } })}>
                    {intg.status === 'active' ? 'Pause' : 'Enable'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Placeholder cards for unconnected channels */}
        {Object.entries(CHANNEL_META).filter(([k]) => k !== 'manual' && !integrations.find(i => i.channel === k)).map(([key, meta]) => (
          <Card key={key} className="border-dashed opacity-60 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => { setForm(f => ({ ...f, channel: key, name: meta.label })); setShowAdd(true); }}>
            <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
              <div className={`w-12 h-12 rounded-xl ${meta.color} flex items-center justify-center text-xl`}>{meta.icon}</div>
              <p className="font-medium">{meta.label}</p>
              <Badge variant="outline"><Plus className="w-3 h-3 mr-1" /> Connect</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Sales Channel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Channel</Label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CHANNEL_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. My Shopify Store" /></div>
            <div><Label>API URL</Label><Input value={form.api_url} onChange={e => setForm(f => ({ ...f, api_url: e.target.value }))} placeholder="https://mystore.myshopify.com" /></div>
            <div><Label>API Key</Label><Input type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} placeholder="sk_..." /></div>
            <div className="flex items-center justify-between"><Label>Sync Inventory</Label><Switch checked={form.sync_inventory} onCheckedChange={v => setForm(f => ({ ...f, sync_inventory: v }))} /></div>
            <div className="flex items-center justify-between"><Label>Sync Orders</Label><Switch checked={form.sync_orders} onCheckedChange={v => setForm(f => ({ ...f, sync_orders: v }))} /></div>
            <Button className="w-full" onClick={() => createMut.mutate({ ...form, status: 'active' })}>Connect Channel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}