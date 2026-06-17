'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Bell, ChevronDown, X, Menu, LayoutDashboard, LogOut } from 'lucide-react';
import { useNotifications } from '@/lib/hooks/useNotifications';

const TYPE_ICON: Record<string, string> = {
  BOOKING_REQUEST: '📅', BOOKING_CONFIRMED: '✅', BOOKING_CANCELLED: '❌',
  PAYMENT_RECEIVED: '💰', LESSON_REMINDER: '⏰', NEW_MESSAGE: '💬',
  DOCUMENT_EXPIRING: '⚠️', REVIEW_RECEIVED: '⭐',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, fetchNotifications, markAllRead, markOneRead: markRead } = useNotifications();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { if (!open) fetchNotifications(); setOpen(!open); }}
        className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-900/5 hover:text-white transition"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <span className="font-semibold text-slate-100">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition">Mark all read</button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No notifications yet</p>
            ) : (
              notifications.map(n => (
                <Link
                  key={n.id}
                  href={n.link || '/admin'}
                  onClick={() => markRead(n.id)}
                  className={`flex gap-3 items-start px-4 py-3 hover:bg-slate-800 transition ${!n.isRead ? 'bg-slate-800/60' : ''}`}
                >
                  <span className="text-lg flex-shrink-0">{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100">{n.title}</p>
                    <p className="text-xs text-slate-400 truncate">{n.message}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <div className="mt-2 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navGroups = [
    {
      name: 'Users', icon: '👥', items: [
        { name: 'Instructors', href: '/admin/instructors', icon: '🧑‍🏫' },
        { name: 'Clients', href: '/admin/clients', icon: '👤' },
        { name: 'Staff Tasks', href: '/staff/dashboard', icon: '📋' },
      ]
    },
    {
      name: 'Finance', icon: '💰', items: [
        { name: 'Credits', href: '/admin/credits', icon: '💳' },
        { name: 'Revenue', href: '/admin/revenue', icon: '💰' },
        { name: 'Payouts', href: '/admin/payouts', icon: '💸' },
        { name: 'Disputes', href: '/admin/disputes', icon: '⚠️' },
        { name: 'Pricing', href: '/admin/pricing', icon: '🏷️' },
      ]
    },
    {
      name: 'Operations', icon: '📋', items: [
        { name: 'Documents', href: '/admin/documents', icon: '📄' },
        { name: 'Bookings', href: '/admin/bookings', icon: '📅' },
        { name: 'Audit Log', href: '/admin/audit-log', icon: '🔍' },
        { name: 'Test Centres', href: '/admin/test-centres', icon: '🚗' },
      ]
    },
    {
      name: 'Engagement', icon: '⭐', items: [
        { name: 'Reviews', href: '/admin/reviews', icon: '⭐' },
        { name: 'Support', href: '/admin/support', icon: '💬' },
      ]
    },
    { name: 'Settings', icon: '⚙️', href: '/admin/settings', items: [] },
    { name: 'Copilot', icon: '🤖', href: '/admin/copilot', items: [] },
  ];

  const allNavItems = navGroups.flatMap(g =>
    g.items.length > 0 ? g.items : [{ name: g.name, href: g.href!, icon: g.icon }]
  );

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === href;
    if (href === '/staff/dashboard') return pathname?.startsWith('/staff');
    return pathname?.startsWith(href);
  };

  const isGroupActive = (g: typeof navGroups[0]) =>
    g.href ? isActive(g.href) : g.items.some(i => isActive(i.href));

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50" ref={navRef}>
      <div className="max-w-7xl mx-auto px-3 lg:px-4 xl:px-8">
        <div className="flex justify-between h-14">

          {/* Logo */}
          <div className="flex items-center">
            <Link href="/admin" className="flex items-center gap-2 no-underline">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-blue-600/40">
                A
              </div>
              <span className="text-base font-bold text-slate-100">Admin</span>
              <span className="hidden xl:inline-block px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-xs font-semibold text-red-300 ml-1">
                Internal
              </span>
            </Link>
          </div>

          {/* Desktop nav — lg+ only so tablets get the mobile menu */}
          <div className="hidden lg:flex items-center gap-0.5">
            {navGroups.map((group) => (
              <div key={group.name} className="relative">
                {group.items.length === 0 ? (
                  <Link
                    href={group.href!}
                    className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(group.href!)
                        ? 'bg-blue-900/40 text-blue-300'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/5'
                    }`}
                  >
                    <span className="text-sm">{group.icon}</span>
                    <span>{group.name}</span>
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={() => setOpenDropdown(openDropdown === group.name ? null : group.name)}
                      className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isGroupActive(group)
                          ? 'bg-blue-900/40 text-blue-300'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/5'
                      }`}
                    >
                      <span className="text-sm">{group.icon}</span>
                      <span>{group.name}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openDropdown === group.name ? 'rotate-180' : ''}`} />
                    </button>

                    {openDropdown === group.name && (
                      <div className="absolute left-0 mt-1 w-48 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 py-1.5 z-50">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpenDropdown(null)}
                            className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors rounded-md mx-1 ${
                              isActive(item.href)
                                ? 'bg-blue-900/40 text-blue-300'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/5'
                            }`}
                          >
                            <span>{item.icon}</span>
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Link
              href="/dashboard"
              className="hidden lg:flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-900/5 transition no-underline"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden xl:inline">Instructor View</span>
            </Link>
            <a
              href="/api/auth/signout"
              className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline">Sign Out</span>
            </a>

            {/* Mobile/tablet hamburger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900/5 transition"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile/tablet menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 py-3 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-1.5 px-1">
              {allNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-900/40 text-blue-300'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/5'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800 px-1 flex gap-1.5">
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-900/5 rounded-lg no-underline transition"
              >
                <LayoutDashboard className="w-4 h-4" />
                Instructor View
              </Link>
              <a
                href="/api/auth/signout"
                className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
