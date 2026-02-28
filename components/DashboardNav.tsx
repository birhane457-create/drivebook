'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Home, Calendar, Users, Car, Settings, LogOut, TrendingUp, Menu, X, HelpCircle, CreditCard, FileText, Package, Palette } from 'lucide-react'

export default function DashboardNav() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/dashboard/bookings', label: 'Bookings', icon: Calendar },
    { href: '/dashboard/clients', label: 'Clients', icon: Users },
    { href: '/dashboard/pda-tests', label: 'Tests', icon: Car },
    { href: '/dashboard/documents', label: 'Documents', icon: FileText },
    { href: '/dashboard/earnings', label: 'Earnings', icon: TrendingUp },
    { href: '/dashboard/packages', label: 'Packages', icon: Package },
    { href: '/dashboard/analytics', label: 'Analytics', icon: TrendingUp },
    { href: '/dashboard/branding', label: 'Branding', icon: Palette },
    { href: '/dashboard/subscription', label: 'Subscription', icon: CreditCard },
    { href: '/dashboard/profile', label: 'Profile', icon: Settings },
    { href: '/dashboard/help', label: 'Help', icon: HelpCircle },
  ]

  return (
    <nav className="bg-white shadow sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Navigation */}
        <div className="hidden md:flex justify-between h-16">
          <div className="flex gap-4 lg:gap-8 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-2 lg:px-3 border-b-2 transition whitespace-nowrap ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium text-sm lg:text-base">{item.label}</span>
                </Link>
              )
            })}
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 text-gray-600 hover:text-red-600"
          >
            <LogOut className="h-5 w-5" />
            <span className="hidden lg:inline">Logout</span>
          </button>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex justify-between items-center h-16">
          <h1 className="text-lg font-bold text-gray-900">DriveBook</h1>
          
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-white">
          <div className="px-4 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
            
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
