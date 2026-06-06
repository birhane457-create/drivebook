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
import { Progress } from '@/components/ui/progress';
import { Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const FRAMEWORK_COLORS = { SOX: 'bg-blue-100 text-blue-700', GDPR: 'bg-green-100 text-green-700', ISO27001: 'bg-purple-100 text-purple-700', PCI_DSS: 'bg-red-100 text-red-700', HIPAA: 'bg-orange-100 text-orange-700', custom: 'bg-gray-100 text-gray-700' };
const STATUS_V = { compliant: 'secondary', non_compliant: 'destructive', partial: 'default', not_applicable: 'outline', under_review: 'outline' };

export default function ComplianceMatrix() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterFW, setFilterFW] = useState('all');
  const [form, setForm] = useState({ name: '', framework: 'ISO27001', control_id: '', description: '', category: 'access_control', risk_level: 'medium', owner: '', next_review: '' });

  const { data: rules = [], isLoading } = useQuery({ queryKey: ['compliance_rules'], queryFn: () => base44.entities.ComplianceRule.list() });

  const createMut = useMutation({ mutationFn: d => base44.entities.ComplianceRule.create(d), onSuccess: () => { qc.invalidateQueries(['compliance_rules']); setOpen(false); toast.success('Control added'); } });
  const statusMut = useMutation({ mutationFn: ({ id, status }) => base44.entities.ComplianceRule.update(id, { status, last_reviewed: new Date().toISOString().split('T')[0] }), onSuccess: () => qc.invalidateQueries(['compliance_rules']) });

  const filtered = rules.filter(r => filterFW === 'all' || r.framework === filterFW);
  const compliantCount = rules.filter(r => r.status === 'compliant').length;
  const compliancePct = rules.length > 0 ? Math.round((compliantCount / rules.length) * 100) : 0;

  const byFramework = {};
  rules.forEach(r => { byFramework[r.framework] = byFramework[r.framework] || { total: 0, compliant: 0 }; byFramework[r.framework].total++; if (r.status === 'compliant') byFramework[r.framework].compliant++; });

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-green-600">{compliancePct}%</p><p className="text-xs text-muted-foreground">Overall Compliance</p><Progress value={compliancePct} className="h-1 mt-1" /></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-green-600">{compliantCount}</p><p className="text-xs text-muted-foreground">Compliant Controls</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-red-500">{rules.filter(r => r.status === 'non_compliant').length}</p><p className="text-xs text-muted-foreground">Non-Compliant</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{rules.filter(r => r.status === 'under_review').length}</p><p className="text-xs text-muted-foreground">Under Review</p></CardContent></Card>
      </div>

      {Object.keys(byFramework).length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {Object.entries(byFramework).map(([fw, data]) => (
            <button key={fw} onClick={() => setFilterFW(filterFW === fw ? 'all' : fw)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterFW === fw ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${FRAMEWORK_COLORS[fw] || ''}`}>{fw}</span>
              {data.compliant}/{data.total}
            </button>
          ))}
          {filterFW !== 'all' && <button onClick={() => setFilterFW('all')} className="text-xs text-muted-foreground hover:text-foreground">Clear filter</button>}
        </div>
      )}

      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Control</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No compliance controls yet. Add controls to track your compliance posture.</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} className={r.status === 'non_compliant' ? 'border-red-200' : ''}>
              <CardContent className="flex items-center gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${FRAMEWORK_COLORS[r.framework] || ''}`}>{r.framework}</span>
                    <span className="font-mono text-xs">{r.control_id}</span>
                    <span className="font-medium text-sm">{r.name}</span>
                    <Badge variant={STATUS_V[r.status] || 'outline'} className="text-xs capitalize">{r.status?.replace('_', ' ')}</Badge>
                    <Badge variant={r.risk_level === 'critical' ? 'destructive' : 'outline'} className="text-xs capitalize">{r.risk_level} risk</Badge>
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  <p className="text-xs text-muted-foreground capitalize">{r.category?.replace('_', ' ')} {r.owner && `· Owner: ${r.owner}`} {r.next_review && `· Next review: ${r.next_review}`}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {r.status !== 'compliant' && <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs h-7" onClick={() => statusMut.mutate({ id: r.id, status: 'compliant' })}>Mark Compliant</Button>}
                  {r.status !== 'non_compliant' && <Button size="sm" variant="outline" className="text-xs h-7 text-red-600 border-red-300" onClick={() => statusMut.mutate({ id: r.id, status: 'under_review' })}>Review</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Compliance Control</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Framework</Label>
              <Select value={form.framework} onValueChange={v => setForm(f => ({ ...f, framework: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['SOX', 'GDPR', 'ISO27001', 'PCI_DSS', 'HIPAA', 'custom'].map(fw => <SelectItem key={fw} value={fw}>{fw}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Control ID</Label><Input value={form.control_id} onChange={e => setForm(f => ({ ...f, control_id: e.target.value }))} placeholder="e.g. A.9.1.1" /></div>
            <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['access_control', 'data_protection', 'audit_logging', 'change_management', 'incident_response', 'business_continuity'].map(c => <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Risk Level</Label>
              <Select value={form.risk_level} onValueChange={v => setForm(f => ({ ...f, risk_level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['low', 'medium', 'high', 'critical'].map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Owner</Label><Input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} /></div>
            <div><Label>Next Review</Label><Input type="date" value={form.next_review} onChange={e => setForm(f => ({ ...f, next_review: e.target.value }))} /></div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, status: 'under_review', evidence_required: true })}>Add Control</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}