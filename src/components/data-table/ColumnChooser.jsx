import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Columns3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ColumnChooser({ columns, hiddenKeys, onToggle, onReset }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"><Columns3 className="w-4 h-4 mr-2" />Columns</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">Show columns</p>
        <div className="max-h-64 overflow-y-auto">
          {columns.map((col) => {
            const locked = col.hideable === false;
            const visible = !hiddenKeys.includes(col.key) || locked;
            return (
              <div key={col.key} className={cn("flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60", locked && "opacity-60")}>
                <Checkbox checked={visible} disabled={locked} onCheckedChange={() => !locked && onToggle(col.key)} />
                <button
                  className="text-sm text-left flex-1 disabled:cursor-not-allowed"
                  disabled={locked}
                  onClick={() => !locked && onToggle(col.key)}
                >
                  {col.label}
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t mt-1 pt-1 px-1">
          <Button variant="ghost" size="sm" className="w-full" onClick={onReset}>Reset to default</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}