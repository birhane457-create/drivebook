import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Brain, DollarSign, Zap, TrendingUp, AlertTriangle, Star, Clock, CheckCircle } from 'lucide-react';

const DAILY_USAGE = [
  { date: 'Jun 1', tokens: 124000, cost: 1.86, calls: 312 },
  { date: 'Jun 2', tokens: 98000,  cost: 1.47, calls: 245 },
  { date: 'Jun 3', tokens: 87000,  cost: 1.31, calls: 218 },
  { date: 'Jun 4', tokens: 152000, cost: 2.28, calls: 380 },
  { date: 'Jun 5', tokens: 190000, cost: 2.85, calls: 475 },
  { date: 'Jun 6', tokens: 178000, cost: 2.67, calls: 445 },
  { date: 'Jun 7', tokens: 210000, cost: 3.15, calls: 525 },
];

const BY_FEATURE = [
  { feature: 'AI Copilot',         tokens: 480000, cost: 7.20, calls: 1200, avg_latency: 1240, success_rate: 98.2, avg_rating: 4.3 },
  { feature: 'AI Insight Hub',     tokens: 210000, cost: 3.15, calls: 280,  avg_latency: 2100, success_rate: 99.1, avg_rating: 4.6 },
  { feature: 'AI Forecasting',     tokens: 180000, cost: 2.70, calls: 95,   avg_latency: 4200, success_rate: 97.4, avg_rating: 4.2 },
  { feature: 'Doc Extraction',     tokens: 95000,  cost: 1.43, calls: 380,  avg_latency: 980,  success_rate: 96.0, avg_rating: 4.0 },
  { feature: 'Image Generation',   tokens: 40000,  cost: 0.60, calls: 40,   avg_latency: 8100, success_rate: 100,  avg_rating: 4.7 },
];

const BY_TENANT = [
  { name: 'Acme Corp',         tokens: 420000, cost: 6.30, fill: '#6366f1' },
  { name: 'Global Traders',    tokens: 285000, cost: 4.28, fill: '#8b5cf6' },
  { name: 'TechStart Ltd',     tokens: 180000, cost: 2.70, fill: '#a78bfa' },
  { name: 'Riverside Medical', tokens: 120000, cost: 1.80, fill: '#c4b5fd' },
];

const MODELS = [
  { model: 'gpt-4o-mini',        calls: 1800, avg_tokens: 420, cost_per_1k: 0.0015, avg_latency: 890,  quality: 4.1 },
  { model: 'gpt-4o',             calls: 340,  avg_tokens: 1240, cost_per_1k: 0.015, avg_latency: 1800, quality: 4.7 },
  { model: 'claude-sonnet',      calls: 60,   avg_tokens: 2100, cost_per_1k: 0.012, avg_latency: 1400, quality: 4.8 },
];

const BUDGET = { monthly_limit: 150, spent: 93.40, period: 'June 2026' };

const COLORS = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd'];

