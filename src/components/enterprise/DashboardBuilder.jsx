import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import WidgetLibrary from './WidgetLibrary';
import KpiWidget from './KpiWidget';
import { TrendAreaChart, DonutChart, BarSeriesChart } from '@/components/charts/StandardCharts';
import ChartCard from '@/components/charts/ChartCard';

const RENDERERS = {
  kpi: (w) => <KpiWidget title={w.title} value={w.value} unit={w.unit} target={w.target} trend={w.trend} trendUp spark={w.spark} />,
  trend: (w) => <ChartCard title={w.title}><TrendAreaChart data={w.data} dataKey={w.dataKey} xKey="x" /></ChartCard>,
  bar: (w) => <ChartCard title={w.title}><BarSeriesChart data={w.data} keys={w.keys} xKey="x" /></ChartCard>,
  donut: (w) => <ChartCard title={w.title}><DonutChart data={w.data} /></ChartCard>,
};

export default function DashboardBuilder({ className }) {
  const [widgets, setWidgets] = useState([
    { id: 'w1', type: 'kpi', title: 'Revenue', value: 48200, unit: '$', target: 60000, trend: '+12%', trendUp: true, spark: [{ x: 1, y: 30 }, { x: 2, y: 42 }, { x: 3, y: 38 }, { x: 4, y: 48 }, { x: 5, y: 52 }] },
  ]);

  const addWidget = (type) => {
    const id = `w${Date.now()}`;
    const base = { id, type, title: type.toUpperCase() };
    let w = base;
    if (type === 'kpi') w = { ...base, title: 'New KPI', value: 0, unit: '', target: 100, trend: '0%', trendUp: true, spark: [] };
    if (type === 'trend') w = { ...base, title: 'Trend', data: [{ x: 'A', v: 10 }, { x: 'B', v: 20 }], dataKey: 'v' };
    if (type === 'bar') w = { ...base, title: 'Bars', data: [{ x: 'A', v: 10 }, { x: 'B', v: 20 }], keys: ['v'] };
    if (type === 'donut') w = { ...base, title: 'Donut', data: [{ name: 'A', value: 1 }] };
    setWidgets((p) => [...p, w]);
  };
  const remove = (id) => setWidgets((p) => p.filter((w) => w.id !== id));

  return (
    <div className={cn('space-y-4', className)}>
      <WidgetLibrary onAdd={addWidget} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgets.map((w) => (
          <div key={w.id} className="relative group">
            {RENDERERS[w.type]?.(w)}
            <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => remove(w.id)}><X className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}