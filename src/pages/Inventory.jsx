import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Package, MapPin, AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';

export default function Inventory() {
  const [locationFilter, setLocationFilter] = useState('all');
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const queryClient = useQueryClient();

  const { data: stockLevels = [], isLoading } = useQuery({
    queryKey: ['stock-levels'],
    queryFn: () => base44.entities.StockLevel.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ stockLevel, newQty, reason }) => {
      const product = products.find(p => p.id === stockLevel.product_id);
      const location = locations.find(l => l.id === stockLevel.location_id);
      await base44.entities.StockLevel.update(stockLevel.id, { quantity: newQty });
      await base44.entities.InventoryLog.create({
        product_id: stockLevel.product_id,
        product_name: product?.name || '',
        location_id: stockLevel.location_id,
        location_name: location?.name || '',
        type: 'adjustment',
        quantity_change: newQty - stockLevel.quantity,
        quantity_before: stockLevel.quantity,
        quantity_after: newQty,
        notes: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
      setShowAdjust(false);
      setAdjustItem(null);
    },
  });

  const enriched = stockLevels.map(sl => {
    const product = products.find(p => p.id === sl.product_id);
    const location = locations.find(l => l.id === sl.location_id);
    return {
      ...sl,
      product_name: product?.name || 'Unknown',
      product_sku: product?.sku || '',
      location_name: location?.name || 'Unknown',
      location_type: location?.type || '',
      reorder_level: product?.reorder_level || 10,
      is_low: sl.quantity <= (product?.reorder_level || 10),
    };
  });

  const filtered = locationFilter === 'all' ? enriched : enriched.filter(e => e.location_id === locationFilter);

  const columns = [
    { key: 'product_name', label: 'Product', render: (row) => (
      <div>
        <p className="font-medium">{row.product_name}</p>
        <p className="text-xs text-muted-foreground">{row.product_sku}</p>
      </div>
    )},
    { key: 'location_name', label: 'Location', render: (row) => (
      <div className="flex items-center gap-2">
        <MapPin className="w-3 h-3 text-muted-foreground" />
        <span>{row.location_name}</span>
        <Badge variant="secondary" className="text-xs capitalize">{row.location_type}</Badge>
      </div>
    )},
    { key: 'quantity', label: 'In Stock', render: (row) => (
      <div className="flex items-center gap-2">
        <span className={`font-semibold ${row.is_low ? 'text-red-500' : ''}`}>{row.quantity}</span>
        {row.is_low && <AlertTriangle className="w-4 h-4 text-amber-500" />}
      </div>
    )},
    { key: 'damaged_quantity', label: 'Damaged', render: (row) => row.damaged_quantity || 0 },
    { key: 'batch_number', label: 'Batch', render: (row) => row.batch_number || '—' },
    { key: 'expiry_date', label: 'Expiry', render: (row) => row.expiry_date || '—' },
    { key: 'actions', label: '', render: (row) => (
      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setAdjustItem(row); setAdjustQty(String(row.quantity)); setShowAdjust(true); }}>
        Adjust
      </Button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Track stock levels across all locations">
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} searchField="product_name" />

      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock — {adjustItem?.product_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Quantity: {adjustItem?.quantity}</Label>
            </div>
            <div>
              <Label>New Quantity</Label>
              <Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Why is this adjustment being made?" />
            </div>
            <Button 
              className="w-full" 
              disabled={adjustMutation.isPending}
              onClick={() => adjustMutation.mutate({ stockLevel: adjustItem, newQty: parseInt(adjustQty), reason: adjustReason })}
            >
              {adjustMutation.isPending ? 'Saving...' : 'Confirm Adjustment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}