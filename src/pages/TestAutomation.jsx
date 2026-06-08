import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  FlaskConical, Play, CheckCircle2, XCircle, AlertTriangle, Clock,
  Zap, RefreshCw, BarChart3, Shield, Bot, Globe2, Activity
} from 'lucide-react';

const SEED_SUITES = [
  { name: 'Inventory Workflow', type: 'workflow', module: 'WMS', total_cases: 18, pass_count: 18, fail_count: 0, last_run_status: 'pass', avg_duration_ms: 1240 },
  { name: 'Purchase → Receive Flow', type: 'workflow', module: 'Procurement', total_cases: 14, pass_count: 14, fail_count: 0, last_run_status: 'pass', avg_duration_ms: 980 },
  { name: 'POS Sale & Payment', type: 'e2e', module: 'POS', total_cases: 12, pass_count: 11, fail_count: 1, last_run_status: 'partial', avg_duration_ms: 1850 },
  { name: 'Tenant Isolation', type: 'smoke', module: 'Platform', total_cases: 8, pass_count: 8, fail_count: 0, last_run_status: 'pass', avg_duration_ms: 320 },
  { name: 'AI Copilot Responses', type: 'ai', module: 'AI', total_cases: 20, pass_count: 19, fail_count: 1, last_run_status: 'partial', avg_duration_ms: 3400 },
  { name: 'API Endpoints (REST)', type: 'api', module: 'API', total_cases: 42, pass_count: 42, fail_count: 0, last_run_status: 'pass', avg_duration_ms: 210 },
  { name: 'Marketplace Plugin Install', type: 'e2e', module: 'Marketplace', total_cases: 6, pass_count: 6, fail_count: 0, last_run_status: 'pass', avg_duration_ms: 2100 },
  { name: 'Billing & Subscription', type: 'e2e', module: 'Billing', total_cases: 10, pass_count: 10, fail_count: 0, last_run_status: 'pass', avg_duration_ms: 760 },
  { name: 'Manufacturing MRP Run', type: 'workflow', module: 'Manufacturing', total_cases: 9, pass_count: 8, fail_count: 1, last_run_status: 'partial', avg_duration_ms: 2800 },
  { name: 'Auth & IAM', type: 'smoke', module: 'IAM', total_cases: 16, pass_count: 16, fail_count: 0, last_run_status: 'pass', avg_duration_ms: 440 },
  { name: 'Forecasting Accuracy', type: 'ai', module: 'AI', total_cases: 15, pass_count: 14, fail_count: 1, last_run_status: 'partial', avg_duration_ms: 4200 },
  { name: 'Regression Suite', type: 'regression', module: 'Core', total_cases: 88, pass_count: 82, fail_count: 6, last_run_status: 'partial', avg_duration_ms: 8900 },
];

const TYPE_META = {
  smoke: { icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Smoke' },
  regression: { icon: RefreshCw, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Regression' },
  workflow: { icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Workflow' },
  api: { icon: Globe2, color: 'text-purple-500', bg: 'bg-purple-50', label: 'API' },
  ai: { icon: Bot, color: 'text-violet-500', bg: 'bg-violet-50', label: 'AI' },
  e2e: { icon: FlaskConical, color: 'text-green-500', bg: 'bg-green-50', label: 'E2E' },
  performance: { icon: BarChart3, color: 'text-cyan-500', bg: 'bg-cyan-50', label: 'Performance' },
};

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', label: 'PASS' },
  partial: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'PARTIAL' },
  fail: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'FAIL' },
  running: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100', label: 'RUNNING' },
};

