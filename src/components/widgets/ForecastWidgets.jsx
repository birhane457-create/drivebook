import WidgetCard from './WidgetCard';
import { Target, LineChart } from 'lucide-react';

export const ForecastAccuracy = (p) => <WidgetCard title="Forecast Accuracy" value="91.4%" icon={Target} accent="emerald" trend="+2.3pp" trendUp subtitle="MAPE 8.6%" {...p} />;
export const DemandForecast = (p) => <WidgetCard title="Demand Forecast" value="+14%" icon={LineChart} accent="primary" trend="Next 30 days" trendUp subtitle="AI-projected" {...p} />;