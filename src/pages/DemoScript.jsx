import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Crown, Lightbulb, Brain, ShoppingCart, Warehouse, DollarSign,
  BarChart3, Heart, Bot, CheckCircle2, Circle, ChevronRight,
  Play, Clock, User, ArrowRight, Star, Zap, Target, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    id: 1, title: 'Executive Dashboard', time: '1.5 min', path: '/executive',
    icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-50',
    persona: 'CEO / CFO',
    story: 'Open with the top-line view. Show MRR, ARR, gross margin, and platform health across all tenants. This sets the stage — the audience immediately sees scale.',
    highlights: [
      'MRR / ARR growth trend',
      'Active tenants across all verticals',
      'Platform uptime & SLA status',
      'Top performing tenant this quarter',
    ],
    talking_point: '"Before we dive in — here\'s what 4 enterprise tenants look like running on a single platform in real time."'
  },
  {
    id: 2, title: 'AI Insight Hub', time: '2 min', path: '/insights',
    icon: Lightbulb, color: 'text-purple-500', bg: 'bg-purple-50',
    persona: 'VP Operations',
    story: 'Navigate to Insights. Show a revenue anomaly alert and an inventory margin squeeze. Click "Generate Executive Brief" — the AI produces a board-ready summary.',
    highlights: [
      'Revenue anomaly detection',
      'Margin compression alert',
      'AI-generated root cause analysis',
      'One-click executive brief',
    ],
    talking_point: '"The system doesn\'t just show you data — it tells you what to do about it, and why it matters."'
  },
  {
    id: 3, title: 'AI Forecasting', time: '1.5 min', path: '/forecasting',
    icon: Brain, color: 'text-blue-500', bg: 'bg-blue-50',
    persona: 'Supply Chain Director',
    story: 'Show demand forecasting for the top 5 SKUs. Highlight the confidence interval and seasonal adjustment. Click through to a purchase recommendation.',
    highlights: [
      '90-day demand forecast with confidence bands',
      'Seasonality & trend decomposition',
      'Stockout risk probability by SKU',
      'Auto-generated reorder suggestions',
    ],
    talking_point: '"This replaces 3 spreadsheets and a weekly planning meeting. Procurement acts on recommendations, not guesses."'
  },
  {
    id: 4, title: 'Purchase Recommendation', time: '1 min', path: '/purchases',
    icon: ShoppingCart, color: 'text-orange-500', bg: 'bg-orange-50',
    persona: 'Procurement Manager',
    story: 'Show a suggested PO generated from the forecast. Approve it with one click. Watch it flow into the supplier portal automatically.',
    highlights: [
      'AI-suggested PO quantities',
      'Supplier lead time factored in',
      'Budget approval workflow',
      'Auto-notification to supplier',
    ],
    talking_point: '"From forecast to approved PO in under 60 seconds. No emails, no spreadsheets, no delays."'
  },
  {
    id: 5, title: 'Warehouse Execution', time: '2 min', path: '/warehouse-execution',
    icon: Warehouse, color: 'text-green-500', bg: 'bg-green-50',
    persona: 'Warehouse Manager',
    story: 'Walk through a pick wave: show the wave planning grid, assign to pickers, show the mobile WH view. Demonstrate putaway and cycle count in progress.',
    highlights: [
      'Wave planning & task assignment',
      'Real-time picker progress tracking',
      'Bin-level inventory visibility',
      'Cycle count in progress with variance flag',
    ],
    talking_point: '"The warehouse runs itself. Pickers get optimized routes on their mobile device. Managers see everything in real time."'
  },
  {
    id: 6, title: 'POS Sale', time: '1.5 min', path: '/pos',
    icon: ShoppingCart, color: 'text-pink-500', bg: 'bg-pink-50',
    persona: 'Store Manager / Cashier',
    story: 'Ring up a sale. Apply a loyalty discount. Process a split payment. Show the inventory decrement happening live in the WMS.',
    highlights: [
      'Barcode scan to checkout in <30s',
      'Loyalty tier discount applied automatically',
      'Split payment (card + store credit)',
      'Inventory decremented in real time',
    ],
    talking_point: '"POS, loyalty, inventory, and financials are one system. A sale at the register posts to the ledger instantly."'
  },
  {
    id: 7, title: 'Financial Posting', time: '1 min', path: '/financials',
    icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50',
    persona: 'Controller / CFO',
    story: 'Navigate to Financials. Show the GL entry that was just created from the POS sale. Drill into AR, AP, and cost centers. Show real-time P&L.',
    highlights: [
      'Auto-posted GL entry from POS sale',
      'Real-time P&L by cost center',
      'AR aging dashboard',
      'AP payment queue',
    ],
    talking_point: '"Every transaction in the business — sale, purchase, transfer — is instantly reflected in the books. No month-end reconciliation surprises."'
  },
  {
    id: 8, title: 'Benchmarking', time: '1 min', path: '/benchmarking',
    icon: BarChart3, color: 'text-cyan-500', bg: 'bg-cyan-50',
    persona: 'CEO / Board',
    story: 'Show how this tenant compares to industry peers. Highlight areas of competitive advantage and improvement opportunities.',
    highlights: [
      'Inventory turnover vs industry average',
      'Gross margin vs top quartile peers',
      'Fill rate & on-time delivery benchmark',
      'AI-generated improvement roadmap',
    ],
    talking_point: '"Your executives stop asking \'Are we doing well?\' and start asking \'Where exactly do we win?\'"'
  },
  {
    id: 9, title: 'Customer Success', time: '1 min', path: '/customer-success',
    icon: Heart, color: 'text-red-500', bg: 'bg-red-50',
    persona: 'Customer Success / Sales',
    story: 'Show the health score dashboard. Highlight an at-risk tenant with low adoption. Show the automated playbook triggered for the CSM.',
    highlights: [
      'Tenant health score radar',
      'Churn risk signal for at-risk account',
      'Automated CSM playbook triggered',
      'Renewal forecast with expansion probability',
    ],
    talking_point: '"We don\'t wait for customers to churn. The platform tells us who\'s at risk and what to do, 90 days before the renewal."'
  },
  {
    id: 10, title: 'AI Copilot', time: '1.5 min', path: '/ai-copilot',
    icon: Bot, color: 'text-violet-500', bg: 'bg-violet-50',
    persona: 'Any User',
    story: 'Finish by asking the AI Copilot: "Why is gross margin down 2% this month?" — it queries live data and returns a structured, cited answer.',
    highlights: [
      'Natural language query on live data',
      'Cross-module root cause analysis',
      'Cited data sources with drill-down',
      'Suggested follow-up actions',
    ],
    talking_point: '"This is the future of enterprise software. You don\'t navigate menus — you ask questions and get answers."'
  },
];

