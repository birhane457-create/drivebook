import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useKeyboardShortcuts, useRecentItems } from '@/hooks';
import Sidebar from './Sidebar';
import CommandPalette from '@/components/CommandPalette';
import NotificationCenter from '@/components/NotificationCenter';
import GlobalSearchBar from '@/components/ux/GlobalSearchBar';
import Breadcrumbs from '@/components/ux/Breadcrumbs';
import PageFooter from '@/components/shared/PageFooter';
import { ROUTE_ACCESS } from '@/lib/route-access';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { addItem } = useRecentItems();

  // Track recently visited pages
  useEffect(() => {
    const routeConfig = ROUTE_ACCESS[location.pathname];
    if (routeConfig) {
      addItem({ path: location.pathname, label: routeConfig.label });
    }
  }, [location.pathname, addItem]);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    'mod+k': () => setPaletteOpen(prev => !prev),
    'mod+/': () => setPaletteOpen(true),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: () => base44.entities.Alert.filter({ is_read: false }),
    refetchInterval: 30000,
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        user={user}
        alertCount={alerts.length}
        onOpenSearch={() => setPaletteOpen(true)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(c => !c)}
      />
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <main className={cn("lg:ml-[240px] min-h-screen transition-all duration-300", collapsed && "lg:ml-[68px]")}>
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
          <div className="flex items-center justify-between gap-3 h-14 px-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden flex-shrink-0"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Breadcrumbs className="hidden md:flex flex-shrink-0" />
              <div className="flex-1 max-w-md hidden sm:block ml-auto">
                <GlobalSearchBar onOpen={() => setPaletteOpen(true)} />
              </div>
            </div>
            <NotificationCenter />
          </div>
        </header>
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
          <Outlet context={{ user }} />
        </div>
        <PageFooter />
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}