import WidgetCard from './WidgetCard';
import { ShoppingCart, UserCheck, GitBranch, TrendingUp } from 'lucide-react';

export const SalesTotal = (p) => <WidgetCard title="Sales (MTD)" value="$1.9M" icon={ShoppingCart} accent="emerald" trend="+11.5%" trendUp subtitle="1,284 orders" {...p} />;
export const SalesByRep = (p) => <WidgetCard title="Sales by Rep" value="12" unit="reps" icon={UserCheck} accent="primary" subtitle="Top: J. Lee $214K" {...p} />;
export const SalesPipeline = (p) => <WidgetCard title="Sales Pipeline" value="$3.2M" icon={GitBranch} accent="blue" trend="48 deals" trendUp subtitle="22 weighted" {...p} />;
export const SalesGrowth = (p) => <WidgetCard title="Sales Growth" value="+11.5%" icon={TrendingUp} accent="emerald" trend="3 months up" trendUp subtitle="YoY +18%" {...p} />;