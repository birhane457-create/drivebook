import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import ARPanel from '@/components/financials/ARPanel';
import APPanel from '@/components/financials/APPanel';
import CostCenterPanel from '@/components/financials/CostCenterPanel';
import GLPanel from '@/components/financials/GLPanel';

export default function Financials() {
  return (
    <div className="p-6">
      <PageHeader
        title="Financials"
        subtitle="Accounts Receivable, Payable, Cost Centers, Profit Centers & General Ledger"
      />
      <Tabs defaultValue="ar">
        <TabsList className="mb-6">
          <TabsTrigger value="ar">Accounts Receivable</TabsTrigger>
          <TabsTrigger value="ap">Accounts Payable</TabsTrigger>
          <TabsTrigger value="cc">Cost Centers</TabsTrigger>
          <TabsTrigger value="gl">General Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="ar"><ARPanel /></TabsContent>
        <TabsContent value="ap"><APPanel /></TabsContent>
        <TabsContent value="cc"><CostCenterPanel /></TabsContent>
        <TabsContent value="gl"><GLPanel /></TabsContent>
      </Tabs>
    </div>
  );
}