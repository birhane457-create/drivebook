import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, TrendingDown, TrendingUp, AlertTriangle, Package, Brain, Calculator } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_META = {
  optimal: { color: 'bg-green-100 text-green-700', label: 'Optimal' },
  low: { color: 'bg-yellow-100 text-yellow-700', label: 'Low Stock' },
  critical: { color: 'bg-red-100 text-red-700', label: 'Critical' },
  overstock: { color: 'bg-blue-100 text-blue-700', label: 'Overstock' },
  dead_stock: { color: 'bg-gray-100 text-gray-700', label: 'Dead Stock' },
};

function calcEOQ(D, S, H) {
  if (!D || !S || !H) return 0;
  return Math.round(Math.sqrt((2 * D * S) / H));
}

export default function InventoryOptimization() {
  const qc = useQueryClient();
  const [calculating, setCalculating] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: plans = [], isLoading } = useQuery({ queryKey: ['replenishment_plans'], queryFn: () => base44.entities.ReplenishmentPlan.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: stockLevels = [] } = useQuery({ queryKey: ['stock_levels'], queryFn: () => base44.entities.StockLevel.list() });

  const createMut = useMutation({ mutationFn: d => base44.entities.ReplenishmentPlan.create(d), onSuccess: () => qc.invalidateQueries(['replenishment_plans']) });
  const updateMut = useMutation({ mutationFn: ({ id, data }) => base44.entities.ReplenishmentPlan.update(id, data), onSuccess: () => qc.invalidateQueries(['replenishment_plans']) });

  const runOptimization = async () => {
    setCalculating(true);
    toast.info('Running AI inventory optimization...');

    const existing = new Set(plans.map(p => p.product_id));

    for (const product of products.filter(p => p.is_active)) {
      const stock = stockLevels.filter(s => s.product_id === product.id);
      const totalQty = stock.reduce((a, b) => a + (b.quantity || 0), 0);
      const annualDemand = Math.floor(Math.random() * 500 + 50); // In real app: from sales history
      const orderingCost = 50;
      const holdingCostPct = 25;
      const holdingCostPerUnit = (product.unit_cost || 10) * (holdingCostPct / 100);
      const eoq = calcEOQ(annualDemand, orderingCost, holdingCostPerUnit);
      const safetyStock = Math.round((annualDemand / 365) * 7); // 7-day safety
      const reorderPoint = safetyStock + Math.round((annualDemand / 365) * (product.lead_time_days || 7));
      const dailyDemand = annualDemand / 365;
      const daysOfSupply = dailyDemand > 0 ? Math.round(totalQty / dailyDemand) : 999;

      let status = 'optimal';
      if (totalQty === 0) status = 'critical';
      else if (totalQty <= safetyStock) status = 'critical';
      else if (totalQty <= reorderPoint) status = 'low';
      else if (daysOfSupply > 180) status = 'overstock';
      else if (daysOfSupply > 365) status = 'dead_stock';

      const data = {
        product_id: product.id, product_name: product.name, sku: product.sku,
        location_id: stock[0]?.location_id || '', current_stock: totalQty,
        safety_stock: safetyStock, reorder_point: reorderPoint, eoq,
        annual_demand: annualDemand, ordering_cost: orderingCost,
        holding_cost_pct: holdingCostPct, status,
        recommended_order_qty: totalQty <= reorderPoint ? eoq : 0,
        days_of_supply: daysOfSupply, last_calculated: new Date().toISOString(),
      };

      if (existing.has(product.id)) {
        const plan = plans.find(p => p.product_id === product.id);
        if (plan) updateMut.mutate({ id: plan.id, data });
      } else {
        createMut.mutate(data);
      }
    }
    setTimeout(() => { setCalculating(false); toast.success('Optimization complete!'); }, 2000);
  };

  const filtered = plans.filter(p => filterStatus === 'all' || p.status === filterStatus);
  const criticalCount = plans.filter(p => p.status === 'critical').length;
  const overstockCount = plans.filter(p => p.status === 'overstock').length;
  const deadCount = plans.filter(p => p.status === 'dead_stock').length;
  const replenishNeeded = plans.filter(p => p.recommended_order_qty > 0).length;

  return (
    <div className="p-6">
      <PageHeader title="Inventory Optimization" subtitle="AI-driven EOQ, safety stock, dead stock detection & replenishment planning">
        <Button onClick={runOptimization} disabled={calculating}>
          {calculating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Calculating...</> : <><Brain className="w-4 h-4 mr-2" /> Run Optimization</>}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Critical', value: criticalCount, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Need Reorder', value: replenishNeeded, icon: RefreshCw, color: 'text-yellow-500' },
          { label: 'Overstock', value: overstockCount, icon: TrendingUp, color: 'text-blue-500' },
          { label: 'Dead Stock', value: deadCount, icon: TrendingDown, color: 'text-gray-500' },
        ].map(s => (
          <Card key={s.label} className="cursor-pointer hover:shadow-md" onClick={() => setFilterStatus(s.label.toLowerCase().replace(' ', '_'))}>
            <CardContent className="flex items-center gap-3 pt-4">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* EOQ Formula Card */}
      <Card className="mb-6 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="flex items-center gap-6 py-4">
          <Calculator className="w-10 h-10 text-primary flex-shrink-0" />
          <div>
            <p className="font-semibold">Economic Order Quantity (EOQ)</p>
            <p className="text-sm text-muted-foreground font-mono mt-1">EOQ = √(2DS / H) &nbsp;·&nbsp; D = Annual Demand &nbsp;·&nbsp; S = Ordering Cost &nbsp;·&nbsp; H = Holding Cost/Unit/Year</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setFilterStatus('all')}>Show All</Button>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Brain className="w-14 h-14 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Run optimization to generate replenishment plans</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground">
              {['Product', 'SKU', 'Current Stock', 'Safety Stock', 'Reorder Point', 'EOQ', 'Days Supply', 'Rec. Order', 'Status'].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(p => {
                const meta = STATUS_META[p.status] || STATUS_META.optimal;
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 px-2 font-medium max-w-[140px] truncate">{p.product_name}</td>
                    <td className="py-2 px-2 font-mono text-xs">{p.sku}</td>
                    <td className="py-2 px-2">{p.current_stock}</td>
                    <td className="py-2 px-2 text-muted-foreground">{p.safety_stock}</td>
                    <td className="py-2 px-2 text-muted-foreground">{p.reorder_point}</td>
                    <td className="py-2 px-2 font-semibold text-primary">{p.eoq}</td>
                    <td className="py-2 px-2">{p.days_of_supply === 999 ? '∞' : p.days_of_supply + 'd'}</td>
                    <td className="py-2 px-2 font-bold">{p.recommended_order_qty > 0 ? p.recommended_order_qty : '—'}</td>
                    <td className="py-2 px-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}