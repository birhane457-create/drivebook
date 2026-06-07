import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Brain, DollarSign, Zap, TrendingDown, AlertTriangle, CheckCircle, Star } from 'lucide-react';

const COST_TREND = [
  { day: 'Jun 1', copilot: 2.4, forecasting: 1.1, insight_hub: 0.8, other: 0.3 },
  { day: 'Jun 2', copilot: 3.1, forecasting: 0.9, insight_hub: 1.2, other: 0.4 },
  { day: 'Jun 3', copilot: 2.8, forecasting: 1.4, insight_hub: 0.6, other: 0.2 },
  { day: 'Jun 4', copilot: 1.9, forecasting: 1.0, insight_hub: 0.9, other: 0.5 },
  { day: 'Jun 5', copilot: 3.6, forecasting: 1.8, insight_hub: 1.1, other: 0.3 },
  { day: 'Jun 6', copilot: 2.2, forecasting: 1.2, insight_hub: 0.7, other: 0.6 },
  { day: 'Jun 7', copilot: 2.9, forecasting: 1.5, insight_hub: 1.0, other: 0.4 },
];

const MODEL_PERF = [
  { model: 'GPT-4o Mini', calls: 1842, avg_latency: 820, avg_rating: 4.1, cost: 9.20, success_rate: 99.1 },
  { model: 'GPT-4o', calls: 234, avg_latency: 2100, avg_rating: 4.7, cost: 28.40, success_rate: 99.6 },
  { model: 'Claude Sonnet', calls: 89, avg_latency: 1840, avg_rating: 4.8, cost: 18.90, success_rate: 100 },
  { model: 'Gemini Flash', calls: 412, avg_latency: 680, avg_rating: 3.9, cost: 4.10, success_rate: 98.3 },
];

const FEATURE_USAGE = [
  { name: 'AI Copilot', value: 42, color: '#6366f1' },
  { name: 'Forecasting', value: 24, color: '#8b5cf6' },
  { name: 'Insight Hub', value: 18, color: '#22c55e' },
  { name: 'Doc Extract', value: 10, color: '#f59e0b' },
  { name: 'Other', value: 6, color: '#94a3b8' },
];

const TOP_PROMPTS = [
  { prompt: 'Analyze current inventory levels and identify reorder recommendations', feature: 'copilot', calls: 284, avg_rating: 4.6, avg_tokens: 1240 },
  { prompt: 'Generate demand forecast for next 30 days by category', feature: 'forecasting', calls: 198, avg_rating: 4.4, avg_tokens: 2100 },
  { prompt: 'Summarize financial performance vs prior month', feature: 'copilot', calls: 156, avg_rating: 4.7, avg_tokens: 980 },
  { prompt: 'Identify top 10 slow-moving SKUs and suggest clearance actions', feature: 'insight_hub', calls: 134, avg_rating: 4.2, avg_tokens: 1560 },
  { prompt: 'Extract line items from uploaded supplier invoice PDF', feature: 'doc_extract', calls: 89, avg_rating: 4.5, avg_tokens: 340 },
];

const BUDGET = { monthly_limit: 500, spent: 289.40, remaining: 210.60, projected: 412.80 };

const FEATURE_COLORS = { copilot: '#6366f1', forecasting: '#8b5cf6', insight_hub: '#22c55e', doc_extract: '#f59e0b', other: '#94a3b8' };

function StarRating({ value }) {
  return (
    <span className="flex items-center gap-0.5 text-xs">
      <Star className="w-3 h-3 text-yellow-500 fill-yellow-400" />
      {value.toFixed(1)}
    </span>
  );
}

