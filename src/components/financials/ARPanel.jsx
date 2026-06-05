import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, FileText, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = { draft: 'secondary', sent: 'outline', partial: 'default', paid: 'secondary', overdue: 'destructive', void: 'secondary' };

export default function ARPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: '', customer_name: '', total_amount: 0, invoice_date: new Date().toISOString().split('T')[0], due_date: '', payment_terms: 'net_30', currency_code: 'USD' });

  const { data: invoices = [], isLoading } = useQuery({ queryKey: ['ar'], queryFn: () => base44.entities.AccountsReceivable.list('-created_date') });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.AccountsReceivable.create(d),
    onSuccess: () => { qc.invalidateQueries(['ar']); setOpen(false); toast.success('Invoice created'); },
  });

  const markPaid = (inv) => {
    base44.entities.AccountsReceivable.update(inv.id, { status: 'paid', amount_paid: inv.total_amount, balance_due: 0 });
    qc.invalidateQueries(['ar']);
    toast.success('Marked as paid');
  };

  const totalOutstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'void').reduce((a, b) => a + (b.balance_due || b.total_amount || 0), 0);
  const overdue = invoices.filter(i => i.status === 'overdue').length;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-green-600">${totalOutstanding.toLocaleString()}</p><p className="text-xs text-muted-foreground">Outstanding AR</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-red-500">{overdue}</p><p className="text-xs text-muted-foreground">Overdue Invoices</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{invoices.filter(i => i.status === 'paid').length}</p><p className="text-xs text-muted-foreground">Paid This Period</p></CardContent></Card>
      </div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Invoice</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground text-xs">
              {['Invoice #', 'Customer', 'Amount', 'Balance Due', 'Due Date', 'Status', 'Actions'].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b hover:bg-muted/40">
                  <td className="py-2 px-2 font-mono">{inv.invoice_number || `INV-${inv.id?.slice(-6).toUpperCase()}`}</td>
                  <td className="py-2 px-2">{inv.customer_name}</td>
                  <td className="py-2 px-2 font-medium">${(inv.total_amount || 0).toLocaleString()}</td>
                  <td className="py-2 px-2 text-red-600">${(inv.balance_due ?? inv.total_amount ?? 0).toLocaleString()}</td>
                  <td className="py-2 px-2 text-muted-foreground">{inv.due_date || '—'}</td>
                  <td className="py-2 px-2"><Badge variant={STATUS_COLORS[inv.status] || 'outline'}>{inv.status}</Badge></td>
                  <td className="py-2 px-2">
                    {inv.status !== 'paid' && inv.status !== 'void' && (
                      <Button size="sm" variant="outline" onClick={() => markPaid(inv)}><DollarSign className="w-3 h-3 mr-1" /> Pay</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 && <div className="text-center py-10 text-muted-foreground"><FileText className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No invoices yet</p></div>}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New AR Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Customer</Label>
              <Select value={form.customer_id} onValueChange={v => { const c = customers.find(c => c.id === v); if (c) setForm(f => ({ ...f, customer_id: v, customer_name: c.name })); }}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Invoice Date</Label><Input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} /></div>
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
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, status: 'sent', balance_due: form.total_amount, amount_paid: 0 })}>Create Invoice</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}