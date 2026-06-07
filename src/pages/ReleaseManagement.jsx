import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import PageHeader from '@/components/shared/PageHeader';
import { Plus, Tag, Megaphone, GitBranch, CheckCircle, Clock, Rocket, Users, Zap, AlertTriangle } from 'lucide-react';

const SAMPLE_RELEASES = [
  {
    id: 'rel1', version: 'v4.2.0', title: 'AI Insight Hub & Customer Success Center', type: 'major', status: 'released',
    release_date: '2026-06-07', planned_date: '2026-06-07', rollout_percentage: 100,
    summary: 'Introduces the AI Insight Hub for automated business anomaly detection and the full Customer Success Center for churn prevention and renewal management.',
    highlights: ['AI Insight Hub with 6 insight categories and executive briefing', 'Customer Success Center with health scoring and renewal pipeline', 'Release Management module (this screen!)', 'AIOps dashboard for cost and token tracking', 'Enterprise Benchmarking with cross-tenant percentiles'],
    bug_fixes: ['Fixed POS offline sync edge case on Safari', 'Resolved duplicate SKU import error in Data Migration', 'Fixed sidebar Database icon duplicate declaration'],
    breaking_changes: [],
    affected_modules: ['AI', 'Customer Success', 'Platform'],
    is_public: true, beta_tenants: [],
  },
  {
    id: 'rel2', version: 'v4.1.0', title: 'Data Migration Center & Onboarding Wizard', type: 'minor', status: 'released',
    release_date: '2026-05-28', planned_date: '2026-05-28', rollout_percentage: 100,
    summary: 'Full data migration pipeline with CSV/Excel/JSON support, field mapping, validation, rollback, and a guided onboarding wizard with health score.',
    highlights: ['Data Migration Center with file upload and AI preview', 'Onboarding Center with 10-step wizard and health score', 'Tenant health dashboard for platform admins'],
    bug_fixes: ['Improved PO approval workflow performance', 'Fixed currency formatting in Financials GL view'],
    breaking_changes: [],
    affected_modules: ['Platform', 'Onboarding'],
    is_public: true, beta_tenants: [],
  },
  {
    id: 'rel3', version: 'v4.3.0', title: 'Native Mobile Apps (Beta)', type: 'beta', status: 'in_progress',
    release_date: null, planned_date: '2026-08-01', rollout_percentage: 0,
    summary: 'Native warehouse scanning app, driver app with route tracking, and executive dashboard app for iOS and Android.',
    highlights: ['Warehouse App: barcode scan, pick/pack, cycle count', 'Driver App: route navigation, proof of delivery', 'Executive App: KPI dashboard with push alerts'],
    bug_fixes: [],
    breaking_changes: [],
    affected_modules: ['WMS', 'TMS', 'Executive'],
    is_public: false, beta_tenants: ['Acme Corp', 'Global Traders'],
  },
  {
    id: 'rel4', version: 'v4.2.1', title: 'Performance & Security Patch', type: 'hotfix', status: 'in_review',
    release_date: null, planned_date: '2026-06-14', rollout_percentage: 0,
    summary: 'Critical performance improvements for large catalog POS and security hardening for API key rotation.',
    highlights: ['POS search response time improved 4×', 'API key rotation now available in Security Center', 'Inventory list pagination optimized for 100K+ SKUs'],
    bug_fixes: ['Memory leak in Observability tracing spans', 'XSS sanitization for KnowledgeBase rich text'],
    breaking_changes: ['API key format changed — regenerate keys after upgrade'],
    affected_modules: ['Security', 'POS', 'Observability'],
    is_public: true, beta_tenants: [],
  },
];

const TYPE_CLS = { major: 'bg-purple-100 text-purple-700', minor: 'bg-blue-100 text-blue-700', patch: 'bg-gray-100 text-gray-700', hotfix: 'bg-red-100 text-red-700', beta: 'bg-yellow-100 text-yellow-700' };
const STATUS_CLS = { planned: 'bg-gray-100 text-gray-700', in_progress: 'bg-blue-100 text-blue-700', in_review: 'bg-yellow-100 text-yellow-700', released: 'bg-green-100 text-green-700', rolled_back: 'bg-red-100 text-red-700' };
const STATUS_ICON = { planned: Clock, in_progress: GitBranch, in_review: AlertTriangle, released: CheckCircle, rolled_back: AlertTriangle };

