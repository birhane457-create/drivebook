import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShieldCheck, Zap, BookOpen, FlaskConical, Users, CreditCard,
  CheckCircle2, AlertTriangle, XCircle, TrendingUp, RefreshCw,
  Target, Clock, ArrowRight, Star, Activity
} from 'lucide-react';

const PILLARS = [
  {
    id: 'security', label: 'Security', score: 95, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50',
    items: [
      { label: 'RBAC & IAM configured', status: 'pass' },
      { label: 'Tenant data isolation verified', status: 'pass' },
      { label: 'API key rotation policy', status: 'pass' },
      { label: 'Secrets management (vault)', status: 'pass' },
      { label: 'SQL injection / XSS hardening', status: 'pass' },
      { label: 'Penetration test completed', status: 'warn' },
      { label: 'SOC2 evidence package', status: 'warn' },
    ]
  },
  {
    id: 'performance', label: 'Performance', score: 90, icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50',
    items: [
      { label: 'API p95 latency < 300ms', status: 'pass' },
      { label: 'Database query optimisation', status: 'pass' },
      { label: 'CDN & static asset caching', status: 'pass' },
      { label: 'Load test: 1,000 concurrent users', status: 'pass' },
      { label: 'Load test: 10,000 concurrent users', status: 'warn' },
      { label: 'Mobile performance score > 90', status: 'warn' },
    ]
  },
  {
    id: 'documentation', label: 'Documentation', score: 88, icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50',
    items: [
      { label: 'Admin Guide complete', status: 'pass' },
      { label: 'User Guide complete', status: 'pass' },
      { label: 'API Reference (OpenAPI)', status: 'pass' },
      { label: 'Developer Guide', status: 'warn' },
      { label: 'Implementation Guide', status: 'warn' },
      { label: 'Video walkthroughs', status: 'fail' },
    ]
  },
  {
    id: 'testing', label: 'Testing', score: 91, icon: FlaskConical, color: 'text-orange-600', bg: 'bg-orange-50',
    items: [
      { label: 'Smoke test suite: 100% pass', status: 'pass' },
      { label: 'Regression suite: 94% pass', status: 'pass' },
      { label: 'API contract tests', status: 'pass' },
      { label: 'AI workflow tests', status: 'pass' },
      { label: 'Tenant isolation tests', status: 'pass' },
      { label: 'End-to-end purchase flow', status: 'warn' },
    ]
  },
  {
    id: 'onboarding', label: 'Onboarding', score: 96, icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50',
    items: [
      { label: 'Self-service signup flow', status: 'pass' },
      { label: 'Guided onboarding wizard', status: 'pass' },
      { label: 'Demo environment ready', status: 'pass' },
      { label: 'Sample data seeder', status: 'pass' },
      { label: 'In-app help tooltips', status: 'pass' },
      { label: 'First-run experience tested', status: 'warn' },
    ]
  },
  {
    id: 'billing', label: 'Billing', score: 100, icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50',
    items: [
      { label: 'Subscription plans configured', status: 'pass' },
      { label: 'Trial → paid conversion flow', status: 'pass' },
      { label: 'Invoice generation', status: 'pass' },
      { label: 'Dunning & failed payment handling', status: 'pass' },
      { label: 'Usage-based billing hooks', status: 'pass' },
      { label: 'Tax rules configured', status: 'pass' },
    ]
  },
];

const STATUS_ICON = {
  pass: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  warn: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  fail: <XCircle className="w-4 h-4 text-red-500" />,
};

const STATUS_LABEL = { pass: 'Done', warn: 'In Progress', fail: 'Blocked' };
const STATUS_BADGE = {
  pass: 'bg-green-100 text-green-700',
  warn: 'bg-yellow-100 text-yellow-700',
  fail: 'bg-red-100 text-red-700',
};

export default function LaunchReadiness() {
  const [selected, setSelected] = useState('security');
  const overall = Math.round(PILLARS.reduce((a, p) => a + p.score, 0) / PILLARS.length);
  const pillar = PILLARS.find(p => p.id === selected);
  const Icon = pillar.icon;

  const getColor = (score) =>
    score >= 95 ? 'text-green-600' : score >= 85 ? 'text-blue-600' : score >= 70 ? 'text-yellow-600' : 'text-red-600';
  const getBarColor = (score) =>
    score >= 95 ? 'bg-green-500' : score >= 85 ? 'bg-blue-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Launch Readiness Center</h1>
          <p className="text-muted-foreground mt-1">CEO / CPO dashboard — track readiness across all dimensions before v1.0</p>
        </div>
        <Button variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Refresh Scores</Button>
      </div>

      {/* Overall Score */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground mb-1">Overall Launch Readiness</p>
              <p className="text-7xl font-black text-primary">{overall}%</p>
              <Badge className="mt-2 bg-primary/10 text-primary border-0 px-3 py-1">
                <Activity className="w-3.5 h-3.5 mr-1.5" />
                Near Launch-Ready
              </Badge>
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
              {PILLARS.map(p => {
                const PI = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`rounded-xl p-3 text-left transition-all border-2 ${selected === p.id ? 'border-primary bg-white shadow-sm' : 'border-transparent bg-white/60 hover:bg-white'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <PI className={`w-4 h-4 ${p.color}`} />
                      <span className="text-xs font-semibold">{p.label}</span>
                    </div>
                    <p className={`text-xl font-bold ${getColor(p.score)}`}>{p.score}%</p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                      <div className={`h-1.5 rounded-full ${getBarColor(p.score)}`} style={{ width: `${p.score}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pillar Detail */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${pillar.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${pillar.color}`} />
              </div>
              <div>
                <CardTitle className="text-base">{pillar.label} Checklist</CardTitle>
                <CardDescription>{pillar.score}% complete · {pillar.items.filter(i => i.status === 'pass').length}/{pillar.items.length} items done</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {pillar.items.map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  {STATUS_ICON[item.status]}
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <Badge className={`text-xs border-0 ${STATUS_BADGE[item.status]}`}>{STATUS_LABEL[item.status]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Launch Blockers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {PILLARS.flatMap(p => p.items.filter(i => i.status === 'fail').map(i => ({ ...i, pillar: p.label }))).length === 0 ? (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle2 className="w-4 h-4" />No hard blockers
                </div>
              ) : (
                PILLARS.flatMap(p => p.items.filter(i => i.status === 'fail').map(i => (
                  <div key={i.label} className="flex items-start gap-2 text-sm">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div><p className="font-medium">{i.label}</p><p className="text-xs text-muted-foreground">{i.pillar}</p></div>
                  </div>
                )))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-500" />In Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {PILLARS.flatMap(p => p.items.filter(i => i.status === 'warn').map(i => ({ ...i, pillar: p.label }))).slice(0, 6).map(i => (
                <div key={i.label} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div><p className="font-medium">{i.label}</p><p className="text-xs text-muted-foreground">{i.pillar}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4 text-center">
              <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="font-bold text-green-700">Estimated Launch Date</p>
              <p className="text-2xl font-black text-green-600 mt-1">Q3 2026</p>
              <p className="text-xs text-muted-foreground mt-1">~6 weeks of hardening remaining</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}