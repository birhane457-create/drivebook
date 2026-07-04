import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToastMutation } from '@/hooks/useToastMutation';
import { Plus, Edit2, MapPin, Warehouse, Store, Users, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import AdvancedDataTable from '@/components/data-table/AdvancedDataTable';
import FormDialog from '@/components/dialogs/FormDialog';
import FormSection from '@/components/shared/FormSection';
import Field from '@/components/shared/Field';
import StatusBadge from '@/components/shared/StatusBadge';

const EMPTY_LOC = { name: '', type: 'warehouse', address: '', phone: '', manager_name: '' };

export default function Settings() {
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationForm, setLocationForm] = useState(EMPTY_LOC);

  const locationsQ = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.Location.list() });
  const usersQ = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.list() });
  const logsQ = useQuery({ queryKey: ['inventory-logs'], queryFn: () => base44.entities.InventoryLog.list('-created_date', 50) });
  const locations = locationsQ.data || [];
  const users = usersQ.data || [];
  const logs = logsQ.data || [];
  const isLoading = locationsQ.isLoading || usersQ.isLoading;

  const locationMutation = useToastMutation({
    mutationFn: (data) => editingLocation ? base44.entities.Location.update(editingLocation.id, data) : base44.entities.Location.create(data),
    queryKeys: [['locations']],
    successMessage: editingLocation ? 'Location updated' : 'Location created',
    onSuccess: () => { setShowLocationForm(false); setEditingLocation(null); },
  });

  const openLocationForm = (location = null) => {
    setEditingLocation(location);
    setLocationForm(location ? { name: location.name, type: location.type, address: location.address || '', phone: location.phone || '', manager_name: location.manager_name || '' } : EMPTY_LOC);
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
    { key: 'actions', label: '', type: 'actions', align: 'right', actions: [
      { label: 'Edit', icon: Edit2, onClick: (row) => openLocationForm(row) },
    ]},
  ];

  const userColumns = [
    { key: 'full_name', label: 'Name', render: (row) => <span className="font-medium">{row.full_name || '—'}</span> },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (row) => <StatusBadge status={row.role || 'user'} /> },
  ];

  const kpis = [
    { label: 'Locations', value: locations.length, icon: MapPin },
    { label: 'Active Locations', value: locations.filter(l => l.is_active !== false).length, icon: Warehouse },
    { label: 'Users', value: users.length, icon: Users },
    { label: 'Audit Entries', value: logs.length, icon: ClipboardList },
  ];

  return (
    <EnterprisePageLayout
      title="Settings"
      description="System configuration and management"
      primaryAction={{ label: 'Add Location', icon: Plus, onClick: () => openLocationForm() }}
      kpis={kpis}
      isLoading={isLoading}
    >
      <Tabs defaultValue="locations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="locations">
          <AdvancedDataTable
            tableId="settings-locations"
            columns={locationColumns}
            data={locations}
            isLoading={locationsQ.isLoading}
            error={locationsQ.error}
            onRetry={locationsQ.refetch}
            emptyMessage="No locations configured yet."
          />
        </TabsContent>

        <TabsContent value="users">
          <AdvancedDataTable
            tableId="settings-users"
            columns={userColumns}
            data={users}
            isLoading={usersQ.isLoading}
            error={usersQ.error}
            onRetry={usersQ.refetch}
            emptyMessage="No users found."
          />
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Inventory Changes</CardTitle></CardHeader>
            <CardContent>
              {logsQ.isLoading ? (
                <div className="space-y-3">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-start justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{log.product_name}</p>
                        <p className="text-xs text-muted-foreground">{log.type?.replace(/_/g, ' ')} at {log.location_name} — {log.notes || ''}</p>
                        <p className="text-xs text-muted-foreground">{log.created_date ? new Date(log.created_date).toLocaleString() : ''}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-semibold ${log.quantity_change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{log.quantity_change > 0 ? '+' : ''}{log.quantity_change}</span>
                        <p className="text-xs text-muted-foreground">{log.quantity_before} → {log.quantity_after}</p>
                      </div>
                    </div>
                  ))}
                  {logs.length === 0 && <p className="text-center py-6 text-muted-foreground">No activity yet</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FormDialog
        open={showLocationForm}
        onOpenChange={(open) => { setShowLocationForm(open); if (!open) setEditingLocation(null); }}
        title={editingLocation ? 'Edit Location' : 'New Location'}
        submitLabel={editingLocation ? 'Update' : 'Create Location'}
        isPending={locationMutation.isPending}
        submitDisabled={!locationForm.name}
        onSubmit={() => locationMutation.mutate(locationForm)}
      >
        <FormSection title="Location Details" icon={MapPin} columns={2}>
          <Field label="Name" required htmlFor="loc-name">
            <Input id="loc-name" value={locationForm.name} onChange={(e) => setLocationForm(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Type" htmlFor="loc-type">
            <Select value={locationForm.type} onValueChange={(v) => setLocationForm(p => ({ ...p, type: v }))}>
              <SelectTrigger id="loc-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="warehouse">Warehouse</SelectItem>
                <SelectItem value="store">Store</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Address" htmlFor="loc-address">
            <Input id="loc-address" value={locationForm.address} onChange={(e) => setLocationForm(p => ({ ...p, address: e.target.value }))} />
          </Field>
          <Field label="Phone" htmlFor="loc-phone">
            <Input id="loc-phone" value={locationForm.phone} onChange={(e) => setLocationForm(p => ({ ...p, phone: e.target.value }))} />
          </Field>
          <Field label="Manager Name" htmlFor="loc-manager">
            <Input id="loc-manager" value={locationForm.manager_name} onChange={(e) => setLocationForm(p => ({ ...p, manager_name: e.target.value }))} />
          </Field>
        </FormSection>
      </FormDialog>
    </EnterprisePageLayout>
  );
}