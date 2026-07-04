import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Field from '@/components/shared/Field';
import SectionCard from '@/components/shared/SectionCard';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import PropertyPanel from '@/components/enterprise/PropertyPanel';
import ChartCard from '@/components/charts/ChartCard';
import { TrendAreaChart, BarSeriesChart } from '@/components/charts/StandardCharts';

import DashboardLayout from '@/components/layouts/DashboardLayout';
import ListLayout from '@/components/layouts/ListLayout';
import DetailLayout from '@/components/layouts/DetailLayout';
import MasterDetailLayout from '@/components/layouts/MasterDetailLayout';
import WizardLayout from '@/components/layouts/WizardLayout';
import ApprovalLayout from '@/components/layouts/ApprovalLayout';
import AnalyticsLayout from '@/components/layouts/AnalyticsLayout';
import AdministrationLayout from '@/components/layouts/AdministrationLayout';
import MobileLayout from '@/components/layouts/MobileLayout';
import ExecutiveLayout from '@/components/layouts/ExecutiveLayout';

import { DollarSign, Package, Users, AlertCircle, BarChart3, Boxes, Settings, Truck, FileText, Home, ClipboardList, Shield, Bell, TrendingUp } from 'lucide-react';

const chartData = [
  { x: 'Mon', sales: 4200, orders: 240 }, { x: 'Tue', sales: 3800, orders: 210 },
  { x: 'Wed', sales: 5100, orders: 290 }, { x: 'Thu', sales: 4600, orders: 260 },
  { x: 'Fri', sales: 6200, orders: 340 },
];

function Frame({ title, children }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-xs font-mono text-muted-foreground">{title}</span>
      </div>
      <div className="overflow-auto p-4 bg-muted/20" style={{ maxHeight: 460 }}>{children}</div>
    </div>
  );
}

const kpis = [
  { title: 'Revenue', value: '$48.2k', icon: DollarSign, trend: '+12%', trendUp: true },
  { title: 'Orders', value: '142', icon: Package, trend: '-3%', trendUp: false },
  { title: 'Customers', value: '1,284', icon: Users, trend: '+8%', trendUp: true },
  { title: 'Low Stock', value: '7', icon: AlertCircle, trend: '2 critical', trendUp: false },
];

