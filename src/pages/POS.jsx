import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Plus, Minus, X, CreditCard, ShoppingCart, User, Percent, ArrowLeft, ScanBarcode } from 'lucide-react';
import OfflineStatusBar, { useOfflinePOS } from '@/components/pos/OfflinePOSManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import POSPayment from '@/components/pos/POSPayment';
import POSReceipt from '@/components/pos/POSReceipt';

export default function POS() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(null);
  const [locationId, setLocationId] = useState('');
  const searchRef = useRef(null);
  const queryClient = useQueryClient();

  const { isOnline, queue, syncing, cachedProducts, cachedStock, cacheData, queueSale, syncQueue } = useOfflinePOS({
    locationId,
    onSaleCompleted: () => { queryClient.invalidateQueries({ queryKey: ['stock-levels'] }); queryClient.invalidateQueries({ queryKey: ['sales'] }); },
  });

  const { data: fetchedProducts = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => base44.entities.Product.filter({ is_active: true }),
    enabled: isOnline,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
    enabled: isOnline,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isOnline,
  });

  const { data: fetchedStock = [] } = useQuery({
    queryKey: ['stock-levels'],
    queryFn: () => base44.entities.StockLevel.list(),
    enabled: isOnline,
  });

  // Use live data when online, cached when offline
  const products = isOnline ? fetchedProducts : cachedProducts;
  const stockLevels = isOnline ? fetchedStock : cachedStock;

  // Cache products and stock for offline use whenever we have fresh data
  useEffect(() => {
    if (isOnline && fetchedProducts.length > 0) {
      cacheData(fetchedProducts, fetchedStock);
    }
  }, [isOnline, fetchedProducts, fetchedStock]);

  const stores = locations.filter(l => l.type === 'store');

  useEffect(() => {
    if (stores.length > 0 && !locationId) {
      setLocationId(stores[0].id);
    }
  }, [stores, locationId]);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q);
  });

  const getStock = (productId) => {
    const sl = stockLevels.find(s => s.product_id === productId && s.location_id === locationId);
    return sl?.quantity || 0;
  };

  const addToCart = (product) => {
    const stock = getStock(product.id);
    const inCart = cart.find(c => c.product_id === product.id);
    const cartQty = inCart ? inCart.quantity : 0;

    if (cartQty >= stock) {
      toast.error(`Insufficient stock for ${product.name}`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(c => c.product_id === product.id);
      if (existing) {
        return prev.map(c => c.product_id === product.id ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.unit_price } : c);
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        quantity: 1,
        unit_price: product.selling_price,
        tax_rate: product.tax_rate || 0,
        discount: 0,
        tax: (product.selling_price * (product.tax_rate || 0)) / 100,
        total: product.selling_price,
      }];
    });
    setSearch('');
    searchRef.current?.focus();
  };

  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const q = search.trim().toLowerCase();
    if (!q) return;
    // Exact barcode/SKU match (typical of a barcode scanner) auto-adds to cart
    const exact = products.find(p => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q);
    if (exact) {
      addToCart(exact);
      return;
    }
    if (filtered.length === 1) {
      addToCart(filtered[0]);
    }
  };

  const updateCartQty = (productId, delta) => {
    setCart(prev => prev.map(c => {
      if (c.product_id !== productId) return c;
      const newQty = Math.max(0, c.quantity + delta);
      if (newQty === 0) return null;
      if (delta > 0 && newQty > getStock(productId)) {
        toast.error('Insufficient stock');
        return c;
      }
      const discountedPrice = c.unit_price - (c.discount || 0);
      return { ...c, quantity: newQty, tax: (discountedPrice * newQty * c.tax_rate) / 100, total: discountedPrice * newQty };
    }).filter(Boolean));
  };

  const setItemDiscount = (productId, discount) => {
    setCart(prev => prev.map(c => {
      if (c.product_id !== productId) return c;
      const d = parseFloat(discount) || 0;
      const discountedPrice = c.unit_price - d;
      return { ...c, discount: d, tax: (discountedPrice * c.quantity * c.tax_rate) / 100, total: discountedPrice * c.quantity };
    }));
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(c => c.product_id !== productId));
  };

  const subtotal = cart.reduce((sum, c) => sum + c.total, 0);
  const taxTotal = cart.reduce((sum, c) => sum + (c.tax || 0), 0);
  const discountTotal = cart.reduce((sum, c) => sum + (c.discount * c.quantity), 0) + invoiceDiscount;
  const grandTotal = subtotal + taxTotal - invoiceDiscount;

  const handlePaymentComplete = (saleData) => {
    setShowPayment(false);
    setShowReceipt(saleData);
    setCart([]);
    setSelectedCustomer(null);
    setInvoiceDiscount(0);
    queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
    queryClient.invalidateQueries({ queryKey: ['sales'] });
  };

  return (
    <div className="pos-grid -m-6">
      {/* Product Grid */}
      <div className="flex flex-col h-screen overflow-hidden border-r">
        <div className="p-4 border-b bg-card">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/dashboard">
              <Button variant="outline" size="icon" title="Back to Dashboard">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search by name, SKU, or scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 h-11"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="flex-1 p-4">
          {search.trim() === '' ? (
            <div className="text-center py-20 text-muted-foreground">
              <ScanBarcode className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Search a product or scan a barcode to begin</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filtered.map(product => {
                  const stock = getStock(product.id);
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={stock <= 0}
                      className="text-left p-3 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                          {product.name?.[0]}
                        </div>
                        <Badge variant="secondary" className="text-xs">{stock} left</Badge>
                      </div>
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                      <p className="font-bold text-primary mt-1">${product.selling_price?.toFixed(2)}</p>
                    </button>
                  );
                })}
              </div>
              {filtered.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No products found</p>
                </div>
              )}
            </>
          )}
        </ScrollArea>
      </div>

      {/* Cart */}
      <div className="flex flex-col h-screen bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-lg">Cart</h2>
            <Badge variant="secondary">{cart.length} items</Badge>
          </div>
          <OfflineStatusBar isOnline={isOnline} queue={queue} syncing={syncing} onSync={syncQueue} />
          {/* Customer selector */}
          <Select value={selectedCustomer?.id || ''} onValueChange={(id) => setSelectedCustomer(customers.find(c => c.id === id) || null)}>
            <SelectTrigger className="mt-2">
              <User className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Walk-in Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="walk-in">Walk-in Customer</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1 p-4">
          {cart.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.product_id} className="p-3 rounded-lg border bg-background">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">${item.unit_price.toFixed(2)} each</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeFromCart(item.product_id)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateCartQty(item.product_id, -1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateCartQty(item.product_id, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="font-semibold text-sm">${item.total.toFixed(2)}</p>
                  </div>
                  {/* Item discount */}
                  <div className="flex items-center gap-2 mt-2">
                    <Percent className="w-3 h-3 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Discount"
                      value={item.discount || ''}
                      onChange={(e) => setItemDiscount(item.product_id, e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Totals */}
        <div className="p-4 border-t space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-xs">Invoice Discount:</Label>
            <Input
              type="number"
              step="0.01"
              value={invoiceDiscount || ''}
              onChange={(e) => setInvoiceDiscount(parseFloat(e.target.value) || 0)}
              className="h-7 text-xs w-24"
            />
          </div>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>${taxTotal.toFixed(2)}</span></div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-red-500"><span>Discount</span><span>-${discountTotal.toFixed(2)}</span></div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span><span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>
          <Button
            className="w-full h-12 text-base font-semibold mt-3"
            disabled={cart.length === 0}
            onClick={() => setShowPayment(true)}
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Charge ${grandTotal.toFixed(2)}
          </Button>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment</DialogTitle>
          </DialogHeader>
          <POSPayment
            cart={cart}
            subtotal={subtotal}
            taxTotal={taxTotal}
            discountTotal={discountTotal}
            grandTotal={grandTotal}
            invoiceDiscount={invoiceDiscount}
            customer={selectedCustomer}
            locationId={locationId}
            onComplete={handlePaymentComplete}
          />
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={!!showReceipt} onOpenChange={() => setShowReceipt(null)}>
        <DialogContent className="max-w-sm">
          <POSReceipt sale={showReceipt} />
        </DialogContent>
      </Dialog>
    </div>
  );
}