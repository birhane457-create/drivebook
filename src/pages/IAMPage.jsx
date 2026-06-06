import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Shield, Users, Lock, ChevronRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const MODULES = ['dashboard', 'pos', 'products', 'inventory', 'purchases', 'transfers', 'customers', 'suppliers', 'sales', 'financials', 'manufacturing', 'warehouse', 'transportation', 'quality', 'assets', 'approvals', 'reports', 'settings'];
const ACTIONS = ['read', 'create', 'update', 'delete', 'approve', 'export', 'admin'];

const ROLE_HIERARCHY = [
  { name: 'Global Admin', code: 'global_admin', level: 1, color: 'text-red-600', children: ['Company Admin', 'Read Only Auditor'] },
  { name: 'Company Admin', code: 'company_admin', level: 2, color: 'text-purple-600', children: ['Warehouse Manager', 'Finance Manager', 'Operations Manager'] },
  { name: 'Warehouse Manager', code: 'warehouse_manager', level: 3, color: 'text-blue-600', children: ['Inventory Staff', 'Pick Staff'] },
  { name: 'Finance Manager', code: 'finance_manager', level: 3, color: 'text-green-600', children: ['AP/AR Clerk'] },
  { name: 'Operations Manager', code: 'ops_manager', level: 3, color: 'text-orange-600', children: ['Store Manager', 'Cashier'] },
  { name: 'Read Only Auditor', code: 'auditor', level: 2, color: 'text-gray-600', children: [] },
];

function RoleNode({ role, indent = 0 }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginLeft: indent * 20 }}>
      <div className="flex items-center gap-2 py-1.5 hover:bg-muted/40 px-2 rounded cursor-pointer" onClick={() => setOpen(v => !v)}>
        {role.children?.length > 0 && <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />}
        {!role.children?.length && <div className="w-3" />}
        <div className={`w-2 h-2 rounded-full ${role.color.replace('text', 'bg')}`} />
        <span className={`text-sm font-medium ${role.color}`}>{role.name}</span>
        <Badge variant="outline" className="text-xs ml-auto">L{role.level}</Badge>
      </div>
      {open && role.children?.map(child => {
        const childRole = ROLE_HIERARCHY.find(r => r.name === child);
        return childRole ? <RoleNode key={child} role={childRole} indent={indent + 1} /> : null;
      })}
    </div>
  );
}

