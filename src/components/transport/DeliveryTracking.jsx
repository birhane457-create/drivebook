import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';

const STATUS_ICON = { delivered: CheckCircle, pending: Clock, failed: XCircle, partial: Clock };
const STATUS_COLOR = { delivered: 'text-green-500', pending: 'text-yellow-500', failed: 'text-red-500', partial: 'text-orange-500' };

export default function DeliveryTracking() {
  const { data: routes = [] } = useQuery({ queryKey: ['delivery_routes'], queryFn: () => base44.entities.DeliveryRoute.list('-created_date') });

  const activeRoutes = routes.filter(r => ['dispatched', 'in_transit'].includes(r.status));
  const todayRoutes = routes.filter(r => r.scheduled_date === new Date().toISOString().split('T')[0]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-blue-600">{activeRoutes.length}</p><p className="text-xs text-muted-foreground">Active Routes</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{todayRoutes.length}</p><p className="text-xs text-muted-foreground">Routes Today</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-green-600">{routes.filter(r => r.status === 'completed').length}</p><p className="text-xs text-muted-foreground">Completed</p></CardContent></Card>
      </div>

      {activeRoutes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Truck className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No active deliveries in transit</p></div>
      ) : (
        <div className="space-y-4">
          {activeRoutes.map(route => (
            <Card key={route.id} className="border-blue-200">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Truck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{route.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{route.driver_name} · {route.vehicle_plate}</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700">{route.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {route.stops?.length > 0 ? (
                  <div className="space-y-2">
                    {route.stops.map((stop, i) => {
                      const Icon = STATUS_ICON[stop.status] || Clock;
                      const color = STATUS_COLOR[stop.status] || 'text-muted-foreground';
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                            <Icon className={`w-4 h-4 ${color}`} />
                            {i < route.stops.length - 1 && <div className="w-px h-4 bg-border mt-1" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{stop.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{stop.address}</p>
                          </div>
                          <Badge variant="outline" className={`text-xs ${color}`}>{stop.status || 'pending'}</Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{route.total_stops || 0} stops planned — departure: {route.departure_time ? new Date(route.departure_time).toLocaleTimeString() : 'TBD'}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}