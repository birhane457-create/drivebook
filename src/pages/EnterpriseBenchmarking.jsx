import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Trophy, Users, Lock, Info } from 'lucide-react';

const METRICS = [
  {
    id: 'inv_accuracy', label: 'Inventory Accuracy', unit: '%', higher_better: true, category: 'inventory',
    your_value: 96.2, industry_avg: 93.8, top_quartile: 98.1, bottom_quartile: 88.4,
    description: 'Percentage of inventory records that match physical counts',
    trend: +1.3, insight: 'You are above industry average. Close the gap to top quartile by improving cycle count frequency.',
  },
  {
    id: 'fill_rate', label: 'Order Fill Rate', unit: '%', higher_better: true, category: 'operations',
    your_value: 91.1, industry_avg: 94.3, top_quartile: 97.4, bottom_quartile: 86.0,
    description: 'Percentage of orders fulfilled from stock without backorder',
    trend: -0.8, insight: 'Below industry average. Root cause: 14 stockout SKUs identified by AI Insight Hub. Action required.',
  },
  {
    id: 'po_cycle_time', label: 'PO Cycle Time', unit: 'days', higher_better: false, category: 'procurement',
    your_value: 6.4, industry_avg: 7.1, top_quartile: 4.2, bottom_quartile: 10.8,
    description: 'Average days from PO creation to goods receipt',
    trend: -0.6, insight: 'Better than industry average. Accelerate to top quartile by enabling supplier portal for direct confirmations.',
  },
  {
    id: 'carrying_cost', label: 'Inventory Carrying Cost', unit: '% of value', higher_better: false, category: 'finance',
    your_value: 23.4, industry_avg: 26.1, top_quartile: 18.9, bottom_quartile: 32.0,
    description: 'Annual cost to hold inventory as % of inventory value',
    trend: -1.1, insight: 'You outperform industry average. Further improvement possible via demand-driven replenishment.',
  },
  {
    id: 'stockout_rate', label: 'Stockout Rate', unit: '%', higher_better: false, category: 'inventory',
    your_value: 4.2, industry_avg: 5.8, top_quartile: 1.9, bottom_quartile: 9.1,
    description: 'Percentage of SKUs experiencing stockout in a given period',
    trend: +0.4, insight: 'Worsening trend detected. AI Insight Hub flagged 14 critical SKUs — immediate replenishment recommended.',
  },
  {
    id: 'supplier_otd', label: 'Supplier On-Time Delivery', unit: '%', higher_better: true, category: 'procurement',
    your_value: 82.3, industry_avg: 86.4, top_quartile: 94.1, bottom_quartile: 74.0,
    description: 'Percentage of supplier deliveries received on or before promised date',
    trend: -3.2, insight: 'Significantly below average, driven by TechSupply underperformance. Supplier scorecard action plan needed.',
  },
  {
    id: 'return_rate', label: 'Customer Return Rate', unit: '%', higher_better: false, category: 'operations',
    your_value: 3.1, industry_avg: 4.8, top_quartile: 1.8, bottom_quartile: 8.2,
    description: 'Percentage of orders returned by customers',
    trend: +0.1, insight: 'You perform well below industry average on returns. Quality and description accuracy are strong.',
  },
  {
    id: 'gross_margin', label: 'Gross Margin', unit: '%', higher_better: true, category: 'finance',
    your_value: 34.2, industry_avg: 31.8, top_quartile: 42.1, bottom_quartile: 22.4,
    description: 'Revenue minus COGS as a percentage of revenue',
    trend: -2.1, insight: 'Margin erosion detected in Food & Bev. AI flagged 9pp decline. Pricing review needed.',
  },
];

const CATEGORIES = ['all', 'inventory', 'operations', 'procurement', 'finance'];

