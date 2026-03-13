'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

export default function AdminNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Overview', href: '/admin', icon: '📊' },
    { name: 'Instructors', href: '/admin/instructors', icon: '👥' },
    { name: 'Clients', href: '/admin/clients', icon: '👤' },
    { name: 'Staff Tasks', href: '/staff/dashboard', icon: '📋' },
    { name: 'Documents', href: '/admin/documents', icon: '📄' },
    { name: 'Bookings', href: '/admin/bookings', icon: '📅' },
    { name: 'Credits', href: '/admin/credits', icon: '💳' },
    { name: 'Revenue', href: '/admin/revenue', icon: '💰' },
    { name: 'Payouts', href: '/admin/payouts', icon: '💸' },
    { name: 'Pricing', href: '/admin/pricing', icon: '🏷️' },
    { name: 'Reviews', href: '/admin/reviews', icon: '⭐' },
    { name: 'Support', href: '/admin/support', icon: '💬' },
    { name: 'Settings', href: '/admin/settings', icon: '⚙️' },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === href;
    }
    if (href === '/staff/dashboard') {
      return pathname?.startsWith('/staff');
    }
    return pathname?.startsWith(href);
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/admin" className="text-xl sm:text-2xl font-bold text-gray-900">
              🏢 Admin
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navItems.slice(0, 6).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link
              href="/dashboard"
              className="hidden sm:block text-sm text-gray-600 hover:text-gray-900"
            >
              👤 Instructor View
            </Link>
            <a
              href="/api/auth/signout"
              className="text-sm text-red-600 hover:text-red-800"
            >
              Sign Out
            </a>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-3">
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              >
                👤 Switch to Instructor View
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
