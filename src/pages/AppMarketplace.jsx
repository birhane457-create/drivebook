import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/shared/PageHeader';
import { Package, Star, Download, CheckCircle, Search, Plus, Puzzle, Zap, BarChart3, Code2, Settings } from 'lucide-react';

const CATEGORY_ICON = {
  integration: Zap,
  analytics: BarChart3,
  automation: Settings,
  ui_widget: Puzzle,
  workflow: Zap,
  reporting: BarChart3,
  compliance: CheckCircle,
};

const FEATURED_PLUGINS = [
  {
    id: 'p1', name: 'Stripe Payments', slug: 'stripe-payments', category: 'integration', publisher: 'Stripe Inc.',
    description: 'Full payment processing, subscriptions, and invoicing via Stripe. Sync payment status to orders automatically.',
    install_count: 2340, rating: 4.8, price_model: 'free', is_verified: true, is_installed: true,
    tags: ['payments', 'billing', 'subscriptions'],
    permissions: ['sales:read', 'sales:write', 'customers:read'],
  },
  {
    id: 'p2', name: 'Advanced Analytics Pro', slug: 'analytics-pro', category: 'analytics', publisher: 'DataViz Co.',
    description: 'AI-powered analytics dashboards with predictive insights, cohort analysis, and custom KPI builders.',
    install_count: 890, rating: 4.6, price_model: 'paid', price_usd: 49, is_verified: true, is_installed: false,
    tags: ['analytics', 'kpi', 'dashboards'],
    permissions: ['reports:read', 'sales:read', 'inventory:read'],
  },
  {
    id: 'p3', name: 'Shopify Connector', slug: 'shopify-connector', category: 'integration', publisher: 'CommerceHub',
    description: 'Bi-directional sync between WMS Pro and Shopify. Orders, products, and inventory synced in real-time.',
    install_count: 1450, rating: 4.7, price_model: 'freemium', is_verified: true, is_installed: false,
    tags: ['ecommerce', 'sync', 'shopify'],
    permissions: ['products:read', 'inventory:read', 'orders:write'],
  },
  {
    id: 'p4', name: 'AI Document OCR', slug: 'ai-ocr', category: 'automation', publisher: 'IntelliDocs',
    description: 'Automatically extract data from invoices, POs, and delivery notes using AI-powered OCR.',
    install_count: 560, rating: 4.5, price_model: 'paid', price_usd: 29, is_verified: false, is_installed: true,
    tags: ['ocr', 'documents', 'automation'],
    permissions: ['documents:read', 'documents:write'],
  },
  {
    id: 'p5', name: 'Slack Notifications', slug: 'slack-notifs', category: 'integration', publisher: 'WorkflowOps',
    description: 'Send critical alerts, order updates, and KPI summaries directly to Slack channels.',
    install_count: 3100, rating: 4.9, price_model: 'free', is_verified: true, is_installed: false,
    tags: ['slack', 'notifications', 'alerts'],
    permissions: ['alerts:read'],
  },
  {
    id: 'p6', name: 'Demand Forecasting Widget', slug: 'forecast-widget', category: 'ui_widget', publisher: 'ForecastAI',
    description: 'Embeddable demand forecasting charts with ML models trained on your historical data.',
    install_count: 420, rating: 4.3, price_model: 'paid', price_usd: 79, is_verified: false, is_installed: false,
    tags: ['forecasting', 'widget', 'ml'],
    permissions: ['inventory:read', 'sales:read'],
  },
];

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating}</span>
    </div>
  );
}

