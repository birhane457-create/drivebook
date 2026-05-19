import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardNav from '@/components/DashboardNav'
import MobileBottomNav from '@/components/instructor/MobileBottomNav'
import ReadOnlyBanner from '@/components/instructor/ReadOnlyBanner'
import PendingApprovalBanner from '@/components/instructor/PendingApprovalBanner'
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
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />
      {/* Pending approval banner — shown when not yet approved */}
      {approvalStatus !== 'APPROVED' && (
        <PendingApprovalBanner approvalStatus={approvalStatus} />
      )}
      {/* Read-only banner — shown when subscription is inactive (only for approved instructors) */}
      {approvalStatus === 'APPROVED' && isReadOnly && (
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
