'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useBookLessonHref } from '@/lib/hooks/useBookLessonHref';

export default function ClientMobileBottomNav() {
  const pathname = usePathname();
  const bookLessonHref = useBookLessonHref();
  const [pendingReviews, setPendingReviews] = useState(0);

  useEffect(() => {
    fetch('/api/client/pending-reviews')
      .then(r => r.ok ? r.json() : [])
      .then(data => setPendingReviews(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === '/client-dashboard') return pathname === href;
    if (href.startsWith('/client-dashboard/book-lesson')) return pathname?.startsWith('/client-dashboard/book-lesson');
    return pathname?.startsWith(href);
  };

  const navItems = [
    {
      name: 'Book',
      href: bookLessonHref,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
    },
    {
      name: 'Bookings',
      href: '/client-dashboard/bookings',
      badge: pendingReviews,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: 'Wallet',
      href: '/client-dashboard/wallet',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      name: 'Progress',
      href: '/client-dashboard/progress',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      name: 'Profile',
      href: '/client-dashboard/profile',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 shadow-2xl lg:hidden z-50">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active ? 'text-sky-400' : 'text-slate-300 hover:text-white'
              }`}
            >
              <div className={`relative flex items-center justify-center ${active ? 'scale-105' : ''} transition-transform`}>
                {item.icon}
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 ${active ? 'font-semibold' : ''}`}>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
