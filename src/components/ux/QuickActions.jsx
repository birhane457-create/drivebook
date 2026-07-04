import { useState, useRef, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * QuickActions — floating quick-action menu (FAB) for context-sensitive shortcuts.
 *
 * @param {Array} actions - [{ label, icon, onClick, shortcut, danger }]
 * @param {string} position - "bottom-right" | "bottom-left" (default bottom-right)
 * @param {string} triggerLabel - label on the FAB button
 */
export default function QuickActions({
  actions = [],
  position = "bottom-right",
  triggerLabel = "Quick Actions",
  className,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!actions.length) return null;

  const posCls = position === "bottom-left"
    ? "bottom-6 left-6"
    : "bottom-6 right-6";

  return (
    <div ref={ref} className={cn("fixed z-40 flex flex-col items-end gap-2", posCls, className)}>
      {open && (
        <div className="flex flex-col gap-1 mb-1 p-1.5 rounded-lg border bg-popover shadow-lg min-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-150">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => { action.onClick?.(); setOpen(false); }}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left hover:bg-accent transition-colors w-full",
                action.danger && "text-destructive hover:bg-destructive/10"
              )}
            >
              {action.icon && <action.icon className="w-4 h-4 flex-shrink-0" />}
              <span className="flex-1">{action.label}</span>
              {action.shortcut && (
                <kbd className="text-[10px] text-muted-foreground px-1 py-0.5 rounded border bg-muted">
                  {action.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>
      )}
      <Button
        size="icon"
        className="w-12 h-12 rounded-full shadow-lg"
        onClick={() => setOpen(o => !o)}
        aria-label={triggerLabel}
      >
        <Zap className={cn("w-5 h-5 transition-transform", open && "rotate-45")} />
      </Button>
    </div>
  );
}