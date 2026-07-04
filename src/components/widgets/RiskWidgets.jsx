import WidgetCard from './WidgetCard';
import { ShieldAlert, Scale, AlertCircle, ShieldX } from 'lucide-react';

export const RiskScore = (p) => <WidgetCard title="Risk Score" value="24" unit="/100" icon={ShieldAlert} accent="amber" trend="Low" trendUp subtitle="Composite" {...p} />;
export const RiskExposure = (p) => <WidgetCard title="Risk Exposure" value="$1.2M" icon={Scale} accent="red" trend="3 high items" trendUp={false} subtitle="Open items" {...p} />;
export const IncidentCount = (p) => <WidgetCard title="Open Incidents" value="7" icon={AlertCircle} accent="amber" trend="2 critical" trendUp={false} subtitle="This month" {...p} />;
export const ComplianceGaps = (p) => <WidgetCard title="Compliance Gaps" value="3" icon={ShieldX} accent="red" trend="-1 resolved" trendUp subtitle="Action needed" {...p} />;