function MetricCard({ metric }) {
  const isAboveAvg = metric.higher_better
    ? metric.your_value >= metric.industry_avg
    : metric.your_value <= metric.industry_avg;
  const isTopQuartile = metric.higher_better
    ? metric.your_value >= metric.top_quartile
    : metric.your_value <= metric.top_quartile;

  const position = metric.higher_better
    ? Math.min(100, Math.max(0, ((metric.your_value - metric.bottom_quartile) / (metric.top_quartile - metric.bottom_quartile)) * 100))
    : Math.min(100, Math.max(0, 100 - ((metric.your_value - metric.bottom_quartile) / (metric.top_quartile - metric.bottom_quartile)) * 100));

  return (
    <Card className={`border-2 ${isTopQuartile ? 'border-green-300' : isAboveAvg ? 'border-blue-200' : 'border-orange-200'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-semibold text-sm">{metric.label}</p>
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isTopQuartile && <Badge className="text-[10px] bg-green-100 text-green-700"><Trophy className="w-2.5 h-2.5 mr-0.5" />Top Quartile</Badge>}
            {!isTopQuartile && isAboveAvg && <Badge className="text-[10px] bg-blue-100 text-blue-700">Above Avg</Badge>}
            {!isAboveAvg && <Badge className="text-[10px] bg-orange-100 text-orange-700">Below Avg</Badge>}
          </div>
        </div>

        {/* Your value */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold">{metric.your_value}{metric.unit}</span>
          <span className={`text-xs flex items-center gap-0.5 ${metric.trend > 0 === metric.higher_better ? 'text-green-600' : 'text-red-600'}`}>
            {metric.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {metric.trend > 0 ? '+' : ''}{metric.trend}{metric.unit} vs last period
          </span>
        </div>

        {/* Distribution bar */}
        <div className="mb-3">
          <div className="relative h-4 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-full">
            <div className="absolute top-0 h-4 w-0.5 bg-gray-500" style={{ left: `${position}%`, transform: 'translateX(-50%)' }} title="You" />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Bottom {metric.bottom_quartile}{metric.unit}</span>
            <span>▲ You: {metric.your_value}{metric.unit}</span>
            <span>Top {metric.top_quartile}{metric.unit}</span>
          </div>
        </div>

        {/* Benchmarks */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div className="bg-muted rounded p-2">
            <p className="text-muted-foreground">Industry Avg</p>
            <p className="font-bold">{metric.industry_avg}{metric.unit}</p>
          </div>
          <div className="bg-muted rounded p-2">
            <p className="text-muted-foreground">Top Quartile</p>
            <p className="font-bold text-green-600">{metric.top_quartile}{metric.unit}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{metric.insight}</p>
      </CardContent>
    </Card>
  );
}

export default function EnterpriseBenchmarking() {
  const [category, setCategory] = useState('all');

  const filtered = METRICS.filter(m => category === 'all' || m.category === category);
  const aboveAvg = METRICS.filter(m => m.higher_better ? m.your_value >= m.industry_avg : m.your_value <= m.industry_avg).length;
  const topQ = METRICS.filter(m => m.higher_better ? m.your_value >= m.top_quartile : m.your_value <= m.top_quartile).length;

  const radarData = METRICS.slice(0, 6).map(m => ({
    metric: m.label.split(' ').slice(0, 2).join(' '),
    you: m.higher_better
      ? Math.round((m.your_value / m.top_quartile) * 100)
      : Math.round((m.bottom_quartile / m.your_value) * 100),
    industry: m.higher_better
      ? Math.round((m.industry_avg / m.top_quartile) * 100)
      : Math.round((m.bottom_quartile / m.industry_avg) * 100),
  }));

  const barData = METRICS.map(m => ({
    name: m.label.split(' ').slice(0, 2).join(' '),
    you: m.your_value,
    avg: m.industry_avg,
    top: m.top_quartile,
  }));

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Enterprise Benchmarking" subtitle="Anonymized cross-tenant performance insights · Industry percentiles · Trend analysis">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="w-3 h-3" />
          <span>All peer data is fully anonymized</span>
        </div>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Metrics Tracked', value: METRICS.length, color: 'text-blue-600' },
          { label: 'Above Industry Avg', value: `${aboveAvg}/${METRICS.length}`, color: 'text-green-600' },
          { label: 'Top Quartile', value: `${topQ}/${METRICS.length}`, color: 'text-purple-600' },
          { label: 'Peer Companies', value: '2,400+', color: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="cards">
        <TabsList>
          <TabsTrigger value="cards">Metric Cards</TabsTrigger>
          <TabsTrigger value="radar">Radar Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="cards">
          <div className="flex gap-2 mb-4 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(m => <MetricCard key={m.id} metric={m} />)}
          </div>
        </TabsContent>

        <TabsContent value="radar">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Performance vs Industry Average (normalized %)</CardTitle>
              <CardDescription className="text-xs">100% = top quartile. Values above 100 indicate top-quartile performance.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <Radar name="Your Company" dataKey="you" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                    <Radar name="Industry Average" dataKey="industry" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}