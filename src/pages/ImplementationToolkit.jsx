import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClipboardList, Database, CalendarCheck, GraduationCap, TestTube,
  CheckCircle2, Circle, Download, Bot, Sparkles, Clock,
  ChevronRight, AlertTriangle, FileText
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TOOLKIT_PHASES = [
  {
    id: 'discovery', label: 'Discovery', icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50',
    duration: '1-2 weeks',
    description: 'Understand the customer\'s current state, pain points, and success criteria.',
    templates: [
      { name: 'Business Requirements Questionnaire', type: 'doc', items: 28 },
      { name: 'Current State Assessment', type: 'doc', items: 15 },
      { name: 'Integration Inventory', type: 'sheet', items: 12 },
      { name: 'Success Criteria Definition', type: 'doc', items: 8 },
      { name: 'Stakeholder Map', type: 'sheet', items: 6 },
    ],
    checklist: [
      { label: 'Stakeholder interviews completed', required: true },
      { label: 'Current system documented', required: true },
      { label: 'Data volumes estimated', required: true },
      { label: 'Integration points identified', required: true },
      { label: 'Go-live date agreed', required: true },
      { label: 'Budget & resource plan signed off', required: false },
    ]
  },
  {
    id: 'migration', label: 'Data Migration', icon: Database, color: 'text-purple-600', bg: 'bg-purple-50',
    duration: '2-4 weeks',
    description: 'Extract, transform, and load all historical data from legacy systems.',
    templates: [
      { name: 'Data Migration Plan', type: 'doc', items: 20 },
      { name: 'Field Mapping Spreadsheet', type: 'sheet', items: 200 },
      { name: 'Data Cleansing Rules', type: 'sheet', items: 45 },
      { name: 'Migration Run Log', type: 'sheet', items: 30 },
      { name: 'Reconciliation Checklist', type: 'doc', items: 18 },
    ],
    checklist: [
      { label: 'Source data extracted & profiled', required: true },
      { label: 'Transformation rules documented', required: true },
      { label: 'Test migration run completed', required: true },
      { label: 'Data reconciliation report approved', required: true },
      { label: 'Cutover migration schedule agreed', required: true },
      { label: 'Rollback plan in place', required: true },
    ]
  },
  {
    id: 'cutover', label: 'Go-Live & Cutover', icon: CalendarCheck, color: 'text-orange-600', bg: 'bg-orange-50',
    duration: '1 week',
    description: 'Execute the production cutover with a detailed minute-by-minute runbook.',
    templates: [
      { name: 'Cutover Runbook', type: 'doc', items: 62 },
      { name: 'Go/No-Go Criteria', type: 'doc', items: 12 },
      { name: 'Communication Plan', type: 'doc', items: 8 },
      { name: 'Rollback Decision Tree', type: 'doc', items: 15 },
      { name: 'Post Go-Live Monitoring Checklist', type: 'sheet', items: 24 },
    ],
    checklist: [
      { label: 'UAT sign-off received', required: true },
      { label: 'Production environment validated', required: true },
      { label: 'Data migration final run complete', required: true },
      { label: 'Go/No-Go meeting held', required: true },
      { label: 'Hypercare team on standby', required: true },
      { label: 'Old system decommission plan agreed', required: false },
    ]
  },
  {
    id: 'training', label: 'Training Plans', icon: GraduationCap, color: 'text-green-600', bg: 'bg-green-50',
    duration: '1-2 weeks',
    description: 'Role-based training programs for end users, power users, and administrators.',
    templates: [
      { name: 'End User Training Plan', type: 'doc', items: 18 },
      { name: 'Admin Training Agenda', type: 'doc', items: 12 },
      { name: 'Quick Reference Cards (per module)', type: 'doc', items: 8 },
      { name: 'Train-the-Trainer Guide', type: 'doc', items: 16 },
      { name: 'Training Completion Tracker', type: 'sheet', items: 40 },
    ],
    checklist: [
      { label: 'Training schedule published', required: true },
      { label: 'Training environments provisioned', required: true },
      { label: 'Role-based curricula defined', required: true },
      { label: 'Admin training complete', required: true },
      { label: 'End user training complete (80% threshold)', required: true },
      { label: 'Training feedback collected', required: false },
    ]
  },
  {
    id: 'uat', label: 'UAT Scripts', icon: TestTube, color: 'text-red-600', bg: 'bg-red-50',
    duration: '1-2 weeks',
    description: 'Structured acceptance test scripts covering all critical business processes.',
    templates: [
      { name: 'UAT Master Script', type: 'doc', items: 84 },
      { name: 'Defect Log Template', type: 'sheet', items: 20 },
      { name: 'Sign-Off Matrix', type: 'sheet', items: 15 },
      { name: 'Business Process Coverage Map', type: 'sheet', items: 30 },
      { name: 'UAT Summary Report', type: 'doc', items: 10 },
    ],
    checklist: [
      { label: 'UAT scenarios cover all critical paths', required: true },
      { label: 'Business users trained on UAT process', required: true },
      { label: 'Defect triage process in place', required: true },
      { label: 'All P1/P2 defects resolved', required: true },
      { label: 'Sign-off obtained from all stakeholders', required: true },
      { label: 'Performance testing passed', required: true },
    ]
  },
];

