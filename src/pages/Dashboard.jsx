import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  DollarSign, Package, ShoppingCart, TrendingUp, 
  AlertTriangle, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(243, 75%, 59%)', 'hsl(262, 83%, 58%)', 'hsl(173, 58%, 39%)', 'hsl(43, 74%, 66%)', 'hsl(12, 76%, 61%)'];

export default function Dashboard() {
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-created_date', 100),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: stockLevels = [] } = useQuery({
    queryKey: ['stock-levels'],
    queryFn: () => base44.entities.StockLevel.list(),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts-recent'],
    queryFn: () => base44.entities.Alert.filter({ is_read: false }, '-created_date', 5),
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchase-orders-recent'],
    queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 10),
  });

  // Calculate stats
  const today = format(new Date(), 'yyyy-MM-dd');
  const todaySales = sales.filter(s => s.created_date?.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.grand_total || 0), 0);
  const totalRevenue = sales.reduce((sum, s) => sum + (s.grand_total || 0), 0);
  const lowStockCount = stockLevels.filter(sl => {
    const product = products.find(p => p.id === sl.product_id);
    return product && sl.quantity <= (product.reorder_level || 10);
  }).length;

  // Sales by day for chart
  const salesByDay = {};
  sales.forEach(s => {
    const day = s.created_date?.substring(0, 10);
    if (day) {
      salesByDay[day] = (salesByDay[day] || 0) + (s.grand_total || 0);
    }
  });
  const chartData = Object.entries(salesByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, total]) => ({
      date: format(new Date(date), 'MMM d'),
      total: Math.round(total * 100) / 100,
    }));

  // Category distribution
  const categoryCount = {};
  products.forEach(p => {
    const cat = p.category || 'Uncategorized';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  const categoryData = Object.entries(categoryCount).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your warehouse and sales operations" />
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Today's Revenue" value={`$${todayRevenue.toFixed(2)}`} icon={DollarSign} trend={`${todaySales.length} transactions`} trendUp />
        <StatCard title="Total Products" value={products.length} icon={Package} />
        <StatCard title="Total Sales" value={sales.length} icon={ShoppingCart} trend={`$${totalRevenue.toFixed(2)} total`} trendUp />
        <StatCard title="Low Stock Items" value={lowStockCount} icon={AlertTriangle} trend={lowStockCount > 0 ? "Needs attention" : "All good"} trendUp={lowStockCount === 0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Sales Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="total" fill="hsl(243, 75%, 59%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No sales data yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Product Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {categoryData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No products yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Sales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
            {sales.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No sales yet</p>
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map(alert => (
              <div key={alert.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'
                }`} />
                <div>
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
                <StatusBadge status={alert.severity} className="ml-auto flex-shrink-0" />
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No active alerts</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}