import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardNav from '@/components/DashboardNav'
import MobileBottomNav from '@/components/instructor/MobileBottomNav'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const role = session.user.role

  if (role === 'CLIENT') {
    redirect('/client-dashboard')
  }

  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    redirect('/admin')
  }

  // INSTRUCTOR (and any future roles) — render dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />
      <div className="pb-20 md:pb-0">
        {children}
      </div>
      <MobileBottomNav />
    </div>
  )
}

