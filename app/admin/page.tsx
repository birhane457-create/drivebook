import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AdminNav from '@/components/admin/AdminNav';
import Link from 'next/link';

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  // All DB queries wrapped in try/catch — dashboard must never crash
  let totalInstructors = 0, pendingInstructors = 0, suspendedInstructors = 0;
  let totalBookings = 0, bookingsThisMonth = 0, totalClients = 0;
  let recentBookings: any[] = [];
  let subMap: Record<string, number> = {};
  let platformRevenueThisMonth = 0;
  let endedConfirmed = 0, expiringDocs = 0, unverifiedABNs = 0;
  let openDisputes = 0;

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      ti, pi, si, tb, bm, tc, rb, sd, rev, ec, ed, ua,
    ] = await Promise.all([
      prisma.instructor.count(),
      prisma.instructor.count({ where: { approvalStatus: 'PENDING' } }),
      prisma.instructor.count({ where: { approvalStatus: 'SUSPENDED' } }),
      prisma.booking.count({ where: { deletedAt: null } as any }),
      prisma.booking.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } as any }),
      prisma.client.count(),
      prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: { deletedAt: null } as any,
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
    ]);

    totalInstructors = ti; pendingInstructors = pi; suspendedInstructors = si;
    totalBookings = tb; bookingsThisMonth = bm; totalClients = tc;
    recentBookings = rb;
    subMap = sd.reduce((acc: Record<string, number>, row: any) => {
      acc[row.subscriptionTier] = row._count.id; return acc;
    }, {});
    platformRevenueThisMonth = rev._sum?.platformFee ?? 0;
    endedConfirmed = ec; expiringDocs = ed; unverifiedABNs = ua;

    // Open disputes — non-fatal if migration hasn't run yet
    openDisputes = await (prisma as any).stripeDispute.count({
      where: { status: { notIn: ['won', 'lost', 'charge_refunded', 'warning_closed'] } },
    }).catch(() => 0);
  } catch (err) {
    console.error('Admin dashboard query error:', err);
    // Continue with zero values — page still renders
  }

  const approvedInstructors = totalInstructors - pendingInstructors - suspendedInstructors;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">Platform Overview</h1>

        {/* Pending alert */}
        {pendingInstructors > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-amber-800 font-medium text-sm">
              {pendingInstructors} instructor{pendingInstructors > 1 ? 's' : ''} awaiting approval
            </p>
            <Link href="/admin/instructors?status=PENDING" className="text-amber-700 underline text-sm font-semibold shrink-0 ml-3">
              Review now →
            </Link>
          </div>
        )}

        {/* Action alerts */}
        {(endedConfirmed > 0 || expiringDocs > 0 || unverifiedABNs > 0) && (
          <div className="mb-6 space-y-2">
            {endedConfirmed > 0 && (
              <div className="bg-purple-50 border border-purple-300 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-purple-800 font-medium text-sm">
                  🕐 {endedConfirmed} lesson{endedConfirmed > 1 ? 's' : ''} ended but still CONFIRMED — mark complete to release payouts
                </p>
                <Link href="/admin/bookings" className="text-purple-700 underline text-sm font-semibold shrink-0 ml-3">
                  Go to Bookings →
                </Link>
              </div>
            )}
            {expiringDocs > 0 && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-yellow-800 font-medium text-sm">
                  ⚠️ {expiringDocs} instructor{expiringDocs > 1 ? 's have' : ' has'} documents expiring within 30 days
                </p>
                <Link href="/admin/documents" className="text-yellow-700 underline text-sm font-semibold shrink-0 ml-3">
                  Review Docs →
                </Link>
              </div>
            )}
            {unverifiedABNs > 0 && (
              <div className="bg-orange-50 border border-orange-300 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-orange-800 font-medium text-sm">
                  🔴 {unverifiedABNs} approved instructor{unverifiedABNs > 1 ? 's have' : ' has'} unverified ABN — 47% withholding applies
                </p>
                <Link href="/admin/instructors" className="text-orange-700 underline text-sm font-semibold shrink-0 ml-3">
                  Verify ABNs →
                </Link>
              </div>
            )}
            {openDisputes > 0 && (
              <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-red-800 font-medium text-sm">
                  ⚠️ {openDisputes} open chargeback{openDisputes > 1 ? 's' : ''} — instructor payout{openDisputes > 1 ? 's' : ''} frozen pending resolution
                </p>
                <Link href="/admin/disputes" className="text-red-700 underline text-sm font-semibold shrink-0 ml-3">
                  Review Disputes →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:p-6">
            <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Instructors</p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900">{totalInstructors}</p>
            <p className="text-xs text-gray-400 mt-1">{approvedInstructors} approved · {pendingInstructors} pending</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:p-6">
            <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Bookings</p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900">{totalBookings}</p>
            <p className="text-xs text-gray-400 mt-1">+{bookingsThisMonth} this month</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:p-6">
            <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Students</p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900">{totalClients}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:p-6">
            <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Revenue (MTD)</p>
            <p className="text-2xl lg:text-3xl font-bold text-green-600">${platformRevenueThisMonth.toFixed(0)}</p>
            <p className="text-xs text-gray-400 mt-1">Platform fees collected</p>
          </div>
        </div>

        {/* Subscription Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Subscription Breakdown</h2>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { tier: 'BASIC',    label: 'Basic',    price: '$29/mo',  color: 'bg-gray-50 text-gray-700' },
              { tier: 'PRO',      label: 'Pro',      price: '$79/mo',  color: 'bg-blue-50 text-blue-700' },
              { tier: 'STUDIO',   label: 'Studio',   price: '$129/mo', color: 'bg-indigo-50 text-indigo-700' },
              { tier: 'BUSINESS', label: 'Business', price: '$199/mo', color: 'bg-purple-50 text-purple-700' },
            ].map(({ tier, label, price, color }) => (
              <div key={tier} className={`rounded-lg p-4 text-center ${color}`}>
                <p className="text-xs font-medium mb-1">{label}</p>
                <p className="text-2xl font-bold">{subMap[tier] ?? 0}</p>
                <p className="text-xs opacity-70 mt-1">{price}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { href: '/admin/instructors?status=PENDING', label: 'Pending Approvals', count: pendingInstructors, color: 'border-amber-300 bg-amber-50 text-amber-800' },
            { href: '/admin/payouts', label: 'Process Payouts', count: null, color: 'border-green-300 bg-green-50 text-green-800' },
            { href: '/admin/bookings', label: 'All Bookings', count: totalBookings, color: 'border-blue-300 bg-blue-50 text-blue-800' },
            { href: '/admin/support', label: 'Support Centre', count: null, color: 'border-purple-300 bg-purple-50 text-purple-800' },
          ].map(({ href, label, count, color }) => (
            <Link key={href} href={href} className={`border rounded-xl p-4 text-center hover:opacity-80 transition ${color}`}>
              <p className="text-sm font-semibold">{label}</p>
              {count !== null && <p className="text-xl font-bold mt-1">{count}</p>}
            </Link>
          ))}
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-base font-semibold text-gray-900">Recent Bookings</h2>
            <Link href="/admin/bookings" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentBookings.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No bookings yet</td></tr>
                ) : recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{b.client?.name || (b as any).clientName || '—'}</p>
                      <p className="text-xs text-gray-400">{b.client?.phone || (b as any).clientPhone || ''}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{b.instructor?.name || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {b.startTime ? new Date(b.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        (b as any).status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                        (b as any).status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
                        (b as any).status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        (b as any).status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{(b as any).status}</span>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">${((b as any).price || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
