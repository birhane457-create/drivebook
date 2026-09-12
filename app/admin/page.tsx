import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminNav from '@/components/admin/AdminNav'
import AdminDashboardTabs from '@/components/admin/AdminDashboardTabs'
import { getPlatformStats } from '@/lib/admin/platform-stats'

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions)
  if (!session || (session!.user!.role !== 'ADMIN' && session!.user!.role !== 'SUPER_ADMIN')) {
    redirect('/login')
  }

  // Use shared stats function
  const stats = await getPlatformStats()

  let recentBookings: any[] = []
  let endedConfirmed = 0, expiringDocs = 0, unverifiedABNs = 0, openDisputes = 0
  let dataUnavailable = false

  try {
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [rb, ec, ed, ua] = await Promise.all([
      // Recent bookings
      prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { customer: true, provider: true },
      }).catch(() => []),
      // Alert triggers
      prisma.booking.count({
        where: {
          status: 'CONFIRMED',
          endTime: { lt: now },
        },
      }).catch(() => 0),
      (prisma as any).drivingProviderProfile.count({
        where: {
          OR: [
            { licenseExpiry:    { gte: now, lte: thirtyDaysFromNow } },
            { insuranceExpiry:  { gte: now, lte: thirtyDaysFromNow } },
            { policeCheckExpiry:{ gte: now, lte: thirtyDaysFromNow } },
            { wwcCheckExpiry:   { gte: now, lte: thirtyDaysFromNow } },
          ],
        },
      }).catch(() => 0),
      prisma.provider.count({
        where: { approvalStatus: 'APPROVED', abnVerified: false, abn: { not: null } },
      }).catch(() => 0),
    ])

    recentBookings = rb
    endedConfirmed = ec; expiringDocs = ed; unverifiedABNs = ua

    openDisputes = await (prisma as any).stripeDispute.count({
      where: { status: { notIn: ['won', 'lost', 'charge_refunded', 'warning_closed'] } },
    }).catch(() => 0)
  } catch (err) {
    console.error('Admin dashboard query error:', err)
    dataUnavailable = true
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        <AdminDashboardTabs
          totalInstructors={stats.instructors.total}
          approvedInstructors={stats.instructors.approved}
          pendingInstructors={stats.instructors.pending}
          suspendedInstructors={stats.instructors.suspended}
          totalBookings={stats.bookings.total}
          bookingsThisMonth={stats.bookings.thisMonth}
          totalClients={stats.clients.total}
          platformRevenueThisMonth={stats.revenue.platformFeeThisMonth}
          subMap={stats.subscriptions}
          endedConfirmed={endedConfirmed}
          expiringDocs={expiringDocs}
          unverifiedABNs={unverifiedABNs}
          openDisputes={openDisputes}
          recentBookings={recentBookings}
          dataUnavailable={dataUnavailable}
        />
      </div>
    </div>
  )
}