function ReleaseCard({ release, onSelect }) {
  const Icon = STATUS_ICON[release.status] || Clock;
  return (
    <Card className="hover:shadow-md transition-all cursor-pointer" onClick={() => onSelect(release)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${release.status === 'released' ? 'text-green-500' : 'text-muted-foreground'}`} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{release.version}</code>
                <Badge className={`text-[10px] ${TYPE_CLS[release.type]}`}>{release.type}</Badge>
                <Badge className={`text-[10px] ${STATUS_CLS[release.status]}`}>{release.status.replace('_',' ')}</Badge>
              </div>
              <p className="font-medium text-sm mt-1">{release.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{release.summary}</p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground flex-shrink-0">
            <p>{release.release_date || release.planned_date}</p>
            {release.rollout_percentage < 100 && release.status !== 'planned' && (
              <p className="text-blue-600">{release.rollout_percentage}% rollout</p>
            )}
          </div>
        </div>
        {release.beta_tenants?.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <Users className="w-3 h-3 text-yellow-600" />
            <span className="text-[10px] text-yellow-700">Beta: {release.beta_tenants.join(', ')}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1 mt-2">
          {release.affected_modules.map(m => <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>)}
        </div>
      </CardContent>
    </Card>
  );
}

function ReleaseDetail({ release, onClose }) {
  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <code className="font-mono bg-muted px-2 py-0.5 rounded text-sm">{release.version}</code>
          {release.title}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Badge className={TYPE_CLS[release.type]}>{release.type}</Badge>
          <Badge className={STATUS_CLS[release.status]}>{release.status.replace('_', ' ')}</Badge>
          {release.rollout_percentage < 100 && <Badge variant="outline">{release.rollout_percentage}% rollout</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{release.summary}</p>
        {release.rollout_percentage < 100 && (
          <div><p className="text-xs font-medium mb-1">Rollout Progress</p><Progress value={release.rollout_percentage} className="h-2" /></div>
        )}
        {release.highlights.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2 flex items-center gap-1"><Rocket className="w-4 h-4 text-purple-500" /> What's New</p>
            <ul className="space-y-1">{release.highlights.map((h, i) => <li key={i} className="text-sm flex gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />{h}</li>)}</ul>
          </div>
        )}
        {release.bug_fixes.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2 flex items-center gap-1"><Zap className="w-4 h-4 text-blue-500" /> Bug Fixes</p>
            <ul className="space-y-1">{release.bug_fixes.map((b, i) => <li key={i} className="text-xs flex gap-2 text-muted-foreground"><span>•</span>{b}</li>)}</ul>
          </div>
        )}
        {release.breaking_changes.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Breaking Changes</p>
            <ul className="space-y-1">{release.breaking_changes.map((b, i) => <li key={i} className="text-xs text-red-700">{b}</li>)}</ul>
          </div>
        )}
        {release.beta_tenants?.length > 0 && (
          <div><p className="text-xs font-medium mb-1">Beta Tenants</p><div className="flex gap-1">{release.beta_tenants.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div></div>
        )}
      </div>
    </DialogContent>
  );
}

export default function ReleaseManagement() {
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = SAMPLE_RELEASES.filter(r => filterStatus === 'all' || r.status === filterStatus);
  const upcoming = SAMPLE_RELEASES.filter(r => r.status !== 'released').length;
  const released = SAMPLE_RELEASES.filter(r => r.status === 'released').length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Release Management" subtitle="Changelog · Feature announcements · Beta programs · Rollout management">
        <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> New Release</Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Releases', value: SAMPLE_RELEASES.length, color: 'text-foreground' },
          { label: 'Released',       value: released,               color: 'text-green-600' },
          { label: 'In Progress',    value: upcoming,               color: 'text-blue-600' },
          { label: 'Beta Programs',  value: SAMPLE_RELEASES.filter(r => r.beta_tenants?.length > 0).length, color: 'text-yellow-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="releases">
        <TabsList>
          <TabsTrigger value="releases">All Releases</TabsTrigger>
          <TabsTrigger value="changelog">Public Changelog</TabsTrigger>
        </TabsList>

        <TabsContent value="releases" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {['planned','in_progress','in_review','released','rolled_back'].map(s => <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {filtered.map(r => <ReleaseCard key={r.id} release={r} onSelect={setSelected} />)}
        </TabsContent>

        <TabsContent value="changelog" className="mt-4">
          <Card>
            <CardContent className="p-6 space-y-8">
              {SAMPLE_RELEASES.filter(r => r.is_public && r.status === 'released').map(r => (
                <div key={r.id} className="border-l-2 border-primary pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{r.version}</code>
                    <span className="text-xs text-muted-foreground">{r.release_date}</span>
                    <Badge className={`text-[10px] ${TYPE_CLS[r.type]}`}>{r.type}</Badge>
                  </div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{r.summary}</p>
                  <ul className="mt-2 space-y-0.5">{r.highlights.slice(0,3).map((h,i) => <li key={i} className="text-xs flex gap-1.5 text-muted-foreground"><CheckCircle className="w-3 h-3 text-green-500 mt-0.5" />{h}</li>)}</ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        {selected && <ReleaseDetail release={selected} onClose={() => setSelected(null)} />}
      </Dialog>
    </div>
  );
}