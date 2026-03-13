'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface BrandingConfig {
  primaryColor: string;
  logo: string;
  businessName: string;
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [branding, setBranding] = useState<BrandingConfig | null>(null);

  // Detect if running in Capacitor
  const isMobile = typeof window !== 'undefined' && 
    (window as any).Capacitor !== undefined;

  // Fetch branding if user is viewing an instructor's content
  useEffect(() => {
    const fetchBranding = async () => {
      // Extract instructorId from URL if present
      const instructorIdMatch = pathname.match(/\/book\/([^\/]+)/);
      const instructorId = instructorIdMatch?.[1];

      if (instructorId) {
        try {
          const response = await fetch(`/api/branding?instructorId=${instructorId}`);
          if (response.ok) {
            const data = await response.json();
            setBranding(data);
            applyBranding(data);
          }
        } catch (error) {
          console.error('Failed to fetch branding:', error);
        }
      }
    };

    if (isMobile) {
      fetchBranding();
    }
  }, [pathname, isMobile]);

  // Apply branding dynamically
  const applyBranding = (config: BrandingConfig) => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--primary-color', config.primaryColor);
    }
  };

  // If not mobile, render normally
  if (!isMobile) {
    return <>{children}</>;
  }

  // Mobile-specific rendering with role-based navigation
  return (
    <div className="mobile-app">
      {/* Add mobile-specific header/navigation here if needed */}
      {branding && (
        <div className="mobile-branding" style={{ display: 'none' }}>
          {/* Branding metadata for debugging */}
          <span data-business-name={branding.businessName} />
          <span data-primary-color={branding.primaryColor} />
        </div>
      )}
      
      <main className="mobile-content">
        {children}
      </main>

      {/* Role-based bottom navigation */}
      {session && (
        <MobileNavigation role={session.user.role} />
      )}
    </div>
  );
}

function MobileNavigation({ role }: { role: string }) {
  const pathname = usePathname();

  if (role === 'INSTRUCTOR') {
    return (
      <nav className="mobile-nav">
        <a href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>
          Dashboard
        </a>
        <a href="/dashboard/bookings" className={pathname.includes('/bookings') ? 'active' : ''}>
          Bookings
        </a>
        <a href="/dashboard/earnings" className={pathname.includes('/earnings') ? 'active' : ''}>
          Earnings
        </a>
        <a href="/dashboard/settings" className={pathname.includes('/settings') ? 'active' : ''}>
          Settings
        </a>
      </nav>
    );
  }

  if (role === 'CLIENT') {
    return (
      <nav className="mobile-nav">
        <a href="/client/bookings" className={pathname.includes('/bookings') ? 'active' : ''}>
          My Lessons
        </a>
        <a href="/book" className={pathname === '/book' ? 'active' : ''}>
          Book
        </a>
        <a href="/client/wallet" className={pathname.includes('/wallet') ? 'active' : ''}>
          Wallet
        </a>
        <a href="/client/profile" className={pathname.includes('/profile') ? 'active' : ''}>
          Profile
        </a>
      </nav>
    );
  }

  return null;
}
