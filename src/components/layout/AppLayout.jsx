import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import Sidebar from './Sidebar';
import CommandPalette from '@/components/CommandPalette';

export default function AppLayout() {
  const { user } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);

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
      <Sidebar user={user} alertCount={alerts.length} onOpenSearch={() => setPaletteOpen(true)} />
      <main className="ml-[240px] min-h-screen transition-all duration-300">
        <div className="p-6 max-w-[1600px] mx-auto">
          <Outlet context={{ user }} />
        </div>
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}