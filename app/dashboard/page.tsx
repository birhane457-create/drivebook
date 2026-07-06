import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Calendar, Users, DollarSign, Car, TrendingUp, Clock, Wallet, Package, CreditCard, Settings, AlertTriangle, Star, Phone } from 'lucide-react'
import Link from 'next/link'
import { EarningsThisWeekCard } from '@/components/instructor/EarningsThisWeekCard'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // Client dashboard
  if (session.user.role === 'CLIENT') {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: {
        id: true,
        email: true,
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
        client: { userId: user.id },
        status: 'CONFIRMED',
        startTime: { gte: new Date() }
      },
      take: 5,
      orderBy: { startTime: 'asc' },
      include: { instructor: true }
    })

    const completedBookings = await prisma.booking.count({
      where: {
        client: { userId: user.id },
        status: 'COMPLETED'
      }
    })

    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome back!</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your lessons and account.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Wallet Balance</p>
                <p className="text-2xl md:text-3xl font-bold">${(user.wallet.balance ?? 0).toFixed(2)}</p>
              </div>
              <Wallet className="h-12 w-12 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-lg shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Completed Lessons</p>
                <p className="text-2xl md:text-3xl font-bold">{completedBookings}</p>
              </div>
              <DollarSign className="h-12 w-12 text-red-600" />
            </div>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-lg shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Upcoming Lessons</p>
                <p className="text-2xl md:text-3xl font-bold">{upcomingBookings.length}</p>
              </div>
              <Calendar className="h-12 w-12 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-lg shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Lessons Done</p>
                <p className="text-2xl md:text-3xl font-bold">{completedBookings}</p>
              </div>
              <Star className="h-12 w-12 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Upcoming Lessons</h2>
              <Link href="/client-dashboard/bookings" className="text-blue-600 hover:text-blue-800 text-sm">
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
                    <p className="font-semibold">{(booking as any).instructor?.name ?? 'Instructor'}</p>
                    <p className="text-sm text-gray-600">
                      {booking.startTime ? new Date(booking.startTime).toLocaleString('en-AU', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'TBD'}
                    </p>
                    <p className="text-sm text-gray-500">{booking.duration} hours</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Quick Stats</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <p className="text-gray-600">Wallet Balance</p>
                <p className="font-semibold">${(user.wallet.balance ?? 0).toFixed(2)}</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <p className="text-gray-600">Completed Lessons</p>
                <p className="font-semibold">{completedBookings}</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                <p className="text-gray-600">Upcoming Lessons</p>
                <p className="font-bold text-blue-600">{upcomingBookings.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow p-4 md:p-6 text-white">
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
  if (session.user.role === 'INSTRUCTOR') {
    if (!session.user.instructorId) {
      redirect('/login')
    }
  } else {
    // User is neither CLIENT nor INSTRUCTOR, redirect to login
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

  const [instructor, monthlyBookings, totalRevenue, lastMonthRevenue, clientsWithPackages, totalClientCount] = await Promise.all([
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
        status: { in: ['CONFIRMED', 'COMPLETED'] },
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
    prisma.booking.findMany({
      where: {
        instructorId: session.user.instructorId,
        isPackageBooking: true,
        packageHoursRemaining: { gt: 0 },
        status: { in: ['CONFIRMED', 'COMPLETED'] }
      },
      select: {
        id: true,
        updatedAt: true,
        packageHoursRemaining: true,
        client: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        updatedAt: 'asc'
      },
      take: 5
    }),
    prisma.client.count({
      where: { instructorId: session.user.instructorId }
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

  // Subscription status helpers
  const trialEndsAt = instructor.trialEndsAt
  const daysLeftInTrial = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0
  const trialExpired = trialEndsAt ? new Date(trialEndsAt) < now : false
  const subStatus = instructor.subscriptionStatus

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6">
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-2xl shadow-slate-950/30 mb-8">
        <div className="relative overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(124,58,237,0.16),transparent_35%)] opacity-80" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300/80 mb-3">Instructor Portal</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Welcome back, {instructor.name}!</h1>
            <p className="max-w-2xl text-sm text-slate-300">Here's what's happening with your driving school today.</p>
          </div>
        </div>
      </div>

      {/* Subscription status banner */}
      {subStatus === 'TRIAL' && trialExpired && (
        <div className="mb-5 bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">Your free trial has expired</p>
            <p className="text-sm text-red-700 mt-0.5">Choose a plan to continue accepting bookings.</p>
          </div>
          <Link href="/dashboard/subscription" className="shrink-0 bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-700">
            Choose Plan
          </Link>
        </div>
      )}
      {subStatus === 'TRIAL' && !trialExpired && daysLeftInTrial <= 7 && (
        <div className="mb-5 bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">Trial ends in {daysLeftInTrial} day{daysLeftInTrial !== 1 ? 's' : ''}</p>
            <p className="text-sm text-amber-700 mt-0.5">Add a payment method now to avoid interruption.</p>
          </div>
          <Link href="/dashboard/subscription" className="shrink-0 bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-amber-700">
            Upgrade
          </Link>
        </div>
      )}
      {subStatus === 'PAST_DUE' && (
        <div className="mb-5 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-yellow-900">Payment past due</p>
            <p className="text-sm text-yellow-700 mt-0.5">Update your payment method to keep your account active.</p>
          </div>
          <Link href="/dashboard/subscription" className="shrink-0 bg-yellow-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-yellow-700">
            Fix Now
          </Link>
        </div>
      )}

      {/* AI Receptionist Voice Line — shown to PRO+ instructors */}
      {['PRO', 'STUDIO', 'BUSINESS'].includes((instructor.subscriptionTier ?? '').toUpperCase()) && (
        <div className="mb-5">
          {(instructor as any).voiceLine && (instructor as any).voiceLineStatus === 'ACTIVE' ? (
            /* Active line — show the number prominently */
            <div className="rounded-3xl border border-green-500/30 bg-green-950/20 p-4 flex items-center gap-4">
              <div className="rounded-2xl bg-green-500/10 p-3 shrink-0">
                <Phone className="h-6 w-6 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-400/80 mb-0.5">AI Receptionist</p>
                <p className="text-xl font-bold text-white tracking-wide font-mono">
                  {(instructor as any).voiceLine
                    .replace(/^\+61(\d)/, '0$1')
                    .replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Active 24/7 — answers bookings, cancellations and reschedules</p>
              </div>
              <Link
                href="/dashboard/settings"
                className="shrink-0 text-xs text-slate-400 hover:text-white underline underline-offset-2"
              >
                Details
              </Link>
            </div>
          ) : (instructor as any).voiceLineStatus === 'SUSPENDED' ? (
            /* Suspended */
            <div className="rounded-3xl border border-red-500/30 bg-red-950/20 p-4 flex items-center gap-4">
              <div className="rounded-2xl bg-red-500/10 p-3 shrink-0">
                <Phone className="h-6 w-6 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-300">AI Receptionist — Suspended</p>
                <p className="text-xs text-slate-400 mt-0.5">Your booking line is temporarily offline. Contact support to reactivate.</p>
              </div>
            </div>
          ) : (
            /* PRO+ but number not yet assigned — "being set up" */
            <div className="rounded-3xl border border-amber-500/20 bg-amber-950/10 p-4 flex items-center gap-4">
              <div className="rounded-2xl bg-amber-500/10 p-3 shrink-0">
                <Phone className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">AI Receptionist Line — Being Set Up</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your dedicated booking number is being provisioned. Usually ready within a day.
                  Until then, students can book at drivebook.com.au.
                </p>
              </div>
              <Link
                href="/dashboard/settings"
                className="shrink-0 text-xs text-slate-400 hover:text-white underline underline-offset-2"
              >
                Details
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20 transition hover:bg-slate-900/90">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Upcoming Lessons</p>
              <p className="text-3xl font-semibold text-white">{instructor.bookings.length}</p>
            </div>
            <Calendar className="h-12 w-12 text-sky-400" />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20 transition hover:bg-slate-900/90">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Total Clients</p>
              <p className="text-3xl font-semibold text-white">{totalClientCount}</p>
            </div>
            <Users className="h-12 w-12 text-emerald-400" />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20 transition hover:bg-slate-900/90">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">This Month (MTD)</p>
              <p className="text-3xl font-semibold text-white">${thisMonthRevenue.toFixed(0)}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-400">
                  ${dailyAverageThisMonth.toFixed(0)}/day avg ({daysElapsedThisMonth} days)
                </p>
                <p className="text-xs text-slate-400">
                  Last month: ${dailyAverageLastMonth.toFixed(0)}/day
                </p>
                {percentageChange !== 0 && (
                  <p className={`text-xs font-semibold ${percentageChange > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {percentageChange > 0 ? '↑' : '↓'} {Math.abs(percentageChange).toFixed(1)}% vs last month
                  </p>
                )}
              </div>
            </div>
            <TrendingUp className={`h-12 w-12 ${percentageChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
          </div>
        </div>

        <EarningsThisWeekCard />
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-lg shadow-slate-950/20 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Upcoming Lessons</h2>
              <p className="text-sm text-slate-400">Next bookings on your calendar</p>
            </div>
            <Link href="/dashboard/bookings" className="text-sky-300 hover:text-white text-sm font-medium">
              View All
            </Link>
          </div>
          {instructor.bookings.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock className="h-12 w-12 mx-auto mb-2 text-slate-500" />
              <p>No upcoming lessons</p>
              <Link href="/dashboard/bookings/new" className="text-sky-300 hover:text-white text-sm">
                Create a booking
              </Link>
            </div>
          ) : (
            <div className="space-y-0">
              {instructor.bookings.map((booking, index) => (
                <div 
                  key={booking.id} 
                  className={`border-t border-white/10 px-4 py-3 hover:bg-slate-900/80 transition-colors ${
                    index % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-950/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white text-sm">
                      {booking.client?.name ?? (booking as any).clientName ?? 'Guest'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>
                        {booking.startTime && booking.endTime ? (
                          <>
                            {new Date(booking.startTime).toLocaleString('en-AU', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })} - {new Date(booking.endTime).toLocaleString('en-AU', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </>
                        ) : 'TBD'}
                      </span>
                      {booking.duration && (
                        <>
                          <span className="text-slate-500">·</span>
                          <span className="text-sky-300 font-medium">
                            {booking.duration} min
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-lg shadow-slate-950/20 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Clients Needing Attention</h2>
              <p className="text-sm text-slate-400">Clients with unused hours or overdue follow-up</p>
            </div>
            <Link href="/dashboard/packages" className="text-sky-300 hover:text-white text-sm font-medium">
              View All Packages
            </Link>
          </div>
          {clientsWithPackages.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Users className="h-12 w-12 mx-auto mb-2 text-slate-500" />
              <p>No clients with unused hours</p>
              <Link href="/dashboard/packages" className="text-sky-300 hover:text-white text-sm">
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
                  <div key={pkg.id} className={`rounded-3xl border border-white/10 p-4 ${isInactive ? 'bg-rose-500/10 border-rose-400/20' : 'bg-slate-950/60'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white">{pkg.client?.name ?? 'Client'}</p>
                        <p className="text-sm text-slate-400">
                          {pkg.packageHoursRemaining} hours unused (${packageValue.toFixed(0)} value)
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Last booked: {daysSinceUpdate} days ago
                          {isInactive && <span className="ml-2 text-rose-300 font-semibold">⚠️ Inactive</span>}
                        </p>
                      </div>
                      <Link 
                        href={`/dashboard/clients/${pkg.client?.id ?? ''}`}
                        className="inline-flex items-center justify-center rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-400 transition"
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

      <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-r from-sky-600 to-violet-600 shadow-2xl shadow-slate-950/30 p-4 md:p-6 text-white">
        <h3 className="text-lg sm:text-xl font-semibold mb-2">Quick Actions</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4">
          <Link 
            href="/dashboard/bookings/new"
            className="bg-white/10 hover:bg-white/20 p-4 rounded-3xl transition"
          >
            <Calendar className="h-6 w-6 mb-2 text-white" />
            <p className="font-semibold text-white">New Booking</p>
          </Link>
          <Link 
            href="/dashboard/clients"
            className="bg-white/10 hover:bg-white/20 p-4 rounded-3xl transition"
          >
            <Users className="h-6 w-6 mb-2 text-white" />
            <p className="font-semibold text-white">Add Client</p>
          </Link>
          <Link 
            href="/dashboard/profile"
            className="bg-white/10 hover:bg-white/20 p-4 rounded-3xl transition"
          >
            <Car className="h-6 w-6 mb-2 text-white" />
            <p className="font-semibold text-white">Edit Profile</p>
          </Link>
          <Link 
            href="/dashboard/settings"
            className="bg-white/10 hover:bg-white/20 p-4 rounded-3xl transition"
          >
            <Settings className="h-6 w-6 mb-2 text-white" />
            <p className="font-semibold text-white">Settings</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

