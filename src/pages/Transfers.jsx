import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import TransferForm from '@/components/transfers/TransferForm';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Transfers() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => base44.entities.StockTransfer.list('-created_date'),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.StockTransfer.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transfers'] }); setShowForm(false); },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ transfer, newStatus }) => {
      const res = await base44.functions.invoke('processTransfer', { transfer_id: transfer.id, new_status: newStatus });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Transfer updated');
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || 'Failed to update transfer');
    },
  });

  const enriched = transfers.map(t => ({
    ...t,
    from_name: locations.find(l => l.id === t.from_location_id)?.name || 'Unknown',
    to_name: locations.find(l => l.id === t.to_location_id)?.name || 'Unknown',
  }));

  const columns = [
    { key: 'transfer_number', label: 'Transfer #', render: (row) => <span className="font-mono font-medium">{row.transfer_number}</span> },
    { key: 'from_name', label: 'From' },
    { key: 'to_name', label: 'To' },
    { key: 'items', label: 'Items', render: (row) => `${row.items?.length || 0} items` },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'created_date', label: 'Date', render: (row) => row.created_date ? format(new Date(row.created_date), 'MMM d, yyyy') : '—' },
    { key: 'actions', label: '', render: (row) => (
      <div className="flex gap-1">
        {row.status === 'pending' && (
          <>
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ transfer: row, newStatus: 'approved' }); }}>
              <Check className="w-4 h-4 text-emerald-600" />
            </Button>
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ transfer: row, newStatus: 'cancelled' }); }}>
              <X className="w-4 h-4 text-red-500" />
            </Button>
          </>
        )}
        {row.status === 'approved' && (
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ transfer: row, newStatus: 'in_transit' }); }}>
            In Transit
          </Button>
        )}
        {row.status === 'in_transit' && (
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ transfer: row, newStatus: 'received' }); }}>
            Received
          </Button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Stock Transfers" subtitle="Transfer inventory between locations">
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Transfer
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={enriched} isLoading={isLoading} searchField="transfer_number" />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
          <TransferForm
            locations={locations}
            onSave={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}