import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Scan, Plus } from 'lucide-react';

export default function AddProductLabelForm() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const matches = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, products]);

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.LabelPrintQueue.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-print-queue'] });
      setSelected(null);
      setSearch('');
      setQuantity(1);
    },
  });

  const handleScanEnter = (e) => {
    if (e.key !== 'Enter') return;
    const q = search.toLowerCase();
    const exact = products.find(p => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q);
    if (exact) {
      setSelected(exact);
    } else if (matches.length === 1) {
      setSelected(matches[0]);
    }
  };

  const handleAdd = () => {
    if (!selected) return;
    addMutation.mutate({
      label_type: 'product',
      product_id: selected.id,
      barcode_value: selected.barcode || selected.sku,
      display_text: selected.name,
      quantity: parseInt(quantity) || 1,
      price: selected.selling_price || 0,
      label_date: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Scan barcode or search product name/SKU..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
          onKeyDown={handleScanEnter}
        />
      </div>

      {!selected && matches.length > 0 && (
        <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
          {matches.map(p => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between"
            >
              <span>{p.name}</span>
              <span className="text-muted-foreground text-xs">{p.sku}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-2 border rounded-lg p-3 bg-secondary/50">
          <div className="flex-1">
            <p className="font-medium text-sm">{selected.name}</p>
            <p className="text-xs text-muted-foreground">{selected.barcode || selected.sku}</p>
          </div>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-20"
          />
          <Button onClick={handleAdd} disabled={addMutation.isPending}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}