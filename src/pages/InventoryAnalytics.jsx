import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import ChartCard from '@/components/charts/ChartCard';
import ErrorState from '@/components/shared/ErrorState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, RotateCcw, Star, AlertTriangle } from 'lucide-react';

const ABC_COLORS = { A: '#10b981', B: '#f59e0b', C: '#ef4444' };
const ABC_THRESHOLDS = { A: 0.8, B: 0.95 };

export default function InventoryAnalytics() {
  const productsQ = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const salesQ = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.Sale.list('-created_date', 1000) });
  const stockQ = useQuery({ queryKey: ['stock-levels'], queryFn: () => base44.entities.StockLevel.list() });

  const products = productsQ.data || [];
  const sales = salesQ.data || [];
  const stockLevels = stockQ.data || [];

  const queries = [productsQ, salesQ, stockQ];
  const isLoading = queries.some(q => q.isLoading);
  const firstError = queries.find(q => q.error)?.error;
  const refetchAll = () => Promise.all(queries.map(q => q.refetch()));

  const analytics = useMemo(() => {
    const completedSales = sales.filter(s => s.status === 'completed');
    const productRevenue = {};
    const productQtySold = {};

    completedSales.forEach(s => {
      (s.items || []).forEach(item => {
        productRevenue[item.product_id] = (productRevenue[item.product_id] || 0) + (item.total || 0);
        productQtySold[item.product_id] = (productQtySold[item.product_id] || 0) + (item.quantity || 0);
      });
    });

    const totalRevenue = Object.values(productRevenue).reduce((a, b) => a + b, 0);
    const sorted = [...products]
      .map(p => ({ ...p, revenue: productRevenue[p.id] || 0, qty_sold: productQtySold[p.id] || 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    let cumulative = 0;
    const classified = sorted.map(p => {
      cumulative += p.revenue;
      const cumulativePercent = totalRevenue > 0 ? cumulative / totalRevenue : 0;
      const abc = cumulativePercent <= ABC_THRESHOLDS.A ? 'A' : cumulativePercent <= ABC_THRESHOLDS.B ? 'B' : 'C';
      return { ...p, cumulative_percent: Math.round(cumulativePercent * 100), abc_class: abc };
    });

    const turnoverData = products.map(p => {
      const cogs = (productQtySold[p.id] || 0) * (p.unit_cost || 0);
      const totalStock = stockLevels.filter(s => s.product_id === p.id).reduce((sum, s) => sum + (s.quantity || 0), 0);
      const avgInventoryValue = totalStock * (p.unit_cost || 0);
      const turnover = avgInventoryValue > 0 ? (cogs / avgInventoryValue) * (365 / 30) : 0;
      const daysOnHand = turnover > 0 ? Math.round(365 / turnover) : 999;
      return { ...p, cogs, avg_inventory_value: avgInventoryValue, turnover: Math.round(turnover * 10) / 10, days_on_hand: daysOnHand };
    }).sort((a, b) => b.turnover - a.turnover);

    const counts = {
      A: classified.filter(p => p.abc_class === 'A').length,
      B: classified.filter(p => p.abc_class === 'B').length,
      C: classified.filter(p => p.abc_class === 'C').length,
    };
    const avgTurnover = turnoverData.length > 0 ? (turnoverData.reduce((s, p) => s + p.turnover, 0) / turnoverData.length).toFixed(1) : 0;

    return { classified, turnoverData, counts, avgTurnover };
  }, [products, sales, stockLevels]);

  const kpis = [
    { label: 'Class A Items', value: analytics.counts.A, icon: Star, trend: 'Top 80% revenue', trendUp: true },
    { label: 'Class B Items', value: analytics.counts.B, icon: TrendingUp, trend: 'Next 15% revenue', trendUp: true },
    { label: 'Class C Items', value: analytics.counts.C, icon: AlertTriangle, trend: 'Bottom 5%' },
    { label: 'Avg Turnover', value: `${analytics.avgTurnover}x`, icon: RotateCcw, trend: 'annualized', trendUp: true },
  ];

  return (
    <EnterprisePageLayout
      title="Inventory Analytics"
      description="ABC classification, turnover analysis, and inventory health"
      kpis={kpis}
      isLoading={isLoading}
    >
      {firstError ? (
        <ErrorState title="Couldn't load analytics" message={firstError?.message} onRetry={refetchAll} />
      ) : (
        <Tabs defaultValue="abc" className="space-y-6">
          <TabsList>
            <TabsTrigger value="abc">ABC Classification</TabsTrigger>
            <TabsTrigger value="turnover">Inventory Turnover</TabsTrigger>
            <TabsTrigger value="days">Days on Hand</TabsTrigger>
          </TabsList>

          <TabsContent value="abc">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-3">
                  ABC Analysis
                  <div className="flex gap-2 ml-auto">
                    {['A', 'B', 'C'].map(cls => (
                      <Badge key={cls} style={{ background: ABC_COLORS[cls] }} className="text-white">
                        Class {cls}: {analytics.counts[cls]}
                      </Badge>
                    ))}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {analytics.classified.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: ABC_COLORS[p.abc_class] }}>
                        {p.abc_class}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku} · {p.category}</p>
                      </div>
                      <div className="text-right w-32">
                        <p className="text-sm font-semibold">${p.revenue.toFixed(0)}</p>
                        <Progress value={p.cumulative_percent} className="h-1 mt-1" />
                        <p className="text-xs text-muted-foreground">{p.cumulative_percent}% cumulative</p>
                      </div>
                      <div className="text-right w-20 text-sm text-muted-foreground">{p.qty_sold} sold</div>
                    </div>
                  ))}
                  {analytics.classified.length === 0 && (
                    <p className="text-center py-10 text-muted-foreground">No sales data available for classification</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="turnover">
            <ChartCard title="Inventory Turnover Ratio (Annualized)" description="Top 15 products by turnover" icon={RotateCcw}>
              {analytics.turnoverData.filter(p => p.turnover > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.turnoverData.filter(p => p.turnover > 0).slice(0, 15)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" fontSize={11} width={130} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(v) => [`${v}x`, 'Turnover']} />
                    <Bar dataKey="turnover" radius={[0, 4, 4, 0]}>
                      {analytics.turnoverData.filter(p => p.turnover > 0).slice(0, 15).map((p, i) => (
                        <Cell key={i} fill={p.turnover >= 12 ? '#10b981' : p.turnover >= 6 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-center py-10 text-muted-foreground">Turnover data will appear after sales activity</p>}
            </ChartCard>
          </TabsContent>

          <TabsContent value="days">
            <Card>
              <CardHeader><CardTitle className="text-base">Days on Hand — Slow Moving & Overstock Risk</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {analytics.turnoverData.filter(p => p.days_on_hand < 999).sort((a, b) => b.days_on_hand - a.days_on_hand).slice(0, 20).map(p => (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={p.days_on_hand > 90 ? 'destructive' : p.days_on_hand > 45 ? 'secondary' : 'default'} className="text-xs">
                          {p.days_on_hand} days
                        </Badge>
                      </div>
                      <div className="text-right w-32">
                        <Progress value={Math.min(100, (p.days_on_hand / 120) * 100)} className="h-2" />
                      </div>
                    </div>
                  ))}
                  {analytics.turnoverData.filter(p => p.days_on_hand < 999).length === 0 && (
                    <p className="text-center py-10 text-muted-foreground">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </EnterprisePageLayout>
  );
}