import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardNav from '@/components/DashboardNav'
import MobileBottomNav from '@/components/instructor/MobileBottomNav'
import ReadOnlyBanner from '@/components/instructor/ReadOnlyBanner'
import { checkSubscriptionAccess } from '@/lib/middleware/subscriptionValidation'

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

  // Check subscription access — determines if read-only banner is shown
  // We never hard-block here; instructors always retain read access to their data.
  const access = await checkSubscriptionAccess(session.user.id)
  const isReadOnly = access.valid && (access as any).readOnly === true

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />
      {isReadOnly && (
        <ReadOnlyBanner
          reason={(access as any).reason}
          status={(access as any).status}
        />
      )}
      <div className="pb-20 md:pb-0">
        {children}
      </div>
      <MobileBottomNav />
    </div>
  )
}
