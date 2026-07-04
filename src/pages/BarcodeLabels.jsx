import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToastMutation } from '@/hooks/useToastMutation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorState from '@/components/shared/ErrorState';
import { Printer, QrCode, Tags, Package } from 'lucide-react';
import AddProductLabelForm from '@/components/labels/AddProductLabelForm';
import AddShelfLabelForm from '@/components/labels/AddShelfLabelForm';
import PrintQueueList from '@/components/labels/PrintQueueList';
import PrintLabelsSheet from '@/components/labels/PrintLabelsSheet';

export default function BarcodeLabels() {
  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ['label-print-queue'],
    queryFn: () => base44.entities.LabelPrintQueue.filter({ status: 'pending' }, '-created_date'),
  });

  const markPrintedMutation = useToastMutation({
    mutationFn: (ids) => Promise.all(ids.map(id => base44.entities.LabelPrintQueue.update(id, { status: 'printed' }))),
    queryKeys: [['label-print-queue']],
    successMessage: 'Labels marked as printed',
  });

  const handlePrint = () => {
    if (items.length === 0) return;
    window.print();
    markPrintedMutation.mutate(items.map(i => i.id));
  };

  const productCount = items.filter(i => i.label_type === 'product').length;
  const shelfCount = items.filter(i => i.label_type === 'shelf').length;

  const kpis = [
    { label: 'Queued', value: items.length, icon: Printer },
    { label: 'Product Labels', value: productCount, icon: Package },
    { label: 'Shelf Labels', value: shelfCount, icon: Tags },
    { label: 'Ready to Print', value: items.length > 0 ? 'Yes' : '—', icon: QrCode },
  ];

  return (
    <div>
      <div className="print:hidden">
        <EnterprisePageLayout
          title="Barcode Labels"
          description="Generate and bulk-print product & shelf labels"
          primaryAction={{ label: `Print All (${items.length})`, icon: Printer, onClick: handlePrint }}
          kpis={kpis}
        >
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
                <div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
              ) : error ? (
                <ErrorState title="Couldn't load print queue" message={error?.message} onRetry={refetch} />
              ) : (
                <PrintQueueList items={items} />
              )}
            </CardContent>
          </Card>
        </EnterprisePageLayout>
      </div>

      <PrintLabelsSheet items={items} />
    </div>
  );
}