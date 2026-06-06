import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/shared/PageHeader';
import { ShoppingBag, FileText, Truck, RotateCcw, Star, Search, Plus, Eye, Package, ChevronRight } from 'lucide-react';

const STATUS_COLOR = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  returned: 'bg-orange-100 text-orange-800',
};

const RETURN_COLOR = {
  none: '',
  requested: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  received: 'bg-purple-100 text-purple-800',
  refunded: 'bg-green-100 text-green-800',
};

const SAMPLE_ORDERS = [
  { id: 's1', order_number: 'ORD-2025-0041', customer_name: 'Acme Corp', status: 'delivered', total_amount: 3250.00, tracking_number: '1Z999AA10123456784', carrier: 'UPS', items: [{ product_name: 'Widget Pro X', quantity: 10, unit_price: 250, total: 2500 }, { product_name: 'Support Kit', quantity: 3, unit_price: 250, total: 750 }], return_status: 'none', estimated_delivery: '2025-06-01' },
  { id: 's2', order_number: 'ORD-2025-0042', customer_name: 'TechStart Ltd', status: 'shipped', total_amount: 1840.00, tracking_number: '9400111899223479307300', carrier: 'FedEx', items: [{ product_name: 'Cloud Module', quantity: 4, unit_price: 460, total: 1840 }], return_status: 'none', estimated_delivery: '2025-06-08' },
  { id: 's3', order_number: 'ORD-2025-0043', customer_name: 'Global Trade Inc', status: 'processing', total_amount: 8900.00, items: [{ product_name: 'Enterprise License', quantity: 1, unit_price: 8900, total: 8900 }], return_status: 'none' },
  { id: 's4', order_number: 'ORD-2025-0038', customer_name: 'Acme Corp', status: 'delivered', total_amount: 580.00, items: [{ product_name: 'Adapter Cable', quantity: 4, unit_price: 145, total: 580 }], return_status: 'requested', tracking_number: '1Z999AA10123456123' },
];

const INVOICES = [
  { number: 'INV-2025-0089', customer: 'Acme Corp', amount: 3250.00, status: 'paid', date: '2025-05-28', due: '2025-06-27' },
  { number: 'INV-2025-0092', customer: 'TechStart Ltd', amount: 1840.00, status: 'sent', date: '2025-06-01', due: '2025-07-01' },
  { number: 'INV-2025-0095', customer: 'Global Trade Inc', amount: 8900.00, status: 'draft', date: '2025-06-05', due: '2025-07-05' },
];

