'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Home, Calendar, Wallet, BookOpen, User, Star,
  HelpCircle, LogOut, Menu, X, TrendingUp,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { useBookLessonHref } from '@/lib/hooks/useBookLessonHref'
import { cn } from '@/lib/cn'
import { Bell } from 'lucide-react'

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
  const { notifications, unreadCount, fetchNotifications, markAllRead, markOneRead: markRead } = useNotifications()

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
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
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
                  href={n.link || '/client-dashboard'}
                  onClick={() => markRead(n.id)}
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
          <div className="border-t border-border px-4 py-2.5">
            <Link
              href="/client-dashboard/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:text-primary/80 font-medium no-underline transition"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ClientNav() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const bookLessonHref = useBookLessonHref()

  const navItems = [
    { href: '/client-dashboard',          label: 'Dashboard',  icon: Home },
    { href: bookLessonHref,               label: 'Book Lesson', icon: BookOpen },
    { href: '/client-dashboard/bookings', label: 'My Bookings', icon: Calendar },
    { href: '/client-dashboard/progress', label: 'Progress',   icon: TrendingUp },
    { href: '/client-dashboard/wallet',   label: 'Wallet',     icon: Wallet },
    { href: '/client-dashboard/reviews',  label: 'Reviews',    icon: Star },
    { href: '/client-dashboard/profile',  label: 'Profile',    icon: User },
    { href: '/client-dashboard/help',     label: 'Help',       icon: HelpCircle },
  ]

  const isActive = (href: string) =>
    href === '/client-dashboard' ? pathname === href : pathname?.startsWith(href)

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">

          {/* Logo */}
          <div className="flex items-center">
            <Link href="/client-dashboard" className="text-base font-bold text-primary no-underline">
              DriveBook
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline',
                  isActive(href)
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition ml-1"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
            <NotificationBell />
          </div>

          {/* Mobile */}
          <div className="md:hidden flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium no-underline transition-colors',
                  isActive(href)
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
            <button
              onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: '/login' }) }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:text-destructive/80 hover:bg-destructive/10 transition"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
