import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import PageHeader from '@/components/shared/PageHeader';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  CreditCard, TrendingUp, Users, DollarSign, Plus, CheckCircle,
  AlertCircle, Clock, Star, Zap, Building2, BarChart3, Edit, Trash2
} from 'lucide-react';

const TIER_COLORS = {
  starter: 'bg-gray-100 text-gray-700',
  growth: 'bg-blue-100 text-blue-700',
  professional: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-yellow-100 text-yellow-800',
};

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-700',
  paused: 'bg-gray-100 text-gray-600',
};

const DEFAULT_PLANS = [
  {
    id: 'plan-starter', name: 'Starter', code: 'starter', tier: 'starter',
    price_monthly: 99, price_annual: 79, seat_limit: 5, storage_gb: 10,
    api_calls_per_month: 10000, trial_days: 14, support_level: 'email', is_popular: false,
    features: ['POS & Inventory', 'Basic Reports', 'Single Location', '5 Users', 'Email Support'],
    modules: ['pos', 'inventory', 'products', 'customers'],
  },
  {
    id: 'plan-growth', name: 'Growth', code: 'growth', tier: 'growth',
    price_monthly: 299, price_annual: 249, seat_limit: 20, storage_gb: 50,
    api_calls_per_month: 50000, trial_days: 14, support_level: 'priority', is_popular: true,
    features: ['Everything in Starter', 'Multi-location', 'AI Forecasting', 'Purchasing & POs', '20 Users', 'Priority Support', 'Supplier Portal'],
    modules: ['pos', 'inventory', 'purchasing', 'analytics', 'forecasting', 'supplier-portal'],
  },
  {
    id: 'plan-professional', name: 'Professional', code: 'professional', tier: 'professional',
    price_monthly: 799, price_annual: 649, seat_limit: 100, storage_gb: 200,
    api_calls_per_month: 250000, trial_days: 14, support_level: 'priority', is_popular: false,
    features: ['Everything in Growth', 'Manufacturing', 'WMS & 3PL', 'TMS', 'Financials', 'Compliance', '100 Users', 'API Access'],
    modules: ['manufacturing', 'wms', '3pl', 'tms', 'financials', 'compliance', 'api-hub'],
  },
  {
    id: 'plan-enterprise', name: 'Enterprise', code: 'enterprise', tier: 'enterprise',
    price_monthly: 0, price_annual: 0, seat_limit: 99999, storage_gb: 10000,
    api_calls_per_month: 99999999, trial_days: 30, support_level: 'dedicated', is_popular: false,
    features: ['Everything in Professional', 'Multi-tenant SaaS', 'White Label', 'AI Copilot', 'Custom Integrations', 'Unlimited Users', 'Dedicated CSM', 'SLA'],
    modules: ['all'],
  },
];

const MRR_DATA = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
  mrr: Math.floor(18000 + i * 3200 + Math.random() * 2000),
  churn: Math.floor(800 + Math.random() * 600),
  new: Math.floor(4000 + i * 400 + Math.random() * 1000),
}));

const SAMPLE_SUBS = [
  { id: 's1', tenant_name: 'Acme Corp', plan_name: 'Professional', status: 'active', seat_count: 24, seat_limit: 100, billing_cycle: 'annual', mrr: 649, current_period_end: '2026-01-01' },
  { id: 's2', tenant_name: 'TechStart Ltd', plan_name: 'Growth', status: 'trialing', seat_count: 4, seat_limit: 20, billing_cycle: 'monthly', mrr: 0, trial_ends_at: '2026-06-21' },
  { id: 's3', tenant_name: 'Global Traders', plan_name: 'Growth', status: 'active', seat_count: 11, seat_limit: 20, billing_cycle: 'monthly', mrr: 299, current_period_end: '2026-07-07' },
  { id: 's4', tenant_name: 'Riverside Medical', plan_name: 'Professional', status: 'past_due', seat_count: 18, seat_limit: 100, billing_cycle: 'monthly', mrr: 799, current_period_end: '2026-06-01' },
  { id: 's5', tenant_name: 'Summit Retail', plan_name: 'Starter', status: 'active', seat_count: 3, seat_limit: 5, billing_cycle: 'monthly', mrr: 99, current_period_end: '2026-07-07' },
];

