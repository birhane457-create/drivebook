import WidgetCard from './WidgetCard';
import { Users, Heart, HeartCrack, Star } from 'lucide-react';

export const CustomerCount = (p) => <WidgetCard title="Customers" value="12,480" icon={Users} accent="primary" trend="+620" trendUp subtitle="Active accounts" {...p} />;
export const CustomerLTV = (p) => <WidgetCard title="Avg. LTV" value="$3,240" icon={Heart} accent="emerald" trend="+4.1%" trendUp subtitle="Lifetime value" {...p} />;
export const ChurnRate = (p) => <WidgetCard title="Churn Rate" value="2.4%" icon={HeartCrack} accent="red" trend="-0.6pp" trendUp subtitle="Monthly" {...p} />;
export const NPSScore = (p) => <WidgetCard title="NPS Score" value="62" icon={Star} accent="purple" trend="+8 pts" trendUp subtitle="Promoters 72%" {...p} />;