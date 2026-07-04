import SectionCard from '@/components/shared/SectionCard';
import ChartCard from '@/components/charts/ChartCard';
import SankeyChart from '@/components/charts/SankeyChart';
import TreemapChart from '@/components/charts/TreemapChart';
import WaterfallChart from '@/components/charts/WaterfallChart';
import RadarChartCmp from '@/components/charts/RadarChart';
import BubbleChart from '@/components/charts/BubbleChart';
import GaugeChart from '@/components/charts/GaugeChart';
import TimelineChart from '@/components/charts/TimelineChart';
import FunnelChart from '@/components/charts/FunnelChart';
import HeatmapChart from '@/components/charts/HeatmapChart';
import CalendarHeatmap from '@/components/charts/CalendarHeatmap';
import ParetoChart from '@/components/charts/ParetoChart';
import ControlChart from '@/components/charts/ControlChart';

const sankeyData = {
  nodes: [{ name: 'Visitors' }, { name: 'Cart' }, { name: 'Checkout' }, { name: 'Purchase' }, { name: 'Bounce' }],
  links: [
    { source: 0, target: 1, value: 1000 },
    { source: 1, target: 2, value: 600 },
    { source: 2, target: 3, value: 400 },
    { source: 0, target: 4, value: 400 },
    { source: 1, target: 4, value: 200 },
  ],
};

const treemapData = [
  { name: 'Electronics', size: 1200, color: 'hsl(var(--chart-1))' },
  { name: 'Clothing', size: 800, color: 'hsl(var(--chart-2))' },
  { name: 'Food', size: 620, color: 'hsl(var(--chart-3))' },
  { name: 'Books', size: 340, color: 'hsl(var(--chart-4))' },
  { name: 'Toys', size: 180, color: 'hsl(var(--chart-5))' },
];

const waterfallData = [
  { label: 'Revenue', value: 500, isTotal: true },
  { label: 'COGS', value: -200 },
  { label: 'Gross', value: 300, isTotal: true },
  { label: 'OpEx', value: -120 },
  { label: 'Tax', value: -30 },
  { label: 'Net', value: 150, isTotal: true },
];

const radarData = [
  { subject: 'Sales', A: 120, B: 90 },
  { subject: 'Quality', A: 98, B: 95 },
  { subject: 'Speed', A: 86, B: 110 },
  { subject: 'Cost', A: 99, B: 80 },
  { subject: 'Service', A: 85, B: 100 },
  { subject: 'Safety', A: 92, B: 88 },
];

const bubbleData = Array.from({ length: 16 }, (_, i) => ({
  x: Math.round(Math.random() * 100),
  y: Math.round(Math.random() * 100),
  z: Math.round(Math.random() * 300 + 50),
}));

const funnelData = [
  { name: 'Visitors', value: 5000, fill: 'hsl(var(--chart-1))' },
  { name: 'Cart', value: 2000, fill: 'hsl(var(--chart-2))' },
  { name: 'Checkout', value: 800, fill: 'hsl(var(--chart-3))' },
  { name: 'Purchase', value: 400, fill: 'hsl(var(--chart-4))' },
];

const heatmapData = Array.from({ length: 5 }, () => Array.from({ length: 7 }, () => Math.round(Math.random() * 50)));
const heatmapCols = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const heatmapRows = ['Aisle A', 'Aisle B', 'Aisle C', 'Aisle D', 'Aisle E'];

const calendarData = Array.from({ length: 60 }, () => {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * 140));
  return { date: d.toISOString().slice(0, 10), value: Math.round(Math.random() * 20) };
});

const paretoData = [
  { category: 'Billing', count: 45 },
  { category: 'Shipping', count: 30 },
  { category: 'Stock', count: 15 },
  { category: 'Login', count: 7 },
  { category: 'Other', count: 3 },
];

const controlData = Array.from({ length: 20 }, (_, i) => ({ x: i, value: Math.round(50 + (Math.random() - 0.5) * 16) }));

const timelineEvents = [
  { time: '09:00', title: 'Shift start' },
  { time: '11:30', title: 'Inbound truck', color: 'hsl(var(--chart-2))' },
  { time: '13:00', title: 'Lunch' },
  { time: '15:45', title: 'QC hold', color: 'hsl(var(--chart-5))' },
  { time: '17:00', title: 'Cycle count' },
];

const charts = [
  { title: 'Sankey', node: <SankeyChart data={sankeyData} /> },
  { title: 'Treemap', node: <TreemapChart data={treemapData} /> },
  { title: 'Waterfall', node: <WaterfallChart data={waterfallData} /> },
  { title: 'Radar', node: <RadarChartCmp data={radarData} keys={['A', 'B']} /> },
  { title: 'Bubble', node: <BubbleChart data={bubbleData} /> },
  { title: 'KPI Gauge', node: <GaugeChart value={72} label="OEE" /> },
  { title: 'Timeline', node: <TimelineChart events={timelineEvents} /> },
  { title: 'Funnel', node: <FunnelChart data={funnelData} /> },
  { title: 'Heatmap', node: <HeatmapChart data={heatmapData} rowLabels={heatmapRows} colLabels={heatmapCols} /> },
  { title: 'Calendar Heatmap', node: <CalendarHeatmap data={calendarData} /> },
  { title: 'Pareto', node: <ParetoChart data={paretoData} /> },
  { title: 'Control Chart', node: <ControlChart data={controlData} /> },
];

export default function ChartsShowcase() {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {charts.map((c) => (
        <ChartCard key={c.title} title={c.title}>
          {c.node}
        </ChartCard>
      ))}
    </div>
  );
}