import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, Package, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const MOCK_DOCKS = [
  { id: 1, lp: 'LP-0012', supplier: 'Tech Suppliers Co', sku: 'ELEC-001', qty: 200, dest: 'Store A', status: 'inbound', eta: '14:30' },
  { id: 2, lp: 'LP-0013', supplier: 'Gadget World', sku: 'ELEC-045', qty: 50, dest: 'Store B', status: 'staging', eta: '15:00' },
  { id: 3, lp: 'LP-0014', supplier: 'Bulk Goods Inc', sku: 'FOOD-012', qty: 500, dest: 'Store C', status: 'outbound', eta: '15:30' },
];
const STATUS_COLOR = { inbound: 'secondary', staging: 'default', outbound: 'outline', completed: 'secondary' };

export default function CrossDockPanel() {
  return (
    <div>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {[['Inbound', 1, 'bg-blue-500'], ['Staging', 1, 'bg-yellow-500'], ['Outbound', 1, 'bg-green-500']].map(([label, count, color]) => (
          <Card key={label}><CardContent className="flex items-center gap-3 pt-4">
            <div className={`w-3 h-10 rounded-full ${color}`} />
            <div><p className="text-xl font-bold">{count}</p><p className="text-xs text-muted-foreground">{label} shipments</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" /> Cross-Dock Queue</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_DOCKS.map(dock => (
              <div key={dock.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/40">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm">{dock.lp}</span>
                    <Badge variant={STATUS_COLOR[dock.status]}>{dock.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{dock.supplier} → {dock.dest} · SKU: {dock.sku} · Qty: {dock.qty}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" /> ETA {dock.eta}
                </div>
                <Button size="sm" variant="outline" onClick={() => toast.success(`Processed ${dock.lp} for cross-docking`)}>
                  {dock.status === 'inbound' ? 'Stage' : dock.status === 'staging' ? 'Dispatch' : 'Complete'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}