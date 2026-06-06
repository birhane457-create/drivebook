import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const PLAN_COLORS = { starter: 'bg-gray-100 text-gray-700', professional: 'bg-blue-100 text-blue-700', enterprise: 'bg-purple-100 text-purple-700', enterprise_plus: 'bg-yellow-100 text-yellow-800' };
const STATUS_V = { active: 'default', suspended: 'destructive', trial: 'secondary', cancelled: 'outline' };

export default function TenantManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', plan: 'professional', admin_email: '', max_users: 10, max_locations: 5, billing_cycle: 'monthly', timezone: 'UTC', country: '' });

  const { data: tenants = [], isLoading } = useQuery({ queryKey: ['tenants'], queryFn: () => base44.entities.Tenant.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.Tenant.create(d),
    onSuccess: () => { qc.invalidateQueries(['tenants']); setOpen(false); toast.success('Tenant created'); },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Tenant.update(id, { status }),
    onSuccess: () => qc.invalidateQueries(['tenants']),
  });

  const totalMRR = tenants.reduce((a, b) => a + (b.mrr || 0), 0);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Total Tenants', value: tenants.length },
          { label: 'Active', value: tenants.filter(t => t.status === 'active').length },
          { label: 'Trial', value: tenants.filter(t => t.status === 'trial').length },
          { label: 'MRR', value: `$${totalMRR.toLocaleString()}` },
        ].map(s => <Card key={s.label}><CardContent className="pt-4"><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>)}
      </div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Tenant</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : tenants.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No tenants yet. This is your multi-tenant SaaS management center.</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground">
              {['Name', 'Slug', 'Plan', 'Status', 'Users', 'Locations', 'MRR', 'SSO', 'Actions'].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} className="border-b hover:bg-muted/40">
                  <td className="py-2 px-2 font-medium">{t.name}</td>
                  <td className="py-2 px-2 font-mono text-xs">{t.slug}</td>
                  <td className="py-2 px-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[t.plan] || ''}`}>{t.plan}</span></td>
                  <td className="py-2 px-2"><Badge variant={STATUS_V[t.status] || 'outline'}>{t.status}</Badge></td>
                  <td className="py-2 px-2">{t.max_users}</td>
                  <td className="py-2 px-2">{t.max_locations}</td>
                  <td className="py-2 px-2">${t.mrr || 0}</td>
                  <td className="py-2 px-2">{t.sso_enabled ? '✅' : '—'}</td>
                  <td className="py-2 px-2 flex gap-1">
                    {t.status !== 'active' && <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={() => statusMut.mutate({ id: t.id, status: 'active' })}>Activate</Button>}
                    {t.status === 'active' && <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={() => statusMut.mutate({ id: t.id, status: 'suspended' })}>Suspend</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Tenant</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Company Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s/g, '-') }))} placeholder="company-name" /></div>
            <div><Label>Plan</Label>
              <Select value={form.plan} onValueChange={v => setForm(f => ({ ...f, plan: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['starter', 'professional', 'enterprise', 'enterprise_plus'].map(p => <SelectItem key={p} value={p} className="capitalize">{p.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Billing</Label>
              <Select value={form.billing_cycle} onValueChange={v => setForm(f => ({ ...f, billing_cycle: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Admin Email</Label><Input type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} /></div>
            <div><Label>Max Users</Label><Input type="number" value={form.max_users} onChange={e => setForm(f => ({ ...f, max_users: parseInt(e.target.value) || 10 }))} /></div>
            <div><Label>Max Locations</Label><Input type="number" value={form.max_locations} onChange={e => setForm(f => ({ ...f, max_locations: parseInt(e.target.value) || 5 }))} /></div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, status: 'trial', modules_enabled: [], feature_flags: [] })}>Create Tenant</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}