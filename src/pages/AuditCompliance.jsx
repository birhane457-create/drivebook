import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import AuditLog from '@/components/compliance/AuditLog';
import ComplianceMatrix from '@/components/compliance/ComplianceMatrix';

export default function AuditCompliance() {
  return (
    <div className="p-6">
      <PageHeader title="Audit & Compliance" subtitle="Immutable audit logs, SOX / GDPR / ISO 27001 compliance controls & risk tracking" />
      <Tabs defaultValue="audit">
        <TabsList className="mb-6">
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="compliance">Compliance Matrix</TabsTrigger>
        </TabsList>
        <TabsContent value="audit"><AuditLog /></TabsContent>
        <TabsContent value="compliance"><ComplianceMatrix /></TabsContent>
      </Tabs>
    </div>
  );
}