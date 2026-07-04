import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Check, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import PageLoader from '@/components/shared/PageLoader';
import EmptyState from '@/components/shared/EmptyState';
import { format } from 'date-fns';

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertOctagon,
};

const SEVERITY_STYLES = {
  critical: 'bg-red-500/10 text-red-500',
  warning: 'bg-amber-500/10 text-amber-500',
  info: 'bg-blue-500/10 text-blue-500',
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
    return <PageLoader label="Loading alerts..." />;
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

      {alerts.length === 0 ? (
        <EmptyState illustration="inbox" title="No alerts" description="You're all caught up — nothing needs your attention right now." className="py-20" />
      ) : (
      <div className="space-y-3">
          {alerts.map(alert => {
            const Icon = SEVERITY_ICONS[alert.severity] || Info;
            return (
              <Card key={alert.id} className={`p-4 flex items-start gap-4 transition-all ${!alert.is_read ? 'border-primary/30 bg-primary/5' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info}`}>
                  <Icon className="w-5 h-5" />
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
          })}
        </div>
      )}
    </div>
  );
}