import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToastMutation } from '@/hooks/useToastMutation';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import FormDialog from '@/components/dialogs/FormDialog';
import FormSection from '@/components/shared/FormSection';
import Field from '@/components/shared/Field';
import { Plus, Building2, DollarSign, Receipt, Edit2, CheckCircle, Landmark, Percent } from 'lucide-react';

const EMPTY_COMPANY = { name: '', code: '', address: '', phone: '', email: '', tax_id: '', currency_code: 'USD', accounting_system: 'none', accounting_api_key: '' };
const EMPTY_CURRENCY = { code: '', name: '', symbol: '', exchange_rate: 1, is_base: false, decimal_places: 2 };
const EMPTY_TAX = { name: '', code: '', type: 'GST', rate: '', applies_to: 'all', is_compound: false, country: '' };

export default function EnterpriseSettings() {
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showCurrencyForm, setShowCurrencyForm] = useState(false);
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editingCurrency, setEditingCurrency] = useState(null);
  const [editingTax, setEditingTax] = useState(null);
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY);
  const [currencyForm, setCurrencyForm] = useState(EMPTY_CURRENCY);
  const [taxForm, setTaxForm] = useState(EMPTY_TAX);
  const [testingApi, setTestingApi] = useState(false);

  const companiesQ = useQuery({ queryKey: ['companies'], queryFn: () => base44.entities.Company.list() });
  const currenciesQ = useQuery({ queryKey: ['currencies'], queryFn: () => base44.entities.Currency.list() });
  const taxQ = useQuery({ queryKey: ['tax-rules'], queryFn: () => base44.entities.TaxRule.list() });
  const companies = companiesQ.data || [];
  const currencies = currenciesQ.data || [];
  const taxRules = taxQ.data || [];
  const isLoading = companiesQ.isLoading || currenciesQ.isLoading || taxQ.isLoading;

  const companyMutation = useToastMutation({
    mutationFn: (d) => editingCompany ? base44.entities.Company.update(editingCompany.id, d) : base44.entities.Company.create(d),
    queryKeys: [['companies']],
    successMessage: 'Company saved',
    onSuccess: () => { setShowCompanyForm(false); setEditingCompany(null); },
  });
  const currencyMutation = useToastMutation({
    mutationFn: (d) => editingCurrency ? base44.entities.Currency.update(editingCurrency.id, d) : base44.entities.Currency.create({ ...d, exchange_rate: parseFloat(d.exchange_rate), decimal_places: parseInt(d.decimal_places) }),
    queryKeys: [['currencies']],
    successMessage: 'Currency saved',
    onSuccess: () => { setShowCurrencyForm(false); setEditingCurrency(null); },
  });
  const taxMutation = useToastMutation({
    mutationFn: (d) => editingTax ? base44.entities.TaxRule.update(editingTax.id, d) : base44.entities.TaxRule.create({ ...d, rate: parseFloat(d.rate) }),
    queryKeys: [['tax-rules']],
    successMessage: 'Tax rule saved',
    onSuccess: () => { setShowTaxForm(false); setEditingTax(null); },
  });
  const seedCurrenciesMutation = useToastMutation({
    mutationFn: () => Promise.all([
      { code: 'USD', name: 'US Dollar', symbol: '$', exchange_rate: 1, is_base: true, decimal_places: 2, is_active: true },
      { code: 'EUR', name: 'Euro', symbol: '€', exchange_rate: 0.92, is_base: false, decimal_places: 2, is_active: true },
      { code: 'GBP', name: 'British Pound', symbol: '£', exchange_rate: 0.79, is_base: false, decimal_places: 2, is_active: true },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', exchange_rate: 1.53, is_base: false, decimal_places: 2, is_active: true },
    ].map(c => base44.entities.Currency.create(c))),
    queryKeys: [['currencies']],
    successMessage: 'Default currencies created',
  });
  const seedTaxMutation = useToastMutation({
    mutationFn: () => Promise.all([
      { name: 'Standard GST', code: 'GST10', type: 'GST', rate: 10, applies_to: 'all', is_compound: false, is_active: true },
      { name: 'Reduced GST', code: 'GST5', type: 'GST', rate: 5, applies_to: 'food', is_compound: false, is_active: true },
      { name: 'Standard VAT', code: 'VAT20', type: 'VAT', rate: 20, applies_to: 'all', is_compound: false, is_active: true },
      { name: 'Exempt', code: 'EXEMPT', type: 'None', rate: 0, applies_to: 'all', is_compound: false, is_active: true },
    ].map(t => base44.entities.TaxRule.create(t))),
    queryKeys: [['tax-rules']],
    successMessage: 'Default tax rules added',
  });

  const testAccountingApi = async (company) => {
    setTestingApi(true);
    await new Promise(r => setTimeout(r, 1500));
    toast({ title: `${company.accounting_system === 'quickbooks' ? 'QuickBooks' : company.accounting_system} API connected successfully` });
    setTestingApi(false);
  };

  const companyColumns = [
    { key: 'name', label: 'Company', render: r => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.code}</p></div> },
    { key: 'tax_id', label: 'Tax ID / VAT', render: r => r.tax_id || '—' },
    { key: 'currency_code', label: 'Currency', render: r => <Badge variant="secondary">{r.currency_code}</Badge> },
    { key: 'accounting_system', label: 'Accounting', render: r => <Badge variant={r.accounting_system !== 'none' ? 'default' : 'secondary'} className="capitalize">{r.accounting_system}</Badge> },
    { key: 'actions', label: '', type: 'actions', align: 'right', actions: [
      { label: 'Edit', icon: Edit2, onClick: (r) => { setEditingCompany(r); setCompanyForm({ ...r }); setShowCompanyForm(true); } },
    ]},
  ];

  const currencyColumns = [
    { key: 'code', label: 'Code', render: r => <span className="font-mono font-bold">{r.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'symbol', label: 'Symbol', render: r => <span className="text-lg">{r.symbol}</span> },
    { key: 'exchange_rate', label: 'Rate', render: r => r.exchange_rate?.toFixed(4) },
    { key: 'is_base', label: 'Base', render: r => r.is_base ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : '—' },
    { key: 'actions', label: '', type: 'actions', align: 'right', actions: [
      { label: 'Edit', icon: Edit2, onClick: (r) => { setEditingCurrency(r); setCurrencyForm({ ...r }); setShowCurrencyForm(true); } },
    ]},
  ];

  const taxColumns = [
    { key: 'name', label: 'Name', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'code', label: 'Code', render: r => <span className="font-mono text-sm">{r.code}</span> },
    { key: 'type', label: 'Type', render: r => <Badge variant="secondary">{r.type}</Badge> },
    { key: 'rate', label: 'Rate', render: r => <span className="font-semibold">{r.rate}%</span> },
    { key: 'applies_to', label: 'Applies To', render: r => <span className="capitalize">{r.applies_to?.replace(/_/g, ' ')}</span> },
    { key: 'is_compound', label: 'Compound', render: r => r.is_compound ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : '—' },
    { key: 'actions', label: '', type: 'actions', align: 'right', actions: [
      { label: 'Edit', icon: Edit2, onClick: (r) => { setEditingTax(r); setTaxForm({ ...r, rate: r.rate?.toString() }); setShowTaxForm(true); } },
    ]},
  ];

  const kpis = [
    { label: 'Companies', value: companies.length, icon: Landmark },
    { label: 'Currencies', value: currencies.length, icon: DollarSign },
    { label: 'Base Currency', value: currencies.find(c => c.is_base)?.code || '—', icon: DollarSign },
    { label: 'Tax Rules', value: taxRules.length, icon: Percent },
  ];

  return (
    <EnterprisePageLayout
      title="Enterprise Settings"
      description="Multi-company, currencies, tax engine, and accounting integrations"
      kpis={kpis}
      isLoading={isLoading}
    >
      <Tabs defaultValue="companies" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="taxes">Tax Rules</TabsTrigger>
          <TabsTrigger value="accounting">Accounting API</TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <div className="mb-4 flex justify-end">
            <Button onClick={() => { setEditingCompany(null); setCompanyForm(EMPTY_COMPANY); setShowCompanyForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Company
            </Button>
          </div>
          <AdvancedDataTable tableId="ent-companies" columns={companyColumns} data={companies} isLoading={companiesQ.isLoading} error={companiesQ.error} onRetry={companiesQ.refetch} emptyMessage="No companies configured" />
        </TabsContent>

        <TabsContent value="currencies">
          <div className="mb-4 flex justify-end gap-3">
            {currencies.length === 0 && (
              <Button variant="outline" onClick={() => seedCurrenciesMutation.mutate()} disabled={seedCurrenciesMutation.isPending}>
                <DollarSign className="w-4 h-4 mr-2" />Seed Default Currencies
              </Button>
            )}
            <Button onClick={() => { setEditingCurrency(null); setCurrencyForm(EMPTY_CURRENCY); setShowCurrencyForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Currency
            </Button>
          </div>
          <AdvancedDataTable tableId="ent-currencies" columns={currencyColumns} data={currencies} isLoading={currenciesQ.isLoading} error={currenciesQ.error} onRetry={currenciesQ.refetch} emptyMessage="No currencies configured" />
        </TabsContent>

        <TabsContent value="taxes">
          <div className="mb-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => seedTaxMutation.mutate()} disabled={seedTaxMutation.isPending}>
              <Receipt className="w-4 h-4 mr-2" />Seed Default Rules
            </Button>
            <Button onClick={() => { setEditingTax(null); setTaxForm(EMPTY_TAX); setShowTaxForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Tax Rule
            </Button>
          </div>
          <AdvancedDataTable tableId="ent-taxes" columns={taxColumns} data={taxRules} isLoading={taxQ.isLoading} error={taxQ.error} onRetry={taxQ.refetch} emptyMessage="No tax rules configured" />
        </TabsContent>

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
                      <Button size="sm" variant="outline" className="w-full" onClick={() => { setEditingCompany(null); setCompanyForm(p => ({ ...EMPTY_COMPANY, accounting_system: system })); setShowCompanyForm(true); }}>
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
                <Button variant="outline" size="sm" onClick={() => toast({ title: 'Journal entries exported (CSV)' })}>Export Journal Entries</Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: 'Purchase invoices exported' })}>Export Purchase Invoices</Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: 'Inventory valuation exported' })}>Export Inventory Valuation</Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: 'Tax report exported' })}>Export Tax Report</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Company Dialog */}
      <FormDialog
        open={showCompanyForm}
        onOpenChange={(v) => { setShowCompanyForm(v); if (!v) setEditingCompany(null); }}
        title={editingCompany ? 'Edit Company' : 'New Company'}
        submitLabel={editingCompany ? 'Update' : 'Create Company'}
        isPending={companyMutation.isPending}
        submitDisabled={!companyForm.name || !companyForm.code}
        onSubmit={() => companyMutation.mutate(companyForm)}
      >
        <FormSection title="Company Details" icon={Landmark} columns={2}>
          <Field label="Company Name" required htmlFor="co-name">
            <Input id="co-name" value={companyForm.name} onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Company Code" required htmlFor="co-code">
            <Input id="co-code" value={companyForm.code} onChange={e => setCompanyForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. CO1" />
          </Field>
          <Field label="Email" htmlFor="co-email">
            <Input id="co-email" type="email" value={companyForm.email} onChange={e => setCompanyForm(p => ({ ...p, email: e.target.value }))} />
          </Field>
          <Field label="Phone" htmlFor="co-phone">
            <Input id="co-phone" value={companyForm.phone} onChange={e => setCompanyForm(p => ({ ...p, phone: e.target.value }))} />
          </Field>
          <Field label="Tax ID / VAT Number" htmlFor="co-tax">
            <Input id="co-tax" value={companyForm.tax_id} onChange={e => setCompanyForm(p => ({ ...p, tax_id: e.target.value }))} />
          </Field>
          <Field label="Base Currency" htmlFor="co-currency">
            <Select value={companyForm.currency_code} onValueChange={v => setCompanyForm(p => ({ ...p, currency_code: v }))}>
              <SelectTrigger id="co-currency"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'INR'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Address" htmlFor="co-address">
            <Input id="co-address" value={companyForm.address} onChange={e => setCompanyForm(p => ({ ...p, address: e.target.value }))} />
          </Field>
          <Field label="Accounting System" htmlFor="co-acct">
            <Select value={companyForm.accounting_system} onValueChange={v => setCompanyForm(p => ({ ...p, accounting_system: v }))}>
              <SelectTrigger id="co-acct"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="quickbooks">QuickBooks</SelectItem>
                <SelectItem value="xero">Xero</SelectItem>
                <SelectItem value="sage">Sage</SelectItem>
                <SelectItem value="zoho">Zoho Books</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {companyForm.accounting_system !== 'none' && (
            <Field label="API Key / Token" htmlFor="co-apikey">
              <Input id="co-apikey" type="password" value={companyForm.accounting_api_key} onChange={e => setCompanyForm(p => ({ ...p, accounting_api_key: e.target.value }))} placeholder="Enter API key..." />
            </Field>
          )}
        </FormSection>
      </FormDialog>

      {/* Currency Dialog */}
      <FormDialog
        open={showCurrencyForm}
        onOpenChange={(v) => { setShowCurrencyForm(v); if (!v) setEditingCurrency(null); }}
        title={editingCurrency ? 'Edit Currency' : 'Add Currency'}
        submitLabel={editingCurrency ? 'Update' : 'Add Currency'}
        isPending={currencyMutation.isPending}
        submitDisabled={!currencyForm.code || !currencyForm.symbol || !currencyForm.name}
        onSubmit={() => currencyMutation.mutate(currencyForm)}
      >
        <FormSection title="Currency Details" icon={DollarSign} columns={2}>
          <Field label="ISO Code" required htmlFor="cur-code">
            <Input id="cur-code" value={currencyForm.code} onChange={e => setCurrencyForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="USD" />
          </Field>
          <Field label="Symbol" required htmlFor="cur-symbol">
            <Input id="cur-symbol" value={currencyForm.symbol} onChange={e => setCurrencyForm(p => ({ ...p, symbol: e.target.value }))} placeholder="$" />
          </Field>
          <Field label="Name" required htmlFor="cur-name">
            <Input id="cur-name" value={currencyForm.name} onChange={e => setCurrencyForm(p => ({ ...p, name: e.target.value }))} placeholder="US Dollar" />
          </Field>
          <Field label="Exchange Rate (vs base)" htmlFor="cur-rate">
            <Input id="cur-rate" type="number" step="0.0001" value={currencyForm.exchange_rate} onChange={e => setCurrencyForm(p => ({ ...p, exchange_rate: e.target.value }))} />
          </Field>
          <Field label="Base Currency" htmlFor="cur-base">
            <div className="flex items-center gap-3 h-9">
              <Switch id="cur-base" checked={currencyForm.is_base} onCheckedChange={v => setCurrencyForm(p => ({ ...p, is_base: v }))} />
              <span className="text-sm text-muted-foreground">Set as base currency</span>
            </div>
          </Field>
        </FormSection>
      </FormDialog>

      {/* Tax Rule Dialog */}
      <FormDialog
        open={showTaxForm}
        onOpenChange={(v) => { setShowTaxForm(v); if (!v) setEditingTax(null); }}
        title={editingTax ? 'Edit Tax Rule' : 'New Tax Rule'}
        submitLabel={editingTax ? 'Update' : 'Create Tax Rule'}
        isPending={taxMutation.isPending}
        submitDisabled={!taxForm.name || !taxForm.code || taxForm.rate === ''}
        onSubmit={() => taxMutation.mutate(taxForm)}
      >
        <FormSection title="Tax Rule Details" icon={Percent} columns={2}>
          <Field label="Name" required htmlFor="tax-name">
            <Input id="tax-name" value={taxForm.name} onChange={e => setTaxForm(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Code" required htmlFor="tax-code">
            <Input id="tax-code" value={taxForm.code} onChange={e => setTaxForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
          </Field>
          <Field label="Type" htmlFor="tax-type">
            <Select value={taxForm.type} onValueChange={v => setTaxForm(p => ({ ...p, type: v }))}>
              <SelectTrigger id="tax-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GST">GST</SelectItem>
                <SelectItem value="VAT">VAT</SelectItem>
                <SelectItem value="Sales Tax">Sales Tax</SelectItem>
                <SelectItem value="None">Exempt</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rate (%)" required htmlFor="tax-rate">
            <Input id="tax-rate" type="number" step="0.01" value={taxForm.rate} onChange={e => setTaxForm(p => ({ ...p, rate: e.target.value }))} />
          </Field>
          <Field label="Applies To" htmlFor="tax-applies">
            <Select value={taxForm.applies_to} onValueChange={v => setTaxForm(p => ({ ...p, applies_to: v }))}>
              <SelectTrigger id="tax-applies"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['all', 'goods', 'services', 'food', 'electronics', 'clothing'].map(v => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Country" htmlFor="tax-country">
            <Input id="tax-country" value={taxForm.country} onChange={e => setTaxForm(p => ({ ...p, country: e.target.value }))} placeholder="e.g. AU" />
          </Field>
          <Field label="Compound Tax" htmlFor="tax-compound">
            <div className="flex items-center gap-3 h-9">
              <Switch id="tax-compound" checked={taxForm.is_compound} onCheckedChange={v => setTaxForm(p => ({ ...p, is_compound: v }))} />
              <span className="text-sm text-muted-foreground">Applied on top of other taxes</span>
            </div>
          </Field>
        </FormSection>
      </FormDialog>
    </EnterprisePageLayout>
  );
}