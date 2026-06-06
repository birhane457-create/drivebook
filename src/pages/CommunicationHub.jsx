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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Mail, MessageSquare, Bell, Send, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

const CHANNEL_META = { email: { icon: Mail, color: 'bg-blue-100 text-blue-700' }, sms: { icon: Smartphone, color: 'bg-green-100 text-green-700' }, push: { icon: Bell, color: 'bg-orange-100 text-orange-700' }, in_app: { icon: Bell, color: 'bg-purple-100 text-purple-700' }, whatsapp: { icon: MessageSquare, color: 'bg-green-100 text-green-700' } };
const EVENTS = ['low_stock', 'po_approved', 'po_received', 'transfer_completed', 'sale_completed', 'delivery_completed', 'inspection_failed', 'ncr_raised', 'approval_required', 'customer_tier_change', 'payment_received', 'overdue_invoice'];

const SAMPLE_TEMPLATES = [
  { event: 'low_stock', subject: 'Low Stock Alert: {{product_name}}', body: 'Hi {{manager_name}},\n\n{{product_name}} (SKU: {{sku}}) is running low.\nCurrent stock: {{current_stock}} units\nReorder level: {{reorder_level}} units\n\nPlease review and create a purchase order.\n\nWMS Pro Alerts', channels: ['email', 'in_app'] },
  { event: 'approval_required', subject: 'Action Required: {{type}} needs your approval', body: 'Hi,\n\nA {{type}} ({{reference_number}}) requires your approval.\nAmount: {{amount}}\nRequested by: {{requested_by}}\n\nPlease log in to review.', channels: ['email', 'in_app', 'push'] },
  { event: 'delivery_completed', subject: 'Delivery Confirmed: Route {{route_name}}', body: 'All stops completed for {{route_name}}.\nDriver: {{driver_name}}\nCompleted: {{completed_stops}}/{{total_stops}} stops', channels: ['in_app', 'email'] },
];

