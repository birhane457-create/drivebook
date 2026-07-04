import WidgetCard from './WidgetCard';
import { Star, ClipboardCheck, AlertTriangle, Building2 } from 'lucide-react';

export const SupplierPerformance = (p) => <WidgetCard title="Supplier Performance" value="88" icon={Star} accent="emerald" trend="Composite score" trendUp subtitle="48 active" {...p} />;
export const OnTimeReceipt = (p) => <WidgetCard title="On-Time Receipt" value="91%" icon={ClipboardCheck} accent="primary" trend="+2pp" trendUp subtitle="PO deliveries" {...p} />;
export const DefectRate = (p) => <WidgetCard title="Defect Rate" value="1.8%" icon={AlertTriangle} accent="amber" trend="-0.4pp" trendUp subtitle="Inbound QC" {...p} />;
export const SupplierCount = (p) => <WidgetCard title="Active Suppliers" value="48" icon={Building2} accent="blue" trend="+4 new" trendUp subtitle="12 strategic" {...p} />;