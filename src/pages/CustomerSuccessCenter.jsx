import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, Users, Star, Calendar, ChevronRight, Zap, Activity } from 'lucide-react';

const MOCK_ACCOUNTS = [
  {
    id: 'h1', tenant_name: 'Acme Corp', overall_score: 92, adoption_score: 95, engagement_score: 88, support_score: 97, financial_score: 90,
    risk_level: 'healthy', active_users: 14, total_licenses: 15, modules_used: ['POS','Inventory','Purchasing','Financials','AI Copilot','Forecasting','Reports'],
    last_login_days_ago: 1, open_tickets: 0, nps_score: 9, mrr: 4200, csm_name: 'Sarah Chen',
    risks: [], recommendations: ['Upsell 3PL module', 'Offer annual contract discount'],
    last_qbr_date: '2026-05-15'
  },
  {
    id: 'h2', tenant_name: 'TechStart Ltd', overall_score: 54, adoption_score: 40, engagement_score: 60, support_score: 75, financial_score: 45,
    risk_level: 'at_risk', active_users: 2, total_licenses: 15, modules_used: ['POS','Inventory'],
    last_login_days_ago: 12, open_tickets: 3, nps_score: 6, mrr: 1800, csm_name: 'Mike Torres',
    risks: ['Only 2/15 licenses active', 'No AI module usage in 45 days', 'Inventory module unused', '3 open support tickets'],
    recommendations: ['Schedule onboarding session immediately', 'Enable AI Insight Hub trial', 'Assign dedicated implementation specialist'],
    last_qbr_date: '2026-03-10'
  },
  {
    id: 'h3', tenant_name: 'Global Traders', overall_score: 71, adoption_score: 68, engagement_score: 78, support_score: 80, financial_score: 60,
    risk_level: 'healthy', active_users: 8, total_licenses: 12, modules_used: ['Inventory','Purchasing','Transfers','Suppliers','Reports'],
    last_login_days_ago: 3, open_tickets: 1, nps_score: 7, mrr: 2900, csm_name: 'Sarah Chen',
    risks: ['Forecasting not activated', 'POS unused despite license'],
    recommendations: ['Demo AI Forecasting at next QBR', 'Train store team on POS workflow'],
    last_qbr_date: '2026-04-22'
  },
  {
    id: 'h4', tenant_name: 'Riverside Medical', overall_score: 23, adoption_score: 15, engagement_score: 20, support_score: 40, financial_score: 18,
    risk_level: 'critical', active_users: 1, total_licenses: 10, modules_used: ['Inventory'],
    last_login_days_ago: 28, open_tickets: 5, nps_score: 4, mrr: 3100, csm_name: 'Mike Torres',
    risks: ['Only 1 user logged in last 30 days', '5 open tickets unresolved', 'No purchasing module activity', 'Trial expired 14 days ago'],
    recommendations: ['URGENT: Executive escalation call', 'Offer 30-day extension', 'Assign implementation rescue plan'],
    last_qbr_date: null
  },
];

const RENEWAL_DATA = [
  { tenant_name: 'Acme Corp', renewal_date: '2026-09-01', current_arr: 50400, forecast_arr: 58000, churn_probability: 3, status: 'on_track', owner: 'Sarah Chen', next_action: 'Annual upsell proposal', next_action_date: '2026-07-15' },
  { tenant_name: 'TechStart Ltd', renewal_date: '2026-07-15', current_arr: 21600, forecast_arr: 14000, churn_probability: 62, status: 'at_risk', owner: 'Mike Torres', next_action: 'Executive rescue call', next_action_date: '2026-06-10' },
  { tenant_name: 'Global Traders', renewal_date: '2026-08-20', current_arr: 34800, forecast_arr: 36000, churn_probability: 18, status: 'on_track', owner: 'Sarah Chen', next_action: 'QBR + module expansion pitch', next_action_date: '2026-07-01' },
  { tenant_name: 'Riverside Medical', renewal_date: '2026-06-30', current_arr: 37200, forecast_arr: 0, churn_probability: 87, status: 'at_risk', owner: 'Mike Torres', next_action: 'URGENT escalation + retention offer', next_action_date: '2026-06-08' },
];

const MRR_TREND = [
  { month: 'Jan', mrr: 9800 }, { month: 'Feb', mrr: 10200 }, { month: 'Mar', mrr: 11000 },
  { month: 'Apr', mrr: 11400 }, { month: 'May', mrr: 12000 }, { month: 'Jun', mrr: 12000 },
];

const RISK_COLOR = { healthy: 'text-green-600', at_risk: 'text-orange-500', critical: 'text-red-600' };
const RISK_BG = { healthy: 'bg-green-50 border-green-200', at_risk: 'bg-orange-50 border-orange-200', critical: 'bg-red-50 border-red-200' };
const STATUS_CLS = { on_track: 'bg-green-100 text-green-700', at_risk: 'bg-orange-100 text-orange-700', churned: 'bg-red-100 text-red-700', renewed: 'bg-blue-100 text-blue-700', expanded: 'bg-purple-100 text-purple-700' };

