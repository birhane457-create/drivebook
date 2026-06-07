import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import {
  Code2, Key, Book, Zap, Plus, Copy, Eye, EyeOff, CheckCircle,
  Globe, Terminal, Download, ExternalLink, Shield, Activity
} from 'lucide-react';

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/products', description: 'List all products', auth: 'Bearer', scope: 'products:read' },
  { method: 'POST', path: '/api/v1/products', description: 'Create a product', auth: 'Bearer', scope: 'products:write' },
  { method: 'GET', path: '/api/v1/inventory/stock-levels', description: 'Get stock levels', auth: 'Bearer', scope: 'inventory:read' },
  { method: 'POST', path: '/api/v1/sales', description: 'Create a sale', auth: 'Bearer', scope: 'sales:write' },
  { method: 'GET', path: '/api/v1/customers', description: 'List customers', auth: 'Bearer', scope: 'customers:read' },
  { method: 'GET', path: '/api/v1/purchase-orders', description: 'List purchase orders', auth: 'Bearer', scope: 'purchasing:read' },
  { method: 'POST', path: '/api/v1/purchase-orders', description: 'Create a purchase order', auth: 'Bearer', scope: 'purchasing:write' },
  { method: 'GET', path: '/api/v1/suppliers', description: 'List suppliers', auth: 'Bearer', scope: 'suppliers:read' },
  { method: 'GET', path: '/api/v1/reports/summary', description: 'Executive summary report', auth: 'Bearer', scope: 'reports:read' },
  { method: 'GET', path: '/api/v1/webhooks', description: 'List webhook endpoints', auth: 'Bearer', scope: 'webhooks:read' },
  { method: 'POST', path: '/api/v1/webhooks', description: 'Register webhook', auth: 'Bearer', scope: 'webhooks:write' },
];

const SCOPES = [
  { scope: 'products:read', desc: 'Read product catalog' },
  { scope: 'products:write', desc: 'Create and update products' },
  { scope: 'inventory:read', desc: 'Read stock levels' },
  { scope: 'inventory:write', desc: 'Adjust stock levels' },
  { scope: 'sales:read', desc: 'Read sales records' },
  { scope: 'sales:write', desc: 'Create sales' },
  { scope: 'purchasing:read', desc: 'Read purchase orders' },
  { scope: 'purchasing:write', desc: 'Create and update POs' },
  { scope: 'customers:read', desc: 'Read customer data' },
  { scope: 'reports:read', desc: 'Access analytics reports' },
  { scope: 'webhooks:read', desc: 'Read webhook config' },
  { scope: 'webhooks:write', desc: 'Register webhooks' },
  { scope: 'admin', desc: 'Full administrative access' },
];

const SDK_SAMPLES = {
  javascript: `import { WMSPro } from '@wmspro/sdk';

const client = new WMSPro({
  apiKey: 'your_api_key_here',
  baseUrl: 'https://api.wmspro.io/v1'
});

// Get products
const products = await client.products.list({ 
  limit: 50, 
  category: 'electronics' 
});

// Create a sale
const sale = await client.sales.create({
  customer_id: 'cust_123',
  items: [{ product_id: 'prod_456', quantity: 2 }]
});`,
  python: `from wmspro import WMSPro

client = WMSPro(
    api_key='your_api_key_here',
    base_url='https://api.wmspro.io/v1'
)

# Get products
products = client.products.list(limit=50, category='electronics')

# Create a sale
sale = client.sales.create(
    customer_id='cust_123',
    items=[{'product_id': 'prod_456', 'quantity': 2}]
)`,
  curl: `# List products
curl -X GET https://api.wmspro.io/v1/products \\
  -H "Authorization: Bearer your_api_key_here" \\
  -H "Content-Type: application/json"

# Create a sale
curl -X POST https://api.wmspro.io/v1/sales \\
  -H "Authorization: Bearer your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"customer_id":"cust_123","items":[{"product_id":"prod_456","quantity":2}]}'`,
};

const METHOD_COLORS = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  PATCH: 'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
};