function PluginCard({ plugin, onInstall, onUninstall, onView }) {
  const Icon = CATEGORY_ICON[plugin.category] || Package;
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm">{plugin.name}</h4>
              {plugin.is_verified && <CheckCircle className="w-3.5 h-3.5 text-blue-500" />}
              {plugin.is_installed && <Badge className="bg-green-100 text-green-800 text-[10px]">Installed</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{plugin.publisher}</p>
            <StarRating rating={plugin.rating} />
          </div>
          <div className="text-right">
            {plugin.price_model === 'free' ? (
              <span className="text-xs font-medium text-green-600">Free</span>
            ) : plugin.price_model === 'freemium' ? (
              <span className="text-xs font-medium text-blue-600">Freemium</span>
            ) : (
              <span className="text-xs font-bold">${plugin.price_usd}/mo</span>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{plugin.description}</p>

        <div className="flex gap-1 mt-2 flex-wrap">
          {plugin.tags?.slice(0, 3).map(t => (
            <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Download className="w-3 h-3" />{plugin.install_count.toLocaleString()}
          </span>
          <Badge variant="outline" className="text-[10px]">{plugin.category}</Badge>
          <div className="flex gap-1 ml-auto">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onView(plugin)}>Details</Button>
            {plugin.is_installed ? (
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => onUninstall(plugin)}>Uninstall</Button>
            ) : (
              <Button size="sm" className="h-7 text-xs" onClick={() => onInstall(plugin)}>Install</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AppMarketplace() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewing, setViewing] = useState(null);
  const [showPublish, setShowPublish] = useState(false);
  const [installedPlugins, setInstalledPlugins] = useState(new Set(['p1', 'p4']));
  const qc = useQueryClient();

  const { data: customPlugins = [] } = useQuery({
    queryKey: ['marketplace-plugins'],
    queryFn: () => base44.entities.MarketplacePlugin.list('-created_date', 50),
  });

  const publishMut = useMutation({
    mutationFn: (d) => base44.entities.MarketplacePlugin.create(d),
    onSuccess: () => { qc.invalidateQueries(['marketplace-plugins']); setShowPublish(false); },
  });

  function handleInstall(plugin) {
    setInstalledPlugins(prev => new Set([...prev, plugin.id]));
    if (plugin.id.startsWith('p')) return;
    base44.entities.MarketplacePlugin.update(plugin.id, { is_installed: true, install_count: (plugin.install_count || 0) + 1 });
  }

  function handleUninstall(plugin) {
    setInstalledPlugins(prev => { const s = new Set(prev); s.delete(plugin.id); return s; });
  }

  const allPlugins = [
    ...FEATURED_PLUGINS.map(p => ({ ...p, is_installed: installedPlugins.has(p.id) })),
    ...customPlugins,
  ];

  const filtered = allPlugins.filter(p => {
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const installed = allPlugins.filter(p => p.is_installed || installedPlugins.has(p.id));

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="App Marketplace" subtitle="Plugin framework · Extension SDK · Widget framework · Custom dashboards">
        <Button size="sm" className="gap-2" onClick={() => setShowPublish(true)}>
          <Plus className="w-4 h-4" /> Publish Plugin
        </Button>
      </PageHeader>

      {/* Hero Banner */}
      <Card className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-1">Extend WMS Pro</h3>
              <p className="text-sm opacity-80">Browse {allPlugins.length} plugins, build custom integrations with our Extension SDK, or create reusable widgets for your dashboards.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">Extension SDK Docs</Button>
              <Button variant="outline" size="sm" className="text-primary-foreground border-primary-foreground/30">Widget Framework</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse All</TabsTrigger>
          <TabsTrigger value="installed">Installed ({installed.length})</TabsTrigger>
          <TabsTrigger value="sdk">SDK & Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plugins..." className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.keys(CATEGORY_ICON).map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p, i) => (
              <PluginCard key={p.id || i} plugin={p} onInstall={handleInstall} onUninstall={handleUninstall} onView={setViewing} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="installed">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {installed.length === 0 && <p className="col-span-3 text-center py-8 text-muted-foreground">No plugins installed yet.</p>}
            {installed.map((p, i) => (
              <PluginCard key={p.id || i} plugin={p} onInstall={handleInstall} onUninstall={handleUninstall} onView={setViewing} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sdk">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: 'Plugin Framework', icon: Puzzle, desc: 'Build full-featured plugins with access to WMS Pro data APIs, events, and UI slots.', docs: ['Plugin manifest spec', 'Lifecycle hooks', 'Data API access', 'Permission scopes'] },
              { title: 'Extension SDK', icon: Code2, desc: 'TypeScript SDK for building type-safe extensions with auto-complete and schema validation.', docs: ['SDK installation', 'Entity access', 'Event subscriptions', 'UI injection points'] },
              { title: 'Widget Framework', icon: Puzzle, desc: 'Create embeddable widgets that users can pin to dashboards with configurable data sources.', docs: ['Widget anatomy', 'Data bindings', 'Config schema', 'Responsive layouts'] },
              { title: 'Workflow Extensions', icon: Zap, desc: 'Extend the workflow engine with custom action types, trigger conditions, and approval gates.', docs: ['Custom actions', 'Condition builders', 'External triggers', 'Webhook payloads'] },
            ].map(section => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <section.icon className="w-5 h-5 text-primary" />
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{section.desc}</p>
                  <ul className="space-y-1">
                    {section.docs.map(d => (
                      <li key={d} className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1">
                        <Code2 className="w-3 h-3" /> {d}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Plugin Detail */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewing.name}
                  {viewing.is_verified && <CheckCircle className="w-4 h-4 text-blue-500" />}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>By {viewing.publisher}</span>
                  <StarRating rating={viewing.rating} />
                  <span>{viewing.install_count?.toLocaleString()} installs</span>
                </div>
                <p className="text-sm">{viewing.description}</p>
                <div>
                  <p className="text-xs font-medium mb-1">Required Permissions</p>
                  <div className="flex flex-wrap gap-1">
                    {viewing.permissions?.map(p => <span key={p} className="text-[10px] bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">{p}</span>)}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-lg">{viewing.price_model === 'free' ? 'Free' : viewing.price_model === 'freemium' ? 'Freemium' : `$${viewing.price_usd}/mo`}</span>
                  <Button onClick={() => { handleInstall(viewing); setViewing(null); }} className="gap-2">
                    <Download className="w-4 h-4" /> Install Plugin
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={showPublish} onOpenChange={setShowPublish}>
        <DialogContent>
          <DialogHeader><DialogTitle>Publish Plugin</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>To publish a plugin to the WMS Pro Marketplace:</p>
            <ol className="list-decimal ml-4 space-y-1 text-xs">
              <li>Build your plugin using the Extension SDK</li>
              <li>Submit your plugin manifest (plugin.json)</li>
              <li>Complete security review (1-3 business days)</li>
              <li>Set pricing model and publish</li>
            </ol>
            <Button className="w-full">Open Developer Portal</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}