function PlanCard({ plan, onEdit }) {
  return (
    <Card className={`relative ${plan.is_popular ? 'ring-2 ring-primary' : ''}`}>
      {plan.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground gap-1"><Star className="w-3 h-3" /> Most Popular</Badge>
        </div>
      )}
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <Badge className={`text-xs mb-2 ${TIER_COLORS[plan.tier]}`}>{plan.tier}</Badge>
            <h3 className="font-bold text-lg">{plan.name}</h3>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(plan)}>
            <Edit className="w-3 h-3" />
          </Button>
        </div>

        <div className="mb-4">
          {plan.price_monthly === 0 ? (
            <p className="text-2xl font-bold">Custom</p>
          ) : (
            <>
              <span className="text-3xl font-bold">${plan.price_monthly}</span>
              <span className="text-muted-foreground text-sm">/mo</span>
              {plan.price_annual && (
                <p className="text-xs text-green-600 mt-0.5">${plan.price_annual}/mo billed annually</p>
              )}
            </>
          )}
        </div>

        <div className="space-y-1.5 mb-4">
          {plan.features?.map(f => (
            <div key={f} className="flex items-center gap-2 text-xs">
              <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Seats</span><span className="font-medium">{plan.seat_limit === 99999 ? 'Unlimited' : plan.seat_limit}</span></div>
          <div className="flex justify-between"><span>Storage</span><span className="font-medium">{plan.storage_gb >= 10000 ? 'Unlimited' : `${plan.storage_gb}GB`}</span></div>
          <div className="flex justify-between"><span>API Calls</span><span className="font-medium">{plan.api_calls_per_month >= 9999999 ? 'Unlimited' : `${(plan.api_calls_per_month / 1000).toFixed(0)}K/mo`}</span></div>
          <div className="flex justify-between"><span>Trial</span><span className="font-medium">{plan.trial_days} days</span></div>
          <div className="flex justify-between"><span>Support</span><span className="font-medium capitalize">{plan.support_level}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionRow({ sub }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{sub.tenant_name}</span>
              <Badge className={`text-[10px] ${STATUS_COLORS[sub.status]}`}>{sub.status}</Badge>
              {sub.status === 'past_due' && <AlertCircle className="w-3.5 h-3.5 text-orange-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{sub.plan_name} · {sub.billing_cycle}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Seats</p>
            <p className="text-sm font-medium">{sub.seat_count}/{sub.seat_limit}</p>
            <Progress value={(sub.seat_count / sub.seat_limit) * 100} className="h-1 w-16 mt-1" />
          </div>
          <div className="text-right">
            <p className="font-bold text-green-600">${sub.mrr}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
            <p className="text-[10px] text-muted-foreground">
              {sub.status === 'trialing' ? `Trial until ${sub.trial_ends_at}` : `Renews ${sub.current_period_end}`}
            </p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs">Manage</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BillingPlatform() {
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({ name: '', code: '', tier: 'starter', price_monthly: 0, price_annual: 0, seat_limit: 5, trial_days: 14, support_level: 'email' });
  const qc = useQueryClient();

  const { data: dbPlans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => base44.entities.Plan.list(),
  });
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => base44.entities.Subscription.list('-created_date', 100),
  });

  const savePlanMut = useMutation({
    mutationFn: (d) => editingPlan?.id
      ? base44.entities.Plan.update(editingPlan.id, d)
      : base44.entities.Plan.create(d),
    onSuccess: () => { qc.invalidateQueries(['plans']); setShowNewPlan(false); setEditingPlan(null); },
  });

  const allPlans = DEFAULT_PLANS;
  const allSubs = [...SAMPLE_SUBS, ...subscriptions];

  const metrics = {
    totalMrr: allSubs.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.mrr || 0), 0),
    activeCount: allSubs.filter(s => s.status === 'active').length,
    trialingCount: allSubs.filter(s => s.status === 'trialing').length,
    pastDueCount: allSubs.filter(s => s.status === 'past_due').length,
    arr: allSubs.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.mrr || 0), 0) * 12,
  };

  function openEdit(plan) {
    setEditingPlan(plan);
    setPlanForm(plan);
    setShowNewPlan(true);
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Billing Platform" subtitle="Plans · Subscriptions · MRR · Seat billing · Trial management">
        <Button size="sm" className="gap-2" onClick={() => { setEditingPlan(null); setPlanForm({ name: '', code: '', tier: 'starter', price_monthly: 0, price_annual: 0, seat_limit: 5, trial_days: 14, support_level: 'email' }); setShowNewPlan(true); }}>
          <Plus className="w-4 h-4" /> New Plan
        </Button>
      </PageHeader>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'MRR', value: `$${metrics.totalMrr.toLocaleString()}`, icon: DollarSign, color: 'text-green-600', sub: 'Monthly Recurring Revenue' },
          { label: 'ARR', value: `$${(metrics.arr).toLocaleString()}`, icon: TrendingUp, color: 'text-blue-600', sub: 'Annual Run Rate' },
          { label: 'Active', value: metrics.activeCount, icon: CheckCircle, color: 'text-green-600', sub: 'Active subscriptions' },
          { label: 'Trialing', value: metrics.trialingCount, icon: Clock, color: 'text-blue-600', sub: 'In trial period' },
          { label: 'Past Due', value: metrics.pastDueCount, icon: AlertCircle, color: 'text-orange-600', sub: 'Needs attention' },
        ].map(m => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-[10px] text-muted-foreground">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-3">
          {allSubs.map((sub, i) => <SubscriptionRow key={sub.id || i} sub={sub} />)}
        </TabsContent>

        <TabsContent value="plans">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {allPlans.map(plan => <PlanCard key={plan.id || plan.code} plan={plan} onEdit={openEdit} />)}
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">MRR Growth (12 months)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={MRR_DATA}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => [`$${v.toLocaleString()}`, '']} />
                    <Area type="monotone" dataKey="mrr" stroke="#6366f1" fill="#6366f120" name="MRR" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">New vs Churn Revenue</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={MRR_DATA.slice(-6)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="new" fill="#22c55e" name="New MRR" />
                    <Bar dataKey="churn" fill="#ef4444" name="Churned MRR" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Plan Distribution */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Revenue by Plan</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { plan: 'Enterprise', count: 2, mrr: 8000, pct: 48 },
                  { plan: 'Professional', count: 8, mrr: 6392, pct: 38 },
                  { plan: 'Growth', count: 14, mrr: 1796, pct: 11 },
                  { plan: 'Starter', count: 22, mrr: 495, pct: 3 },
                ].map(row => (
                  <div key={row.plan}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{row.plan} <span className="text-muted-foreground">({row.count} tenants)</span></span>
                      <span>${row.mrr.toLocaleString()}/mo · {row.pct}%</span>
                    </div>
                    <Progress value={row.pct} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plan Dialog */}
      <Dialog open={showNewPlan} onOpenChange={setShowNewPlan}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Plan Name</Label><Input value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Code</Label><Input value={planForm.code} onChange={e => setPlanForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. growth" /></div>
            <div>
              <Label>Tier</Label>
              <Select value={planForm.tier} onValueChange={v => setPlanForm(p => ({ ...p, tier: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['starter','growth','professional','enterprise'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Monthly Price ($)</Label><Input type="number" value={planForm.price_monthly} onChange={e => setPlanForm(p => ({ ...p, price_monthly: +e.target.value }))} /></div>
            <div><Label>Annual Price ($)</Label><Input type="number" value={planForm.price_annual} onChange={e => setPlanForm(p => ({ ...p, price_annual: +e.target.value }))} /></div>
            <div><Label>Seat Limit</Label><Input type="number" value={planForm.seat_limit} onChange={e => setPlanForm(p => ({ ...p, seat_limit: +e.target.value }))} /></div>
            <div><Label>Trial Days</Label><Input type="number" value={planForm.trial_days} onChange={e => setPlanForm(p => ({ ...p, trial_days: +e.target.value }))} /></div>
            <div className="col-span-2">
              <Label>Support Level</Label>
              <Select value={planForm.support_level} onValueChange={v => setPlanForm(p => ({ ...p, support_level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['community','email','priority','dedicated'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowNewPlan(false)}>Cancel</Button>
            <Button onClick={() => savePlanMut.mutate(planForm)} disabled={!planForm.name}>
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}