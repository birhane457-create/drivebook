import WidgetCard from './WidgetCard';
import { FileCheck, BadgeCheck, BookCheck, GraduationCap } from 'lucide-react';

export const AuditStatus = (p) => <WidgetCard title="Audit Status" value="On Track" icon={FileCheck} accent="emerald" trend="2 pending" trendUp subtitle="SOC2 · ISO27001" {...p} />;
export const ComplianceScore = (p) => <WidgetCard title="Compliance Score" value="94%" icon={BadgeCheck} accent="primary" trend="+3pp" trendUp subtitle="All frameworks" {...p} />;
export const PolicyAdherence = (p) => <WidgetCard title="Policy Adherence" value="98%" icon={BookCheck} accent="blue" trend="2 exceptions" trendUp={false} subtitle="Enforced" {...p} />;
export const TrainingCompletion = (p) => <WidgetCard title="Training Completion" value="89%" icon={GraduationCap} accent="purple" trend="+5pp" trendUp subtitle="Security awareness" {...p} />;