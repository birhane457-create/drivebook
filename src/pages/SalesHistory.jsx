import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToastMutation } from '@/hooks/useToastMutation';
import { RotateCcw, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';

export default function SalesHistory() {
  const salesQ = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.Sale.list('-created_date') });
  const sales = salesQ.data || [];

  const refundMutation = useToastMutation({
    mutationFn: async (sale) => {
      await base44.entities.Sale.update(sale.id, { status: 'refunded' });
      for (const item of sale.items || []) {
        const stockLevels = await base44.entities.StockLevel.filter({ product_id: item.product_id, location_id: sale.location_id });
        if (stockLevels.length > 0) {
          const sl = stockLevels[0];
          await base44.entities.StockLevel.update(sl.id, { quantity: sl.quantity + item.quantity });
          await base44.entities.InventoryLog.create({
            product_id: item.product_id, product_name: item.product_name, location_id: sale.location_id, type: 'return',
            quantity_change: item.quantity, quantity_before: sl.quantity, quantity_after: sl.quantity + item.quantity,
            reference_id: sale.id, reference_type: 'sale',
          });
        }
      }
    },
    queryKeys: [['sales'], ['stock-levels']],
    successMessage: 'Refund processed',
  });

  const columns = [
    { key: 'sale_number', label: 'Invoice', render: (row) => <span className="font-mono font-medium">{row.sale_number}</span> },
    { key: 'customer_name', label: 'Customer', render: (row) => row.customer_name || 'Walk-in' },
    { key: 'items', label: 'Items', render: (row) => `${row.items?.length || 0} items` },
    { key: 'grand_total', label: 'Total', render: (row) => <span className="font-semibold">${(row.grand_total || 0).toFixed(2)}</span> },
    { key: 'payments', label: 'Payment', render: (row) => (
      <div className="flex gap-1 flex-wrap">
        {row.payments?.map((p, i) => <span key={i} className="text-xs capitalize">{p.method?.replace('_', ' ')}</span>)}
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'created_date', label: 'Date', render: (row) => row.created_date ? format(new Date(row.created_date), 'MMM d, yyyy h:mm a') : '—' },
    { key: 'actions', label: '', type: 'actions', align: 'right', actions: [
      { label: 'Refund', icon: RotateCcw, onClick: (row) => refundMutation.mutate(row), show: (row) => row.status === 'completed', disabled: () => refundMutation.isPending },
    ]},
  ];

  const totalRevenue = sales.reduce((a, b) => a + (b.grand_total || 0), 0);
  const refundedCount = sales.filter(s => s.status === 'refunded').length;
  const avgOrder = sales.length ? totalRevenue / sales.length : 0;

  const kpis = [
    { label: 'Total Sales', value: sales.length, icon: ShoppingCart },
    { label: 'Total Revenue', value: `$${totalRevenue.toFixed(0)}`, icon: DollarSign, trendUp: true },
    { label: 'Refunded', value: refundedCount, icon: RotateCcw },
    { label: 'Avg Order', value: `$${avgOrder.toFixed(2)}`, icon: TrendingUp, trendUp: true },
  ];

  return (
    <EnterprisePageLayout
      title="Sales History"
      description={`${sales.length} total transactions`}
      kpis={kpis}
      isLoading={salesQ.isLoading}
    >
      <AdvancedDataTable
        tableId="sales-history"
        columns={columns}
        data={sales}
        isLoading={salesQ.isLoading}
        error={salesQ.error}
        onRetry={salesQ.refetch}
        emptyMessage="No sales recorded yet."
      />
    </EnterprisePageLayout>
  );
}