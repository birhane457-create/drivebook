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
import PageHeader from '@/components/shared/PageHeader';
import { Plus, Rocket, CheckCircle, Clock, GitBranch, Megaphone, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const MOCK_RELEASES = [
  {
    id: 'r1', version: '4.12.0', title: 'AI Insight Hub + Customer Success Center', type: 'major', status: 'released',
    release_date: '2026-06-07', rollout_percentage: 100,
    summary: 'Introduces the AI Insight Hub for executive intelligence, Customer Success Center for churn management, and Release Management module.',
    highlights: ['AI Insight Hub with executive briefing generator', 'Customer Success Center with health scoring', 'Churn prediction & renewal pipeline', 'Release Management & changelog system'],
    bug_fixes: ['Fixed sidebar Database icon duplicate import', 'Resolved POS offline sync edge case on iOS', 'Fixed GL posting date validation for leap years'],
    breaking_changes: [],
    affected_modules: ['AI & Intelligence', 'SaaS Platform', 'Customer Success'],
    is_public: true,
  },
  {
    id: 'r2', version: '4.11.0', title: 'Data Migration Center + Onboarding Wizard', type: 'major', status: 'released',
    release_date: '2026-05-25', rollout_percentage: 100,
    summary: 'Adds a full Data Migration Center supporting CSV/Excel/Legacy ERP sources with field mapping, validation, and rollback. Includes a 10-step Onboarding Wizard with health scoring.',
    highlights: ['Data Migration Center with AI-powered preview', 'Per-row error reporting and rollback', 'Onboarding health score (0–100)', 'Training checklist with 25+ items', 'Tenant health dashboard for platform admins'],
    bug_fixes: ['Fixed cycle count discrepancy calculation', 'Resolved transfer approval deadlock'],
    breaking_changes: [],
    affected_modules: ['Customer Success', 'Platform Admin'],
    is_public: true,
  },
  {
    id: 'r3', version: '4.10.0', title: 'Billing, White Label & Developer Portal', type: 'major', status: 'released',
    release_date: '2026-05-10', rollout_percentage: 100,
    summary: 'Finalizes commercial infrastructure: subscription management, per-tenant brand profiles, custom domains, and an OAuth-enabled API sandbox.',
    highlights: ['Full Stripe subscription lifecycle management', 'Per-tenant white label branding with custom domains', 'OAuth 2.0 Developer Portal with sandbox environment', 'API key management and rate limiting dashboard'],
    bug_fixes: ['Fixed multi-currency rounding in invoices', 'Resolved tenant isolation bug in event bus'],
    breaking_changes: ['Webhook payload schema updated to v2 — see migration guide'],
    affected_modules: ['Billing', 'White Label', 'Developer Portal'],
    is_public: true,
  },
  {
    id: 'r4', version: '4.13.0', title: 'AIOps + Enterprise Benchmarking', type: 'major', status: 'planned',
    planned_date: '2026-07-01', rollout_percentage: 0,
    summary: 'AI cost tracking, token usage analytics, model comparison, and anonymized cross-tenant performance benchmarking.',
    highlights: ['AI cost & token budget management', 'Prompt analytics and quality scoring', 'Cross-tenant inventory accuracy benchmarking', 'Fill rate and order cycle time benchmarks'],
    bug_fixes: [],
    breaking_changes: [],
    affected_modules: ['AI & Intelligence', 'Analytics'],
    is_public: false,
    beta_tenants: ['Acme Corp'],
  },
];

const TYPE_CLS = {
  major: 'bg-purple-100 text-purple-700', minor: 'bg-blue-100 text-blue-700',
  patch: 'bg-gray-100 text-gray-700', hotfix: 'bg-red-100 text-red-700', beta: 'bg-yellow-100 text-yellow-700',
};
const STATUS_CLS = {
  planned: 'bg-gray-100 text-gray-700', in_progress: 'bg-blue-100 text-blue-700',
  in_review: 'bg-yellow-100 text-yellow-700', released: 'bg-green-100 text-green-700', rolled_back: 'bg-red-100 text-red-700',
};
const STATUS_ICON = { planned: Clock, in_progress: Loader2, released: CheckCircle, rolled_back: GitBranch };

function ReleaseCard({ release }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = STATUS_ICON[release.status] || Clock;

  return (
    <Card className={release.status === 'released' ? 'border-green-200' : release.status === 'planned' ? 'border-dashed' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${release.status === 'released' ? 'bg-green-100' : 'bg-muted'}`}>
            <Icon className={`w-4 h-4 ${release.status === 'released' ? 'text-green-600' : 'text-muted-foreground'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm font-bold font-mono text-primary">v{release.version}</code>
              <span className="font-semibold text-sm">{release.title}</span>
              <Badge className={`text-[10px] ${TYPE_CLS[release.type]}`}>{release.type}</Badge>
              <Badge className={`text-[10px] ${STATUS_CLS[release.status]}`}>{release.status.replace('_',' ')}</Badge>
              {!release.is_public && <Badge className="text-[10px] bg-yellow-100 text-yellow-700">Beta</Badge>}
              <span className="text-xs text-muted-foreground ml-auto">{release.release_date || release.planned_date}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{release.summary}</p>

            {expanded && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold mb-1">✨ Highlights</p>
                  <ul className="space-y-0.5">
                    {release.highlights.map((h, i) => <li key={i} className="text-xs flex gap-1.5"><span className="text-green-500">+</span>{h}</li>)}
                  </ul>
                </div>
                {release.bug_fixes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1">🐛 Bug Fixes</p>
                    <ul className="space-y-0.5">
                      {release.bug_fixes.map((b, i) => <li key={i} className="text-xs flex gap-1.5"><span className="text-blue-500">·</span>{b}</li>)}
                    </ul>
                  </div>
                )}
                {release.breaking_changes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1 text-red-600">⚠️ Breaking Changes</p>
                    <ul className="space-y-0.5">
                      {release.breaking_changes.map((b, i) => <li key={i} className="text-xs flex gap-1.5 text-red-700"><span>!</span>{b}</li>)}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {release.affected_modules.map(m => <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>)}
                </div>
              </div>
            )}

            <button className="text-xs text-primary mt-2 flex items-center gap-1" onClick={() => setExpanded(e => !e)}>
              {expanded ? <><ChevronUp className="w-3 h-3" />Collapse</> : <><ChevronDown className="w-3 h-3" />View changelog</>}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReleaseManagement() {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ version: '', title: '', type: 'minor', status: 'planned', summary: '' });
  const qc = useQueryClient();

  const { data: dbReleases = [] } = useQuery({
    queryKey: ['releases'],
    queryFn: () => base44.entities.Release.list('-created_date', 50),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.Release.create(d),
    onSuccess: () => { qc.invalidateQueries(['releases']); setShowNew(false); },
  });

  const all = [...MOCK_RELEASES, ...dbReleases];
  const released = all.filter(r => r.status === 'released');
  const upcoming = all.filter(r => r.status !== 'released');

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Release Management" subtitle="Changelog · Announcements · Beta programs · Rollout management">
        <Button size="sm" className="gap-2" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4" /> New Release
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Releases', value: all.length, icon: Rocket, color: 'text-blue-600' },
          { label: 'Released', value: released.length, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Upcoming', value: upcoming.length, icon: Clock, color: 'text-orange-600' },
          { label: 'Current Version', value: `v${released[0]?.version || '–'}`, icon: GitBranch, color: 'text-purple-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-xl font-bold ${s.color}`}>{s.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="changelog">
        <TabsList>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="changelog" className="space-y-3">
          {released.map((r, i) => <ReleaseCard key={r.id || i} release={r} />)}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-3">
          {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming releases planned.</p> :
            upcoming.map((r, i) => <ReleaseCard key={r.id || i} release={r} />)}
        </TabsContent>

        <TabsContent value="announcements" className="space-y-3">
          {released.slice(0, 3).map((r, i) => (
            <Card key={i} className="bg-gradient-to-r from-primary/5 to-purple-50 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Megaphone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">What's new in v{r.version}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.release_date}</p>
                    <ul className="mt-2 space-y-0.5">
                      {r.highlights.slice(0, 3).map((h, j) => <li key={j} className="text-xs">• {h}</li>)}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Release</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Version</Label><Input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} placeholder="4.14.0" /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['major','minor','patch','hotfix','beta'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Release title" /></div>
            <div><Label>Summary</Label><Input value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} placeholder="Brief description" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate(form)} disabled={!form.version || !form.title || createMut.isPending}>Create Release</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}