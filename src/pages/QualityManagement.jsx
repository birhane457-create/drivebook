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
import { Plus, ClipboardCheck, AlertTriangle, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const INSP_STATUS_COLOR = { pending: 'secondary', in_progress: 'default', passed: 'secondary', failed: 'destructive', conditional_pass: 'outline' };
const NCR_SEVERITY_COLOR = { minor: 'secondary', major: 'default', critical: 'destructive' };

export default function QualityManagement() {
  const qc = useQueryClient();
  const [openInsp, setOpenInsp] = useState(false);
  const [openNCR, setOpenNCR] = useState(false);
  const [inspForm, setInspForm] = useState({ type: 'incoming', product_id: '', product_name: '', quantity_inspected: 0, inspector: '', checklist_items: [] });
  const [ncrForm, setNcrForm] = useState({ product_id: '', product_name: '', type: 'defect', severity: 'minor', quantity_affected: 0, description: '', disposition: 'pending' });
  const [checkItem, setCheckItem] = useState('');

  const { data: inspections = [], isLoading: loadInsp } = useQuery({ queryKey: ['quality_inspections'], queryFn: () => base44.entities.QualityInspection.list('-created_date') });
  const { data: ncrs = [], isLoading: loadNCR } = useQuery({ queryKey: ['non_conformances'], queryFn: () => base44.entities.NonConformance.list('-created_date') });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  const createInsp = useMutation({ mutationFn: d => base44.entities.QualityInspection.create(d), onSuccess: () => { qc.invalidateQueries(['quality_inspections']); setOpenInsp(false); toast.success('Inspection created'); } });
  const createNCR = useMutation({ mutationFn: d => base44.entities.NonConformance.create(d), onSuccess: () => { qc.invalidateQueries(['non_conformances']); setOpenNCR(false); toast.success('NCR raised'); } });
  const passInsp = (id) => { base44.entities.QualityInspection.update(id, { status: 'passed', completed_date: new Date().toISOString() }); qc.invalidateQueries(['quality_inspections']); toast.success('Passed'); };
  const failInsp = (id) => { base44.entities.QualityInspection.update(id, { status: 'failed', completed_date: new Date().toISOString() }); qc.invalidateQueries(['quality_inspections']); toast.error('Failed'); };

  const selectProduct = (id, setter) => { const p = products.find(pr => pr.id === id); if (p) setter(f => ({ ...f, product_id: id, product_name: p.name })); };

  const passRate = inspections.length > 0 ? Math.round((inspections.filter(i => i.status === 'passed').length / inspections.length) * 100) : 0;

  return (
    <div className="p-6">
      <PageHeader title="Quality Management (QMS)" subtitle="Incoming inspections, non-conformances, CAPA tracking & supplier quality">
        <Button variant="outline" onClick={() => setOpenNCR(true)}><AlertTriangle className="w-4 h-4 mr-2" /> Raise NCR</Button>
        <Button onClick={() => setOpenInsp(true)}><Plus className="w-4 h-4 mr-2" /> New Inspection</Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pass Rate', value: `${passRate}%`, icon: CheckCircle, color: 'text-green-500' },
          { label: 'Pending', value: inspections.filter(i => i.status === 'pending').length, icon: ClipboardCheck, color: 'text-yellow-500' },
          { label: 'Open NCRs', value: ncrs.filter(n => n.status === 'open').length, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Critical NCRs', value: ncrs.filter(n => n.severity === 'critical').length, icon: XCircle, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="flex items-center gap-3 pt-4"><s.icon className={`w-8 h-8 ${s.color}`} /><div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="inspections">
        <TabsList className="mb-4">
          <TabsTrigger value="inspections">Inspections ({inspections.length})</TabsTrigger>
          <TabsTrigger value="ncrs">Non-Conformances ({ncrs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="inspections">
          {loadInsp ? <p className="text-sm text-muted-foreground">Loading...</p> : inspections.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground"><ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No inspections yet</p></div>
          ) : (
            <div className="space-y-2">
              {inspections.map(insp => (
                <Card key={insp.id}>
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs">{insp.inspection_number || `QC-${insp.id?.slice(-6).toUpperCase()}`}</span>
                        <Badge variant={INSP_STATUS_COLOR[insp.status] || 'outline'}>{insp.status}</Badge>
                        <Badge variant="outline" className="capitalize text-xs">{insp.type.replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-sm font-medium">{insp.product_name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {insp.quantity_inspected} · Inspector: {insp.inspector || 'Unassigned'} · {insp.checklist_items?.length || 0} checks</p>
                    </div>
                    {insp.status === 'pending' || insp.status === 'in_progress' ? (
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => passInsp(insp.id)}><CheckCircle className="w-3 h-3 mr-1" /> Pass</Button>
                        <Button size="sm" variant="destructive" onClick={() => failInsp(insp.id)}><XCircle className="w-3 h-3 mr-1" /> Fail</Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ncrs">
          {loadNCR ? <p className="text-sm text-muted-foreground">Loading...</p> : ncrs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground"><AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No non-conformances recorded</p></div>
          ) : (
            <div className="space-y-2">
              {ncrs.map(ncr => (
                <Card key={ncr.id} className={ncr.severity === 'critical' ? 'border-red-300' : ''}>
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs">{ncr.ncr_number || `NCR-${ncr.id?.slice(-6).toUpperCase()}`}</span>
                        <Badge variant={NCR_SEVERITY_COLOR[ncr.severity] || 'outline'} className="capitalize">{ncr.severity}</Badge>
                        <Badge variant="outline" className="capitalize text-xs">{ncr.type.replace('_', ' ')}</Badge>
                        <Badge variant="secondary" className="capitalize text-xs">{ncr.status}</Badge>
                      </div>
                      <p className="text-sm font-medium">{ncr.product_name}</p>
                      <p className="text-xs text-muted-foreground">Qty affected: {ncr.quantity_affected} · Disposition: {ncr.disposition} {ncr.cost_impact > 0 && `· Cost: $${ncr.cost_impact}`}</p>
                      {ncr.description && <p className="text-xs text-muted-foreground italic mt-0.5">{ncr.description}</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { base44.entities.NonConformance.update(ncr.id, { status: 'resolved' }); qc.invalidateQueries(['non_conformances']); }}>
                      Resolve
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Inspection Dialog */}
      <Dialog open={openInsp} onOpenChange={setOpenInsp}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Quality Inspection</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={inspForm.type} onValueChange={v => setInspForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['incoming', 'in_process', 'outgoing', 'supplier_audit', 'periodic'].map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Product</Label>
                <Select value={inspForm.product_id} onValueChange={v => selectProduct(v, setInspForm)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Qty Inspected</Label><Input type="number" value={inspForm.quantity_inspected} onChange={e => setInspForm(f => ({ ...f, quantity_inspected: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Inspector</Label><Input value={inspForm.inspector} onChange={e => setInspForm(f => ({ ...f, inspector: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Checklist Items</Label>
              <div className="border rounded-lg p-2 mt-1 space-y-1">
                {inspForm.checklist_items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="flex-1">{item.item}</span>
                    <select className="text-xs border rounded px-1" value={item.result} onChange={e => setInspForm(f => ({ ...f, checklist_items: f.checklist_items.map((c, j) => j === i ? { ...c, result: e.target.value } : c) }))}>
                      <option value="pass">Pass</option><option value="fail">Fail</option><option value="na">N/A</option>
                    </select>
                    <button onClick={() => setInspForm(f => ({ ...f, checklist_items: f.checklist_items.filter((_, j) => j !== i) }))}><Trash2 className="w-3 h-3 text-destructive" /></button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Input className="flex-1 text-xs h-7" placeholder="Add check item..." value={checkItem} onChange={e => setCheckItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && checkItem) { setInspForm(f => ({ ...f, checklist_items: [...f.checklist_items, { item: checkItem, result: 'pass' }] })); setCheckItem(''); }}} />
                  <Button size="sm" variant="outline" onClick={() => { if (checkItem) { setInspForm(f => ({ ...f, checklist_items: [...f.checklist_items, { item: checkItem, result: 'pass' }] })); setCheckItem(''); }}}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createInsp.mutate({ ...inspForm, status: 'pending' })}>Create Inspection</Button>
        </DialogContent>
      </Dialog>

      {/* NCR Dialog */}
      <Dialog open={openNCR} onOpenChange={setOpenNCR}>
        <DialogContent>
          <DialogHeader><DialogTitle>Raise Non-Conformance (NCR)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Product</Label>
              <Select value={ncrForm.product_id} onValueChange={v => selectProduct(v, setNcrForm)}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={ncrForm.type} onValueChange={v => setNcrForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['defect', 'damage', 'shortage', 'wrong_item', 'expired', 'other'].map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Severity</Label>
                <Select value={ncrForm.severity} onValueChange={v => setNcrForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['minor', 'major', 'critical'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Qty Affected</Label><Input type="number" value={ncrForm.quantity_affected} onChange={e => setNcrForm(f => ({ ...f, quantity_affected: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Disposition</Label>
                <Select value={ncrForm.disposition} onValueChange={v => setNcrForm(f => ({ ...f, disposition: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['rework', 'return_to_supplier', 'scrap', 'use_as_is', 'pending'].map(d => <SelectItem key={d} value={d} className="capitalize">{d.replace('_', ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Input value={ncrForm.description} onChange={e => setNcrForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <Button className="w-full mt-2 bg-red-600 hover:bg-red-700" onClick={() => createNCR.mutate({ ...ncrForm, status: 'open' })}>Raise NCR</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}