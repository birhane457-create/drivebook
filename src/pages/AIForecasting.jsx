import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import { Loader2, Brain, TrendingUp, ShoppingBag, AlertTriangle, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, subDays, addDays } from 'date-fns';
import { toast } from 'sonner';

export default function AIForecasting() {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRec, setLoadingRec] = useState(false);

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.filter({ is_active: true }) });
  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.Sale.list('-created_date', 1000) });
  const { data: stockLevels = [] } = useQuery({ queryKey: ['stock-levels'], queryFn: () => base44.entities.StockLevel.list() });

  const getProductSalesHistory = (productId) => {
    const dailyMap = {};
    for (let i = 89; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dailyMap[d] = 0;
    }
    sales.filter(s => s.status === 'completed').forEach(s => {
      const d = s.created_date?.substring(0, 10);
      if (d && dailyMap[d] !== undefined) {
        (s.items || []).forEach(item => {
          if (item.product_id === productId) dailyMap[d] += item.quantity;
        });
      }
    });
    return Object.entries(dailyMap).map(([date, qty]) => ({ date, qty }));
  };

  const runForecast = async () => {
    if (!selectedProduct) return toast.error('Please select a product');
    setLoading(true);
    setForecast(null);

    const product = products.find(p => p.id === selectedProduct);
    const history = getProductSalesHistory(selectedProduct);
    const totalStock = stockLevels.filter(s => s.product_id === selectedProduct).reduce((sum, s) => sum + (s.quantity || 0), 0);
    const avg30 = history.slice(-30).reduce((s, d) => s + d.qty, 0) / 30;
    const avg90 = history.reduce((s, d) => s + d.qty, 0) / 90;

    const prompt = `You are an inventory demand forecasting AI for a warehouse management system.

Product: ${product?.name} (SKU: ${product?.sku})
Category: ${product?.category}
Current Stock: ${totalStock} units
Reorder Level: ${product?.reorder_level}
30-day avg daily sales: ${avg30.toFixed(2)} units/day
90-day avg daily sales: ${avg90.toFixed(2)} units/day
Last 14 days sales data: ${JSON.stringify(history.slice(-14))}

Generate a 30-day demand forecast with the following:
1. Daily forecasted units for the next 30 days
2. Confidence level (low/medium/high)
3. Key drivers/factors influencing demand
4. Recommended reorder point (days until stockout at forecasted velocity)
5. Recommended order quantity
6. Risk assessment`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          daily_forecast: {
            type: 'array',
            items: { type: 'object', properties: { day: { type: 'number' }, date_label: { type: 'string' }, forecast_qty: { type: 'number' }, lower_bound: { type: 'number' }, upper_bound: { type: 'number' } } }
          },
          confidence: { type: 'string' },
          total_30day_forecast: { type: 'number' },
          days_until_stockout: { type: 'number' },
          recommended_order_qty: { type: 'number' },
          recommended_reorder_point: { type: 'number' },
          key_factors: { type: 'array', items: { type: 'string' } },
          risk_level: { type: 'string' },
          risk_description: { type: 'string' }
        }
      }
    });

    const historicalChart = history.slice(-30).map((d, i) => ({
      label: format(new Date(d.date), 'MMM d'),
      actual: d.qty,
      forecast: null,
    }));

    const forecastChart = (result.daily_forecast || []).slice(0, 30).map((d, i) => ({
      label: d.date_label || `Day ${d.day}`,
      actual: null,
      forecast: d.forecast_qty,
      lower: d.lower_bound,
      upper: d.upper_bound,
    }));

    setForecast({ ...result, product, totalStock, chartData: [...historicalChart, ...forecastChart] });
    setLoading(false);
  };

  const runPurchaseRecommendations = async () => {
    setLoadingRec(true);
    setRecommendations([]);

    const productData = products.map(p => {
      const totalStock = stockLevels.filter(s => s.product_id === p.id).reduce((sum, s) => sum + (s.quantity || 0), 0);
      const sold30 = sales.filter(s => s.status === 'completed' && s.created_date > new Date(Date.now() - 30 * 86400000).toISOString())
        .reduce((sum, s) => sum + (s.items || []).filter(i => i.product_id === p.id).reduce((a, i) => a + i.quantity, 0), 0);
      return { id: p.id, name: p.name, sku: p.sku, category: p.category, current_stock: totalStock, reorder_level: p.reorder_level, sold_last_30d: sold30, unit_cost: p.unit_cost };
    });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a smart inventory replenishment AI. Analyze this product catalog and generate purchase order recommendations based on sales velocity and stock levels.

Products: ${JSON.stringify(productData)}

For each product that needs replenishment, generate a recommendation. Focus on:
- Products at or below reorder level
- Products with high sales velocity about to run out
- Products with zero or very low stock
Return top 8 most urgent recommendations.`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'string' },
                product_name: { type: 'string' },
                urgency: { type: 'string' },
                current_stock: { type: 'number' },
                recommended_qty: { type: 'number' },
                reason: { type: 'string' },
                estimated_stockout_days: { type: 'number' }
              }
            }
          }
        }
      }
    });

    setRecommendations(result.recommendations || []);
    setLoadingRec(false);
  };

  const urgencyColor = { critical: 'destructive', high: 'destructive', medium: 'secondary', low: 'outline' };

  return (
    <div>
      <PageHeader title="AI Demand Forecasting" subtitle="ML-powered demand prediction and automated purchase recommendations" />

      {/* Purchase Recommendations */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Automated Purchase Recommendations
            </CardTitle>
            <Button onClick={runPurchaseRecommendations} disabled={loadingRec} size="sm">
              {loadingRec ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
              {loadingRec ? 'Analyzing...' : 'Generate Recommendations'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingRec && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Brain className="w-10 h-10 mx-auto mb-3 text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">AI analyzing sales velocity and stock levels...</p>
              </div>
            </div>
          )}
          {recommendations.length > 0 && (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-4 p-3 rounded-lg border bg-muted/30">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">{i + 1}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{rec.product_name}</span>
                      <Badge variant={urgencyColor[rec.urgency?.toLowerCase()] || 'secondary'} className="text-xs capitalize">{rec.urgency}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.reason}</p>
                    <p className="text-xs text-amber-600 mt-1">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      Stockout in ~{rec.estimated_stockout_days} days
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{rec.recommended_qty}</p>
                    <p className="text-xs text-muted-foreground">units to order</p>
                    <p className="text-xs text-muted-foreground">{rec.current_stock} on hand</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loadingRec && recommendations.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Click "Generate Recommendations" to run AI analysis</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single Product Forecast */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              30-Day Demand Forecast
            </CardTitle>
            <div className="flex items-center gap-3">
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={runForecast} disabled={loading || !selectedProduct} size="sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                {loading ? 'Forecasting...' : 'Run Forecast'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Brain className="w-12 h-12 mx-auto mb-3 text-primary animate-pulse" />
                <p className="text-muted-foreground">AI is analyzing sales patterns...</p>
              </div>
            </div>
          )}
          {forecast && !loading && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1">30-Day Forecast</p>
                  <p className="text-2xl font-bold">{forecast.total_30day_forecast}</p>
                  <p className="text-xs text-muted-foreground">units</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Stockout Risk</p>
                  <p className="text-2xl font-bold text-amber-500">{forecast.days_until_stockout}</p>
                  <p className="text-xs text-muted-foreground">days</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Order Qty</p>
                  <p className="text-2xl font-bold text-primary">{forecast.recommended_order_qty}</p>
                  <p className="text-xs text-muted-foreground">units</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                  <p className="text-2xl font-bold capitalize">{forecast.confidence}</p>
                  <Badge variant={forecast.risk_level === 'high' ? 'destructive' : forecast.risk_level === 'medium' ? 'secondary' : 'default'} className="text-xs mt-1">{forecast.risk_level} risk</Badge>
                </div>
              </div>

              {/* Chart */}
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={forecast.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={10} stroke="hsl(var(--muted-foreground))" interval={6} />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <ReferenceLine x={forecast.chartData[29]?.label} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: 'Today', fontSize: 10 }} />
                  <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} dot={false} name="Actual" connectNulls={false} />
                  <Line type="monotone" dataKey="forecast" stroke="hsl(243, 75%, 59%)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Forecast" connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>

              {/* Key Factors */}
              {forecast.key_factors?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Key Demand Factors</h4>
                  <div className="flex flex-wrap gap-2">
                    {forecast.key_factors.map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {forecast.risk_description && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <p className="text-xs text-amber-700 dark:text-amber-400">{forecast.risk_description}</p>
                </div>
              )}
            </div>
          )}
          {!forecast && !loading && (
            <div className="text-center py-16 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select a product and run the AI forecast</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}