export default function DemoScript() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const step = STEPS.find(s => s.id === currentStep);
  const Icon = step.icon;
  const progress = (completedSteps.size / STEPS.length) * 100;
  const totalTime = STEPS.reduce((acc, s) => acc + parseFloat(s.time), 0);

  const markComplete = () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Demo Script</h1>
          <p className="text-muted-foreground mt-1">15-minute guided walkthrough that tells a complete business story</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold">{completedSteps.size}/{STEPS.length} steps</p>
            <p className="text-xs text-muted-foreground">~{totalTime} min total</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setCurrentStep(1); setCompletedSteps(new Set()); }}>
            <RefreshCw className="w-4 h-4 mr-1" />Reset
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 mb-3">
            <Progress value={progress} className="flex-1" />
            <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {STEPS.map(s => {
              const SI = s.icon;
              const isActive = s.id === currentStep;
              const isDone = completedSteps.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(s.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive ? 'bg-primary text-primary-foreground shadow' :
                    isDone ? 'bg-green-100 text-green-700' :
                    'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-3 h-3" /> : <SI className="w-3 h-3" />}
                  <span className="hidden sm:inline">{s.title}</span>
                  <span className="sm:hidden">{s.id}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Step Detail */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${step.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${step.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Step {step.id} of {STEPS.length}</Badge>
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />{step.time}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl mt-1">{step.title}</CardTitle>
                  </div>
                </div>
                <Badge className="bg-muted text-muted-foreground border-0 flex items-center gap-1">
                  <User className="w-3 h-3" />{step.persona}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Story */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">What to show</p>
                <p className="text-sm leading-relaxed">{step.story}</p>
              </div>

              {/* Highlights */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Highlights</p>
                <div className="grid grid-cols-2 gap-2">
                  {step.highlights.map(h => (
                    <div key={h} className="flex items-start gap-2 text-sm bg-muted/40 rounded-lg p-2.5">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Talking Point */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Key Talking Point</p>
                </div>
                <p className="text-sm italic text-foreground/80">{step.talking_point}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Link to={step.path} className="flex-1">
                  <Button className="w-full" size="sm">
                    <Play className="w-4 h-4 mr-2" />
                    Open {step.title}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Button
                  variant={completedSteps.has(step.id) ? 'outline' : 'default'}
                  size="sm"
                  onClick={markComplete}
                  className={completedSteps.has(step.id) ? 'text-green-600 border-green-200' : ''}
                >
                  {completedSteps.has(step.id) ? (
                    <><CheckCircle2 className="w-4 h-4 mr-2" />Done</>
                  ) : (
                    <><Circle className="w-4 h-4 mr-2" />Mark Done</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step Navigator */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">All Steps</p>
          {STEPS.map(s => {
            const SI = s.icon;
            const isActive = s.id === currentStep;
            const isDone = completedSteps.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => setCurrentStep(s.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${
                  isActive ? 'border-primary bg-primary/5 shadow-sm' :
                  isDone ? 'border-green-200 bg-green-50' :
                  'border-transparent hover:bg-muted'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isDone ? 'bg-green-100' : s.bg
                }`}>
                  {isDone
                    ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                    : <SI className={`w-4 h-4 ${s.color}`} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.time} · {s.persona}</p>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />}
              </button>
            );
          })}

          <Card className="mt-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Demo Tips</p>
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5"><Zap className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />Use RetailCo tenant for steps 1-4 & 6-7</li>
                <li className="flex items-start gap-1.5"><Zap className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />Switch to Apex Mfg for step 5</li>
                <li className="flex items-start gap-1.5"><Zap className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />Keep AI Copilot as the finale — it always impresses</li>
                <li className="flex items-start gap-1.5"><Zap className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />Don't demo more than 3 modules per call</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}