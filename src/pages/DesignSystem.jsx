import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import SectionCard from '@/components/shared/SectionCard';
import StatCard from '@/components/shared/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import PageLoader from '@/components/shared/PageLoader';
import FilterBar from '@/components/shared/FilterBar';
import StatusBadge from '@/components/shared/StatusBadge';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import FormPatternsDemo from '@/components/forms/FormPatternsDemo';
import ReceivingWorkflowDemo from '@/components/workflow/ReceivingWorkflowDemo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from '@/components/charts/ChartCard';
import { TrendAreaChart, DonutChart, BarSeriesChart } from '@/components/charts/StandardCharts';
import EnterpriseShowcase from '@/components/enterprise/EnterpriseShowcase';
import LayoutShowcase from '@/components/showcase/LayoutShowcase';
import DialogShowcase from '@/components/showcase/DialogShowcase';
import WidgetsShowcase from '@/components/showcase/WidgetsShowcase';
import ChartsShowcase from '@/components/showcase/ChartsShowcase';
import {
  Package, Plus, Download, Search, AlertCircle, Inbox, CheckCircle2,
  TrendingUp, TrendingDown, Users, DollarSign, Filter, Eye, Edit, Trash2,
  Table2, Workflow, Layers, LayoutTemplate, MessageSquare, LayoutGrid, BarChart3, Boxes
} from 'lucide-react';

const chartData = [
  { month: 'Jan', sales: 4200, orders: 240 },
  { month: 'Feb', sales: 3800, orders: 210 },
  { month: 'Mar', sales: 5100, orders: 290 },
  { month: 'Apr', sales: 4600, orders: 260 },
  { month: 'May', sales: 6200, orders: 340 },
  { month: 'Jun', sales: 5800, orders: 310 },
];

const pieData = [
  { name: 'Electronics', value: 12 },
  { name: 'Apparel', value: 8 },
  { name: 'Grocery', value: 15 },
  { name: 'Home', value: 6 },
];

const swatches = [
  { name: 'Primary', token: 'bg-primary', text: 'text-primary-foreground' },
  { name: 'Accent', token: 'bg-accent', text: 'text-accent-foreground' },
  { name: 'Muted', token: 'bg-muted', text: 'text-muted-foreground' },
  { name: 'Destructive', token: 'bg-destructive', text: 'text-destructive-foreground' },
  { name: 'Card', token: 'bg-card', text: 'text-card-foreground border border-border' },
];

const statusList = ['draft', 'pending', 'approved', 'partial', 'received', 'completed', 'cancelled', 'in_transit', 'active', 'critical'];

const demoColumns = [
  { key: 'name', label: 'Product', sortable: true, filterable: true, hideable: false },
  { key: 'sku', label: 'SKU', sortable: true, filterable: true, width: 140 },
  { key: 'category', label: 'Category', sortable: true, filterable: true, filterType: 'select', filterOptions: [
    { value: 'Electronics', label: 'Electronics' },
    { value: 'Office', label: 'Office' },
    { value: 'Furniture', label: 'Furniture' },
  ] },
  { key: 'stock', label: 'Stock', sortable: true, filterable: true, align: 'right' },
  { key: 'status', label: 'Status', sortable: true, filterable: true, filterType: 'select', filterOptions: [
    { value: 'active', label: 'Active' },
    { value: 'critical', label: 'Critical' },
    { value: 'pending', label: 'Pending' },
  ], render: (r) => <StatusBadge status={r.status} /> },
  { key: 'actions', label: 'Actions', type: 'actions', sortable: false, filterable: false, resizable: false, align: 'right', actions: [
    { label: 'View', icon: Eye, onClick: () => {} },
    { label: 'Edit', icon: Edit, onClick: () => {} },
    { label: 'Delete', icon: Trash2, onClick: () => {} },
  ] },
];

