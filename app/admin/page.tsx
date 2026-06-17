import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminNav from '@/components/admin/AdminNav'
import AdminDashboardTabs from '@/components/admin/AdminDashboardTabs'

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login')
  }

  let totalInstructors = 0, pendingInstructors = 0, suspendedInstructors = 0
  let totalBookings = 0, bookingsThisMonth = 0, totalClients = 0
  let recentBookings: any[] = []
  let subMap: Record<string, number> = {}
  let platformRevenueThisMonth = 0
  let endedConfirmed = 0, expiringDocs = 0, unverifiedABNs = 0, openDisputes = 0

  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [ti, pi, si, tb, bm, tc, rb, sd, rev, ec, ed, ua] = await Promise.all([
      prisma.instructor.count(),
      prisma.instructor.count({ where: { approvalStatus: 'PENDING' } }),
      prisma.instructor.count({ where: { approvalStatus: 'SUSPENDED' } }),
      // Count PLATFORM bookings only (exclude offline)
      prisma.booking.count({ where: { source: 'platform', deletedAt: null } as any }),
      // Count PLATFORM bookings this month only (exclude offline)
      prisma.booking.count({ where: { source: 'platform', createdAt: { gte: monthStart }, deletedAt: null } as any }),
      prisma.client.count(),
      prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: { source: 'platform', deletedAt: null } as any,
        include: {
          instructor: { select: { name: true } },
          client: { select: { name: true, phone: true } },
        },
      }),
      prisma.instructor.groupBy({ by: ['subscriptionTier'], _count: { id: true } }),
      (prisma as any).transaction.aggregate({
        where: { createdAt: { gte: monthStart }, status: 'SETTLED' },
        _sum: { platformFee: true },
      }).catch(() => ({ _sum: { platformFee: 0 } })),
      prisma.booking.count({
        where: { status: 'CONFIRMED', endTime: { lt: now }, deletedAt: null } as any,
      }).catch(() => 0),
      prisma.instructor.count({
        where: {
          approvalStatus: 'APPROVED',
          OR: [
            { licenseExpiry: { gte: now, lte: thirtyDaysFromNow } },
            { insuranceExpiry: { gte: now, lte: thirtyDaysFromNow } },
            { policeCheckExpiry: { gte: now, lte: thirtyDaysFromNow } },
            { wwcCheckExpiry: { gte: now, lte: thirtyDaysFromNow } },
          ],
        },
      }).catch(() => 0),
      prisma.instructor.count({
        where: { approvalStatus: 'APPROVED', abnVerified: false, abn: { not: null } },
      }).catch(() => 0),
    ])

    totalInstructors = ti; pendingInstructors = pi; suspendedInstructors = si
    totalBookings = tb; bookingsThisMonth = bm; totalClients = tc
    recentBookings = rb
    subMap = sd.reduce((acc: Record<string, number>, row: any) => {
      acc[row.subscriptionTier] = row._count.id; return acc
    }, {})
    platformRevenueThisMonth = rev._sum?.platformFee ?? 0
    endedConfirmed = ec; expiringDocs = ed; unverifiedABNs = ua

    openDisputes = await (prisma as any).stripeDispute.count({
      where: { status: { notIn: ['won', 'lost', 'charge_refunded', 'warning_closed'] } },
    }).catch(() => 0)
  } catch (err) {
    console.error('Admin dashboard query error:', err)
  }

  const approvedInstructors = totalInstructors - pendingInstructors - suspendedInstructors

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Platform Overview</h1>
          <p className="text-sm text-slate-500 mt-1">DriveBook admin command centre</p>
        </div>

        <AdminDashboardTabs
          totalInstructors={totalInstructors}
          approvedInstructors={approvedInstructors}
          pendingInstructors={pendingInstructors}
          suspendedInstructors={suspendedInstructors}
          totalBookings={totalBookings}
          bookingsThisMonth={bookingsThisMonth}
          totalClients={totalClients}
          platformRevenueThisMonth={platformRevenueThisMonth}
          subMap={subMap}
          endedConfirmed={endedConfirmed}
          expiringDocs={expiringDocs}
          unverifiedABNs={unverifiedABNs}
          openDisputes={openDisputes}
          recentBookings={recentBookings}
        />
      </div>
    </div>
  )
}
