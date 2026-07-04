import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';

const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'date', 'select', 'boolean', 'password'];

function FieldEditor({ field, onChange, onRemove }) {
  const set = (patch) => onChange({ ...field, ...patch });
  return (
    <div className="rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
        <Input value={field.label} onChange={(e) => set({ label: e.target.value })} className="h-8 flex-1" placeholder="Field label" />
        <Select value={field.type} onValueChange={(v) => set({ type: v })}>
          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove}><Trash2 className="w-4 h-4" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2 pl-6">
        <Input value={field.name || ''} onChange={(e) => set({ name: e.target.value })} className="h-8" placeholder="field_key" />
        <Input value={field.placeholder || ''} onChange={(e) => set({ placeholder: e.target.value })} className="h-8" placeholder="Placeholder" />
        {field.type === 'select' && (
          <Input value={(field.options || []).join(', ')} onChange={(e) => set({ options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className="h-8 col-span-2" placeholder="Option 1, Option 2, ..." />
        )}
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={!!field.required} onCheckedChange={(v) => set({ required: v })} />
          Required
        </label>
      </div>
    </div>
  );
}

function FieldRenderer({ field, value, onChange }) {
  const common = { id: field.name, value: value || '', onChange: (e) => onChange(e.target.value), placeholder: field.placeholder, className: 'h-9' };
  switch (field.type) {
    case 'textarea': return <Textarea id={field.name} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} rows={3} />;
    case 'number': return <Input type="number" {...common} />;
    case 'email': return <Input type="email" {...common} />;
    case 'date': return <Input type="date" {...common} />;
    case 'password': return <Input type="password" {...common} />;
    case 'boolean': return <Switch id={field.name} checked={!!value} onCheckedChange={(v) => onChange(v)} />;
    case 'select': return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger id={field.name} className="h-9"><SelectValue placeholder={field.placeholder} /></SelectTrigger>
        <SelectContent>{(field.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    );
    default: return <Input type="text" {...common} />;
  }
}

export function DynamicFormPreview({ schema = [], values, onChange, className }) {
  return (
    <div className={cn('space-y-4', className)}>
      {schema.map((f) => (
        <div key={f.name} className="space-y-1.5">
          <Label htmlFor={f.name}>{f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}</Label>
          <FieldRenderer field={f} value={values?.[f.name]} onChange={(v) => onChange?.({ ...values, [f.name]: v })} />
        </div>
      ))}
      {schema.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No fields defined yet.</p>}
    </div>
  );
}

export default function DynamicFormBuilder({ schema: initialSchema = [], onChange, className }) {
  const [schema, setSchema] = useState(initialSchema);
  const [values, setValues] = useState({});

  const emit = (next) => { setSchema(next); onChange?.(next); };

  const addField = () => emit([...schema, { name: `field_${schema.length + 1}`, label: 'New Field', type: 'text', placeholder: '', required: false, options: [] }]);
  const setField = (i, patch) => emit(schema.map((f, idx) => idx === i ? patch : f));
  const removeField = (i) => emit(schema.filter((_, idx) => idx !== i));

  return (
    <div className={cn('grid lg:grid-cols-2 gap-4', className)}>
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Form Builder</p>
          <Button variant="outline" size="sm" onClick={addField}><Plus className="w-4 h-4 mr-1" /> Add Field</Button>
        </div>
        <div className="space-y-2">
          {schema.map((f, i) => <FieldEditor key={i} field={f} onChange={(patch) => setField(i, patch)} onRemove={() => removeField(i)} />)}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Live Preview</p>
        <div className="rounded-xl border bg-card p-4">
          <DynamicFormPreview schema={schema} values={values} onChange={setValues} />
        </div>
      </div>
    </div>
  );
}