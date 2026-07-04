import React from 'react';
import { AuthProvider } from '@/lib/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';

/**
 * AppProviders — composes all global providers in the correct order.
 * Wrap the app root once; use individual contexts via hooks inside.
 *
 * Provider order (outer → inner):
 *   AuthProvider        — auth state, current user, app settings
 *   QueryClientProvider — React Query cache for data fetching
 *
 * Usage in App.jsx:
 *   <AppProviders><Router>...</Router></AppProviders>
 */
export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        {children}
      </QueryClientProvider>
    </AuthProvider>
  );
}