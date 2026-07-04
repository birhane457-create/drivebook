import { cn } from '@/lib/utils';
import { Circle, GitBranch, CheckSquare, AlertTriangle } from 'lucide-react';

const NODE_STYLES = {
  start: { icon: Circle, cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40' },
  task: { icon: CheckSquare, cls: 'bg-primary/10 text-primary border-primary/40' },
  decision: { icon: GitBranch, cls: 'bg-amber-500/15 text-amber-600 border-amber-500/40' },
  end: { icon: AlertTriangle, cls: 'bg-destructive/10 text-destructive border-destructive/40' },
};

export default function WorkflowDesigner({ nodes = [], connections = [], className }) {
  const W = 160, H = 56;
  return (
    <div className={cn('relative rounded-xl border bg-card overflow-auto', className)} style={{ minHeight: 360 }}>
      <div className="relative" style={{ width: 760, height: 380 }}>
        <svg className="absolute inset-0 pointer-events-none" width="760" height="380">
          {connections.map((c, i) => {
            const from = nodes.find((n) => n.id === c.from);
            const to = nodes.find((n) => n.id === c.to);
            if (!from || !to) return null;
            const x1 = from.x + W / 2, y1 = from.y + H;
            const x2 = to.x + W / 2, y2 = to.y;
            const midY = (y1 + y2) / 2;
            return (
              <g key={i}>
                <path d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`} fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
                {c.label && <text x={(x1 + x2) / 2} y={midY - 4} textAnchor="middle" className="fill-muted-foreground" fontSize="10">{c.label}</text>}
              </g>
            );
          })}
        </svg>
        {nodes.map((n) => {
          const st = NODE_STYLES[n.type] || NODE_STYLES.task;
          const Icon = st.icon;
          return (
            <div key={n.id} className={cn('absolute rounded-lg border px-3 py-2 shadow-sm w-[160px]', st.cls)} style={{ left: n.x, top: n.y }}>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{n.label}</span>
              </div>
              {n.desc && <p className="text-[11px] opacity-70 mt-0.5 truncate">{n.desc}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}