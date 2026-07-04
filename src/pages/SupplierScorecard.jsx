import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToastMutation } from '@/hooks/useToastMutation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import FormDialog from '@/components/dialogs/FormDialog';
import FormSection from '@/components/shared/FormSection';
import Field from '@/components/shared/Field';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import { Plus, Star, TrendingUp, TrendingDown, Award, Package } from 'lucide-react';

const SCORE_COLOR = (s) => s >= 80 ? 'text-emerald-500' : s >= 60 ? 'text-amber-500' : 'text-red-500';
const GRADE = (s) => s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B' : s >= 60 ? 'C' : 'D';

const EMPTY_FORM = { supplier_id: '', period: '', on_time_delivery_rate: '', quality_score: '', price_competitiveness: '', responsiveness_score: '', fill_rate: '', total_orders: '', defect_rate: '', notes: '' };

export default function SupplierScorecard() {
  const [showForm, setShowForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const suppliersQ = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const scoresQ = useQuery({ queryKey: ['supplier-scores'], queryFn: () => base44.entities.SupplierScore.list('-created_date') });
  const suppliers = suppliersQ.data || [];
  const scores = scoresQ.data || [];

  const createMutation = useToastMutation({
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
        on_time_delivery_rate: parseFloat(data.on_time_delivery_rate), quality_score: parseFloat(data.quality_score),
        price_competitiveness: parseFloat(data.price_competitiveness), responsiveness_score: parseFloat(data.responsiveness_score),
        fill_rate: parseFloat(data.fill_rate), total_orders: parseInt(data.total_orders) || 0, defect_rate: parseFloat(data.defect_rate) || 0,
      });
    },
    queryKeys: [['supplier-scores']],
    successMessage: 'Scorecard saved',
    onSuccess: () => setShowForm(false),
  });

  const latestBySupplier = {};
  scores.forEach(s => {
    if (!latestBySupplier[s.supplier_id] || s.created_date > latestBySupplier[s.supplier_id].created_date) latestBySupplier[s.supplier_id] = s;
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

  const avgScore = supplierCards.length ? Math.round(supplierCards.reduce((s, c) => s + (c.overall_score || 0), 0) / supplierCards.length) : 0;
  const totalOrders = supplierCards.reduce((s, c) => s + (c.total_orders || 0), 0);

  const kpis = [
    { label: 'Scored Suppliers', value: supplierCards.length, icon: Award },
    { label: 'Avg Score', value: avgScore, icon: Star, trend: '/100', trendUp: avgScore >= 70 },
    { label: 'Top Supplier', value: supplierCards[0]?.supplier_name || '—', icon: TrendingUp },
    { label: 'Total Orders', value: totalOrders, icon: Package },
  ];

  return (
    <EnterprisePageLayout
      title="Supplier Scorecards"
      description="Track and evaluate supplier performance across key metrics"
      primaryAction={{ label: 'Add Scorecard', icon: Plus, onClick: () => setShowForm(true) }}
      kpis={kpis}
      isLoading={scoresQ.isLoading}
    >
      {scoresQ.error ? (
        <ErrorState title="Couldn't load scorecards" message={scoresQ.error?.message} onRetry={scoresQ.refetch} />
      ) : scoresQ.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
      ) : supplierCards.length === 0 ? (
        <EmptyState illustration="no-results" title="No supplier scorecards yet" description="Add the first scorecard to start tracking supplier performance." className="py-20" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {supplierCards.map(score => (
              <Card key={score.supplier_id} className={`cursor-pointer card-hover ${selectedSupplier === score.supplier_id ? 'border-primary' : ''}`} onClick={() => setSelectedSupplier(selectedSupplier === score.supplier_id ? null : score.supplier_id)}>
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
                    <div className="mt-3 flex items-center gap-2 text-xs text-red-500"><TrendingDown className="w-3 h-3" />Defect rate: {score.defect_rate}%</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

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
                        <div className={`flex items-center justify-center text-xs mt-1 ${h.overall_score > supplierHistory[i - 1].overall_score ? 'text-emerald-500' : 'text-red-500'}`}>
                          {h.overall_score > supplierHistory[i - 1].overall_score ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                          {Math.abs(h.overall_score - supplierHistory[i - 1].overall_score)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <FormDialog
        open={showForm}
        onOpenChange={setShowForm}
        title="New Supplier Scorecard"
        submitLabel="Save Scorecard"
        isPending={createMutation.isPending}
        submitDisabled={!form.supplier_id || !form.period}
        onSubmit={() => createMutation.mutate(form)}
      >
        <FormSection title="Scorecard Details" icon={Award}>
          <Field label="Supplier" required htmlFor="ss-supplier">
            <Select value={form.supplier_id} onValueChange={v => setForm(p => ({ ...p, supplier_id: v }))}>
              <SelectTrigger id="ss-supplier"><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Period (e.g. 2025-Q2)" required htmlFor="ss-period">
            <Input id="ss-period" value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} placeholder="2025-Q2" />
          </Field>
        </FormSection>
        <FormSection title="Performance Metrics (0-100)" icon={Star} columns={2} className="mt-4">
          {metrics.map(m => (
            <Field key={m.key} label={`${m.label} ${m.weight}`} htmlFor={`ss-${m.key}`}>
              <Input id={`ss-${m.key}`} type="number" min="0" max="100" value={form[m.key]} onChange={e => setForm(p => ({ ...p, [m.key]: e.target.value }))} />
            </Field>
          ))}
          <Field label="Total Orders" htmlFor="ss-orders">
            <Input id="ss-orders" type="number" value={form.total_orders} onChange={e => setForm(p => ({ ...p, total_orders: e.target.value }))} />
          </Field>
          <Field label="Defect Rate (%)" htmlFor="ss-defect">
            <Input id="ss-defect" type="number" min="0" max="100" step="0.1" value={form.defect_rate} onChange={e => setForm(p => ({ ...p, defect_rate: e.target.value }))} />
          </Field>
        </FormSection>
        <FormSection title="Notes" className="mt-4">
          <Field htmlFor="ss-notes">
            <Textarea id="ss-notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
          </Field>
        </FormSection>
      </FormDialog>
    </EnterprisePageLayout>
  );
}