export default function LayoutShowcase() {
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Frame title="DashboardLayout">
        <DashboardLayout title="Dashboard" subtitle="Operations overview" stats={kpis}>
          <ChartCard title="Sales" icon={TrendingUp}><TrendAreaChart data={chartData} dataKey="sales" xKey="x" height={180} /></ChartCard>
          <SectionCard title="Activity"><p className="text-sm text-muted-foreground">Recent activity feed…</p></SectionCard>
        </DashboardLayout>
      </Frame>

      <Frame title="ListLayout">
        <ListLayout
          title="Products"
          subtitle="Inventory catalog"
          searchValue={search}
          onSearch={setSearch}
          searchPlaceholder="Search products…"
          toolbar={<Button size="sm"><Package className="w-4 h-4 mr-1" /> Add</Button>}
        >
          <div className="rounded-lg border overflow-hidden bg-card">
            <Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {[{ n: 'Wireless Mouse', s: 'WM-001', st: 'active' }, { n: 'USB Cable', s: 'UC-200', st: 'critical' }, { n: 'Desk Lamp', s: 'DL-310', st: 'pending' }].map((r) => (
                  <TableRow key={r.s}><TableCell className="font-medium">{r.n}</TableCell><TableCell className="font-mono text-xs">{r.s}</TableCell><TableCell><StatusBadge status={r.st} /></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ListLayout>
      </Frame>

      <Frame title="DetailLayout">
        <DetailLayout
          title="Wireless Mouse"
          subtitle="WM-001 · Electronics"
          onBack={() => {}}
          tabs={[{ value: 'overview', label: 'Overview' }, { value: 'history', label: 'History' }]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          sidebar={<PropertyPanel title="Properties" properties={[{ label: 'SKU', value: 'WM-001', mono: true }, { label: 'Stock', value: 48 }, { label: 'Status', value: 'active', render: (v) => <StatusBadge status={v} /> }]} />}
        >
          <SectionCard title="Overview">
            <p className="text-sm text-muted-foreground">Main content area for the record detail. Tabbed sections live here, with a property panel on the right.</p>
          </SectionCard>
        </DetailLayout>
      </Frame>

      <Frame title="MasterDetailLayout">
        <MasterDetailLayout
          title="Purchase Orders"
          subtitle="Browse and inspect"
          items={[{ id: 'p1', title: 'PO-2041', subtitle: 'Acme · $48k', status: 'pending' }, { id: 'p2', title: 'PO-2042', subtitle: 'Globex · $12k', status: 'approved' }, { id: 'p3', title: 'PO-2043', subtitle: 'Initech · $7.8k', status: 'partial' }]}
          renderDetail={(item) => <PropertyPanel title={item.title} properties={[{ label: 'Status', value: item.status, render: (v) => <StatusBadge status={v} /> }, { label: 'Supplier', value: item.subtitle }, { label: 'Created', value: 'Jul 3, 2026' }]} />}
        />
      </Frame>

      <Frame title="WizardLayout">
        <WizardLayout title="New Order" subtitle="Create a purchase order" steps={['Details', 'Review', 'Confirm']} currentStep={step} onNext={() => setStep((s) => Math.min(2, s + 1))} onBack={() => setStep((s) => Math.max(0, s - 1))} onFinish={() => {}} isLast={step === 2}>
          <div className="space-y-4">
            <Field label="Supplier" htmlFor="wl-sup"><Input id="wl-sup" placeholder="Select supplier" /></Field>
            <Field label="Expected date" htmlFor="wl-date"><Input id="wl-date" type="date" /></Field>
            <Field label="Notes" htmlFor="wl-notes"><Input id="wl-notes" placeholder="Optional notes" /></Field>
          </div>
        </WizardLayout>
      </Frame>

      <Frame title="ApprovalLayout">
        <ApprovalLayout
          title="PO-2041 Approval"
          subtitle="Awaiting your decision"
          requester="James Lee"
          summaryFields={[{ label: 'Supplier', value: 'Acme Supplies' }, { label: 'Amount', value: '$48,200', mono: true }, { label: 'Items', value: 120 }, { label: 'Destination', value: 'Perth DC' }, { label: 'Status', value: 'pending', render: (v) => <StatusBadge status={v} /> }]}
          history={[{ id: 1, title: 'Submitted by James Lee', time: '2h ago', status: 'info', icon: FileText }, { id: 2, title: 'Routed for approval', time: '1h ago', status: 'info', icon: ClipboardList }]}
        />
      </Frame>

      <Frame title="AnalyticsLayout">
        <AnalyticsLayout title="Inventory Analytics" subtitle="Trends & performance" searchValue={search} onSearch={setSearch} kpis={kpis.slice(0, 3)}>
          <ChartCard title="Sales trend" icon={TrendingUp}><TrendAreaChart data={chartData} dataKey="sales" xKey="x" height={180} /></ChartCard>
          <ChartCard title="Orders" icon={BarChart3}><BarSeriesChart data={chartData} keys={['orders']} xKey="x" height={180} /></ChartCard>
        </AnalyticsLayout>
      </Frame>

      <Frame title="AdministrationLayout">
        <AdministrationLayout
          sections={[
            { id: 'general', label: 'General', icon: Settings, content: <SectionCard title="General Settings"><p className="text-sm text-muted-foreground">Company profile, currency, fiscal year.</p></SectionCard> },
            { id: 'users', label: 'Users & Roles', icon: Users, content: <SectionCard title="Users & Roles"><p className="text-sm text-muted-foreground">Manage team members and permissions.</p></SectionCard> },
            { id: 'security', label: 'Security', icon: Shield, content: <SectionCard title="Security"><p className="text-sm text-muted-foreground">MFA, sessions, audit.</p></SectionCard> },
          ]}
        />
      </Frame>

      <Frame title="MobileLayout">
        <MobileLayout title="WMS Mobile" nav={[{ id: 'home', label: 'Home', icon: Home }, { id: 'pick', label: 'Pick', icon: Boxes }, { id: 'move', label: 'Move', icon: Truck }, { id: 'alerts', label: 'Alerts', icon: Bell }]}>
          <div className="space-y-3">
            <StatCard title="Picks Today" value="48" icon={Package} />
            <StatCard title="Pending Moves" value="12" icon={Truck} />
          </div>
        </MobileLayout>
      </Frame>

      <Frame title="ExecutiveLayout">
        <ExecutiveLayout
          title="Executive Overview"
          subtitle="Enterprise performance"
          kpis={kpis}
          modules={[{ name: 'Warehouse', metric: '99.2% uptime', status: 'active' }, { name: 'Procurement', metric: '3 POs pending', status: 'pending' }, { name: 'Transport', metric: '2 delays', status: 'critical' }]}
        >
          <ChartCard title="Revenue" icon={DollarSign}><TrendAreaChart data={chartData} dataKey="sales" xKey="x" height={160} /></ChartCard>
        </ExecutiveLayout>
      </Frame>
    </div>
  );
}