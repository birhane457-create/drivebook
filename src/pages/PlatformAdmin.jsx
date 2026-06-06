import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import TenantManager from '@/components/platform/TenantManager';
import FeatureFlagManager from '@/components/platform/FeatureFlagManager';

export default function PlatformAdmin() {
  return (
    <div className="p-6">
      <PageHeader title="Platform Administration" subtitle="Multi-tenant management, feature flags, environment configuration & release management" />
      <Tabs defaultValue="tenants">
        <TabsList className="mb-6">
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
        </TabsList>
        <TabsContent value="tenants"><TenantManager /></TabsContent>
        <TabsContent value="features"><FeatureFlagManager /></TabsContent>
      </Tabs>
    </div>
  );
}