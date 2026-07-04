import WidgetCard from './WidgetCard';
import { Boxes, Activity, RefreshCw, CalendarClock } from 'lucide-react';

export const InventoryValue = (p) => <WidgetCard title="Inventory Value" value="$4.8M" icon={Boxes} accent="primary" trend="+3.2%" trendUp subtitle="Across 6 locations" {...p} />;
export const StockHealth = (p) => <WidgetCard title="Stock Health" value="92%" icon={Activity} accent="emerald" trend="8 SKOs low" trendUp={false} subtitle="4 critical" {...p} />;
export const TurnoverRate = (p) => <WidgetCard title="Inventory Turnover" value="6.4x" icon={RefreshCw} accent="blue" trend="+0.8x" trendUp subtitle="Trailing 12 months" {...p} />;
export const DaysOfStock = (p) => <WidgetCard title="Days of Stock" value="38" unit="days" icon={CalendarClock} accent="amber" trend="-2 days" trendUp subtitle="On hand" {...p} />;