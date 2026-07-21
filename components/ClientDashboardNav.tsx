'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Calendar,
  Wallet,
  User,
  LogOut,
  Star,
  HelpCircle,
  BookOpen,
  Menu,
  X,
  Bell,
  TrendingUp,
  Package,
} from 'lucide-react'
import { useBookLessonHref } from '@/lib/hooks/useBookLessonHref'
import NotificationBell from '@/components/NotificationBell'

export default function ClientDashboardNav() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const bookLessonHref = useBookLessonHref()

  const navItems = [
    { href: '/client-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/client-dashboard/bookings', label: 'My Bookings', icon: Calendar },
    { href: '/client-dashboard/packages', label: 'Packages', icon: Package },
    { href: '/client-dashboard/wallet', label: 'Wallet', icon: Wallet },
    { href: '/client-dashboard/progress', label: 'Progress', icon: TrendingUp },
    { href: '/client-dashboard/reviews', label: 'Reviews', icon: Star },
    { href: '/client-dashboard/profile', label: 'Profile', icon: User },
    { href: '/client-dashboard/help', label: 'Help', icon: HelpCircle },
  ]

  const isActive = (href: string) =>
    href === '/client-dashboard' ? pathname === href : pathname?.startsWith(href)

  return (
    <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-slate-950/50">
      <div className="max-w-7xl mx-auto px-3 lg:px-4 xl:px-8">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/client-dashboard" className="flex items-center gap-2.5 no-underline group">
              <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40 group-hover:shadow-blue-600/60 transition-shadow">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                DriveBook
              </span>
            </Link>
            <span className="hidden xl:inline-block px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-xs font-semibold text-blue-300">
              Student
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    'flex items-center gap-1.5 px-2 xl:px-3 py-2 rounded-xl text-sm font-medium transition-all ' +
                    (active
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/10')
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Notifications Bell */}
            <NotificationBell />

            {/* Book Lesson CTA */}
            <Link
              href={bookLessonHref}
              className="hidden lg:inline-flex items-center gap-1.5 px-4 xl:px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold hover:shadow-lg hover:shadow-blue-600/50 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden xl:inline">Book Lesson</span>
            </Link>

            {/* Logout */}
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="hidden lg:flex items-center gap-1.5 px-2 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-slate-900/95 backdrop-blur-xl max-h-[80vh] overflow-y-auto shadow-lg">
          <div className="px-3 py-4 space-y-1">
            <div className="flex items-center justify-between px-3 py-2 mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Student Menu</span>
            </div>
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ' +
                    (active
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/10')
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
            <div className="pt-2 border-t border-white/10 mt-2">
              <Link
                href={bookLessonHref}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold hover:shadow-lg transition-all"
              >
                <BookOpen className="w-4 h-4" />
                Book Lesson
              </Link>
            </div>
            <button
              onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: '/' }) }}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