export default function TestAutomation() {
  const [runningId, setRunningId] = useState(null);

  const { data: suites = [] } = useQuery({
    queryKey: ['testsuites'],
    queryFn: () => base44.entities.TestSuite.list('-updated_date', 50),
  });

  const { data: runs = [] } = useQuery({
    queryKey: ['testruns'],
    queryFn: () => base44.entities.TestRun.list('-created_date', 20),
  });

  const qc = useQueryClient();

  const createSuite = useMutation({
    mutationFn: (data) => base44.entities.TestSuite.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['testsuites'] }),
  });

  const createRun = useMutation({
    mutationFn: (data) => base44.entities.TestRun.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['testruns'] }),
  });

  // Use seed data if DB is empty
  const displaySuites = suites.length > 0 ? suites : SEED_SUITES;

  const totalCases = displaySuites.reduce((a, s) => a + (s.total_cases || 0), 0);
  const totalPass = displaySuites.reduce((a, s) => a + (s.pass_count || 0), 0);
  const coveragePct = totalCases > 0 ? Math.round((totalPass / totalCases) * 100) : 0;
  const passingSuites = displaySuites.filter(s => s.last_run_status === 'pass').length;

  const simulateRun = async (suite) => {
    setRunningId(suite.name);
    await new Promise(r => setTimeout(r, 1800));
    setRunningId(null);
  };

  const seedData = async () => {
    for (const s of SEED_SUITES) {
      await base44.entities.TestSuite.create({ ...s, last_run_date: new Date().toISOString() });
    }
    qc.invalidateQueries({ queryKey: ['testsuites'] });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Automation Center</h1>
          <p className="text-muted-foreground mt-1">Smoke, regression, workflow, API, and AI test suites</p>
        </div>
        <div className="flex gap-2">
          {suites.length === 0 && (
            <Button variant="outline" size="sm" onClick={seedData}>
              <FlaskConical className="w-4 h-4 mr-2" />Seed Test Data
            </Button>
          )}
          <Button size="sm"><Play className="w-4 h-4 mr-2" />Run All Suites</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Test Suites</p>
          <p className="text-3xl font-bold mt-1">{displaySuites.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Cases</p>
          <p className="text-3xl font-bold mt-1">{totalCases}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pass Rate</p>
          <p className={`text-3xl font-bold mt-1 ${coveragePct >= 95 ? 'text-green-600' : coveragePct >= 85 ? 'text-yellow-600' : 'text-red-600'}`}>{coveragePct}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Suites Passing</p>
          <p className="text-3xl font-bold mt-1 text-green-600">{passingSuites}/{displaySuites.length}</p>
        </CardContent></Card>
      </div>

      {/* Suite List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Test Suites</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {displaySuites.map(suite => {
              const tm = TYPE_META[suite.type] || TYPE_META.smoke;
              const sm = STATUS_CONFIG[runningId === suite.name ? 'running' : (suite.last_run_status || 'pass')];
              const TI = tm.icon;
              const SI = sm.icon;
              const pct = suite.total_cases > 0 ? Math.round(((suite.pass_count || 0) / suite.total_cases) * 100) : 100;

              return (
                <div key={suite.name || suite.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className={`w-9 h-9 rounded-lg ${tm.bg} flex items-center justify-center flex-shrink-0`}>
                    <TI className={`w-4 h-4 ${tm.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{suite.name}</p>
                      <Badge variant="outline" className={`text-xs border-0 ${tm.bg} ${tm.color} flex-shrink-0`}>{tm.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <Progress value={pct} className="h-1.5 w-24" />
                      <span className="text-xs text-muted-foreground">{suite.pass_count}/{suite.total_cases} passed</span>
                      {suite.avg_duration_ms > 0 && (
                        <span className="text-xs text-muted-foreground">{suite.avg_duration_ms > 1000 ? `${(suite.avg_duration_ms/1000).toFixed(1)}s` : `${suite.avg_duration_ms}ms`}</span>
                      )}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${sm.bg} ${sm.color}`}>
                    <SI className="w-3.5 h-3.5" />
                    {sm.label}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => simulateRun(suite)} disabled={runningId === suite.name}>
                    {runningId === suite.name ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}