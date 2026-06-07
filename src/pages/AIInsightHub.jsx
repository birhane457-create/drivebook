import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import ReactMarkdown from 'react-markdown';
import {
  TrendingDown, TrendingUp, AlertTriangle, Lightbulb, RefreshCw,
  Sparkles, ChevronRight, X, Package, DollarSign, Truck, BarChart3,
  Loader2, CheckCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

const CATEGORY_CONFIG = {
  revenue:   { label: 'Revenue',    icon: DollarSign, color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  inventory: { label: 'Inventory',  icon: Package,    color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  margin:    { label: 'Margin',     icon: BarChart3,  color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  supplier:  { label: 'Supplier',   icon: Truck,      color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  cashflow:  { label: 'Cash Flow',  icon: TrendingUp, color: 'text-cyan-600',   bg: 'bg-cyan-50',   border: 'border-cyan-200' },
  anomaly:   { label: 'Anomaly',    icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50',    border: 'border-red-200' },
  operations:{ label: 'Operations', icon: RefreshCw,  color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200' },
};

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', cls: 'bg-red-100 text-red-700' },
  warning:  { label: 'Warning',  cls: 'bg-orange-100 text-orange-700' },
  info:     { label: 'Info',     cls: 'bg-blue-100 text-blue-700' },
  positive: { label: 'Positive', cls: 'bg-green-100 text-green-700' },
};

const SEED_INSIGHTS = [
  {
    id: 'si1', title: 'Revenue down 12.4% vs prior 30 days', category: 'revenue', severity: 'critical',
    summary: 'Total revenue has declined significantly compared to the previous period, driven by stockouts and supplier delays.',
    impact_value: -12.4, impact_unit: '%',
    drivers: ['Electronics category -18% vs prior period', 'Sydney Warehouse stockouts increased 24%', 'Supplier ABC delivery delays rose 11%', 'Average order value dropped $42 (price sensitivity)'],
    recommendations: ['Replenish top 15 SKUs in Electronics immediately', 'Expedite PO #PO-10024 with Supplier ABC', 'Review pricing strategy for Category Electronics', 'Enable backorder mode for high-demand items'],
    is_read: false, is_dismissed: false,
  },
  {
    id: 'si2', title: 'Gross margin erosion detected in Food & Bev', category: 'margin', severity: 'warning',
    summary: 'Gross margin in the Food & Beverage category has dropped from 38% to 29% over the past 45 days.',
    impact_value: -9, impact_unit: 'pp',
    drivers: ['COGS increased 14% due to supplier price hikes', 'Promotional discounts averaging 22% (target: 15%)', '3 slow-moving SKUs pulling category margin down'],
    recommendations: ['Renegotiate pricing with top 3 F&B suppliers', 'Reduce blanket discount to 15% max', 'Discontinue or clearance the 3 lowest-margin SKUs'],
    is_read: false, is_dismissed: false,
  },
  {
    id: 'si3', title: '14 SKUs at critical stockout risk within 7 days', category: 'inventory', severity: 'critical',
    summary: 'Based on current velocity and open POs, 14 high-demand SKUs will reach zero stock before replenishment arrives.',
    impact_value: 14, impact_unit: 'SKUs',
    drivers: ['Average daily sales velocity increased 31% this week', 'Lead times from 2 key suppliers extended by 5 days', 'Safety stock thresholds were not updated after velocity change'],
    recommendations: ['Create emergency POs for top 5 critical SKUs today', 'Transfer stock from Melbourne to Sydney for 4 SKUs', 'Update reorder points for all 14 affected products'],
    is_read: true, is_dismissed: false,
  },
  {
    id: 'si4', title: 'Cash flow positive signal: AR collections up 28%', category: 'cashflow', severity: 'positive',
    summary: 'Accounts receivable collections improved significantly this month, improving projected cash position by $84K.',
    impact_value: 28, impact_unit: '%',
    drivers: ['Automated payment reminders reduced avg days outstanding from 41 to 29', 'Net-30 customers paying 4 days earlier on average', '$48K previously overdue invoice from Acme Corp collected'],
    recommendations: ['Extend automated payment reminder to all Net-60 accounts', 'Consider early payment discounts (1% Net-10) for large accounts'],
    is_read: false, is_dismissed: false,
  },
  {
    id: 'si5', title: 'Supplier TechSupply reliability score dropped to 61/100', category: 'supplier', severity: 'warning',
    summary: 'TechSupply has missed 3 delivery windows in the last 6 weeks. On-time delivery rate dropped from 94% to 61%.',
    impact_value: -33, impact_unit: 'pp',
    drivers: ['3 late deliveries in 6 weeks', 'Average delay 4.2 days per late order', '$12,400 in expedite costs incurred', 'Affects 8 products currently relying solely on TechSupply'],
    recommendations: ['Qualify an alternative supplier for the 8 affected products', 'Issue formal performance notice to TechSupply', 'Increase safety stock for TechSupply-sourced products by 20%'],
    is_read: false, is_dismissed: false,
  },
  {
    id: 'si6', title: 'Unusual spike in POS voids at Melbourne store', category: 'anomaly', severity: 'warning',
    summary: 'Melbourne POS terminal detected 47 void transactions in the last 24 hours — 3.8× normal rate.',
    impact_value: 47, impact_unit: 'voids',
    drivers: ['47 voids vs 12-day average of 12.4', 'Concentrated between 14:00–18:00 shift', 'Same operator ID on 38 of the 47 voids'],
    recommendations: ['Review CCTV footage for the afternoon shift', 'Temporarily require manager approval for voids', 'Run full cash reconciliation for last 7 days at Melbourne'],
    is_read: false, is_dismissed: false,
  },
];

function InsightCard({ insight, onDismiss, onMarkRead, expanded, onToggle }) {
  const cat = CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.operations;
  const sev = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.info;
  const isPositive = insight.severity === 'positive';

  return (
    <Card className={`border ${cat.border} transition-all ${insight.is_read ? 'opacity-80' : ''}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg ${cat.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
            <cat.icon className={`w-4 h-4 ${cat.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <h4 className="font-semibold text-sm leading-tight flex-1">{insight.title}</h4>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge className={`text-[10px] ${sev.cls}`}>{sev.label}</Badge>
                {insight.impact_value !== undefined && (
                  <span className={`text-sm font-bold flex items-center gap-0.5 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {Math.abs(insight.impact_value)}{insight.impact_unit}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{insight.summary}</p>
          </div>
        </div>

        {/* Expand/Collapse */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t pt-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Root Cause Drivers</p>
              <ul className="space-y-1">
                {insight.drivers?.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground mt-0.5">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Recommended Actions</p>
              <ol className="space-y-1">
                {insight.recommendations?.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="font-bold text-primary w-4 flex-shrink-0">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t">
          <button
            onClick={onToggle}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            {expanded ? 'Collapse' : 'View details'}
            <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
          <div className="ml-auto flex gap-2">
            {!insight.is_read && (
              <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={onMarkRead}>
                <CheckCircle className="w-3 h-3 mr-1" /> Mark read
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-muted-foreground" onClick={onDismiss}>
              <X className="w-3 h-3 mr-1" /> Dismiss
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AIInsightHub() {
  const [expandedId, setExpandedId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [localInsights, setLocalInsights] = useState(SEED_INSIGHTS);
  const [aiSummary, setAiSummary] = useState('');
  const qc = useQueryClient();

  const { data: dbInsights = [] } = useQuery({
    queryKey: ['insights'],
    queryFn: () => base44.entities.Insight.list('-created_date', 50),
  });

  const saveMut = useMutation({
    mutationFn: (d) => base44.entities.Insight.create(d),
    onSuccess: () => qc.invalidateQueries(['insights']),
  });

  const allInsights = [...localInsights, ...dbInsights].filter(i => !i.is_dismissed);

  const filtered = allInsights.filter(i => {
    const catMatch = categoryFilter === 'all' || i.category === categoryFilter;
    const sevMatch = severityFilter === 'all' || i.severity === severityFilter;
    return catMatch && sevMatch;
  });

  const counts = {
    critical: allInsights.filter(i => i.severity === 'critical').length,
    warning: allInsights.filter(i => i.severity === 'warning').length,
    positive: allInsights.filter(i => i.severity === 'positive').length,
    unread: allInsights.filter(i => !i.is_read).length,
  };

  function dismissInsight(id) {
    setLocalInsights(prev => prev.map(i => i.id === id ? { ...i, is_dismissed: true } : i));
  }

  function markRead(id) {
    setLocalInsights(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i));
  }

  async function generateExecutiveSummary() {
    setGenerating(true);
    setAiSummary('');
    const context = allInsights.map(i =>
      `[${i.severity.toUpperCase()}] ${i.title}: ${i.summary}. Drivers: ${i.drivers?.join(', ')}. Actions: ${i.recommendations?.join(', ')}`
    ).join('\n\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a Chief of Staff AI assistant. Based on the following business insights from the ERP system, write a concise executive briefing in markdown format. Include: a 2-sentence overall health summary, top 3 priority actions for the CEO today, and key financial metrics mentioned. Be direct and actionable. Use bullet points.\n\nInsights:\n${context}`,
    });
    setAiSummary(result);
    setGenerating(false);
  }

  async function generateNewInsights() {
    setGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate 2 new business insights for an enterprise WMS/ERP platform. Format as JSON array with fields: title, category (one of: revenue/inventory/margin/supplier/cashflow/anomaly/operations), severity (warning/info/critical/positive), summary, impact_value (number), impact_unit (string), drivers (array of strings), recommendations (array of strings). Make them realistic and actionable.`,
      response_json_schema: {
        type: 'object',
        properties: {
          insights: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                category: { type: 'string' },
                severity: { type: 'string' },
                summary: { type: 'string' },
                impact_value: { type: 'number' },
                impact_unit: { type: 'string' },
                drivers: { type: 'array', items: { type: 'string' } },
                recommendations: { type: 'array', items: { type: 'string' } },
              }
            }
          }
        }
      }
    });
    const newOnes = (result.insights || []).map((ins, i) => ({
      ...ins, id: `ai-${Date.now()}-${i}`, is_read: false, is_dismissed: false
    }));
    setLocalInsights(prev => [...newOnes, ...prev]);
    setGenerating(false);
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="AI Insight Hub" subtitle="Revenue anomalies · Margin alerts · Inventory risk · Executive briefings">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={generateNewInsights} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Generate Insights
          </Button>
          <Button size="sm" onClick={generateExecutiveSummary} disabled={generating} className="gap-2 bg-purple-600 hover:bg-purple-700">
            <Sparkles className="w-4 h-4" /> Executive Brief
          </Button>
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Critical', value: counts.critical, color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: AlertTriangle },
          { label: 'Warnings', value: counts.warning, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: AlertTriangle },
          { label: 'Positive', value: counts.positive, color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: TrendingUp },
          { label: 'Unread', value: counts.unread, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Lightbulb },
        ].map(s => (
          <Card key={s.label} className={`border ${s.bg}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Executive Brief */}
      {aiSummary && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              AI Executive Briefing
              <button onClick={() => setAiSummary('')} className="ml-auto text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReactMarkdown className="prose prose-sm max-w-none text-sm [&>*:first-child]:mt-0">
              {aiSummary}
            </ReactMarkdown>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground self-center">{filtered.length} insights</span>
      </div>

      {/* Insights List */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Insights</TabsTrigger>
          <TabsTrigger value="critical">Critical ({counts.critical})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({counts.unread})</TabsTrigger>
        </TabsList>
        {['all', 'critical', 'unread'].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
            {filtered
              .filter(i => tab === 'all' || (tab === 'critical' && i.severity === 'critical') || (tab === 'unread' && !i.is_read))
              .map(insight => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  expanded={expandedId === insight.id}
                  onToggle={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
                  onDismiss={() => dismissInsight(insight.id)}
                  onMarkRead={() => markRead(insight.id)}
                />
              ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}