import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Store, Factory, Truck, Server, Package, Users, DollarSign,
  ShoppingCart, TrendingUp, BarChart3, CheckCircle2, Play, 
  Building2, ArrowRight, RefreshCw, Database, Globe2
} from 'lucide-react';

const TENANTS = [
  {
    id: 'retail',
    name: 'RetailCo Inc.',
    type: 'Retail Demo',
    icon: Store,
    color: 'bg-blue-500',
    industry: 'Omni-channel Retail',
    description: '4 store locations, e-commerce, loyalty program, 1,200+ SKUs',
    metrics: { orders: 8420, revenue: '$2.4M MRR', inventory: '12,400 units', customers: 3800, suppliers: 24, employees: 142 },
    modules: ['POS', 'WMS', 'CRM', 'Loyalty', 'Multi-Channel', 'Financials'],
    color_class: 'border-blue-200 bg-blue-50',
    badge_class: 'bg-blue-100 text-blue-700',
    data: [
      { label: 'Daily Orders', value: 280, trend: '+12%' },
      { label: 'Avg Order Value', value: '$86', trend: '+5%' },
      { label: 'Inventory Turns', value: 8.2, trend: '+0.4' },
      { label: 'Customer NPS', value: 72, trend: '+3' },
    ]
  },
  {
    id: 'wholesale',
    name: 'TradeFlow Wholesale',
    type: 'Wholesale Demo',
    icon: Building2,
    color: 'bg-purple-500',
    industry: 'B2B Distribution',
    description: '3 distribution centers, 400+ trade accounts, complex pricing tiers',
    metrics: { orders: 1840, revenue: '$8.7M MRR', inventory: '64,200 units', customers: 420, suppliers: 87, employees: 68 },
    modules: ['WMS', 'Procurement', 'TMS', 'Supplier Portal', 'Pricing Engine', 'Financials'],
    color_class: 'border-purple-200 bg-purple-50',
    badge_class: 'bg-purple-100 text-purple-700',
    data: [
      { label: 'Daily Orders', value: 61, trend: '+8%' },
      { label: 'Avg Order Value', value: '$4,720', trend: '+11%' },
      { label: 'On-Time Delivery', value: '97.3%', trend: '+1.2%' },
      { label: 'Fill Rate', value: '99.1%', trend: '+0.3%' },
    ]
  },
  {
    id: 'manufacturing',
    name: 'Apex Manufacturing',
    type: 'Manufacturing Demo',
    icon: Factory,
    color: 'bg-orange-500',
    industry: 'Discrete Manufacturing',
    description: '2 plants, 180 BOMs, MRP-driven procurement, quality control',
    metrics: { orders: 340, revenue: '$5.2M MRR', inventory: '28,600 units', customers: 95, suppliers: 62, employees: 310 },
    modules: ['Manufacturing', 'WMS', 'QMS', 'Procurement', 'Asset Management', 'MRP'],
    color_class: 'border-orange-200 bg-orange-50',
    badge_class: 'bg-orange-100 text-orange-700',
    data: [
      { label: 'OEE', value: '84%', trend: '+2%' },
      { label: 'Scrap Rate', value: '1.2%', trend: '-0.3%' },
      { label: 'On-Time Production', value: '91%', trend: '+4%' },
      { label: 'BOM Accuracy', value: '99.6%', trend: '+0.1%' },
    ]
  },
  {
    id: '3pl',
    name: 'SwiftLogix 3PL',
    type: '3PL Demo',
    icon: Truck,
    color: 'bg-green-500',
    industry: 'Third-Party Logistics',
    description: '6 client accounts, WMS-as-a-service, multi-client billing',
    metrics: { orders: 5200, revenue: '$1.8M MRR', inventory: '94,000 units', customers: 6, suppliers: 0, employees: 85 },
    modules: ['3PL Management', 'WMS', 'TMS', 'Billing', 'Client Portal', 'Reporting'],
    color_class: 'border-green-200 bg-green-50',
    badge_class: 'bg-green-100 text-green-700',
    data: [
      { label: 'Ship Accuracy', value: '99.8%', trend: '+0.1%' },
      { label: 'Dock-to-Stock', value: '2.1 hrs', trend: '-0.4' },
      { label: 'Space Utilization', value: '87%', trend: '+3%' },
      { label: 'Client Retention', value: '100%', trend: '0%' },
    ]
  }
];

