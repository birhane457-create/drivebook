import { useState, useEffect, useRef } from 'react';
import Field from '@/components/shared/Field';
import FormSection from '@/components/shared/FormSection';
import AutoSaveIndicator from '@/components/shared/AutoSaveIndicator';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import WizardForm from '@/components/forms/WizardForm';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Package, DollarSign, ClipboardList, FileText, Settings2 } from 'lucide-react';

export default function FormPatternsDemo() {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [blurred, setBlurred] = useState({});

  const [saveStatus, setSaveStatus] = useState('idle');
  const [dirty, setDirty] = useState(false);
  const timer = useRef(null);

  const isDirty = Boolean(name || sku || price || category);

  useEffect(() => {
    if (!isDirty) { setDirty(false); setSaveStatus('idle'); return; }
    setDirty(true);
    setSaveStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaveStatus('saved'), 900);
    return () => clearTimeout(timer.current);
  }, [name, sku, price, category, isDirty]);

  const errors = {
    name: (!name && blurred.name) ? 'Product name is required' : '',
    price: (blurred.price && (!price || Number(price) <= 0)) ? 'Enter a valid price' : '',
  };

  const onSave = () => {
    setSaveStatus('saving');
    setTimeout(() => { setSaveStatus('saved'); setDirty(false); }, 600);
  };
  const onDiscard = () => {
    setName(''); setSku(''); setPrice(''); setCategory(''); setBlurred({});
    setDirty(false); setSaveStatus('idle');
  };

  // wizard state (shares some fields for brevity)
  const [wName, setWName] = useState('');
  const [wPrice, setWPrice] = useState('');
  const [wCat, setWCat] = useState('');
  const [wNotes, setWNotes] = useState('');

  const wizardSteps = [
    {
      title: 'Details',
      description: 'Basic product information',
      content: ({ errors: e }) => (
        <div className="space-y-4 max-w-md">
          <Field label="Product name" required error={e?.name} htmlFor="w-name">
            <Input id="w-name" value={wName} onChange={(ev) => setWName(ev.target.value)} placeholder="e.g. Wireless Mouse" />
          </Field>
          <Field label="SKU" help="Used for barcode scanning" htmlFor="w-sku">
            <Input id="w-sku" value={sku} onChange={(ev) => setSku(ev.target.value)} placeholder="WM-001" />
          </Field>
        </div>
      ),
      validate: () => (wName ? {} : { name: 'required' }),
    },
    {
      title: 'Pricing',
      description: 'Set the selling price',
      content: ({ errors: e }) => (
        <div className="space-y-4 max-w-md">
          <Field label="Selling price" required error={e?.price} htmlFor="w-price" help="Tax exclusive">
            <Input id="w-price" type="number" value={wPrice} onChange={(ev) => setWPrice(ev.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Category" htmlFor="w-cat">
            <Select value={wCat} onValueChange={setWCat}>
              <SelectTrigger id="w-cat"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Electronics">Electronics</SelectItem>
                <SelectItem value="Office">Office</SelectItem>
                <SelectItem value="Furniture">Furniture</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      ),
      validate: () => (wPrice && Number(wPrice) > 0 ? {} : { price: 'invalid' }),
    },
    {
      title: 'Review',
      description: 'Confirm and add notes',
      content: () => (
        <div className="space-y-3 max-w-md text-sm">
          <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
            <p><span className="text-muted-foreground">Name:</span> {wName || '—'}</p>
            <p><span className="text-muted-foreground">Price:</span> {wPrice ? `$${wPrice}` : '—'}</p>
            <p><span className="text-muted-foreground">Category:</span> {wCat || '—'}</p>
          </div>
          <Field label="Notes" htmlFor="w-notes">
            <Textarea id="w-notes" value={wNotes} onChange={(ev) => setWNotes(ev.target.value)} placeholder="Optional internal notes" />
          </Field>
        </div>
      ),
      validate: () => ({}),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">Auto-saving form with validation</p>
          <AutoSaveIndicator status={saveStatus} />
        </div>
        <FormSection title="Product details" description="Required fields are marked with *" icon={Package} columns={2}>
          <Field label="Product name" required error={errors.name} htmlFor="f-name" help="The customer-facing name">
            <Input id="f-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setBlurred(b => ({ ...b, name: true }))} placeholder="Enter name" />
          </Field>
          <Field label="SKU" help="Unique stock keeping unit" htmlFor="f-sku">
            <Input id="f-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="WM-001" />
          </Field>
          <Field label="Price" required error={errors.price} htmlFor="f-price" help="Tax-exclusive selling price">
            <Input id="f-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => setBlurred(b => ({ ...b, price: true }))} placeholder="0.00" />
          </Field>
          <Field label="Category" htmlFor="f-cat">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="f-cat"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Electronics">Electronics</SelectItem>
                <SelectItem value="Office">Office</SelectItem>
                <SelectItem value="Furniture">Furniture</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FormSection>
        <div className="mt-3">
          <UnsavedChangesGuard dirty={dirty} saving={saveStatus === 'saving'} onSave={onSave} onDiscard={onDiscard} />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Tabbed form — sections organized as tabs</p>
        <div className="rounded-xl border bg-card p-5">
          <Tabs defaultValue="details">
            <TabsList className="mb-4">
              <TabsTrigger value="details"><FileText className="w-3.5 h-3.5 mr-1.5" />Details</TabsTrigger>
              <TabsTrigger value="pricing"><DollarSign className="w-3.5 h-3.5 mr-1.5" />Pricing</TabsTrigger>
              <TabsTrigger value="meta"><Settings2 className="w-3.5 h-3.5 mr-1.5" />Meta</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-4 max-w-md">
              <Field label="Product name" required htmlFor="t-name" help="Shown to customers">
                <Input id="t-name" placeholder="Enter name" />
              </Field>
              <Field label="SKU" htmlFor="t-sku">
                <Input id="t-sku" placeholder="WM-001" />
              </Field>
            </TabsContent>
            <TabsContent value="pricing" className="space-y-4 max-w-md">
              <Field label="Cost price" required htmlFor="t-cost">
                <Input id="t-cost" type="number" placeholder="0.00" />
              </Field>
              <Field label="Selling price" required htmlFor="t-sell">
                <Input id="t-sell" type="number" placeholder="0.00" />
              </Field>
            </TabsContent>
            <TabsContent value="meta" className="space-y-4 max-w-md">
              <Field label="Category" htmlFor="t-cat">
                <Select>
                  <SelectTrigger id="t-cat"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                    <SelectItem value="Office">Office</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Internal notes" htmlFor="t-notes">
                <Textarea id="t-notes" placeholder="Optional notes" />
              </Field>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Multi-step wizard with per-step validation</p>
        <WizardForm
          title="Create product"
          steps={wizardSteps}
          autoSaveStatus={saveStatus}
          onSubmit={() => alert('Product created!')}
        />
      </div>
    </div>
  );
}