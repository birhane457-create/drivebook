import { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import SectionCard from '@/components/shared/SectionCard';
import StatCard from '@/components/shared/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import PageLoader from '@/components/shared/PageLoader';
import FilterBar from '@/components/shared/FilterBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Package, Plus, Download, Search, AlertCircle, Inbox, CheckCircle2,
  TrendingUp, TrendingDown, Users, DollarSign, Filter, Eye, Edit, Trash2
} from 'lucide-react';

const chartData = [
  { month: 'Jan', sales: 4200, orders: 240 },
  { month: 'Feb', sales: 3800, orders: 210 },
  { month: 'Mar', sales: 5100, orders: 290 },
  { month: 'Apr', sales: 4600, orders: 260 },
  { month: 'May', sales: 6200, orders: 340 },
  { month: 'Jun', sales: 5800, orders: 310 },
];

const swatches = [
  { name: 'Primary', token: 'bg-primary', text: 'text-primary-foreground' },
  { name: 'Accent', token: 'bg-accent', text: 'text-accent-foreground' },
  { name: 'Muted', token: 'bg-muted', text: 'text-muted-foreground' },
  { name: 'Destructive', token: 'bg-destructive', text: 'text-destructive-foreground' },
  { name: 'Card', token: 'bg-card', text: 'text-card-foreground border border-border' },
];

const statusList = ['draft', 'pending', 'approved', 'partial', 'received', 'completed', 'cancelled', 'in_transit', 'active', 'critical'];

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

        {/* Forms */}
        <SectionCard title="Form Controls" description="Consistent inputs, labels, selects" icon={Edit}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Product Name</Label>
              <Input placeholder="Enter product name" />
            </div>
            <div>
              <Label className="mb-1.5 block">Category</Label>
              <Select defaultValue="all">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Progress Indicator</Label>
              <Progress value={68} className="mt-2" />
            </div>
          </div>
        </SectionCard>

        {/* Charts */}
        <SectionCard title="Charts" description="Recharts with primary/accent palette tokens" icon={TrendingUp}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip contentStyle={{ borderRadius: '0.625rem', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="orders" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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