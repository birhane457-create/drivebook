import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToastMutation } from '@/hooks/useToastMutation';
import { Plus, PackageCheck, ClipboardList, CheckCircle2, DollarSign, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import PurchaseOrderForm from '@/components/purchases/PurchaseOrderForm';
import ReceiveGoods from '@/components/purchases/ReceiveGoods';
import { format } from 'date-fns';

export default function Purchases() {
  const [showForm, setShowForm] = useState(false);
  const [showReceive, setShowReceive] = useState(null);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-created_date'),
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });

  const createMutation = useToastMutation({
    mutationFn: (data) => base44.entities.PurchaseOrder.create(data),
    queryKeys: [['purchase-orders']],
    successMessage: 'Purchase order created',
    onSuccess: () => setShowForm(false),
  });

  const enriched = useMemo(() => orders.map(o => ({
    ...o,
    supplier_name: suppliers.find(s => s.id === o.supplier_id)?.name || 'Unknown',
    location_name: locations.find(l => l.id === o.destination_location_id)?.name || 'Unknown',
  })), [orders, suppliers, locations]);

  const openCount = enriched.filter(o => o.status === 'submitted' || o.status === 'partial').length;
  const receivedCount = enriched.filter(o => o.status === 'received' || o.status === 'closed').length;
  const totalValue = enriched.reduce((a, o) => a + (o.total_amount || 0), 0);

  const kpis = [
    { label: 'Total POs', value: enriched.length, icon: ClipboardList },
    { label: 'Open', value: openCount, icon: PackageCheck },
    { label: 'Received', value: receivedCount, icon: CheckCircle2 },
    { label: 'Total Value', value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign },
  ];

  const statusOptions = ['draft', 'submitted', 'partial', 'received', 'closed', 'cancelled']
    .map(s => ({ value: s, label: s.replace(/_/g, ' ') }));

  const columns = [
    { key: 'po_number', label: 'PO Number', render: (r) => <span className="font-mono font-medium">{r.po_number}</span> },
    { key: 'supplier_name', label: 'Supplier', filterType: 'select', filterOptions: suppliers.map(s => ({ value: s.name, label: s.name })) },
    { key: 'location_name', label: 'Destination' },
    { key: 'total_amount', label: 'Total', align: 'right', render: (r) => `$${(r.total_amount || 0).toFixed(2)}` },
    { key: 'status', label: 'Status', filterType: 'select', filterOptions: statusOptions, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'created_date', label: 'Date', render: (r) => r.created_date ? format(new Date(r.created_date), 'MMM d, yyyy') : '—' },
    {
      key: 'actions', label: '', type: 'actions', align: 'right',
      actions: [
        { label: 'Receive', icon: PackageCheck, onClick: (r) => setShowReceive(r), show: (r) => r.status === 'submitted' || r.status === 'partial' },
      ],
    },
  ];

  const recentActivity = [...enriched].slice(0, 6).map(o => ({
    id: o.id, icon: FileText, color: 'bg-primary',
    user: 'Procurement', action: 'created', target: o.po_number,
    detail: `${o.supplier_name} · $${(o.total_amount || 0).toFixed(2)}`,
    time: o.created_date,
  }));

  return (
    <EnterprisePageLayout
      title="Purchase Orders"
      description="Manage supplier purchases and goods receiving across all locations."
      primaryAction={{ label: 'New Purchase Order', icon: Plus, onClick: () => setShowForm(true) }}
      kpis={kpis}
      activityFeed={recentActivity}
    >
      <AdvancedDataTable
        tableId="purchase-orders"
        columns={columns}
        data={enriched}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        emptyMessage="No purchase orders yet. Create one to start receiving stock."
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <PurchaseOrderForm
            suppliers={suppliers}
            locations={locations}
            onSave={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!showReceive} onOpenChange={() => setShowReceive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Receive Goods — {showReceive?.po_number}</DialogTitle></DialogHeader>
          {showReceive && (
            <ReceiveGoods
              order={showReceive}
              onComplete={() => {
                setShowReceive(null);
                queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
                queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </EnterprisePageLayout>
  );
}