'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Home, Calendar, Users, DollarSign, Settings, LogOut,
  Menu, X, Bell, FileText, Palette, CreditCard, BarChart2,
  Package, Wallet, ClipboardList, User, HelpCircle, ChevronDown, Star, TrendingUp, Landmark, CalendarDays, Megaphone,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/lib/hooks/useNotifications';

// ── Notification types ────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  BOOKING_REQUEST: '📅',
  BOOKING_CONFIRMED: '✅',
  BOOKING_CANCELLED: '❌',
  PAYMENT_RECEIVED: '💰',
  LESSON_REMINDER: '⏰',
  NEW_MESSAGE: '💬',
  DOCUMENT_EXPIRING: '⚠️',
  REVIEW_RECEIVED: '⭐',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
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
        className="relative p-2 rounded-lg text-slate-300 hover:bg-white/5 transition"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-900/95 rounded-2xl border border-white/10 shadow-2xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-sky-300 hover:text-white transition-colors">Mark all read</button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-white/10">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No notifications yet</p>
            ) : (
              notifications.map(n => (
                <Link
                  key={n.id}
                  href={n.link || '/dashboard'}
                  onClick={() => { markRead(n.id); setOpen(false); }}
                  className={'flex gap-3 items-start px-4 py-3 hover:bg-white/5 transition ' + (!n.isRead ? 'bg-slate-800/70' : '')}
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

// ── Nav groups ────────────────────────────────────────────────────────────────

const navGroups = {
  core: {
    label: null, // always visible, no dropdown
    items: [
      { href: '/dashboard',          label: 'Dashboard', icon: Home },
      { href: '/dashboard/bookings', label: 'Bookings',  icon: Calendar },
      { href: '/dashboard/schedule', label: 'Schedule',  icon: CalendarDays },
      { href: '/dashboard/clients',  label: 'Clients',   icon: Users },
      { href: '/dashboard/earnings', label: 'Earnings',  icon: DollarSign },
    ],
  },
  business: {
    label: 'Business',
    items: [
      { href: '/dashboard/expenses',    label: 'Business Records', icon: TrendingUp },
      { href: '/dashboard/analytics',   label: 'Analytics',        icon: BarChart2 },
      { href: '/dashboard/wallet',      label: 'Payout Wallet',    icon: Wallet },
      { href: '/dashboard/settings/payout', label: 'Tax & Payout', icon: Landmark },
      { href: '/dashboard/marketing',   label: 'Marketing Flyer',  icon: Megaphone },
    ],
  },
  operations: {
    label: 'Operations',
    items: [
      { href: '/dashboard/availability', label: 'Availability', icon: Calendar },
      { href: '/dashboard/packages', label: 'Packages', icon: Package },
      { href: '/dashboard/pda-tests', label: 'PDA Tests', icon: ClipboardList },
      { href: '/dashboard/documents', label: 'Documents', icon: FileText },
    ],
  },
  account: {
    label: 'Account',
    items: [
      { href: '/dashboard/branding', label: 'Branding', icon: Palette },
      { href: '/dashboard/subscription', label: 'Subscription', icon: CreditCard },
      { href: '/dashboard/profile', label: 'Profile', icon: User },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
      { href: '/dashboard/help', label: 'Help', icon: HelpCircle },
    ],
  },
} as const;

type GroupKey = keyof typeof navGroups;

// ── Dropdown component ────────────────────────────────────────────────────────

function NavDropdown({
  groupKey,
  label,
  items,
  isActive,
  open,
  onToggle,
  onClose,
  dropRef,
}: {
  groupKey: string;
  label: string;
  items: readonly { href: string; label: string; icon: any }[];
  isActive: (href: string) => boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  dropRef: React.RefObject<HTMLDivElement>;
}) {
  const groupActive = items.some(i => isActive(i.href));

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={onToggle}
        className={
          'flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-sm font-medium transition-colors ' +
          (groupActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')
        }
      >
        {label}
        <ChevronDown className={'w-3.5 h-3.5 transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-52 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl py-1.5 z-50">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={
                  'flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-md mx-1 ' +
                  (isActive(item.href)
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5')
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main nav ──────────────────────────────────────────────────────────────────

export default function DashboardNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(null);

  // One ref per dropdown group
  const refs: Record<GroupKey, React.RefObject<HTMLDivElement>> = {
    core: useRef<HTMLDivElement>(null),
    business: useRef<HTMLDivElement>(null),
    operations: useRef<HTMLDivElement>(null),
    account: useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const clickedInsideAny = Object.values(refs).some(
        r => r.current && r.current.contains(e.target as Node)
      );
      if (!clickedInsideAny) setOpenGroup(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === href;
    return pathname?.startsWith(href);
  };

  const toggleGroup = (key: GroupKey) => {
    setOpenGroup(prev => (prev === key ? null : key));
  };

  return (
    <nav className="bg-slate-950/60 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 lg:px-4 xl:px-8">
        <div className="flex justify-between h-16">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2.5 no-underline group">
              <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40 group-hover:shadow-blue-600/60 transition-shadow">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                DriveBook
              </span>
            </Link>
            <span className="hidden xl:inline-block px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-xs font-semibold text-green-300">
              Instructor
            </span>
          </div>

          {/* Desktop nav — lg+ only so tablets get the mobile menu */}
          <div className="hidden lg:flex items-center gap-0.5">

            {/* Core — always visible links */}
            {navGroups.core.items.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    'flex items-center gap-1.5 px-2 lg:px-2 xl:px-3 py-2 rounded-lg text-sm font-medium transition-colors ' +
                    (isActive(item.href)
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-white/60 hover:text-white hover:bg-white/5')
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Grouped dropdowns */}
            {(['business', 'operations', 'account'] as GroupKey[]).map(key => {
              const group = navGroups[key];
              if (!group.label) return null;
              return (
                <NavDropdown
                  key={key}
                  groupKey={key}
                  label={group.label}
                  items={group.items}
                  isActive={isActive}
                  open={openGroup === key}
                  onToggle={() => toggleGroup(key)}
                  onClose={() => setOpenGroup(null)}
                  dropRef={refs[key]}
                />
              );
            })}

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-1.5 px-2 xl:px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors ml-0.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline">Logout</span>
            </button>
            <NotificationBell />
          </div>

          {/* Mobile/tablet toggle — shown below lg */}
          <div className="lg:hidden flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile/tablet menu — shown below lg */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-slate-900/95 backdrop-blur-xl max-h-[80vh] overflow-y-auto">
          {(['core', 'business', 'operations', 'account'] as GroupKey[]).map(key => {
            const group = navGroups[key];
            return (
              <div key={key}>
                {group.label && (
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">{group.label}</p>
                  </div>
                )}
                <div className="px-2 pb-1">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ' +
                          (isActive(item.href)
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                            : 'text-white/60 hover:text-white hover:bg-white/5')
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
                {key !== 'account' && <div className="mx-4 border-t border-white/10" />}
              </div>
            );
          })}
          <div className="px-2 pb-3 pt-1">
            <button
              onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: '/login' }); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
