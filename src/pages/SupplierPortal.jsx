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
import { Plus, Building2, Eye, CheckCircle, Upload, Mail } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const PERM_META = {
  view_pos: { label: 'View POs', icon: Eye },
  confirm_delivery: { label: 'Confirm Deliveries', icon: CheckCircle },
  upload_invoice: { label: 'Upload Invoices', icon: Upload },
  view_scorecard: { label: 'View Scorecard', icon: Eye },
};

export default function SupplierPortal() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', supplier_name: '', portal_email: '', permissions: ['view_pos', 'view_scorecard'] });

  const { data: accesses = [], isLoading } = useQuery({ queryKey: ['supplier_portal_access'], queryFn: () => base44.entities.SupplierPortalAccess.list() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: pos = [] } = useQuery({ queryKey: ['purchase_orders'], queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 20) });
  const { data: scores = [] } = useQuery({ queryKey: ['supplier_scores'], queryFn: () => base44.entities.SupplierScore.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.SupplierPortalAccess.create(d),
    onSuccess: () => { qc.invalidateQueries(['supplier_portal_access']); setOpen(false); toast.success('Portal access granted'); },
  });

  const toggleMut = useMutation({ mutationFn: ({ id, v }) => base44.entities.SupplierPortalAccess.update(id, { is_active: v }), onSuccess: () => qc.invalidateQueries(['supplier_portal_access']) });

  const togglePerm = p => setForm(f => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter(x => x !== p) : [...f.permissions, p] }));

  const sendInvite = (access) => { toast.success(`Portal invite sent to ${access.portal_email}`); };

  return (
    <div className="p-6">
      <PageHeader title="Supplier Portal" subtitle="Self-service portal — view POs, confirm deliveries, upload invoices & track performance">
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Grant Access</Button>
      </PageHeader>

      <Tabs defaultValue="access">
        <TabsList className="mb-6">
          <TabsTrigger value="access">Portal Access ({accesses.length})</TabsTrigger>
          <TabsTrigger value="preview">Portal Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="access">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[{ label: 'Active Suppliers', value: accesses.filter(a => a.is_active).length }, { label: 'Total Logins', value: accesses.reduce((s, a) => s + (a.login_count || 0), 0) }, { label: 'Permissions Granted', value: accesses.reduce((s, a) => s + (a.permissions?.length || 0), 0) }].map(s => (
              <Card key={s.label}><CardContent className="pt-4"><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
            ))}
          </div>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : accesses.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground"><Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No supplier portal access configured yet.</p></div>
          ) : (
            <div className="space-y-3">
              {accesses.map(a => (
                <Card key={a.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{a.supplier_name}</p>
                      <p className="text-xs text-muted-foreground">{a.portal_email} · {a.login_count || 0} logins</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {a.permissions?.map(p => <Badge key={p} variant="outline" className="text-xs">{PERM_META[p]?.label || p}</Badge>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => sendInvite(a)}><Mail className="w-3 h-3 mr-1" /> Invite</Button>
                      <Switch checked={a.is_active} onCheckedChange={v => toggleMut.mutate({ id: a.id, v })} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="preview">
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl p-6 mb-4">
              <h2 className="text-xl font-bold mb-1">Supplier Self-Service Portal</h2>
              <p className="text-sm text-muted-foreground">What your suppliers see when they log in</p>
            </div>
            <Tabs defaultValue="po">
              <TabsList className="mb-4"><TabsTrigger value="po">Purchase Orders</TabsTrigger><TabsTrigger value="scorecard">My Scorecard</TabsTrigger></TabsList>
              <TabsContent value="po">
                <Card><CardContent className="pt-4">
                  <div className="space-y-2">
                    {pos.slice(0, 5).map(po => (
                      <div key={po.id} className="flex items-center gap-3 p-2 border rounded-lg">
                        <Badge variant={po.status === 'received' ? 'secondary' : 'default'}>{po.status}</Badge>
                        <span className="font-mono text-sm flex-1">{po.po_number || `PO-${po.id?.slice(-6).toUpperCase()}`}</span>
                        <span className="text-sm">${(po.total_amount || 0).toLocaleString()}</span>
                        {po.status === 'submitted' && <Button size="sm" variant="outline" onClick={() => toast.success('Delivery confirmed!')}><CheckCircle className="w-3 h-3 mr-1" /> Confirm</Button>}
                      </div>
                    ))}
                    {pos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No purchase orders yet</p>}
                  </div>
                </CardContent></Card>
              </TabsContent>
              <TabsContent value="scorecard">
                {scores.length === 0 ? <Card><CardContent className="py-10 text-center text-muted-foreground">No scorecard data yet</CardContent></Card> : (
                  scores.slice(0, 3).map(s => (
                    <Card key={s.id} className="mb-3"><CardContent className="pt-4">
                      <p className="font-semibold mb-3">{s.supplier_name} — {s.period}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[['On-Time Delivery', s.on_time_delivery_rate], ['Quality Score', s.quality_score], ['Fill Rate', s.fill_rate], ['Overall', s.overall_score]].map(([l, v]) => (
                          <div key={l} className="bg-muted rounded p-2"><p className="text-xs text-muted-foreground">{l}</p><p className="font-bold">{v || '—'}%</p></div>
                        ))}
                      </div>
                    </CardContent></Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grant Portal Access</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Supplier</Label>
              <Select value={form.supplier_id} onValueChange={v => { const s = suppliers.find(x => x.id === v); setForm(f => ({ ...f, supplier_id: v, supplier_name: s?.name || '' })); }}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Portal Login Email</Label><Input type="email" value={form.portal_email} onChange={e => setForm(f => ({ ...f, portal_email: e.target.value }))} /></div>
            <div>
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {Object.entries(PERM_META).map(([k, v]) => (
                  <button key={k} onClick={() => togglePerm(k)} className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-colors ${form.permissions.includes(k) ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:bg-muted'}`}>
                    <v.icon className="w-4 h-4" /> {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, is_active: true, login_count: 0, invited_date: new Date().toISOString() })}>Grant Access & Send Invite</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}