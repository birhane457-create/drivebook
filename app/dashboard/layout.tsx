import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
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

  // Check subscription access — determines if read-only banner is shown
  const access = await checkSubscriptionAccess(session.user.id)
  const isReadOnly = access.valid && (access as any).readOnly === true

  // Check approval status — determines if pending approval banner is shown
  const instructor = session.user.instructorId
    ? await prisma.instructor.findUnique({
        where: { id: session.user.instructorId },
        select: { approvalStatus: true }
      })
    : null
  const approvalStatus = instructor?.approvalStatus ?? 'PENDING'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      {/* Silently syncs Stripe subscription after portal return or payment */}
      <SubscriptionSyncTrigger />
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),transparent_20%),radial-gradient(circle_at_top_right,_rgba(124,58,237,0.16),transparent_16%)]" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-10">
          {approvalStatus !== 'APPROVED' && (
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
