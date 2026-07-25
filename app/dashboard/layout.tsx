import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Suspense } from 'react'
import DashboardNav from '@/components/DashboardNav'
import MobileBottomNav from '@/components/instructor/MobileBottomNav'
import ReadOnlyBanner from '@/components/instructor/ReadOnlyBanner'
import PendingApprovalBanner from '@/components/instructor/PendingApprovalBanner'
import SubscriptionSyncTrigger from '@/components/instructor/SubscriptionSyncTrigger'
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

  // Run subscription check and approval status lookup in parallel — both are
  // independent DB queries. Avoids sequential waterfall on every page load.
  const [access, approvalStatusResult] = await Promise.all([
    checkSubscriptionAccess(session.user.id),
    session.user.instructorId
      ? prisma.instructor
          .findUnique({
            where: { id: session.user.instructorId },
            select: { approvalStatus: true },
          })
          .catch((error: unknown) => {
            console.error('Dashboard approval status lookup failed:', error)
            return null
          })
      : Promise.resolve(null),
  ])

  const isReadOnly = access.valid && (access as any).readOnly === true
  // Distinguish between "genuinely PENDING" and "DB lookup failed".
  // Fallback is null — renders no banner rather than a misleading PENDING banner.
  const approvalStatus = approvalStatusResult?.approvalStatus ?? null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      {/* Silently syncs Stripe subscription after portal return or payment */}
      <Suspense fallback={null}>
        <SubscriptionSyncTrigger />
      </Suspense>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),transparent_20%),radial-gradient(circle_at_top_right,_rgba(124,58,237,0.16),transparent_16%)]" />
        <div className="relative z-10 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 pb-24 sm:py-6 lg:pb-10">
          {approvalStatus !== null && approvalStatus !== 'APPROVED' && (
            <PendingApprovalBanner approvalStatus={approvalStatus} />
          )}
          {approvalStatus === 'APPROVED' && isReadOnly && (
            <ReadOnlyBanner
              reason={(access as any).reason}
              status={(access as any).status}
            />
          )}
          <div className="relative z-10">
            {children}
          </div>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  )
}
