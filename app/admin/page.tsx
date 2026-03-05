import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  // Fetch platform statistics
  const [
    totalInstructors,
    pendingInstructors,
    activeInstructors,
    totalBookings,
    totalClients,
    recentBookings,
    subscriptionStats,
  ] = await Promise.all([
    prisma.instructor.count(),
    prisma.instructor.count({ where: { approvalStatus: 'PENDING' } as any }),
    prisma.instructor.count({ where: { approvalStatus: 'APPROVED', isActive: true } as any }),
    prisma.booking.count(),
    0, // Client count not available in this schema
    prisma.booking.findMany({
      take: 10,
      orderBy: { id: 'desc' },
      include: {
        instructor: { select: { name: true } },
        client: { select: { name: true, phone: true } },
      },
    }),
    Promise.resolve({ pro: 0, business: 0, trial: 0, pastDue: 0 }), // Subscription stats not available
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Platform Overview</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Instructors</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{totalInstructors}</p>
              </div>
              <div className="hidden sm:block ml-4">
                <div className="bg-blue-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-gray-500">{activeInstructors} active</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-600">{pendingInstructors}</p>
              </div>
              <div className="hidden sm:block ml-4">
                <div className="bg-orange-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <a href="/admin/instructors?status=pending" className="mt-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800">
              Review →
            </a>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Bookings</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{totalBookings}</p>
              </div>
              <div className="hidden sm:block ml-4">
                <div className="bg-green-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <a href="/admin/bookings" className="mt-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800">
              View all →
            </a>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Clients</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{totalClients}</p>
              </div>
              <div className="hidden sm:block ml-4">
                <div className="bg-purple-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Stats */}
        <div className="bg-white rounded-lg shadow mb-6 sm:mb-8">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Subscription Overview</h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">PRO Active</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{subscriptionStats.pro}</p>
                <p className="text-xs text-gray-500 mt-1">$29/mo</p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">BUSINESS Active</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-600">{subscriptionStats.business}</p>
                <p className="text-xs text-gray-500 mt-1">$59/mo</p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Trial</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{subscriptionStats.trial}</p>
                <p className="text-xs text-gray-500 mt-1">14 days</p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Past Due</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{subscriptionStats.pastDue}</p>
                <p className="text-xs text-gray-500 mt-1">Action needed</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Monthly Revenue: <span className="font-semibold text-gray-900">
                  ${((subscriptionStats.pro * 29) + (subscriptionStats.business * 59)).toFixed(2)}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Recent Bookings</h2>
            <a href="/admin/bookings" className="text-sm text-blue-600 hover:text-blue-800">View all</a>
          </div>
          {/* Mobile: Card view */}
          <div className="block sm:hidden">
            {recentBookings.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No bookings yet
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {recentBookings.map((booking) => (
                  <div key={booking.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {booking.client?.name || booking.clientName || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {booking.client?.phone || booking.clientPhone || 'N/A'}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        (booking as any).status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                        (booking as any).status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        (booking as any).status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {(booking as any).status || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{booking.instructor?.name || 'N/A'}</span>
                      <span className="font-medium text-gray-900">{booking.date} {booking.time}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Duration: {booking.duration} min
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Desktop: Table view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentBookings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No bookings yet
                    </td>
                  </tr>
                ) : (
                  recentBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {booking.client?.name || booking.clientName || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {booking.client?.phone || booking.clientPhone || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.instructor?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {booking.startTime ? new Date(booking.startTime).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          (booking as any).status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                          (booking as any).status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          (booking as any).status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {(booking as any).status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${((booking as any).price || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
