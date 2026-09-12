import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  Calendar, Users, TrendingUp, Car, Settings,
  AlertTriangle, Phone, Clock, Wallet, Star, Package,
  CreditCard, Plus, DollarSign,
} from 'lucide-react'
import Link from 'next/link'
import { EarningsThisWeekCard } from '@/components/instructor/EarningsThisWeekCard'
import ProfileCompletenessCard from '@/components/instructor/ProfileCompletenessCard'
import TodayWorkspace from '@/components/instructor/TodayWorkspace'
import RemindButton from '@/components/instructor/RemindButton'
import { StatCard } from '@/components/ui'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const businessType = session!.user.businessType || 'driving'
  const isDriving = businessType === 'driving'

  // ── CLIENT dashboard ──────────────────────────────────────────────────────
  if (session!.user!.role === 'CLIENT') {
    const user = await prisma.user.findUnique({
      where: { email: session!.user.email! },
      select: {
        id: true,
        email: true,
        wallet: {
          include: {
            transactions: { take: 5, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    })

    if (!user?.wallet) redirect('/login')

    const [upcomingBookings, completedBookings] = await Promise.all([
      prisma.booking.findMany({
        where: {
          customer: { userId: user.id },
          status: 'CONFIRMED',
          startTime: { gte: new Date() },
        },
        take: 5,
        orderBy: { startTime: 'asc' },
        include: { provider: true },
      }),
      prisma.booking.count({
        where: { customer: { userId: user.id }, status: 'COMPLETED' },
      }),
    ])

    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-8 space-y-6">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-foreground">Welcome back!</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your {isDriving ? 'lessons' : 'bookings'} and account.
          </p>
        </div>

        {/* KPI row */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-card p-6 rounded-xl border border-border shadow hover:bg-card/90 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Wallet Balance</p>
                <p className="text-2xl md:text-3xl font-bold text-foreground">
                  ${(user.wallet.balance ?? 0).toFixed(2)}
                </p>
              </div>
              <Wallet className="h-12 w-12 text-primary" />
            </div>
          </div>

          <div className="bg-card p-4 md:p-6 rounded-xl border border-border shadow hover:bg-card/90 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">
                  Completed {isDriving ? 'Lessons' : 'Bookings'}
                </p>
                <p className="text-2xl md:text-3xl font-bold text-foreground">{completedBookings}</p>
              </div>
              <Star className="h-12 w-12 text-amber-400" />
            </div>
          </div>

          <div className="bg-card p-4 md:p-6 rounded-xl border border-border shadow hover:bg-card/90 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">
                  Upcoming {isDriving ? 'Lessons' : 'Bookings'}
                </p>
                <p className="text-2xl md:text-3xl font-bold text-foreground">{upcomingBookings.length}</p>
              </div>
              <Calendar className="h-12 w-12 text-emerald-400" />
            </div>
          </div>

          <div className="bg-card p-4 md:p-6 rounded-xl border border-border shadow hover:bg-card/90 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Recent Transactions</p>
                <p className="text-2xl md:text-3xl font-bold text-foreground">
                  {user.wallet.transactions?.length ?? 0}
                </p>
              </div>
              <CreditCard className="h-12 w-12 text-violet-400" />
            </div>
          </div>
        </div>

        {/* Panels */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-card rounded-xl border border-border shadow p-4 md:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-foreground">
                Upcoming {isDriving ? 'Lessons' : 'Bookings'}
              </h2>
              <Link href="/client-dashboard/bookings" className="text-primary hover:text-primary/80 text-sm no-underline">
                View All
              </Link>
            </div>
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 text-muted-foreground/40" />
                <p>No upcoming {isDriving ? 'lessons' : 'bookings'} scheduled</p>
                <Link href="/instructors" className="text-primary hover:underline text-sm">
                  {isDriving ? 'Book a lesson' : 'Make a booking'}
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingBookings.map((booking: any) => (
                  <div key={booking.id} className="border-l-4 border-primary pl-4 py-2 hover:bg-accent transition rounded-r">
                    <p className="font-semibold text-foreground">
                      {(booking as any).provider?.name ?? 'provider'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {booking.startTime
                        ? new Date(booking.startTime).toLocaleString('en-AU', {
                            weekday: 'short', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : 'TBD'}
                    </p>
                    <p className="text-sm text-muted-foreground/60">{booking.duration} hours</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border shadow p-4 md:p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-secondary/40 rounded-lg border border-border">
                <p className="text-muted-foreground">Wallet Balance</p>
                <p className="font-semibold text-foreground">${(user.wallet.balance ?? 0).toFixed(2)}</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-secondary/40 rounded-lg border border-border">
                <p className="text-muted-foreground">Completed {isDriving ? 'Lessons' : 'Bookings'}</p>
                <p className="font-semibold text-foreground">{completedBookings}</p>
              </div>
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-muted-foreground">Upcoming {isDriving ? 'Lessons' : 'Bookings'}</p>
                <p className="font-bold text-primary">{upcomingBookings.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-6 bg-card rounded-xl border border-border shadow p-4 md:p-6">
          <h3 className="text-lg sm:text-xl font-bold mb-2 text-foreground">Quick Actions</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4">
            <Link href="/instructors" className="bg-primary/10 hover:bg-primary/20 border border-primary/20 p-4 rounded-xl transition no-underline">
              <Calendar className="h-6 w-6 mb-2 text-primary" />
              <p className="font-semibold text-sm text-foreground">{isDriving ? 'Book Lesson' : 'Make Booking'}</p>
            </Link>
            <Link href="/dashboard/wallet" className="bg-secondary/40 hover:bg-secondary/60 border border-border p-4 rounded-xl transition no-underline">
              <Wallet className="h-6 w-6 mb-2 text-muted-foreground" />
              <p className="font-semibold text-sm text-foreground">View Wallet</p>
            </Link>
            <Link href="/dashboard/packages" className="bg-secondary/40 hover:bg-secondary/60 border border-border p-4 rounded-xl transition no-underline">
              <Package className="h-6 w-6 mb-2 text-muted-foreground" />
              <p className="font-semibold text-sm text-foreground">My Packages</p>
            </Link>
            <Link href="/client-dashboard/wallet" className="bg-secondary/40 hover:bg-secondary/60 border border-border p-4 rounded-xl transition no-underline">
              <CreditCard className="h-6 w-6 mb-2 text-muted-foreground" />
              <p className="font-semibold text-sm text-foreground">Add Funds</p>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── INSTRUCTOR dashboard ───────────────────────────────────────────────────
  // providerId comes from the JWT. For sessions created before the Phase 1 rename,
  // it may be absent — fall back to a DB lookup by userId.
  let resolvedProviderId = session!.user!.providerId

  if (session!.user!.role === 'provider') {
    if (!resolvedProviderId) {
      const fallback = await (prisma as any).provider.findFirst({
        where: { userId: session!.user!.id },
        select: { id: true },
      }).catch(() => null)
      if (!fallback) redirect('/login')
      resolvedProviderId = fallback!.id
    }
  } else if (
    session!.user!.role === 'ADMIN' ||
    session!.user!.role === 'SUPER_ADMIN' ||
    session!.user!.role === 'STAFF'
  ) {
    redirect('/admin')
  } else {
    redirect('/login')
  }

  const now = new Date()

  // Core query — provider profile required to render any of this page
  const instructor = await (prisma as any).provider.findUnique({
    where: { id: resolvedProviderId },
    include: {
      bookings: {
        where: { status: 'CONFIRMED', startTime: { gt: new Date() } },
        take: 5,
        orderBy: { startTime: 'asc' },
        include: { customer: true },
      },
    },
  }).catch(() => null)

  if (!instructor) redirect('/login')

  // Resolve full provider profile (merges driving extension fields)
  const { getProviderProfile } = await import('@/lib/core/getProviderProfile')
  const instructorWithExtensions = await getProviderProfile(instructor as any)

  // Terminology
  const businessId = `biz_${resolvedProviderId}`
  const terminology = await prisma.businessTerminology.findUnique({
    where: { businessId },
    select: { booking: true, bookings: true, customer: true, customers: true, service: true },
  }).catch(() => null)

  const termBooking   = terminology?.booking   ?? (isDriving ? 'Lesson'   : 'Booking')
  const termBookings  = terminology?.bookings  ?? (isDriving ? 'Lessons'  : 'Bookings')
  const termCustomer  = terminology?.customer  ?? (isDriving ? 'Student'  : 'Client')
  const termCustomers = terminology?.customers ?? (isDriving ? 'Students' : 'Clients')

  // Timezone
  const {
    localDateTimeToUTC, resolveTimezone, timezoneFromState, getLocalDateKey,
  } = await import('@/lib/utils/timezone')
  const instructorTz =
    resolveTimezone((instructor as any).timezone) ||
    timezoneFromState((instructor as any).state ?? '')

  const todayKey     = getLocalDateKey(now, instructorTz)
  const startOfToday = localDateTimeToUTC(todayKey, '00:00', instructorTz)
  const endOfToday   = new Date(
    localDateTimeToUTC(todayKey, '23:59', instructorTz).getTime() + 59_999,
  )

  // Month boundaries
  const [tyStr, tmStr] = todayKey.split('-')
  const ty = parseInt(tyStr, 10)
  const tm = parseInt(tmStr, 10)
  const startOfMonth    = localDateTimeToUTC(`${ty}-${String(tm).padStart(2, '0')}-01`, '00:00', instructorTz)
  const nextMonthY      = tm === 12 ? ty + 1 : ty
  const nextMonthM      = tm === 12 ? 1 : tm + 1
  const startOfNextMonth = localDateTimeToUTC(
    `${nextMonthY}-${String(nextMonthM).padStart(2, '0')}-01`, '00:00', instructorTz,
  )
  const endOfMonth      = new Date(startOfNextMonth.getTime() - 1)
  const prevMonthY      = tm === 1 ? ty - 1 : ty
  const prevMonthM      = tm === 1 ? 12 : tm - 1
  const startOfLastMonth = localDateTimeToUTC(
    `${prevMonthY}-${String(prevMonthM).padStart(2, '0')}-01`, '00:00', instructorTz,
  )
  const endOfLastMonth  = new Date(startOfMonth.getTime() - 1)
  const daysElapsedThisMonth = now.getDate()
  const daysInLastMonth = endOfLastMonth.getDate()

  // Correct upcoming bookings using tz-aware today boundary
  const upcomingBookings = await prisma.booking.findMany({
    where: { providerId: resolvedProviderId, status: 'CONFIRMED', startTime: { gt: endOfToday } },
    take: 5,
    orderBy: { startTime: 'asc' },
    include: { customer: true },
  }).catch(() => [])

  ;(instructor as any).bookings = upcomingBookings

  // Supplementary queries — all guarded individually
  const [
    totalRevenue,
    lastMonthRevenue,
    clientsWithPackages,
    inactiveClients,
    totalClientCount,
    todayBookings,
  ] = await Promise.all([
    prisma.booking.aggregate({
      where: { providerId: resolvedProviderId, status: 'COMPLETED', startTime: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { price: true },
    }).catch(() => ({ _sum: { price: 0 } })),

    prisma.booking.aggregate({
      where: { providerId: resolvedProviderId, status: 'COMPLETED', startTime: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { price: true },
    }).catch(() => ({ _sum: { price: 0 } })),

    prisma.booking.findMany({
      where: {
        providerId: resolvedProviderId,
        isPackageBooking: true,
        packageHoursRemaining: { gt: 0 },
        isPaid: true,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      select: {
        id: true, updatedAt: true, packageHoursRemaining: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: 5,
    }).catch(() => []),

    prisma.customer.findMany({
      where: {
        bookings: {
          some: { providerId: resolvedProviderId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
          none: {
            providerId: resolvedProviderId,
            status: { in: ['CONFIRMED', 'COMPLETED'] },
            startTime: { gte: new Date(now.getTime() - 21 * 86400000) },
          },
        },
      },
      select: {
        id: true, name: true, phone: true,
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

    prisma.customer.count({
      where: { bookings: { some: { providerId: resolvedProviderId } } },
    }).catch(() => 0),

    prisma.booking.findMany({
      where: {
        providerId: resolvedProviderId,
        startTime: { gte: startOfToday, lte: endOfToday },
        deletedAt: null,
      } as any,
      select: {
        id: true, startTime: true, endTime: true, duration: true, status: true,
        customerName: true, customerPhone: true, pickupAddress: true, price: true,
        customer: { select: { phone: true } },
      },
      orderBy: { startTime: 'asc' },
    }).catch(() => []),
  ])

  const todayWorkspaceBookings = todayBookings.map((b: any) => ({
    id:            b.id,
    startTime:     b.startTime,
    endTime:       b.endTime,
    duration:      b.duration,
    status:        b.status,
    customerName:  b.customerName  ?? null,
    customerPhone: b.clientPhone   ?? b.client?.phone ?? null,
    pickupAddress: b.pickupAddress ?? null,
    price:         b.price         ?? 0,
  }))

  const thisMonthRevenue      = Number(totalRevenue._sum.price      || 0)
  const lastMonthRevenueTotal = Number(lastMonthRevenue._sum.price  || 0)
  const dailyAverageThisMonth = daysElapsedThisMonth > 0
    ? thisMonthRevenue / daysElapsedThisMonth : 0
  const dailyAverageLastMonth = daysInLastMonth > 0
    ? lastMonthRevenueTotal / daysInLastMonth : 0
  const percentageChange = dailyAverageLastMonth > 0
    ? ((dailyAverageThisMonth - dailyAverageLastMonth) / dailyAverageLastMonth) * 100
    : 0

  const trialEndsAt    = instructor.trialEndsAt
  const daysLeftInTrial = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0
  const trialExpired = trialEndsAt ? new Date(trialEndsAt) < now : false
  const subStatus    = instructor.subscriptionStatus

  // Pre-compute clients-needing-attention content before the JSX return.
  // Avoids an IIFE inside JSX which breaks TypeScript's tag-balance parser.
  const packageClientIds = new Set(
    (clientsWithPackages as any[]).map((p: any) => p.customer?.id).filter(Boolean),
  )
  const filteredInactive = (inactiveClients as any[]).filter(
    (c: any) => !packageClientIds.has(c.id),
  )
  const hasAttentionClients = clientsWithPackages.length > 0 || filteredInactive.length > 0

  return (
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Breadcrumb */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            Dashboard
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {instructor.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}
            {isDriving ? 'Driving Instructor' : 'Service Provider'}
          </p>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/dashboard/bookings/new?offline=true"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-transparent text-foreground text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Plus className="w-4 h-4" />
            Offline
          </Link>
          <Link
            href="/dashboard/bookings/new"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground text-sm font-medium hover:opacity-90 shadow-sm shadow-primary/20 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New Booking
          </Link>
        </div>
      </div>

      {/* ── Subscription banners ─────────────────────────────────────────── */}
      {subStatus === 'TRIAL' && trialExpired && (
        <div className="bg-destructive/10 border border-destructive/40 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Free trial expired</p>
            <p className="text-xs text-muted-foreground mt-0.5">Choose a plan to continue accepting bookings.</p>
          </div>
          <Link href="/dashboard/subscription" className="shrink-0 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-destructive/90 transition-colors">
            Choose Plan
          </Link>
        </div>
      )}

      {subStatus === 'TRIAL' && !trialExpired && daysLeftInTrial <= 7 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-400">Trial ends in {daysLeftInTrial} day{daysLeftInTrial !== 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add a payment method to avoid interruption.</p>
          </div>
          <Link href="/dashboard/subscription" className="shrink-0 bg-amber-500 text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-400 transition-colors">
            Upgrade
          </Link>
        </div>
      )}

      {subStatus === 'PAST_DUE' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-400">Payment past due</p>
            <p className="text-xs text-muted-foreground mt-0.5">Update your payment method to keep your account active.</p>
          </div>
          <Link href="/dashboard/subscription" className="shrink-0 bg-amber-500 text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-400 transition-colors">
            Fix Now
          </Link>
        </div>
      )}

      {/* ── Profile completeness ─────────────────────────────────────────── */}
      <ProfileCompletenessCard instructor={{ ...instructorWithExtensions, businessType }} />

      {/* ── AI Receptionist banner ───────────────────────────────────────── */}
      {isDriving && ['PRO', 'STUDIO', 'PREMIUM'].includes(
        (instructor.subscriptionTier ?? '').toUpperCase(),
      ) && (
        <>
          {(instructor as any).voiceLine && (instructor as any).voiceLineStatus === 'ACTIVE' ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/80">
                  AI Receptionist — Active
                  {(instructor as any).businessName && (
                    <span className="ml-2 normal-case font-normal text-emerald-400/60">
                      answering as &ldquo;{(instructor as any).businessName}&rdquo;
                    </span>
                  )}
                </p>
                <p className="text-base font-bold text-foreground tracking-wide font-mono mt-0.5">
                  {(instructor as any).voiceLine
                    .replace(/^\+61(\d)/, '0$1')
                    .replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')}
                </p>
              </div>
              <Link href="/dashboard/settings" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0">
                Settings
              </Link>
            </div>
          ) : (instructor as any).voiceLineStatus === 'SUSPENDED' ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-3">
              <Phone className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive font-medium flex-1">AI Receptionist — Suspended. <span className="font-normal text-muted-foreground">Contact support to reactivate.</span></p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-3">
              <Phone className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-400 font-medium flex-1">AI Receptionist line being set up — usually ready within a day.</p>
              <Link href="/dashboard/settings" className="text-xs text-muted-foreground hover:text-foreground underline shrink-0">Details</Link>
            </div>
          )}
        </>
      )}

      {/* ── KPI row (StatCard style) ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={`Total ${termCustomers}`}
          value={totalClientCount}
          icon={Users}
          href="/dashboard/clients"
        />
        <StatCard
          title="This Month"
          value={`$${thisMonthRevenue.toFixed(0)}`}
          icon={DollarSign}
          color="text-emerald-400"
          trend={percentageChange !== 0
            ? `${percentageChange > 0 ? '↑' : '↓'} ${Math.abs(percentageChange).toFixed(1)}% vs last month`
            : undefined}
          trendUp={percentageChange > 0 ? true : percentageChange < 0 ? false : null}
          sub={`$${dailyAverageThisMonth.toFixed(0)}/day · ${daysElapsedThisMonth}d elapsed`}
          href="/dashboard/earnings"
        />
        <StatCard
          title="Upcoming"
          value={instructor.bookings.length}
          icon={Calendar}
          sub={`${termBookings.toLowerCase()} after today`}
          href="/dashboard/bookings"
        />
        <StatCard
          title="This Week"
          value="—"
          icon={TrendingUp}
          sub="see wallet"
          href="/dashboard/wallet"
        />
      </div>

      {/* ── Main content + right panel ───────────────────────────────────── */}
      <div className="flex gap-6">

        {/* Left: main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">

          {/* Upcoming bookings */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Upcoming {termBookings}
                  {instructor.bookings.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({instructor.bookings.length})
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Next confirmed bookings after today</p>
              </div>
              <Link href="/dashboard/bookings" className="text-xs text-primary hover:text-primary/80 font-medium no-underline transition-colors">
                View all →
              </Link>
            </div>

            {instructor.bookings.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No upcoming {termBookings.toLowerCase()}</p>
                <Link href="/dashboard/bookings/new" className="text-xs text-primary hover:text-primary/80 mt-1 inline-block no-underline">
                  Create a booking
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {instructor.bookings.map((booking: any, index: number) => (
                  <Link
                    key={booking.id}
                    href={`/dashboard/bookings/${booking.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-secondary/40 transition-colors no-underline group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      <p className="text-sm font-medium text-foreground truncate">
                        {booking.customer?.name ?? (booking as any).customerName ?? 'Guest'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-3">
                      <span>
                        {booking.startTime
                          ? new Date(booking.startTime).toLocaleString('en-AU', {
                              weekday: 'short', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit', timeZone: instructorTz,
                            })
                          : 'TBD'}
                      </span>
                      {booking.duration && (
                        <span className="text-primary font-medium">{booking.duration}m</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Clients needing attention */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {termCustomers} Needing Attention
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isDriving ? 'Unused hours or inactive follow-up' : 'Inactive clients'}
                </p>
              </div>
              {isDriving && (
                <Link href="/dashboard/packages" className="text-xs text-primary hover:text-primary/80 font-medium no-underline transition-colors">
                  Packages →
                </Link>
              )}
            </div>

            {!hasAttentionClients ? (
              <div className="px-5 py-10 text-center">
                <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">All {termCustomers.toLowerCase()} are active</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(clientsWithPackages as any[]).map((pkg: any) => {
                  const daysSinceUpdate = Math.floor(
                    (now.getTime() - new Date(pkg.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
                  )
                  const isInactive   = daysSinceUpdate > 14
                  const packageValue = (pkg.packageHoursRemaining || 0) * instructor.hourlyRate
                  return (
                    <div
                      key={pkg.id}
                      className={`flex items-center gap-3 px-5 py-3 ${isInactive ? 'bg-destructive/5' : ''}`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isInactive ? 'bg-destructive' : 'bg-amber-400'}`} />
                      <Link
                        href={`/dashboard/clients/${pkg.customer?.id ?? ''}`}
                        className="flex-1 min-w-0 no-underline hover:opacity-80 transition-opacity"
                      >
                        <p className="text-sm font-medium text-foreground truncate">
                          {pkg.customer?.name ?? termCustomer}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          📦 {pkg.packageHoursRemaining}h unused · ${packageValue.toFixed(0)}
                          {isInactive && <span className="ml-1.5 text-destructive">· Inactive {daysSinceUpdate}d</span>}
                        </p>
                      </Link>
                      <RemindButton
                        bookingId={pkg.id}
                        customerId={pkg.customer?.id ?? ''}
                        clientFirstName={(pkg.customer?.name ?? termCustomer).split(' ')[0]}
                      />
                    </div>
                  )
                })}

                {filteredInactive.map((client: any) => {
                  const lastBooking = client.bookings[0]
                  const daysSince = lastBooking?.startTime
                    ? Math.floor((now.getTime() - new Date(lastBooking.startTime).getTime()) / (1000 * 60 * 60 * 24))
                    : null
                  return (
                    <div key={client.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="flex-1 min-w-0 no-underline hover:opacity-80 transition-opacity"
                      >
                        <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {daysSince !== null
                            ? `Last ${termBooking.toLowerCase()} ${daysSince}d ago`
                            : `No completed ${termBookings.toLowerCase()} yet`}
                        </p>
                      </Link>
                      {lastBooking?.id ? (
                        <RemindButton
                          bookingId={lastBooking.id}
                          customerId={client.id}
                          clientFirstName={client.name.split(' ')[0]}
                        />
                      ) : (
                        <Link
                          href={`/dashboard/clients/${client.id}`}
                          className="text-xs text-primary hover:text-primary/80 no-underline transition-colors"
                        >
                          View
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* EarningsThisWeekCard — promoted from KPI row to its own section */}
          <EarningsThisWeekCard />

        </div>

        {/* Right panel: Today's workspace — sticky, hidden below xl */}
        <aside className="w-80 flex-shrink-0 hidden xl:block">
          <div className="sticky top-20 flex flex-col gap-4">
            <TodayWorkspace
              bookings={todayWorkspaceBookings}
              instructorName={instructor.name}
              timezone={instructorTz}
              termBooking={termBooking}
              termCustomer={termCustomer}
            />
          </div>
        </aside>

      </div>

      {/* Today workspace — shown on non-xl screens below main content */}
      <div className="xl:hidden">
        <TodayWorkspace
          bookings={todayWorkspaceBookings}
          instructorName={instructor.name}
          timezone={instructorTz}
          termBooking={termBooking}
          termCustomer={termCustomer}
        />
      </div>

      </div>
    
  )
}
