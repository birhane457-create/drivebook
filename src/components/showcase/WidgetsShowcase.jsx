import SectionCard from '@/components/shared/SectionCard';
import * as Revenue from '@/components/widgets/RevenueWidgets';
import * as Profit from '@/components/widgets/ProfitWidgets';
import * as Inventory from '@/components/widgets/InventoryWidgets';
import * as Warehouse from '@/components/widgets/WarehouseWidgets';
import * as Sales from '@/components/widgets/SalesWidgets';
import * as Production from '@/components/widgets/ProductionWidgets';
import * as Finance from '@/components/widgets/FinanceWidgets';
import * as Customers from '@/components/widgets/CustomerWidgets';
import * as AI from '@/components/widgets/AIWidgets';
import * as Operations from '@/components/widgets/OperationsWidgets';
import * as Supplier from '@/components/widgets/SupplierWidgets';
import * as Risk from '@/components/widgets/RiskWidgets';
import * as Compliance from '@/components/widgets/ComplianceWidgets';
import * as Forecast from '@/components/widgets/ForecastWidgets';

const groups = [
  { name: 'Revenue', mod: Revenue }, { name: 'Profit', mod: Profit },
  { name: 'Inventory', mod: Inventory }, { name: 'Warehouse', mod: Warehouse },
  { name: 'Sales', mod: Sales }, { name: 'Production', mod: Production },
  { name: 'Finance', mod: Finance }, { name: 'Customers', mod: Customers },
  { name: 'AI', mod: AI }, { name: 'Operations', mod: Operations },
  { name: 'Supplier', mod: Supplier }, { name: 'Risk', mod: Risk },
  { name: 'Compliance', mod: Compliance }, { name: 'Forecast', mod: Forecast },
];

export default function WidgetsShowcase() {
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <SectionCard key={g.name} title={g.name} description={`${g.name} executive widgets`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(g.mod).map(([key, W]) => <W key={key} />)}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}