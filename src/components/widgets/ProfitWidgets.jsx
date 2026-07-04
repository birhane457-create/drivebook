import WidgetCard from './WidgetCard';
import { PieChart, Wallet, Percent, Layers } from 'lucide-react';

export const GrossProfit = (p) => <WidgetCard title="Gross Profit" value="$980K" icon={PieChart} accent="emerald" trend="+14.1%" trendUp subtitle="Margin 40.8%" {...p} />;
export const NetProfit = (p) => <WidgetCard title="Net Profit" value="$612K" icon={Wallet} accent="primary" trend="+9.4%" trendUp subtitle="After tax" {...p} />;
export const ProfitMargin = (p) => <WidgetCard title="Profit Margin" value="25.5%" icon={Percent} accent="purple" trend="+1.8pp" trendUp subtitle="Healthy" {...p} />;
export const ProfitBySegment = (p) => <WidgetCard title="Profit by Segment" value="5" unit="segments" icon={Layers} accent="blue" subtitle="Retail leads at 38%" {...p} />;