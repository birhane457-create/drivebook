import { useState, useEffect } from 'react';
import WizardDialog from './WizardDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SOURCE_COLS = ['SKU', 'Product_Name', 'Qty', 'Unit_Cost', 'Category'];
const TARGET_FIELDS = ['sku', 'name', 'quantity', 'unit_cost', 'category'];

export default function ImportWizard({ open, onOpenChange, onComplete }) {
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState({});
  useEffect(() => { if (open) { setFileName(''); setMapping(Object.fromEntries(SOURCE_COLS.map((c, i) => [c, TARGET_FIELDS[i]]))); } }, [open]);

  const previewRows = [
    { SKU: 'WM-001', Product_Name: 'Wireless Mouse', Qty: '48', Unit_Cost: '8.40', Category: 'Electronics' },
    { SKU: 'UC-200', Product_Name: 'USB-C Cable', Qty: '3', Unit_Cost: '4.20', Category: 'Electronics' },
    { SKU: 'DL-310', Product_Name: 'Desk Lamp', Qty: '22', Unit_Cost: '15.00', Category: 'Furniture' },
  ];

  const finish = () => { onComplete?.({ fileName, mapping }); toast.success(`Imported ${previewRows.length} preview rows`); onOpenChange?.(false); };

  return (
    <WizardDialog open={open} onOpenChange={onOpenChange} title="Import Data" description="Upload a file, map columns, and preview before committing." steps={['Upload', 'Map Columns', 'Preview', 'Confirm']} submitLabel="Import" onSubmit={finish}>
      {(step) => (
        <>
          {step === 0 && (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl py-12 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              {fileName ? <FileSpreadsheet className="w-10 h-10 text-primary mb-2" /> : <UploadCloud className="w-10 h-10 text-muted-foreground mb-2" />}
              <p className="text-sm font-medium">{fileName || 'Click to select a file'}</p>
              <p className="text-xs text-muted-foreground mt-1">CSV, XLSX or JSON · up to 10MB</p>
              <input type="file" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name || 'products.csv')} />
            </label>
          )}
          {step === 1 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Map each source column to a target field.</p>
              {SOURCE_COLS.map((c) => (
                <div key={c} className="flex items-center gap-3">
                  <span className="text-sm font-mono w-1/3 truncate">{c}</span>
                  <span className="text-muted-foreground">→</span>
                  <Select value={mapping[c]} onValueChange={(v) => setMapping((m) => ({ ...m, [c]: v }))}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{TARGET_FIELDS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          {step === 2 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40"><tr>{SOURCE_COLS.map((c) => <th key={c} className="text-left px-3 py-2 font-medium border-r border-border last:border-0">{c}</th>)}</tr></thead>
                <tbody>{previewRows.map((r, i) => (
                  <tr key={i} className="border-t border-border">{SOURCE_COLS.map((c) => <td key={c} className="px-3 py-2 border-r border-border last:border-0">{r[c]}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium">{fileName || 'products.csv'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Mapped columns</span><span className="font-medium">{SOURCE_COLS.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Preview rows</span><span className="font-medium">{previewRows.length}</span></div>
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">On finish, records will be validated and inserted. Any invalid rows will be reported.</p>
            </div>
          )}
        </>
      )}
    </WizardDialog>
  );
}