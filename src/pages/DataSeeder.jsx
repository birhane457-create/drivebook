import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Database, Play, CheckCircle2, Loader2, ShoppingCart, Factory,
  Globe2, Building2, Package, Users, Truck, DollarSign, AlertTriangle
} from 'lucide-react';

// ─── Seed datasets ────────────────────────────────────────────────────────────

function buildProducts(count, prefix, categories) {
  const units = ['piece', 'kg', 'liter', 'box', 'pack'];
  return Array.from({ length: count }, (_, i) => ({
    name: `${prefix} Product ${String(i + 1).padStart(4, '0')}`,
    sku: `${prefix.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(5, '0')}`,
    category: categories[i % categories.length],
    brand: ['BrandAlpha', 'BrandBeta', 'BrandGamma', 'BrandDelta'][i % 4],
    unit_cost: parseFloat((Math.random() * 90 + 10).toFixed(2)),
    selling_price: parseFloat((Math.random() * 200 + 20).toFixed(2)),
    reorder_level: Math.floor(Math.random() * 20) + 5,
    unit: units[i % units.length],
    is_active: true,
  }));
}

function buildCustomers(count) {
  const names = ['Acme Corp', 'TechSupply', 'MegaStore', 'FastMart', 'ProLine', 'AlphaGoods', 'BetaBuy', 'Sunrise Retail', 'Harbour Dist.', 'Metro Wholesale'];
  return Array.from({ length: count }, (_, i) => ({
    name: `${names[i % names.length]} ${Math.floor(i / names.length) + 1}`,
    email: `customer${i + 1}@example.com`,
    phone: `+1 555 ${String(Math.floor(Math.random() * 9000) + 1000)}`,
    loyalty_points: Math.floor(Math.random() * 5000),
    total_purchases: parseFloat((Math.random() * 50000).toFixed(2)),
    credit_balance: parseFloat((Math.random() * 2000).toFixed(2)),
    is_active: true,
  }));
}

function buildSuppliers(count) {
  const names = ['Global Supplies Ltd', 'FastSource Inc', 'MegaVend Co', 'PrimeParts', 'QualityFirst', 'DirectShip', 'AllGoods Corp', 'TrustSupply'];
  return Array.from({ length: count }, (_, i) => ({
    name: `${names[i % names.length]} ${Math.floor(i / names.length) + 1}`,
    contact_person: `Contact ${i + 1}`,
    email: `supplier${i + 1}@vendor.com`,
    phone: `+1 800 ${String(Math.floor(Math.random() * 9000) + 1000)}`,
    balance: parseFloat((Math.random() * 20000).toFixed(2)),
    is_active: true,
  }));
}

function buildLocations() {
  return [
    { name: 'Central Warehouse', type: 'warehouse', address: '100 Industrial Ave, Chicago IL', manager_name: 'Dave Kowalski', is_active: true },
    { name: 'East Warehouse', type: 'warehouse', address: '200 Freight Blvd, Newark NJ', manager_name: 'Lisa Park', is_active: true },
    { name: 'Downtown Store', type: 'store', address: '555 Main St, New York NY', manager_name: 'James Rivera', is_active: true },
    { name: 'Westside Store', type: 'store', address: '888 Market St, San Francisco CA', manager_name: 'Amy Chen', is_active: true },
    { name: 'Uptown Store', type: 'store', address: '321 Oak Ave, Chicago IL', manager_name: 'Robert Mills', is_active: true },
  ];
}

function buildSales(count, customerIds) {
  const statuses = ['delivered', 'shipped', 'processing', 'confirmed'];
  return Array.from({ length: count }, (_, i) => {
    const qty = Math.floor(Math.random() * 5) + 1;
    const price = parseFloat((Math.random() * 150 + 10).toFixed(2));
    const daysAgo = Math.floor(Math.random() * 365);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
      customer_id: customerIds?.[i % (customerIds?.length || 1)] || '',
      customer_name: `Customer ${(i % 100) + 1}`,
      order_number: `SO-${String(i + 1000).padStart(6, '0')}`,
      status: statuses[i % statuses.length],
      total_amount: parseFloat((qty * price).toFixed(2)),
      items: [{ product_name: `Product ${i % 500}`, quantity: qty, unit_price: price, total: qty * price }],
      return_status: 'none',
    };
  });
}

