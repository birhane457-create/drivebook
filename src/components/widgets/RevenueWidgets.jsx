import WidgetCard from './WidgetCard';
import { DollarSign, TrendingUp, BarChart3, Globe } from 'lucide-react';

export const RevenueTotal = (p) => <WidgetCard title="Total Revenue" value="$2.4M" icon={DollarSign} accent="emerald" trend="+18.2% MoM" trendUp subtitle="This quarter" {...p} />;
export const RevenueGrowth = (p) => <WidgetCard title="Revenue Growth" value="+18.2%" icon={TrendingUp} accent="emerald" trend="vs +12% last Q" trendUp subtitle="Accelerating" {...p} />;
export const RevenueByChannel = (p) => <WidgetCard title="Revenue by Channel" value="4" unit="channels" icon={BarChart3} accent="primary" subtitle="Online 48% · Retail 32%" {...p} />;
export const RevenueByRegion = (p) => <WidgetCard title="Revenue by Region" value="6" unit="regions" icon={Globe} accent="blue" subtitle="APAC leading 42%" {...p} />;