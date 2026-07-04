import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToastMutation } from '@/hooks/useToastMutation';
import { Check, AlertTriangle, Info, AlertOctagon, Bell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import { format } from 'date-fns';

const SEVERITY_ICONS = { info: Info, warning: AlertTriangle, critical: AlertOctagon };
const SEVERITY_STYLES = {
  critical: 'bg-red-500/10 text-red-500',
  warning: 'bg-amber-500/10 text-amber-500',
  info: 'bg-blue-500/10 text-blue-500',
};

export default function Alerts() {
  const alertsQ = useQuery({ queryKey: ['alerts'], queryFn: () => base44.entities.Alert.list('-created_date', 100) });
  const alerts = alertsQ.data || [];

  const markReadMutation = useToastMutation({
    mutationFn: (id) => base44.entities.Alert.update(id, { is_read: true }),
    queryKeys: [['alerts']],
    successMessage: 'Alert marked as read',
  });
  const markAllReadMutation = useToastMutation({
    mutationFn: async () => {
      const unread = alerts.filter(a => !a.is_read);
      for (const alert of unread) await base44.entities.Alert.update(alert.id, { is_read: true });
    },
    queryKeys: [['alerts']],
    successMessage: 'All alerts marked as read',
  });

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.is_read).length;
  const warningCount = alerts.filter(a => a.severity === 'warning' && !a.is_read).length;

  const kpis = [
    { label: 'Total', value: alerts.length, icon: Bell },
    { label: 'Unread', value: unreadCount, icon: AlertTriangle },
    { label: 'Critical', value: criticalCount, icon: AlertOctagon },
    { label: 'Warnings', value: warningCount, icon: AlertTriangle },
  ];

  return (
    <EnterprisePageLayout
      title="Alerts & Notifications"
      description={`${unreadCount} unread alerts`}
      primaryAction={unreadCount > 0 ? { label: 'Mark All Read', icon: Check, onClick: () => markAllReadMutation.mutate() } : undefined}
      kpis={kpis}
    >
      {alertsQ.error ? (
        <ErrorState title="Couldn't load alerts" message={alertsQ.error?.message} onRetry={alertsQ.refetch} />
      ) : alertsQ.isLoading ? (
        <div className="space-y-3">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : alerts.length === 0 ? (
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
                  <p className="text-xs text-muted-foreground mt-1">{alert.created_date ? format(new Date(alert.created_date), 'MMM d, yyyy h:mm a') : ''}</p>
                </div>
                {!alert.is_read && (
                  <button onClick={() => markReadMutation.mutate(alert.id)} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Mark as read">
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </EnterprisePageLayout>
  );
}