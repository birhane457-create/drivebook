import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import {
  CheckCircle, Circle, ChevronRight, Building2, Package, Users,
  Truck, ShoppingCart, TrendingUp, Brain, ArrowRight, Star, Zap,
  AlertCircle, PlayCircle
} from 'lucide-react';

const ONBOARDING_STEPS = [
  {
    id: 'company_setup',
    label: 'Company Setup',
    icon: Building2,
    description: 'Configure your company details, fiscal year, and base currency',
    path: '/enterprise-settings',
    points: 10,
    required: true,
    tips: ['Set your base currency correctly — it cannot be changed later', 'Add your tax ID for compliance reporting'],
  },
  {
    id: 'warehouse_setup',
    label: 'Warehouse Setup',
    icon: Building2,
    description: 'Add at least one warehouse or store location',
    path: '/settings',
    points: 10,
    required: true,
    tips: ['Add all physical locations you operate from', 'Assign a manager to each location'],
  },
  {
    id: 'products_imported',
    label: 'Products Imported',
    icon: Package,
    description: 'Add your product catalog with SKUs and pricing',
    path: '/products',
    points: 20,
    required: true,
    tips: ['Import via CSV for bulk products', 'Set reorder levels to enable low-stock alerts'],
  },
  {
    id: 'suppliers_added',
    label: 'Suppliers Added',
    icon: Truck,
    description: 'Add your key suppliers and their contact details',
    path: '/suppliers',
    points: 10,
    required: false,
    tips: ['Link suppliers to products for smart reorder suggestions'],
  },
  {
    id: 'inventory_counted',
    label: 'Initial Inventory Count',
    icon: Package,
    description: 'Set opening stock levels for your products',
    path: '/inventory',
    points: 20,
    required: true,
    tips: ['Use the Cycle Count feature for large catalogs', 'Stock levels are required before making sales'],
  },
  {
    id: 'first_po',
    label: 'First Purchase Order',
    icon: ShoppingCart,
    description: 'Create and confirm your first purchase order',
    path: '/purchases',
    points: 15,
    required: false,
    tips: ['Test the approval workflow with a small PO first'],
  },
  {
    id: 'first_sale',
    label: 'First Sale',
    icon: ShoppingCart,
    description: 'Complete your first sale via POS or sales order',
    path: '/pos',
    points: 15,
    required: false,
    tips: ['Use the POS for walk-in customers', 'Sales orders for B2B with credit terms'],
  },
  {
    id: 'team_invited',
    label: 'Team Invited',
    icon: Users,
    description: 'Invite at least 2 team members with appropriate roles',
    path: '/settings',
    points: 10,
    required: false,
    tips: ['Assign roles carefully — admin access is permanent until revoked'],
  },
  {
    id: 'first_forecast',
    label: 'First AI Forecast',
    icon: Brain,
    description: 'Run your first demand forecast with AI',
    path: '/forecasting',
    points: 20,
    required: false,
    tips: ['Forecasting improves with more historical data — run it after 30 days'],
  },
  {
    id: 'reports_viewed',
    label: 'Review Reports',
    icon: TrendingUp,
    description: 'Explore your analytics and reports dashboard',
    path: '/reports',
    points: 10,
    required: false,
    tips: ['Schedule weekly report emails to your team'],
  },
];

const SAMPLE_TENANTS = [
  { id: 't1', tenant_name: 'Acme Corp', completed_steps: ['company_setup','warehouse_setup','products_imported','suppliers_added','inventory_counted','first_po','first_sale','team_invited','first_forecast','reports_viewed'], health_score: 100 },
  { id: 't2', tenant_name: 'TechStart Ltd', completed_steps: ['company_setup','warehouse_setup','products_imported'], health_score: 40 },
  { id: 't3', tenant_name: 'Global Traders', completed_steps: ['company_setup','warehouse_setup','products_imported','suppliers_added','inventory_counted','first_po'], health_score: 65 },
  { id: 't4', tenant_name: 'Riverside Medical', completed_steps: ['company_setup'], health_score: 10 },
];

