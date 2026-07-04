import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

function Node({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children?.length > 0;
  return (
    <div>
      <div
        className={cn('flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-muted/60 cursor-pointer', node.active && 'bg-primary/10')}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        {hasChildren ? (
          <ChevronRight className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-90')} />
        ) : (
          <span className="w-3.5" />
        )}
        {node.icon && <node.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <span className="text-sm">{node.label}</span>
        {node.badge && <span className="ml-auto text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">{node.badge}</span>}
      </div>
      {hasChildren && open && (
        <div className="border-l border-border ml-4">
          {node.children.map((child) => <Node key={child.id} node={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

export default function TreeView({ nodes = [], className }) {
  return (
    <div className={cn('rounded-xl border bg-card p-2', className)}>
      {nodes.map((node) => <Node key={node.id} node={node} />)}
    </div>
  );
}