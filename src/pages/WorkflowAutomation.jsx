import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import WorkflowBuilder from '@/components/workflow/WorkflowBuilder';
import WorkflowList from '@/components/workflow/WorkflowList';
import WorkflowLogs from '@/components/workflow/WorkflowLogs';

export default function WorkflowAutomation() {
  const [editingRule, setEditingRule] = useState(null);
  const [activeTab, setActiveTab] = useState('rules');

  return (
    <div className="p-6">
      <PageHeader title="Workflow Automation" subtitle="Trigger → Condition → Action engine for business process automation" />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="rules">Automation Rules</TabsTrigger>
          <TabsTrigger value="builder">Rule Builder</TabsTrigger>
          <TabsTrigger value="logs">Execution Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="rules">
          <WorkflowList onEdit={(rule) => { setEditingRule(rule); setActiveTab('builder'); }} />
        </TabsContent>
        <TabsContent value="builder">
          <WorkflowBuilder rule={editingRule} onSave={() => { setEditingRule(null); setActiveTab('rules'); }} />
        </TabsContent>
        <TabsContent value="logs">
          <WorkflowLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}