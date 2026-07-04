import { useState } from 'react';
import SectionCard from '@/components/shared/SectionCard';
import Timeline from '@/components/enterprise/Timeline';
import KanbanBoard from '@/components/enterprise/KanbanBoard';
import MiniCalendar from '@/components/enterprise/MiniCalendar';
import GanttChart from '@/components/enterprise/GanttChart';
import Scheduler from '@/components/enterprise/Scheduler';
import TreeView from '@/components/enterprise/TreeView';
import OrgChart from '@/components/enterprise/OrgChart';
import SplitView from '@/components/enterprise/SplitView';
import MasterDetail from '@/components/enterprise/MasterDetail';
import PropertyPanel from '@/components/enterprise/PropertyPanel';
import ActivityFeed from '@/components/enterprise/ActivityFeed';
import KpiWidget from '@/components/enterprise/KpiWidget';
import Heatmap from '@/components/enterprise/Heatmap';
import MapWidget from '@/components/enterprise/MapWidget';
import PivotTable from '@/components/enterprise/PivotTable';
import FormulaBuilder from '@/components/enterprise/FormulaBuilder';
import RuleBuilder from '@/components/enterprise/RuleBuilder';
import WorkflowDesigner from '@/components/enterprise/WorkflowDesigner';
import DashboardBuilder from '@/components/enterprise/DashboardBuilder';
import WidgetLibrary from '@/components/enterprise/WidgetLibrary';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Package, Truck, CheckCircle2, AlertTriangle, ClipboardList,
  MapPin, FileText, MessageSquare, Box, Layers, FolderTree, GitBranch,
} from 'lucide-react';

const timeline = [
  { id: 1, title: 'Purchase order created', subtitle: 'PO-2041 · 120 units', time: '2 hours ago', status: 'info', icon: FileText },
  { id: 2, title: 'Goods received', subtitle: 'Dock 3 · 118 of 120 units', time: '5 hours ago', status: 'success', icon: CheckCircle2 },
  { id: 3, title: 'Quality inspection failed', subtitle: '2 units damaged', time: '6 hours ago', status: 'warning', icon: AlertTriangle },
  { id: 4, title: 'Putaway complete', subtitle: 'Aisle B-12', time: 'Yesterday', status: 'success', icon: Box },
];

const kanban = [
  { id: 'bk', title: 'Backlog', color: 'bg-muted-foreground', cards: [
    { id: 'c1', title: 'Audit supplier contracts', subtitle: 'Procurement', badges: ['Q3'] },
    { id: 'c2', title: 'Migrate to new 3PL', subtitle: 'Logistics', badges: ['High'] },
  ] },
  { id: 'ip', title: 'In Progress', color: 'bg-primary', cards: [
    { id: 'c3', title: 'Cycle count — Zone A', subtitle: 'Warehouse', badges: ['Today'] },
    { id: 'c4', title: 'Reprice 240 SKUs', subtitle: 'Pricing', badges: ['Retail'] },
  ] },
  { id: 'rev', title: 'In Review', color: 'bg-amber-500', cards: [
    { id: 'c5', title: 'PO-2041 approval', subtitle: 'Finance', badges: ['$48k'] },
  ] },
  { id: 'done', title: 'Done', color: 'bg-emerald-500', cards: [
    { id: 'c6', title: 'Label print run', subtitle: 'Operations', badges: ['1,200'] },
  ] },
];

const calEvents = [
  { date: new Date(), title: 'Stocktake', color: 'bg-primary' },
  { date: new Date(Date.now() + 2 * 864e5), title: 'Supplier review', color: 'bg-emerald-500' },
  { date: new Date(Date.now() + 5 * 864e5), title: 'Audit', color: 'bg-destructive' },
  { date: new Date(Date.now() + 5 * 864e5), title: 'Cycle count', color: 'bg-amber-500' },
];

const gantt = [
  { id: 'g1', name: 'Site survey', start: 0, duration: 3, progress: 100, color: 'bg-emerald-500' },
  { id: 'g2', name: 'Procurement', start: 2, duration: 5, progress: 60, color: 'bg-primary' },
  { id: 'g3', name: 'Build-out', start: 6, duration: 6, progress: 20, color: 'bg-amber-500' },
  { id: 'g4', name: 'Go-live', start: 12, duration: 2, progress: 0, color: 'bg-destructive' },
];

