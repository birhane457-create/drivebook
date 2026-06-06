import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Zap, Play, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const TRIGGER_ICONS = { low_stock: '📦', high_value_order: '💰', shipment_delivered: '🚚', customer_tier_change: '⭐', po_created: '🛒', sale_completed: '✅', scheduled: '⏰', manual: '👆' };
const ACTION_LABELS = { create_po: 'Create PO', send_alert: 'Send Alert', require_approval: 'Require Approval', send_email: 'Send Email', apply_discount: 'Apply Discount', update_field: 'Update Field', create_task: 'Create Task' };

export default function WorkflowList({ onEdit }) {
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useQuery({ queryKey: ['workflow_rules'], queryFn: () => base44.entities.WorkflowRule.list() });

  const toggleMut = useMutation({
    mutationFn: ({ id, v }) => base44.entities.WorkflowRule.update(id, { is_active: v }),
    onSuccess: () => qc.invalidateQueries(['workflow_rules']),
  });

  const deleteMut = useMutation({
    mutationFn: id => base44.entities.WorkflowRule.delete(id),
    onSuccess: () => { qc.invalidateQueries(['workflow_rules']); toast.success('Rule deleted'); },
  });

  const runNow = (rule) => {
    base44.entities.WorkflowRule.update(rule.id, { last_run: new Date().toISOString(), run_count: (rule.run_count || 0) + 1 });
    qc.invalidateQueries(['workflow_rules']);
    toast.success(`"${rule.name}" executed`);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  if (rules.length === 0) return (
    <div className="text-center py-20 text-muted-foreground">
      <Zap className="w-14 h-14 mx-auto mb-3 opacity-30" />
      <p className="font-medium">No automation rules yet</p>
      <p className="text-sm">Switch to the Rule Builder tab to create your first automation.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {rules.map(rule => (
        <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
              {TRIGGER_ICONS[rule.trigger_type] || '⚡'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{rule.name}</span>
                {!rule.is_active && <Badge variant="secondary">Paused</Badge>}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Trigger: <span className="text-foreground capitalize">{rule.trigger_type?.replace(/_/g, ' ')}</span></span>
                <span>·</span>
                <span>{rule.conditions?.length || 0} conditions</span>
                <span>·</span>
                <span>Actions: {rule.actions?.map(a => ACTION_LABELS[a.type] || a.type).join(', ') || 'none'}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Run {rule.run_count || 0} times {rule.last_run && `· Last: ${new Date(rule.last_run).toLocaleString()}`}
                {rule.error_count > 0 && <span className="text-red-500"> · {rule.error_count} errors</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => runNow(rule)}><Play className="w-3 h-3 mr-1" /> Run</Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(rule)}><Pencil className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(rule.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              <Switch checked={rule.is_active} onCheckedChange={v => toggleMut.mutate({ id: rule.id, v })} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}