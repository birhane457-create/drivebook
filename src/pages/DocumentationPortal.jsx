import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen, Code2, Shield, Users, Rocket, Search,
  Bot, CheckCircle2, Clock, Eye, Sparkles, Warehouse, Monitor, Palette, Download
} from 'lucide-react';

const GUIDE_CATALOG = [
  {
    id: 'user', title: 'User Guide', icon: Users, color: 'text-green-600', bg: 'bg-green-50',
    description: 'End-user documentation — inventory, sales, purchasing, reports, alerts.',
    sections: ['Getting Started', 'Inventory Management', 'Sales & POS', 'Purchasing', 'Reports', 'Alerts'],
  },
  {
    id: 'admin', title: 'Administrator Guide', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50',
    description: 'System config, user & role management, tenants, billing, white-label, compliance.',
    sections: ['System Configuration', 'User & Role Management', 'Tenant Management', 'Billing & Plans', 'White-Label Setup', 'Audit & Compliance'],
  },
  {
    id: 'warehouse', title: 'Warehouse Guide', icon: Warehouse, color: 'text-amber-600', bg: 'bg-amber-50',
    description: 'Receiving, putaway, picking, packing, shipping, transfers, cycle counting, bin management.',
    sections: ['Receiving & Putaway', 'Picking & Packing', 'Shipping', 'Stock Transfers', 'Cycle Counting', 'Bin Management'],
  },
  {
    id: 'pos', title: 'POS Guide', icon: Monitor, color: 'text-purple-600', bg: 'bg-purple-50',
    description: 'Point of sale operations — sales, payments, receipts, returns, offline mode, reconciliation.',
    sections: ['Starting a Sale', 'Cart Management', 'Payment Processing', 'Receipts & Printing', 'Returns & Refunds', 'End-of-Day Reconciliation'],
  },
  {
    id: 'api', title: 'API Integration Guide', icon: Code2, color: 'text-cyan-600', bg: 'bg-cyan-50',
    description: 'Authentication, entity CRUD, webhooks, rate limits, error codes, SDKs.',
    sections: ['Authentication', 'Entities API', 'Webhooks', 'Rate Limits', 'Error Codes', 'SDKs'],
  },
  {
    id: 'components', title: 'UI Component Guide', icon: Palette, color: 'text-pink-600', bg: 'bg-pink-50',
    description: 'Design tokens, core & shared components, enterprise components, charts, UX patterns.',
    sections: ['Design Tokens', 'Core Components', 'Shared Components', 'Enterprise Components', 'Charts', 'UX Patterns'],
  },
  {
    id: 'developer', title: 'Developer Guide', icon: Rocket, color: 'text-orange-600', bg: 'bg-orange-50',
    description: 'Architecture, entities, backend functions, automations, integrations, agents, SDK.',
    sections: ['Architecture', 'Creating Entities', 'Backend Functions', 'Automations', 'Integrations', 'Agents'],
  },
  {
    id: 'theme', title: 'Theme Guide', icon: Palette, color: 'text-indigo-600', bg: 'bg-indigo-50',
    description: 'Design tokens, color palette, typography, dark mode, custom themes, white-label branding.',
    sections: ['Design Token System', 'Color Palette', 'Typography', 'Dark Mode', 'Custom Themes', 'White-Label Branding'],
  },
];

