import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import BinManagement from '@/components/warehouse/BinManagement';
import PickWaveManager from '@/components/warehouse/PickWaveManager';
import LicensePlateManager from '@/components/warehouse/LicensePlateManager';
import CrossDockPanel from '@/components/warehouse/CrossDockPanel';

export default function WarehouseExecution() {
  return (
    <div className="p-6">
      <PageHeader
        title="Warehouse Execution"
        subtitle="Bin hierarchy, directed putaway, wave/zone/batch picking, LPN & pallet management"
      />
      <Tabs defaultValue="bins">
        <TabsList className="mb-6">
          <TabsTrigger value="bins">Bins & Racks</TabsTrigger>
          <TabsTrigger value="picking">Pick Waves</TabsTrigger>
          <TabsTrigger value="lpn">License Plates</TabsTrigger>
          <TabsTrigger value="crossdock">Cross Docking</TabsTrigger>
        </TabsList>
        <TabsContent value="bins"><BinManagement /></TabsContent>
        <TabsContent value="picking"><PickWaveManager /></TabsContent>
        <TabsContent value="lpn"><LicensePlateManager /></TabsContent>
        <TabsContent value="crossdock"><CrossDockPanel /></TabsContent>
      </Tabs>
    </div>
  );
}