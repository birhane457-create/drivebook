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
import { Plus, Tag, Trash2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_META = { standard: { label: 'Standard', color: 'bg-blue-100 text-blue-700' }, wholesale: { label: 'Wholesale', color: 'bg-purple-100 text-purple-700' }, contract: { label: 'Contract', color: 'bg-green-100 text-green-700' }, promotional: { label: 'Promo', color: 'bg-orange-100 text-orange-700' }, tier_based: { label: 'Tier-Based', color: 'bg-indigo-100 text-indigo-700' } };
const EMPTY = { name: '', code: '', type: 'standard', currency_code: 'USD', valid_from: '', valid_to: '', rules: [], description: '' };

export default function PricingEngine() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [ruleRow, setRuleRow] = useState({ type: 'percent_off', value: 0, min_qty: 1, margin_floor: 0 });

  const { data: books = [], isLoading } = useQuery({ queryKey: ['price_books'], queryFn: () => base44.entities.PriceBook.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.PriceBook.create(d),
    onSuccess: () => { qc.invalidateQueries(['price_books']); setOpen(false); setForm(EMPTY); toast.success('Price book created'); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, v }) => base44.entities.PriceBook.update(id, { is_active: v }),
    onSuccess: () => qc.invalidateQueries(['price_books']),
  });

  const addRule = () => {
    setForm(f => ({ ...f, rules: [...f.rules, { ...ruleRow, id: Date.now() }] }));
    setRuleRow({ type: 'percent_off', value: 0, min_qty: 1, margin_floor: 0 });
  };

  return (
    <div className="p-6">
      <PageHeader title="Dynamic Pricing Engine" subtitle="Price books, customer pricing, volume discounts, margin protection & contract pricing">
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Price Book</Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Price Books', value: books.filter(b => b.is_active).length },
          { label: 'Total Rules', value: books.reduce((a, b) => a + (b.rules?.length || 0), 0) },
          { label: 'Wholesale Books', value: books.filter(b => b.type === 'wholesale').length },
          { label: 'Promotions', value: books.filter(b => b.type === 'promotional').length },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-4"><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      {/* Books grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {books.map(book => {
          const meta = TYPE_META[book.type] || TYPE_META.standard;
          return (
            <Card key={book.id} className={!book.is_active ? 'opacity-60' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{book.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{book.code}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 mb-3">
                  <p>{book.rules?.length || 0} pricing rules</p>
                  {book.valid_from && <p>Valid: {book.valid_from} → {book.valid_to || 'Open'}</p>}
                  {book.description && <p className="italic">{book.description}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => toggleMut.mutate({ id: book.id, v: !book.is_active })}>
                    {book.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Badge variant={book.is_active ? 'default' : 'secondary'} className="self-center">{book.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isLoading && books.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Tag className="w-14 h-14 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No price books yet</p>
          <p className="text-sm">Create price books to manage wholesale, contract, and promotional pricing.</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Price Book</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Wholesale 2025" /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="WHL-2025" /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Currency</Label><Input value={form.currency_code} onChange={e => setForm(f => ({ ...f, currency_code: e.target.value }))} /></div>
              <div><Label>Valid From</Label><Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} /></div>
              <div><Label>Valid To</Label><Input type="date" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            </div>

            <div>
              <Label className="text-base font-semibold">Pricing Rules</Label>
              <div className="border rounded-lg p-3 mt-2">
                {form.rules.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs border-b pb-2 mb-2 last:border-0">
                    <span className="flex-1">{r.product_name || 'All products'}</span>
                    <Badge variant="outline">{r.type.replace('_', ' ')}</Badge>
                    <span className="font-bold">{r.type === 'fixed' ? `$${r.value}` : r.type === 'override' ? `$${r.value}` : `${r.value}%`}</span>
                    {r.min_qty > 1 && <span className="text-muted-foreground">min: {r.min_qty}</span>}
                    <button onClick={() => setForm(f => ({ ...f, rules: f.rules.filter((_, j) => j !== i) }))}><Trash2 className="w-3 h-3 text-destructive" /></button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Select value={ruleRow.product_id || ''} onValueChange={v => { const p = products.find(pr => pr.id === v); setRuleRow(r => ({ ...r, product_id: v, product_name: p?.name || '' })); }}>
                    <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="Product (optional)" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={ruleRow.type} onValueChange={v => setRuleRow(r => ({ ...r, type: v }))}>
                    <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent_off">% Off</SelectItem>
                      <SelectItem value="fixed">Fixed Price</SelectItem>
                      <SelectItem value="markup">% Markup</SelectItem>
                      <SelectItem value="override">Override</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input className="w-20 text-xs" type="number" placeholder="Value" value={ruleRow.value} onChange={e => setRuleRow(r => ({ ...r, value: parseFloat(e.target.value) || 0 }))} />
                  <Input className="w-16 text-xs" type="number" placeholder="MinQty" value={ruleRow.min_qty} onChange={e => setRuleRow(r => ({ ...r, min_qty: parseInt(e.target.value) || 1 }))} />
                  <Button size="sm" variant="outline" onClick={addRule}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, is_active: true })}>Create Price Book</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}