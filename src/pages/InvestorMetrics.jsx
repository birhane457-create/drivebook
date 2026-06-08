import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Zap,
  BarChart3, Target, Heart, Activity, Globe2, Puzzle, Brain
} from 'lucide-react';

// --- Simulated data ---
const MRR_HISTORY = [
  { month: 'Jan', mrr: 10200, arr: 122400, new_mrr: 2100, churn_mrr: 300 },
  { month: 'Feb', mrr: 11800, arr: 141600, new_mrr: 1900, churn_mrr: 300 },
  { month: 'Mar', mrr: 13400, arr: 160800, new_mrr: 2200, churn_mrr: 600 },
  { month: 'Apr', mrr: 14900, arr: 178800, new_mrr: 1800, churn_mrr: 300 },
  { month: 'May', mrr: 16500, arr: 198000, new_mrr: 2000, churn_mrr: 400 },
  { month: 'Jun', mrr: 18100, arr: 217200, new_mrr: 2200, churn_mrr: 600 },
];

const TENANT_GROWTH = [
  { month: 'Jan', tenants: 18, trialing: 4, churned: 0 },
  { month: 'Feb', tenants: 21, trialing: 6, churned: 1 },
  { month: 'Mar', tenants: 26, trialing: 5, churned: 0 },
  { month: 'Apr', tenants: 30, trialing: 7, churned: 1 },
  { month: 'May', tenants: 34, trialing: 8, churned: 0 },
  { month: 'Jun', tenants: 38, trialing: 9, churned: 1 },
];

const API_USAGE = [
  { month: 'Jan', calls: 1200000, ai_tokens: 4200000, errors: 1200 },
  { month: 'Feb', calls: 1500000, ai_tokens: 5800000, errors: 980 },
  { month: 'Mar', calls: 1900000, ai_tokens: 7100000, errors: 1100 },
  { month: 'Apr', calls: 2300000, ai_tokens: 9400000, errors: 870 },
  { month: 'May', calls: 2900000, ai_tokens: 12100000, errors: 760 },
  { month: 'Jun', calls: 3500000, ai_tokens: 15800000, errors: 640 },
];

const MARKETPLACE_REV = [
  { month: 'Jan', revenue: 1400, plugins: 8 },
  { month: 'Feb', revenue: 2100, plugins: 11 },
  { month: 'Mar', revenue: 3200, plugins: 14 },
  { month: 'Apr', revenue: 4100, plugins: 18 },
  { month: 'May', revenue: 5600, plugins: 22 },
  { month: 'Jun', revenue: 7200, plugins: 27 },
];

const PLAN_MIX = [
  { name: 'Starter', value: 14, color: '#94a3b8' },
  { name: 'Growth', value: 12, color: '#6366f1' },
  { name: 'Enterprise', value: 8, color: '#8b5cf6' },
  { name: 'Enterprise+', value: 4, color: '#f59e0b' },
];

const MATURITY = [
  { area: 'Functional Breadth', score: 10 },
  { area: 'SaaS Readiness', score: 10 },
  { area: 'Enterprise Features', score: 10 },
  { area: 'AI Capabilities', score: 9.5 },
  { area: 'Extensibility', score: 10 },
  { area: 'Commercialization', score: 9.5 },
  { area: 'Operational Readiness', score: 8 },
];

