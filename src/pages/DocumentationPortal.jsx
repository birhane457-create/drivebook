import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen, FileText, Code2, Shield, Users, Rocket, Search,
  Bot, CheckCircle2, Clock, Eye, Download, Sparkles, ChevronRight
} from 'lucide-react';

const GUIDE_CATALOG = [
  {
    id: 'admin', title: 'Admin Guide', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50',
    description: 'System configuration, tenant management, IAM, billing, white-label setup.',
    sections: ['System Configuration', 'Tenant Management', 'User & Role Management', 'Billing & Plans', 'White-Label Setup', 'Security Policies'],
    status: 'published', coverage: 100, pages: 48,
  },
  {
    id: 'user', title: 'User Guide', icon: Users, color: 'text-green-600', bg: 'bg-green-50',
    description: 'End-user documentation for all modules — POS, WMS, Purchasing, Inventory, etc.',
    sections: ['Getting Started', 'Inventory Management', 'Sales & POS', 'Purchasing', 'Manufacturing', 'Finance'],
    status: 'published', coverage: 94, pages: 112,
  },
  {
    id: 'api', title: 'API Reference', icon: Code2, color: 'text-purple-600', bg: 'bg-purple-50',
    description: 'Full OpenAPI 3.0 specification for all REST endpoints with examples and schemas.',
    sections: ['Authentication', 'Entities API', 'Webhooks', 'Rate Limits', 'Error Codes', 'SDKs'],
    status: 'published', coverage: 98, pages: 76,
  },
  {
    id: 'developer', title: 'Developer Guide', icon: Rocket, color: 'text-orange-600', bg: 'bg-orange-50',
    description: 'Integration patterns, plugin development, workflow engine, event bus, and SDK docs.',
    sections: ['Plugin Development', 'Event Bus Integration', 'Custom Workflows', 'Webhook Setup', 'SDK Reference'],
    status: 'in_review', coverage: 78, pages: 38,
  },
  {
    id: 'implementation', title: 'Implementation Guide', icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-50',
    description: 'Step-by-step enterprise onboarding: discovery, migration, cutover, UAT, go-live.',
    sections: ['Discovery & Scoping', 'Data Migration', 'Configuration Playbook', 'UAT Checklist', 'Go-Live & Cutover', 'Hypercare'],
    status: 'in_review', coverage: 72, pages: 29,
  },
];

const STATUS_CONFIG = {
  published: { label: 'Published', class: 'bg-green-100 text-green-700' },
  in_review: { label: 'In Review', class: 'bg-yellow-100 text-yellow-700' },
  draft: { label: 'Draft', class: 'bg-muted text-muted-foreground' },
};

export default function DocumentationPortal() {
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(null);
  const [selectedGuide, setSelectedGuide] = useState(GUIDE_CATALOG[0]);
  const [aiDraft, setAiDraft] = useState(null);

  const { data: articles = [] } = useQuery({
    queryKey: ['knowledge-articles'],
    queryFn: () => base44.entities.KnowledgeArticle.list('-updated_date', 50),
  });

  const qc = useQueryClient();

  const createArticle = useMutation({
    mutationFn: (data) => base44.entities.KnowledgeArticle.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-articles'] }),
  });

  const generateDraft = async (guide) => {
    setGenerating(guide.id);
    setAiDraft(null);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a technical writer for an enterprise SaaS ERP platform. Generate a concise, structured first draft for the "${guide.title}". Include: an overview paragraph, key sections (${guide.sections.join(', ')}), and a quick-start checklist. Format with markdown headers and bullet points. Be practical and specific. Max 600 words.`,
    });
    setAiDraft({ guide: guide.title, content: result });
    setGenerating(null);
  };

  const filtered = GUIDE_CATALOG.filter(g =>
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.description.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = GUIDE_CATALOG.reduce((a, g) => a + g.pages, 0);
  const avgCoverage = Math.round(GUIDE_CATALOG.reduce((a, g) => a + g.coverage, 0) / GUIDE_CATALOG.length);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentation Portal</h1>
          <p className="text-muted-foreground mt-1">Admin, User, API, Developer & Implementation guides — with AI drafting</p>
        </div>
        <Badge className="bg-green-100 text-green-700 border-0 px-3 py-1.5">
          <BookOpen className="w-3.5 h-3.5 mr-1.5" />{totalPages} pages across {GUIDE_CATALOG.length} guides
        </Badge>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Guides</p>
          <p className="text-3xl font-bold mt-1">{GUIDE_CATALOG.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Pages</p>
          <p className="text-3xl font-bold mt-1">{totalPages}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Coverage</p>
          <p className="text-3xl font-bold mt-1 text-blue-600">{avgCoverage}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Published</p>
          <p className="text-3xl font-bold mt-1 text-green-600">{GUIDE_CATALOG.filter(g => g.status === 'published').length}/{GUIDE_CATALOG.length}</p>
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
            const sc = STATUS_CONFIG[guide.status];
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
                      <Badge className={`text-xs border-0 flex-shrink-0 ${sc.class}`}>{sc.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={guide.coverage} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground">{guide.coverage}%</span>
                    </div>
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
                  <Button variant="outline" size="sm"><Eye className="w-4 h-4 mr-1" />Preview</Button>
                  <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Export PDF</Button>
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

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    AI Draft Generator
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateDraft(selectedGuide)}
                    disabled={generating === selectedGuide.id}
                    className="border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    {generating === selectedGuide.id ? (
                      <><Clock className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                    ) : (
                      <><Bot className="w-4 h-4 mr-2" />Generate Draft</>
                    )}
                  </Button>
                </div>
                {aiDraft && aiDraft.guide === selectedGuide.title && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-purple-600 mb-2 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />AI-Generated Draft — {selectedGuide.title}
                    </p>
                    <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">{aiDraft.content}</pre>
                    <Button
                      size="sm"
                      className="mt-3 bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => createArticle.mutate({
                        title: `[Draft] ${selectedGuide.title}`,
                        type: 'guide',
                        content: aiDraft.content,
                        status: 'draft',
                        module: selectedGuide.title,
                      })}
                    >
                      Save to Knowledge Base
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}