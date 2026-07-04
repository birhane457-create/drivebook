import WidgetCard from './WidgetCard';
import { Brain, Zap, Workflow } from 'lucide-react';

export const AIUsageCredits = (p) => <WidgetCard title="AI Credits Used" value="48.2K" icon={Zap} accent="primary" trend="62% of quota" trendUp subtitle="This month" {...p} />;
export const ModelAccuracy = (p) => <WidgetCard title="Model Accuracy" value="94.6%" icon={Brain} accent="emerald" trend="+1.2pp" trendUp subtitle="Forecast model" {...p} />;
export const AIResponseTime = (p) => <WidgetCard title="AI Response Time" value="1.4s" icon={Zap} accent="blue" trend="-0.3s" trendUp subtitle="P95 latency" {...p} />;
export const AutomationRate = (p) => <WidgetCard title="Automation Rate" value="68%" icon={Workflow} accent="purple" trend="+9pp" trendUp subtitle="Tasks auto-handled" {...p} />;