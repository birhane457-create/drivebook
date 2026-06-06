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
import { Plus, Layers, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductFamilyManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '', attribute_schema: [] });
  const [attrRow, setAttrRow] = useState({ name: '', type: 'text', required: false });

  const { data: families = [], isLoading } = useQuery({ queryKey: ['product_families'], queryFn: () => base44.entities.ProductFamily.list() });

  const createMut = useMutation({
    mutationFn: d => base44.entities.ProductFamily.create(d),
    onSuccess: () => { qc.invalidateQueries(['product_families']); setOpen(false); toast.success('Product family created'); },
  });

  const addAttr = () => {
    if (!attrRow.name) return;
    setForm(f => ({ ...f, attribute_schema: [...f.attribute_schema, { ...attrRow }] }));
    setAttrRow({ name: '', type: 'text', required: false });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{families.length} product families</p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> New Family</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : families.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Layers className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No product families. Create families to group products with shared attributes.</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {families.map(fam => (
            <Card key={fam.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-2">
                  <div><p className="font-semibold">{fam.name}</p><p className="text-xs font-mono text-muted-foreground">{fam.code}</p></div>
                  <Badge variant={fam.is_active ? 'default' : 'secondary'}>{fam.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                {fam.description && <p className="text-xs text-muted-foreground mb-2">{fam.description}</p>}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1"><span>Data Quality</span><span>{fam.data_quality_score || 0}%</span></div>
                  <Progress value={fam.data_quality_score || 0} className="h-1" />
                </div>
                <p className="text-xs text-muted-foreground">{fam.attribute_schema?.length || 0} attributes · {fam.product_count || 0} products</p>
                {fam.attribute_schema?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {fam.attribute_schema.map((a, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{a.name}: {a.type}{a.required ? '*' : ''}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Product Family</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} /></div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div>
              <Label>Attribute Schema</Label>
              <div className="border rounded-lg p-2 mt-1 space-y-1">
                {form.attribute_schema.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="flex-1">{a.name}</span>
                    <Badge variant="outline">{a.type}</Badge>
                    {a.required && <Badge variant="default">required</Badge>}
                    <button onClick={() => setForm(f => ({ ...f, attribute_schema: f.attribute_schema.filter((_, j) => j !== i) }))}><Trash2 className="w-3 h-3 text-destructive" /></button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Input className="flex-1 text-xs h-7" placeholder="Attribute name" value={attrRow.name} onChange={e => setAttrRow(r => ({ ...r, name: e.target.value }))} />
                  <Select value={attrRow.type} onValueChange={v => setAttrRow(r => ({ ...r, type: v }))}>
                    <SelectTrigger className="w-20 text-xs h-7"><SelectValue /></SelectTrigger>
                    <SelectContent>{['text', 'number', 'select', 'boolean'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={addAttr}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={() => createMut.mutate({ ...form, is_active: true, product_count: 0, data_quality_score: 0 })}>Create Family</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}