import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function AddShelfLabelForm() {
  const [text, setText] = useState('');
  const [quantity, setQuantity] = useState(1);
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.LabelPrintQueue.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-print-queue'] });
      setText('');
      setQuantity(1);
    },
  });

  const handleAdd = () => {
    if (!text.trim()) return;
    addMutation.mutate({
      label_type: 'shelf',
      barcode_value: text.trim(),
      display_text: text.trim(),
      quantity: parseInt(quantity) || 1,
    });
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Label>Shelf / Aisle Label</Label>
        <Input
          placeholder="e.g. Aisle 4, Shelf B2"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
      </div>
      <div className="w-20">
        <Label>Qty</Label>
        <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </div>
      <Button onClick={handleAdd} disabled={addMutation.isPending}>
        <Plus className="w-4 h-4 mr-1" /> Add
      </Button>
    </div>
  );
}