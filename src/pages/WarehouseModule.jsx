import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import {
  PackageCheck, Warehouse as WarehouseIcon, ClipboardList, ArrowLeftRight,
  ClipboardCheck, Boxes, ArrowRight, ChevronRight, Plus,
} from 'lucide-react';

const MODULES = [
  {
    icon: PackageCheck,
    label: 'Receiving',
    desc: 'Receive goods against purchase orders with 3-way matching and ASN scanning.',
    to: '/purchases',
    stat: '3 awaiting',
    accent: 'from-blue-500/15 to-blue-500/5 text-blue-600',
  },
  {
    icon: WarehouseIcon,
    label: 'Putaway',
    desc: 'Directed putaway with bin suggestions, license plates, and capacity awareness.',
    to: '/warehouse-execution',
    stat: '12 pending',
    accent: 'from-violet-500/15 to-violet-500/5 text-violet-600',
  },
  {
    icon: ClipboardList,
    label: 'Picking',
    desc: 'Pick waves, batch picking, and wave optimisation across zones.',
    to: '/warehouse-execution',
    stat: '5 waves open',
    accent: 'from-amber-500/15 to-amber-500/5 text-amber-600',
  },
  {
    icon: ArrowLeftRight,
    label: 'Transfers',
    desc: 'Move stock between locations with approval workflow and in-transit tracking.',
    to: '/transfers',
    stat: '2 in transit',
    accent: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
  },
  {
    icon: ClipboardCheck,
    label: 'Cycle Counts',
    desc: 'Schedule and execute cycle counts with variance reconciliation.',
    to: '/cycle-counting',
    stat: '1 due today',
    accent: 'from-cyan-500/15 to-cyan-500/5 text-cyan-600',
  },
  {
    icon: Boxes,
    label: 'Inventory',
    desc: 'Real-time stock levels across all locations, with reservations and lots.',
    to: '/inventory',
    stat: 'Live',
    accent: 'from-rose-500/15 to-rose-500/5 text-rose-600',
  },
];

export default function WarehouseModule() {
  return (
    <div>
      <PageHeader
        title="Warehouse Operations"
        subtitle="Everything that happens on the floor — from dock to bin to pick"
      >
        <Badge variant="secondary" className="gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 6 modules
        </Badge>
      </PageHeader>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.label} to={m.to}>
              <Card className="group relative overflow-hidden h-full p-5 hover:shadow-lg hover:border-primary/40 transition-all">
                <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full bg-gradient-to-br ${m.accent} opacity-60 blur-xl`} />
                <div className="relative flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.accent} flex items-center justify-center`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className="text-xs">{m.stat}</Badge>
                </div>
                <h3 className="relative font-semibold text-lg mt-4">{m.label}</h3>
                <p className="relative text-sm text-muted-foreground mt-1.5 leading-relaxed">{m.desc}</p>
                <div className="relative mt-4 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Open module <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="mt-6 border-dashed">
        <EmptyState
          illustration="empty-box"
          title="Need a custom workflow?"
          description="Configure new warehouse processes tailored to your operation."
          why="Custom workflows let you encode your SOPs directly into the floor UI, reducing training time and errors."
          actionLabel="Create workflow"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}