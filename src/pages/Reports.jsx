import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { DollarSign, Package, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

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
          <Card>
            <CardHeader><CardTitle className="text-base">Daily Sales (Last 30 Days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="total" stroke="hsl(243, 75%, 59%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Top Selling Products</CardTitle></CardHeader>
              <CardContent>
                {topProducts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <YAxis type="category" dataKey="name" fontSize={11} width={120} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Bar dataKey="revenue" fill="hsl(243, 75%, 59%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center py-10 text-muted-foreground">No sales data</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" /> Slow Moving Products</CardTitle></CardHeader>
              <CardContent>
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
                ) : <p className="text-center py-10 text-muted-foreground">No data</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader><CardTitle className="text-base">Low Stock Alerts</CardTitle></CardHeader>
            <CardContent>
              {lowStockItems.length > 0 ? (
                <div className="space-y-3">
                  {lowStockItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm font-medium">{item.name}</span>
                      <div className="text-right">
                        <span className="text-sm text-red-500 font-medium">{item.quantity} in stock</span>
                        <p className="text-xs text-muted-foreground">Reorder at {item.reorder}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-10 text-muted-foreground">All stock levels are healthy</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}