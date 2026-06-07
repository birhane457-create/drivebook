import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Lock, Award } from 'lucide-react';

const METRICS = [
  {
    category: 'Inventory',
    metrics: [
      { name: 'Inventory Accuracy',     yours: 96.2, industry: 93.8, top_quartile: 98.5, unit: '%',   direction: 'higher' },
      { name: 'Fill Rate',              yours: 91.1, industry: 94.2, top_quartile: 97.4, unit: '%',   direction: 'higher' },
      { name: 'Stockout Rate',          yours: 3.2,  industry: 5.8,  top_quartile: 1.4,  unit: '%',   direction: 'lower' },
      { name: 'Inventory Turnover',     yours: 8.4,  industry: 7.1,  top_quartile: 11.2, unit: '×/yr',direction: 'higher' },
      { name: 'Dead Stock %',           yours: 6.1,  industry: 9.3,  top_quartile: 2.8,  unit: '%',   direction: 'lower' },
      { name: 'Shrinkage Rate',         yours: 0.8,  industry: 1.4,  top_quartile: 0.3,  unit: '%',   direction: 'lower' },
    ]
  },
  {
    category: 'Operations',
    metrics: [
      { name: 'Order Cycle Time',       yours: 2.4,  industry: 3.1,  top_quartile: 1.2,  unit: 'days',direction: 'lower' },
      { name: 'On-Time Delivery',       yours: 94.8, industry: 91.2, top_quartile: 98.2, unit: '%',   direction: 'higher' },
      { name: 'Pick Accuracy',          yours: 99.1, industry: 97.8, top_quartile: 99.8, unit: '%',   direction: 'higher' },
      { name: 'Return Rate',            yours: 4.2,  industry: 6.1,  top_quartile: 2.0,  unit: '%',   direction: 'lower' },
      { name: 'Warehouse Utilisation',  yours: 78.0, industry: 72.0, top_quartile: 88.0, unit: '%',   direction: 'higher' },
    ]
  },
  {
    category: 'Finance',
    metrics: [
      { name: 'Gross Margin',           yours: 34.2, industry: 31.0, top_quartile: 42.0, unit: '%',   direction: 'higher' },
      { name: 'COGS % of Revenue',      yours: 65.8, industry: 69.0, top_quartile: 58.0, unit: '%',   direction: 'lower' },
      { name: 'Days Sales Outstanding', yours: 29.0, industry: 38.0, top_quartile: 18.0, unit: 'days',direction: 'lower' },
      { name: 'Days Payable Outstanding',yours: 42.0, industry: 35.0, top_quartile: 55.0, unit: 'days',direction: 'higher' },
    ]
  },
  {
    category: 'Procurement',
    metrics: [
      { name: 'Supplier On-Time Rate',  yours: 88.4, industry: 85.0, top_quartile: 95.0, unit: '%',   direction: 'higher' },
      { name: 'PO Cycle Time',          yours: 3.8,  industry: 5.2,  top_quartile: 1.8,  unit: 'days',direction: 'lower' },
      { name: 'Maverick Spending',      yours: 7.2,  industry: 12.0, top_quartile: 3.0,  unit: '%',   direction: 'lower' },
    ]
  },
];

function getDelta(yours, industry, direction) {
  const diff = yours - industry;
  const better = direction === 'higher' ? diff > 0 : diff < 0;
  const equal = Math.abs(diff) < 0.2;
  return { diff: Math.abs(diff).toFixed(1), better, equal };
}

function MetricRow({ metric }) {
  const { diff, better, equal } = getDelta(metric.yours, metric.industry, metric.direction);
  const vsTop = getDelta(metric.yours, metric.top_quartile, metric.direction);

  return (
    <div className="grid grid-cols-12 gap-2 py-3 border-b last:border-0 items-center">
      <div className="col-span-4">
        <p className="text-sm font-medium">{metric.name}</p>
      </div>
      <div className="col-span-2 text-center">
        <span className="text-sm font-bold">{metric.yours}{metric.unit}</span>
      </div>
      <div className="col-span-2 text-center">
        <span className="text-sm text-muted-foreground">{metric.industry}{metric.unit}</span>
      </div>
      <div className="col-span-2 text-center">
        <span className="text-sm text-purple-600 font-medium">{metric.top_quartile}{metric.unit}</span>
      </div>
      <div className="col-span-2 text-right">
        {equal ? (
          <Badge variant="outline" className="text-[10px] gap-1"><Minus className="w-2.5 h-2.5" /> Avg</Badge>
        ) : better ? (
          <Badge className="text-[10px] bg-green-100 text-green-700 gap-1"><TrendingUp className="w-2.5 h-2.5" /> +{diff}</Badge>
        ) : (
          <Badge className="text-[10px] bg-red-100 text-red-700 gap-1"><TrendingDown className="w-2.5 h-2.5" /> -{diff}</Badge>
        )}
      </div>
    </div>
  );
}

