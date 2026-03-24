'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
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

  const markOneRead = async (id: string) => {
    await markRead(id);
    setOpen(false);
  };

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
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-gray-900">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">Mark all read</button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No notifications yet</p>
            ) : (
              notifications.map(n => (
                <Link
                  key={n.id}
                  href={n.link || '/admin'}
                  onClick={() => markOneRead(n.id)}
                  className={`flex gap-3 items-start px-4 py-3 hover:bg-gray-50 transition ${!n.isRead ? 'bg-blue-50' : ''}`}
                >
                  <span className="text-lg flex-shrink-0">{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-500 truncate">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
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

  const toggleDropdown = (groupName: string) => {
    setOpenDropdown(openDropdown === groupName ? null : groupName);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navGroups = [
    {
      name: 'Overview',
      icon: '📊',
      href: '/admin',
      items: []
    },
    {
      name: 'Users',
      icon: '�',
      items: [
        { name: 'Instructors', href: '/admin/instructors', icon: '�' },
        { name: 'Clients', href: '/admin/clients', icon: '�' },
        { name: 'Staff Tasks', href: '/staff/dashboard', icon: '�' },
      ]
    },
    {
      name: 'Finance',
      icon: '💰',
      items: [
        { name: 'Credits', href: '/admin/credits', icon: '💳' },
        { name: 'Revenue', href: '/admin/revenue', icon: '💰' },
        { name: 'Payouts', href: '/admin/payouts', icon: '💸' },
        { name: 'Pricing', href: '/admin/pricing', icon: '🏷️' },
      ]
    },
    {
      name: 'Operations',
      icon: '📋',
      items: [
        { name: 'Documents', href: '/admin/documents', icon: '📄' },
        { name: 'Bookings', href: '/admin/bookings', icon: '📅' },
        { name: 'Audit Log', href: '/admin/audit-log', icon: '🔍' },
      ]
    },
    {
      name: 'Engagement',
      icon: '⭐',
      items: [
        { name: 'Reviews', href: '/admin/reviews', icon: '⭐' },
        { name: 'Support', href: '/admin/support', icon: '💬' },
      ]
    },
    {
      name: 'Settings',
      icon: '⚙️',
      href: '/admin/settings',
      items: []
    },
  ];

  // Flatten for mobile menu
  const allNavItems = navGroups.flatMap(group => 
    group.items.length > 0 ? group.items : [{ name: group.name, href: group.href!, icon: group.icon }]
  );

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === href;
    }
    if (href === '/staff/dashboard') {
      return pathname?.startsWith('/staff');
    }
    return pathname?.startsWith(href);
  };

  const isGroupActive = (group: typeof navGroups[0]) => {
    if (group.href) {
      return isActive(group.href);
    }
    return group.items.some(item => isActive(item.href));
  };

  return (
    <nav className="bg-white shadow-sm border-b" ref={navRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/admin" className="text-xl sm:text-2xl font-bold text-gray-900">
              🏢 Admin
            </Link>
          </div>

          {/* Desktop Navigation with Dropdowns */}
          <div className="hidden md:flex items-center space-x-1">
            {navGroups.map((group) => (
              <div key={group.name} className="relative">
                {group.items.length === 0 ? (
                  // Direct link (no dropdown)
                  <Link
                    href={group.href!}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(group.href!)
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <span className="mr-1">{group.icon}</span>
                    {group.name}
                  </Link>
                ) : (
                  // Dropdown menu
                  <>
                    <button
                      onClick={() => toggleDropdown(group.name)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                        isGroupActive(group)
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <span className="mr-1">{group.icon}</span>
                      {group.name}
                      <svg 
                        className={`ml-1 h-4 w-4 transition-transform ${openDropdown === group.name ? 'rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {openDropdown === group.name && (
                      <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpenDropdown(null)}
                            className={`block px-4 py-2 text-sm transition-colors ${
                              isActive(item.href)
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <span className="mr-2">{item.icon}</span>
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

          <div className="flex items-center space-x-2 sm:space-x-4">
            <NotificationBell />
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
              {allNavItems.map((item) => (
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
