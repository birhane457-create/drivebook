import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import DeliveryRouteList from '@/components/transport/DeliveryRouteList';
import VehicleManager from '@/components/transport/VehicleManager';
import DeliveryTracking from '@/components/transport/DeliveryTracking';

export default function TransportationManagement() {
  return (
    <div className="p-6">
      <PageHeader
        title="Transportation Management"
        subtitle="Delivery routes, driver assignment, vehicle management & proof of delivery"
      />
      <Tabs defaultValue="routes">
        <TabsList className="mb-6">
          <TabsTrigger value="routes">Delivery Routes</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="tracking">Live Tracking</TabsTrigger>
        </TabsList>
        <TabsContent value="routes"><DeliveryRouteList /></TabsContent>
        <TabsContent value="vehicles"><VehicleManager /></TabsContent>
        <TabsContent value="tracking"><DeliveryTracking /></TabsContent>
      </Tabs>
    </div>
  );
}