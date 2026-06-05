import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2, MapPin, Warehouse, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';

export default function Settings() {
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationForm, setLocationForm] = useState({ name: '', type: 'warehouse', address: '', phone: '', manager_name: '' });
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['inventory-logs'],
    queryFn: () => base44.entities.InventoryLog.list('-created_date', 50),
  });

  const locationMutation = useMutation({
    mutationFn: (data) => editingLocation
      ? base44.entities.Location.update(editingLocation.id, data)
      : base44.entities.Location.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locations'] }); setShowLocationForm(false); setEditingLocation(null); },
  });

  const openLocationForm = (location = null) => {
    setEditingLocation(location);
    setLocationForm(location || { name: '', type: 'warehouse', address: '', phone: '', manager_name: '' });
    setShowLocationForm(true);
  };

  const locationColumns = [
    { key: 'name', label: 'Name', render: (row) => (
      <div className="flex items-center gap-2">
        {row.type === 'warehouse' ? <Warehouse className="w-4 h-4 text-muted-foreground" /> : <Store className="w-4 h-4 text-muted-foreground" />}
        <span className="font-medium">{row.name}</span>
      </div>
    )},
    { key: 'type', label: 'Type', render: (row) => <StatusBadge status={row.type === 'warehouse' ? 'info' : 'active'} /> },
    { key: 'address', label: 'Address', render: (row) => row.address || '—' },
    { key: 'manager_name', label: 'Manager', render: (row) => row.manager_name || '—' },
    { key: 'is_active', label: 'Status', render: (row) => <StatusBadge status={row.is_active !== false ? 'active' : 'inactive'} /> },
    { key: 'actions', label: '', render: (row) => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openLocationForm(row); }}>
        <Edit2 className="w-4 h-4" />
      </Button>
    )},
  ];

  const userColumns = [
    { key: 'full_name', label: 'Name', render: (row) => <span className="font-medium">{row.full_name || '—'}</span> },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (row) => <StatusBadge status={row.role || 'user'} /> },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="System configuration and management" />

      <Tabs defaultValue="locations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="locations">
          <div className="mb-4 flex justify-end">
            <Button onClick={() => openLocationForm()}>
              <Plus className="w-4 h-4 mr-2" /> Add Location
            </Button>
          </div>
          <DataTable columns={locationColumns} data={locations} isLoading={loadingLocations} searchField="name" />
        </TabsContent>

        <TabsContent value="users">
          <DataTable columns={userColumns} data={users} isLoading={loadingUsers} searchField="full_name" />
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Inventory Changes</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{log.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.type?.replace(/_/g, ' ')} at {log.location_name} — {log.notes || ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.created_date ? new Date(log.created_date).toLocaleString() : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${log.quantity_change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                      </span>
                      <p className="text-xs text-muted-foreground">{log.quantity_before} → {log.quantity_after}</p>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-center py-6 text-muted-foreground">No activity yet</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showLocationForm} onOpenChange={(open) => { setShowLocationForm(open); if (!open) setEditingLocation(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingLocation ? 'Edit Location' : 'New Location'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); locationMutation.mutate(locationForm); }} className="space-y-4">
            <div><Label>Name *</Label><Input value={locationForm.name} onChange={(e) => setLocationForm(p => ({ ...p, name: e.target.value }))} required /></div>
            <div>
              <Label>Type</Label>
              <Select value={locationForm.type} onValueChange={(v) => setLocationForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="store">Store</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Address</Label><Input value={locationForm.address} onChange={(e) => setLocationForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={locationForm.phone} onChange={(e) => setLocationForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label>Manager Name</Label><Input value={locationForm.manager_name} onChange={(e) => setLocationForm(p => ({ ...p, manager_name: e.target.value }))} /></div>
            <Button type="submit" className="w-full" disabled={locationMutation.isPending}>
              {locationMutation.isPending ? 'Saving...' : (editingLocation ? 'Update' : 'Create Location')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}