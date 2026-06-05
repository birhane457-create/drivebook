import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import PageHeader from '@/components/shared/PageHeader';
import { Plus, Star, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { toast } from 'sonner';

const SCORE_COLOR = (s) => s >= 80 ? 'text-emerald-500' : s >= 60 ? 'text-amber-500' : 'text-red-500';
const SCORE_BG = (s) => s >= 80 ? 'bg-emerald-500' : s >= 60 ? 'bg-amber-500' : 'bg-red-500';
const GRADE = (s) => s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : 'D';

export default function SupplierScorecard() {
  const [showForm, setShowForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [form, setForm] = useState({
    supplier_id: '', period: '', on_time_delivery_rate: '', quality_score: '',
    price_competitiveness: '', responsiveness_score: '', fill_rate: '',
    total_orders: '', defect_rate: '', notes: ''
  });
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: scores = [], isLoading } = useQuery({ queryKey: ['supplier-scores'], queryFn: () => base44.entities.SupplierScore.list('-created_date') });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const weights = { on_time_delivery_rate: 0.3, quality_score: 0.25, fill_rate: 0.2, price_competitiveness: 0.15, responsiveness_score: 0.1 };
      const overall = Math.round(
        (parseFloat(data.on_time_delivery_rate) || 0) * weights.on_time_delivery_rate +
        (parseFloat(data.quality_score) || 0) * weights.quality_score +
        (parseFloat(data.fill_rate) || 0) * weights.fill_rate +
        (parseFloat(data.price_competitiveness) || 0) * weights.price_competitiveness +
        (parseFloat(data.responsiveness_score) || 0) * weights.responsiveness_score
      );
      const supplier = suppliers.find(s => s.id === data.supplier_id);
      return base44.entities.SupplierScore.create({
        ...data, overall_score: overall, supplier_name: supplier?.name || '',
        on_time_delivery_rate: parseFloat(data.on_time_delivery_rate),
        quality_score: parseFloat(data.quality_score),
        price_competitiveness: parseFloat(data.price_competitiveness),
        responsiveness_score: parseFloat(data.responsiveness_score),
        fill_rate: parseFloat(data.fill_rate),
        total_orders: parseInt(data.total_orders) || 0,
        defect_rate: parseFloat(data.defect_rate) || 0,
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplier-scores'] }); setShowForm(false); toast.success('Scorecard saved'); },
  });

  // Group scores by supplier, take latest
  const latestBySupplier = {};
  scores.forEach(s => {
    if (!latestBySupplier[s.supplier_id] || s.created_date > latestBySupplier[s.supplier_id].created_date) {
      latestBySupplier[s.supplier_id] = s;
    }
  });
  const supplierCards = Object.values(latestBySupplier).sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));

  const supplierHistory = selectedSupplier ? scores.filter(s => s.supplier_id === selectedSupplier).sort((a, b) => a.period?.localeCompare(b.period)) : [];

  const metrics = [
    { key: 'on_time_delivery_rate', label: 'On-Time Delivery', weight: '30%' },
    { key: 'quality_score', label: 'Quality Score', weight: '25%' },
    { key: 'fill_rate', label: 'Fill Rate', weight: '20%' },
    { key: 'price_competitiveness', label: 'Price Competitiveness', weight: '15%' },
    { key: 'responsiveness_score', label: 'Responsiveness', weight: '10%' },
  ];

  return (
    <div>
      <PageHeader title="Supplier Scorecards" subtitle="Track and evaluate supplier performance across key metrics">
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Add Scorecard</Button>
      </PageHeader>

      {/* Supplier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {supplierCards.map(score => (
          <Card
            key={score.supplier_id}
            className={`cursor-pointer transition-all hover:shadow-lg ${selectedSupplier === score.supplier_id ? 'border-primary' : ''}`}
            onClick={() => setSelectedSupplier(selectedSupplier === score.supplier_id ? null : score.supplier_id)}
          >
            <CardContent className="pt-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold">{score.supplier_name}</p>
                  <p className="text-xs text-muted-foreground">{score.period}</p>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${SCORE_COLOR(score.overall_score)}`}>{GRADE(score.overall_score)}</div>
                  <p className={`text-xs font-medium ${SCORE_COLOR(score.overall_score)}`}>{score.overall_score}/100</p>
                </div>
              </div>
              {metrics.map(m => (
                <div key={m.key} className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className={`font-medium ${SCORE_COLOR(score[m.key])}`}>{score[m.key]}%</span>
                  </div>
                  <Progress value={score[m.key]} className="h-1.5" />
                </div>
              ))}
              {score.defect_rate > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-red-500">
                  <TrendingDown className="w-3 h-3" />
                  Defect rate: {score.defect_rate}%
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {supplierCards.length === 0 && !isLoading && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No supplier scorecards yet. Add the first one.</p>
          </div>
        )}
      </div>

      {/* History for selected supplier */}
      {selectedSupplier && supplierHistory.length > 1 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Performance History — {supplierHistory[0]?.supplier_name}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {supplierHistory.map((h, i) => (
                <div key={i} className="flex-shrink-0 text-center p-3 rounded-lg border min-w-[100px]">
                  <p className="text-xs text-muted-foreground mb-1">{h.period}</p>
                  <p className={`text-2xl font-bold ${SCORE_COLOR(h.overall_score)}`}>{h.overall_score}</p>
                  {i > 0 && (
                    <div className={`flex items-center justify-center text-xs mt-1 ${h.overall_score > supplierHistory[i-1].overall_score ? 'text-emerald-500' : 'text-red-500'}`}>
                      {h.overall_score > supplierHistory[i-1].overall_score ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                      {Math.abs(h.overall_score - supplierHistory[i-1].overall_score)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Supplier Scorecard</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={v => setForm(p => ({ ...p, supplier_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Period (e.g. 2025-Q2) *</Label><Input value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} required placeholder="2025-Q2" /></div>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map(m => (
                <div key={m.key}>
                  <Label className="text-xs">{m.label} (0-100) <span className="text-muted-foreground">{m.weight}</span></Label>
                  <Input type="number" min="0" max="100" value={form[m.key]} onChange={e => setForm(p => ({ ...p, [m.key]: e.target.value }))} required />
                </div>
              ))}
              <div>
                <Label className="text-xs">Total Orders</Label>
                <Input type="number" value={form.total_orders} onChange={e => setForm(p => ({ ...p, total_orders: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Defect Rate (%)</Label>
                <Input type="number" min="0" max="100" step="0.1" value={form.defect_rate} onChange={e => setForm(p => ({ ...p, defect_rate: e.target.value }))} />
              </div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending || !form.supplier_id}>
              {createMutation.isPending ? 'Saving...' : 'Save Scorecard'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}