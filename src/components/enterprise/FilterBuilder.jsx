import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Parentheses } from 'lucide-react';

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less or equal' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'in', label: 'in list' },
];

const noValueOps = ['is_empty', 'is_not_empty'];

export default function FilterBuilder({ fields = [], value, onChange, className }) {
  const rules = value || [];
  const logic = 'AND';

  const update = (next) => onChange?.(next);

  const addRule = () => update([...rules, { field: fields[0]?.value || fields[0] || '', op: 'equals', value: '' }]);
  const setRule = (i, patch) => update(rules.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeRule = (i) => update(rules.filter((_, idx) => idx !== i));

  const fieldOptions = fields.map((f) => (typeof f === 'string' ? { value: f, label: f } : f));

  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Parentheses className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Match ALL (AND)</p>
        </div>
        <span className="text-[11px] text-muted-foreground">{rules.length} condition{rules.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-2">
        {rules.length === 0 && <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">No conditions yet — add one below.</p>}
        {rules.map((rule, i) => (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-[10px] font-bold text-muted-foreground w-6 text-center">AND</span>}
            <Select value={rule.field} onValueChange={(v) => setRule(i, { field: v })}>
              <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Field" /></SelectTrigger>
              <SelectContent>{fieldOptions.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={rule.op} onValueChange={(v) => setRule(i, { op: v })}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{OPERATORS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            {!noValueOps.includes(rule.op) && (
              <Input value={rule.value} onChange={(e) => setRule(i, { value: e.target.value })} className="h-8 flex-1" placeholder="Value" />
            )}
            {noValueOps.includes(rule.op) && <div className="flex-1" />}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(i)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-3" onClick={addRule}><Plus className="w-4 h-4 mr-1" /> Add Condition</Button>
    </div>
  );
}