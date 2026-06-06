import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/shared/PageHeader';
import { Search, BookOpen, FileText, Scale, Layers, Plus, Eye, Edit, Loader2, Sparkles, Tag } from 'lucide-react';

const TYPE_CONFIG = {
  glossary: { label: 'Glossary', color: 'bg-blue-100 text-blue-800', icon: BookOpen },
  policy: { label: 'Policy', color: 'bg-red-100 text-red-800', icon: Scale },
  sop: { label: 'SOP', color: 'bg-green-100 text-green-800', icon: FileText },
  faq: { label: 'FAQ', color: 'bg-yellow-100 text-yellow-800', icon: Layers },
  guide: { label: 'Guide', color: 'bg-purple-100 text-purple-800', icon: BookOpen },
};

function ArticleCard({ article, onClick }) {
  const cfg = TYPE_CONFIG[article.type] || TYPE_CONFIG.guide;
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onClick(article)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.color}`}>
            <cfg.icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{article.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{article.content?.slice(0, 100)}...</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
              <Badge variant="outline" className="text-[10px]">{article.status}</Badge>
              {article.module && <span className="text-[10px] text-muted-foreground">{article.module}</span>}
            </div>
            {article.tags?.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {article.tags.slice(0, 3).map(t => (
                  <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">{article.view_count || 0} views</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function KnowledgeBase() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [form, setForm] = useState({ title: '', type: 'sop', content: '', module: '', status: 'draft', tags: '' });
  const qc = useQueryClient();

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['knowledge-articles'],
    queryFn: () => base44.entities.KnowledgeArticle.list('-created_date', 100),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.KnowledgeArticle.create({ ...d, tags: d.tags ? d.tags.split(',').map(t => t.trim()) : [] }),
    onSuccess: () => { qc.invalidateQueries(['knowledge-articles']); setShowForm(false); setForm({ title: '', type: 'sop', content: '', module: '', status: 'draft', tags: '' }); },
  });

  async function aiSearch() {
    if (!search.trim()) return;
    setAiSearching(true);
    setAiResult(null);
    const corpus = articles.map(a => `[${a.type.toUpperCase()}] ${a.title}: ${a.content?.slice(0, 200)}`).join('\n');
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a knowledge base assistant. Given the following articles, answer the user's query.\n\nKnowledge Articles:\n${corpus}\n\nUser Query: ${search}\n\nProvide a comprehensive answer citing relevant articles.`,
    });
    setAiResult(result);
    setAiSearching(false);
  }

  const filtered = articles.filter(a => {
    const matchType = tab === 'all' || a.type === tab;
    const matchSearch = !search || a.title?.toLowerCase().includes(search.toLowerCase()) || a.content?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  async function openArticle(article) {
    setViewing(article);
    await base44.entities.KnowledgeArticle.update(article.id, { view_count: (article.view_count || 0) + 1 });
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Knowledge Base" subtitle="Semantic search · Policies · SOPs · Glossary · RAG">
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Add Article
        </Button>
      </PageHeader>

      {/* AI Semantic Search */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && aiSearch()}
                placeholder="Search or ask anything... (AI-powered semantic search)"
                className="pl-9"
              />
            </div>
            <Button onClick={aiSearch} disabled={aiSearching} className="gap-2 bg-purple-600 hover:bg-purple-700">
              {aiSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Search
            </Button>
          </div>
          {aiResult && (
            <div className="mt-3 p-3 bg-white rounded-lg border text-sm">
              <p className="font-medium text-purple-700 text-xs mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Answer</p>
              <p className="text-sm whitespace-pre-wrap">{aiResult}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({articles.length})</TabsTrigger>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <TabsTrigger key={k} value={k}>{v.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(a => <ArticleCard key={a.id} article={a} onClick={openArticle} />)}
              {filtered.length === 0 && (
                <div className="col-span-3 text-center py-12 text-muted-foreground">
                  No articles found. <button onClick={() => setShowForm(true)} className="text-primary underline">Create one</button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* View Modal */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge className={TYPE_CONFIG[viewing.type]?.color}>{TYPE_CONFIG[viewing.type]?.label}</Badge>
                  {viewing.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{viewing.status}</Badge>
                  {viewing.module && <Badge variant="outline">{viewing.module}</Badge>}
                  <Badge variant="outline">v{viewing.version}</Badge>
                </div>
                {viewing.tags?.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {viewing.tags.map(t => <span key={t} className="text-xs bg-muted px-2 py-0.5 rounded-full">{t}</span>)}
                  </div>
                )}
                <div className="prose prose-sm max-w-none border rounded-lg p-4 bg-muted/30 whitespace-pre-wrap text-sm">
                  {viewing.content}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>New Knowledge Article</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['draft', 'review', 'published', 'archived'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Module</Label><Input value={form.module} onChange={e => setForm(p => ({ ...p, module: e.target.value }))} placeholder="e.g. inventory, finance" /></div>
            <div><Label>Content</Label><Textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={6} /></div>
            <div><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="e.g. replenishment, safety-stock" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.title}>
                {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Article'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}