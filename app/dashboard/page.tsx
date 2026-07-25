import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Calendar, Users, TrendingUp, Car, Settings, AlertTriangle, Phone, Clock, Wallet, DollarSign, Star, Package, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { EarningsThisWeekCard } from '@/components/instructor/EarningsThisWeekCard'
import ProfileCompletenessCard from '@/components/instructor/ProfileCompletenessCard'
import TodayWorkspace from '@/components/instructor/TodayWorkspace'
import RemindButton from '@/components/instructor/RemindButton'

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
          <div className="bg-slate-900/80 p-6 rounded-xl border border-white/10 shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Wallet Balance</p>
                <p className="text-2xl md:text-3xl font-bold text-white">${(user.wallet.balance ?? 0).toFixed(2)}</p>
              </div>
              <Wallet className="h-12 w-12 text-sky-400" />
            </div>
          </div>

          <div className="bg-slate-900/80 p-4 md:p-6 rounded-xl border border-white/10 shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Completed Lessons</p>
                <p className="text-2xl md:text-3xl font-bold text-white">{completedBookings}</p>
              </div>
              <Star className="h-12 w-12 text-amber-400" />
            </div>
          </div>

          <div className="bg-slate-900/80 p-4 md:p-6 rounded-xl border border-white/10 shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Upcoming Lessons</p>
                <p className="text-2xl md:text-3xl font-bold text-white">{upcomingBookings.length}</p>
              </div>
              <Calendar className="h-12 w-12 text-emerald-400" />
            </div>
          </div>

          <div className="bg-slate-900/80 p-4 md:p-6 rounded-xl border border-white/10 shadow hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Recent Transactions</p>
                <p className="text-2xl md:text-3xl font-bold text-white">{user.wallet.transactions?.length ?? 0}</p>
              </div>
              <CreditCard className="h-12 w-12 text-violet-400" />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-slate-900/80 rounded-xl border border-white/10 shadow p-4 md:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Upcoming Lessons</h2>
              <Link href="/client-dashboard/bookings" className="text-sky-400 hover:text-sky-300 text-sm">
                View All
              </Link>
            </div>
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Clock className="h-12 w-12 mx-auto mb-2 text-slate-600" />
                <p>No upcoming lessons scheduled</p>
                <Link href="/book" className="text-sky-400 hover:underline text-sm">
                  Book a lesson
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="border-l-4 border-sky-500 pl-4 py-2 hover:bg-white/5 transition rounded-r">
                    <p className="font-semibold text-white">{(booking as any).instructor?.name ?? 'Instructor'}</p>
                    <p className="text-sm text-slate-400">
                      {booking.startTime ? new Date(booking.startTime).toLocaleString('en-AU', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'TBD'}
                    </p>
                    <p className="text-sm text-slate-500">{booking.duration} hours</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900/80 rounded-xl border border-white/10 shadow p-4 md:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Quick Stats</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-800/60 rounded-lg border border-white/5">
                <p className="text-slate-300">Wallet Balance</p>
                <p className="font-semibold text-white">${(user.wallet.balance ?? 0).toFixed(2)}</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-800/60 rounded-lg border border-white/5">
                <p className="text-slate-300">Completed Lessons</p>
                <p className="font-semibold text-white">{completedBookings}</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-sky-950/40 rounded-lg border border-sky-700/30">
                <p className="text-slate-300">Upcoming Lessons</p>
                <p className="font-bold text-sky-400">{upcomingBookings.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-slate-900/80 rounded-xl border border-white/10 shadow p-4 md:p-6 text-white">
          <h3 className="text-lg sm:text-xl font-bold mb-2 text-white">Quick Actions</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4">
            <Link 
              href="/book"
              className="bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/20 p-4 rounded-xl transition"
            >
              <Calendar className="h-6 w-6 mb-2" />
              <p className="font-semibold text-sm">Book Lesson</p>
            </Link>
            <Link 
              href="/dashboard/wallet"
              className="bg-slate-800/60 hover:bg-slate-700/60 border border-white/10 p-4 rounded-xl transition"
            >
              <Wallet className="h-6 w-6 mb-2" />
              <p className="font-semibold text-sm">View Wallet</p>
            </Link>
            <Link 
              href="/dashboard/packages"
              className="bg-slate-800/60 hover:bg-slate-700/60 border border-white/10 p-4 rounded-xl transition"
            >
              <Package className="h-6 w-6 mb-2" />
              <p className="font-semibold text-sm">My Packages</p>
            </Link>
            <Link 
              href="/dashboard/credits/add-funds"
              className="bg-slate-800/60 hover:bg-slate-700/60 border border-white/10 p-4 rounded-xl transition"
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

  // Today boundaries (Perth AWST = UTC+8)
  const perthOffsetMs = 8 * 60 * 60 * 1000
  const perthNow = new Date(now.getTime() + perthOffsetMs)
  const startOfToday = new Date(Date.UTC(
    perthNow.getUTCFullYear(), perthNow.getUTCMonth(), perthNow.getUTCDate(), 0, 0, 0
  ) - perthOffsetMs)
  const endOfToday = new Date(Date.UTC(
    perthNow.getUTCFullYear(), perthNow.getUTCMonth(), perthNow.getUTCDate(), 23, 59, 59, 999
  ) - perthOffsetMs)

  // ── Core query: instructor profile is required to render any of this page ──
  // Runs separately so a failure here redirects cleanly rather than crashing
  // the entire Promise.all and losing the supplementary data we'd still want.
  const instructor = await prisma.instructor.findUnique({
    where: { id: session.user.instructorId },
    include: {
      bookings: {
        where: {
          status: 'CONFIRMED',
          // FIX BUG-5 + DATA-2: start from tomorrow so today's lessons don't appear
          // in both "Upcoming Lessons" panel AND the TodayWorkspace timeline.
          startTime: { gt: endOfToday },
        },
        take: 5,
        orderBy: { startTime: 'asc' },
        include: { client: true },
      },
      clients: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
  }).catch(() => null)

  if (!instructor) {
    redirect('/login')
  }

  // ── Supplementary queries — all individually guarded with .catch() ─────────
  // Each query can fail independently without degrading the others.
  // instructor data above is already loaded; these add stats and widget data.
  const [
    monthlyBookings,
    totalRevenue,
    lastMonthRevenue,
    clientsWithPackages,
    inactiveClients,
    totalClientCount,
    todayBookings,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        instructorId: session.user.instructorId,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        startTime: { gte: startOfMonth, lte: endOfMonth },
      },
    }).catch(() => 0),
    prisma.booking.aggregate({
      where: {
        instructorId: session.user.instructorId,
        status: 'COMPLETED',
        startTime: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { price: true },
    }).catch(() => ({ _sum: { price: 0 } })),
    prisma.booking.aggregate({
      where: {
        instructorId: session.user.instructorId,
        status: 'COMPLETED',
        startTime: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { price: true },
    }).catch(() => ({ _sum: { price: 0 } })),
    // Clients with unused paid package hours — paid only, sorted by oldest activity first
    prisma.booking.findMany({
      where: {
        instructorId: session.user.instructorId,
        isPackageBooking: true,
        packageHoursRemaining: { gt: 0 },
        isPaid: true,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      select: {
        id: true,
        updatedAt: true,
        packageHoursRemaining: true,
        client: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: 5,
    }).catch(() => []),
    // Inactive clients who had lessons but no booking in 21+ days
    prisma.client.findMany({
      where: {
        instructorId: session.user.instructorId,
        bookings: {
          some: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
          none: {
            status: { in: ['CONFIRMED', 'COMPLETED'] },
            startTime: { gte: new Date(now.getTime() - 21 * 86400000) },
          },
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        bookings: {
          where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
          orderBy: { startTime: 'desc' },
          take: 1,
          select: { id: true, startTime: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
    }).catch(() => []),
    prisma.client.count({
      where: { instructorId: session.user.instructorId },
    }).catch(() => 0),
    // Today's bookings for the Today Workspace — all statuses so progress is accurate
    prisma.booking.findMany({
      where: {
        instructorId: session.user.instructorId,
        startTime: { gte: startOfToday, lte: endOfToday },
        deletedAt: null,
      } as any,
      select: {
        id:           true,
        startTime:    true,
        endTime:      true,
        duration:     true,
        status:       true,
        clientName:   true,
        clientPhone:  true,
        pickupAddress: true,
        price:        true,
        client: { select: { phone: true } },
      },
      orderBy: { startTime: 'asc' },
    }).catch(() => []),
  ])

  // Normalise today bookings — phone may be on clientPhone or client relation
  const todayWorkspaceBookings = todayBookings.map((b: any) => ({
    id:           b.id,
    startTime:    b.startTime,
    endTime:      b.endTime,
    duration:     b.duration,
    status:       b.status,
    clientName:   b.clientName ?? null,
    clientPhone:  b.clientPhone ?? b.client?.phone ?? null,
    pickupAddress: b.pickupAddress ?? null,
    price:        b.price ?? 0,
  }))

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
        <div className="mb-5 bg-red-950/30 border-2 border-red-500/50 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-200">Your free trial has expired</p>
            <p className="text-sm text-red-300/80 mt-0.5">Choose a plan to continue accepting bookings.</p>
          </div>
          <Link href="/dashboard/subscription" className="shrink-0 bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-500">
            Choose Plan
          </Link>
        </div>
      )}
      {subStatus === 'TRIAL' && !trialExpired && daysLeftInTrial <= 7 && (
        <div className="mb-5 bg-amber-950/30 border-2 border-amber-500/40 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-200">Trial ends in {daysLeftInTrial} day{daysLeftInTrial !== 1 ? 's' : ''}</p>
            <p className="text-sm text-amber-300/80 mt-0.5">Add a payment method now to avoid interruption.</p>
          </div>
          <Link href="/dashboard/subscription" className="shrink-0 bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-amber-500">
            Upgrade
          </Link>
        </div>
      )}
      {subStatus === 'PAST_DUE' && (
        <div className="mb-5 bg-yellow-950/30 border-2 border-yellow-500/40 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-yellow-200">Payment past due</p>
            <p className="text-sm text-yellow-300/80 mt-0.5">Update your payment method to keep your account active.</p>
          </div>
          <Link href="/dashboard/subscription" className="shrink-0 bg-yellow-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-yellow-500">
            Fix Now
          </Link>
        </div>
      )}

      {/* Profile completeness nudge */}
      <ProfileCompletenessCard instructor={instructor} />

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

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
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

      {/* ── TODAY WORKSPACE ─────────────────────────────────────────────────── */}
      <TodayWorkspace
        bookings={todayWorkspaceBookings}
        instructorName={instructor.name}
      />

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-lg shadow-slate-950/20 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Upcoming Lessons
                {instructor.bookings.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-400">({instructor.bookings.length})</span>
                )}
              </h2>
              <p className="text-sm text-slate-400">Next bookings after today</p>
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
                <Link
                  key={booking.id}
                  href={`/dashboard/bookings/${booking.id}`}
                  className={`flex items-center justify-between border-t border-white/10 px-4 py-3 hover:bg-slate-900/80 transition-colors no-underline ${
                    index % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-950/80'
                  }`}
                >
                  <p className="font-semibold text-white text-sm">
                    {booking.client?.name ?? (booking as any).clientName ?? 'Guest'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>
                      {booking.startTime
                        ? new Date(booking.startTime).toLocaleString('en-AU', {
                            weekday: 'short',
                            month:   'short',
                            day:     'numeric',
                            hour:    '2-digit',
                            minute:  '2-digit',
                            timeZone: 'Australia/Perth',
                          })
                        : 'TBD'}
                    </span>
                    {booking.duration && (
                      <>
                        <span className="text-slate-500">·</span>
                        <span className="text-sky-300 font-medium">{booking.duration} min</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-lg shadow-slate-950/20 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Clients Needing Attention</h2>
              <p className="text-sm text-slate-400">Unused hours or inactive follow-up</p>
            </div>
            <Link href="/dashboard/packages" className="text-sky-300 hover:text-white text-sm font-medium">
              View All Packages
            </Link>
          </div>
          {(() => {
            // Deduplicate: inactive clients already shown in package list should not appear twice
            const packageClientIds = new Set(clientsWithPackages.map(p => p.client?.id).filter(Boolean))
            const filteredInactive = inactiveClients.filter(c => !packageClientIds.has(c.id))
            const hasAny = clientsWithPackages.length > 0 || filteredInactive.length > 0

            if (!hasAny) return (
              <div className="text-center py-8 text-slate-400">
                <Users className="h-12 w-12 mx-auto mb-2 text-slate-500" />
                <p>All clients are active — great work!</p>
              </div>
            )

            return (
              <div className="space-y-2">
                {/* Package clients first — highest priority (already paid) */}
                {clientsWithPackages.map((pkg) => {
                  const daysSinceUpdate = Math.floor((now.getTime() - new Date(pkg.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
                  const isInactive = daysSinceUpdate > 14
                  const packageValue = (pkg.packageHoursRemaining || 0) * instructor.hourlyRate
                  return (
                    <div key={pkg.id} className={`rounded-2xl border p-3.5 transition-all ${isInactive ? 'bg-rose-500/10 border-rose-400/20' : 'bg-slate-950/60 border-white/10'}`}>
                      <div className="flex items-start gap-3">
                        <Link
                          href={`/dashboard/clients/${pkg.client?.id ?? ''}`}
                          className="flex-1 min-w-0 no-underline hover:opacity-80 transition"
                        >
                          <p className="font-semibold text-white text-sm">{pkg.client?.name ?? 'Client'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            📦 {pkg.packageHoursRemaining}h unused · ${packageValue.toFixed(0)} value
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {daysSinceUpdate} days since last booking
                            {isInactive && <span className="ml-1.5 text-rose-300 font-medium">⚠️ Inactive</span>}
                          </p>
                        </Link>
                        <RemindButton
                          bookingId={pkg.id}
                          clientId={pkg.client?.id ?? ''}
                          clientFirstName={(pkg.client?.name ?? 'Client').split(' ')[0]}
                        />
                      </div>
                    </div>
                  )
                })}
                {/* Inactive clients without packages */}
                {filteredInactive.map((client) => {
                  const lastBooking = client.bookings[0]
                  const daysSince = lastBooking?.startTime
                    ? Math.floor((now.getTime() - new Date(lastBooking.startTime).getTime()) / (1000 * 60 * 60 * 24))
                    : null
                  return (
                    <div key={client.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3.5">
                      <div className="flex items-start gap-3">
                        <Link
                          href={`/dashboard/clients/${client.id}`}
                          className="flex-1 min-w-0 no-underline hover:opacity-80 transition"
                        >
                          <p className="font-semibold text-white text-sm">{client.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {daysSince !== null ? `Last lesson: ${daysSince} days ago` : 'No completed lessons yet'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">No upcoming bookings</p>
                        </Link>
                        {lastBooking?.id ? (
                          <RemindButton
                            bookingId={lastBooking.id}
                            clientId={client.id}
                            clientFirstName={client.name.split(' ')[0]}
                          />
                        ) : (
                          <Link
                            href={`/dashboard/clients/${client.id}`}
                            className="shrink-0 inline-flex items-center rounded-full bg-slate-700 hover:bg-slate-600 px-3 py-1 text-xs font-semibold text-white transition"
                          >
                            View
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
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

