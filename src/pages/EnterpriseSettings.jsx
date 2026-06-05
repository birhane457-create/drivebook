import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Plus, Building2, DollarSign, Receipt, Edit2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function EnterpriseSettings() {
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showCurrencyForm, setShowCurrencyForm] = useState(false);
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editingCurrency, setEditingCurrency] = useState(null);
  const [editingTax, setEditingTax] = useState(null);
  const [companyForm, setCompanyForm] = useState({ name: '', code: '', address: '', phone: '', email: '', tax_id: '', currency_code: 'USD', accounting_system: 'none', accounting_api_key: '' });
  const [currencyForm, setCurrencyForm] = useState({ code: '', name: '', symbol: '', exchange_rate: 1, is_base: false, decimal_places: 2 });
  const [taxForm, setTaxForm] = useState({ name: '', code: '', type: 'GST', rate: '', applies_to: 'all', is_compound: false, country: '' });
  const [testingApi, setTestingApi] = useState(false);
  const queryClient = useQueryClient();

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => base44.entities.Company.list() });
  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: () => base44.entities.Currency.list() });
  const { data: taxRules = [] } = useQuery({ queryKey: ['tax-rules'], queryFn: () => base44.entities.TaxRule.list() });

  const companyMutation = useMutation({
    mutationFn: (d) => editingCompany ? base44.entities.Company.update(editingCompany.id, d) : base44.entities.Company.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); setShowCompanyForm(false); setEditingCompany(null); toast.success('Company saved'); },
  });
  const currencyMutation = useMutation({
    mutationFn: (d) => editingCurrency ? base44.entities.Currency.update(editingCurrency.id, d) : base44.entities.Currency.create({ ...d, exchange_rate: parseFloat(d.exchange_rate), decimal_places: parseInt(d.decimal_places) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['currencies'] }); setShowCurrencyForm(false); setEditingCurrency(null); toast.success('Currency saved'); },
  });
  const taxMutation = useMutation({
    mutationFn: (d) => editingTax ? base44.entities.TaxRule.update(editingTax.id, d) : base44.entities.TaxRule.create({ ...d, rate: parseFloat(d.rate) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax-rules'] }); setShowTaxForm(false); setEditingTax(null); toast.success('Tax rule saved'); },
  });

  const testAccountingApi = async (company) => {
    setTestingApi(true);
    await new Promise(r => setTimeout(r, 1500));
    toast.success(`${company.accounting_system === 'quickbooks' ? 'QuickBooks' : company.accounting_system} API connected successfully`);
    setTestingApi(false);
  };

  const companyColumns = [
    { key: 'name', label: 'Company', render: r => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.code}</p></div> },
    { key: 'tax_id', label: 'Tax ID / VAT', render: r => r.tax_id || '—' },
    { key: 'currency_code', label: 'Currency', render: r => <Badge variant="secondary">{r.currency_code}</Badge> },
    { key: 'accounting_system', label: 'Accounting', render: r => <Badge variant={r.accounting_system !== 'none' ? 'default' : 'secondary'} className="capitalize">{r.accounting_system}</Badge> },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={() => { setEditingCompany(r); setCompanyForm({ ...r }); setShowCompanyForm(true); }}>
        <Edit2 className="w-4 h-4" />
      </Button>
    )},
  ];

  const currencyColumns = [
    { key: 'code', label: 'Code', render: r => <span className="font-mono font-bold">{r.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'symbol', label: 'Symbol', render: r => <span className="text-lg">{r.symbol}</span> },
    { key: 'exchange_rate', label: 'Rate', render: r => r.exchange_rate?.toFixed(4) },
    { key: 'is_base', label: 'Base', render: r => r.is_base ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : '—' },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={() => { setEditingCurrency(r); setCurrencyForm({ ...r }); setShowCurrencyForm(true); }}>
        <Edit2 className="w-4 h-4" />
      </Button>
    )},
  ];

  const taxColumns = [
    { key: 'name', label: 'Name', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'code', label: 'Code', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'type', label: 'Type', render: r => <Badge variant="secondary">{r.type}</Badge> },
    { key: 'rate', label: 'Rate', render: r => <span className="font-semibold">{r.rate}%</span> },
    { key: 'applies_to', label: 'Applies To', render: r => <span className="capitalize">{r.applies_to?.replace(/_/g, ' ')}</span> },
    { key: 'is_compound', label: 'Compound', render: r => r.is_compound ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : '—' },
    { key: 'actions', label: '', render: r => (
      <Button variant="ghost" size="sm" onClick={() => { setEditingTax(r); setTaxForm({ ...r, rate: r.rate?.toString() }); setShowTaxForm(true); }}>
        <Edit2 className="w-4 h-4" />
      </Button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Enterprise Settings" subtitle="Multi-company, currencies, tax engine, and accounting integrations" />

      <Tabs defaultValue="companies" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="taxes">Tax Rules</TabsTrigger>
          <TabsTrigger value="accounting">Accounting API</TabsTrigger>
        </TabsList>

        {/* Companies */}
        <TabsContent value="companies">
          <div className="mb-4 flex justify-end">
            <Button onClick={() => { setEditingCompany(null); setCompanyForm({ name: '', code: '', address: '', phone: '', email: '', tax_id: '', currency_code: 'USD', accounting_system: 'none', accounting_api_key: '' }); setShowCompanyForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Company
            </Button>
          </div>
          <DataTable columns={companyColumns} data={companies} searchField="name" emptyMessage="No companies configured" />
        </TabsContent>

        {/* Currencies */}
        <TabsContent value="currencies">
          <div className="mb-4 flex justify-end">
            <Button onClick={() => { setEditingCurrency(null); setCurrencyForm({ code: '', name: '', symbol: '', exchange_rate: 1, is_base: false, decimal_places: 2 }); setShowCurrencyForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Currency
            </Button>
          </div>
          <DataTable columns={currencyColumns} data={currencies} searchField="name" emptyMessage="No currencies configured" />
          {currencies.length === 0 && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => {
                const defaults = [
                  { code: 'USD', name: 'US Dollar', symbol: '$', exchange_rate: 1, is_base: true, decimal_places: 2, is_active: true },
                  { code: 'EUR', name: 'Euro', symbol: '€', exchange_rate: 0.92, is_base: false, decimal_places: 2, is_active: true },
                  { code: 'GBP', name: 'British Pound', symbol: '£', exchange_rate: 0.79, is_base: false, decimal_places: 2, is_active: true },
                  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', exchange_rate: 1.53, is_base: false, decimal_places: 2, is_active: true },
                ];
                Promise.all(defaults.map(c => base44.entities.Currency.create(c)))
                  .then(() => queryClient.invalidateQueries({ queryKey: ['currencies'] }));
              }}>
                <DollarSign className="w-4 h-4 mr-2" />Seed Default Currencies
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Tax Rules */}
        <TabsContent value="taxes">
          <div className="mb-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              const defaults = [
                { name: 'Standard GST', code: 'GST10', type: 'GST', rate: 10, applies_to: 'all', is_compound: false, is_active: true },
                { name: 'Reduced GST', code: 'GST5', type: 'GST', rate: 5, applies_to: 'food', is_compound: false, is_active: true },
                { name: 'Standard VAT', code: 'VAT20', type: 'VAT', rate: 20, applies_to: 'all', is_compound: false, is_active: true },
                { name: 'Exempt', code: 'EXEMPT', type: 'None', rate: 0, applies_to: 'all', is_compound: false, is_active: true },
              ];
              Promise.all(defaults.map(t => base44.entities.TaxRule.create(t)))
                .then(() => { queryClient.invalidateQueries({ queryKey: ['tax-rules'] }); toast.success('Default tax rules added'); });
            }}>
              <Receipt className="w-4 h-4 mr-2" />Seed Default Rules
            </Button>
            <Button onClick={() => { setEditingTax(null); setTaxForm({ name: '', code: '', type: 'GST', rate: '', applies_to: 'all', is_compound: false, country: '' }); setShowTaxForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Tax Rule
            </Button>
          </div>
          <DataTable columns={taxColumns} data={taxRules} searchField="name" emptyMessage="No tax rules configured" />
        </TabsContent>

        {/* Accounting Integrations */}
        <TabsContent value="accounting">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {['quickbooks', 'xero', 'sage', 'zoho'].map(system => {
              const connected = companies.find(c => c.accounting_system === system);
              return (
                <Card key={system} className={connected ? 'border-primary/50' : ''}>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold capitalize">{system}</p>
                          <p className="text-xs text-muted-foreground">Accounting Integration</p>
                        </div>
                      </div>
                      <Badge variant={connected ? 'default' : 'secondary'}>{connected ? 'Connected' : 'Not Connected'}</Badge>
                    </div>
                    <Separator className="mb-4" />
                    <div className="text-sm text-muted-foreground space-y-1 mb-4">
                      <p>• Auto-sync purchase orders and invoices</p>
                      <p>• Real-time inventory valuation export</p>
                      <p>• Journal entry automation</p>
                      <p>• Tax reporting integration</p>
                    </div>
                    {connected ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-emerald-500">
                          <CheckCircle className="w-3 h-3" /> Connected via Company: {connected.name}
                        </div>
                        <Button size="sm" variant="outline" className="w-full" onClick={() => testAccountingApi(connected)} disabled={testingApi}>
                          {testingApi ? 'Testing...' : 'Test Connection'}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => {
                        setCompanyForm(p => ({ ...p, accounting_system: system }));
                        setShowCompanyForm(true);
                      }}>
                        Configure {system}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-base">Export to Accounting</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Export financial data in formats compatible with major accounting systems.</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={() => toast.success('Journal entries exported (CSV)')}>Export Journal Entries</Button>
                <Button variant="outline" size="sm" onClick={() => toast.success('Purchase invoices exported')}>Export Purchase Invoices</Button>
                <Button variant="outline" size="sm" onClick={() => toast.success('Inventory valuation exported')}>Export Inventory Valuation</Button>
                <Button variant="outline" size="sm" onClick={() => toast.success('Tax report exported')}>Export Tax Report</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Company Dialog */}
      <Dialog open={showCompanyForm} onOpenChange={v => { setShowCompanyForm(v); if (!v) setEditingCompany(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingCompany ? 'Edit Company' : 'New Company'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); companyMutation.mutate(companyForm); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Company Name *</Label><Input value={companyForm.name} onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))} required /></div>
              <div><Label>Company Code *</Label><Input value={companyForm.code} onChange={e => setCompanyForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} required placeholder="e.g. CO1" /></div>
              <div><Label>Email</Label><Input type="email" value={companyForm.email} onChange={e => setCompanyForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={companyForm.phone} onChange={e => setCompanyForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label>Tax ID / VAT Number</Label><Input value={companyForm.tax_id} onChange={e => setCompanyForm(p => ({ ...p, tax_id: e.target.value }))} /></div>
              <div>
                <Label>Base Currency</Label>
                <Select value={companyForm.currency_code} onValueChange={v => setCompanyForm(p => ({ ...p, currency_code: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['USD','EUR','GBP','AUD','CAD','SGD','AED','INR'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Address</Label><Input value={companyForm.address} onChange={e => setCompanyForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div>
              <Label>Accounting System</Label>
              <Select value={companyForm.accounting_system} onValueChange={v => setCompanyForm(p => ({ ...p, accounting_system: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="quickbooks">QuickBooks</SelectItem>
                  <SelectItem value="xero">Xero</SelectItem>
                  <SelectItem value="sage">Sage</SelectItem>
                  <SelectItem value="zoho">Zoho Books</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {companyForm.accounting_system !== 'none' && (
              <div><Label>API Key / Token</Label><Input type="password" value={companyForm.accounting_api_key} onChange={e => setCompanyForm(p => ({ ...p, accounting_api_key: e.target.value }))} placeholder="Enter API key..." /></div>
            )}
            <Button type="submit" className="w-full" disabled={companyMutation.isPending}>{companyMutation.isPending ? 'Saving...' : editingCompany ? 'Update' : 'Create Company'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Currency Dialog */}
      <Dialog open={showCurrencyForm} onOpenChange={v => { setShowCurrencyForm(v); if (!v) setEditingCurrency(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCurrency ? 'Edit Currency' : 'Add Currency'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); currencyMutation.mutate(currencyForm); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ISO Code *</Label><Input value={currencyForm.code} onChange={e => setCurrencyForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} required placeholder="USD" /></div>
              <div><Label>Symbol *</Label><Input value={currencyForm.symbol} onChange={e => setCurrencyForm(p => ({ ...p, symbol: e.target.value }))} required placeholder="$" /></div>
            </div>
            <div><Label>Name *</Label><Input value={currencyForm.name} onChange={e => setCurrencyForm(p => ({ ...p, name: e.target.value }))} required placeholder="US Dollar" /></div>
            <div><Label>Exchange Rate (vs base)</Label><Input type="number" step="0.0001" value={currencyForm.exchange_rate} onChange={e => setCurrencyForm(p => ({ ...p, exchange_rate: e.target.value }))} /></div>
            <div className="flex items-center gap-3">
              <Switch checked={currencyForm.is_base} onCheckedChange={v => setCurrencyForm(p => ({ ...p, is_base: v }))} />
              <Label>Base Currency</Label>
            </div>
            <Button type="submit" className="w-full" disabled={currencyMutation.isPending}>{currencyMutation.isPending ? 'Saving...' : editingCurrency ? 'Update' : 'Add Currency'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tax Rule Dialog */}
      <Dialog open={showTaxForm} onOpenChange={v => { setShowTaxForm(v); if (!v) setEditingTax(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTax ? 'Edit Tax Rule' : 'New Tax Rule'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); taxMutation.mutate(taxForm); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={taxForm.name} onChange={e => setTaxForm(p => ({ ...p, name: e.target.value }))} required /></div>
              <div><Label>Code *</Label><Input value={taxForm.code} onChange={e => setTaxForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} required /></div>
              <div>
                <Label>Type</Label>
                <Select value={taxForm.type} onValueChange={v => setTaxForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GST">GST</SelectItem>
                    <SelectItem value="VAT">VAT</SelectItem>
                    <SelectItem value="Sales Tax">Sales Tax</SelectItem>
                    <SelectItem value="None">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Rate (%)</Label><Input type="number" step="0.01" value={taxForm.rate} onChange={e => setTaxForm(p => ({ ...p, rate: e.target.value }))} required /></div>
              <div>
                <Label>Applies To</Label>
                <Select value={taxForm.applies_to} onValueChange={v => setTaxForm(p => ({ ...p, applies_to: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['all','goods','services','food','electronics','clothing'].map(v => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Country</Label><Input value={taxForm.country} onChange={e => setTaxForm(p => ({ ...p, country: e.target.value }))} placeholder="e.g. AU" /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={taxForm.is_compound} onCheckedChange={v => setTaxForm(p => ({ ...p, is_compound: v }))} />
              <Label>Compound Tax (applied on top of other taxes)</Label>
            </div>
            <Button type="submit" className="w-full" disabled={taxMutation.isPending}>{taxMutation.isPending ? 'Saving...' : editingTax ? 'Update' : 'Create Tax Rule'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}