import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/shared/PageHeader';
import { Activity, RefreshCw, Play, AlertCircle, CheckCircle, Clock, Zap, Filter, Eye, RotateCcw } from 'lucide-react';

const DOMAIN_COLORS = {
  inventory: 'bg-blue-100 text-blue-800',
  sales: 'bg-green-100 text-green-800',
  purchasing: 'bg-orange-100 text-orange-800',
  manufacturing: 'bg-purple-100 text-purple-800',
  finance: 'bg-yellow-100 text-yellow-800',
  logistics: 'bg-cyan-100 text-cyan-800',
  crm: 'bg-pink-100 text-pink-800',
  platform: 'bg-gray-100 text-gray-800',
};

const STATUS_ICON = {
  pending: <Clock className="w-3 h-3 text-yellow-500" />,
  published: <CheckCircle className="w-3 h-3 text-green-500" />,
  consumed: <CheckCircle className="w-3 h-3 text-blue-500" />,
  failed: <AlertCircle className="w-3 h-3 text-red-500" />,
  replaying: <RefreshCw className="w-3 h-3 text-purple-500 animate-spin" />,
};

const SAMPLE_EVENTS = [
  { event_type: 'stock.level.low', domain: 'inventory', aggregate_type: 'StockLevel', payload: { product_id: 'PRD001', quantity: 5, threshold: 10 }, status: 'published', consumer_count: 3 },
  { event_type: 'sale.completed', domain: 'sales', aggregate_type: 'Sale', payload: { sale_id: 'SL2025001', amount: 1250.00, customer: 'Acme Corp' }, status: 'consumed', consumer_count: 5 },
  { event_type: 'po.created', domain: 'purchasing', aggregate_type: 'PurchaseOrder', payload: { po_number: 'PO-2025-089', supplier: 'TechSupply', value: 45000 }, status: 'published', consumer_count: 2 },
  { event_type: 'shipment.dispatched', domain: 'logistics', aggregate_type: 'DeliveryRoute', payload: { route_id: 'RT001', driver: 'John D.', stops: 8 }, status: 'consumed', consumer_count: 4 },
  { event_type: 'payment.overdue', domain: 'finance', aggregate_type: 'AccountsReceivable', payload: { invoice: 'INV-2025-012', days_overdue: 15, amount: 8500 }, status: 'failed', consumer_count: 0, retry_count: 3 },
];

function EventRow({ event, onView, onReplay }) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 text-sm">
      <div className="w-5">{STATUS_ICON[event.status] || STATUS_ICON.pending}</div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-medium">{event.event_type}</p>
        <p className="text-xs text-muted-foreground">{event.aggregate_type} · {event.aggregate_id || 'N/A'}</p>
      </div>
      <Badge className={`text-[10px] ${DOMAIN_COLORS[event.domain] || ''}`}>{event.domain}</Badge>
      <span className="text-[10px] text-muted-foreground w-16 text-center">{event.consumer_count || 0} consumers</span>
      {event.retry_count > 0 && <Badge variant="destructive" className="text-[10px]">{event.retry_count} retries</Badge>}
      <span className="text-[10px] text-muted-foreground">{event.created_date ? new Date(event.created_date).toLocaleString() : 'Just now'}</span>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onView(event)}><Eye className="w-3 h-3" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onReplay(event)}><RotateCcw className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

export default function EventBus() {
  const [domain, setDomain] = useState('all');
  const [status, setStatus] = useState('all');
  const [viewing, setViewing] = useState(null);
  const qc = useQueryClient();

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['domain-events', domain, status],
    queryFn: () => base44.entities.DomainEvent.list('-created_date', 100),
    refetchInterval: 10000,
  });

  const replayMut = useMutation({
    mutationFn: (event) => base44.entities.DomainEvent.create({
      ...event,
      id: undefined,
      status: 'replaying',
      retry_count: 0,
      correlation_id: event.id,
    }),
    onSuccess: () => qc.invalidateQueries(['domain-events']),
  });

  const allEvents = [...SAMPLE_EVENTS.map((e, i) => ({ ...e, id: `sample-${i}`, created_date: new Date(Date.now() - i * 60000).toISOString() })), ...events];

  const filtered = allEvents.filter(e => {
    const dMatch = domain === 'all' || e.domain === domain;
    const sMatch = status === 'all' || e.status === status;
    return dMatch && sMatch;
  });

  const stats = {
    total: allEvents.length,
    published: allEvents.filter(e => e.status === 'published').length,
    consumed: allEvents.filter(e => e.status === 'consumed').length,
    failed: allEvents.filter(e => e.status === 'failed').length,
  };

  const domainStats = Object.keys(DOMAIN_COLORS).map(d => ({
    domain: d,
    count: allEvents.filter(e => e.domain === d).length,
  })).filter(d => d.count > 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Event Bus" subtitle="Domain events · Event replay · Audit streaming · Real-time processing">
        <Button size="sm" variant="outline" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: stats.total, color: 'text-foreground' },
          { label: 'Published', value: stats.published, color: 'text-green-600' },
          { label: 'Consumed', value: stats.consumed, color: 'text-blue-600' },
          { label: 'Failed', value: stats.failed, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="stream">
        <TabsList>
          <TabsTrigger value="stream">Live Stream</TabsTrigger>
          <TabsTrigger value="domains">By Domain</TabsTrigger>
        </TabsList>

        <TabsContent value="stream" className="space-y-4">
          <div className="flex gap-3">
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Domain" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                {Object.keys(DOMAIN_COLORS).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {['pending', 'published', 'consumed', 'failed', 'replaying'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="ml-auto flex items-center gap-1 px-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </Badge>
          </div>
          <div className="space-y-2">
            {filtered.slice(0, 50).map((event, i) => (
              <EventRow key={event.id || i} event={event} onView={setViewing} onReplay={(e) => replayMut.mutate(e)} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="domains">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {domainStats.map(d => (
              <Card key={d.domain} className="cursor-pointer hover:shadow-md" onClick={() => { setDomain(d.domain); }}>
                <CardContent className="p-4">
                  <Badge className={`mb-2 ${DOMAIN_COLORS[d.domain]}`}>{d.domain}</Badge>
                  <p className="text-2xl font-bold">{d.count}</p>
                  <p className="text-xs text-muted-foreground">events</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Event Detail */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-sm">{viewing.event_type}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Domain:</span> {viewing.domain}</div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Status:</span> {viewing.status}</div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Consumers:</span> {viewing.consumer_count}</div>
                  <div className="bg-muted rounded p-2"><span className="text-muted-foreground">Retries:</span> {viewing.retry_count || 0}</div>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Payload</p>
                  <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-48">{JSON.stringify(viewing.payload, null, 2)}</pre>
                </div>
                <Button size="sm" className="gap-2" onClick={() => { replayMut.mutate(viewing); setViewing(null); }}>
                  <RotateCcw className="w-4 h-4" /> Replay Event
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}