export default function AIOps() {
  const [period, setPeriod] = useState('7d');

  const totalTokens = DAILY_USAGE.reduce((s, d) => s + d.tokens, 0);
  const totalCost = DAILY_USAGE.reduce((s, d) => s + d.cost, 0);
  const totalCalls = DAILY_USAGE.reduce((s, d) => s + d.calls, 0);
  const budgetPct = Math.round((BUDGET.spent / BUDGET.monthly_limit) * 100);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="AI Operations (AIOps)" subtitle="Token usage · Cost tracking · Model analytics · Response quality · Budget management" />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Tokens (7d)', value: `${(totalTokens/1000).toFixed(0)}K`,   color: 'text-purple-600', icon: Brain },
          { label: 'Total Cost (7d)',   value: `$${totalCost.toFixed(2)}`,             color: 'text-green-600',  icon: DollarSign },
          { label: 'Total Calls (7d)', value: totalCalls.toLocaleString(),             color: 'text-blue-600',   icon: Zap },
          { label: 'Avg Latency',      value: '1.4s',                                  color: 'text-orange-600', icon: Clock },
          { label: 'Success Rate',     value: '98.1%',                                 color: 'text-green-600',  icon: CheckCircle },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-7 h-7 ${s.color}`} />
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-xl font-bold ${s.color}`}>{s.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget Bar */}
      <Card className={`border-2 ${budgetPct > 80 ? 'border-orange-300 bg-orange-50' : 'border-border'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-semibold text-sm">Monthly AI Budget — {BUDGET.period}</p>
              <p className="text-xs text-muted-foreground">${BUDGET.spent.toFixed(2)} spent of ${BUDGET.monthly_limit} limit</p>
            </div>
            <span className={`text-2xl font-bold ${budgetPct > 80 ? 'text-orange-600' : 'text-green-600'}`}>{budgetPct}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div className={`h-3 rounded-full transition-all ${budgetPct > 80 ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${budgetPct}%` }} />
          </div>
          {budgetPct > 80 && <p className="text-xs text-orange-600 mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Approaching monthly limit. Consider increasing budget or optimizing prompts.</p>}
        </CardContent>
      </Card>

      <Tabs defaultValue="usage">
        <TabsList>
          <TabsTrigger value="usage">Usage Trends</TabsTrigger>
          <TabsTrigger value="features">By Feature</TabsTrigger>
          <TabsTrigger value="models">Model Comparison</TabsTrigger>
          <TabsTrigger value="tenants">By Tenant</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Token Usage</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={DAILY_USAGE}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => [`${(v/1000).toFixed(0)}K tokens`]} />
                  <Bar dataKey="tokens" fill="#6366f1" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Cost ($)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={DAILY_USAGE}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={v => [`$${v}`]} />
                  <Line dataKey="cost" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <div className="space-y-3">
            {BY_FEATURE.map(f => (
              <Card key={f.feature}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="font-medium text-sm">{f.feature}</p>
                    <div className="flex gap-4 text-xs">
                      <span className="text-muted-foreground">Tokens: <strong className="text-foreground">{(f.tokens/1000).toFixed(0)}K</strong></span>
                      <span className="text-muted-foreground">Cost: <strong className="text-green-600">${f.cost.toFixed(2)}</strong></span>
                      <span className="text-muted-foreground">Calls: <strong className="text-foreground">{f.calls}</strong></span>
                      <span className="text-muted-foreground">Latency: <strong className="text-foreground">{f.avg_latency}ms</strong></span>
                      <span className="text-muted-foreground">Success: <strong className={f.success_rate < 98 ? 'text-orange-600' : 'text-green-600'}>{f.success_rate}%</strong></span>
                      <span className="flex items-center gap-0.5 text-yellow-600"><Star className="w-3 h-3" /><strong>{f.avg_rating}</strong></span>
                    </div>
                  </div>
                  <div className="mt-2 bg-muted rounded-full h-1.5">
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${(f.tokens / 480000) * 100}%` }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="models" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MODELS.map(m => (
              <Card key={m.model}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-500" />
                    <code className="font-mono text-xs">{m.model}</code>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: 'Total Calls',   value: m.calls.toLocaleString() },
                    { label: 'Avg Tokens',    value: m.avg_tokens.toLocaleString() },
                    { label: 'Cost/1K tokens',value: `$${m.cost_per_1k}` },
                    { label: 'Avg Latency',   value: `${m.avg_latency}ms` },
                    { label: 'Quality Score', value: <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" />{m.quality}</span> },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Token Distribution by Tenant</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={BY_TENANT} dataKey="tokens" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name.split(' ')[0]} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {BY_TENANT.map((e, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={v => [`${(v/1000).toFixed(0)}K tokens`]} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <div className="space-y-3">
              {BY_TENANT.map((t, i) => (
                <Card key={t.name}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{(t.tokens/1000).toFixed(0)}K tokens</p>
                    </div>
                    <p className="font-bold text-green-600 text-sm">${t.cost.toFixed(2)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}