const TYPE_COLOR = {
  doc: 'bg-blue-100 text-blue-700',
  sheet: 'bg-green-100 text-green-700',
};

export default function ImplementationToolkit() {
  const [selectedPhase, setSelectedPhase] = useState(TOOLKIT_PHASES[0]);
  const [checkedItems, setCheckedItems] = useState({});
  const [generating, setGenerating] = useState(false);
  const [aiOutput, setAiOutput] = useState(null);

  const toggleCheck = (phaseId, label) => {
    const key = `${phaseId}:${label}`;
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isChecked = (phaseId, label) => !!checkedItems[`${phaseId}:${label}`];

  const phaseProgress = (phase) => {
    const total = phase.checklist.length;
    const done = phase.checklist.filter(i => isChecked(phase.id, i.label)).length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  const totalProgress = Math.round(
    TOOLKIT_PHASES.reduce((a, p) => a + phaseProgress(p), 0) / TOOLKIT_PHASES.length
  );

  const generateTemplate = async () => {
    setGenerating(true);
    setAiOutput(null);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an enterprise SaaS implementation consultant. Generate a concise, practical "${selectedPhase.label}" template for a new customer implementing our ERP platform. Include 5-8 specific action items, key questions to ask, and common pitfalls to avoid. Format as markdown with headers and bullets. Max 400 words.`,
    });
    setAiOutput(result);
    setGenerating(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Implementation Toolkit</h1>
          <p className="text-muted-foreground mt-1">Enterprise customer onboarding assets — discovery to go-live</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold">Overall Progress</p>
            <p className="text-xs text-muted-foreground">{totalProgress}% complete</p>
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{totalProgress}%</span>
          </div>
        </div>
      </div>

      {/* Phase Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {TOOLKIT_PHASES.map(phase => {
          const PI = phase.icon;
          const pct = phaseProgress(phase);
          return (
            <button
              key={phase.id}
              onClick={() => setSelectedPhase(phase)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${selectedPhase.id === phase.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-muted/30 hover:bg-muted/60'}`}
            >
              <div className={`w-9 h-9 rounded-lg ${phase.bg} flex items-center justify-center mb-2`}>
                <PI className={`w-4 h-4 ${phase.color}`} />
              </div>
              <p className="text-sm font-semibold">{phase.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{phase.duration}</p>
              <div className="mt-2">
                <Progress value={pct} className="h-1.5" />
                <p className={`text-xs font-medium mt-1 ${pct === 100 ? 'text-green-600' : 'text-muted-foreground'}`}>{pct}%</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Templates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {selectedPhase.label} Templates
            </CardTitle>
            <CardDescription>{selectedPhase.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedPhase.templates.map(t => (
              <div key={t.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.items} items</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs border-0 ${TYPE_COLOR[t.type]}`}>{t.type.toUpperCase()}</Badge>
                  <Button size="sm" variant="ghost"><Download className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Button
                className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
                variant="outline"
                size="sm"
                onClick={generateTemplate}
                disabled={generating}
              >
                {generating ? (
                  <><Clock className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />AI Generate Template</>
                )}
              </Button>
              {aiOutput && (
                <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-purple-600 mb-2 flex items-center gap-1">
                    <Bot className="w-3 h-3" />AI Draft — {selectedPhase.label}
                  </p>
                  <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">{aiOutput}</pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                {selectedPhase.label} Checklist
              </CardTitle>
              <Badge variant="outline">{selectedPhase.checklist.filter(i => isChecked(selectedPhase.id, i.label)).length}/{selectedPhase.checklist.length} done</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedPhase.checklist.map(item => {
              const checked = isChecked(selectedPhase.id, item.label);
              return (
                <button
                  key={item.label}
                  onClick={() => toggleCheck(selectedPhase.id, item.label)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${checked ? 'bg-green-50 border border-green-200' : 'bg-muted/30 hover:bg-muted/60'}`}
                >
                  {checked
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  }
                  <span className={`text-sm font-medium flex-1 ${checked ? 'line-through text-muted-foreground' : ''}`}>{item.label}</span>
                  {item.required && (
                    <Badge variant="outline" className="text-xs border-red-200 text-red-600 flex-shrink-0">Required</Badge>
                  )}
                </button>
              );
            })}

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Phase Progress</p>
                <span className="text-sm font-bold text-primary">{phaseProgress(selectedPhase)}%</span>
              </div>
              <Progress value={phaseProgress(selectedPhase)} className="h-2" />
              {phaseProgress(selectedPhase) === 100 && (
                <div className="mt-3 flex items-center gap-2 text-green-600 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />Phase complete — ready to proceed to next stage
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}