export default function DocumentationPortal() {
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(null);
  const [selectedGuide, setSelectedGuide] = useState(GUIDE_CATALOG[0]);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState({});

  const qc = useQueryClient();

  const { data: articles = [] } = useQuery({
    queryKey: ['knowledge-articles'],
    queryFn: () => base44.entities.KnowledgeArticle.list('-updated_date', 100),
  });

  const generateGuide = async (guide) => {
    setGenerating(guide.id);
    setError(prev => ({ ...prev, [guide.id]: null }));
    try {
      const res = await base44.functions.invoke('generateDocGuide', { guideId: guide.id });
      setDraft(prev => ({ ...prev, [guide.id]: res.data.content }));
      qc.invalidateQueries({ queryKey: ['knowledge-articles'] });
    } catch (e) {
      setError(prev => ({ ...prev, [guide.id]: e.response?.data?.error || e.message || 'Generation failed' }));
    } finally {
      setGenerating(null);
    }
  };

  const filtered = GUIDE_CATALOG.filter(g =>
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.description.toLowerCase().includes(search.toLowerCase())
  );

  const guideArticles = (guideId) => articles.filter(a => a.tags?.includes(guideId) && a.status === 'published');
  const publishedCount = GUIDE_CATALOG.filter(g => guideArticles(g.id).length > 0).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentation Portal</h1>
          <p className="text-muted-foreground mt-1">User, Admin, Warehouse, POS, API, UI Component, Developer & Theme guides — AI-generated and published</p>
        </div>
        <Badge className="bg-green-100 text-green-700 border-0 px-3 py-1.5">
          <BookOpen className="w-3.5 h-3.5 mr-1.5" />{articles.length} articles across {GUIDE_CATALOG.length} guides
        </Badge>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Guides</p>
          <p className="text-3xl font-bold mt-1">{GUIDE_CATALOG.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Published Guides</p>
          <p className="text-3xl font-bold mt-1 text-green-600">{publishedCount}/{GUIDE_CATALOG.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">KB Articles</p>
          <p className="text-3xl font-bold mt-1">{articles.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
          <p className="text-3xl font-bold mt-1 text-amber-600">{GUIDE_CATALOG.length - publishedCount}</p>
        </CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Guide List */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search guides..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.map(guide => {
            const GI = guide.icon;
            const isPublished = guideArticles(guide.id).length > 0;
            const isSelected = selectedGuide.id === guide.id;
            return (
              <button
                key={guide.id}
                onClick={() => setSelectedGuide(guide)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-muted/30 hover:bg-muted/60'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${guide.bg} flex items-center justify-center flex-shrink-0`}>
                    <GI className={`w-4 h-4 ${guide.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{guide.title}</p>
                      {isPublished ? (
                        <Badge className="text-xs border-0 flex-shrink-0 bg-green-100 text-green-700">Published</Badge>
                      ) : (
                        <Badge className="text-xs border-0 flex-shrink-0 bg-muted text-muted-foreground">Not generated</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{guide.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Guide Detail */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${selectedGuide.bg} flex items-center justify-center`}>
                    {(() => { const I = selectedGuide.icon; return <I className={`w-6 h-6 ${selectedGuide.color}`} />; })()}
                  </div>
                  <div>
                    <CardTitle>{selectedGuide.title}</CardTitle>
                    <CardDescription className="mt-1">{selectedGuide.description}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => generateGuide(selectedGuide)}
                    disabled={generating === selectedGuide.id}
                    className="border-purple-200"
                  >
                    {generating === selectedGuide.id ? (
                      <><Clock className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                    ) : (
                      <><Bot className="w-4 h-4 mr-2" />Generate & Publish</>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sections</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedGuide.sections.map((s, i) => (
                    <div key={s} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/40">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              {error[selectedGuide.id] && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs text-red-700">{error[selectedGuide.id]}</p>
                </div>
              )}

              {/* Published article from KB */}
              {guideArticles(selectedGuide.id).length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Published Articles ({guideArticles(selectedGuide.id).length})
                  </p>
                  <div className="space-y-2">
                    {guideArticles(selectedGuide.id).map(a => (
                      <details key={a.id} className="border rounded-lg overflow-hidden">
                        <summary className="cursor-pointer p-3 bg-muted/40 text-sm font-medium hover:bg-muted/60">
                          {a.title} <span className="text-xs text-muted-foreground ml-2">v{a.version || '1.0'}</span>
                        </summary>
                        <div className="p-4 bg-background max-h-96 overflow-y-auto">
                          <ReactMarkdown className="text-sm prose prose-sm max-w-none">{a.content || ''}</ReactMarkdown>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* Live draft preview */}
              {draft[selectedGuide.id] && (
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-purple-600 mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />Generated Preview
                  </p>
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 max-h-96 overflow-y-auto">
                    <ReactMarkdown className="text-sm prose prose-sm max-w-none">{draft[selectedGuide.id]}</ReactMarkdown>
                  </div>
                </div>
              )}

              {!guideArticles(selectedGuide.id).length && !draft[selectedGuide.id] && !generating && (
                <div className="border-t pt-4 text-center py-8">
                  <Bot className="w-10 h-10 text-purple-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Click "Generate & Publish" to create this guide with AI.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}