'use client';

import { SessionProvider } from 'next-auth/react';
import { BookingProvider } from '@/lib/contexts/BookingContext';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <BookingProvider>
        {children}
      </BookingProvider>
    </SessionProvider>
  );
}