const DEMO_DATA_SUMMARY = [
  { label: 'Total SKUs', value: '3,200+', icon: Package },
  { label: 'Demo Tenants', value: '4', icon: Building2 },
  { label: 'Simulated Orders', value: '15,800', icon: ShoppingCart },
  { label: 'Data Points', value: '120K+', icon: Database },
  { label: 'Modules Active', value: '28', icon: Globe2 },
  { label: 'Combined MRR', value: '$18.1M', icon: DollarSign },
];

export default function DemoEnvironment() {
  const [activeTenant, setActiveTenant] = useState('retail');
  const tenant = TENANTS.find(t => t.id === activeTenant);
  const Icon = tenant.icon;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Demo Environment</h1>
          <p className="text-muted-foreground mt-1">Pre-loaded demo tenants with realistic data for sales & evaluation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Reset Data</Button>
          <Button size="sm"><Play className="w-4 h-4 mr-2" />Launch Demo Mode</Button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {DEMO_DATA_SUMMARY.map(item => {
          const I = item.icon;
          return (
            <Card key={item.label} className="text-center p-3">
              <I className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Tenant Selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {TENANTS.map(t => {
          const TIcon = t.icon;
          const isActive = activeTenant === t.id;
          return (
            <Card
              key={t.id}
              onClick={() => setActiveTenant(t.id)}
              className={`cursor-pointer transition-all border-2 ${isActive ? 'border-primary shadow-md' : 'border-transparent hover:border-muted'}`}
            >
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-xl ${t.color} flex items-center justify-center mb-3`}>
                  <TIcon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.industry}</p>
                {isActive && <Badge className="mt-2 text-xs bg-primary/10 text-primary border-0">Active</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tenant Detail */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile */}
        <Card className={`lg:col-span-1 border-2 ${tenant.color_class}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${tenant.color} flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">{tenant.name}</CardTitle>
                <CardDescription>{tenant.type}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{tenant.description}</p>

            <div className="grid grid-cols-2 gap-2">
              {Object.entries(tenant.metrics).map(([k, v]) => (
                <div key={k} className="bg-white/60 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground capitalize">{k}</p>
                  <p className="font-semibold text-sm">{v}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Active Modules</p>
              <div className="flex flex-wrap gap-1">
                {tenant.modules.map(m => (
                  <Badge key={m} variant="outline" className={`text-xs ${tenant.badge_class} border-0`}>{m}</Badge>
                ))}
              </div>
            </div>

            <Button className="w-full" size="sm">
              <Play className="w-4 h-4 mr-2" />
              Open Tenant
            </Button>
          </CardContent>
        </Card>

        {/* KPIs & Data Preview */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Key Performance Indicators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {tenant.data.map(d => (
                  <div key={d.label} className="bg-muted/40 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">{d.label}</p>
                    <p className="text-2xl font-bold">{d.value}</p>
                    <p className={`text-xs font-medium mt-1 ${d.trend.startsWith('+') ? 'text-green-600' : d.trend.startsWith('-') && d.label !== 'Scrap Rate' && d.label !== 'Dock-to-Stock' ? 'text-red-500' : 'text-green-600'}`}>
                      {d.trend} vs last month
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Demo Data Coverage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Orders & Transactions', pct: 95 },
                { label: 'Inventory & Stock Levels', pct: 100 },
                { label: 'Supplier & Purchase Data', pct: 88 },
                { label: 'Financial Records (GL/AR/AP)', pct: 80 },
                { label: 'Customer & CRM Data', pct: 92 },
                { label: 'KPI & Analytics History', pct: 75 },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground">{item.pct}%</span>
                    </div>
                    <Progress value={item.pct} className="h-1.5" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}