'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Home, Calendar, Users, DollarSign, Settings, LogOut,
  Menu, X, Bell, FileText, Palette, CreditCard, BarChart2,
  Package, Wallet, ClipboardList, User, HelpCircle, ChevronDown,
  TrendingUp, Landmark, CalendarDays, Megaphone, ShieldCheck,
  Building2, MessageSquare, Zap,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';

/* ── Notification types ────────────────────────────────────────────────── */
const TYPE_ICON: Record<string, string> = {
  BOOKING_REQUEST:       '📅',
  BOOKING_CONFIRMED:     '✅',
  BOOKING_CANCELLED:     '❌',
  PAYMENT_RECEIVED:      '💰',
  APPOINTMENT_REMINDER:  '⏰',
  LESSON_REMINDER:       '⏰',
  NEW_MESSAGE:           '💬',
  DOCUMENT_EXPIRING:     '⚠️',
  REVIEW_RECEIVED:       '⭐',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ── Notification bell ─────────────────────────────────────────────────── */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, fetchNotifications, markAllRead, markOneRead } = useNotifications();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { if (!open) fetchNotifications(); setOpen(!open); }}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] bg-card border border-border rounded-2xl shadow-elevated z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-foreground text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:text-foreground transition-colors">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No notifications yet</p>
            ) : (
              notifications.map(n => (
                <Link
                  key={n.id}
                  href={n.link || '/dashboard'}
                  onClick={() => { markOneRead(n.id); setOpen(false); }}
                  className={cn(
                    'flex gap-3 items-start px-4 py-3 hover:bg-secondary transition-colors',
                    !n.isRead && 'bg-secondary/60'
                  )}
                >
                  <span className="text-base flex-shrink-0">{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <div className="mt-2 h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Nav groups ────────────────────────────────────────────────────────── */
function getNavGroups(businessType?: string, paymentModel?: string) {
  const isDriving     = businessType === 'driving';
  const isMarketplace = paymentModel  === 'marketplace';

  return {
    core: {
      label: null,
      items: [
        { href: '/dashboard',          label: 'Dashboard',      icon: Home },
        { href: '/dashboard/bookings', label: 'Bookings',       icon: Calendar },
        { href: '/dashboard/schedule', label: 'Schedule',       icon: CalendarDays },
        { href: '/dashboard/clients',  label: 'Customers',      icon: Users },
        { href: '/dashboard/earnings', label: 'Earnings',       icon: DollarSign },
        ...(!isMarketplace ? [{ href: '/dashboard/quotes', label: 'Quotes', icon: MessageSquare }] : []),
      ],
    },
    business: {
      label: 'Business',
      items: [
        { href: '/dashboard/expenses',          label: 'Business Records', icon: TrendingUp },
        { href: '/dashboard/analytics',         label: 'Analytics',        icon: BarChart2  },
        ...(isMarketplace ? [{ href: '/dashboard/wallet', label: 'Payout Wallet', icon: Wallet }] : []),
        { href: '/dashboard/settings/payout',   label: 'Tax & Payout',     icon: Landmark   },
        { href: '/dashboard/settings/security', label: 'Security',         icon: ShieldCheck },
        ...(isDriving ? [
          { href: '/dashboard/marketing',       label: 'Marketing Flyer',  icon: Megaphone  },
          { href: '/dashboard/marketing/cards', label: 'Business Cards',   icon: CreditCard },
        ] : []),
      ],
    },
    operations: {
      label: 'Operations',
      items: [
        { href: '/dashboard/availability', label: 'Availability',     icon: Calendar     },
        ...(isDriving ? [
          { href: '/dashboard/packages',   label: 'Packages',         icon: Package      },
          { href: '/dashboard/pda-tests',  label: 'PDA Tests',        icon: ClipboardList },
          { href: '/dashboard/progress',   label: 'Student Progress', icon: TrendingUp   },
        ] : []),
        { href: '/dashboard/documents',    label: 'Documents',        icon: FileText     },
      ],
    },
    account: {
      label: 'Account',
      items: [
        { href: '/business-setup',         label: 'Business Setup',   icon: Building2  },
        { href: '/dashboard/branding',     label: 'Branding & URLs',  icon: Palette    },
        { href: '/dashboard/subscription', label: 'Subscription',     icon: CreditCard },
        { href: '/dashboard/profile',      label: 'Profile',          icon: User       },
        { href: '/dashboard/settings',     label: 'Settings',         icon: Settings   },
        { href: '/dashboard/help',         label: 'Help',             icon: HelpCircle },
      ],
    },
  } as const;
}

/* ── Dropdown ──────────────────────────────────────────────────────────── */
function NavDropdown({
  label, items, isActive, open, onToggle, onClose, dropRef,
}: {
  label:    string;
  items:    readonly { href: string; label: string; icon: any }[];
  isActive: (href: string) => boolean;
  open:     boolean;
  onToggle: () => void;
  onClose:  () => void;
  dropRef:  React.RefObject<HTMLDivElement>;
}) {
  const groupActive = items.some(i => isActive(i.href));

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          groupActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        )}
      >
        {label}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-elevated py-1.5 z-50">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-md mx-1',
                  isActive(item.href)
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
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

/* ── Main nav ──────────────────────────────────────────────────────────── */
export default function DashboardNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const businessType = session?.user?.businessType;
  const paymentModel = session?.user?.paymentModel;
  const navGroups    = getNavGroups(businessType, paymentModel);
  type GroupKey      = keyof typeof navGroups;

  const refs: Record<GroupKey, React.RefObject<HTMLDivElement>> = {
    core:       useRef<HTMLDivElement>(null),
    business:   useRef<HTMLDivElement>(null),
    operations: useRef<HTMLDivElement>(null),
    account:    useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const inside = Object.values(refs).some(r => r.current?.contains(e.target as Node));
      if (!inside) setOpenGroup(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname?.startsWith(href);

  return (
    <nav className="bg-card/80 backdrop-blur-xl border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 lg:px-4 xl:px-8">
        <div className="flex justify-between h-16">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-glow group-hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-shadow">
                <Zap className="w-4 h-4 text-foreground" />
              </span>
              <span className="text-lg font-bold text-gradient-blue hidden sm:block">DriveBook</span>
            </Link>
            <Badge variant="sky" className="hidden xl:flex text-[10px] px-2 py-0.5">
              {businessType === 'driving' ? 'Instructor' : 'Provider'}
            </Badge>
          </div>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5">
            {navGroups.core.items.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

           {(['business', 'operations', 'account'] as GroupKey[]).map(key =>  {
  const group = navGroups[key];   // navGroups['PREMIUM'] → undefined
  if (!group.label) return null;  // crashes here
              return (
                <NavDropdown
                  key={key}
                  label={group.label}
                  items={group.items}
                  isActive={isActive}
                  open={openGroup === key}
                  onToggle={() => setOpenGroup(p => p === key ? null : key)}
                  onClose={() => setOpenGroup(null)}
                  dropRef={refs[key]}
                />
              );
            })}

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline">Logout</span>
            </button>

            <NotificationBell />
          </div>

          {/* Mobile toggle */}
          <div className="lg:hidden flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-card/95 backdrop-blur-xl max-h-[80vh] overflow-y-auto">
          {(['core', 'business', 'operations', 'account'] as GroupKey[]).map(key => {
            const group = navGroups[key];
            return (
              <div key={key}>
                {group.label && (
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{group.label}</p>
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
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                          isActive(item.href)
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
                {key !== 'account' && <div className="mx-4 border-t border-border" />}
              </div>
            );
          })}
          <div className="px-2 pb-3 pt-1">
            <button
              onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: '/login' }); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary"
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
