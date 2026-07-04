import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Database, Play, CheckCircle2, Loader2, ShoppingCart, Factory,
  Truck, Globe2, Pill, Car, UtensilsCrossed, AlertTriangle
} from 'lucide-react';

const INDUSTRIES = [
  { id: 'retail',       label: 'Retail Company',           icon: ShoppingCart,      color: 'text-blue-600',   bg: 'bg-blue-50',   desc: 'Omnichannel retail — 30 SKUs, 3 locations, 10 customers, 6 suppliers' },
  { id: 'manufacturing',label: 'Manufacturing Company',   icon: Factory,           color: 'text-orange-600', bg: 'bg-orange-50', desc: 'Precision machining — 30 SKUs, 3 plants, 10 B2B customers, 6 suppliers' },
  { id: 'wholesale',    label: 'Wholesale Distributor',   icon: Truck,             color: 'text-purple-600', bg: 'bg-purple-50', desc: 'B2B distribution — 30 SKUs, 3 DCs, 15 trade customers, 6 suppliers' },
  { id: 'threpl',       label: '3PL Warehouse',           icon: Globe2,            color: 'text-green-600',  bg: 'bg-green-50',  desc: 'Multi-client 3PL — 30 stored SKUs, 3 hubs, 10 clients, 6 suppliers' },
  { id: 'pharmacy',     label: 'Pharmacy',                icon: Pill,              color: 'text-teal-600',   bg: 'bg-teal-50',   desc: 'Community pharmacy — 30 OTC/Rx SKUs, 3 stores, 10 customers, 6 suppliers' },
  { id: 'automotive',   label: 'Automotive Parts',        icon: Car,               color: 'text-red-600',    bg: 'bg-red-50',    desc: 'Auto parts — 30 SKUs, 3 locations, 15 workshops, 6 suppliers' },
  { id: 'food',         label: 'Food Distributor',        icon: UtensilsCrossed,   color: 'text-amber-600',  bg: 'bg-amber-50',  desc: 'Food & beverage — 30 SKUs, 3 locations, 15 food-service customers, 8 suppliers' },
];

export default function DataSeeder() {
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState({});
  const [error, setError] = useState({});

  const runSeed = async (industry) => {
    setRunning(industry.id);
    setError(prev => ({ ...prev, [industry.id]: null }));
    try {
      const res = await base44.functions.invoke('seedDemoBusiness', { industry: industry.id });
      setResults(prev => ({ ...prev, [industry.id]: res.data.summary }));
    } catch (e) {
      setError(prev => ({ ...prev, [industry.id]: e.response?.data?.error || e.message || 'Failed to seed' }));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demo Business Seeder</h1>
        <p className="text-muted-foreground mt-1">Seed complete, linked businesses — products, suppliers, customers, stock, purchase orders, sales, and financials.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {INDUSTRIES.map(ind => {
          const I = ind.icon;
          const isRunning = running === ind.id;
          const isDone = !!results[ind.id];
          const err = error[ind.id];
          const summary = results[ind.id];

          return (
            <Card key={ind.id} className={isDone ? 'border-green-200 bg-green-50/30' : err ? 'border-red-200' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${ind.bg} flex items-center justify-center flex-shrink-0`}>
                      <I className={`w-5 h-5 ${ind.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{ind.label}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{ind.desc}</CardDescription>
                    </div>
                  </div>
                  {isDone && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isDone && summary && (
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {[
                      ['Locations', summary.locations],
                      ['Products', summary.products],
                      ['Suppliers', summary.suppliers],
                      ['Customers', summary.customers],
                      ['Stock Levels', summary.stockLevels],
                      ['Purchase Orders', summary.purchaseOrders],
                      ['Sales', summary.sales],
                      ['Payables', summary.payables],
                      ['Receivables', summary.receivables],
                    ].map(([label, count]) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                        <span className="text-muted-foreground">{label}:</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                )}

                {isRunning && (
                  <div className="space-y-1.5">
                    <Progress value={50} className="h-2" />
                    <p className="text-xs text-muted-foreground">Creating complete business — locations, products, stock, POs, sales, financials...</p>
                  </div>
                )}

                {err && <p className="text-xs text-red-600">{err}</p>}

                {isDone ? (
                  <Badge className="w-full justify-center bg-green-100 text-green-700 border-0 py-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {summary.products + summary.customers + summary.suppliers + summary.stockLevels + summary.purchaseOrders + summary.sales + summary.payables + summary.receivables + summary.locations} records created
                  </Badge>
                ) : (
                  <Button className="w-full" size="sm" onClick={() => runSeed(ind)} disabled={isRunning || running !== null}>
                    {isRunning ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Seeding...</>
                    ) : (
                      <><Play className="w-4 h-4 mr-2" />Seed Business</>
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
            <p className="text-sm font-semibold text-yellow-800">Each business is a complete dataset</p>
            <p className="text-xs text-yellow-700 mt-0.5">Every industry creates fully linked records — products with stock levels at each location, purchase orders referencing real suppliers and products, sales linked to customers, and AP/AR financial records. Run once per environment; re-running creates duplicates.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}