function StepItem({ step, completed, onToggle }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-xl transition-all ${completed ? 'border-green-200 bg-green-50/50' : 'border-border hover:border-primary/30'}`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(step.id); }}
          className="flex-shrink-0"
        >
          {completed
            ? <CheckCircle className="w-6 h-6 text-green-500" />
            : <Circle className="w-6 h-6 text-muted-foreground hover:text-primary transition-colors" />
          }
        </button>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${completed ? 'bg-green-100' : 'bg-muted'}`}>
          <step.icon className={`w-4 h-4 ${completed ? 'text-green-600' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${completed ? 'line-through text-muted-foreground' : ''}`}>{step.label}</p>
            {step.required && !completed && <Badge variant="outline" className="text-[10px]">Required</Badge>}
            <Badge className={`text-[10px] ml-auto ${completed ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
              +{step.points} pts
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t mx-4 mt-0">
          <div className="pt-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium mb-2">Pro Tips</p>
              <ul className="space-y-1">
                {step.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Zap className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <Button size="sm" variant="outline" className="gap-1 h-8 flex-shrink-0" onClick={() => window.location.href = step.path}>
              Go <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TenantHealthCard({ tenant }) {
  const totalPoints = ONBOARDING_STEPS.reduce((s, step) => s + step.points, 0);
  const earnedPoints = ONBOARDING_STEPS
    .filter(s => tenant.completed_steps?.includes(s.id))
    .reduce((s, step) => s + step.points, 0);
  const score = Math.round((earnedPoints / totalPoints) * 100);
  const completedCount = tenant.completed_steps?.length || 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-semibold text-sm">{tenant.tenant_name}</p>
            <p className="text-xs text-muted-foreground">{completedCount}/{ONBOARDING_STEPS.length} steps</p>
          </div>
          <div className={`text-2xl font-bold ${score === 100 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
            {score}
          </div>
        </div>
        <Progress value={score} className="h-2 mt-2" />
        <div className="flex gap-1 mt-2 flex-wrap">
          {ONBOARDING_STEPS.map(step => (
            <span
              key={step.id}
              title={step.label}
              className={`w-2 h-2 rounded-full ${tenant.completed_steps?.includes(step.id) ? 'bg-green-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        {score < 100 && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Next: {ONBOARDING_STEPS.find(s => !tenant.completed_steps?.includes(s.id))?.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function OnboardingCenter() {
  const [completedSteps, setCompletedSteps] = useState(
    new Set(['company_setup', 'warehouse_setup', 'products_imported', 'suppliers_added', 'inventory_counted'])
  );

  const totalPoints = ONBOARDING_STEPS.reduce((s, step) => s + step.points, 0);
  const earnedPoints = ONBOARDING_STEPS
    .filter(s => completedSteps.has(s.id))
    .reduce((s, step) => s + step.points, 0);
  const healthScore = Math.round((earnedPoints / totalPoints) * 100);

  const requiredIncomplete = ONBOARDING_STEPS.filter(s => s.required && !completedSteps.has(s.id));
  const nextStep = ONBOARDING_STEPS.find(s => !completedSteps.has(s.id));

  function toggleStep(id) {
    setCompletedSteps(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Onboarding Center" subtitle="Setup wizard · Health score · Training checklist · Tenant progress" />

      <Tabs defaultValue="wizard">
        <TabsList>
          <TabsTrigger value="wizard">Setup Wizard</TabsTrigger>
          <TabsTrigger value="tenants">Tenant Health</TabsTrigger>
          <TabsTrigger value="training">Training Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="wizard" className="space-y-6">
          {/* Health Score Banner */}
          <Card className={`border-2 ${healthScore === 100 ? 'border-green-400 bg-green-50' : healthScore >= 60 ? 'border-yellow-400 bg-yellow-50' : 'border-red-300 bg-red-50'}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${healthScore === 100 ? 'text-green-600' : healthScore >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {healthScore}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Health Score</p>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{completedSteps.size} of {ONBOARDING_STEPS.length} steps complete</span>
                    <span>{earnedPoints}/{totalPoints} points</span>
                  </div>
                  <Progress value={healthScore} className="h-3" />
                  {requiredIncomplete.length > 0 && (
                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {requiredIncomplete.length} required step{requiredIncomplete.length > 1 ? 's' : ''} remaining: {requiredIncomplete.map(s => s.label).join(', ')}
                    </p>
                  )}
                  {healthScore === 100 && (
                    <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                      <Star className="w-3 h-3" /> Platform fully configured — you're ready to scale!
                    </p>
                  )}
                </div>
                {nextStep && (
                  <Button size="sm" className="gap-2 flex-shrink-0" onClick={() => window.location.href = nextStep.path}>
                    <PlayCircle className="w-4 h-4" /> Continue Setup
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Steps */}
          <div className="space-y-2">
            {ONBOARDING_STEPS.map(step => (
              <StepItem
                key={step.id}
                step={step}
                completed={completedSteps.has(step.id)}
                onToggle={toggleStep}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            {[
              { label: 'Fully Onboarded', value: SAMPLE_TENANTS.filter(t => t.completed_steps?.length === ONBOARDING_STEPS.length).length, color: 'text-green-600' },
              { label: 'In Progress', value: SAMPLE_TENANTS.filter(t => t.completed_steps?.length > 0 && t.completed_steps?.length < ONBOARDING_STEPS.length).length, color: 'text-yellow-600' },
              { label: 'Just Started', value: SAMPLE_TENANTS.filter(t => t.completed_steps?.length <= 1).length, color: 'text-red-600' },
              { label: 'Avg Health', value: `${Math.round(SAMPLE_TENANTS.reduce((s, t) => s + (t.health_score || 0), 0) / SAMPLE_TENANTS.length)}`, color: 'text-blue-600' },
            ].map(m => (
              <Card key={m.label}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SAMPLE_TENANTS.map(t => <TenantHealthCard key={t.id} tenant={t} />)}
          </div>
        </TabsContent>

        <TabsContent value="training" className="space-y-3">
          {[
            { category: 'Core Operations', color: 'bg-blue-50 border-blue-200', items: [
              { title: 'Getting Started with WMS Pro', duration: '12 min', type: 'video', done: true },
              { title: 'Managing Products & Inventory', duration: '18 min', type: 'video', done: true },
              { title: 'Creating Your First Purchase Order', duration: '8 min', type: 'guide', done: false },
              { title: 'Processing Sales with POS', duration: '10 min', type: 'video', done: false },
            ]},
            { category: 'Advanced Features', color: 'bg-purple-50 border-purple-200', items: [
              { title: 'AI Forecasting Deep Dive', duration: '22 min', type: 'video', done: false },
              { title: 'Warehouse Execution & Picking', duration: '15 min', type: 'guide', done: false },
              { title: 'Configuring Approval Workflows', duration: '11 min', type: 'guide', done: false },
              { title: 'Financial Reports & GL', duration: '20 min', type: 'video', done: false },
            ]},
            { category: 'Administration', color: 'bg-green-50 border-green-200', items: [
              { title: 'User Roles & Permissions', duration: '9 min', type: 'guide', done: false },
              { title: 'Setting Up White Label Branding', duration: '7 min', type: 'guide', done: false },
              { title: 'API & Webhook Integration', duration: '25 min', type: 'video', done: false },
            ]},
          ].map(section => (
            <Card key={section.category} className={`border ${section.color}`}>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{section.category}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {section.items.map(item => (
                  <div key={item.title} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                    {item.done
                      ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    }
                    <span className={`text-sm flex-1 ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>
                    <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                    <span className="text-xs text-muted-foreground">{item.duration}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}