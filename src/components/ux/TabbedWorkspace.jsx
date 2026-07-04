import { useState, useCallback } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * TabbedWorkspace — multi-tab workspace for opening multiple views simultaneously.
 * Tabs are managed internally; use `onTabChange` to sync with parent.
 *
 * @param {Array} tabs - [{ id, label, icon, content: ReactNode }]
 * @param {string} activeTab - id of active tab
 * @param {Function} onTabChange - (id) => void
 * @param {Function} onCloseTab - (id) => void
 * @param {Function} onNewTab - called when + is clicked
 * @param {boolean} allowClose - show close button on tabs (default true)
 */
export default function TabbedWorkspace({
  tabs = [],
  activeTab,
  onTabChange,
  onCloseTab,
  onNewTab,
  allowClose = true,
  className,
}) {
  const active = tabs.find(t => t.id === activeTab) || tabs[0];

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b bg-muted/30 px-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors",
              tab.id === active?.id
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
            {tab.label}
            {allowClose && tabs.length > 1 && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onCloseTab?.(tab.id); }}
                className="ml-1 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </span>
            )}
          </button>
        ))}
        {onNewTab && (
          <button
            onClick={onNewTab}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="New tab"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Active tab content */}
      <div className="flex-1 overflow-auto">
        {active?.content || <div className="p-8 text-center text-muted-foreground">No tab selected</div>}
      </div>
    </div>
  );
}