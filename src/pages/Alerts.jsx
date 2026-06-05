import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, Check, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertOctagon,
};

export default function Alerts() {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => base44.entities.Alert.list('-created_date', 100),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Alert.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = alerts.filter(a => !a.is_read);
      for (const alert of unread) {
        await base44.entities.Alert.update(alert.id, { is_read: true });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const unreadCount = alerts.filter(a => !a.is_read).length;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <PageHeader title="Alerts & Notifications" subtitle={`${unreadCount} unread alerts`}>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
            <Check className="w-4 h-4 mr-2" /> Mark All Read
          </Button>
        )}
      </PageHeader>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No alerts</p>
          </Card>
        ) : (
          alerts.map(alert => {
            const Icon = SEVERITY_ICONS[alert.severity] || Info;
            return (
              <Card key={alert.id} className={`p-4 flex items-start gap-4 transition-all ${!alert.is_read ? 'border-primary/30 bg-primary/5' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  alert.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
                  alert.severity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    alert.severity === 'critical' ? 'text-red-600' :
                    alert.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{alert.title}</p>
                    <StatusBadge status={alert.severity} />
                    {!alert.is_read && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {alert.created_date ? format(new Date(alert.created_date), 'MMM d, yyyy h:mm a') : ''}
                  </p>
                </div>
                {!alert.is_read && (
                  <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate(alert.id)}>
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}