const scheduler = {
  resources: [{ id: 'r1', name: 'Dock 1' }, { id: 'r2', name: 'Dock 2' }, { id: 'r3', name: 'Dock 3' }],
  events: [
    { resourceId: 'r1', startHour: 8, duration: 2, title: 'Inbound PO-2041', color: 'bg-primary' },
    { resourceId: 'r1', startHour: 13, duration: 1.5, title: 'Returns', color: 'bg-amber-500' },
    { resourceId: 'r2', startHour: 9, duration: 3, title: 'Container unload', color: 'bg-emerald-500' },
    { resourceId: 'r3', startHour: 10, duration: 4, title: 'QC inspection', color: 'bg-destructive' },
  ],
};

const tree = [
  { id: 't1', label: 'Organization', icon: FolderTree, badge: '4', children: [
    { id: 't1a', label: 'Operations', icon: Layers, badge: '12', children: [
      { id: 't1a1', label: 'Warehouse', icon: Box, badge: '8' },
      { id: 't1a2', label: 'Transport', icon: Truck, badge: '4' },
    ] },
    { id: 't1b', label: 'Procurement', icon: ClipboardList, badge: '6' },
  ] },
  { id: 't2', label: 'Finance', icon: FileText, children: [
    { id: 't2a', label: 'Accounts Payable', icon: FileText },
    { id: 't2b', label: 'Accounts Receivable', icon: FileText },
  ] },
];

const org = {
  id: 'o1', name: 'Sarah Chen', title: 'CEO', meta: 'Global Operations', children: [
    { id: 'o2', name: 'James Lee', title: 'COO', meta: 'Supply Chain', children: [
      { id: 'o2a', name: 'Ana Cruz', title: 'Warehouse Mgr' },
      { id: 'o2b', name: 'Tom Diaz', title: 'Transport Mgr' },
    ] },
    { id: 'o3', name: 'Priya Rao', title: 'CFO', meta: 'Finance', children: [
      { id: 'o3a', name: 'Mia Wong', title: 'AP Lead' },
    ] },
  ],
};

const masterItems = [
  { id: 'm1', title: 'PO-2041', subtitle: 'Acme Supplies · $48,200', status: 'pending' },
  { id: 'm2', title: 'PO-2042', subtitle: 'Globex · $12,400', status: 'approved' },
  { id: 'm3', title: 'PO-2043', subtitle: 'Initech · $7,800', status: 'partial' },
  { id: 'm4', title: 'PO-2044', subtitle: 'Umbrella Co · $32,100', status: 'completed' },
];

const properties = [
  { label: 'SKU', value: 'WM-001', mono: true },
  { label: 'Name', value: 'Wireless Mouse' },
  { label: 'Category', value: 'Electronics' },
  { label: 'On-hand', value: 48, render: (v) => <span className="font-mono">{v}</span> },
  { label: 'Reorder point', value: 10, hint: 'alert triggers below this' },
  { label: 'Unit cost', value: '$8.40', mono: true },
  { label: 'Status', value: 'active', render: (v) => <StatusBadge status={v} /> },
];

const activities = [
  { id: 'a1', user: 'James Lee', action: 'approved', target: 'PO-2041', detail: '$48,200 · Acme Supplies', time: Date.now() - 3600_000, color: 'bg-emerald-500', icon: CheckCircle2 },
  { id: 'a2', user: 'Ana Cruz', action: 'received', target: 'Container #8821', detail: 'Dock 3 · 118 units', time: Date.now() - 7200_000, color: 'bg-primary', icon: Truck },
  { id: 'a3', user: 'System', action: 'flagged low stock on', target: 'USB-C Cable', detail: '3 units remaining', time: Date.now() - 18000_000, color: 'bg-amber-500', icon: AlertTriangle },
  { id: 'a4', user: 'Priya Rao', action: 'posted invoice', target: 'INV-5512', detail: '$1,240', time: Date.now() - 86400_000, color: 'bg-muted-foreground', icon: FileText },
];

const heatmapData = (() => {
  const d = {};
  for (let i = 112; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 864e5);
    const key = dt.toISOString().slice(0, 10);
    if (dt.getDay() % 7 === 0) continue;
    d[key] = Math.floor(Math.abs(Math.sin(i / 9)) * 24) + (i % 5);
  }
  return d;
})();