export default function IAMPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', level: 3, data_scope: 'location', permissions: [], description: '' });
  const [permModule, setPermModule] = useState('');
  const [permActions, setPermActions] = useState([]);

  const { data: roles = [], isLoading } = useQuery({ queryKey: ['permission_roles'], queryFn: () => base44.entities.PermissionRole.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.PermissionRole.create(d),
    onSuccess: () => { qc.invalidateQueries(['permission_roles']); setOpen(false); toast.success('Role created'); },
  });

  const addPerm = () => {
    if (!permModule || !permActions.length) return;
    setForm(f => ({ ...f, permissions: [...f.permissions.filter(p => p.module !== permModule), { module: permModule, actions: [...permActions] }] }));
    setPermModule(''); setPermActions([]);
  };

  const toggleAction = (a) => setPermActions(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  return (
    <div className="p-6">
      <PageHeader title="Identity & Access Management" subtitle="Role hierarchy, permission matrix, attribute-based access control & security policies">
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Role</Button>
      </PageHeader>

      <Tabs defaultValue="hierarchy">
        <TabsList className="mb-6">
          <TabsTrigger value="hierarchy">Role Hierarchy</TabsTrigger>
          <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
          <TabsTrigger value="policies">Security Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> System Role Hierarchy</CardTitle></CardHeader>
              <CardContent>
                {ROLE_HIERARCHY.filter(r => r.level === 1).map(r => <RoleNode key={r.code} role={r} />)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Custom Roles</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No custom roles yet</p>
                ) : (
                  <div className="space-y-2">
                    {roles.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-2 border rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">L{r.level}</div>
                        <div className="flex-1"><p className="font-medium text-sm">{r.name}</p><p className="text-xs text-muted-foreground">{r.code} · {r.data_scope} scope · {r.permissions?.length || 0} modules</p></div>
                        <Badge variant="outline" className="capitalize">{r.data_scope}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="matrix">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 w-32">Module</th>
                    {['Global Admin', 'Company Admin', 'WH Manager', 'Finance Mgr', 'Store Mgr', 'Cashier', 'Auditor'].map(r => <th key={r} className="text-center py-2 px-1 font-medium">{r}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(mod => (
                    <tr key={mod} className="border-b hover:bg-muted/30">
                      <td className="py-1.5 px-2 capitalize font-medium">{mod.replace('_', ' ')}</td>
                      {[
                        ['read','create','update','delete','approve','export','admin'],
                        ['read','create','update','approve','export'],
                        ['read','create','update'],
                        ['read','create','update','export'],
                        ['read','create'],
                        ['read','create'],
                        ['read','export'],
                      ].map((perms, i) => (
                        <td key={i} className="py-1.5 px-1 text-center">
                          {['financials','settings','approvals'].includes(mod) && i > 2 && !['read','export'].every(p => perms.includes(p)) ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: 'Multi-Factor Authentication', desc: 'Require MFA for all admin users and sensitive operations', status: 'recommended', icon: Lock },
              { title: 'Session Timeout', desc: 'Auto-logout after 30 minutes of inactivity', status: 'active', icon: Shield },
              { title: 'IP Allowlist', desc: 'Restrict login to approved IP ranges', status: 'optional', icon: Shield },
              { title: 'Password Policy', desc: 'Min 12 chars, complexity, 90-day expiry', status: 'active', icon: Lock },
              { title: 'Data Export Controls', desc: 'Log and require approval for bulk data exports', status: 'recommended', icon: Shield },
              { title: 'Device Trust', desc: 'Only allow logins from registered devices', status: 'optional', icon: Lock },
              { title: 'Single Sign-On (SAML/OIDC)', desc: 'Enterprise SSO integration with IdP', status: 'enterprise', icon: Shield },
              { title: 'Privileged Access Management', desc: 'Just-in-time elevated permissions with logging', status: 'enterprise', icon: Lock },
            ].map(p => (
              <Card key={p.title}>
                <CardContent className="flex items-start gap-3 pt-4">
                  <p.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                  </div>
                  <Badge variant={p.status === 'active' ? 'default' : p.status === 'enterprise' ? 'secondary' : 'outline'} className="capitalize flex-shrink-0">{p.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Custom Role</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Role Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. warehouse_lead" /></div>
              <div><Label>Hierarchy Level</Label><Input type="number" min={1} max={10} value={form.level} onChange={e => setForm(f => ({ ...f, level: parseInt(e.target.value) || 3 }))} /></div>
              <div><Label>Data Scope</Label>
                <Select value={form.data_scope} onValueChange={v => setForm(f => ({ ...f, data_scope: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['global', 'company', 'location', 'own'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div>
              <Label className="font-semibold">Module Permissions</Label>
              <div className="border rounded-lg p-3 mt-1 space-y-2">
                {form.permissions.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-24 capitalize">{p.module}</span>
                    <div className="flex gap-1">{p.actions.map(a => <Badge key={a} variant="default" className="text-[10px]">{a}</Badge>)}</div>
                    <button className="ml-auto text-destructive text-xs" onClick={() => setForm(f => ({ ...f, permissions: f.permissions.filter((_, j) => j !== i) }))}>✕</button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1 flex-wrap">
                  <Select value={permModule} onValueChange={setPermModule}>
                    <SelectTrigger className="w-36 text-xs"><SelectValue placeholder="Module" /></SelectTrigger>
                    <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace('_', ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex gap-1 flex-wrap">{ACTIONS.map(a => (
                    <button key={a} onClick={() => toggleAction(a)} className={`text-xs px-2 py-0.5 rounded border transition-colors ${permActions.includes(a) ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>{a}</button>
                  ))}</div>
                  <Button size="sm" variant="outline" onClick={addPerm}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </div>
              </div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate(form)}>Create Role</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}