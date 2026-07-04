import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Zap } from 'lucide-react';

const OPS = ['equals', 'not_equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'is_empty', 'is_not_empty'];
const ACTIONS = ['set_field', 'send_email', 'create_task', 'notify', 'webhook', 'update_status'];

export default function RuleBuilder({ fields = [], value, onChange, className }) {
  const [rule, setRule] = useState(value || { conditions: [], actions: [] });
  const update = (next) => { setRule(next); onChange?.(next); };

  const addCondition = () => update({ ...rule, conditions: [...rule.conditions, { field: fields[0] || '', op: 'equals', value: '' }] });
  const setCondition = (i, patch) => update({ ...rule, conditions: rule.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const removeCondition = (i) => update({ ...rule, conditions: rule.conditions.filter((_, idx) => idx !== i) });

  const addAction = () => update({ ...rule, actions: [...rule.actions, { type: 'set_field' }] });
  const setAction = (i, patch) => update({ ...rule, actions: rule.actions.map((a, idx) => idx === i ? { ...a, ...patch } : a) });
  const removeAction = (i) => update({ ...rule, actions: rule.actions.filter((_, idx) => idx !== i) });

  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-4', className)}>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">When ALL of these conditions are met</p>
        <div className="space-y-2">
          {rule.conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select value={c.field} onValueChange={(v) => setCondition(i, { field: v })}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent>{fields.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select>
              <Select value={c.op} onValueChange={(v) => setCondition(i, { op: v })}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent>{OPS.map((o) => <SelectItem key={o} value={o}>{o.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select>
              <Input value={c.value} onChange={(e) => setCondition(i, { value: e.target.value })} className="h-8 flex-1" placeholder="value" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCondition(i)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={addCondition}><Plus className="w-4 h-4 mr-1" /> Condition</Button>
      </div>
      <div className="border-t border-border pt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Then take these actions</p>
        <div className="space-y-2">
          {rule.actions.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <Select value={a.type} onValueChange={(v) => setAction(i, { type: v })}><SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger><SelectContent>{ACTIONS.map((act) => <SelectItem key={act} value={act}>{act.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select>
              <Input value={a.detail || ''} onChange={(e) => setAction(i, { detail: e.target.value })} className="h-8 flex-1" placeholder="detail (optional)" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeAction(i)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={addAction}><Plus className="w-4 h-4 mr-1" /> Action</Button>
      </div>
    </div>
  );
}