// ─── Tenant configs ───────────────────────────────────────────────────────────
const TENANTS = [
  {
    id: 'retail',
    name: 'Retail Tenant',
    icon: ShoppingCart,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    description: '500 SKUs, 3 stores, 2 warehouses, 100 customers, 6 months of sales',
    steps: [
      { label: 'Locations (5)', entity: 'Location', getData: buildLocations },
      { label: 'Products (500)', entity: 'Product', getData: () => buildProducts(500, 'Retail', ['Apparel', 'Footwear', 'Accessories', 'Electronics', 'Home']) },
      { label: 'Customers (100)', entity: 'Customer', getData: () => buildCustomers(100) },
      { label: 'Suppliers (20)', entity: 'Supplier', getData: () => buildSuppliers(20) },
    ]
  },
  {
    id: 'wholesale',
    name: 'Wholesale Tenant',
    icon: Truck,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    description: 'B2B pricing, credit accounts, purchase history, 200 trade customers',
    steps: [
      { label: 'Products (300)', entity: 'Product', getData: () => buildProducts(300, 'Wholesale', ['Industrial', 'Commercial', 'Agricultural', 'Chemical', 'Machinery']) },
      { label: 'Customers (200)', entity: 'Customer', getData: () => buildCustomers(200) },
      { label: 'Suppliers (30)', entity: 'Supplier', getData: () => buildSuppliers(30) },
    ]
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing Tenant',
    icon: Factory,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    description: 'Raw materials, WIP, finished goods, BOMs, production orders',
    steps: [
      { label: 'Products (200)', entity: 'Product', getData: () => buildProducts(200, 'MFG', ['Raw Material', 'WIP', 'Finished Good', 'Consumable', 'Packaging']) },
      { label: 'Suppliers (15)', entity: 'Supplier', getData: () => buildSuppliers(15) },
      { label: 'Locations (3)', entity: 'Location', getData: () => [
        { name: 'Factory Floor A', type: 'warehouse', address: '1 Factory Rd, Detroit MI', manager_name: 'Mike Ford', is_active: true },
        { name: 'Raw Materials Store', type: 'warehouse', address: '2 Factory Rd, Detroit MI', manager_name: 'Sue Lang', is_active: true },
        { name: 'Dispatch Bay', type: 'warehouse', address: '3 Factory Rd, Detroit MI', manager_name: 'Tom Lee', is_active: true },
      ]},
    ]
  },
  {
    id: '3pl',
    name: '3PL Tenant',
    icon: Globe2,
    color: 'text-green-600',
    bg: 'bg-green-50',
    description: 'Multiple client accounts, billing records, shipment history',
    steps: [
      { label: 'Products (150)', entity: 'Product', getData: () => buildProducts(150, '3PL', ['Electronics', 'FMCG', 'Pharma', 'Automotive', 'Apparel']) },
      { label: 'Customers (50)', entity: 'Customer', getData: () => buildCustomers(50) },
      { label: 'Locations (4)', entity: 'Location', getData: () => [
        { name: '3PL Hub - East', type: 'warehouse', address: '10 Logistics Way, Newark NJ', manager_name: 'Anna Wu', is_active: true },
        { name: '3PL Hub - West', type: 'warehouse', address: '20 Port Ave, Los Angeles CA', manager_name: 'Carlos Ruiz', is_active: true },
        { name: '3PL Hub - Central', type: 'warehouse', address: '30 Freight Dr, Dallas TX', manager_name: 'Beth Jones', is_active: true },
        { name: 'Cold Store', type: 'warehouse', address: '40 Cryo Blvd, Chicago IL', manager_name: 'Jim Frost', is_active: true },
      ]},
    ]
  },
];

const BATCH_SIZE = 50;

export default function DataSeeder() {
  const [progress, setProgress] = useState({});
  const [running, setRunning] = useState(null);
  const [done, setDone] = useState({});
  const [errors, setErrors] = useState({});

  const runTenant = async (tenant) => {
    setRunning(tenant.id);
    setErrors(prev => ({ ...prev, [tenant.id]: null }));
    const stepProgress = {};

    for (let si = 0; si < tenant.steps.length; si++) {
      const step = tenant.steps[si];
      stepProgress[si] = 0;
      setProgress(prev => ({ ...prev, [tenant.id]: { ...stepProgress, current: step.label } }));

      const records = step.getData();
      const total = records.length;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await base44.entities[step.entity].bulkCreate(batch);
        stepProgress[si] = Math.min(100, Math.round(((i + BATCH_SIZE) / total) * 100));
        setProgress(prev => ({ ...prev, [tenant.id]: { ...stepProgress, current: step.label } }));
        await new Promise(r => setTimeout(r, 100));
      }
      stepProgress[si] = 100;
    }

    setProgress(prev => ({ ...prev, [tenant.id]: { ...stepProgress, current: 'Done' } }));
    setDone(prev => ({ ...prev, [tenant.id]: true }));
    setRunning(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Enterprise Demo Data Seeder</h1>
        <p className="text-muted-foreground mt-1">Seed realistic enterprise-grade data for each tenant archetype to make the platform demo-ready.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {TENANTS.map(tenant => {
          const TI = tenant.icon;
          const tenantProgress = progress[tenant.id];
          const isDone = done[tenant.id];
          const isRunning = running === tenant.id;
          const totalSteps = tenant.steps.length;
          const completedSteps = tenantProgress
            ? Object.values(tenantProgress).filter((v, k) => typeof k === 'number' && v === 100).length
            : 0;
          const overallPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

          return (
            <Card key={tenant.id} className={isDone ? 'border-green-200 bg-green-50/30' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${tenant.bg} flex items-center justify-center flex-shrink-0`}>
                      <TI className={`w-5 h-5 ${tenant.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{tenant.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{tenant.description}</CardDescription>
                    </div>
                  </div>
                  {isDone && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  {tenant.steps.map((step, si) => {
                    const pct = tenantProgress?.[si] ?? 0;
                    return (
                      <div key={step.label} className="flex items-center gap-3">
                        {pct === 100
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          : isRunning && tenantProgress?.current === step.label
                            ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
                            : <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                        }
                        <span className="text-xs text-muted-foreground flex-1">{step.label}</span>
                        {pct > 0 && pct < 100 && (
                          <span className="text-xs text-primary font-medium">{pct}%</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isRunning && (
                  <div className="space-y-1">
                    <Progress value={overallPct} className="h-2" />
                    <p className="text-xs text-muted-foreground">Seeding: {tenantProgress?.current}...</p>
                  </div>
                )}

                {isDone ? (
                  <Badge className="w-full justify-center bg-green-100 text-green-700 border-0 py-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Seeded Successfully
                  </Badge>
                ) : (
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => runTenant(tenant)}
                    disabled={isRunning || running !== null}
                  >
                    {isRunning ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Seeding...</>
                    ) : (
                      <><Play className="w-4 h-4 mr-2" />Seed {tenant.name}</>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-yellow-200 bg-yellow-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">Run once on a fresh environment</p>
            <p className="text-xs text-yellow-700 mt-0.5">Each seeder appends records. Running multiple times will create duplicates. Use the entity manager to clear data before re-seeding.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}