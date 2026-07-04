import WidgetCard from './WidgetCard';
import { PackageCheck, Truck, Timer, Activity } from 'lucide-react';

export const OrderFulfillment = (p) => <WidgetCard title="Order Fulfillment" value="96.2%" icon={PackageCheck} accent="emerald" trend="+1.8pp" trendUp subtitle="Same-day SLA" {...p} />;
export const OnTimeDelivery = (p) => <WidgetCard title="On-Time Delivery" value="94%" icon={Truck} accent="primary" trend="+3%" trendUp subtitle="Last 30 days" {...p} />;
export const CycleTime = (p) => <WidgetCard title="Cycle Time" value="2.4" unit="days" icon={Timer} accent="blue" trend="-0.3d" trendUp subtitle="Order to delivery" {...p} />;
export const CapacityUtilization = (p) => <WidgetCard title="Capacity Utilization" value="82%" icon={Activity} accent="amber" trend="+6pp" trendUp subtitle="Fleet & labor" {...p} />;