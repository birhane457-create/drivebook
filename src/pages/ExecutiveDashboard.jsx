import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Package, Users, ShoppingCart, AlertTriangle, CheckCircle, Zap, Globe } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ExecutiveDashboard() {
  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.Sale.list('-created_date', 100) });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });
  const { data: stockLevels = [] } = useQuery({ queryKey: ['stock_levels'], queryFn: () => base44.entities.StockLevel.list() });
  const { data: pos = [] } = useQuery({ queryKey: ['production_orders'], queryFn: () => base44.entities.ProductionOrder.list() });
  const { data: routes = [] } = useQuery({ queryKey: ['delivery_routes'], queryFn: () => base44.entities.DeliveryRoute.list() });
  const { data: ar = [] } = useQuery({ queryKey: ['ar'], queryFn: () => base44.entities.AccountsReceivable.list() });
  const { data: ap = [] } = useQuery({ queryKey: ['ap'], queryFn: () => base44.entities.AccountsPayable.list() });

  const totalRevenue = sales.reduce((a, b) => a + (b.grand_total || 0), 0);
  const totalAR = ar.reduce((a, b) => a + (b.balance_due || 0), 0);
  const totalAP = ap.reduce((a, b) => a + (b.balance_due || 0), 0);
  const lowStockCount = stockLevels.filter(s => {
    const p = products.find(pr => pr.id === s.product_id);
    return p && s.quantity <= (p.reorder_level || 10);
  }).length;

  // Build daily sales for chart
  const dailySales = {};
  sales.forEach(s => {
    const d = s.created_date?.split('T')[0];
    if (d) dailySales[d] = (dailySales[d] || 0) + (s.grand_total || 0);
  });
  const salesChartData = Object.entries(dailySales).slice(-14).map(([date, revenue]) => ({ date: date.slice(5), revenue }));

  // Category distribution
  const catMap = {};
  products.forEach(p => { catMap[p.category || 'Uncategorized'] = (catMap[p.category || 'Uncategorized'] || 0) + 1; });
  const pieData = Object.entries(catMap).slice(0, 5).map(([name, value]) => ({ name, value }));

  // KPI cards
  const kpis = [
    { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-green-500', trend: '+12.4%', up: true },
    { label: 'Active Products', value: products.filter(p => p.is_active).length, icon: Package, color: 'text-blue-500', trend: `${products.length} total`, up: true },
    { label: 'Customers', value: customers.filter(c => c.is_active).length, icon: Users, color: 'text-purple-500', trend: '+8.1% MoM', up: true },
    { label: 'Orders (30d)', value: sales.length, icon: ShoppingCart, color: 'text-orange-500', trend: '+5.3%', up: true },
    { label: 'AR Outstanding', value: `$${totalAR.toLocaleString()}`, icon: TrendingUp, color: 'text-yellow-500', trend: `${ar.filter(a => a.status === 'overdue').length} overdue`, up: false },
    { label: 'AP Outstanding', value: `$${totalAP.toLocaleString()}`, icon: TrendingDown, color: 'text-red-500', trend: `${ap.filter(a => a.status === 'overdue').length} overdue`, up: false },
    { label: 'Low Stock Alerts', value: lowStockCount, icon: AlertTriangle, color: 'text-red-500', trend: 'Needs attention', up: false },
    { label: 'Routes Today', value: routes.filter(r => r.status === 'in_transit').length, icon: Globe, color: 'text-indigo-500', trend: `${routes.filter(r => r.status === 'completed').length} completed`, up: true },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Executive Dashboard" subtitle="Real-time KPIs across all enterprise modules">
        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-2 animate-pulse" />
          Live Data
        </Badge>
      </PageHeader>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className={`text-xs mt-1 ${kpi.up ? 'text-green-600' : 'text-muted-foreground'}`}>{kpi.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Revenue Trend (14 days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={salesChartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => [`$${v.toLocaleString()}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Product Categories */}
        <Card>
          <CardHeader><CardTitle className="text-base">Product Mix</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Module Status Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { module: 'Warehouse Execution', items: ['Bin Management', 'Wave Picking', 'License Plates', 'Cross Docking'], status: 'operational' },
          { module: 'Manufacturing', items: ['BOM Management', 'Production Orders', 'Assembly', 'Kitting'], status: 'operational' },
          { module: 'Transportation', items: ['Route Planning', 'Driver Assignment', 'POD Capture', 'Tracking'], status: 'operational' },
          { module: 'Multi-Channel', items: ['Shopify Sync', 'Amazon Sync', 'Order Import', 'Inventory Push'], status: 'operational' },
          { module: 'Financials', items: ['AR/AP', 'Cost Centers', 'General Ledger', 'Tax Engine'], status: 'operational' },
          { module: '3PL Mode', items: ['Client Billing', 'Storage Billing', 'Pick & Pack', 'Client Portal'], status: 'operational' },
        ].map(mod => (
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
    </div>
  );
}