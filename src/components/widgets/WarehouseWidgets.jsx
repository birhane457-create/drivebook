import WidgetCard from './WidgetCard';
import { Warehouse, Truck, Zap, Ruler } from 'lucide-react';

export const WarehouseUtilization = (p) => <WidgetCard title="Warehouse Utilization" value="78%" icon={Warehouse} accent="blue" trend="+5pp" trendUp subtitle="3 of 6 sites >85%" {...p} />;
export const DockThroughput = (p) => <WidgetCard title="Dock Throughput" value="240" unit="hr" icon={Truck} accent="primary" trend="+12%" trendUp subtitle="Pallets / hour" {...p} />;
export const PickEfficiency = (p) => <WidgetCard title="Pick Efficiency" value="142" unit="u/hr" icon={Zap} accent="emerald" trend="+8%" trendUp subtitle="Units per picker hour" {...p} />;
export const StorageCapacity = (p) => <WidgetCard title="Storage Capacity" value="18.4K" unit="m³" icon={Ruler} accent="purple" trend="22% free" trendUp subtitle="Remaining volume" {...p} />;