const demoData = [
  { id: '1', name: 'Wireless Mouse', sku: 'WM-001', category: 'Electronics', stock: 48, status: 'active' },
  { id: '2', name: 'USB-C Cable 2m', sku: 'UC-200', category: 'Electronics', stock: 3, status: 'critical' },
  { id: '3', name: 'Desk Lamp LED', sku: 'DL-310', category: 'Furniture', stock: 22, status: 'pending' },
  { id: '4', name: 'Notebook A5', sku: 'NB-045', category: 'Office', stock: 140, status: 'active' },
  { id: '5', name: 'Mechanical Keyboard', sku: 'KB-890', category: 'Electronics', stock: 8, status: 'critical' },
  { id: '6', name: 'Office Chair', sku: 'OC-777', category: 'Furniture', stock: 15, status: 'active' },
  { id: '7', name: 'Pen Pack 10', sku: 'PP-012', category: 'Office', stock: 64, status: 'active' },
  { id: '8', name: 'Monitor 27"', sku: 'MN-270', category: 'Electronics', stock: 5, status: 'pending' },
  { id: '9', name: 'Sticky Notes', sku: 'SN-300', category: 'Office', stock: 0, status: 'critical' },
  { id: '10', name: 'Filing Cabinet', sku: 'FC-500', category: 'Furniture', stock: 9, status: 'active' },
  { id: '11', name: 'Webcam HD', sku: 'WC-108', category: 'Electronics', stock: 31, status: 'active' },
  { id: '12', name: 'Whiteboard Marker', sku: 'WM-020', category: 'Office', stock: 4, status: 'critical' },
];

