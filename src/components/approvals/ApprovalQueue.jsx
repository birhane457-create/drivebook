import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_LABELS = { purchase_order: 'Purchase Order', stock_transfer: 'Stock Transfer', credit_limit: 'Credit Limit', price_override: 'Price Override', discount: 'Discount', write_off: 'Write-Off', production_order: 'Production Order' };
const STATUS_COLORS = { pending: 'default', approved: 'secondary', rejected: 'destructive', cancelled: 'secondary', escalated: 'outline' };

export default function ApprovalQueue() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');

  const { data: requests = [], isLoading } = useQuery({ queryKey: ['approvals'], queryFn: () => base44.entities.ApprovalRequest.list('-created_date') });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ApprovalRequest.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['approvals']); setSelected(null); setComment(''); },
  });

  const act = (req, action) => {
    const newApprovals = [...(req.approvals || []), { level: req.current_level, action, comment, action_date: new Date().toISOString(), approver_name: 'Current User' }];
    updateMut.mutate({ id: req.id, data: { status: action, approvals: newApprovals } });
    toast.success(`Request ${action}`);
  };

  const pending = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="flex items-center gap-3 pt-4"><Clock className="w-8 h-8 text-yellow-500" /><div><p className="text-2xl font-bold">{pending.length}</p><p className="text-xs text-muted-foreground">Pending Approvals</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-4"><CheckCircle className="w-8 h-8 text-green-500" /><div><p className="text-2xl font-bold">{requests.filter(r => r.status === 'approved').length}</p><p className="text-xs text-muted-foreground">Approved</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-4"><XCircle className="w-8 h-8 text-red-500" /><div><p className="text-2xl font-bold">{requests.filter(r => r.status === 'rejected').length}</p><p className="text-xs text-muted-foreground">Rejected</p></div></CardContent></Card>
      </div>

      {pending.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-500" /> Pending Approvals</h3>
          <div className="space-y-2">
            {pending.map(req => (
              <Card key={req.id} className="border-yellow-200 bg-yellow-50/50">
                <CardContent className="flex items-center gap-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{TYPE_LABELS[req.type] || req.type}</Badge>
                      <span className="font-mono text-sm">{req.reference_number || req.reference_id?.slice(-8)}</span>
                      {req.amount && <span className="text-sm font-semibold">${req.amount.toLocaleString()}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{req.description} · Requested by: {req.requested_by_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">Level {req.current_level}/{req.total_levels}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => { setSelected(req); }}>Review</Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => act(req, 'approved')}><CheckCircle className="w-3 h-3 mr-1" /> Approve</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 text-muted-foreground">History</h3>
          <div className="space-y-2">
            {resolved.slice(0, 10).map(req => (
              <Card key={req.id} className="opacity-70">
                <CardContent className="flex items-center gap-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_COLORS[req.status] || 'outline'}>{req.status}</Badge>
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[req.type] || req.type}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">{req.reference_number || req.reference_id?.slice(-8)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && requests.length === 0 && <div className="text-center py-16 text-muted-foreground"><CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No approval requests yet</p></div>}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Approval Request</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{TYPE_LABELS[selected.type]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono">{selected.reference_number || selected.reference_id?.slice(-8)}</span></div>
                {selected.amount && <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">${selected.amount.toLocaleString()}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Requested by</span><span>{selected.requested_by_name}</span></div>
                {selected.description && <p className="text-muted-foreground pt-1">{selected.description}</p>}
              </div>
              <div><Label>Comment (optional)</Label><Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add comment..." /></div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-red-300 text-red-600" onClick={() => act(selected, 'rejected')}><XCircle className="w-4 h-4 mr-1" /> Reject</Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => act(selected, 'approved')}><CheckCircle className="w-4 h-4 mr-1" /> Approve</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}