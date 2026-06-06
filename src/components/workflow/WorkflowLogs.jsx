import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, SkipForward, Activity } from 'lucide-react';

export default function WorkflowLogs() {
  const { data: logs = [], isLoading } = useQuery({ queryKey: ['workflow_logs'], queryFn: () => base44.entities.WorkflowLog.list('-created_date', 50) });

  const STATUS_ICON = { success: CheckCircle, failed: XCircle, skipped: SkipForward };
  const STATUS_COLOR = { success: 'text-green-500', failed: 'text-red-500', skipped: 'text-muted-foreground' };
  const STATUS_VARIANT = { success: 'secondary', failed: 'destructive', skipped: 'outline' };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  if (logs.length === 0) return (
    <div className="text-center py-16 text-muted-foreground">
      <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>No execution logs yet. Logs appear here after rules run.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {logs.map(log => {
        const Icon = STATUS_ICON[log.status] || CheckCircle;
        return (
          <Card key={log.id}>
            <CardContent className="flex items-center gap-4 py-3">
              <Icon className={`w-5 h-5 flex-shrink-0 ${STATUS_COLOR[log.status] || 'text-muted-foreground'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm">{log.rule_name}</span>
                  <Badge variant={STATUS_VARIANT[log.status] || 'outline'} className="text-xs">{log.status}</Badge>
                  {log.duration_ms && <span className="text-xs text-muted-foreground">{log.duration_ms}ms</span>}
                </div>
                {log.actions_executed?.length > 0 && (
                  <p className="text-xs text-muted-foreground">Actions: {log.actions_executed.join(', ')}</p>
                )}
                {log.error_message && <p className="text-xs text-red-500">{log.error_message}</p>}
                <p className="text-xs text-muted-foreground">{log.created_date ? new Date(log.created_date).toLocaleString() : ''}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}