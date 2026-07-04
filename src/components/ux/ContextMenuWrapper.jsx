import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * ContextMenuWrapper — wraps children and shows a custom right-click context menu.
 *
 * @param {Array} items - [{ label, icon, onClick, danger, separator }]
 * @param {ReactNode} children
 * @param {Function} onContext - optional callback receiving the event
 */
export default function ContextMenuWrapper({ items = [], children, onContext, className }) {
  const [menu, setMenu] = useState(null); // { x, y }
  const ref = useRef(null);

  const handleContextMenu = useCallback((e) => {
    if (items.length === 0) return;
    e.preventDefault();
    onContext?.(e);
    setMenu({ x: e.clientX, y: e.clientY });
  }, [items, onContext]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
    };
  }, [menu]);

  // Adjust position so menu doesn't go off-screen
  const adjustedPos = menu ? (() => {
    const menuWidth = 200;
    const menuHeight = items.length * 36 + 8;
    return {
      left: Math.min(menu.x, window.innerWidth - menuWidth - 8),
      top: Math.min(menu.y, window.innerHeight - menuHeight - 8),
    };
  })() : null;

  return (
    <div ref={ref} onContextMenu={handleContextMenu} className={cn("contents", className)}>
      {children}
      {menu && adjustedPos && (
        <div
          className="fixed z-50 min-w-[200px] p-1 rounded-lg border bg-popover shadow-lg animate-in fade-in zoom-in-95 duration-100"
          style={{ left: adjustedPos.left, top: adjustedPos.top }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, idx) => {
            if (item.separator) return <div key={idx} className="h-px bg-border my-1" />;
            return (
              <button
                key={idx}
                onClick={() => { item.onClick?.(); setMenu(null); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left hover:bg-accent transition-colors w-full",
                  item.danger && "text-destructive hover:bg-destructive/10"
                )}
              >
                {item.icon && <item.icon className="w-4 h-4 flex-shrink-0" />}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <kbd className="text-[10px] text-muted-foreground px-1 py-0.5 rounded border bg-muted">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}