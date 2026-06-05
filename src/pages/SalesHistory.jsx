import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function SalesHistory() {
  const queryClient = useQueryClient();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-created_date'),
  });

  const refundMutation = useMutation({
    mutationFn: async (sale) => {
      await base44.entities.Sale.update(sale.id, { status: 'refunded' });
      // Restore stock
      for (const item of sale.items || []) {
        const stockLevels = await base44.entities.StockLevel.filter({ product_id: item.product_id, location_id: sale.location_id });
        if (stockLevels.length > 0) {
          const sl = stockLevels[0];
          await base44.entities.StockLevel.update(sl.id, { quantity: sl.quantity + item.quantity });
          await base44.entities.InventoryLog.create({
            product_id: item.product_id, product_name: item.product_name,
            location_id: sale.location_id, type: 'return',
            quantity_change: item.quantity, quantity_before: sl.quantity, quantity_after: sl.quantity + item.quantity,
            reference_id: sale.id, reference_type: 'sale',
          });
        }
      }
    },
    onSuccess: () => {
      toast.success('Refund processed');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
    },
  });

  const columns = [
    { key: 'sale_number', label: 'Invoice', render: (row) => <span className="font-mono font-medium">{row.sale_number}</span> },
    { key: 'customer_name', label: 'Customer', render: (row) => row.customer_name || 'Walk-in' },
    { key: 'items', label: 'Items', render: (row) => `${row.items?.length || 0} items` },
    { key: 'grand_total', label: 'Total', render: (row) => <span className="font-semibold">${(row.grand_total || 0).toFixed(2)}</span> },
    { key: 'payments', label: 'Payment', render: (row) => (
      <div className="flex gap-1 flex-wrap">
        {row.payments?.map((p, i) => (
          <span key={i} className="text-xs capitalize">{p.method?.replace('_', ' ')}</span>
        ))}
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'created_date', label: 'Date', render: (row) => row.created_date ? format(new Date(row.created_date), 'MMM d, yyyy h:mm a') : '—' },
    { key: 'actions', label: '', render: (row) => (
      row.status === 'completed' && (
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); refundMutation.mutate(row); }} disabled={refundMutation.isPending}>
          <RotateCcw className="w-4 h-4 mr-1" /> Refund
        </Button>
      )
    )},
  ];

  return (
    <div>
      <PageHeader title="Sales History" subtitle={`${sales.length} total transactions`} />
      <DataTable columns={columns} data={sales} isLoading={isLoading} searchField="sale_number" />
    </div>
  );
}