function ScoreRing({ score, size = 56 }) {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle cx="28" cy="28" r="24" fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${(score / 100) * 150.8} 150.8`} strokeLinecap="round"
        transform="rotate(-90 28 28)" />
      <text x="28" y="33" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

function AccountCard({ account, onSelect, selected }) {
  return (
    <Card className={`cursor-pointer transition-all border-2 ${selected ? 'border-primary' : `border ${RISK_BG[account.risk_level]}`}`} onClick={() => onSelect(account)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <ScoreRing score={account.overall_score} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{account.tenant_name}</span>
              <Badge className={`text-[10px] capitalize ${account.risk_level === 'healthy' ? 'bg-green-100 text-green-700' : account.risk_level === 'at_risk' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                {account.risk_level.replace('_', ' ')}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-1 mt-2 text-xs text-muted-foreground">
              <span>{account.active_users}/{account.total_licenses} users</span>
              <span>{account.modules_used.length} modules</span>
              <span>${(account.mrr / 1000).toFixed(1)}K MRR</span>
            </div>
            {account.risks.length > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
                <AlertTriangle className="w-3 h-3" />
                {account.risks.length} risk{account.risks.length > 1 ? 's' : ''} detected
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

function AccountDetail({ account }) {
  const radarData = [
    { metric: 'Adoption', value: account.adoption_score },
    { metric: 'Engagement', value: account.engagement_score },
    { metric: 'Support', value: account.support_score },
    { metric: 'Financial', value: account.financial_score },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={account.overall_score} size={72} />
        <div>
          <h3 className="font-bold text-lg">{account.tenant_name}</h3>
          <p className="text-sm text-muted-foreground">CSM: {account.csm_name} · NPS: {account.nps_score}/10</p>
          <p className="text-sm text-muted-foreground">Last login: {account.last_login_days_ago}d ago · {account.open_tickets} open tickets</p>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
            <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Modules Active</p>
        <div className="flex flex-wrap gap-1">
          {account.modules_used.map(m => <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>)}
        </div>
      </div>

      {account.risks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-600 uppercase mb-1">Risks</p>
          {account.risks.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-red-700 mb-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />{r}
            </div>
          ))}
        </div>
      )}

      {account.recommendations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Recommendations</p>
          {account.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-blue-700 mb-1">
              <Zap className="w-3 h-3 mt-0.5 flex-shrink-0" />{r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CustomerSuccessCenter() {
  const [selected, setSelected] = useState(MOCK_ACCOUNTS[1]);

  const totalMRR = MOCK_ACCOUNTS.reduce((s, a) => s + a.mrr, 0);
  const atRisk = MOCK_ACCOUNTS.filter(a => a.risk_level !== 'healthy').length;
  const avgScore = Math.round(MOCK_ACCOUNTS.reduce((s, a) => s + a.overall_score, 0) / MOCK_ACCOUNTS.length);
  const churnARR = RENEWAL_DATA.filter(r => r.churn_probability > 50).reduce((s, r) => s + r.current_arr, 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Customer Success Center" subtitle="Health scoring · Churn prediction · Renewal tracking · Adoption monitoring" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Health Score', value: avgScore, color: 'text-blue-600', icon: Activity },
          { label: 'Monthly MRR', value: `$${(totalMRR / 1000).toFixed(1)}K`, color: 'text-green-600', icon: TrendingUp },
          { label: 'Accounts At Risk', value: atRisk, color: 'text-orange-600', icon: AlertTriangle },
          { label: 'ARR At Churn Risk', value: `$${(churnARR / 1000).toFixed(0)}K`, color: 'text-red-600', icon: TrendingDown },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <k.icon className={`w-8 h-8 ${k.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Account Health</TabsTrigger>
          <TabsTrigger value="renewals">Renewal Pipeline</TabsTrigger>
          <TabsTrigger value="mrr">MRR Trend</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {MOCK_ACCOUNTS.sort((a, b) => a.overall_score - b.overall_score).map(a => (
                <AccountCard key={a.id} account={a} selected={selected?.id === a.id} onSelect={setSelected} />
              ))}
            </div>
            <div>
              {selected && (
                <Card className="sticky top-4">
                  <CardContent className="p-5"><AccountDetail account={selected} /></CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="renewals">
          <div className="space-y-3">
            {RENEWAL_DATA.sort((a, b) => new Date(a.renewal_date) - new Date(b.renewal_date)).map((r, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm">{r.tenant_name}</span>
                        <Badge className={`text-[10px] ${STATUS_CLS[r.status]}`}>{r.status.replace('_',' ')}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">Renews {r.renewal_date}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                        <div><span className="text-muted-foreground">Current ARR: </span><strong>${(r.current_arr / 1000).toFixed(0)}K</strong></div>
                        <div><span className="text-muted-foreground">Forecast ARR: </span><strong className={r.forecast_arr < r.current_arr ? 'text-red-600' : 'text-green-600'}>${(r.forecast_arr / 1000).toFixed(0)}K</strong></div>
                        <div><span className="text-muted-foreground">Owner: </span>{r.owner}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Churn risk:</span>
                        <div className="flex-1 max-w-32">
                          <Progress value={r.churn_probability} className="h-1.5" />
                        </div>
                        <span className={`text-xs font-bold ${r.churn_probability > 50 ? 'text-red-600' : r.churn_probability > 25 ? 'text-orange-500' : 'text-green-600'}`}>{r.churn_probability}%</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">Next Action</p>
                      <p className="text-xs font-medium max-w-40 text-right">{r.next_action}</p>
                      <p className="text-xs text-muted-foreground">{r.next_action_date}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="mrr">
          <Card>
            <CardHeader><CardTitle className="text-sm">Monthly Recurring Revenue</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={MRR_TREND}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={v => [`$${v.toLocaleString()}`, 'MRR']} />
                    <Line type="monotone" dataKey="mrr" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}