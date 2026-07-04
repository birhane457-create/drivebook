import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bookmark, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SavedViewsBar({ views, activeName, onApply, onSave, onDelete }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Bookmark className="w-4 h-4 mr-2" />
          {activeName || 'Views'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">Saved views</p>
        <div className="max-h-48 overflow-y-auto">
          {views.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-3">No saved views yet</p>
          ) : (
            views.map((v) => (
              <div key={v.name} className="flex items-center group rounded hover:bg-muted/60">
                <button
                  onClick={() => { onApply(v); setOpen(false); }}
                  className={cn("flex-1 text-left px-2 py-1.5 text-sm", v.name === activeName && "font-medium text-primary")}
                >
                  {v.name}
                </button>
                <button
                  onClick={() => onDelete(v.name)}
                  className="opacity-0 group-hover:opacity-100 p-1 mr-1 hover:bg-destructive/10 rounded transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="border-t mt-1 pt-2 px-1 flex items-center gap-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Save current as..."
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                onSave(newName.trim());
                setNewName('');
              }
            }}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={!newName.trim()}
            onClick={() => { onSave(newName.trim()); setNewName(''); }}
          >
            <Save className="w-3.5 h-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}