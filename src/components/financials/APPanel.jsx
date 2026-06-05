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
import { Plus, FileText, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = { draft: 'secondary', received: 'outline', partial: 'default', paid: 'secondary', overdue: 'destructive', void: 'secondary' };

export default function APPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', supplier_name: '', total_amount: 0, bill_date: new Date().toISOString().split('T')[0], due_date: '', payment_terms: 'net_30' });

  const { data: bills = [], isLoading } = useQuery({ queryKey: ['ap'], queryFn: () => base44.entities.AccountsPayable.list('-created_date') });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.AccountsPayable.create(d),
    onSuccess: () => { qc.invalidateQueries(['ap']); setOpen(false); toast.success('Bill created'); },
  });

  const totalAP = bills.filter(b => b.status !== 'paid' && b.status !== 'void').reduce((a, b) => a + (b.balance_due || b.total_amount || 0), 0);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-red-600">${totalAP.toLocaleString()}</p><p className="text-xs text-muted-foreground">Outstanding AP</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-orange-500">{bills.filter(b => b.status === 'overdue').length}</p><p className="text-xs text-muted-foreground">Overdue Bills</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{bills.filter(b => b.status === 'paid').length}</p><p className="text-xs text-muted-foreground">Paid Bills</p></CardContent></Card>
      </div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Bill</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground text-xs">
              {['Bill #', 'Supplier', 'Amount', 'Balance Due', 'Due Date', 'Status', 'Actions'].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {bills.map(bill => (
                <tr key={bill.id} className="border-b hover:bg-muted/40">
                  <td className="py-2 px-2 font-mono">{bill.bill_number || `BILL-${bill.id?.slice(-6).toUpperCase()}`}</td>
                  <td className="py-2 px-2">{bill.supplier_name}</td>
                  <td className="py-2 px-2 font-medium">${(bill.total_amount || 0).toLocaleString()}</td>
                  <td className="py-2 px-2 text-red-600">${(bill.balance_due ?? bill.total_amount ?? 0).toLocaleString()}</td>
                  <td className="py-2 px-2 text-muted-foreground">{bill.due_date || '—'}</td>
                  <td className="py-2 px-2"><Badge variant={STATUS_COLORS[bill.status] || 'outline'}>{bill.status}</Badge></td>
                  <td className="py-2 px-2">
                    {bill.status !== 'paid' && bill.status !== 'void' && (
                      <Button size="sm" variant="outline" onClick={() => { base44.entities.AccountsPayable.update(bill.id, { status: 'paid', amount_paid: bill.total_amount, balance_due: 0 }); qc.invalidateQueries(['ap']); toast.success('Bill paid'); }}>
                        <DollarSign className="w-3 h-3 mr-1" /> Pay
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bills.length === 0 && <div className="text-center py-10 text-muted-foreground"><FileText className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No bills yet</p></div>}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New AP Bill</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Supplier</Label>
              <Select value={form.supplier_id} onValueChange={v => { const s = suppliers.find(s => s.id === v); if (s) setForm(f => ({ ...f, supplier_id: v, supplier_name: s.name })); }}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Bill Date</Label><Input type="date" value={form.bill_date} onChange={e => setForm(f => ({ ...f, bill_date: e.target.value }))} /></div>
              <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              <div><Label>Amount ($)</Label><Input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Payment Terms</Label>
                <Select value={form.payment_terms} onValueChange={v => setForm(f => ({ ...f, payment_terms: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['immediate', 'net_7', 'net_15', 'net_30', 'net_60', 'net_90'].map(t => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, status: 'received', balance_due: form.total_amount, amount_paid: 0 })}>Create Bill</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}