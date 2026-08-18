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
  let dataUnavailable = false
  let errorDetails: string | null = null

  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Use Promise.allSettled to allow partial failures
    const results = await Promise.allSettled([
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
      }),
      (prisma as any).stripeDispute.count({
        where: { status: { notIn: ['won', 'lost', 'charge_refunded', 'warning_closed'] } },
      }),
    ])

    // Process results - use defaults for failed queries but track failures
    const failedQueries: string[] = []
    
    if (results[0].status === 'fulfilled') totalInstructors = results[0].value
    else failedQueries.push('instructors count')
    
    if (results[1].status === 'fulfilled') pendingInstructors = results[1].value
    else failedQueries.push('pending instructors')
    
    if (results[2].status === 'fulfilled') suspendedInstructors = results[2].value
    else failedQueries.push('suspended instructors')
    
    if (results[3].status === 'fulfilled') totalBookings = results[3].value
    else failedQueries.push('total bookings')
    
    if (results[4].status === 'fulfilled') bookingsThisMonth = results[4].value
    else failedQueries.push('monthly bookings')
    
    if (results[5].status === 'fulfilled') totalClients = results[5].value
    else failedQueries.push('clients count')
    
    if (results[6].status === 'fulfilled') recentBookings = results[6].value
    else failedQueries.push('recent bookings')
    
    if (results[7].status === 'fulfilled') {
      subMap = results[7].value.reduce((acc: Record<string, number>, row: any) => {
        acc[row.subscriptionTier] = row._count.id
        return acc
      }, {})
    } else failedQueries.push('subscription breakdown')
    
    if (results[8].status === 'fulfilled') platformRevenueThisMonth = results[8].value._sum?.platformFee ?? 0
    else failedQueries.push('revenue')
    
    if (results[9].status === 'fulfilled') endedConfirmed = results[9].value
    else failedQueries.push('ended bookings')
    
    if (results[10].status === 'fulfilled') expiringDocs = results[10].value
    else failedQueries.push('expiring documents')
    
    if (results[11].status === 'fulfilled') unverifiedABNs = results[11].value
    else failedQueries.push('unverified ABNs')
    
    if (results[12].status === 'fulfilled') openDisputes = results[12].value
    else failedQueries.push('disputes')

    // If any queries failed, mark data as partially unavailable
    if (failedQueries.length > 0) {
      dataUnavailable = true
      errorDetails = `Failed to load: ${failedQueries.join(', ')}`
      console.error('Admin dashboard partial failure:', errorDetails)
    }
  } catch (err) {
    console.error('Admin dashboard critical error:', err)
    dataUnavailable = true
    errorDetails = err instanceof Error ? err.message : 'Unknown error'
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
          dataUnavailable={dataUnavailable}
          errorDetails={errorDetails}
        />
      </div>
    </div>
  )
}
