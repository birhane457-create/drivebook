import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import SectionCard from '@/components/shared/SectionCard';
import EmptyState from '@/components/shared/EmptyState';
import ChartCard from '@/components/charts/ChartCard';
import { TrendAreaChart, BarSeriesChart } from '@/components/charts/StandardCharts';
import { DollarSign, Package, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function Reports() {
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-created_date', 500),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: stockLevels = [] } = useQuery({
    queryKey: ['stock-levels'],
    queryFn: () => base44.entities.StockLevel.list(),
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  // Revenue calc
  const totalRevenue = sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.grand_total || 0), 0);
  const totalCost = sales.filter(s => s.status === 'completed').reduce((sum, s) => {
    return sum + (s.items || []).reduce((iSum, item) => {
      const product = products.find(p => p.id === item.product_id);
      return iSum + ((product?.unit_cost || 0) * item.quantity);
    }, 0);
  }, 0);
  const grossProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

  // Inventory valuation
  const inventoryValue = stockLevels.reduce((sum, sl) => {
    const product = products.find(p => p.id === sl.product_id);
    return sum + (sl.quantity * (product?.unit_cost || 0));
  }, 0);

  // Daily sales last 30 days
  const dailySales = {};
  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
    dailySales[d] = 0;
  }
  sales.forEach(s => {
    const d = s.created_date?.substring(0, 10);
    if (d && dailySales[d] !== undefined) {
      dailySales[d] += s.grand_total || 0;
    }
  });
  const dailyChartData = Object.entries(dailySales).map(([date, total]) => ({
    date: format(new Date(date), 'MMM d'),
    total: Math.round(total * 100) / 100,
  }));

  // Top products
  const productSales = {};
  sales.filter(s => s.status === 'completed').forEach(s => {
    (s.items || []).forEach(item => {
      if (!productSales[item.product_id]) {
        productSales[item.product_id] = { name: item.product_name, quantity: 0, revenue: 0 };
      }
      productSales[item.product_id].quantity += item.quantity;
      productSales[item.product_id].revenue += item.total;
    });
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const slowProducts = Object.values(productSales).sort((a, b) => a.revenue - b.revenue).slice(0, 10);

  // Low stock
  const lowStockItems = stockLevels.filter(sl => {
    const product = products.find(p => p.id === sl.product_id);
    return product && sl.quantity <= (product.reorder_level || 10);
  }).map(sl => {
    const product = products.find(p => p.id === sl.product_id);
    return { name: product?.name, quantity: sl.quantity, reorder: product?.reorder_level || 10 };
  });

  return (
    <div>
      <PageHeader title="Reports" subtitle="Business analytics and insights" />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} />
        <StatCard title="Gross Profit" value={`$${grossProfit.toFixed(2)}`} icon={TrendingUp} trend={`${margin}% margin`} trendUp={grossProfit > 0} />
        <StatCard title="Inventory Value" value={`$${inventoryValue.toFixed(2)}`} icon={Package} />
        <StatCard title="Purchase Orders" value={purchaseOrders.length} icon={BarChart3} />
      </div>

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <ChartCard title="Daily Sales" description="Last 30 days" icon={TrendingUp}>
            <TrendAreaChart data={dailyChartData} dataKey="total" xKey="date" height={350} format={(v) => `$${Number(v).toLocaleString()}`} />
          </ChartCard>
        </TabsContent>

        <TabsContent value="products">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Top Selling Products" description="By revenue" icon={TrendingUp}>
              {topProducts.length > 0 ? (
                <BarSeriesChart data={topProducts} keys={['revenue']} xKey="name" height={300} format={(v) => `$${Number(v).toLocaleString()}`} />
              ) : (
                <EmptyState illustration="empty-box" title="No sales data" description="Top products will appear once you have sales." className="py-10" />
              )}
            </ChartCard>
            <SectionCard title="Slow Moving Products" icon={TrendingDown}>
              {slowProducts.length > 0 ? (
                <div className="space-y-3">
                  {slowProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm">{p.name}</span>
                      <div className="text-right">
                        <p className="text-sm font-medium">{p.quantity} units</p>
                        <p className="text-xs text-muted-foreground">${p.revenue?.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState illustration="no-results" title="No data" description="Every product is selling well." className="py-10" />
              )}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="inventory">
          <SectionCard title="Low Stock Alerts" icon={Package}>
            {lowStockItems.length > 0 ? (
              <div className="space-y-3">
                {lowStockItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-medium">{item.name}</span>
                    <div className="text-right">
                      <span className="text-sm text-destructive font-medium">{item.quantity} in stock</span>
                      <p className="text-xs text-muted-foreground">Reorder at {item.reorder}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState illustration="inbox" title="All stock levels are healthy" description="No products are below their reorder point." className="py-10" />
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}