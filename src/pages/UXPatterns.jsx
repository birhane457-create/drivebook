import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EnterprisePageLayout from '@/components/layout/EnterprisePageLayout';
import {
  Breadcrumbs, GlobalSearchBar, TabbedWorkspace, SplitScreen,
  QuickActions, ContextMenuWrapper,
} from '@/components/ux';
import { useFavorites, useRecentItems, useKeyboardShortcuts } from '@/hooks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus, Download, RefreshCw, Package, ShoppingCart, Users, TrendingUp,
  FileText, Trash2, Copy, Edit, Share2, Star,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function UXPatterns() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { items: recentItems } = useRecentItems();
  const [activeTab, setActiveTab] = useState('overview');
  const [tabs, setTabs] = useState([
    { id: 'overview', label: 'Overview', content: <OverviewTab /> },
    { id: 'details', label: 'Details', content: <DetailsTab /> },
  ]);

  // Demo keyboard shortcuts
  useKeyboardShortcuts({
    'n': () => toast({ title: 'Quick shortcut: N', description: 'New item action triggered' }),
    'r': () => toast({ title: 'Quick shortcut: R', description: 'Refresh action triggered' }),
    'e': () => toast({ title: 'Quick shortcut: E', description: 'Export action triggered' }),
  });

  const contextMenuItems = [
    { label: 'Edit', icon: Edit, onClick: () => toast({ title: 'Edit triggered' }), shortcut: 'E' },
    { label: 'Duplicate', icon: Copy, onClick: () => toast({ title: 'Duplicate triggered' }), shortcut: 'D' },
    { label: 'Share', icon: Share2, onClick: () => toast({ title: 'Share triggered' }) },
    { separator: true },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => toast({ title: 'Delete triggered', variant: 'destructive' }), shortcut: 'Del' },
  ];

  const quickActions = [
    { label: 'New Product', icon: Plus, onClick: () => navigate('/products'), shortcut: 'N' },
    { label: 'New Purchase Order', icon: FileText, onClick: () => navigate('/purchases') },
    { label: 'Refresh Data', icon: RefreshCw, onClick: () => toast({ title: 'Data refreshed' }), shortcut: 'R' },
    { label: 'Export Report', icon: Download, onClick: () => toast({ title: 'Exporting...' }), shortcut: 'E' },
  ];

  return (
    <EnterprisePageLayout
      title="UX Patterns"
      description="Every UX pattern in one place — global search, command palette, notifications, breadcrumbs, tabs, split screen, quick actions, context menus, and keyboard shortcuts."
      isFavorite={isFavorite('/ux-patterns')}
      onToggleFavorite={() => toggleFavorite({ path: '/ux-patterns', label: 'UX Patterns' })}
      primaryAction={{ label: 'New Item', icon: Plus, onClick: () => toast({ title: 'Primary action' }) }}
      secondaryActions={[
        { label: 'Export', icon: Download, onClick: () => toast({ title: 'Exporting...' }) },
        { label: 'Refresh', icon: RefreshCw, onClick: () => toast({ title: 'Refreshed' }) },
        { label: 'Share', icon: Share2, onClick: () => toast({ title: 'Share dialog' }) },
        { label: 'Archive', icon: Trash2, onClick: () => toast({ title: 'Archived' }) },
      ]}
      kpis={[
        { label: 'Total Products', value: '1,284', icon: Package, trend: 12 },
        { label: 'Open Orders', value: '47', icon: ShoppingCart, trend: -5 },
        { label: 'Active Customers', value: '892', icon: Users, trend: 8 },
        { label: 'Revenue (30d)', value: '$84.2k', icon: TrendingUp, trend: 23 },
      ]}
      filters={
        <div className="flex items-center gap-2">
          <GlobalSearchBar onOpen={() => {}} placeholder="Filter results…" className="max-w-xs" />
          <Button variant="outline" size="sm">Category</Button>
          <Button variant="outline" size="sm">Status</Button>
          <Button variant="outline" size="sm">Date Range</Button>
        </div>
      }
      toolbar={
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing 1–12 of 1,284 results</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">Bulk Edit</Button>
            <Button variant="outline" size="sm">Delete Selected</Button>
          </div>
        </div>
      }
      rightPanel={
        <Card className="p-4">
          <p className="font-semibold text-sm mb-3">Favorites ({favorites.length})</p>
          {favorites.length === 0 ? (
            <p className="text-xs text-muted-foreground">Star a page to add it here.</p>
          ) : (
            <div className="space-y-1.5">
              {favorites.map(f => (
                <button key={f.path} onClick={() => navigate(f.path)} className="flex items-center gap-2 text-sm w-full text-left hover:text-primary transition-colors">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <p className="font-semibold text-sm mt-4 mb-2">Recent Items ({recentItems.length})</p>
          {recentItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">Pages you visit appear here.</p>
          ) : (
            <div className="space-y-1.5">
              {recentItems.slice(0, 5).map(r => (
                <button key={r.path} onClick={() => navigate(r.path)} className="flex items-center gap-2 text-sm w-full text-left hover:text-primary transition-colors truncate">
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </Card>
      }
      activityFeed={[
        { id: 1, user: 'Sarah K.', action: 'created purchase order #PO-1042', icon: ShoppingCart, color: 'bg-blue-500' },
        { id: 2, user: 'Mike R.', action: 'updated product "Wireless Mouse"', icon: Package, color: 'bg-emerald-500' },
        { id: 3, user: 'System', action: 'low stock alert for SKU-8821', icon: TrendingUp, color: 'bg-amber-500' },
      ]}
    >
      {/* Tabbed Workspace */}
      <Card className="p-0 mb-6 overflow-hidden h-[300px]">
        <TabbedWorkspace
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onCloseTab={(id) => setTabs(t => t.filter(tab => tab.id !== id))}
          onNewTab={() => {
            const id = `tab-${Date.now()}`;
            setTabs(t => [...t, { id, label: `Tab ${t.length + 1}`, content: <OverviewTab /> }]);
            setActiveTab(id);
          }}
        />
      </Card>

      {/* Split Screen */}
      <Card className="p-0 mb-6 overflow-hidden h-[280px]">
        <SplitScreen
          left={<div className="p-4"><p className="font-semibold text-sm mb-2">Left Panel</p><p className="text-sm text-muted-foreground">Drag the divider to resize. Use the collapse buttons to focus on one panel.</p></div>}
          right={<div className="p-4"><p className="font-semibold text-sm mb-2">Right Panel</p><p className="text-sm text-muted-foreground">Each panel scrolls independently. Great for master-detail views.</p></div>}
        />
      </Card>

      {/* Context Menu + Quick Actions */}
      <ContextMenuWrapper items={contextMenuItems}>
        <Card className="p-6 mb-6">
          <p className="font-semibold text-sm mb-1">Right-Click Context Menu</p>
          <p className="text-sm text-muted-foreground">Right-click anywhere in this card to see the custom context menu with Edit, Duplicate, Share, and Delete actions.</p>
          <div className="mt-4 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground cursor-pointer select-none">
            ↳ Right-click me!
          </div>
          <p className="font-semibold text-sm mt-6 mb-1">Keyboard Shortcuts</p>
          <p className="text-sm text-muted-foreground">Press <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs">N</kbd> for new, <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs">R</kbd> for refresh, <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs">E</kbd> for export, or <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs">⌘K</kbd> for command palette.</p>
        </Card>
      </ContextMenuWrapper>

      {/* Quick Actions FAB */}
      <QuickActions actions={quickActions} />
    </EnterprisePageLayout>
  );
}

function OverviewTab() {
  return (
    <div className="p-4 space-y-3">
      <p className="font-semibold text-sm">Overview</p>
      <p className="text-sm text-muted-foreground">This tab shows a summary view. Click the + button to add new tabs, or the × on each tab to close it.</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Items</p><p className="text-lg font-bold">1,284</p></div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Active</p><p className="text-lg font-bold">892</p></div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Pending</p><p className="text-lg font-bold">47</p></div>
      </div>
    </div>
  );
}

function DetailsTab() {
  return (
    <div className="p-4">
      <p className="font-semibold text-sm mb-2">Details</p>
      <p className="text-sm text-muted-foreground">This tab shows detailed records. Multiple tabs let you work on several items simultaneously without losing context.</p>
    </div>
  );
}