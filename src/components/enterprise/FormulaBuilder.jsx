import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus } from 'lucide-react';

const OPERATORS = ['+', '-', '*', '/', '(', ')'];

export default function FormulaBuilder({ fields = [], value: tokens = [], onChange, className }) {
  const [literal, setLiteral] = useState('');
  const set = (next) => onChange?.(next);

  const add = (tok) => set([...tokens, tok]);
  const removeAt = (i) => set(tokens.filter((_, idx) => idx !== i));
  const addLiteral = () => { if (literal.trim()) { add({ type: 'literal', value: literal.trim() }); setLiteral(''); } };

  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <div className="flex flex-wrap items-center gap-1.5 min-h-[40px] p-2 rounded-lg border bg-muted/30 mb-3">
        {tokens.length === 0 && <span className="text-xs text-muted-foreground">Build your expression by adding fields and operators…</span>}
        {tokens.map((t, i) => (
          <span key={i} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
            t.type === 'field' ? 'bg-primary/15 text-primary' : t.type === 'operator' ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-foreground')}>
            {t.value}
            <button onClick={() => removeAt(i)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-1">
          {fields.map((f) => (
            <Button key={f} variant="outline" size="sm" onClick={() => add({ type: 'field', value: f })}>{f}</Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {OPERATORS.map((op) => (
            <Button key={op} variant="secondary" size="sm" className="font-mono" onClick={() => add({ type: 'operator', value: op })}>{op}</Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Input value={literal} onChange={(e) => setLiteral(e.target.value)} placeholder="number" className="h-8 w-24" onKeyDown={(e) => e.key === 'Enter' && addLiteral()} />
          <Button size="sm" variant="outline" onClick={addLiteral}><Plus className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground font-mono">
        = {tokens.map((t) => t.value).join(' ') || '…'}
      </p>
    </div>
  );
}