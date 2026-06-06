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
import { Plus, Trash2, Play, GitBranch, ArrowDown, CheckCircle, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['pricing', 'discount', 'approval', 'fulfillment', 'shipping', 'tax', 'loyalty', 'credit'];
const STATUS_COLORS = { draft: 'secondary', testing: 'default', active: 'secondary', archived: 'outline' };

const EXAMPLE_RULES = [
  { name: 'Platinum Customer Large Order', conditions: [{ field: 'customer.tier', operator: 'eq', value: 'Platinum' }, { field: 'order.value', operator: 'gt', value: '50000' }], actions: [{ action: 'set_discount', field: 'discount_pct', value: '7' }] },
  { name: 'Gold Tier Discount', conditions: [{ field: 'customer.tier', operator: 'eq', value: 'Gold' }], actions: [{ action: 'set_discount', field: 'discount_pct', value: '10' }] },
  { name: 'Volume Pricing', conditions: [{ field: 'line.quantity', operator: 'gte', value: '100' }], actions: [{ action: 'set_discount', field: 'discount_pct', value: '5' }] },
];

const EMPTY = { name: '', description: '', category: 'pricing', priority: 0, version: '1.0', conditions: [], actions: [] };

export default function BusinessRulesEngine() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [simInput, setSimInput] = useState('{\n  "customer.tier": "Gold",\n  "order.value": 12000\n}');
  const [simResult, setSimResult] = useState(null);
  const [simRule, setSimRule] = useState(null);

  const { data: rules = [], isLoading } = useQuery({ queryKey: ['business_rules'], queryFn: () => base44.entities.BusinessRule.list() });

  const createMut = useMutation({ mutationFn: d => base44.entities.BusinessRule.create(d), onSuccess: () => { qc.invalidateQueries(['business_rules']); setOpen(false); setForm(EMPTY); toast.success('Rule created'); } });
  const statusMut = useMutation({ mutationFn: ({ id, status }) => base44.entities.BusinessRule.update(id, { status, last_deployed: status === 'active' ? new Date().toISOString() : undefined }), onSuccess: () => qc.invalidateQueries(['business_rules']) });

  const addCond = () => setForm(f => ({ ...f, conditions: [...f.conditions, { field: '', operator: 'eq', value: '', logic: 'AND' }] }));
  const addAction = () => setForm(f => ({ ...f, actions: [...f.actions, { action: 'set_discount', field: '', value: '' }] }));
  const remCond = i => setForm(f => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }));
  const remAction = i => setForm(f => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }));
  const updCond = (i, k, v) => setForm(f => ({ ...f, conditions: f.conditions.map((c, j) => j === i ? { ...c, [k]: v } : c) }));
  const updAction = (i, k, v) => setForm(f => ({ ...f, actions: f.actions.map((a, j) => j === i ? { ...a, [k]: v } : a) }));

  const simulate = () => {
    if (!simRule) return;
    try {
      const ctx = JSON.parse(simInput);
      const passed = simRule.conditions.every(c => {
        const val = ctx[c.field];
        if (val === undefined) return false;
        const num = parseFloat(val); const condNum = parseFloat(c.value);
        if (c.operator === 'eq') return String(val) === String(c.value);
        if (c.operator === 'gt') return num > condNum;
        if (c.operator === 'gte') return num >= condNum;
        if (c.operator === 'lt') return num < condNum;
        if (c.operator === 'lte') return num <= condNum;
        return false;
      });
      setSimResult({ passed, actions: passed ? simRule.actions : [], input: ctx });
    } catch { toast.error('Invalid JSON input'); }
  };

  return (
    <div className="p-6">
      <PageHeader title="Business Rules Engine" subtitle="IF-THEN rule designer, simulator, versioning & deployment — no coding required">
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> New Rule</Button>
      </PageHeader>

      <Tabs defaultValue="rules">
        <TabsList className="mb-6">
          <TabsTrigger value="rules">Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="examples">Templates</TabsTrigger>
          <TabsTrigger value="simulator">Simulator</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : rules.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground"><GitBranch className="w-14 h-14 mx-auto mb-3 opacity-30" /><p className="font-medium">No rules yet</p><p className="text-sm">Start from the Templates tab or create a new rule.</p></div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <Card key={rule.id}>
                  <CardContent className="flex items-start gap-4 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{rule.name}</span>
                        <Badge variant={STATUS_COLORS[rule.status] || 'outline'}>{rule.status}</Badge>
                        <Badge variant="outline" className="capitalize">{rule.category}</Badge>
                        <span className="text-xs text-muted-foreground">v{rule.version} · P{rule.priority}</span>
                      </div>
                      {rule.description && <p className="text-xs text-muted-foreground mb-2">{rule.description}</p>}
                      <div className="flex flex-wrap gap-1">
                        {rule.conditions?.map((c, i) => <Badge key={i} variant="outline" className="text-xs font-mono">{c.field} {c.operator} {c.value}</Badge>)}
                        {rule.actions?.map((a, i) => <Badge key={i} className="text-xs">{a.action} {a.field}={a.value}</Badge>)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Runs: {rule.run_count || 0} {rule.last_deployed && `· Deployed: ${new Date(rule.last_deployed).toLocaleDateString()}`}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={() => { setSimRule(rule); setSimOpen(true); }}><FlaskConical className="w-3 h-3 mr-1" /> Test</Button>
                      {rule.status === 'draft' && <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: rule.id, status: 'testing' })}>→ Test</Button>}
                      {rule.status === 'testing' && <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => statusMut.mutate({ id: rule.id, status: 'active' })}><Play className="w-3 h-3 mr-1" /> Deploy</Button>}
                      {rule.status === 'active' && <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: rule.id, status: 'archived' })}>Archive</Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="examples">
          <div className="grid md:grid-cols-3 gap-4">
            {EXAMPLE_RULES.map(ex => (
              <Card key={ex.name} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <p className="font-semibold text-sm mb-2">{ex.name}</p>
                  <div className="space-y-1 mb-3">
                    {ex.conditions.map((c, i) => <p key={i} className="text-xs font-mono text-muted-foreground">IF {c.field} {c.operator} {c.value}</p>)}
                    {ex.actions.map((a, i) => <p key={i} className="text-xs font-mono text-primary">THEN {a.action}({a.field}, {a.value})</p>)}
                  </div>
                  <Button size="sm" className="w-full" onClick={() => { setForm({ ...EMPTY, name: ex.name, category: 'pricing', conditions: ex.conditions, actions: ex.actions }); setOpen(true); }}>Use Template</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="simulator">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Rule Simulator</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>Select Rule to Test</Label>
                  <Select value={simRule?.id || ''} onValueChange={v => setSimRule(rules.find(r => r.id === v))}>
                    <SelectTrigger><SelectValue placeholder="Select a rule..." /></SelectTrigger>
                    <SelectContent>{rules.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Input Context (JSON)</Label>
                  <textarea className="w-full h-40 font-mono text-xs p-3 border rounded-lg bg-muted/30 resize-none focus:outline-none focus:ring-1 focus:ring-primary" value={simInput} onChange={e => setSimInput(e.target.value)} />
                </div>
                <Button className="w-full" onClick={simulate} disabled={!simRule}><FlaskConical className="w-4 h-4 mr-2" /> Simulate</Button>
              </CardContent>
            </Card>
            {simResult && (
              <Card className={simResult.passed ? 'border-green-300' : 'border-muted'}>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${simResult.passed ? 'text-green-500' : 'text-muted-foreground'}`} /> Simulation Result
                </CardTitle></CardHeader>
                <CardContent>
                  <Badge className={`mb-3 ${simResult.passed ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`} variant="outline">
                    {simResult.passed ? '✅ Rule MATCHED — actions will execute' : '⬜ Rule did not match — no actions executed'}
                  </Badge>
                  {simResult.passed && simResult.actions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2">Actions Executed:</p>
                      {simResult.actions.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-green-50 rounded text-xs font-mono mb-1">
                          <Play className="w-3 h-3 text-green-600" /> {a.action}({a.field}) = {a.value}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Business Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Rule Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Priority (higher = first)</Label><Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Version</Label><Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            </div>

            <Card className="border-yellow-200 bg-yellow-50/30">
              <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                <p className="text-xs font-bold uppercase text-yellow-700">IF Conditions</p>
                <Button size="sm" variant="outline" onClick={addCond}><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </CardHeader>
              <CardContent className="pb-3 pt-0 px-3 space-y-2">
                {form.conditions.length === 0 && <p className="text-xs text-muted-foreground">No conditions — rule always runs</p>}
                {form.conditions.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    {i > 0 && <Select value={c.logic || 'AND'} onValueChange={v => updCond(i, 'logic', v)}><SelectTrigger className="w-14 text-xs h-7"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AND">AND</SelectItem><SelectItem value="OR">OR</SelectItem></SelectContent></Select>}
                    {i === 0 && <span className="w-14 text-xs text-center font-bold text-yellow-700">IF</span>}
                    <Input className="flex-1 text-xs h-7" placeholder="field (e.g. customer.tier)" value={c.field} onChange={e => updCond(i, 'field', e.target.value)} />
                    <Select value={c.operator || 'eq'} onValueChange={v => updCond(i, 'operator', v)}><SelectTrigger className="w-16 text-xs h-7"><SelectValue /></SelectTrigger><SelectContent>{[['eq','='],['gt','>'],['gte','≥'],['lt','<'],['lte','≤'],['contains','∋']].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
                    <Input className="w-24 text-xs h-7" placeholder="value" value={c.value} onChange={e => updCond(i, 'value', e.target.value)} />
                    <button onClick={() => remCond(i)}><Trash2 className="w-3 h-3 text-destructive" /></button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-muted-foreground" /></div>

            <Card className="border-green-200 bg-green-50/30">
              <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                <p className="text-xs font-bold uppercase text-green-700">THEN Actions</p>
                <Button size="sm" variant="outline" onClick={addAction}><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </CardHeader>
              <CardContent className="pb-3 pt-0 px-3 space-y-2">
                {form.actions.length === 0 && <p className="text-xs text-muted-foreground">Add at least one action</p>}
                {form.actions.map((a, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select value={a.action} onValueChange={v => updAction(i, 'action', v)}><SelectTrigger className="w-32 text-xs h-7"><SelectValue /></SelectTrigger><SelectContent>{['set_discount','set_price','require_approval','send_alert','apply_tax','set_shipping','add_loyalty_pts'].map(act => <SelectItem key={act} value={act} className="text-xs">{act}</SelectItem>)}</SelectContent></Select>
                    <Input className="flex-1 text-xs h-7" placeholder="field" value={a.field} onChange={e => updAction(i, 'field', e.target.value)} />
                    <span className="text-xs">=</span>
                    <Input className="w-20 text-xs h-7" placeholder="value" value={a.value} onChange={e => updAction(i, 'value', e.target.value)} />
                    <button onClick={() => remAction(i)}><Trash2 className="w-3 h-3 text-destructive" /></button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <Button className="w-full mt-2" disabled={!form.name} onClick={() => createMut.mutate({ ...form, status: 'draft', run_count: 0 })}>Save Rule</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}