export default function CommunicationHub() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [form, setForm] = useState({ name: '', event: 'low_stock', channels: ['email'], subject: '', body: '', recipients: 'managers' });
  const [selectedChannels, setSelectedChannels] = useState(['email']);

  const { data: templates = [], isLoading } = useQuery({ queryKey: ['notification_templates'], queryFn: () => base44.entities.NotificationTemplate.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.NotificationTemplate.create(d),
    onSuccess: () => { qc.invalidateQueries(['notification_templates']); setOpen(false); toast.success('Template created'); },
  });

  const toggleMut = useMutation({ mutationFn: ({ id, v }) => base44.entities.NotificationTemplate.update(id, { is_active: v }), onSuccess: () => qc.invalidateQueries(['notification_templates']) });

  const toggleChannel = c => setSelectedChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const testSend = (tmpl) => { toast.success(`Test ${tmpl.channels?.join('/')} sent for "${tmpl.name}"`); };

  const loadSample = (s) => { setForm(f => ({ ...f, name: `${s.event} notification`, event: s.event, subject: s.subject, body: s.body, channels: s.channels })); setSelectedChannels(s.channels); setOpen(true); };

  return (
    <div className="p-6">
      <PageHeader title="Communication Hub" subtitle="Email, SMS, push, WhatsApp & in-app notification templates & delivery tracking">
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Template</Button>
      </PageHeader>

      <Tabs defaultValue="templates">
        <TabsList className="mb-6">
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="samples">Sample Library</TabsTrigger>
          <TabsTrigger value="channels">Channel Config</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : templates.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground"><Bell className="w-14 h-14 mx-auto mb-3 opacity-30" /><p className="font-medium">No templates yet</p><p className="text-sm">Use the Sample Library to get started quickly.</p></div>
          ) : (
            <div className="space-y-3">
              {templates.map(tmpl => (
                <Card key={tmpl.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{tmpl.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">{tmpl.event?.replace(/_/g, ' ')}</Badge>
                        {!tmpl.is_active && <Badge variant="secondary">Paused</Badge>}
                      </div>
                      <div className="flex gap-1 mb-1">
                        {tmpl.channels?.map(c => { const meta = CHANNEL_META[c]; return meta ? <span key={c} className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>{c}</span> : null; })}
                      </div>
                      {tmpl.subject && <p className="text-xs text-muted-foreground truncate">Subject: {tmpl.subject}</p>}
                      <p className="text-xs text-muted-foreground">Sent: {tmpl.send_count || 0} times {tmpl.last_sent && `· Last: ${new Date(tmpl.last_sent).toLocaleDateString()}`}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => testSend(tmpl)}><Send className="w-3 h-3 mr-1" /> Test</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setPreviewTemplate(tmpl); setPreviewOpen(true); }}>Preview</Button>
                      <Switch checked={tmpl.is_active} onCheckedChange={v => toggleMut.mutate({ id: tmpl.id, v })} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="samples">
          <div className="grid md:grid-cols-3 gap-4">
            {SAMPLE_TEMPLATES.map(s => (
              <Card key={s.event} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <p className="font-semibold text-sm mb-1 capitalize">{s.event.replace(/_/g, ' ')} Alert</p>
                  <div className="flex gap-1 mb-2">{s.channels.map(c => { const meta = CHANNEL_META[c]; return meta ? <span key={c} className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>{c}</span> : null; })}</div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">{s.subject}</p>
                  <p className="text-xs text-muted-foreground line-clamp-3 font-mono bg-muted p-2 rounded">{s.body}</p>
                  <Button size="sm" className="w-full mt-3" onClick={() => loadSample(s)}>Use Template</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="channels">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { channel: 'Email (SMTP)', icon: Mail, status: 'active', desc: 'Transactional emails via configured SMTP or SendGrid' },
              { channel: 'In-App', icon: Bell, status: 'active', desc: 'Real-time in-app notifications and alert banners' },
              { channel: 'SMS', icon: Smartphone, status: 'configure', desc: 'SMS delivery via Twilio or AWS SNS' },
              { channel: 'Push Notifications', icon: Bell, status: 'configure', desc: 'Mobile push via Firebase Cloud Messaging' },
              { channel: 'WhatsApp Business', icon: MessageSquare, status: 'enterprise', desc: 'WhatsApp Business API for operational alerts' },
              { channel: 'Slack', icon: MessageSquare, status: 'configure', desc: 'Slack channel notifications via webhook' },
            ].map(ch => (
              <Card key={ch.channel}>
                <CardContent className="flex items-start gap-3 pt-4">
                  <ch.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{ch.channel}</p>
                    <p className="text-xs text-muted-foreground">{ch.desc}</p>
                  </div>
                  <Badge variant={ch.status === 'active' ? 'default' : ch.status === 'enterprise' ? 'secondary' : 'outline'} className="capitalize flex-shrink-0">{ch.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Notification Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Template Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Trigger Event</Label>
              <Select value={form.event} onValueChange={v => setForm(f => ({ ...f, event: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENTS.map(e => <SelectItem key={e} value={e} className="capitalize">{e.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Channels</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {Object.entries(CHANNEL_META).map(([c, meta]) => (
                  <button key={c} onClick={() => toggleChannel(c)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${selectedChannels.includes(c) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                    <meta.icon className="w-3 h-3" /> {c}
                  </button>
                ))}
              </div>
            </div>
            <div><Label>Recipients</Label>
              <Select value={form.recipients} onValueChange={v => setForm(f => ({ ...f, recipients: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['actor', 'approvers', 'managers', 'all_admins', 'custom'].map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Subject</Label><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Use {{variable}} tokens" /></div>
            <div><Label>Body</Label><textarea className="w-full h-28 text-sm p-2 border rounded font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Hi {{name}}, your order {{order_id}} has been..." /></div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, channels: selectedChannels, is_active: true, send_count: 0 })}>Create Template</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Template Preview</DialogTitle></DialogHeader>
          {previewTemplate && (
            <div className="space-y-3">
              <div className="flex gap-1">{previewTemplate.channels?.map(c => { const meta = CHANNEL_META[c]; return meta ? <span key={c} className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>{c}</span> : null; })}</div>
              {previewTemplate.subject && <div className="bg-muted rounded p-3"><p className="text-xs text-muted-foreground">Subject</p><p className="font-medium text-sm">{previewTemplate.subject}</p></div>}
              <div className="bg-muted rounded p-3"><p className="text-xs text-muted-foreground mb-1">Body</p><pre className="text-xs whitespace-pre-wrap font-mono">{previewTemplate.body}</pre></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}