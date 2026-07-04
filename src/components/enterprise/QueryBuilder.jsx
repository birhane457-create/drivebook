import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GitBranch, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

const OPERATORS = ['equals', 'not_equals', 'contains', 'gt', 'gte', 'lt', 'lte', 'in', 'between', 'is_empty', 'is_not_empty'];
const noValueOps = ['is_empty', 'is_not_empty'];

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function QueryBuilder({ fields = [], value, onChange, className }) {
  const [root, setRoot] = useState(value || { id: makeId(), logic: 'AND', rules: [] });

  const emit = (next) => { setRoot(next); onChange?.(next); };

  const addRule = (group) => updateGroup(group.id, { rules: [...group.rules, { id: makeId(), type: 'condition', field: fields[0]?.value || fields[0] || '', op: 'equals', value: '' }] });
  const addGroup = (group) => updateGroup(group.id, { rules: [...group.rules, { id: makeId(), type: 'group', logic: 'AND', rules: [] }] });

  const updateGroup = (groupId, patch) => {
    const walk = (g) => {
      if (g.id === groupId) return { ...g, ...patch };
      return { ...g, rules: g.rules.map((r) => r.type === 'group' ? walk(r) : r) };
    };
    emit(walk(root));
  };

  const removeRule = (groupId, ruleId) => {
    const walk = (g) => ({ ...g, rules: g.rules.filter((r) => r.id === ruleId).length === 0 ? g.rules : g.rules.map((r) => r.type === 'group' ? walk(r) : r).filter((r) => r.id !== ruleId) });
    emit(walk(root));
  };

  const setRule = (groupId, ruleId, patch) => {
    const walk = (g) => ({ ...g, rules: g.rules.map((r) => r.id === ruleId ? { ...r, ...patch } : r.type === 'group' ? walk(r) : r) });
    emit(walk(root));
  };

  const toggleLogic = (groupId) => {
    const walk = (g) => g.id === groupId ? { ...g, logic: g.logic === 'AND' ? 'OR' : 'AND' } : { ...g, rules: g.rules.map((r) => r.type === 'group' ? walk(r) : r) };
    emit(walk(root));
  };

  const renderGroup = (group, depth = 0) => (
    <div key={group.id} className={cn('rounded-lg border bg-background/50', depth === 0 ? 'p-3' : 'p-2 mt-2')} style={{ marginLeft: depth > 0 ? 0 : 0 }}>
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs font-bold" onClick={() => toggleLogic(group.id)}>
          <GitBranch className="w-3 h-3 mr-1" /> {group.logic}
        </Button>
        <span className="text-[10px] text-muted-foreground">{group.rules.length} rule{group.rules.length !== 1 ? 's' : ''}</span>
        {depth > 0 && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-auto" onClick={() => removeRule(null, group.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {group.rules.map((rule, i) => (
          <div key={rule.id}>
            {i > 0 && <p className="text-[10px] font-bold text-muted-foreground my-1 ml-1">{group.logic}</p>}
            {rule.type === 'group' ? renderGroup(rule, depth + 1) : (
              <div className="flex items-center gap-2">
                <Select value={rule.field} onValueChange={(v) => setRule(group.id, rule.id, { field: v })}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{fields.map((f) => { const opt = typeof f === 'string' ? { value: f, label: f } : f; return <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>; })}</SelectContent>
                </Select>
                <Select value={rule.op} onValueChange={(v) => setRule(group.id, rule.id, { op: v })}>
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>{OPERATORS.map((o) => <SelectItem key={o} value={o}>{o.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
                {!noValueOps.includes(rule.op) && <Input value={rule.value} onChange={(e) => setRule(group.id, rule.id, { value: e.target.value })} className="h-8 flex-1" placeholder="Value" />}
                {noValueOps.includes(rule.op) && <div className="flex-1" />}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(group.id, rule.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <Button variant="outline" size="sm" className="h-7" onClick={() => addRule(group)}><Plus className="w-3 h-3 mr-1" /> Rule</Button>
        <Button variant="outline" size="sm" className="h-7" onClick={() => addGroup(group)}><GitBranch className="w-3 h-3 mr-1" /> Group</Button>
      </div>
    </div>
  );

  return <div className={cn('rounded-xl border bg-card p-4', className)}>{renderGroup(root)}</div>;
}