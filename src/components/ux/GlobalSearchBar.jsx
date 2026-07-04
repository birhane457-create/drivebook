import { Search, Command } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * GlobalSearchBar — header search input that opens the command palette on focus/click.
 * Shows a keyboard shortcut hint (⌘K).
 *
 * @param {Function} onOpen - called when the search bar is clicked
 * @param {string} placeholder
 */
export default function GlobalSearchBar({ onOpen, placeholder = "Search anything…", className }) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "group flex items-center gap-2 w-full max-w-md h-9 px-3 rounded-lg border border-input bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors",
        className
      )}
    >
      <Search className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 text-left truncate">{placeholder}</span>
      <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-background text-[10px] font-medium text-muted-foreground">
        <Command className="w-3 h-3" />K
      </kbd>
    </button>
  );
}