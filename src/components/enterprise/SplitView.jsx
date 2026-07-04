import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

export default function SplitView({ left, right, leftMin = 20, rightMin = 30, direction = 'horizontal', className }) {
  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden h-[420px]', className)}>
      <PanelGroup direction={direction}>
        <Panel defaultSize={55} minSize={leftMin}>
          <div className="h-full overflow-auto">{left}</div>
        </Panel>
        <PanelResizeHandle className={cn('bg-border hover:bg-primary/40 transition-colors', direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize')} />
        <Panel defaultSize={45} minSize={rightMin}>
          <div className="h-full overflow-auto">{right}</div>
        </Panel>
      </PanelGroup>
    </div>
  );
}