function OrderCard({ order, onView }) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onView(order)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono font-bold text-sm">{order.order_number}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{order.customer_name}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge className={`text-[10px] ${STATUS_COLOR[order.status]}`}>{order.status}</Badge>
              {order.return_status !== 'none' && (
                <Badge className={`text-[10px] ${RETURN_COLOR[order.return_status]}`}>Return: {order.return_status}</Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold">${order.total_amount?.toLocaleString()}</p>
            {order.tracking_number && (
              <p className="text-[10px] text-muted-foreground mt-1">{order.carrier}: {order.tracking_number?.slice(-8)}</p>
            )}
            {order.estimated_delivery && (
              <p className="text-[10px] text-muted-foreground">Est: {order.estimated_delivery}</p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center text-xs text-muted-foreground">
          <Package className="w-3 h-3 mr-1" />
          {order.items?.length} item{order.items?.length !== 1 ? 's' : ''}
          <ChevronRight className="w-3 h-3 ml-auto" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerPortal() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ['portal-orders'],
    queryFn: () => base44.entities.CustomerPortalOrder.list('-created_date', 100),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.CustomerPortalOrder.create(d),
    onSuccess: () => { qc.invalidateQueries(['portal-orders']); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CustomerPortalOrder.update(id, data),
    onSuccess: () => qc.invalidateQueries(['portal-orders']),
  });

  const allOrders = [...SAMPLE_ORDERS, ...orders];

  const filtered = allOrders.filter(o => {
    const matchSearch = !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) || o.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: allOrders.length,
    inTransit: allOrders.filter(o => o.status === 'shipped').length,
    pendingReturns: allOrders.filter(o => o.return_status !== 'none' && o.return_status !== 'refunded').length,
    totalValue: allOrders.reduce((s, o) => s + (o.total_amount || 0), 0),
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Customer Portal" subtitle="Orders · Invoices · Shipments · Returns · Loyalty">
        <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Order
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: stats.total, icon: ShoppingBag, color: 'text-blue-600' },
          { label: 'In Transit', value: stats.inTransit, icon: Truck, color: 'text-cyan-600' },
          { label: 'Pending Returns', value: stats.pendingReturns, icon: RotateCcw, color: 'text-orange-600' },
          { label: 'Total Value', value: `$${stats.totalValue.toLocaleString()}`, icon: FileText, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..." className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {['pending','confirmed','processing','shipped','delivered','cancelled','returned'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((o, i) => <OrderCard key={o.id || i} order={o} onView={setViewing} />)}
          </div>
        </TabsContent>

        <TabsContent value="invoices">
          <div className="space-y-3">
            {INVOICES.map(inv => (
              <Card key={inv.number}>
                <CardContent className="p-4 flex items-center gap-4">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">{inv.number}</span>
                      <Badge className={`text-[10px] ${inv.status === 'paid' ? 'bg-green-100 text-green-800' : inv.status === 'sent' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{inv.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{inv.customer} · Due: {inv.due}</p>
                  </div>
                  <span className="font-bold">${inv.amount.toLocaleString()}</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs">Download PDF</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="returns">
          <div className="space-y-3">
            {allOrders.filter(o => o.return_status && o.return_status !== 'none').map((o, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-4">
                  <RotateCcw className="w-5 h-5 text-orange-500" />
                  <div className="flex-1">
                    <p className="font-mono font-bold text-sm">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{o.customer_name}</p>
                  </div>
                  <Badge className={`text-[10px] ${RETURN_COLOR[o.return_status]}`}>Return: {o.return_status}</Badge>
                  <span className="font-bold">${o.total_amount?.toLocaleString()}</span>
                  {o.return_status === 'requested' && (
                    <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" onClick={() => updateMut.mutate({ id: o.id, data: { return_status: 'approved' } })}>Approve</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="loyalty">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { tier: 'Platinum', customers: 12, points: '2.4M', spend: '$485K', color: 'from-purple-500 to-pink-500' },
              { tier: 'Gold', customers: 34, points: '1.1M', spend: '$220K', color: 'from-yellow-400 to-orange-500' },
              { tier: 'Silver', customers: 89, points: '480K', spend: '$95K', color: 'from-gray-400 to-gray-500' },
            ].map(t => (
              <Card key={t.tier} className={`bg-gradient-to-br ${t.color} text-white`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5" />
                    <h3 className="font-bold">{t.tier}</h3>
                  </div>
                  <p className="text-3xl font-bold">{t.customers}</p>
                  <p className="text-sm opacity-80">customers</p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>Total Points: {t.points}</p>
                    <p>Total Spend: {t.spend}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Order Detail */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono">{viewing.order_number}</span>
                  <Badge className={`text-[10px] ${STATUS_COLOR[viewing.status]}`}>{viewing.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Customer:</span> {viewing.customer_name}</div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Total:</span> ${viewing.total_amount?.toLocaleString()}</div>
                  {viewing.carrier && <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Carrier:</span> {viewing.carrier}</div>}
                  {viewing.tracking_number && <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Tracking:</span> {viewing.tracking_number}</div>}
                </div>
                <div>
                  <p className="text-xs font-medium mb-2">Items</p>
                  <div className="space-y-1">
                    {viewing.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs p-2 bg-muted rounded">
                        <span>{item.product_name} × {item.quantity}</span>
                        <span className="font-medium">${item.total?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}