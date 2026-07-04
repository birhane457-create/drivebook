import { useState, useCallback } from 'react';
import { PanelRightClose, PanelLeftClose, Columns2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SplitScreen — resizable split view with left and right panels.
 * Uses a draggable divider. Collapses either panel via toggle buttons.
 *
 * @param {ReactNode} left - left panel content
 * @param {ReactNode} right - right panel content
 * @param {number} defaultSplit - initial left percentage (default 55)
 * @param {boolean} collapsible - show collapse buttons (default true)
 * @param {string} leftLabel / rightLabel - aria labels
 */
export default function SplitScreen({
  left,
  right,
  defaultSplit = 55,
  collapsible = true,
  leftLabel = "Left panel",
  rightLabel = "Right panel",
  className,
}) {
  const [split, setSplit] = useState(defaultSplit);
  const [collapsed, setCollapsed] = useState(null); // null | 'left' | 'right'
  const [dragging, setDragging] = useState(false);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);

    const onMove = (e) => {
      const container = e.currentTarget?.parentElement;
      const parent = container || document.getElementById('split-container');
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(85, Math.max(15, pct)));
    };

    const moveHandler = (e) => onMove(e);
    const upHandler = () => {
      setDragging(false);
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
  }, []);

  if (collapsed === 'left') {
    return (
      <div className={cn("flex h-full", className)}>
        <div className="flex-1 overflow-auto" aria-label={rightLabel}>
          {collapsible && (
            <button onClick={() => setCollapsed(null)} className="p-2 text-muted-foreground hover:text-foreground border-b w-full flex items-center gap-2 text-sm">
              <Columns2 className="w-4 h-4" /> Show left panel
            </button>
          )}
          {right}
        </div>
      </div>
    );
  }

  if (collapsed === 'right') {
    return (
      <div className={cn("flex h-full", className)}>
        <div className="flex-1 overflow-auto" aria-label={leftLabel}>
          {collapsible && (
            <button onClick={() => setCollapsed(null)} className="p-2 text-muted-foreground hover:text-foreground border-b w-full flex items-center gap-2 text-sm">
              <Columns2 className="w-4 h-4" /> Show right panel
            </button>
          )}
          {left}
        </div>
      </div>
    );
  }

  return (
    <div id="split-container" className={cn("flex h-full relative", className)}>
      <div className="overflow-auto" style={{ width: `${split}%` }} aria-label={leftLabel}>
        {collapsible && (
          <button onClick={() => setCollapsed('left')} className="p-2 text-muted-foreground hover:text-foreground border-b w-full flex items-center gap-2 text-sm">
            <PanelLeftClose className="w-4 h-4" /> Collapse
          </button>
        )}
        {left}
      </div>

      <div
        onMouseDown={onMouseDown}
        className={cn("w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0", dragging && "bg-primary")}
      />

      <div className="flex-1 overflow-auto" style={{ width: `${100 - split}%` }} aria-label={rightLabel}>
        {collapsible && (
          <button onClick={() => setCollapsed('right')} className="p-2 text-muted-foreground hover:text-foreground border-b w-full flex items-center gap-2 text-sm">
            <PanelRightClose className="w-4 h-4" /> Collapse
          </button>
        )}
        {right}
      </div>
    </div>
  );
}