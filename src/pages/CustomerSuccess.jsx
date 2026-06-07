import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Users,
  Calendar, DollarSign, Zap, ChevronRight, Star, Activity,
  RefreshCw, Target, Heart
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

const SAMPLE_ACCOUNTS = [
  {
    id: 'h1', tenant_name: 'Acme Corp', overall_score: 91, adoption_score: 95, engagement_score: 88,
    support_score: 90, financial_score: 92, risk_level: 'healthy',
    active_users: 14, total_licenses: 15, mrr: 4200,
    modules_used: ['POS','Inventory','Purchasing','Financials','AI Copilot','Reports','Manufacturing'],
    last_login_days_ago: 0, open_tickets: 1, nps_score: 9,
    csm_name: 'Sarah Kim', last_qbr_date: '2026-04-15',
    risks: [], recommendations: ['Upsell AI Insight Hub', 'Propose annual contract for 10% discount'],
  },
  {
    id: 'h2', tenant_name: 'TechStart Ltd', overall_score: 67, adoption_score: 45, engagement_score: 72,
    support_score: 80, financial_score: 70, risk_level: 'at_risk',
    active_users: 2, total_licenses: 15, mrr: 1800,
    modules_used: ['POS','Inventory'],
    last_login_days_ago: 8, open_tickets: 3, nps_score: 6,
    csm_name: 'James Park', last_qbr_date: '2026-02-10',
    risks: ['Only 2 of 15 licenses active', 'No forecasting usage in 45 days', 'Inventory module 60% unused capacity', '3 open support tickets unresolved'],
    recommendations: ['Schedule onboarding session for new users', 'Enable AI Insight Hub trial', 'Activate forecasting workflow', 'Assign dedicated onboarding specialist'],
  },
  {
    id: 'h3', tenant_name: 'Global Traders', overall_score: 83, adoption_score: 80, engagement_score: 85,
    support_score: 88, financial_score: 78, risk_level: 'healthy',
    active_users: 9, total_licenses: 12, mrr: 3600,
    modules_used: ['POS','Inventory','Purchasing','TMS','3PL','Reports'],
    last_login_days_ago: 1, open_tickets: 0, nps_score: 8,
    csm_name: 'Sarah Kim', last_qbr_date: '2026-05-01',
    risks: ['Manufacturing module untouched'], recommendations: ['Introduce Manufacturing module walkthrough'],
  },
  {
    id: 'h4', tenant_name: 'Riverside Medical', overall_score: 34, adoption_score: 20, engagement_score: 30,
    support_score: 55, financial_score: 30, risk_level: 'critical',
    active_users: 1, total_licenses: 8, mrr: 1200,
    modules_used: ['Inventory'],
    last_login_days_ago: 22, open_tickets: 5, nps_score: 4,
    csm_name: 'James Park', last_qbr_date: null,
    risks: ['Last login 22 days ago', 'Only 1 of 8 users active', 'No QBR conducted', '5 open critical tickets', 'Payment overdue 14 days'],
    recommendations: ['Executive escalation call required', 'Offer free implementation consulting', 'Waive next month fee to retain', 'Assign senior CSM immediately'],
  },
];

const RENEWALS = [
  { id: 'r1', tenant_name: 'Acme Corp',       renewal_date: '2026-09-01', current_arr: 50400, forecast_arr: 58000, churn_probability: 4,  expansion_probability: 75, status: 'on_track', owner: 'Sarah Kim',  next_action: 'Send expansion proposal', next_action_date: '2026-06-15' },
  { id: 'r2', tenant_name: 'TechStart Ltd',    renewal_date: '2026-07-15', current_arr: 21600, forecast_arr: 18000, churn_probability: 38, expansion_probability: 10, status: 'at_risk',  owner: 'James Park', next_action: 'QBR recovery call',        next_action_date: '2026-06-10' },
  { id: 'r3', tenant_name: 'Global Traders',   renewal_date: '2026-08-01', current_arr: 43200, forecast_arr: 46000, churn_probability: 8,  expansion_probability: 40, status: 'on_track', owner: 'Sarah Kim',  next_action: 'Send renewal paperwork',   next_action_date: '2026-07-01' },
  { id: 'r4', tenant_name: 'Riverside Medical',renewal_date: '2026-06-30', current_arr: 14400, forecast_arr: 8000,  churn_probability: 72, expansion_probability: 2,  status: 'at_risk',  owner: 'James Park', next_action: 'Executive escalation',     next_action_date: '2026-06-08' },
];

const RISK_COLOR = { healthy: 'text-green-600', at_risk: 'text-yellow-600', critical: 'text-red-600' };
const RISK_BG   = { healthy: 'bg-green-50 border-green-200', at_risk: 'bg-yellow-50 border-yellow-200', critical: 'bg-red-50 border-red-200' };
const STATUS_CLS = { on_track: 'bg-green-100 text-green-700', at_risk: 'bg-orange-100 text-orange-700', churned: 'bg-red-100 text-red-700', renewed: 'bg-blue-100 text-blue-700', expanded: 'bg-purple-100 text-purple-700' };

function ScoreGauge({ score }) {
  const color = score >= 80 ? 'text-green-600' : score >= 55 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`text-4xl font-bold ${color}`}>{score}</span>;
}

