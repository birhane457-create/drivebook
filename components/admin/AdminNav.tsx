'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminNav() {
  const pathname = usePathname();

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
          <div className="flex items-center space-x-8">
            <Link href="/admin" className="text-2xl font-bold text-gray-900">
              🏢 Admin Dashboard
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-4">
              {navItems.map((item) => (
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
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              👤 Instructor View
            </Link>
            <a
              href="/api/auth/signout"
              className="text-sm text-red-600 hover:text-red-800"
            >
              Sign Out
            </a>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3">
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1 rounded-md text-xs font-medium ${
                  isActive(item.href)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {item.icon} {item.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
