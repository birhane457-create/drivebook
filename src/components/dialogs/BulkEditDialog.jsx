import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Field from '@/components/shared/Field';
import { Edit3 } from 'lucide-react';

export default function BulkEditDialog({ open, onOpenChange, fields = [], selectedCount = 0, onApply, isPending }) {
  const [field, setField] = useState(fields[0]?.value);
  const [value, setValue] = useState('');
  useEffect(() => { if (open) setValue(''); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2"><Edit3 className="w-5 h-5 text-primary" /></div>
          <DialogTitle>Bulk Edit</DialogTitle>
          <DialogDescription>Apply one change to {selectedCount} selected record{selectedCount === 1 ? '' : 's'}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <Field label="Field to update" htmlFor="bulk-field">
            <Select value={field} onValueChange={setField}>
              <SelectTrigger id="bulk-field"><SelectValue placeholder="Select field" /></SelectTrigger>
              <SelectContent>{fields.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
          </Field>
          <Field label="New value" htmlFor="bulk-value">
            <Input id="bulk-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Enter the new value" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={() => onApply?.(field, value)} disabled={isPending || !value}>Apply to {selectedCount}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}