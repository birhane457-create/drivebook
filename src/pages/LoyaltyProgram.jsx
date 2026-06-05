import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Plus, Crown, Star, Edit2, Users } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_TIERS = [
  { name: 'Bronze', min_points: 0, min_spend: 0, discount_percent: 0, points_multiplier: 1, benefits: 'Basic membership benefits', color: '#cd7f32' },
  { name: 'Silver', min_points: 500, min_spend: 500, discount_percent: 5, points_multiplier: 1.5, benefits: 'Free shipping, 5% discount', color: '#9e9e9e' },
  { name: 'Gold', min_points: 2000, min_spend: 2000, discount_percent: 10, points_multiplier: 2, benefits: 'Priority support, 10% discount, exclusive offers', color: '#ffd700' },
  { name: 'Platinum', min_points: 5000, min_spend: 5000, discount_percent: 15, points_multiplier: 3, benefits: 'VIP support, 15% discount, early access, free gifts', color: '#e5e4e2' },
];

export default function LoyaltyProgram() {
  const [showTierForm, setShowTierForm] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [tierForm, setTierForm] = useState({ name: '', min_points: 0, min_spend: 0, discount_percent: 0, points_multiplier: 1, benefits: '', color: '#6B7280' });
  const queryClient = useQueryClient();

  const { data: tiers = [], isLoading: loadingTiers } = useQuery({ queryKey: ['loyalty-tiers'], queryFn: () => base44.entities.LoyaltyTier.list() });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() });

  const tierMutation = useMutation({
    mutationFn: (data) => editingTier ? base44.entities.LoyaltyTier.update(editingTier.id, data) : base44.entities.LoyaltyTier.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['loyalty-tiers'] }); setShowTierForm(false); setEditingTier(null); toast.success('Tier saved'); },
  });

  const seedDefaultTiers = () => {
    Promise.all(DEFAULT_TIERS.map(t => base44.entities.LoyaltyTier.create({ ...t, is_active: true })))
      .then(() => { queryClient.invalidateQueries({ queryKey: ['loyalty-tiers'] }); toast.success('Default tiers created'); });
  };

  const openEdit = (tier) => {
    setEditingTier(tier);
    setTierForm({ name: tier.name, min_points: tier.min_points, min_spend: tier.min_spend, discount_percent: tier.discount_percent, points_multiplier: tier.points_multiplier, benefits: tier.benefits || '', color: tier.color || '#6B7280' });
    setShowTierForm(true);
  };

  const activeTiers = [...tiers].sort((a, b) => a.min_points - b.min_points);

  const getCustomerTier = (customer) => {
    let tier = activeTiers[0];
    for (const t of activeTiers) {
      if (customer.loyalty_points >= t.min_points || customer.total_purchases >= t.min_spend) tier = t;
    }
    return tier;
  };

  const enrichedCustomers = customers.map(c => {
    const tier = getCustomerTier(c);
    const nextTier = activeTiers.find(t => t.min_points > (tier?.min_points || 0));
    const pointsToNext = nextTier ? Math.max(0, nextTier.min_points - c.loyalty_points) : 0;
    return { ...c, tier_name: tier?.name || 'No Tier', tier_color: tier?.color || '#6B7280', points_to_next: pointsToNext, next_tier: nextTier?.name || 'Max Tier' };
  });

  const tierCounts = {};
  enrichedCustomers.forEach(c => { tierCounts[c.tier_name] = (tierCounts[c.tier_name] || 0) + 1; });

  const customerColumns = [
    { key: 'name', label: 'Customer', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'tier', label: 'Tier', render: r => (
      <Badge style={{ background: r.tier_color, color: '#fff' }} className="text-xs">{r.tier_name}</Badge>
    )},
    { key: 'loyalty_points', label: 'Points', render: r => <span className="font-semibold">{r.loyalty_points?.toLocaleString()}</span> },
    { key: 'total_purchases', label: 'Total Spend', render: r => `$${(r.total_purchases || 0).toFixed(2)}` },
    { key: 'credit_balance', label: 'Credit', render: r => r.credit_balance > 0 ? <span className="text-emerald-500">${r.credit_balance.toFixed(2)}</span> : '—' },
    { key: 'next', label: 'Progress', render: r => r.points_to_next > 0 ? (
      <div className="w-32">
        <Progress value={100 - (r.points_to_next / (activeTiers.find(t => t.name === r.next_tier)?.min_points || 1)) * 100} className="h-1.5" />
        <p className="text-xs text-muted-foreground mt-0.5">{r.points_to_next} pts to {r.next_tier}</p>
      </div>
    ) : <Badge variant="secondary" className="text-xs">Max Tier</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Loyalty Program" subtitle="Customer tiers, points management, and rewards tracking">
        <Button onClick={() => { setEditingTier(null); setTierForm({ name: '', min_points: 0, min_spend: 0, discount_percent: 0, points_multiplier: 1, benefits: '', color: '#6B7280' }); setShowTierForm(true); }}>
          <Plus className="w-4 h-4 mr-2" />Add Tier
        </Button>
      </PageHeader>

      <Tabs defaultValue="tiers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
          <TabsTrigger value="customers">Customer Status</TabsTrigger>
        </TabsList>

        <TabsContent value="tiers">
          {tiers.length === 0 && !loadingTiers && (
            <Card className="mb-4">
              <CardContent className="text-center py-8">
                <Crown className="w-10 h-10 mx-auto mb-3 text-amber-400 opacity-60" />
                <p className="text-muted-foreground mb-4">No loyalty tiers configured yet.</p>
                <Button variant="outline" onClick={seedDefaultTiers}>
                  <Star className="w-4 h-4 mr-2" />Setup Default Tiers (Bronze → Platinum)
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeTiers.map(tier => (
              <Card key={tier.id} className="relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: tier.color }} />
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: tier.color }}>
                        {tier.name[0]}
                      </div>
                      <span className="font-semibold">{tier.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(tier)} className="h-7 w-7 p-0">
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Min Points</span><span className="font-medium">{tier.min_points?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Min Spend</span><span className="font-medium">${tier.min_spend?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-medium text-emerald-500">{tier.discount_percent}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Points Multiplier</span><span className="font-medium text-primary">{tier.points_multiplier}x</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Members</span><span className="font-medium"><Users className="w-3 h-3 inline mr-1" />{tierCounts[tier.name] || 0}</span></div>
                  </div>
                  {tier.benefits && (
                    <div className="mt-3 p-2 rounded bg-muted/50 text-xs text-muted-foreground">{tier.benefits}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="customers">
          <DataTable columns={customerColumns} data={enrichedCustomers} searchField="name" emptyMessage="No customers found" />
        </TabsContent>
      </Tabs>

      {/* Tier Form Dialog */}
      <Dialog open={showTierForm} onOpenChange={setShowTierForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTier ? 'Edit Tier' : 'New Loyalty Tier'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); tierMutation.mutate(tierForm); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tier Name *</Label><Input value={tierForm.name} onChange={e => setTierForm(p => ({ ...p, name: e.target.value }))} required /></div>
              <div><Label>Color</Label><Input type="color" value={tierForm.color} onChange={e => setTierForm(p => ({ ...p, color: e.target.value }))} className="h-9" /></div>
              <div><Label>Min Points</Label><Input type="number" value={tierForm.min_points} onChange={e => setTierForm(p => ({ ...p, min_points: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Min Spend ($)</Label><Input type="number" value={tierForm.min_spend} onChange={e => setTierForm(p => ({ ...p, min_spend: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Discount (%)</Label><Input type="number" min="0" max="100" value={tierForm.discount_percent} onChange={e => setTierForm(p => ({ ...p, discount_percent: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Points Multiplier</Label><Input type="number" step="0.1" min="1" value={tierForm.points_multiplier} onChange={e => setTierForm(p => ({ ...p, points_multiplier: parseFloat(e.target.value) || 1 }))} /></div>
            </div>
            <div><Label>Benefits Description</Label><Textarea value={tierForm.benefits} onChange={e => setTierForm(p => ({ ...p, benefits: e.target.value }))} placeholder="Describe the benefits of this tier..." /></div>
            <Button type="submit" className="w-full" disabled={tierMutation.isPending}>{tierMutation.isPending ? 'Saving...' : editingTier ? 'Update Tier' : 'Create Tier'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}