const markers = [
  { lat: -31.95, lng: 115.86, title: 'Perth DC', subtitle: 'Western Australia' },
  { lat: -33.87, lng: 151.21, title: 'Sydney Hub', subtitle: 'NSW' },
  { lat: -37.81, lng: 144.96, title: 'Melbourne Store', subtitle: 'Victoria' },
  { lat: -27.46, lng: 153.02, title: 'Brisbane Store', subtitle: 'Queensland' },
];

const pivotData = [
  { region: 'North', category: 'Electronics', amount: 1200 },
  { region: 'North', category: 'Apparel', amount: 800 },
  { region: 'North', category: 'Electronics', amount: 1500 },
  { region: 'South', category: 'Electronics', amount: 900 },
  { region: 'South', category: 'Apparel', amount: 1100 },
  { region: 'East', category: 'Electronics', amount: 2200 },
  { region: 'East', category: 'Apparel', amount: 600 },
  { region: 'West', category: 'Apparel', amount: 1400 },
];
const pivotFields = [
  { value: 'region', label: 'Region' },
  { value: 'category', label: 'Category' },
  { value: 'amount', label: 'Amount' },
];

const formulaFields = ['revenue', 'cost', 'tax', 'discount', 'qty'];
const formulaTokens = [
  { type: 'field', value: 'revenue' },
  { type: 'operator', value: '-' },
  { type: 'field', value: 'cost' },
  { type: 'operator', value: '-' },
  { type: 'field', value: 'tax' },
];

const ruleValue = {
  conditions: [
    { field: 'stock', op: 'lt', value: 'reorder_level' },
    { field: 'category', op: 'equals', value: 'Electronics' },
  ],
  actions: [
    { type: 'create_task', detail: 'Reorder from supplier' },
    { type: 'notify', detail: 'Procurement team' },
  ],
};

const wfNodes = [
  { id: 'n1', type: 'start', label: 'Order received', x: 40, y: 30 },
  { id: 'n2', type: 'task', label: 'Check stock', x: 260, y: 30 },
  { id: 'n3', type: 'decision', label: 'In stock?', x: 460, y: 30 },
  { id: 'n4', type: 'task', label: 'Pick & pack', x: 460, y: 180, desc: 'Zone A' },
  { id: 'n5', type: 'task', label: 'Create PO', x: 460, y: 280 },
  { id: 'n6', type: 'end', label: 'Ship order', x: 40, y: 180 },
];
const wfConnections = [
  { from: 'n1', to: 'n2' },
  { from: 'n2', to: 'n3' },
  { from: 'n3', to: 'n4', label: 'Yes' },
  { from: 'n3', to: 'n5', label: 'No' },
  { from: 'n4', to: 'n6' },
];

