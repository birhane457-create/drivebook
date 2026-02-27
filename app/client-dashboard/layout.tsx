'use client'

import { SessionProvider } from 'next-auth/react'
import ClientDashboardNav from '@/components/ClientDashboardNav'

export default function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50">
        <ClientDashboardNav />
        <main>{children}</main>
      </div>
    </SessionProvider>
  )
}
