import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Banknote, CreditCard, Building2, Gift, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'credit_card', label: 'Card', icon: CreditCard },
  { value: 'bank_transfer', label: 'Transfer', icon: Building2 },
  { value: 'store_credit', label: 'Credit', icon: Gift },
];

export default function POSPayment({ cart, subtotal, taxTotal, discountTotal, grandTotal, invoiceDiscount, customer, locationId, onComplete }) {
  const [payments, setPayments] = useState([{ method: 'cash', amount: grandTotal }]);
  const queryClient = useQueryClient();

  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const remaining = grandTotal - totalPaid;
  const change = totalPaid > grandTotal ? totalPaid - grandTotal : 0;

  const addPayment = (method) => {
    setPayments(prev => [...prev, { method, amount: remaining > 0 ? remaining : 0 }]);
  };

  const removePayment = (idx) => {
    setPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePayment = (idx, amount) => {
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, amount: parseFloat(amount) || 0 } : p));
  };

  const saleMutation = useMutation({
    mutationFn: async () => {
      const saleNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      
      const saleData = {
        sale_number: saleNumber,
        location_id: locationId,
        customer_id: customer?.id || '',
        customer_name: customer?.name || 'Walk-in',
        items: cart,
        subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        grand_total: grandTotal,
        payments: payments.filter(p => p.amount > 0),
        status: 'completed',
      };

      const sale = await base44.entities.Sale.create(saleData);

      // Deduct stock and log
      for (const item of cart) {
        const stockLevels = await base44.entities.StockLevel.filter({ product_id: item.product_id, location_id: locationId });
        if (stockLevels.length > 0) {
          const sl = stockLevels[0];
          const newQty = Math.max(0, sl.quantity - item.quantity);
          await base44.entities.StockLevel.update(sl.id, { quantity: newQty });
          await base44.entities.InventoryLog.create({
            product_id: item.product_id,
            product_name: item.product_name,
            location_id: locationId,
            type: 'sale',
            quantity_change: -item.quantity,
            quantity_before: sl.quantity,
            quantity_after: newQty,
            reference_id: sale.id,
            reference_type: 'sale',
          });
        }
      }

      // Update customer loyalty
      if (customer) {
        const points = Math.floor(grandTotal);
        await base44.entities.Customer.update(customer.id, {
          loyalty_points: (customer.loyalty_points || 0) + points,
          total_purchases: (customer.total_purchases || 0) + grandTotal,
        });
      }

      return { ...saleData, id: sale.id };
    },
    onSuccess: (data) => {
      toast.success('Sale completed!');
      onComplete(data);
    },
  });

  return (
    <div className="space-y-4">
      <div className="text-center py-3 bg-primary/5 rounded-lg">
        <p className="text-sm text-muted-foreground">Amount Due</p>
        <p className="text-3xl font-bold">${grandTotal.toFixed(2)}</p>
      </div>

      <div className="space-y-3">
        {payments.map((payment, idx) => {
          const method = PAYMENT_METHODS.find(m => m.value === payment.method);
          const Icon = method?.icon || Banknote;
          return (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex items-center gap-2 w-28 text-sm">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="capitalize">{method?.label}</span>
              </div>
              <Input
                type="number"
                step="0.01"
                value={payment.amount}
                onChange={(e) => updatePayment(idx, e.target.value)}
                className="flex-1"
              />
              {payments.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removePayment(idx)}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Split payment buttons */}
      <div className="flex gap-2 flex-wrap">
        {PAYMENT_METHODS.filter(m => !payments.some(p => p.method === m.value)).map(method => (
          <Button key={method.value} variant="outline" size="sm" onClick={() => addPayment(method.value)}>
            <Plus className="w-3 h-3 mr-1" />
            {method.label}
          </Button>
        ))}
      </div>

      {/* Summary */}
      <div className="text-sm space-y-1 pt-2 border-t">
        <div className="flex justify-between"><span>Total Paid</span><span className="font-semibold">${totalPaid.toFixed(2)}</span></div>
        {remaining > 0 && (
          <div className="flex justify-between text-red-500"><span>Remaining</span><span>${remaining.toFixed(2)}</span></div>
        )}
        {change > 0 && (
          <div className="flex justify-between text-emerald-600"><span>Change</span><span>${change.toFixed(2)}</span></div>
        )}
      </div>

      <Button
        className="w-full h-12 text-base"
        disabled={remaining > 0.01 || saleMutation.isPending}
        onClick={() => saleMutation.mutate()}
      >
        {saleMutation.isPending ? 'Processing...' : 'Complete Sale'}
      </Button>
    </div>
  );
}