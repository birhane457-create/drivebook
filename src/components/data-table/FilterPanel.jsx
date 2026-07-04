import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';

export default function FilterPanel({ columns, filters, onChange, onClear }) {
  const filterable = columns.filter(c => c.filterable !== false && c.type !== 'actions');
  const activeCount = Object.values(filters).filter(v => v !== '' && v != null).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="w-4 h-4 mr-2" />Filters
          {activeCount > 0 && (
            <span className="ml-1.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">{activeCount}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Advanced filters</p>
          {activeCount > 0 && <Button variant="ghost" size="sm" className="h-7" onClick={onClear}>Clear all</Button>}
        </div>
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {filterable.map((col) => {
            const val = filters[col.key] ?? '';
            if (col.filterType === 'select' && col.filterOptions) {
              return (
                <div key={col.key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{col.label}</label>
                  <Select value={val || '__all'} onValueChange={(v) => onChange(col.key, v === '__all' ? '' : v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">All</SelectItem>
                      {col.filterOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            return (
              <div key={col.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{col.label}</label>
                <Input
                  value={val}
                  onChange={(e) => onChange(col.key, e.target.value)}
                  placeholder={`Filter ${col.label}`}
                  className="h-8"
                />
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}