export default function EnterpriseShowcase() {
  const [formula, setFormula] = useState(formulaTokens);
  const [rule, setRule] = useState(ruleValue);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiWidget title="Revenue" value="48.2k" unit="$" target={60000} trend="+12.5%" trendUp spark={[{ x: 1, y: 30 }, { x: 2, y: 42 }, { x: 3, y: 38 }, { x: 4, y: 55 }, { x: 5, y: 48 }]} />
        <KpiWidget title="Order Accuracy" value="98.6" unit="%" target={99} trend="+0.4%" trendUp spark={[{ x: 1, y: 96 }, { x: 2, y: 97 }, { x: 3, y: 97.5 }, { x: 4, y: 98 }, { x: 5, y: 98.6 }]} />
        <KpiWidget title="On-time Delivery" value="91.2" unit="%" target={95} trend="-1.8%" trendUp={false} spark={[{ x: 1, y: 93 }, { x: 2, y: 92 }, { x: 3, y: 91.5 }, { x: 4, y: 91 }, { x: 5, y: 91.2 }]} />
        <KpiWidget title="Avg. Cycle Time" value="2.4" unit="days" target={2} trend="+0.2" trendUp={false} spark={[{ x: 1, y: 2.1 }, { x: 2, y: 2.3 }, { x: 3, y: 2.5 }, { x: 4, y: 2.4 }, { x: 5, y: 2.4 }]} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard title="Timeline" description="Chronological event stream with status icons — PO lifecycle, audit trails" icon={ClipboardList}>
          <Timeline items={timeline} />
        </SectionCard>
        <SectionCard title="Activity Feed" description="Who did what, when — social-style enterprise event log" icon={MessageSquare}>
          <ActivityFeed activities={activities} className="h-full" />
        </SectionCard>
      </div>

      <SectionCard title="Kanban Board" description="Drag-and-drop work stages — procurement pipeline, support queues" icon={Layers}>
        <KanbanBoard columns={kanban} />
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard title="Calendar" description="Month grid with multi-day event badges" icon={CheckCircle2}>
          <MiniCalendar events={calEvents} />
        </SectionCard>
        <SectionCard title="Gantt Chart" description="Project schedule with progress overlays over a day timeline" icon={GitBranch}>
          <GanttChart tasks={gantt} days={14} />
        </SectionCard>
      </div>

      <SectionCard title="Scheduler" description="Resource × time-slot grid — dock booking, staff rosters" icon={Truck}>
        <Scheduler resources={scheduler.resources} events={scheduler.events} />
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard title="Tree View" description="Collapsible hierarchy with badges and icons" icon={FolderTree}>
          <TreeView nodes={tree} />
        </SectionCard>
        <SectionCard title="Organization Chart" description="Reporting hierarchy with connector lines" icon={Package}>
          <OrgChart root={org} />
        </SectionCard>
      </div>

      <SectionCard title="Master-Detail" description="List pane + inspector pane — order inbox, record browse" icon={FileText}>
        <MasterDetail
          items={masterItems}
          renderDetail={(item) => (
            <PropertyPanel title={item.title} properties={[
              { label: 'Status', value: item.status, render: (v) => <StatusBadge status={v} /> },
              { label: 'Description', value: item.subtitle },
              { label: 'Created', value: 'Jul 3, 2026' },
              { label: 'Owner', value: 'James Lee' },
              { label: 'Total', value: '$48,200', mono: true },
            ]} />
          )}
        />
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard title="Split View" description="Resizable panes for side-by-side compare" icon={Layers}>
          <SplitView
            left={<div className="p-4"><p className="text-sm font-semibold mb-2">Source</p><p className="text-sm text-muted-foreground">Left pane content — drag the divider to resize.</p></div>}
            right={<div className="p-4"><p className="text-sm font-semibold mb-2">Detail</p><p className="text-sm text-muted-foreground">Right pane content.</p></div>}
          />
        </SectionCard>
        <SectionCard title="Property / Inspector Panel" description="Key-value property grid for the selected record" icon={FileText}>
          <PropertyPanel title="WM-001 · Wireless Mouse" properties={properties} className="h-full" />
        </SectionCard>
      </div>

      <SectionCard title="Heatmap" description="Calendar activity heatmap — contribution density over 16 weeks" icon={MapPin}>
        <Heatmap data={heatmapData} weeks={16} />
      </SectionCard>

      <SectionCard title="Map Component" description="Geo-distributed locations with popup detail" icon={MapPin}>
        <MapWidget markers={markers} center={[-27, 135]} zoom={4} />
      </SectionCard>

      <SectionCard title="Pivot Table + Builder" description="Cross-tab aggregation with row, column, value & function controls" icon={ClipboardList}>
        <PivotTable data={pivotData} fields={pivotFields} rowField="region" colField="category" valueField="amount" agg="sum" />
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard title="Formula Builder" description="Compose expressions from fields, operators & literals" icon={FileText}>
          <FormulaBuilder fields={formulaFields} value={formula} onChange={setFormula} />
        </SectionCard>
        <SectionCard title="Rule Builder" description="Condition groups + actions — workflow automation rules" icon={GitBranch}>
          <RuleBuilder fields={['stock', 'category', 'supplier', 'location']} value={rule} onChange={setRule} />
        </SectionCard>
      </div>

      <SectionCard title="Workflow Designer" description="Node canvas with typed nodes & connector paths" icon={GitBranch}>
        <WorkflowDesigner nodes={wfNodes} connections={wfConnections} />
      </SectionCard>

      <SectionCard title="Widget Library" description="Reusable widget palette for assembling dashboards" icon={Layers}>
        <WidgetLibrary onAdd={() => {}} />
      </SectionCard>

      <SectionCard title="Dashboard Builder" description="Click a widget to add it; hover a tile to remove" icon={ClipboardList}>
        <DashboardBuilder />
      </SectionCard>
    </div>
  );
}