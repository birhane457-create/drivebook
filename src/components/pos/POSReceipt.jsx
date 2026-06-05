import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

export default function POSReceipt({ sale }) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-bold text-lg">WMS Pro</h3>
        <p className="text-xs text-muted-foreground">Sales Receipt</p>
      </div>
      <Separator />
      <div className="text-xs space-y-1">
        <div className="flex justify-between"><span>Receipt #</span><span className="font-medium">{sale.sale_number}</span></div>
        <div className="flex justify-between"><span>Date</span><span>{format(new Date(), 'MMM d, yyyy h:mm a')}</span></div>
        <div className="flex justify-between"><span>Customer</span><span>{sale.customer_name}</span></div>
      </div>
      <Separator />
      <div className="space-y-2">
        {sale.items?.map((item, i) => (
          <div key={i} className="text-xs">
            <div className="flex justify-between">
              <span className="font-medium">{item.product_name}</span>
              <span>${item.total?.toFixed(2)}</span>
            </div>
            <p className="text-muted-foreground">
              {item.quantity} x ${item.unit_price?.toFixed(2)}
              {item.discount > 0 && ` (-$${item.discount.toFixed(2)} disc)`}
            </p>
          </div>
        ))}
      </div>
      <Separator />
      <div className="text-xs space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span>${sale.subtotal?.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Tax</span><span>${sale.tax_total?.toFixed(2)}</span></div>
        {sale.discount_total > 0 && (
          <div className="flex justify-between text-red-500"><span>Discount</span><span>-${sale.discount_total?.toFixed(2)}</span></div>
        )}
        <div className="flex justify-between font-bold text-sm pt-1">
          <span>Total</span><span>${sale.grand_total?.toFixed(2)}</span>
        </div>
      </div>
      <Separator />
      <div className="text-xs space-y-1">
        <p className="font-medium">Payment:</p>
        {sale.payments?.map((p, i) => (
          <div key={i} className="flex justify-between">
            <span className="capitalize">{p.method?.replace('_', ' ')}</span>
            <span>${p.amount?.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="text-center text-xs text-muted-foreground mt-4">
        <p>Thank you for your purchase!</p>
      </div>
      <Button onClick={handlePrint} variant="outline" className="w-full">
        <Printer className="w-4 h-4 mr-2" /> Print Receipt
      </Button>
    </div>
  );
}