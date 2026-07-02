import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import AddProductLabelForm from '@/components/labels/AddProductLabelForm';
import AddShelfLabelForm from '@/components/labels/AddShelfLabelForm';
import PrintQueueList from '@/components/labels/PrintQueueList';
import PrintLabelsSheet from '@/components/labels/PrintLabelsSheet';

export default function BarcodeLabels() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['label-print-queue'],
    queryFn: () => base44.entities.LabelPrintQueue.filter({ status: 'pending' }, '-created_date'),
  });

  const markPrintedMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map(id => base44.entities.LabelPrintQueue.update(id, { status: 'printed' }))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['label-print-queue'] }),
  });

  const handlePrint = () => {
    if (items.length === 0) return;
    window.print();
    markPrintedMutation.mutate(items.map(i => i.id));
  };

  return (
    <div>
      <div className="print:hidden">
        <PageHeader title="Barcode Labels" subtitle="Generate and bulk-print product & shelf labels">
          <Button onClick={handlePrint} disabled={items.length === 0}>
            <Printer className="w-4 h-4 mr-2" /> Print All ({items.length})
          </Button>
        </PageHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Add Product Label</CardTitle></CardHeader>
            <CardContent><AddProductLabelForm /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Add Shelf / Aisle Label</CardTitle></CardHeader>
            <CardContent><AddShelfLabelForm /></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Print Queue</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
            ) : (
              <PrintQueueList items={items} />
            )}
          </CardContent>
        </Card>
      </div>

      <PrintLabelsSheet items={items} />
    </div>
  );
}