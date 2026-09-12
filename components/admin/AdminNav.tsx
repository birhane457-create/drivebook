'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { Bell, ChevronDown, X, Menu, LayoutDashboard, LogOut } from 'lucide-react'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { useAdminPermissions } from '@/hooks/useAdminPermissions'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

const TYPE_ICON: Record<string, string> = {
  BOOKING_REQUEST: '📅', BOOKING_CONFIRMED: '✅', BOOKING_CANCELLED: '❌',
  PAYMENT_RECEIVED: '💰', LESSON_REMINDER: '⏰', NEW_MESSAGE: '💬',
  DOCUMENT_EXPIRING: '⚠️', REVIEW_RECEIVED: '⭐',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, fetchNotifications, markAllRead, markOneRead } = useNotifications()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { if (!open) fetchNotifications(); setOpen(!open) }}
        className="relative p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-foreground text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:text-primary/80 transition">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || '/admin'}
                  onClick={() => markOneRead(n.id)}
                  className={cn(
                    'flex gap-3 items-start px-4 py-3 hover:bg-accent transition no-underline',
                    !n.isRead && 'bg-accent/50',
                  )}
                >
                  <span className="text-lg flex-shrink-0">{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.message}</p>
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
  )
}

export default function AdminNav() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenDropdown(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { can, loading: permLoading } = useAdminPermissions()
  const canSee = (perm?: string) => !perm || permLoading || can(perm)

  type NavItem  = { name: string; href: string; icon: string; perm?: string }
  type NavGroup = { name: string; icon: string; perm?: string; href?: string; items: NavItem[] }

  const navGroups: NavGroup[] = [
    {
      name: 'Users', icon: '👥', items: [
        { name: 'Instructors',   href: '/admin/instructors',   icon: '🧑‍🏫', perm: 'users.providers.view' },
        { name: 'Clients',       href: '/admin/clients',       icon: '👤',   perm: 'users.customers.view' },
        { name: 'Subscriptions', href: '/admin/subscriptions', icon: '💳',   perm: 'users.subscriptions.view' },
        { name: 'Staff Tasks',   href: '/staff/dashboard',     icon: '📋' },
      ],
    },
    {
      name: 'Finance', icon: '💰', items: [
        { name: 'Credits',  href: '/admin/credits',  icon: '💳', perm: 'finance.credits.view' },
        { name: 'Revenue',  href: '/admin/revenue',  icon: '💰', perm: 'finance.revenue.view' },
        { name: 'Payouts',  href: '/admin/payouts',  icon: '💸', perm: 'finance.payouts.view' },
        { name: 'Disputes', href: '/admin/disputes', icon: '⚠️', perm: 'finance.disputes.view' },
        { name: 'Cancellations', href: '/admin/cancellations', icon: '🔄', perm: 'finance.refunds.view' },
        { name: 'Pricing',  href: '/admin/pricing',  icon: '🏷️', perm: 'finance.pricing.view' },
      ],
    },
    {
      name: 'Operations', icon: '📋', items: [
        { name: 'Documents',      href: '/admin/documents',    icon: '📄', perm: 'operations.documents.view' },
        { name: 'Bookings',       href: '/admin/bookings',     icon: '📅', perm: 'operations.bookings.view' },
        { name: 'Audit Log',      href: '/admin/audit-log',    icon: '🔍', perm: 'operations.audit_log.view' },
        { name: 'Test Centres',   href: '/admin/test-centres', icon: '🚗', perm: 'operations.test_centres.view' },
        { name: 'Policy & Rules', href: '/admin/policy',       icon: '📚', perm: 'operations.policy.view' },
        { name: 'Cron Jobs',      href: '/admin/cron-jobs',    icon: '⏱️', perm: 'operations.cron.view' },
        { name: 'Voice Lines',    href: '/admin/voice-lines',  icon: '📞', perm: 'operations.voice_lines.view' },
      ],
    },
    {
      name: 'Engagement', icon: '⭐', items: [
        { name: 'Reviews', href: '/admin/reviews', icon: '⭐', perm: 'engagement.reviews.view' },
        { name: 'Support', href: '/admin/support', icon: '💬', perm: 'engagement.support.view' },
      ],
    },
    { name: 'Settings', icon: '⚙️', href: '/admin/settings', perm: 'platform.settings.view', items: [] },
    { name: 'Copilot',  icon: '🤖', href: '/admin/copilot',  perm: 'platform.copilot.view',  items: [] },
  ]

  const visibleGroups: NavGroup[] = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => canSee(i.perm)) }))
    .filter((g) => {
      if (g.items.length === 0) return !!g.href && canSee(g.perm)
      return true
    })

  const visibleAllNavItems: NavItem[] = visibleGroups.flatMap((g) =>
    g.items.length > 0
      ? g.items
      : g.href ? [{ name: g.name, href: g.href, icon: g.icon, perm: g.perm }] : []
  )

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === href
    if (href === '/staff/dashboard') return pathname?.startsWith('/staff')
    return pathname?.startsWith(href)
  }

  const isGroupActive = (g: NavGroup) =>
    g.href ? isActive(g.href) : g.items.some((i) => isActive(i.href))

  return (
    <nav className="bg-card/80 border-b border-border sticky top-0 z-50 backdrop-blur-sm" ref={navRef}>
      <div className="max-w-7xl mx-auto px-3 lg:px-4 xl:px-8">
        <div className="flex justify-between h-14">

          {/* Logo */}
          <div className="flex items-center">
            <Link href="/admin" className="flex items-center gap-2 no-underline">
              <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-lg shadow-primary/30">
                A
              </span>
              <span className="text-base font-bold text-foreground">Admin</span>
              <Badge variant="destructive" className="hidden xl:flex ml-1 text-xs py-0 px-1.5">
                Internal
              </Badge>
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5">
            {visibleGroups.map((group) => (
              <div key={group.name} className="relative">
                {group.items.length === 0 && group.href ? (
                  <Link
                    href={group.href}
                    className={cn(
                      'flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive(group.href)
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    )}
                  >
                    <span className="text-sm">{group.icon}</span>
                    <span>{group.name}</span>
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={() => setOpenDropdown(openDropdown === group.name ? null : group.name)}
                      className={cn(
                        'flex items-center gap-1 px-2 xl:px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isGroupActive(group)
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      )}
                    >
                      <span className="text-sm">{group.icon}</span>
                      <span>{group.name}</span>
                      <ChevronDown className={cn(
                        'w-3.5 h-3.5 transition-transform',
                        openDropdown === group.name && 'rotate-180',
                      )} />
                    </button>

                    {openDropdown === group.name && (
                      <div className="absolute left-0 mt-1 w-48 bg-card border border-border rounded-xl shadow-2xl py-1.5 z-50">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpenDropdown(null)}
                            className={cn(
                              'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors rounded-md mx-1',
                              isActive(item.href)
                                ? 'bg-primary/15 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                            )}
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
              className="hidden lg:flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition no-underline"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden xl:inline">Instructor View</span>
            </Link>
            <a
              href="/api/auth/signout"
              className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-destructive hover:text-destructive/80 hover:bg-destructive/10 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline">Sign Out</span>
            </a>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-border py-3 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-1.5 px-1">
              {visibleAllNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                >
                  <span>{item.icon}</span>
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border px-1 flex gap-1.5">
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg no-underline transition"
              >
                <LayoutDashboard className="w-4 h-4" />
                Instructor View
              </Link>
              <a
                href="/api/auth/signout"
                className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