const fmt = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;
const fmtNum = (n) => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}K` : n;

function Metric({ label, value, sub, trend, icon: Icon, color = 'text-primary' }) {
  const isUp = trend?.startsWith('+');
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${isUp ? 'text-green-600' : 'text-red-500'}`}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend} MoM
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InvestorMetrics() {
  const latest = MRR_HISTORY[MRR_HISTORY.length - 1];
  const prev = MRR_HISTORY[MRR_HISTORY.length - 2];
  const mrrGrowth = `+${(((latest.mrr - prev.mrr) / prev.mrr) * 100).toFixed(1)}%`;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investor & Sales Metrics</h1>
          <p className="text-muted-foreground mt-1">Real-time SaaS business performance — June 2026</p>
        </div>
        <Badge className="bg-green-100 text-green-700 border-0 px-3 py-1.5 text-sm">
          <Activity className="w-3.5 h-3.5 mr-1.5" />
          Live Dashboard
        </Badge>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="MRR" value={fmt(latest.mrr)} sub={`ARR: ${fmt(latest.arr)}`} trend={mrrGrowth} icon={DollarSign} />
        <Metric label="Active Tenants" value="38" sub="9 in trial" trend="+4" icon={Users} />
        <Metric label="NRR" value="118%" sub="Net Revenue Retention" trend="+3pp" icon={TrendingUp} />
        <Metric label="Churn Rate" value="1.4%" sub="Monthly tenant churn" trend="-0.3pp" icon={Heart} color="text-red-500" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="CAC" value="$8,200" sub="Avg cost to acquire" trend="-$400" icon={Target} />
        <Metric label="LTV" value="$124,000" sub="Avg lifetime value" trend="+$6,000" icon={TrendingUp} />
        <Metric label="LTV:CAC" value="15.1x" sub="Target: >3x" trend="+0.4x" icon={BarChart3} />
        <Metric label="Payback Period" value="7.2 mo" sub="Time to recover CAC" trend="-0.4 mo" icon={Zap} />
      </div>

      <Tabs defaultValue="revenue">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="usage">API & AI Usage</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="maturity">Maturity Score</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4 pt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">MRR Growth</CardTitle>
                <CardDescription>Monthly recurring revenue trend</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={MRR_HISTORY}>
                    <defs>
                      <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `$${v/1000}K`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => [`$${v.toLocaleString()}`, 'MRR']} />
                    <Area type="monotone" dataKey="mrr" stroke="#6366f1" strokeWidth={2} fill="url(#mrrGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">New vs Churned MRR</CardTitle>
                <CardDescription>Monthly expansion and contraction</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={MRR_HISTORY}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="new_mrr" fill="#22c55e" name="New MRR" radius={[3,3,0,0]} />
                    <Bar dataKey="churn_mrr" fill="#f87171" name="Churned MRR" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Plan Mix</CardTitle>
              <CardDescription>Active tenants by subscription tier</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-center gap-6">
              <ResponsiveContainer width={220} height={180}>
                <PieChart>
                  <Pie data={PLAN_MIX} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                    {PLAN_MIX.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {PLAN_MIX.map(p => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold">{p.value}</span>
                      <span className="text-xs text-muted-foreground ml-1">tenants</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tenants Tab */}
        <TabsContent value="tenants" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tenant Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={TENANT_GROWTH}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="tenants" fill="#6366f1" name="Active Tenants" radius={[3,3,0,0]} />
                  <Bar dataKey="trialing" fill="#a5b4fc" name="Trialing" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-4 pt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">API Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={API_USAGE}>
                    <defs>
                      <linearGradient id="apiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => fmtNum(v)} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => [fmtNum(v), 'API Calls']} />
                    <Area type="monotone" dataKey="calls" stroke="#06b6d4" strokeWidth={2} fill="url(#apiGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-500" />
                  AI Token Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={API_USAGE}>
                    <defs>
                      <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => fmtNum(v)} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => [fmtNum(v), 'AI Tokens']} />
                    <Area type="monotone" dataKey="ai_tokens" stroke="#8b5cf6" strokeWidth={2} fill="url(#aiGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Marketplace Tab */}
        <TabsContent value="marketplace" className="space-y-4 pt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Puzzle className="w-4 h-4 text-primary" />
                  Marketplace Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={MARKETPLACE_REV}>
                    <defs>
                      <linearGradient id="mktGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => [`$${v}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fill="url(#mktGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Plugin Catalog Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={MARKETPLACE_REV}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="plugins" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} name="Plugins Published" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Maturity Score Tab */}
        <TabsContent value="maturity" className="pt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Platform Maturity Score</CardTitle>
                <CardDescription>Assessment across 7 dimensions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {MATURITY.map(m => (
                  <div key={m.area}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium">{m.area}</span>
                      <span className={`font-bold ${m.score >= 10 ? 'text-green-600' : m.score >= 9 ? 'text-blue-600' : 'text-yellow-600'}`}>
                        {m.score}/10
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${m.score >= 10 ? 'bg-green-500' : m.score >= 9 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                        style={{ width: `${m.score * 10}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="font-semibold">Overall Score</span>
                    <span className="font-bold text-lg text-primary">
                      {(MATURITY.reduce((a, m) => a + m.score, 0) / MATURITY.length).toFixed(1)}/10
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Remaining Work</CardTitle>
                <CardDescription>Path to production deployment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Data Quality & Seeding', pct: 70, priority: 'High' },
                  { label: 'Security Validation', pct: 65, priority: 'Critical' },
                  { label: 'Performance Tuning', pct: 55, priority: 'High' },
                  { label: 'Integration Testing', pct: 60, priority: 'High' },
                  { label: 'Documentation', pct: 40, priority: 'Medium' },
                  { label: 'Sales Enablement', pct: 80, priority: 'High' },
                  { label: 'Customer Onboarding', pct: 75, priority: 'Medium' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${item.priority === 'Critical' ? 'border-red-200 text-red-600' : item.priority === 'High' ? 'border-orange-200 text-orange-600' : 'border-blue-200 text-blue-600'}`}>
                          {item.priority}
                        </Badge>
                        <span className="text-muted-foreground">{item.pct}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}