const RADAR_DATA = [
  { metric: 'Inventory',  yours: 82, industry: 74 },
  { metric: 'Operations', yours: 88, industry: 79 },
  { metric: 'Finance',    yours: 76, industry: 72 },
  { metric: 'Procurement',yours: 85, industry: 78 },
  { metric: 'Quality',    yours: 91, industry: 82 },
  { metric: 'Fulfillment',yours: 79, industry: 75 },
];

export default function Benchmarking() {
  const allMetrics = METRICS.flatMap(c => c.metrics);
  const beating = allMetrics.filter(m => {
    const { better, equal } = getDelta(m.yours, m.industry, m.direction);
    return better && !equal;
  }).length;
  const lagging = allMetrics.filter(m => {
    const { better, equal } = getDelta(m.yours, m.industry, m.direction);
    return !better && !equal;
  }).length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Enterprise Benchmarking" subtitle="Anonymized cross-tenant insights · Industry percentiles · Competitive positioning">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
          <Lock className="w-3 h-3" /> All data anonymized & aggregated
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Metrics Tracked',    value: allMetrics.length, color: 'text-foreground' },
          { label: 'Above Industry Avg', value: beating,           color: 'text-green-600' },
          { label: 'Below Industry Avg', value: lagging,           color: 'text-red-600' },
          { label: 'Overall Percentile', value: '72nd',            color: 'text-purple-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {METRICS.map(c => <TabsTrigger key={c.category} value={c.category}>{c.category}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Performance Radar</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={RADAR_DATA}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <Radar name="Your Company" dataKey="yours" fill="#6366f1" fillOpacity={0.3} stroke="#6366f1" />
                  <Radar name="Industry Avg" dataKey="industry" fill="#94a3b8" fillOpacity={0.1} stroke="#94a3b8" strokeDasharray="4 4" />
                </RadarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 justify-center mt-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 inline-block" /> Your Company</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-400 inline-block border-dashed" /> Industry Avg</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Key Highlights</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-green-700 flex items-center gap-1"><Award className="w-3 h-3" /> Strengths (above industry)</p>
                {allMetrics.filter(m => getDelta(m.yours, m.industry, m.direction).better).slice(0, 4).map(m => (
                  <div key={m.name} className="flex justify-between text-xs bg-green-50 rounded px-2 py-1">
                    <span>{m.name}</span>
                    <span className="font-bold text-green-700">{m.yours}{m.unit}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-red-700 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Opportunities</p>
                {allMetrics.filter(m => !getDelta(m.yours, m.industry, m.direction).better && !getDelta(m.yours, m.industry, m.direction).equal).slice(0, 4).map(m => (
                  <div key={m.name} className="flex justify-between text-xs bg-red-50 rounded px-2 py-1">
                    <span>{m.name}</span>
                    <span className="font-bold text-red-700">{m.yours}{m.unit} vs {m.industry}{m.unit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {METRICS.map(cat => (
          <TabsContent key={cat.category} value={cat.category} className="mt-4">
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-12 gap-2 pb-2 border-b mb-1">
                  <div className="col-span-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Metric</div>
                  <div className="col-span-2 text-xs font-semibold text-center text-indigo-600">Yours</div>
                  <div className="col-span-2 text-xs font-semibold text-center text-muted-foreground">Industry</div>
                  <div className="col-span-2 text-xs font-semibold text-center text-purple-600">Top 25%</div>
                  <div className="col-span-2 text-xs font-semibold text-right text-muted-foreground">vs Avg</div>
                </div>
                {cat.metrics.map(m => <MetricRow key={m.name} metric={m} />)}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}