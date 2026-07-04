import { cn } from '@/lib/utils';
import { Plus, LineChart, BarChart3, PieChart, Table2, Activity, MapPin, Gauge } from 'lucide-react';

const WIDGETS = [
  { type: 'kpi', label: 'KPI Widget', icon: Gauge, desc: 'Value, target & sparkline' },
  { type: 'trend', label: 'Trend Line', icon: LineChart, desc: 'Area chart over time' },
  { type: 'bar', label: 'Bar Chart', icon: BarChart3, desc: 'Comparative series' },
  { type: 'donut', label: 'Donut Chart', icon: PieChart, desc: 'Composition / share' },
  { type: 'table', label: 'Data Table', icon: Table2, desc: 'Tabular records' },
  { type: 'activity', label: 'Activity Feed', icon: Activity, desc: 'Recent events log' },
  { type: 'map', label: 'Map', icon: MapPin, desc: 'Geo distribution' },
];

export default function WidgetLibrary({ onAdd, className }) {
  return (
    <div className={cn('rounded-xl border bg-muted/20 p-4', className)}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Widget Library — drag or click to add</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {WIDGETS.map((w) => (
          <button
            key={w.type}
            onClick={() => onAdd?.(w.type)}
            className="rounded-lg border bg-card p-3 text-left hover:border-primary/50 hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20">
              <w.icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs font-medium">{w.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{w.desc}</p>
            <Plus className="w-3 h-3 text-muted-foreground mt-1.5" />
          </button>
        ))}
      </div>
    </div>
  );
}