function AccountCard({ account, onSelect, selected }) {
  return (
    <Card
      className={`border cursor-pointer transition-all ${RISK_BG[account.risk_level]} ${selected ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
      onClick={() => onSelect(account)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">{account.tenant_name}</p>
            <p className="text-xs text-muted-foreground">{account.csm_name} · ${account.mrr.toLocaleString()}/mo</p>
          </div>
          <ScoreGauge score={account.overall_score} />
        </div>
        <Progress value={account.overall_score} className="h-1.5 mt-2" />
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{account.active_users}/{account.total_licenses}</span>
          <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{account.modules_used.length} modules</span>
          {account.last_login_days_ago > 0 && <span className="text-orange-600">{account.last_login_days_ago}d ago</span>}
        </div>
        {account.risks.length > 0 && (
          <p className="text-[10px] text-red-600 mt-1.5 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" /> {account.risks.length} risk{account.risks.length > 1 ? 's' : ''} detected
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AccountDetail({ account }) {
  const radarData = [
    { metric: 'Adoption',    value: account.adoption_score },
    { metric: 'Engagement',  value: account.engagement_score },
    { metric: 'Support',     value: account.support_score },
    { metric: 'Financial',   value: account.financial_score },
  ];
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{account.tenant_name}</CardTitle>
            <p className="text-sm text-muted-foreground">{account.csm_name} · Last QBR: {account.last_qbr_date || 'None'}</p>
          </div>
          <div className="text-right">
            <ScoreGauge score={account.overall_score} />
            <p className="text-xs text-muted-foreground">/100 Health</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <Radar dataKey="value" fill="#6366f1" fillOpacity={0.3} stroke="#6366f1" />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted rounded p-2"><p className="text-xs text-muted-foreground">MRR</p><p className="font-bold text-sm">${account.mrr.toLocaleString()}</p></div>
          <div className="bg-muted rounded p-2"><p className="text-xs text-muted-foreground">NPS</p><p className="font-bold text-sm">{account.nps_score ?? '—'}</p></div>
          <div className="bg-muted rounded p-2"><p className="text-xs text-muted-foreground">Tickets</p><p className={`font-bold text-sm ${account.open_tickets > 2 ? 'text-red-600' : ''}`}>{account.open_tickets}</p></div>
        </div>
        {account.risks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Risks</p>
            <ul className="space-y-1">{account.risks.map((r, i) => <li key={i} className="text-xs bg-red-50 border border-red-100 rounded px-2 py-1">{r}</li>)}</ul>
          </div>
        )}
        {account.recommendations.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-blue-600 mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3" /> Recommended Actions</p>
            <ol className="space-y-1">{account.recommendations.map((r, i) => <li key={i} className="text-xs flex gap-2"><span className="font-bold text-primary w-4">{i+1}.</span>{r}</li>)}</ol>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold mb-1">Modules Active</p>
          <div className="flex flex-wrap gap-1">{account.modules_used.map(m => <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerSuccess() {
  const [selected, setSelected] = useState(SAMPLE_ACCOUNTS[1]);

  const totalMRR = SAMPLE_ACCOUNTS.reduce((s, a) => s + a.mrr, 0);
  const avgScore = Math.round(SAMPLE_ACCOUNTS.reduce((s, a) => s + a.overall_score, 0) / SAMPLE_ACCOUNTS.length);
  const atRisk = SAMPLE_ACCOUNTS.filter(a => a.risk_level !== 'healthy').length;
  const renewalMRR = RENEWALS.filter(r => r.status === 'at_risk').reduce((s, r) => s + r.current_arr / 12, 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Customer Success Center" subtitle="Health scoring · Churn prediction · Renewal tracking · Expansion signals" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total MRR',    value: `$${(totalMRR/1000).toFixed(1)}K`, color: 'text-green-600',  icon: DollarSign },
          { label: 'Avg Health',   value: avgScore,                           color: avgScore>=75?'text-green-600':'text-yellow-600', icon: Heart },
          { label: 'At Risk',      value: atRisk,                             color: 'text-orange-600', icon: AlertTriangle },
          { label: 'MRR at Risk',  value: `$${Math.round(renewalMRR/100)*100}`, color: 'text-red-600', icon: TrendingDown },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health">Account Health</TabsTrigger>
          <TabsTrigger value="renewals">Renewals Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="health">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <div className="space-y-3">
              {SAMPLE_ACCOUNTS.map(a => <AccountCard key={a.id} account={a} selected={selected?.id === a.id} onSelect={setSelected} />)}
            </div>
            <div className="lg:col-span-2">
              {selected && <AccountDetail account={selected} />}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="renewals" className="mt-4 space-y-3">
          {RENEWALS.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{r.tenant_name}</span>
                      <Badge className={`text-[10px] ${STATUS_CLS[r.status]}`}>{r.status.replace('_',' ')}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Renews {r.renewal_date} · Owner: {r.owner}</p>
                    <p className="text-xs mt-1.5 flex items-center gap-1 text-blue-600"><ChevronRight className="w-3 h-3" />{r.next_action} <span className="text-muted-foreground">by {r.next_action_date}</span></p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div><p className="text-xs text-muted-foreground">Current ARR</p><p className="font-bold">${r.current_arr.toLocaleString()}</p></div>
                    <div><p className="text-xs text-muted-foreground">Forecast ARR</p><p className={`font-bold ${r.forecast_arr >= r.current_arr ? 'text-green-600' : 'text-red-600'}`}>${r.forecast_arr.toLocaleString()}</p></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Churn Risk</p>
                      <p className={`font-bold ${r.churn_probability > 30 ? 'text-red-600' : 'text-green-600'}`}>{r.churn_probability}%</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Expansion probability:</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5"><div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${r.expansion_probability}%` }} /></div>
                  <span className="text-[10px] font-medium">{r.expansion_probability}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}