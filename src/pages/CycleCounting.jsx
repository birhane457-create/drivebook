import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToastMutation } from '@/hooks/useToastMutation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import FormDialog from '@/components/dialogs/FormDialog';
import FormSection from '@/components/shared/FormSection';
import Field from '@/components/shared/Field';
import StatusBadge from '@/components/shared/StatusBadge';
import { Plus, ClipboardCheck, CheckCircle, MapPin, CalendarClock, Activity, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';

export default function CycleCounting() {
  const [showCreate, setShowCreate] = useState(false);
  const [activeCount, setActiveCount] = useState(null);
  const [form, setForm] = useState({ location_id: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'), abc_class: 'all', assigned_to: '' });

  const countsQ = useQuery({ queryKey: ['cycle-counts'], queryFn: () => base44.entities.CycleCount.list('-created_date', 50) });
  const locationsQ = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });
  const productsQ = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const stockQ = useQuery({ queryKey: ['stock-levels'], queryFn: () => base44.entities.StockLevel.list() });
  const counts = countsQ.data || [];
  const locations = locationsQ.data || [];
  const products = productsQ.data || [];
  const stockLevels = stockQ.data || [];

  const createMutation = useToastMutation({
    mutationFn: async (data) => {
      const locationStocks = stockLevels.filter(s => s.location_id === data.location_id);
      const items = locationStocks.map(sl => {
        const product = products.find(p => p.id === sl.product_id);
        return { product_id: sl.product_id, product_name: product?.name || '', sku: product?.sku || '', expected_quantity: sl.quantity, counted_quantity: null, variance: null, is_counted: false };
      }).filter(i => i.product_name);
      const countNumber = `CC-${Date.now().toString().slice(-8)}`;
      return base44.entities.CycleCount.create({ ...data, count_number: countNumber, items, status: 'scheduled' });
    },
    queryKeys: [['cycle-counts']],
    successMessage: 'Cycle count scheduled',
    onSuccess: () => setShowCreate(false),
  });

  const updateItemMutation = useToastMutation({
    mutationFn: ({ countId, items, status, total_variance }) => base44.entities.CycleCount.update(countId, { items, status, total_variance }),
    queryKeys: [['cycle-counts']],
    successMessage: 'Count saved',
    onSuccess: () => setActiveCount(null),
  });

  const handleCountItem = (productId, countedQty) => {
    if (!activeCount) return;
    const updated = activeCount.items.map(item => {
      if (item.product_id !== productId) return item;
      const counted = parseFloat(countedQty) ?? item.expected_quantity;
      return { ...item, counted_quantity: counted, variance: counted - item.expected_quantity, is_counted: true };
    });
    setActiveCount(prev => ({ ...prev, items: updated }));
  };

  const completeCount = () => {
    if (!activeCount) return;
    const uncounted = activeCount.items.filter(i => !i.is_counted).length;
    if (uncounted > 0 && !confirm(`${uncounted} items haven't been counted. Complete anyway?`)) return;
    const totalVariance = activeCount.items.reduce((sum, i) => sum + (i.variance || 0), 0);
    updateItemMutation.mutate({ countId: activeCount.id, items: activeCount.items, status: 'completed', total_variance: totalVariance });
  };

  const openCount = (count) => setActiveCount({ ...count, items: [...(count.items || [])] });

  const columns = [
    { key: 'count_number', label: 'Count #', render: r => <span className="font-mono text-sm">{r.count_number}</span> },
    { key: 'location', label: 'Location', render: r => locations.find(l => l.id === r.location_id)?.name || '—' },
    { key: 'scheduled_date', label: 'Scheduled', render: r => r.scheduled_date || '—' },
    { key: 'abc_class', label: 'Class', render: r => <Badge variant="secondary">{r.abc_class?.toUpperCase()}</Badge> },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
    { key: 'variance', label: 'Variance', render: r => r.status === 'completed' ? (
      <span className={r.total_variance !== 0 ? 'text-amber-500 font-semibold' : 'text-emerald-500'}>{r.total_variance > 0 ? '+' : ''}{r.total_variance}</span>
    ) : '—' },
    { key: 'actions', label: '', type: 'actions', align: 'right', actions: [
      { label: 'Count', icon: ClipboardCheck, onClick: (r) => openCount(r), show: (r) => r.status !== 'completed' },
    ]},
  ];

  const countedItems = activeCount?.items?.filter(i => i.is_counted).length || 0;
  const totalItems = activeCount?.items?.length || 0;

  const kpis = [
    { label: 'Total Counts', value: counts.length, icon: ClipboardCheck },
    { label: 'Scheduled', value: counts.filter(c => c.status === 'scheduled').length, icon: CalendarClock },
    { label: 'In Progress', value: counts.filter(c => c.status === 'in_progress').length, icon: Activity },
    { label: 'Completed', value: counts.filter(c => c.status === 'completed').length, icon: CheckSquare },
  ];

  return (
    <EnterprisePageLayout
      title="Cycle Counting"
      description="Schedule and execute physical inventory counts"
      primaryAction={{ label: 'New Count', icon: Plus, onClick: () => setShowCreate(true) }}
      kpis={kpis}
      isLoading={countsQ.isLoading}
    >
      <AdvancedDataTable
        tableId="cycle-counts"
        columns={columns}
        data={counts}
        isLoading={countsQ.isLoading}
        error={countsQ.error}
        onRetry={countsQ.refetch}
        emptyMessage="No cycle counts scheduled"
      />

      {/* Create Dialog */}
      <FormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Schedule Cycle Count"
        submitLabel="Schedule Count"
        isPending={createMutation.isPending}
        submitDisabled={!form.location_id}
        onSubmit={() => createMutation.mutate(form)}
      >
        <FormSection title="Count Details" icon={ClipboardCheck}>
          <Field label="Location" required htmlFor="cc-location">
            <Select value={form.location_id} onValueChange={v => setForm(p => ({ ...p, location_id: v }))}>
              <SelectTrigger id="cc-location"><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Scheduled Date" required htmlFor="cc-date">
            <Input id="cc-date" type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} />
          </Field>
          <Field label="ABC Class Filter" htmlFor="cc-abc">
            <Select value={form.abc_class} onValueChange={v => setForm(p => ({ ...p, abc_class: v }))}>
              <SelectTrigger id="cc-abc"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="A">Class A Only</SelectItem>
                <SelectItem value="B">Class B Only</SelectItem>
                <SelectItem value="C">Class C Only</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Assigned To" htmlFor="cc-assigned">
            <Input id="cc-assigned" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} placeholder="Staff name" />
          </Field>
        </FormSection>
      </FormDialog>

      {/* Count Execution Dialog */}
      <Dialog open={!!activeCount} onOpenChange={() => setActiveCount(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Cycle Count: {activeCount?.count_number}
              <span className="text-sm font-normal text-muted-foreground ml-3">{countedItems}/{totalItems} counted</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {activeCount?.items?.map((item, idx) => (
              <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${item.is_counted ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-card'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">{item.sku} · Expected: {item.expected_quantity}</p>
                </div>
                <Input type="number" placeholder="Count" defaultValue={item.counted_quantity ?? ''} onChange={e => handleCountItem(item.product_id, e.target.value)} className="w-24 h-8 text-sm" />
                {item.is_counted && (
                  <Badge variant={item.variance === 0 ? 'default' : 'secondary'} className={`text-xs ${item.variance !== 0 ? 'text-amber-500' : ''}`}>
                    {item.variance > 0 ? '+' : ''}{item.variance}
                  </Badge>
                )}
              </div>
            ))}
          </div>
          <div className="pt-3 border-t flex gap-3">
            <Button variant="outline" onClick={() => setActiveCount(null)} className="flex-1">Cancel</Button>
            <Button onClick={completeCount} className="flex-1" disabled={updateItemMutation.isPending}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {updateItemMutation.isPending ? 'Saving...' : 'Complete Count'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </EnterprisePageLayout>
  );
}