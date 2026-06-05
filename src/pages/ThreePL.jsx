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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Plus, DollarSign, Package, Users, FileText } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_CLIENT = { name: '', code: '', contact_person: '', email: '', phone: '', billing_model: 'per_pallet', storage_rate: 0, pick_pack_rate: 0, receiving_rate: 0, freight_markup: 0, billing_cycle: 'monthly', portal_access: true };

export default function ThreePL() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_CLIENT);
  const [selected, setSelected] = useState(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['3pl_clients'],
    queryFn: () => base44.entities.ThreePLClient.list(),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.ThreePLClient.create(d),
    onSuccess: () => { qc.invalidateQueries(['3pl_clients']); setShowAdd(false); setForm(EMPTY_CLIENT); toast.success('Client added'); },
  });

  const generateBill = (client) => {
    toast.success(`Generating ${client.billing_cycle} bill for ${client.name}...`);
  };

  return (
    <div className="p-6">
      <PageHeader title="3PL Management" subtitle="Multi-client warehouse operations, billing engine & client portal">
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" /> Add Client</Button>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Clients', value: clients.filter(c => c.is_active).length, icon: Users },
          { label: 'Storage Revenue', value: `$${clients.reduce((a, b) => a + (b.storage_rate || 0), 0).toFixed(0)}/mo`, icon: Building2 },
          { label: 'Pick & Pack Rev.', value: `$${clients.reduce((a, b) => a + (b.pick_pack_rate || 0), 0).toFixed(0)}/mo`, icon: Package },
          { label: 'Portal Clients', value: clients.filter(c => c.portal_access).length, icon: FileText },
        ].map(s => (
          <Card key={s.label}><CardContent className="flex items-center gap-3 pt-4">
            <s.icon className="w-8 h-8 text-primary/60" />
            <div><p className="text-xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Client Table */}
      <Card>
        <CardHeader><CardTitle>3PL Clients</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground text-sm">Loading...</p> : clients.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No 3PL clients yet. Add your first client to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground">
                  {['Client', 'Code', 'Contact', 'Billing Model', 'Storage Rate', 'Pick Rate', 'Cycle', 'Status', 'Actions'].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}
                </tr></thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} className="border-b hover:bg-muted/40">
                      <td className="py-2 px-2 font-medium">{c.name}</td>
                      <td className="py-2 px-2"><Badge variant="outline">{c.code}</Badge></td>
                      <td className="py-2 px-2 text-muted-foreground">{c.contact_person}</td>
                      <td className="py-2 px-2 capitalize">{c.billing_model?.replace('_', ' ')}</td>
                      <td className="py-2 px-2">${c.storage_rate}/{c.billing_model === 'per_pallet' ? 'pallet' : 'unit'}</td>
                      <td className="py-2 px-2">${c.pick_pack_rate}/line</td>
                      <td className="py-2 px-2 capitalize">{c.billing_cycle}</td>
                      <td className="py-2 px-2"><Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="py-2 px-2">
                        <Button size="sm" variant="outline" onClick={() => generateBill(c)}>
                          <DollarSign className="w-3 h-3 mr-1" /> Bill
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add 3PL Client</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {[['name', 'Company Name'], ['code', 'Client Code'], ['contact_person', 'Contact'], ['email', 'Email'], ['phone', 'Phone']].map(([k, l]) => (
              <div key={k}><Label>{l}</Label><Input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
            ))}
            <div><Label>Billing Model</Label>
              <Select value={form.billing_model} onValueChange={v => setForm(f => ({ ...f, billing_model: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['per_pallet', 'per_sqft', 'per_unit', 'flat_rate'].map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Billing Cycle</Label>
              <Select value={form.billing_cycle} onValueChange={v => setForm(f => ({ ...f, billing_cycle: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['weekly', 'bi_weekly', 'monthly'].map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {[['storage_rate', 'Storage Rate'], ['pick_pack_rate', 'Pick & Pack Rate'], ['receiving_rate', 'Receiving Rate'], ['freight_markup', 'Freight Markup %']].map(([k, l]) => (
              <div key={k}><Label>{l}</Label><Input type="number" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: parseFloat(e.target.value) || 0 }))} /></div>
            ))}
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, is_active: true })}>Add Client</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}