export default function DesignSystem() {
  const [search, setSearch] = useState('');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Design System" subtitle="The unified visual language for WMS Pro — every page should follow these components and patterns" />

      <div className="space-y-8">

        {/* Color Tokens */}
        <SectionCard title="Color Tokens" description="Semantic colors mapped from CSS variables in index.css" icon={Eye}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {swatches.map((s) => (
              <div key={s.name} className={`${s.token} ${s.text} rounded-lg p-4 h-24 flex flex-col justify-between`}>
                <span className="text-xs font-medium opacity-80">{s.name}</span>
                <span className="text-xs font-mono opacity-60">{s.token}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Typography */}
        <SectionCard title="Typography" description="Inter font family · heading tokens for consistent hierarchy" icon={Edit}>
          <div className="space-y-3">
            <div><p className="font-heading text-3xl font-bold tracking-tight">Display Heading 3xl</p></div>
            <div><p className="font-heading text-2xl font-bold tracking-tight">Page Heading 2xl</p></div>
            <div><p className="font-heading text-lg font-semibold">Section Heading lg</p></div>
            <div><p className="text-base font-medium">Body Base — default text</p></div>
            <div><p className="text-sm text-muted-foreground">Muted Small — labels & hints</p></div>
            <div><p className="text-xs text-muted-foreground">Extra Small — badges & metadata</p></div>
          </div>
        </SectionCard>

        {/* Buttons */}
        <SectionCard title="Buttons" description="Variants for primary, secondary, outline, ghost, destructive" icon={Plus}>
          <div className="flex flex-wrap items-center gap-3">
            <Button><Plus className="w-4 h-4 mr-2" /> Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive"><Trash2 className="w-4 h-4 mr-2" /> Destructive</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Button size="lg">Large</Button>
            <Button size="default">Default</Button>
            <Button size="sm">Small</Button>
            <Button size="icon"><Filter className="w-4 h-4" /></Button>
          </div>
        </SectionCard>

        {/* Badges */}
        <SectionCard title="Badges & Status" description="StatusBadge maps workflow states to consistent colors" icon={CheckCircle2}>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusList.map((s) => <StatusBadge key={s} status={s} />)}
          </div>
        </SectionCard>

        {/* Stat Cards */}
        <SectionCard title="Stat Cards" description="KPI tiles with icon, value, and trend" icon={TrendingUp}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Revenue" value="$48.2k" icon={DollarSign} trend="+12.5%" trendUp />
            <StatCard title="Orders Today" value="142" icon={Package} trend="-3.2%" trendUp={false} />
            <StatCard title="Active Customers" value="1,284" icon={Users} trend="+8.1%" trendUp />
            <StatCard title="Low Stock Items" value="7" icon={AlertCircle} trend="2 critical" trendUp={false} />
          </div>
        </SectionCard>

        {/* Filter Bar + Toolbar */}
        <SectionCard title="Filter Bar & Toolbar" description="Standard search + filter selects + action buttons layout" icon={Search}>
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search products..."
            filters={[{ key: 'status', label: 'Status', value: 'all', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] }]}
          >
            <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" /> Export</Button>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add</Button>
          </FilterBar>
        </SectionCard>

        {/* Table */}
        <SectionCard title="Data Table" description="Bordered card, muted header row, hover states, pagination" icon={Eye}>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { name: 'Wireless Mouse', sku: 'WM-001', stock: 48, status: 'active' },
                  { name: 'USB Cable 2m', sku: 'UC-200', stock: 3, status: 'critical' },
                  { name: 'Desk Lamp', sku: 'DL-310', stock: 22, status: 'pending' },
                ].map((row) => (
                  <TableRow key={row.sku} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{row.sku}</TableCell>
                    <TableCell>{row.stock}</TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon"><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        {/* Advanced Table */}
        <SectionCard title="Advanced Data Table" description="The ERP-grade table: sticky headers, resize, column chooser, saved views, advanced filters, bulk actions, export, pagination, row actions, density" icon={Table2}>
          <AdvancedDataTable
            tableId="design-system-demo"
            columns={demoColumns}
            data={demoData}
            enableSelection
            bulkActions={[
              { label: 'Export selected', icon: Download, onClick: () => {} },
              { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => {} },
            ]}
          />
        </SectionCard>

        {/* Forms */}
        <SectionCard title="Form Patterns" description="Validation UI, required fields, help text, sections, tabs, wizard forms, auto-save & unsaved changes warning" icon={Edit}>
          <FormPatternsDemo />
        </SectionCard>

        {/* Workflow UI */}
        <SectionCard title="Workflow UI" description="Steppers & timelines that make multi-step processes feel guided — PO → Receive → Inspect → Putaway → Complete" icon={Workflow}>
          <ReceivingWorkflowDemo />
        </SectionCard>

        {/* Empty States */}
        <SectionCard title="Empty States" description="Illustration, description, why-it-matters, and a create action — never a bare 'No data'" icon={Inbox}>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="border">
              <EmptyState illustration="empty-box" title="No products yet" description="Add your first product to start tracking stock." why="Products are the backbone of every module — without them, purchasing, picking, and POS have nothing to act on." actionLabel="Add product" onAction={() => {}} />
            </Card>
            <Card className="border">
              <EmptyState illustration="no-results" title="No matching results" description="Try adjusting your filters or search query." why="Filtering helps operators find the right record fast — an empty result should guide them, not dead-end." />
            </Card>
            <Card className="border">
              <EmptyState illustration="inbox" title="Nothing to action" description="You're all caught up — no pending tasks." why="A clear 'all done' state reassures users and reduces unnecessary checking throughout the day." />
            </Card>
          </div>
        </SectionCard>

        {/* Charts */}
        <SectionCard title="Standardized Charts" description="Token-driven chart components (ChartCard + TrendAreaChart + DonutChart + BarSeriesChart) shared across dashboards" icon={TrendingUp}>
          <div className="grid lg:grid-cols-3 gap-4">
            <ChartCard title="Revenue Trend" description="Monthly" icon={TrendingUp}>
              <TrendAreaChart data={chartData} dataKey="sales" xKey="month" format={(v) => `$${Number(v).toLocaleString()}`} />
            </ChartCard>
            <ChartCard title="Orders" description="Monthly" icon={TrendingDown}>
              <DonutChart data={pieData} />
            </ChartCard>
            <ChartCard title="Sales vs Orders" description="Bar series" icon={Table2}>
              <BarSeriesChart data={chartData} keys={['sales', 'orders']} xKey="month" />
            </ChartCard>
          </div>
        </SectionCard>

        {/* Enterprise Components */}
        <SectionCard title="Enterprise Components" description="Reusable building blocks inspired by SAP Fiori, Dynamics 365, Oracle Fusion & Odoo — Timeline, Kanban, Scheduler, Gantt, Calendar, Tree View, Org Chart, Split View, Master-Detail, Property Panel, Activity Feed, KPI Widgets, Heatmap, Map, Pivot Builder, Formula Builder, Rule Builder, Workflow Designer, Dashboard Builder & Widget Library" icon={Layers}>
          <EnterpriseShowcase />
        </SectionCard>

        {/* Layout Templates */}
        <SectionCard title="Layout Templates" description="Reusable page skeletons — Dashboard, List, Detail, Master-Detail, Wizard, Approval, Analytics, Administration, Mobile & Executive — every page can adopt one" icon={LayoutTemplate}>
          <LayoutShowcase />
        </SectionCard>

        {/* Enterprise Dialogs */}
        <SectionCard title="Enterprise Dialogs" description="Create, Edit, Approval, Confirmation, Import / Export / Merge / Duplicate / Archive / Delete Wizards & Bulk Edit — click any tile to open it" icon={MessageSquare}>
          <DialogShowcase />
        </SectionCard>

        {/* Executive Widgets */}
        <SectionCard title="Executive Dashboard Widgets" description="52 reusable KPI widgets across 14 domains — each composable and token-styled" icon={LayoutGrid}>
          <WidgetsShowcase />
        </SectionCard>

        {/* Advanced Charts */}
        <SectionCard title="Advanced Charts" description="Sankey, Treemap, Waterfall, Radar, Bubble, KPI Gauge, Timeline, Funnel, Heatmap, Calendar Heatmap, Pareto & Control charts — all reusable" icon={BarChart3}>
          <ChartsShowcase />
        </SectionCard>

        {/* Workflow Screens */}
        <SectionCard title="Workflow Screens" description="End-to-end workflow boards — Receiving, Shipping, Returns, Picking, Packing, Manufacturing & Inspection" icon={Boxes}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { to: '/workflows/receiving', label: 'Receiving' },
              { to: '/workflows/shipping', label: 'Shipping' },
              { to: '/workflows/returns', label: 'Returns' },
              { to: '/workflows/picking', label: 'Picking' },
              { to: '/workflows/packing', label: 'Packing' },
              { to: '/workflows/manufacturing', label: 'Manufacturing' },
              { to: '/workflows/inspection', label: 'Inspection' },
            ].map((w) => (
              <Link key={w.to} to={w.to} className="rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all flex items-center justify-between">
                <span className="text-sm font-medium">{w.label}</span>
                <span className="text-xs text-muted-foreground">Open →</span>
              </Link>
            ))}
          </div>
        </SectionCard>

        {/* States */}
        <SectionCard title="Empty, Loading & Error States" description="Standard components for non-data conditions" icon={Inbox}>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="border">
              <EmptyState icon={Inbox} title="No items yet" description="Add your first product to get started." />
            </Card>
            <Card className="border">
              <PageLoader label="Loading data..." />
            </Card>
            <Card className="border">
              <ErrorState title="Failed to load" message="Check your connection and try again." onRetry={() => {}} />
            </Card>
          </div>
        </SectionCard>

        {/* Layout pattern */}
        <SectionCard title="Page Layout Pattern" description="The standard structure every list page should follow" icon={Eye}>
          <div className="text-sm text-muted-foreground space-y-1.5 font-mono">
            {[
              '<div className="p-6">',
              '  <PageHeader title="..." subtitle="..."><Button>Add</Button></PageHeader>',
              '  <FilterBar searchValue={...} filters={[...]}> actions </FilterBar>',
              '  <DataTable columns={[...]} data={...} isLoading={...} />',
              '  <Dialog> form </Dialog>',
              '</div>',
            ].map((line, i) => (
              <p key={i} className={i === 0 || i === 5 ? '' : 'pl-4'}>{line}</p>
            ))}
          </div>
        </SectionCard>

      </div>
    </div>
  );
}