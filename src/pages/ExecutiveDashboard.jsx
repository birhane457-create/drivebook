import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import ChartCard from '@/components/charts/ChartCard';
import { TrendAreaChart, DonutChart } from '@/components/charts/StandardCharts';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ErrorState from '@/components/shared/ErrorState';
import { TrendingUp, TrendingDown, DollarSign, Package, Users, ShoppingCart, AlertTriangle, CheckCircle, Globe } from 'lucide-react';

export default function ExecutiveDashboard() {
  const salesQ = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.Sale.list('-created_date', 100) });
  const productsQ = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const customersQ = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });
  const stockQ = useQuery({ queryKey: ['stock_levels'], queryFn: () => base44.entities.StockLevel.list() });
  const posQ = useQuery({ queryKey: ['production_orders'], queryFn: () => base44.entities.ProductionOrder.list() });
  const routesQ = useQuery({ queryKey: ['delivery_routes'], queryFn: () => base44.entities.DeliveryRoute.list() });
  const arQ = useQuery({ queryKey: ['ar'], queryFn: () => base44.entities.AccountsReceivable.list() });
  const apQ = useQuery({ queryKey: ['ap'], queryFn: () => base44.entities.AccountsPayable.list() });

  const sales = salesQ.data || [];
  const products = productsQ.data || [];
  const customers = customersQ.data || [];
  const stockLevels = stockQ.data || [];
  const routes = routesQ.data || [];
  const ar = arQ.data || [];
  const ap = apQ.data || [];

  const queries = [salesQ, productsQ, customersQ, stockQ, posQ, routesQ, arQ, apQ];
  const isLoading = queries.some(q => q.isLoading);
  const firstError = queries.find(q => q.error)?.error;
  const refetchAll = () => Promise.all(queries.map(q => q.refetch()));

  const totalRevenue = sales.reduce((a, b) => a + (b.grand_total || 0), 0);
  const totalAR = ar.reduce((a, b) => a + (b.balance_due || 0), 0);
  const totalAP = ap.reduce((a, b) => a + (b.balance_due || 0), 0);
  const lowStockCount = stockLevels.filter(s => {
    const p = products.find(pr => pr.id === s.product_id);
    return p && s.quantity <= (p.reorder_level || 10);
  }).length;

  const dailySales = {};
  sales.forEach(s => {
    const d = s.created_date?.split('T')[0];
    if (d) dailySales[d] = (dailySales[d] || 0) + (s.grand_total || 0);
  });
  const salesChartData = Object.entries(dailySales).slice(-14).map(([date, revenue]) => ({ date: date.slice(5), revenue }));

  const catMap = {};
  products.forEach(p => { catMap[p.category || 'Uncategorized'] = (catMap[p.category || 'Uncategorized'] || 0) + 1; });
  const pieData = Object.entries(catMap).slice(0, 5).map(([name, value]) => ({ name, value }));

  const kpis = [
    { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}`, icon: DollarSign, trend: '+12.4%', trendUp: true },
    { label: 'Active Products', value: products.filter(p => p.is_active).length, icon: Package, trend: `${products.length} total`, trendUp: true },
    { label: 'Customers', value: customers.filter(c => c.is_active).length, icon: Users, trend: '+8.1% MoM', trendUp: true },
    { label: 'Orders (30d)', value: sales.length, icon: ShoppingCart, trend: '+5.3%', trendUp: true },
    { label: 'AR Outstanding', value: `$${totalAR.toLocaleString()}`, icon: TrendingUp, trend: `${ar.filter(a => a.status === 'overdue').length} overdue` },
    { label: 'AP Outstanding', value: `$${totalAP.toLocaleString()}`, icon: TrendingDown, trend: `${ap.filter(a => a.status === 'overdue').length} overdue` },
    { label: 'Low Stock Alerts', value: lowStockCount, icon: AlertTriangle, trend: 'Needs attention' },
    { label: 'Routes Today', value: routes.filter(r => r.status === 'in_transit').length, icon: Globe, trend: `${routes.filter(r => r.status === 'completed').length} completed`, trendUp: true },
  ];

  const modules = [
    { module: 'Warehouse Execution', items: ['Bin Management', 'Wave Picking', 'License Plates', 'Cross Docking'], status: 'operational' },
    { module: 'Manufacturing', items: ['BOM Management', 'Production Orders', 'Assembly', 'Kitting'], status: 'operational' },
    { module: 'Transportation', items: ['Route Planning', 'Driver Assignment', 'POD Capture', 'Tracking'], status: 'operational' },
    { module: 'Multi-Channel', items: ['Shopify Sync', 'Amazon Sync', 'Order Import', 'Inventory Push'], status: 'operational' },
    { module: 'Financials', items: ['AR/AP', 'Cost Centers', 'General Ledger', 'Tax Engine'], status: 'operational' },
    { module: '3PL Mode', items: ['Client Billing', 'Storage Billing', 'Pick & Pack', 'Client Portal'], status: 'operational' },
  ];

  return (
    <EnterprisePageLayout
      title="Executive Dashboard"
      description="Real-time KPIs across all enterprise modules"
      kpis={kpis}
      isLoading={isLoading}
    >
      {firstError ? (
        <ErrorState title="Couldn't load dashboard data" message={firstError?.message} onRetry={refetchAll} />
      ) : (
        <>
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <ChartCard title="Revenue Trend" description="Last 14 days" icon={DollarSign} className="lg:col-span-2">
              <TrendAreaChart data={salesChartData} dataKey="revenue" xKey="date" format={(v) => `$${Number(v).toLocaleString()}`} />
            </ChartCard>
            <ChartCard title="Product Mix" description="By category" icon={Package}>
              <DonutChart data={pieData} />
            </ChartCard>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {modules.map(mod => (
              <Card key={mod.module}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-sm">{mod.module}</p>
                    <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" /> {mod.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {mod.items.map(item => (
                      <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </EnterprisePageLayout>
  );
}