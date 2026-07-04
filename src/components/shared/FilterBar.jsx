import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function FilterBar({ searchValue, onSearchChange, searchPlaceholder = 'Search...', filters = [], children, className }) {
  return (
    <div className={cn("flex flex-col lg:flex-row lg:items-center gap-3 mb-4", className)}>
      <div className="flex flex-1 items-center gap-3">
        {onSearchChange && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
        {filters.map((f) => (
          <Select key={f.key} value={f.value || 'all'} onValueChange={f.onChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {f.label}</SelectItem>
              {f.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}