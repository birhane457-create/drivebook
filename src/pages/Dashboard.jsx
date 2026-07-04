import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DollarSign, Package, ShoppingCart, AlertTriangle } from 'lucide-react';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import SectionCard from '@/components/shared/SectionCard';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import StatusBadge from '@/components/shared/StatusBadge';
import ChartCard from '@/components/charts/ChartCard';
import { BarSeriesChart, DonutChart } from '@/components/charts/StandardCharts';
import { format } from 'date-fns';

export default function Dashboard() {
  const salesQ = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.Sale.list('-created_date', 100) });
  const productsQ = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const stockQ = useQuery({ queryKey: ['stock-levels'], queryFn: () => base44.entities.StockLevel.list() });
  const alertsQ = useQuery({ queryKey: ['alerts-recent'], queryFn: () => base44.entities.Alert.filter({ is_read: false }, '-created_date', 5) });
  const poQ = useQuery({ queryKey: ['purchase-orders-recent'], queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 10) });

  const sales = salesQ.data || [];
  const products = productsQ.data || [];
  const stockLevels = stockQ.data || [];
  const alerts = alertsQ.data || [];
  const purchaseOrders = poQ.data || [];

  const queries = [salesQ, productsQ, stockQ, alertsQ, poQ];
  const isLoading = queries.some(q => q.isLoading);
  const firstError = queries.find(q => q.error)?.error;
  const refetchAll = () => Promise.all(queries.map(q => q.refetch()));

  const today = format(new Date(), 'yyyy-MM-dd');
  const todaySales = sales.filter(s => s.created_date?.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.grand_total || 0), 0);
  const totalRevenue = sales.reduce((sum, s) => sum + (s.grand_total || 0), 0);
  const lowStockCount = stockLevels.filter(sl => {
    const product = products.find(p => p.id === sl.product_id);
    return product && sl.quantity <= (product.reorder_level || 10);
  }).length;

  const salesByDay = {};
  sales.forEach(s => { const day = s.created_date?.substring(0, 10); if (day) salesByDay[day] = (salesByDay[day] || 0) + (s.grand_total || 0); });
  const chartData = Object.entries(salesByDay).sort(([a], [b]) => a.localeCompare(b)).slice(-7).map(([date, total]) => ({ date: format(new Date(date), 'MMM d'), total: Math.round(total * 100) / 100 }));

  const categoryCount = {};
  products.forEach(p => { const cat = p.category || 'Uncategorized'; categoryCount[cat] = (categoryCount[cat] || 0) + 1; });
  const categoryData = Object.entries(categoryCount).map(([name, value]) => ({ name, value }));

  const kpis = [
    { label: "Today's Revenue", value: `$${todayRevenue.toFixed(2)}`, icon: DollarSign, trend: `${todaySales.length} transactions`, trendUp: true },
    { label: 'Total Products', value: products.length, icon: Package },
    { label: 'Total Sales', value: sales.length, icon: ShoppingCart, trend: `$${totalRevenue.toFixed(0)} total`, trendUp: true },
    { label: 'Low Stock Items', value: lowStockCount, icon: AlertTriangle, trend: lowStockCount > 0 ? 'Needs attention' : 'All good', trendUp: lowStockCount === 0 },
  ];

  return (
    <EnterprisePageLayout
      title="Dashboard"
      description="Overview of your warehouse and sales operations"
      kpis={kpis}
      isLoading={isLoading}
    >
      {firstError ? (
        <ErrorState title="Couldn't load dashboard" message={firstError?.message} onRetry={refetchAll} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <ChartCard title="Sales Trend" description="Last 7 days" icon={DollarSign} className="lg:col-span-2">
              {chartData.length > 0 ? (
                <BarSeriesChart data={chartData} keys={['total']} xKey="date" height={280} format={(v) => `$${Number(v).toLocaleString()}`} />
              ) : (
                <EmptyState illustration="empty-box" title="No sales data yet" description="Sales will appear here once you make your first transaction." className="py-10" />
              )}
            </ChartCard>
            <ChartCard title="Product Categories" description="Distribution" icon={Package}>
              {categoryData.length > 0 ? (
                <DonutChart data={categoryData} height={280} />
              ) : (
                <EmptyState illustration="empty-box" title="No products yet" description="Add products to see category mix." className="py-10" />
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Recent Sales" icon={ShoppingCart}>
              {sales.length > 0 ? (
                <div className="space-y-3">
                  {sales.slice(0, 5).map(sale => (
                    <div key={sale.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{sale.sale_number}</p>
                        <p className="text-xs text-muted-foreground">{sale.customer_name || 'Walk-in'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">${sale.grand_total?.toFixed(2)}</p>
                        <StatusBadge status={sale.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState illustration="inbox" title="No sales yet" description="Recent transactions will appear here." className="py-10" />
              )}
            </SectionCard>

            <SectionCard title="Active Alerts" icon={AlertTriangle}>
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.map(alert => (
                    <div key={alert.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
                      <div>
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="text-xs text-muted-foreground">{alert.message}</p>
                      </div>
                      <StatusBadge status={alert.severity} className="ml-auto flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState illustration="inbox" title="No active alerts" description="All stock levels are healthy." className="py-10" />
              )}
            </SectionCard>
          </div>
        </>
      )}
    </EnterprisePageLayout>
  );
}