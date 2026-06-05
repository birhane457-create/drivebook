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
import { Plus, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function GLPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'other', description: '', debit_account: '', credit_account: '', amount: 0 });

  const { data: entries = [], isLoading } = useQuery({ queryKey: ['gl'], queryFn: () => base44.entities.GeneralLedger.list('-created_date', 100) });

  const createMut = useMutation({
    mutationFn: d => base44.entities.GeneralLedger.create(d),
    onSuccess: () => { qc.invalidateQueries(['gl']); setOpen(false); toast.success('GL entry posted'); },
  });

  const totalDebits = entries.filter(e => e.is_posted).reduce((a, b) => a + (b.amount || 0), 0);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{entries.filter(e => e.is_posted).length}</p><p className="text-xs text-muted-foreground">Posted Entries</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-yellow-600">{entries.filter(e => !e.is_posted).length}</p><p className="text-xs text-muted-foreground">Draft Entries</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold">${totalDebits.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Posted</p></CardContent></Card>
      </div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Entry</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : entries.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground"><BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No GL entries yet</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground text-xs">
              {['#', 'Date', 'Type', 'Description', 'Debit', 'Credit', 'Amount', 'Status'].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-b hover:bg-muted/40 text-xs">
                  <td className="py-2 px-2 font-mono">{e.entry_number || e.id?.slice(-6).toUpperCase()}</td>
                  <td className="py-2 px-2">{e.date}</td>
                  <td className="py-2 px-2 capitalize">{e.type}</td>
                  <td className="py-2 px-2 text-muted-foreground max-w-[150px] truncate">{e.description}</td>
                  <td className="py-2 px-2 font-mono">{e.debit_account || '—'}</td>
                  <td className="py-2 px-2 font-mono">{e.credit_account || '—'}</td>
                  <td className="py-2 px-2 font-semibold">${(e.amount || 0).toLocaleString()}</td>
                  <td className="py-2 px-2"><Badge variant={e.is_posted ? 'default' : 'secondary'}>{e.is_posted ? 'Posted' : 'Draft'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New GL Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['sale', 'purchase', 'adjustment', 'transfer', 'production', 'tax', 'other'].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Debit Account</Label><Input value={form.debit_account} placeholder="e.g. 1200-AR" onChange={e => setForm(f => ({ ...f, debit_account: e.target.value }))} /></div>
              <div><Label>Credit Account</Label><Input value={form.credit_account} placeholder="e.g. 4000-Revenue" onChange={e => setForm(f => ({ ...f, credit_account: e.target.value }))} /></div>
            </div>
            <div><Label>Amount ($)</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => createMut.mutate({ ...form, is_posted: false })}>Save Draft</Button>
            <Button className="flex-1" onClick={() => createMut.mutate({ ...form, is_posted: true })}>Post Entry</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}