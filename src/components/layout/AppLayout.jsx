import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import Sidebar from './Sidebar';
import CommandPalette from '@/components/CommandPalette';
import NotificationCenter from '@/components/NotificationCenter';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppLayout() {
  const { user } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
      />
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <main className="lg:ml-[240px] min-h-screen transition-all duration-300">
        <header className="sticky top-0 z-20 h-14 border-b bg-background/80 backdrop-blur flex items-center justify-between px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
          <NotificationCenter />
        </header>
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
          <Outlet context={{ user }} />
        </div>
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}