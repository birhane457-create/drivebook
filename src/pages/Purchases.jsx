import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Eye, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import PurchaseOrderForm from '@/components/purchases/PurchaseOrderForm';
import ReceiveGoods from '@/components/purchases/ReceiveGoods';
import { format } from 'date-fns';

export default function Purchases() {
  const [showForm, setShowForm] = useState(false);
  const [showReceive, setShowReceive] = useState(null);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-created_date'),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PurchaseOrder.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); setShowForm(false); },
  });

  const enriched = orders.map(o => ({
    ...o,
    supplier_name: suppliers.find(s => s.id === o.supplier_id)?.name || 'Unknown',
    location_name: locations.find(l => l.id === o.destination_location_id)?.name || 'Unknown',
  }));

  const columns = [
    { key: 'po_number', label: 'PO Number', render: (row) => <span className="font-mono font-medium">{row.po_number}</span> },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'location_name', label: 'Destination' },
    { key: 'total_amount', label: 'Total', render: (row) => `$${(row.total_amount || 0).toFixed(2)}` },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'created_date', label: 'Date', render: (row) => row.created_date ? format(new Date(row.created_date), 'MMM d, yyyy') : '—' },
    { key: 'actions', label: '', render: (row) => (
      <div className="flex gap-1">
        {(row.status === 'submitted' || row.status === 'partial') && (
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setShowReceive(row); }}>
            <PackageCheck className="w-4 h-4 mr-1" /> Receive
          </Button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Purchase Orders" subtitle="Manage supplier purchases and receiving">
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Purchase Order
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={enriched} isLoading={isLoading} searchField="po_number" />

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
              onComplete={() => { setShowReceive(null); queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); queryClient.invalidateQueries({ queryKey: ['stock-levels'] }); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}