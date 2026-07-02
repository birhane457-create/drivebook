import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BarcodeSVG from '@/components/labels/BarcodeSVG';
import { Trash2 } from 'lucide-react';

export default function PrintQueueList({ items }) {
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: (id) => base44.entities.LabelPrintQueue.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['label-print-queue'] }),
  });

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No labels queued for printing yet.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-3 border rounded-lg p-3">
          <BarcodeSVG value={item.barcode_value} height={36} barUnit={1.2} showText={false} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{item.display_text}</p>
            <p className="text-xs text-muted-foreground">{item.barcode_value}</p>
          </div>
          <Badge variant="secondary" className="capitalize">{item.label_type}</Badge>
          <Badge variant="outline">x{item.quantity}</Badge>
          <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate(item.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}