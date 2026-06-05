import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import BOMList from '@/components/manufacturing/BOMList';
import ProductionOrderList from '@/components/manufacturing/ProductionOrderList';

export default function Manufacturing() {
  return (
    <div className="p-6">
      <PageHeader
        title="Manufacturing"
        subtitle="Bill of Materials, Kitting, Assembly, Production & Work Orders"
      />
      <Tabs defaultValue="bom">
        <TabsList className="mb-6">
          <TabsTrigger value="bom">Bill of Materials</TabsTrigger>
          <TabsTrigger value="production">Production Orders</TabsTrigger>
        </TabsList>
        <TabsContent value="bom"><BOMList /></TabsContent>
        <TabsContent value="production"><ProductionOrderList /></TabsContent>
      </Tabs>
    </div>
  );
}