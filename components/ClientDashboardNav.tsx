'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, Calendar, Wallet, User, LogOut, Star,
  HelpCircle, BookOpen, Menu, X, TrendingUp, Package,
} from 'lucide-react'
import { useBookLessonHref } from '@/lib/hooks/useBookLessonHref'
import NotificationBell from '@/components/NotificationBell'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

export default function ClientDashboardNav() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const bookLessonHref = useBookLessonHref()

  const navItems = [
    { href: '/client-dashboard',           label: 'Dashboard', icon: LayoutDashboard },
    { href: '/client-dashboard/bookings',  label: 'My Bookings', icon: Calendar },
    { href: '/client-dashboard/packages',  label: 'Packages', icon: Package },
    { href: '/client-dashboard/wallet',    label: 'Wallet', icon: Wallet },
    { href: '/client-dashboard/progress',  label: 'Progress', icon: TrendingUp },
    { href: '/client-dashboard/reviews',   label: 'Reviews', icon: Star },
    { href: '/client-dashboard/profile',   label: 'Profile', icon: User },
    { href: '/client-dashboard/help',      label: 'Help', icon: HelpCircle },
  ]

  const isActive = (href: string) =>
    href === '/client-dashboard' ? pathname === href : pathname?.startsWith(href)

  return (
    <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border shadow-lg">
      <div className="max-w-7xl mx-auto px-3 lg:px-4 xl:px-8">
        <div className="flex h-14 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/client-dashboard" className="flex items-center gap-2.5 no-underline group shrink-0">
            <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30 group-hover:shadow-primary/50 transition-shadow">
              <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <span className="text-base font-bold text-foreground">DriveBook</span>
            <Badge variant="sky" className="hidden xl:flex">Student</Badge>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-2 xl:px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  isActive(href)
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell />

            <Link
              href={bookLessonHref}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 xl:px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition shadow-sm shadow-primary/30 no-underline"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden xl:inline">Book Lesson</span>
            </Link>

            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="hidden lg:flex items-center gap-1.5 p-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-card/95 backdrop-blur-xl max-h-[80vh] overflow-y-auto">
          <div className="px-3 py-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2">
              Student Menu
            </p>
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline',
                  isActive(href)
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            ))}

            <div className="pt-2 border-t border-border mt-2 space-y-1">
              <Link
                href={bookLessonHref}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition no-underline"
              >
                <BookOpen className="w-4 h-4" />
                Book Lesson
              </Link>
              <button
                onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: '/' }) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:text-destructive/80 hover:bg-destructive/10 transition"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
