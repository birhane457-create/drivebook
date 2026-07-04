import { cn } from '@/lib/utils';

function OrgNode({ node }) {
  return (
    <div className="flex flex-col items-center">
      <div className={cn('rounded-lg border bg-card px-4 py-3 text-center shadow-sm min-w-[140px]', node.color || 'border-border')}>
        <p className="text-sm font-semibold">{node.name}</p>
        {node.title && <p className="text-xs text-muted-foreground">{node.title}</p>}
        {node.meta && <p className="text-[11px] text-muted-foreground mt-0.5">{node.meta}</p>}
      </div>
      {node.children?.length > 0 && (
        <>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-start gap-6 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] h-px bg-border" style={{ minWidth: '2rem' }} />
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-5 bg-border" />
                <OrgNode node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function OrgChart({ root, className }) {
  return (
    <div className={cn('rounded-xl border bg-card p-6 overflow-x-auto', className)}>
      <div className="flex justify-center min-w-fit">
        <OrgNode node={root} />
      </div>
    </div>
  );
}