function OAuthAppCard({ app, onReveal }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{app.name}</span>
              <Badge className={`text-[10px] ${app.status === 'production' ? 'bg-green-100 text-green-700' : app.status === 'development' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                {app.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{app.description}</p>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-20">Client ID</span>
                <code className="bg-muted px-2 py-0.5 rounded font-mono">{app.client_id}</code>
                <button onClick={() => navigator.clipboard.writeText(app.client_id)}>
                  <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-20">Secret</span>
                <code className="bg-muted px-2 py-0.5 rounded font-mono">{revealed ? 'sk_live_••••abcd' : '••••••••••••••••'}</code>
                <button onClick={() => setRevealed(r => !r)}>
                  {revealed ? <EyeOff className="w-3 h-3 text-muted-foreground" /> : <Eye className="w-3 h-3 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {app.scopes?.slice(0, 4).map(s => (
                <span key={s} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{(app.api_call_count || 0).toLocaleString()} calls</p>
            {app.last_used && <p className="mt-0.5">Last: {app.last_used}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeveloperPortal() {
  const [showNewApp, setShowNewApp] = useState(false);
  const [sdkLang, setSdkLang] = useState('javascript');
  const [copiedEndpoint, setCopiedEndpoint] = useState(null);
  const [appForm, setAppForm] = useState({ name: '', description: '', redirect_uris: '', scopes: [], status: 'development' });
  const [filterTag, setFilterTag] = useState('all');
  const qc = useQueryClient();

  const { data: oauthApps = [] } = useQuery({
    queryKey: ['oauth-apps'],
    queryFn: () => base44.entities.OAuthApp.list('-created_date', 50),
  });

  const createAppMut = useMutation({
    mutationFn: (d) => base44.entities.OAuthApp.create({
      ...d,
      client_id: `client_${Math.random().toString(36).slice(2, 12)}`,
      redirect_uris: d.redirect_uris ? d.redirect_uris.split('\n').map(u => u.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => { qc.invalidateQueries(['oauth-apps']); setShowNewApp(false); },
  });

  const SAMPLE_APPS = [
    { id: 'sample1', name: 'Shopify Connector', description: 'Bi-directional product and order sync', client_id: 'client_ab12cd34ef', status: 'production', scopes: ['products:read', 'sales:write', 'inventory:read'], api_call_count: 48230, last_used: '2 min ago' },
    { id: 'sample2', name: 'Custom ERP Bridge', description: 'Internal ERP integration for finance team', client_id: 'client_gh56ij78kl', status: 'development', scopes: ['purchasing:read', 'reports:read'], api_call_count: 1204, last_used: '1 hr ago' },
  ];

  const allApps = [...SAMPLE_APPS, ...oauthApps];

  function copyCode(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  }

  const filteredEndpoints = API_ENDPOINTS.filter(e => {
    if (filterTag === 'all') return true;
    return e.path.includes(`/${filterTag}`);
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Developer Portal" subtitle="API docs · OAuth apps · SDK · Webhooks · Sandbox">
        <Button size="sm" className="gap-2" onClick={() => setShowNewApp(true)}>
          <Plus className="w-4 h-4" /> Register App
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Registered Apps', value: allApps.length, icon: Code2 },
          { label: 'API Endpoints', value: API_ENDPOINTS.length, icon: Globe },
          { label: 'OAuth Scopes', value: SCOPES.length, icon: Shield },
          { label: 'API Calls Today', value: '49.4K', icon: Activity },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className="w-8 h-8 text-primary/60" />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="apps">
        <TabsList>
          <TabsTrigger value="apps">OAuth Apps</TabsTrigger>
          <TabsTrigger value="docs">API Reference</TabsTrigger>
          <TabsTrigger value="sdk">SDK & Code</TabsTrigger>
          <TabsTrigger value="scopes">Scopes</TabsTrigger>
          <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
        </TabsList>

        <TabsContent value="apps" className="space-y-3">
          {allApps.map((app, i) => <OAuthAppCard key={app.id || i} app={app} />)}
          {allApps.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              No OAuth apps yet. <button onClick={() => setShowNewApp(true)} className="text-primary underline">Register your first app</button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="docs" className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {['all', 'products', 'inventory', 'sales', 'customers', 'purchase-orders', 'suppliers', 'reports', 'webhooks'].map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterTag === tag ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredEndpoints.map((ep, i) => (
              <Card key={i}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Badge className={`text-[10px] w-12 justify-center flex-shrink-0 ${METHOD_COLORS[ep.method]}`}>{ep.method}</Badge>
                  <code className="text-xs font-mono text-primary flex-1">{ep.path}</code>
                  <span className="text-xs text-muted-foreground hidden md:block">{ep.description}</span>
                  <Badge variant="outline" className="text-[10px] hidden lg:flex">{ep.scope}</Badge>
                  <button onClick={() => copyCode(`curl -X ${ep.method} https://api.wmspro.io/v1${ep.path.replace('/api/v1', '')} -H "Authorization: Bearer YOUR_KEY"`, i)}>
                    {copiedEndpoint === i
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    }
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sdk" className="space-y-4">
          <div className="flex gap-2">
            {['javascript', 'python', 'curl'].map(lang => (
              <button
                key={lang}
                onClick={() => setSdkLang(lang)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${sdkLang === lang ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
              >
                {lang === 'javascript' ? 'JavaScript' : lang === 'python' ? 'Python' : 'cURL'}
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm capitalize">{sdkLang} SDK Example</CardTitle>
                <button onClick={() => copyCode(SDK_SAMPLES[sdkLang], 'sdk')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  {copiedEndpoint === 'sdk' ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-950 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre leading-relaxed">
                {SDK_SAMPLES[sdkLang]}
              </pre>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { lang: 'JavaScript / TypeScript', pkg: 'npm install @wmspro/sdk', icon: '📦' },
              { lang: 'Python', pkg: 'pip install wmspro', icon: '🐍' },
              { lang: 'Go', pkg: 'go get github.com/wmspro/go-sdk', icon: '🐹' },
            ].map(sdk => (
              <Card key={sdk.lang}>
                <CardContent className="p-4">
                  <p className="text-lg mb-1">{sdk.icon}</p>
                  <p className="font-medium text-sm">{sdk.lang}</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block mt-2 font-mono">{sdk.pkg}</code>
                  <Button size="sm" variant="outline" className="mt-3 h-7 text-xs gap-1 w-full">
                    <Download className="w-3 h-3" /> Download
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scopes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SCOPES.map(s => (
              <Card key={s.scope}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <code className="text-xs font-mono font-bold">{s.scope}</code>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sandbox">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Terminal className="w-10 h-10 text-primary/60" />
                <div className="flex-1">
                  <h3 className="font-bold mb-1">Interactive API Sandbox</h3>
                  <p className="text-sm text-muted-foreground mb-4">Test API calls against a sandboxed dataset without affecting production data. All sandbox data resets every 24 hours.</p>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <Select defaultValue="GET">
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['GET','POST','PUT','PATCH','DELETE'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input defaultValue="https://sandbox.wmspro.io/api/v1/products" className="flex-1 font-mono text-xs" />
                      <Button className="gap-2"><Zap className="w-4 h-4" /> Send</Button>
                    </div>
                    <div className="bg-gray-950 text-gray-100 rounded-lg p-4 text-xs font-mono min-h-32">
                      <span className="text-green-400">// Response will appear here</span>
                      <br />
                      <span className="text-gray-500">// Click Send to execute the request</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="border rounded-lg p-3">
                  <p className="font-bold text-lg">∞</p>
                  <p className="text-muted-foreground">No rate limits in sandbox</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-bold text-lg">24h</p>
                  <p className="text-muted-foreground">Data reset cycle</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-bold text-lg">100%</p>
                  <p className="text-muted-foreground">Production API parity</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Register App Dialog */}
      <Dialog open={showNewApp} onOpenChange={setShowNewApp}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Register OAuth App</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>App Name</Label><Input value={appForm.name} onChange={e => setAppForm(p => ({ ...p, name: e.target.value }))} placeholder="My Integration" /></div>
            <div><Label>Description</Label><Input value={appForm.description} onChange={e => setAppForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div>
              <Label>Redirect URIs (one per line)</Label>
              <Textarea value={appForm.redirect_uris} onChange={e => setAppForm(p => ({ ...p, redirect_uris: e.target.value }))} placeholder="https://myapp.com/callback" rows={3} className="font-mono text-xs" />
            </div>
            <div>
              <Label>Environment</Label>
              <Select value={appForm.status} onValueChange={v => setAppForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Requested Scopes</Label>
              <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                {SCOPES.map(s => (
                  <label key={s.scope} className="flex items-center gap-2 text-xs p-1.5 hover:bg-muted rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appForm.scopes.includes(s.scope)}
                      onChange={e => setAppForm(p => ({
                        ...p,
                        scopes: e.target.checked ? [...p.scopes, s.scope] : p.scopes.filter(x => x !== s.scope)
                      }))}
                    />
                    <code className="font-mono">{s.scope}</code>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewApp(false)}>Cancel</Button>
              <Button onClick={() => createAppMut.mutate(appForm)} disabled={!appForm.name || createAppMut.isPending}>
                Register App
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}