import WidgetCard from './WidgetCard';
import { Factory, Gauge, Activity, Timer } from 'lucide-react';

export const ProductionOutput = (p) => <WidgetCard title="Production Output" value="12.4K" unit="units" icon={Factory} accent="primary" trend="+6.2%" trendUp subtitle="Today" {...p} />;
export const OEE = (p) => <WidgetCard title="OEE" value="84%" icon={Gauge} accent="emerald" trend="+2.1pp" trendUp subtitle="Availability × Perf × Qual" {...p} />;
export const ProductionEfficiency = (p) => <WidgetCard title="Production Efficiency" value="91%" icon={Activity} accent="blue" trend="On target" trendUp subtitle="Plan attainment" {...p} />;
export const ThroughputRate = (p) => <WidgetCard title="Throughput Rate" value="520" unit="u/hr" icon={Timer} accent="purple" trend="+4%" trendUp subtitle="Line A average" {...p} />;