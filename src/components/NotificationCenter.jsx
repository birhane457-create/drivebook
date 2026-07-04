import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Info, AlertTriangle, AlertCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY = {
  info: { icon: Info, cls: 'text-blue-500' },
  warning: { icon: AlertTriangle, cls: 'text-amber-500' },
  critical: { icon: AlertCircle, cls: 'text-red-500' },
};

const REF_ROUTE = {
  purchase_order: '/purchases',
  transfer: '/transfers',
  product: '/products',
  supplier: '/suppliers',
  stock: '/inventory',
};

export default function NotificationCenter() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts-recent'],
    queryFn: () => base44.entities.Alert.list('-created_date', 25),
    refetchInterval: 30000,
  });
  const unread = alerts.filter(a => !a.is_read);

  const markAll = useMutation({
    mutationFn: async () => {
      await Promise.all(unread.map(a => base44.entities.Alert.update(a.id, { is_read: true })));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts-recent'] }),
  });

  const handleOpen = async (alert) => {
    if (!alert.is_read) {
      await base44.entities.Alert.update(alert.id, { is_read: true });
      qc.invalidateQueries({ queryKey: ['alerts-recent'] });
    }
    setOpen(false);
    const route = alert.reference_type ? REF_ROUTE[alert.reference_type] : null;
    navigate(route || '/alerts');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="font-semibold text-sm">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread.length} unread</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            disabled={unread.length === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              You're all caught up
            </div>
          ) : (
            alerts.map(a => {
              const s = SEVERITY[a.severity] || SEVERITY.info;
              const Icon = s.icon;
              return (
                <button
                  key={a.id}
                  onClick={() => handleOpen(a)}
                  className={cn(
                    'w-full text-left flex gap-3 px-4 py-3 border-b last:border-0 hover:bg-accent/50 transition-colors',
                    !a.is_read && 'bg-primary/5'
                  )}
                >
                  <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', s.cls)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-tight', !a.is_read && 'font-semibold')}>{a.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.message}</p>
                  </div>
                  {!a.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t">
          <Button
            variant="ghost"
            className="w-full justify-between rounded-none h-10"
            onClick={() => { setOpen(false); navigate('/alerts'); }}
          >
            View all notifications <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}