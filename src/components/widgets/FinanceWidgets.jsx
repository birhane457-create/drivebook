import WidgetCard from './WidgetCard';
import { Wallet, Receipt, CreditCard, Flame } from 'lucide-react';

export const CashFlow = (p) => <WidgetCard title="Cash Flow" value="+$840K" icon={Wallet} accent="emerald" trend="+22%" trendUp subtitle="Operating" {...p} />;
export const ARBalance = (p) => <WidgetCard title="A/R Balance" value="$1.2M" icon={Receipt} accent="amber" trend="$240K overdue" trendUp={false} subtitle="31 days avg" {...p} />;
export const APBalance = (p) => <WidgetCard title="A/P Balance" value="$760K" icon={CreditCard} accent="primary" trend="14 days terms" trendUp subtitle="Due in 30 days" {...p} />;
export const BurnRate = (p) => <WidgetCard title="Burn Rate" value="$320K" unit="/mo" icon={Flame} accent="red" trend="18 months runway" trendUp subtitle="Net cash outflow" {...p} />;