import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const STORAGE_KEY = 'wms_offline_queue';
const PRODUCTS_CACHE_KEY = 'wms_products_cache';
const STOCK_CACHE_KEY = 'wms_stock_cache';

export function useOfflinePOS({ locationId, onSaleCompleted }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [syncing, setSyncing] = useState(false);
  const [cachedProducts, setCachedProducts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PRODUCTS_CACHE_KEY) || '[]'); } catch { return []; }
  });
  const [cachedStock, setCachedStock] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STOCK_CACHE_KEY) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); toast.success('Back online! Syncing pending transactions...'); };
    const handleOffline = () => { setIsOnline(false); toast.warning('Offline mode activated. Sales will queue for sync.'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncQueue();
    }
  }, [isOnline]);

  const cacheData = useCallback((products, stock) => {
    setCachedProducts(products);
    setCachedStock(stock);
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
    localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify(stock));
  }, []);

  const queueSale = useCallback((saleData) => {
    const entry = { ...saleData, offline_id: `OFF-${Date.now()}`, queued_at: new Date().toISOString() };
    const newQueue = [...queue, entry];
    setQueue(newQueue);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));

    // Update local stock cache optimistically
    const newStock = cachedStock.map(sl => {
      const saleItem = saleData.items?.find(i => i.product_id === sl.product_id && sl.location_id === locationId);
      if (!saleItem) return sl;
      return { ...sl, quantity: Math.max(0, (sl.quantity || 0) - saleItem.quantity) };
    });
    setCachedStock(newStock);
    localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify(newStock));

    toast.info(`Sale queued offline (${newQueue.length} pending)`);
    return entry;
  }, [queue, cachedStock, locationId]);

  const syncQueue = useCallback(async () => {
    if (syncing || queue.length === 0) return;
    setSyncing(true);
    let synced = 0;
    const remaining = [];

    for (const entry of queue) {
      try {
        const { offline_id, queued_at, ...saleData } = entry;
        const created = await base44.entities.Sale.create(saleData);
        // Update stock levels
        for (const item of (saleData.items || [])) {
          const stockRecord = cachedStock.find(s => s.product_id === item.product_id && s.location_id === locationId);
          if (stockRecord?.id) {
            await base44.entities.StockLevel.update(stockRecord.id, { quantity: Math.max(0, (stockRecord.quantity || 0) - item.quantity) });
          }
          await base44.entities.InventoryLog.create({
            product_id: item.product_id, product_name: item.product_name,
            location_id: locationId, type: 'sale',
            quantity_change: -item.quantity, reference_id: created.id,
            reference_type: 'Sale', notes: `Synced from offline (${offline_id})`
          });
        }
        synced++;
        onSaleCompleted?.(created);
      } catch (err) {
        remaining.push(entry);
      }
    }

    setQueue(remaining);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    setSyncing(false);

    if (synced > 0) toast.success(`${synced} offline sale(s) synced successfully`);
    if (remaining.length > 0) toast.error(`${remaining.length} sale(s) failed to sync`);
  }, [queue, syncing, cachedStock, locationId, onSaleCompleted]);

  const clearQueue = () => {
    setQueue([]);
    localStorage.removeItem(STORAGE_KEY);
    toast.info('Offline queue cleared');
  };

  return { isOnline, queue, syncing, cachedProducts, cachedStock, cacheData, queueSale, syncQueue, clearQueue };
}

export default function OfflineStatusBar({ isOnline, queue, syncing, onSync }) {
  if (isOnline && queue.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-500">
        <Wifi className="w-3 h-3" /> Online
      </div>
    );
  }

  return (
    <Card className={`border ${!isOnline ? 'border-amber-500/50 bg-amber-500/5' : 'border-primary/30 bg-primary/5'}`}>
      <CardContent className="py-2 px-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <>
                <WifiOff className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-600">Offline Mode</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Online</span>
              </>
            )}
            {queue.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {queue.length} pending
              </Badge>
            )}
          </div>
          {queue.length > 0 && isOnline && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onSync} disabled={syncing}>
              <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          )}
          {!isOnline && queue.length > 0 && (
            <span className="text-xs text-amber-600">Will sync when online</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}