import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const ACTION_COLORS = { create: 'default', update: 'secondary', delete: 'destructive', read: 'outline', login: 'secondary', logout: 'outline', approve: 'default', reject: 'destructive', export: 'outline' };

export default function AuditLog() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  const { data: events = [], isLoading } = useQuery({ queryKey: ['audit_events'], queryFn: () => base44.entities.AuditEvent.list('-created_date', 100) });

  const logEvent = (type, action) => {
    base44.entities.AuditEvent.create({ event_type: type, action, actor_name: 'System Demo', entity_type: 'Demo', entity_id: '1', compliance_tags: ['SOX'], risk_score: Math.floor(Math.random() * 30) });
    qc.invalidateQueries(['audit_events']);
    toast.success('Audit event logged');
  };

  const filtered = events.filter(e =>
    (filterAction === 'all' || e.action === filterAction) &&
    (e.event_type?.toLowerCase().includes(search.toLowerCase()) || e.actor_name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="w-56" />
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {['create', 'update', 'delete', 'login', 'approve', 'reject', 'export'].map(a => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => logEvent('user.login', 'login')}>+ Demo Event</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Shield className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No audit events yet. All user actions will appear here as immutable logs.</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-muted-foreground">
              {['Time', 'Event', 'Action', 'Actor', 'Entity', 'IP', 'Risk', 'Compliance'].map(h => <th key={h} className="text-left py-2 px-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className={`border-b hover:bg-muted/40 ${e.risk_score > 70 ? 'bg-red-50' : ''}`}>
                  <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">{e.created_date ? new Date(e.created_date).toLocaleString() : '—'}</td>
                  <td className="py-1.5 px-2 font-mono">{e.event_type}</td>
                  <td className="py-1.5 px-2"><Badge variant={ACTION_COLORS[e.action] || 'outline'} className="text-[10px]">{e.action}</Badge></td>
                  <td className="py-1.5 px-2">{e.actor_name || '—'}</td>
                  <td className="py-1.5 px-2">{e.entity_type ? `${e.entity_type}:${e.entity_id?.slice(-6)}` : '—'}</td>
                  <td className="py-1.5 px-2 font-mono">{e.actor_ip || '—'}</td>
                  <td className="py-1.5 px-2">
                    {e.risk_score > 0 && <span className={`font-bold ${e.risk_score > 70 ? 'text-red-600' : e.risk_score > 40 ? 'text-yellow-600' : 'text-green-600'}`}>{e.risk_score}</span>}
                  </td>
                  <td className="py-1.5 px-2">
                    <div className="flex gap-0.5">{e.compliance_tags?.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}