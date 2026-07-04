import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Package, MapPin, AlertTriangle, Boxes, Layers, SlidersHorizontal, Sliders } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import Field from '@/components/shared/Field';
import FormDialog from '@/components/dialogs/FormDialog';
import FormSection from '@/components/shared/FormSection';

export default function Inventory() {
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const queryClient = useQueryClient();

  const { data: stockLevels = [], isLoading } = useQuery({ queryKey: ['stock-levels'], queryFn: () => base44.entities.StockLevel.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });

  const adjustMutation = useMutation({
    mutationFn: async ({ stockLevel, newQty, reason }) => {
      const product = products.find(p => p.id === stockLevel.product_id);
      const location = locations.find(l => l.id === stockLevel.location_id);
      await base44.entities.StockLevel.update(stockLevel.id, { quantity: newQty });
      await base44.entities.InventoryLog.create({
        product_id: stockLevel.product_id, product_name: product?.name || '',
        location_id: stockLevel.location_id, location_name: location?.name || '',
        type: 'adjustment', quantity_change: newQty - stockLevel.quantity,
        quantity_before: stockLevel.quantity, quantity_after: newQty, notes: reason,
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stock-levels'] }); setShowAdjust(false); setAdjustItem(null); },
  });

  const enriched = useMemo(() => stockLevels.map(sl => {
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
  }), [stockLevels, products, locations]);

  const totalUnits = enriched.reduce((a, e) => a + (e.quantity || 0), 0);
  const lowStockCount = enriched.filter(e => e.is_low).length;
  const damagedCount = enriched.reduce((a, e) => a + (e.damaged_quantity || 0), 0);

  const kpis = [
    { label: 'Stock Records', value: enriched.length, icon: Boxes },
    { label: 'Total Units', value: totalUnits.toLocaleString(), icon: Package },
    { label: 'Low Stock', value: lowStockCount, icon: AlertTriangle },
    { label: 'Damaged', value: damagedCount, icon: Layers },
  ];

  const locationOptions = useMemo(() => locations.map(l => ({ value: l.name, label: l.name })), [locations]);

  const columns = [
    { key: 'product_name', label: 'Product', render: (r) => (
      <div>
        <p className="font-medium">{r.product_name}</p>
        <p className="text-xs text-muted-foreground">{r.product_sku}</p>
      </div>
    )},
    { key: 'location_name', label: 'Location', filterType: 'select', filterOptions: locationOptions, render: (r) => (
      <div className="flex items-center gap-2">
        <MapPin className="w-3 h-3 text-muted-foreground" />
        <span>{r.location_name}</span>
        <Badge variant="secondary" className="text-xs capitalize">{r.location_type}</Badge>
      </div>
    )},
    { key: 'quantity', label: 'In Stock', align: 'right', render: (r) => (
      <div className="flex items-center gap-2 justify-end">
        <span className={`font-semibold ${r.is_low ? 'text-red-500' : ''}`}>{r.quantity}</span>
        {r.is_low && <AlertTriangle className="w-4 h-4 text-amber-500" />}
      </div>
    )},
    { key: 'damaged_quantity', label: 'Damaged', align: 'right', render: (r) => r.damaged_quantity || 0 },
    { key: 'batch_number', label: 'Batch', render: (r) => r.batch_number || '—' },
    { key: 'expiry_date', label: 'Expiry', render: (r) => r.expiry_date || '—' },
    { key: 'actions', label: '', type: 'actions', align: 'right', actions: [
      { label: 'Adjust', icon: SlidersHorizontal, onClick: (r) => { setAdjustItem(r); setAdjustQty(String(r.quantity)); setShowAdjust(true); } },
    ]},
  ];

  return (
    <EnterprisePageLayout
      title="Inventory"
      description="Track stock levels across all warehouses and store locations."
      kpis={kpis}
    >
      <AdvancedDataTable
        tableId="inventory"
        columns={columns}
        data={enriched}
        isLoading={isLoading}
        emptyMessage="No stock records. Receive purchase orders to build up inventory."
      />

      <FormDialog
        open={showAdjust}
        onOpenChange={setShowAdjust}
        title={`Adjust Stock — ${adjustItem?.product_name || ''}`}
        description="Correct the on-hand quantity. This change is recorded in the inventory audit log."
        submitLabel="Confirm Adjustment"
        isPending={adjustMutation.isPending}
        submitDisabled={adjustQty === '' || isNaN(Number(adjustQty))}
        onSubmit={() => adjustMutation.mutate({ stockLevel: adjustItem, newQty: parseInt(adjustQty), reason: adjustReason })}
      >
        <FormSection title="Quantity" icon={Sliders} columns={2}>
          <Field label="Current Quantity" htmlFor="adj-current">
            <Input id="adj-current" value={adjustItem?.quantity ?? ''} readOnly className="bg-muted/50" />
          </Field>
          <Field label="New Quantity" htmlFor="adj-qty" required>
            <Input id="adj-qty" type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
          </Field>
          <Field label="Reason" htmlFor="adj-reason" help="Used for the inventory audit log." className="sm:col-span-2">
            <Textarea id="adj-reason" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Why is this adjustment being made?" />
          </Field>
        </FormSection>
      </FormDialog>
    </EnterprisePageLayout>
  );
}