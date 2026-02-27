import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Calendar, Users, DollarSign, Car, TrendingUp, Clock, Wallet, Package, CreditCard } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // Client dashboard
  if (session.user.role === 'CLIENT') {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        wallet: {
          include: {
            transactions: {
              take: 5,
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    })

    if (!user?.wallet) {
      redirect('/login')
    }

    const upcomingBookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
        status: 'CONFIRMED',
        startTime: { gte: new Date() }
      },
      take: 5,
      orderBy: { startTime: 'asc' },
      include: { instructor: true }
    })

    const completedBookings = await prisma.booking.count({
      where: {
        userId: user.id,
        status: 'COMPLETED'
      }
    })

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome back, {user.name}!</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your lessons and account.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Credits Remaining</p>
                <p className="text-3xl font-bold">${user.wallet.creditsRemaining?.toFixed(2) || '0.00'}</p>
              </div>
              <Wallet className="h-12 w-12 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Spent</p>
                <p className="text-3xl font-bold">${user.wallet.totalSpent?.toFixed(2) || '0.00'}</p>
              </div>
              <DollarSign className="h-12 w-12 text-red-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Upcoming Lessons</p>
                <p className="text-3xl font-bold">{upcomingBookings.length}</p>
              </div>
              <Calendar className="h-12 w-12 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Completed</p>
                <p className="text-3xl font-bold">{completedBookings}</p>
              </div>
              <TrendingUp className="h-12 w-12 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Upcoming Lessons</h2>
              <Link href="/my-bookings" className="text-blue-600 hover:text-blue-800 text-sm">
                View All
              </Link>
            </div>
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No upcoming lessons scheduled</p>
                <Link href="/book" className="text-blue-600 hover:underline text-sm">
                  Book a lesson
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="border-l-4 border-blue-600 pl-4 py-2 hover:bg-gray-50 transition">
                    <p className="font-semibold">{booking.instructor.name}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(booking.startTime).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-sm text-gray-500">{booking.duration} hours</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Quick Stats</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <p className="text-gray-600">Total Paid</p>
                <p className="font-semibold">${user.wallet.totalPaid?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <p className="text-gray-600">Total Spent</p>
                <p className="font-semibold">${user.wallet.totalSpent?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                <p className="text-gray-600">Credits Available</p>
                <p className="font-bold text-blue-600">${user.wallet.creditsRemaining?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow p-4 sm:p-6 text-white">
          <h3 className="text-lg sm:text-xl font-bold mb-2">Quick Actions</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4">
            <Link 
              href="/book"
              className="bg-white/20 hover:bg-white/30 p-4 rounded-lg transition"
            >
              <Calendar className="h-6 w-6 mb-2" />
              <p className="font-semibold text-sm">Book Lesson</p>
            </Link>
            <Link 
              href="/dashboard/wallet"
              className="bg-white/20 hover:bg-white/30 p-4 rounded-lg transition"
            >
              <Wallet className="h-6 w-6 mb-2" />
              <p className="font-semibold text-sm">View Wallet</p>
            </Link>
            <Link 
              href="/dashboard/packages"
              className="bg-white/20 hover:bg-white/30 p-4 rounded-lg transition"
            >
              <Package className="h-6 w-6 mb-2" />
              <p className="font-semibold text-sm">My Packages</p>
            </Link>
            <Link 
              href="/dashboard/credits/add-funds"
              className="bg-white/20 hover:bg-white/30 p-4 rounded-lg transition"
            >
              <CreditCard className="h-6 w-6 mb-2" />
              <p className="font-semibold text-sm">Add Funds</p>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Instructor dashboard
  if (!session.user.instructorId) {
    redirect('/login')
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  
  // Calculate last month for comparison
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  
  // Calculate days in each month for daily average
  const daysInCurrentMonth = endOfMonth.getDate()
  const daysElapsedThisMonth = now.getDate()
  const daysInLastMonth = endOfLastMonth.getDate()

  const [instructor, monthlyBookings, totalRevenue, lastMonthRevenue, clientsWithPackages] = await Promise.all([
    prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      include: {
        bookings: {
          where: {
            status: 'CONFIRMED', // ✅ Only show CONFIRMED (paid) bookings
            startTime: {
              gte: now
            }
          },
          take: 5,
          orderBy: {
            startTime: 'asc'
          },
          include: {
            client: true
          }
        },
        clients: {
          take: 5,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    }),
    prisma.booking.count({
      where: {
        instructorId: session.user.instructorId,
        status: { in: ['CONFIRMED', 'COMPLETED'] }, // ✅ Exclude PENDING (failed payments)
        startTime: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    }),
    prisma.booking.aggregate({
      where: {
        instructorId: session.user.instructorId,
        status: 'COMPLETED',
        startTime: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      _sum: {
        price: true
      }
    }),
    // Last month revenue for comparison
    prisma.booking.aggregate({
      where: {
        instructorId: session.user.instructorId,
        status: 'COMPLETED',
        startTime: {
          gte: startOfLastMonth,
          lte: endOfLastMonth
        }
      },
      _sum: {
        price: true
      }
    }),
    // Clients with unused package hours
    prisma.booking.findMany({
      where: {
        instructorId: session.user.instructorId,
        isPackageBooking: true,
        packageHoursRemaining: { gt: 0 },
        packageStatus: 'active',
        status: { in: ['CONFIRMED', 'COMPLETED'] }
      },
      include: {
        client: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        updatedAt: 'asc' // Oldest first (most inactive)
      },
      take: 5
    })
  ])

  if (!instructor) {
    redirect('/login')
  }

  // Calculate daily averages
  const thisMonthRevenue = totalRevenue._sum.price || 0
  const lastMonthRevenueTotal = lastMonthRevenue._sum.price || 0
  const dailyAverageThisMonth = daysElapsedThisMonth > 0 ? thisMonthRevenue / daysElapsedThisMonth : 0
  const dailyAverageLastMonth = daysInLastMonth > 0 ? lastMonthRevenueTotal / daysInLastMonth : 0
  const percentageChange = dailyAverageLastMonth > 0 
    ? ((dailyAverageThisMonth - dailyAverageLastMonth) / dailyAverageLastMonth) * 100 
    : 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome back, {instructor.name}!</h1>
        <p className="text-sm sm:text-base text-gray-600">Here's what's happening with your driving school today.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Upcoming Lessons</p>
              <p className="text-3xl font-bold">{instructor.bookings.length}</p>
            </div>
            <Calendar className="h-12 w-12 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Clients</p>
              <p className="text-3xl font-bold">{instructor.clients.length}</p>
            </div>
            <Users className="h-12 w-12 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <p className="text-gray-500 text-sm">This Month (MTD)</p>
              <p className="text-3xl font-bold">${thisMonthRevenue.toFixed(0)}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-600">
                  ${dailyAverageThisMonth.toFixed(0)}/day avg ({daysElapsedThisMonth} days)
                </p>
                <p className="text-xs text-gray-600">
                  Last month: ${dailyAverageLastMonth.toFixed(0)}/day
                </p>
                {percentageChange !== 0 && (
                  <p className={`text-xs font-semibold ${percentageChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {percentageChange > 0 ? '↑' : '↓'} {Math.abs(percentageChange).toFixed(1)}% vs last month
                  </p>
                )}
              </div>
            </div>
            <TrendingUp className={`h-12 w-12 ${percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Hourly Rate</p>
              <p className="text-3xl font-bold">${instructor.hourlyRate}</p>
            </div>
            <DollarSign className="h-12 w-12 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Upcoming Lessons</h2>
            <Link href="/dashboard/bookings" className="text-blue-600 hover:text-blue-800 text-sm">
              View All
            </Link>
          </div>
          {instructor.bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No upcoming lessons</p>
              <Link href="/dashboard/bookings/new" className="text-blue-600 hover:underline text-sm">
                Create a booking
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {instructor.bookings.map((booking) => (
                <div key={booking.id} className="border-l-4 border-blue-600 pl-4 py-2 hover:bg-gray-50 transition">
                  <p className="font-semibold">{booking.client.name}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(booking.startTime).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  {booking.pickupAddress && (
                    <p className="text-sm text-gray-500">{booking.pickupAddress}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Clients Needing Attention</h2>
            <Link href="/dashboard/packages" className="text-blue-600 hover:text-blue-800 text-sm">
              View All Packages
            </Link>
          </div>
          {clientsWithPackages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No clients with unused hours</p>
              <Link href="/dashboard/packages" className="text-blue-600 hover:underline text-sm">
                View packages
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {clientsWithPackages.map((pkg) => {
                const daysSinceUpdate = Math.floor((now.getTime() - new Date(pkg.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
                const isInactive = daysSinceUpdate > 14
                const packageValue = (pkg.packageHoursRemaining || 0) * instructor.hourlyRate
                
                return (
                  <div key={pkg.id} className={`p-3 rounded-lg border-l-4 ${isInactive ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{pkg.client.name}</p>
                        <p className="text-sm text-gray-700">
                          {pkg.packageHoursRemaining} hours unused (${packageValue.toFixed(0)} value)
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Last booked: {daysSinceUpdate} days ago
                          {isInactive && <span className="ml-2 text-red-600 font-semibold">⚠️ Inactive</span>}
                        </p>
                      </div>
                      <Link 
                        href={`/dashboard/clients`}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                      >
                        Remind
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow p-4 sm:p-6 text-white">
        <h3 className="text-lg sm:text-xl font-bold mb-2">Quick Actions</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4">
          <Link 
            href="/dashboard/bookings/new"
            className="bg-white/20 hover:bg-white/30 p-4 rounded-lg transition"
          >
            <Calendar className="h-6 w-6 mb-2" />
            <p className="font-semibold">New Booking</p>
          </Link>
          <Link 
            href="/dashboard/clients"
            className="bg-white/20 hover:bg-white/30 p-4 rounded-lg transition"
          >
            <Users className="h-6 w-6 mb-2" />
            <p className="font-semibold">Add Client</p>
          </Link>
          <Link 
            href="/dashboard/profile"
            className="bg-white/20 hover:bg-white/30 p-4 rounded-lg transition"
          >
            <Car className="h-6 w-6 mb-2" />
            <p className="font-semibold">Edit Profile</p>
          </Link>
          <Link 
            href="/dashboard/settings"
            className="bg-white/20 hover:bg-white/30 p-4 rounded-lg transition"
          >
            <Car className="h-6 w-6 mb-2" />
            <p className="font-semibold">Settings</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

