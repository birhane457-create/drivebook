import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_OPTIONS = ['purchase_order', 'stock_transfer', 'credit_limit', 'price_override', 'discount', 'write_off', 'production_order'];
const OP_LABELS = { gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=' };

export default function ApprovalRulesConfig() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'purchase_order', condition_field: 'total_amount', condition_operator: 'gt', condition_value: 1000, levels: [{ level: 1, approver_role: 'warehouse_manager', approver_name: '', timeout_hours: 24 }], is_active: true });

  const { data: rules = [], isLoading } = useQuery({ queryKey: ['approval_rules'], queryFn: () => base44.entities.ApprovalRule.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.ApprovalRule.create(d),
    onSuccess: () => { qc.invalidateQueries(['approval_rules']); setOpen(false); toast.success('Rule created'); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.ApprovalRule.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries(['approval_rules']),
  });

  const addLevel = () => setForm(f => ({ ...f, levels: [...f.levels, { level: f.levels.length + 1, approver_role: 'super_admin', approver_name: '', timeout_hours: 24 }] }));
  const removeLevel = (i) => setForm(f => ({ ...f, levels: f.levels.filter((_, j) => j !== i) }));

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Rule</Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : rules.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Settings className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No approval rules configured. Add rules to enable multi-level approvals.</p></div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <Card key={rule.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{rule.name}</span>
                    <Badge variant="outline" className="capitalize text-xs">{rule.type?.replace('_', ' ')}</Badge>
                    {!rule.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When {rule.condition_field} {OP_LABELS[rule.condition_operator]} {rule.condition_value} → {rule.levels?.length || 0} approval level(s)
                  </p>
                  <div className="flex gap-1 mt-1">
                    {rule.levels?.map((l, i) => (
                      <Badge key={i} variant="outline" className="text-xs">L{l.level}: {l.approver_role?.replace('_', ' ')}</Badge>
                    ))}
                  </div>
                </div>
                <Switch checked={rule.is_active} onCheckedChange={v => toggleMut.mutate({ id: rule.id, is_active: v })} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Approval Rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Rule Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. High-value PO approval" /></div>
            <div><Label>Apply To</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPE_OPTIONS.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Field</Label><Input value={form.condition_field} onChange={e => setForm(f => ({ ...f, condition_field: e.target.value }))} placeholder="total_amount" /></div>
              <div><Label>Operator</Label>
                <Select value={form.condition_operator} onValueChange={v => setForm(f => ({ ...f, condition_operator: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(OP_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Value</Label><Input type="number" value={form.condition_value} onChange={e => setForm(f => ({ ...f, condition_value: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2"><Label>Approval Levels</Label><Button size="sm" variant="outline" onClick={addLevel}><Plus className="w-3 h-3 mr-1" /> Add Level</Button></div>
              {form.levels.map((level, i) => (
                <div key={i} className="flex gap-2 items-center border rounded p-2 mb-2">
                  <span className="text-xs font-bold w-6">L{level.level}</span>
                  <Input className="flex-1 text-xs h-7" value={level.approver_role} onChange={e => setForm(f => ({ ...f, levels: f.levels.map((l, j) => j === i ? { ...l, approver_role: e.target.value } : l) }))} placeholder="Role" />
                  <Input className="w-16 text-xs h-7" type="number" value={level.timeout_hours} onChange={e => setForm(f => ({ ...f, levels: f.levels.map((l, j) => j === i ? { ...l, timeout_hours: parseInt(e.target.value) || 24 } : l) }))} />
                  <span className="text-xs text-muted-foreground">hrs</span>
                  {form.levels.length > 1 && <button onClick={() => removeLevel(i)}><Trash2 className="w-3 h-3 text-destructive" /></button>}
                </div>
              ))}
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate(form)}>Create Rule</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}