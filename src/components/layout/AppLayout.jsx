import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const [user, setUser] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: () => base44.entities.Alert.filter({ is_read: false }),
    refetchInterval: 30000,
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={user} alertCount={alerts.length} />
      <main className="ml-[240px] min-h-screen transition-all duration-300">
        <div className="p-6 max-w-[1600px] mx-auto">
          <Outlet context={{ user }} />
        </div>
      </main>
    </div>
  );
}