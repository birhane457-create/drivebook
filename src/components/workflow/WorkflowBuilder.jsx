import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowDown, Zap, GitBranch, Play } from 'lucide-react';
import { toast } from 'sonner';

const TRIGGERS = [
  { value: 'low_stock', label: '📦 Low Stock', desc: 'When a product falls below reorder level' },
  { value: 'high_value_order', label: '💰 High Value Order', desc: 'When an order exceeds a threshold' },
  { value: 'shipment_delivered', label: '🚚 Shipment Delivered', desc: 'When a delivery is confirmed' },
  { value: 'customer_tier_change', label: '⭐ Customer Tier Change', desc: 'When customer reaches a new loyalty tier' },
  { value: 'po_created', label: '🛒 PO Created', desc: 'When a purchase order is created' },
  { value: 'sale_completed', label: '✅ Sale Completed', desc: 'When a sale is finalized' },
  { value: 'scheduled', label: '⏰ Scheduled', desc: 'Run on a schedule (cron)' },
  { value: 'manual', label: '👆 Manual', desc: 'Triggered manually by user' },
];

const ACTIONS = [
  { value: 'create_po', label: '🛒 Create Draft PO' },
  { value: 'send_alert', label: '🔔 Send Alert' },
  { value: 'require_approval', label: '✅ Require Approval' },
  { value: 'send_email', label: '📧 Send Email' },
  { value: 'apply_discount', label: '💸 Apply Discount' },
  { value: 'update_field', label: '✏️ Update Field' },
  { value: 'create_task', label: '📋 Create Task' },
];

const OPERATORS = [{ value: 'gt', label: '>' }, { value: 'gte', label: '≥' }, { value: 'lt', label: '<' }, { value: 'lte', label: '≤' }, { value: 'eq', label: '=' }, { value: 'contains', label: 'contains' }];

const EMPTY = { name: '', description: '', trigger_type: 'low_stock', trigger_config: {}, conditions: [], actions: [], is_active: true };

export default function WorkflowBuilder({ rule, onSave }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => { if (rule) setForm(rule); else setForm(EMPTY); }, [rule]);

  const saveMut = useMutation({
    mutationFn: d => rule ? base44.entities.WorkflowRule.update(rule.id, d) : base44.entities.WorkflowRule.create(d),
    onSuccess: () => { qc.invalidateQueries(['workflow_rules']); toast.success(rule ? 'Rule updated' : 'Rule created'); onSave(); },
  });

  const addCondition = () => setForm(f => ({ ...f, conditions: [...f.conditions, { field: '', operator: 'gt', value: '' }] }));
  const addAction = () => setForm(f => ({ ...f, actions: [...f.actions, { type: 'send_alert', config: {} }] }));
  const removeCondition = i => setForm(f => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }));
  const removeAction = i => setForm(f => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }));
  const updateCondition = (i, k, v) => setForm(f => ({ ...f, conditions: f.conditions.map((c, j) => j === i ? { ...c, [k]: v } : c) }));
  const updateAction = (i, k, v) => setForm(f => ({ ...f, actions: f.actions.map((a, j) => j === i ? { ...a, [k]: v } : a) }));
  const selectedTrigger = TRIGGERS.find(t => t.value === form.trigger_type);

  return (
    <div className="max-w-2xl">
      <div className="space-y-4">
        {/* Name */}
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div><Label>Rule Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Low stock → Create PO" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this rule do?" /></div>
            </div>
          </CardContent>
        </Card>

        {/* Trigger */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> TRIGGER</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-0 px-4">
            <Select value={form.trigger_type} onValueChange={v => setForm(f => ({ ...f, trigger_type: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            {selectedTrigger && <p className="text-xs text-muted-foreground mt-2">{selectedTrigger.desc}</p>}
            {form.trigger_type === 'high_value_order' && (
              <div className="mt-2"><Label className="text-xs">Threshold Amount ($)</Label><Input className="mt-1" type="number" value={form.trigger_config?.threshold || ''} onChange={e => setForm(f => ({ ...f, trigger_config: { ...f.trigger_config, threshold: parseFloat(e.target.value) } }))} /></div>
            )}
            {form.trigger_type === 'scheduled' && (
              <div className="mt-2"><Label className="text-xs">Cron Expression</Label><Input className="mt-1 font-mono" placeholder="0 9 * * 1 (every Monday 9am)" value={form.trigger_config?.cron || ''} onChange={e => setForm(f => ({ ...f, trigger_config: { ...f.trigger_config, cron: e.target.value } }))} /></div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center"><ArrowDown className="w-5 h-5 text-muted-foreground" /></div>

        {/* Conditions */}
        <Card className="border-yellow-200 bg-yellow-50/30">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><GitBranch className="w-4 h-4 text-yellow-600" /> CONDITIONS (optional)</CardTitle>
            <Button size="sm" variant="outline" onClick={addCondition}><Plus className="w-3 h-3 mr-1" /> Add</Button>
          </CardHeader>
          <CardContent className="pb-4 pt-0 px-4 space-y-2">
            {form.conditions.length === 0 ? <p className="text-xs text-muted-foreground">No conditions — rule runs on every trigger</p> : form.conditions.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input className="flex-1 text-xs h-8" placeholder="field (e.g. total_amount)" value={c.field} onChange={e => updateCondition(i, 'field', e.target.value)} />
                <Select value={c.operator} onValueChange={v => updateCondition(i, 'operator', v)}>
                  <SelectTrigger className="w-16 text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="w-24 text-xs h-8" placeholder="value" value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)} />
                <button onClick={() => removeCondition(i)}><Trash2 className="w-3 h-3 text-destructive" /></button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-center"><ArrowDown className="w-5 h-5 text-muted-foreground" /></div>

        {/* Actions */}
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Play className="w-4 h-4 text-green-600" /> ACTIONS</CardTitle>
            <Button size="sm" variant="outline" onClick={addAction}><Plus className="w-3 h-3 mr-1" /> Add</Button>
          </CardHeader>
          <CardContent className="pb-4 pt-0 px-4 space-y-2">
            {form.actions.length === 0 ? <p className="text-xs text-muted-foreground">Add at least one action</p> : form.actions.map((a, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex-shrink-0 mt-1">{i + 1}</div>
                <Select value={a.type} onValueChange={v => updateAction(i, 'type', v)}>
                  <SelectTrigger className="flex-1 text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIONS.map(act => <SelectItem key={act.value} value={act.value}>{act.label}</SelectItem>)}</SelectContent>
                </Select>
                <button onClick={() => removeAction(i)}><Trash2 className="w-3 h-3 text-destructive mt-2" /></button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button className="w-full" disabled={!form.name || form.actions.length === 0} onClick={() => saveMut.mutate(form)}>
          {rule ? 'Update Rule' : 'Save Rule'}
        </Button>
      </div>
    </div>
  );
}