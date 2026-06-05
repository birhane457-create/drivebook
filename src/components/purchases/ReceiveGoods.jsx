import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ReceiveGoods({ order, onComplete }) {
  const [receivingQtys, setReceivingQtys] = useState(
    (order.items || []).map(item => ({
      ...item,
      receiving_now: item.quantity_ordered - (item.quantity_received || 0),
    }))
  );

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const updatedItems = order.items.map((item, idx) => ({
        ...item,
        quantity_received: (item.quantity_received || 0) + receivingQtys[idx].receiving_now,
      }));

      const allReceived = updatedItems.every(i => i.quantity_received >= i.quantity_ordered);
      const newStatus = allReceived ? 'received' : 'partial';

      await base44.entities.PurchaseOrder.update(order.id, {
        items: updatedItems,
        status: newStatus,
      });

      // Update stock levels
      for (let idx = 0; idx < updatedItems.length; idx++) {
        const item = updatedItems[idx];
        const qty = receivingQtys[idx].receiving_now;
        if (qty <= 0) continue;

        const existing = await base44.entities.StockLevel.filter({
          product_id: item.product_id,
          location_id: order.destination_location_id,
        });

        if (existing.length > 0) {
          const sl = existing[0];
          const newQty = sl.quantity + qty;
          await base44.entities.StockLevel.update(sl.id, { quantity: newQty });
          await base44.entities.InventoryLog.create({
            product_id: item.product_id,
            product_name: item.product_name,
            location_id: order.destination_location_id,
            type: 'purchase_receive',
            quantity_change: qty,
            quantity_before: sl.quantity,
            quantity_after: newQty,
            reference_id: order.id,
            reference_type: 'purchase_order',
          });
        } else {
          await base44.entities.StockLevel.create({
            product_id: item.product_id,
            location_id: order.destination_location_id,
            quantity: qty,
          });
          await base44.entities.InventoryLog.create({
            product_id: item.product_id,
            product_name: item.product_name,
            location_id: order.destination_location_id,
            type: 'purchase_receive',
            quantity_change: qty,
            quantity_before: 0,
            quantity_after: qty,
            reference_id: order.id,
            reference_type: 'purchase_order',
          });
        }
      }
    },
    onSuccess: () => { toast.success('Goods received successfully'); onComplete(); },
  });

  return (
    <div className="space-y-4">
      {receivingQtys.map((item, idx) => {
        const remaining = item.quantity_ordered - (order.items[idx].quantity_received || 0);
        return (
          <div key={idx} className="flex items-center justify-between gap-4 py-2 border-b">
            <div className="flex-1">
              <p className="font-medium text-sm">{item.product_name}</p>
              <p className="text-xs text-muted-foreground">
                Ordered: {item.quantity_ordered} | Previously received: {order.items[idx].quantity_received || 0} | Remaining: {remaining}
              </p>
            </div>
            <Input
              type="number"
              min={0}
              max={remaining}
              value={item.receiving_now}
              onChange={(e) => {
                const val = Math.min(parseInt(e.target.value) || 0, remaining);
                setReceivingQtys(prev => prev.map((r, i) => i === idx ? { ...r, receiving_now: val } : r));
              }}
              className="w-24"
            />
          </div>
        );
      })}
      <Button className="w-full" disabled={receiveMutation.isPending} onClick={() => receiveMutation.mutate()}>
        {receiveMutation.isPending ? 'Processing...' : 'Confirm Receipt'}
      </Button>
    </div>
  );
}