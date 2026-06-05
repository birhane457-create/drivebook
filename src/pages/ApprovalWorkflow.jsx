import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import ApprovalQueue from '@/components/approvals/ApprovalQueue';
import ApprovalRulesConfig from '@/components/approvals/ApprovalRulesConfig';

export default function ApprovalWorkflow() {
  return (
    <div className="p-6">
      <PageHeader
        title="Approval Workflow"
        subtitle="Multi-level configurable approval rules for purchases, transfers, credit limits & price overrides"
      />
      <Tabs defaultValue="queue">
        <TabsList className="mb-6">
          <TabsTrigger value="queue">Approval Queue</TabsTrigger>
          <TabsTrigger value="rules">Approval Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="queue"><ApprovalQueue /></TabsContent>
        <TabsContent value="rules"><ApprovalRulesConfig /></TabsContent>
      </Tabs>
    </div>
  );
}