export default function AIOps() {
  const [period, setPeriod] = useState('7d');

  const totalCost = COST_TREND.reduce((s, d) => s + d.copilot + d.forecasting + d.insight_hub + d.other, 0);
  const totalCalls = MODEL_PERF.reduce((s, m) => s + m.calls, 0);
  const avgRating = (MODEL_PERF.reduce((s, m) => s + m.avg_rating * m.calls, 0) / totalCalls).toFixed(1);
  const budgetPct = Math.round((BUDGET.spent / BUDGET.monthly_limit) * 100);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="AIOps — AI Operations" subtitle="Cost tracking · Token usage · Model performance · Prompt analytics · Quality scoring">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total AI Cost (7d)', value: `$${totalCost.toFixed(2)}`, color: 'text-purple-600', icon: DollarSign },
          { label: 'Total API Calls', value: totalCalls.toLocaleString(), color: 'text-blue-600', icon: Zap },
          { label: 'Avg Quality Score', value: `${avgRating}/5`, color: 'text-green-600', icon: Star },
          { label: 'Budget Used', value: `${budgetPct}%`, color: budgetPct > 80 ? 'text-red-600' : 'text-orange-600', icon: TrendingDown },
        ].map(k => (
          <Card key={k.label}><CardContent className="p-4 flex items-center gap-3">
            <k.icon className={`w-8 h-8 ${k.color}`} />
            <div><p className="text-xs text-muted-foreground">{k.label}</p><p className={`text-2xl font-bold ${k.color}`}>{k.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Budget Bar */}
      <Card className={`border-2 ${budgetPct > 80 ? 'border-orange-300' : 'border-border'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-semibold text-sm">Monthly AI Budget</span>
              <span className="text-xs text-muted-foreground ml-2">${BUDGET.spent.toFixed(2)} spent of ${BUDGET.monthly_limit}</span>
            </div>
            <div className="text-right text-xs">
              <span className="text-muted-foreground">Projected: </span>
              <span className={BUDGET.projected > BUDGET.monthly_limit ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>${BUDGET.projected.toFixed(2)}</span>
              {BUDGET.projected > BUDGET.monthly_limit && <Badge className="ml-2 text-[10px] bg-red-100 text-red-700">Over budget</Badge>}
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div className="h-3 rounded-full bg-purple-500 transition-all" style={{ width: `${Math.min(budgetPct, 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0%</span><span>${BUDGET.remaining.toFixed(2)} remaining</span><span>100%</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="costs">
        <TabsList>
          <TabsTrigger value="costs">Cost Breakdown</TabsTrigger>
          <TabsTrigger value="models">Model Performance</TabsTrigger>
          <TabsTrigger value="prompts">Top Prompts</TabsTrigger>
          <TabsTrigger value="usage">Feature Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="costs">
          <Card>
            <CardHeader><CardTitle className="text-sm">Daily AI Cost by Feature ($)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={COST_TREND}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={(v, n) => [`$${v.toFixed(2)}`, n]} />
                    <Legend />
                    <Bar dataKey="copilot" name="AI Copilot" stackId="a" fill="#6366f1" />
                    <Bar dataKey="forecasting" name="Forecasting" stackId="a" fill="#8b5cf6" />
                    <Bar dataKey="insight_hub" name="Insight Hub" stackId="a" fill="#22c55e" />
                    <Bar dataKey="other" name="Other" stackId="a" fill="#94a3b8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models">
          <div className="space-y-3">
            {MODEL_PERF.sort((a, b) => b.calls - a.calls).map(m => (
              <Card key={m.model}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 flex-1">
                      <Brain className="w-4 h-4 text-purple-600" />
                      <span className="font-semibold text-sm">{m.model}</span>
                      {m.success_rate === 100 && <Badge className="text-[10px] bg-green-100 text-green-700"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />Perfect uptime</Badge>}
                    </div>
                    <div className="grid grid-cols-4 gap-6 text-xs">
                      <div><p className="text-muted-foreground">Calls</p><p className="font-bold">{m.calls.toLocaleString()}</p></div>
                      <div><p className="text-muted-foreground">Avg Latency</p><p className="font-bold">{m.avg_latency}ms</p></div>
                      <div><p className="text-muted-foreground">Quality</p><StarRating value={m.avg_rating} /></div>
                      <div><p className="text-muted-foreground">Cost (7d)</p><p className="font-bold">${m.cost.toFixed(2)}</p></div>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${(m.calls / totalCalls) * 100}%` }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="prompts">
          <div className="space-y-2">
            {TOP_PROMPTS.map((p, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6 text-center flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.prompt}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span style={{ color: FEATURE_COLORS[p.feature] || '#94a3b8' }}>● {p.feature.replace('_',' ')}</span>
                        <span>{p.calls} calls</span>
                        <span>~{p.avg_tokens} tokens</span>
                        <StarRating value={p.avg_rating} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="usage">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Calls by Feature</CardTitle></CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={FEATURE_USAGE} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {FEATURE_USAGE.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-2">
              {FEATURE_USAGE.map(f => (
                <div key={f.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: f.color }} />
                  <span className="text-sm flex-1">{f.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${f.value}%`, background: f.color }} />
                  </div>
                  <span className="text-xs font-bold w-8 text-right">{f.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}