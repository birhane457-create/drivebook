import SectionCard from '@/components/shared/SectionCard';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '@/components/shared/StatusBadge';
import StatCard from '@/components/shared/StatCard';
import ChartCard from '@/components/charts/ChartCard';
import { TrendAreaChart } from '@/components/charts/StandardCharts';
import { iconRules, spacing, elevation } from '@/theme/tokens';
import { statusColors } from '@/constants/status';
import { DollarSign, Package, AlertCircle, AlertTriangle, Info, CheckCircle2, Search, Plus, ChevronRight } from 'lucide-react';

const chartData = [
  { month: 'Jan', sales: 4200 }, { month: 'Feb', sales: 3800 }, { month: 'Mar', sales: 5100 },
  { month: 'Apr', sales: 4600 }, { month: 'May', sales: 6200 }, { month: 'Jun', sales: 5800 },
];

export default function DesignTokensShowcase() {
  return (
    <>
      {/* Icon Rules */}
      <SectionCard title="Icon Rules" description="lucide-react only · sizes · stroke · usage guidelines" icon={Search}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(iconRules.sizes).map(([size, cls]) => {
              const dims = { xs: 12, sm: 16, md: 20, lg: 24 }[size];
              return (
                <div key={size} className="rounded-lg border bg-card p-4 flex flex-col items-center gap-2">
                  <Search className={cls} />
                  <span className="text-xs font-mono text-muted-foreground">{size}</span>
                  <span className="text-[10px] text-muted-foreground">{dims}px</span>
                </div>
              );
            })}
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Guidelines</p>
            <ul className="space-y-1.5">
              {iconRules.guidelines.map((g, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 mt-1 text-muted-foreground flex-shrink-0" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      {/* Card Variants */}
      <SectionCard title="Card Variants" description="Card, SectionCard, ChartCard, StatCard — four surface containers for different contexts" icon={Package}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="border p-4">
            <p className="text-sm font-semibold mb-1">Card</p>
            <p className="text-xs text-muted-foreground">Base surface — border, shadow, bg-card. Use for content containers.</p>
          </Card>
          <div>
            <SectionCard title="SectionCard" description="Wraps a titled section with icon + description">
              <p className="text-xs text-muted-foreground">Grouped content with a header.</p>
            </SectionCard>
          </div>
          <ChartCard title="ChartCard" description="Chart wrapper" icon={DollarSign}>
            <TrendAreaChart data={chartData} dataKey="sales" xKey="month" format={(v) => `$${v}`} />
          </ChartCard>
          <StatCard title="StatCard" value="$48.2k" icon={DollarSign} trend="+12.5%" trendUp />
        </div>
      </SectionCard>

      {/* Alert Styles */}
      <SectionCard title="Alert Styles" description="Info, warning, error & success alerts for inline feedback" icon={AlertTriangle}>
        <div className="space-y-3">
          <Alert>
            <Info className="w-4 h-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>This order has been submitted and is awaiting supplier confirmation.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to save changes — check your connection and try again.</AlertDescription>
          </Alert>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-700">Warning</p>
              <p className="text-sm text-amber-600">Stock for this product is below the reorder level.</p>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-700">Success</p>
              <p className="text-sm text-emerald-600">Purchase order received and inventory updated.</p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Elevation / Shadows */}
      <SectionCard title="Elevation & Shadows" description="Seven shadow levels for consistent depth hierarchy" icon={Package}>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {elevation.levels.map((lvl) => (
            <div key={lvl.name} className={`${lvl.class} rounded-xl border bg-card p-4 h-24 flex flex-col justify-between`}>
              <span className="text-xs font-medium">{lvl.name}</span>
              <span className="text-[10px] font-mono text-muted-foreground break-all">{lvl.class}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Spacing System */}
      <SectionCard title="Spacing System" description="8px-based scale — use these tokens consistently for padding, margin & gap" icon={Plus}>
        <div className="space-y-2">
          {spacing.scale.map((s) => (
            <div key={s.token} className="flex items-center gap-3">
              <span className="text-xs font-mono text-muted-foreground w-12">{s.class}</span>
              <span className="text-xs text-muted-foreground w-12">{s.px}</span>
              <div className="flex-1">
                <div className="h-3 bg-primary/20 rounded-sm" style={{ width: `calc(${s.px} + 4px)` }} />
              </div>
              <span className="text-xs text-muted-foreground w-32 hidden sm:inline">{s.usage}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Table Variants */}
      <SectionCard title="Table Variants" description="Default, striped & compact density modes for data tables" icon={Search}>
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Default</p>
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/50"><TableHead>Product</TableHead><TableHead>Stock</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[
                    { n: 'Wireless Mouse', s: 48, st: 'active' },
                    { n: 'USB-C Cable', s: 3, st: 'critical' },
                    { n: 'Desk Lamp', s: 22, st: 'pending' },
                  ].map((r) => (
                    <TableRow key={r.n} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{r.n}</TableCell><TableCell>{r.s}</TableCell><TableCell><StatusBadge status={r.st} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Striped</p>
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/50"><TableHead>Product</TableHead><TableHead>Stock</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[
                    { n: 'Wireless Mouse', s: 48, st: 'active' },
                    { n: 'USB-C Cable', s: 3, st: 'critical' },
                    { n: 'Desk Lamp', s: 22, st: 'pending' },
                  ].map((r, i) => (
                    <TableRow key={r.n} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                      <TableCell className="font-medium">{r.n}</TableCell><TableCell>{r.s}</TableCell><TableCell><StatusBadge status={r.st} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Compact (py-1)</p>
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/50"><TableHead className="py-1.5">Product</TableHead><TableHead className="py-1.5">Stock</TableHead><TableHead className="py-1.5">Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[
                    { n: 'Wireless Mouse', s: 48, st: 'active' },
                    { n: 'USB-C Cable', s: 3, st: 'critical' },
                    { n: 'Desk Lamp', s: 22, st: 'pending' },
                  ].map((r) => (
                    <TableRow key={r.n} className="hover:bg-muted/50">
                      <TableCell className="py-1.5 font-medium">{r.n}</TableCell><TableCell className="py-1.5">{r.s}</TableCell><TableCell className="py-1.5"><StatusBadge status={r.st} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Status Colors Reference */}
      <SectionCard title="Status Color Reference" description="Complete status → color token mapping from constants/status.js" icon={CheckCircle2}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.entries(statusColors).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2 rounded-lg border bg-card p-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className="text-xs font-mono text-muted-foreground">{key}</span>
              <span className="text-xs font-medium ml-auto">{cfg.label}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}