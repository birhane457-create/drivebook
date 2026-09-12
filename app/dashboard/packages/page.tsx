'use client'

import { useEffect, useState, useMemo } from 'react'
import { Package, Clock, Calendar, AlertTriangle, TrendingUp, User, RefreshCw, Search } from 'lucide-react'
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'
import { useBusinessConfig } from '@/hooks/useBusinessConfig'
import { DashboardPageLayout, Badge } from '@/components/ui'
import { cn } from '@/lib/cn'

interface PackageData {
  id: string
  customer: { id: string; name: string; email: string; phone: string }
  packageHours: number
  packageHoursUsed: number
  packageHoursRemaining: number
  usagePercentage: number
  packageStatus: string
  isPaid: boolean
  bookingStatus: string
  packageExpiryDate: string | null
  daysUntilExpiry: number | null
  isExpiringSoon: boolean
  purchaseDate: string
  totalPrice: number
  providerPayout: number
  hourlyRate: number
  potentialGross: number
  potentialNet: number
  upcomingBookings: Array<{
    id: string; startTime: string; endTime: string
    duration: number; price: number; providerPayout: number
  }>
  upcomingBookingsCount: number
  upcomingBookingsValue: number
}

interface PackagesResponse {
  packages: PackageData[]
  summary: {
    totalPackages: number
    totalHoursRemaining: number
    totalPotentialNet: number
    totalUpcomingValue: number
    expiringPackagesCount: number
  }
}

export default function PackagesPage() {
  const { service: termBooking, services: termBookings } = useBusinessConfig()
  const [data, setData]             = useState<PackagesResponse | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [instructorTz, setInstructorTz] = useState(DEFAULT_TIMEZONE)
  const [refreshing, setRefreshing] = useState(false)
  const [pkgSearch, setPkgSearch]   = useState('')

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const [pkgRes, settingsRes] = await Promise.all([
        fetch('/api/instructor/packages'),
        fetch('/api/instructor/settings'),
      ])
      if (!pkgRes.ok) throw new Error(`Failed to load packages (${pkgRes.status})`)
      const [pkg, settings] = await Promise.all([pkgRes.json(), settingsRes.ok ? settingsRes.json() : null])
      setData(pkg)
      if (settings?.timezone) setInstructorTz(resolveTimezone(settings.timezone))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packages')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  // Filter packages by client name/email/phone
  const filteredPackages = useMemo(() => {
    if (!data?.packages) return []
    if (!pkgSearch.trim()) return data.packages
    const q = pkgSearch.toLowerCase()
    return data.packages.filter(p =>
      p.customer.name.toLowerCase().includes(q) ||
      p.customer.email.toLowerCase().includes(q) ||
      p.customer.phone.toLowerCase().includes(q)
    )
  }, [data?.packages, pkgSearch])

  const kpis = [
    {
      label: 'Active Packages',
      value: data?.summary.totalPackages ?? 0,
      icon: <Package className="w-4 h-4" />,
      color: 'text-violet-400',
      sub: 'clients with hours',
    },
    {
      label: 'Hours Available',
      value: data ? `${data.summary.totalHoursRemaining.toFixed(1)}h` : '—',
      icon: <Clock className="w-4 h-4" />,
      color: 'text-primary',
      sub: 'ready to schedule',
    },
    {
      label: 'Potential Earnings',
      value: data ? `$${data.summary.totalPotentialNet.toFixed(0)}` : '—',
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-emerald-400',
      sub: `when ${termBookings.toLowerCase()} taught`,
    },
    {
      label: 'Expiring Soon',
      value: data?.summary.expiringPackagesCount ?? 0,
      icon: <AlertTriangle className="w-4 h-4" />,
      color: data && data.summary.expiringPackagesCount > 0 ? 'text-amber-400' : undefined,
      sub: 'within 30 days',
    },
  ]

  return (
    <DashboardPageLayout
      title="Client Packages"
      description={`Hours your clients have purchased but not yet scheduled · ${
        data ? `${data.summary.totalHoursRemaining.toFixed(1)} hours available` : ''
      }`}
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Packages' }]}
      secondaryActions={[{
        label: refreshing ? 'Refreshing…' : 'Refresh',
        icon: <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />,
        onClick: () => load(true),
        disabled: refreshing,
        variant: 'outline',
      }]}
      kpis={kpis}
      isLoading={loading}
      error={error}
    >
      {/* Info banner */}
      {data && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-sm text-foreground">
            <span className="font-semibold">ℹ️ About packages:</span>{' '}
            These are hours your clients have purchased but not yet scheduled.
            You&apos;ll earn this money when {termBookings.toLowerCase()} are booked and completed.
          </p>
        </div>
      )}

      {/* Package search */}
      {data && data.packages.length > 2 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search packages by client name, email, or phone…"
            value={pkgSearch}
            onChange={e => setPkgSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl bg-card text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary/50 focus:outline-none text-sm"
          />
        </div>
      )}

      {/* Package list */}
      {!loading && data?.packages.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Package className="h-14 w-14 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Active Packages</h3>
          <p className="text-muted-foreground text-sm">Your clients haven&apos;t purchased any packages yet.</p>
        </div>
      )}

      {!loading && data && data.packages.length > 0 && (
        <div className="space-y-4">
          {filteredPackages.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-10 text-center">
              <Search className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">No packages match "{pkgSearch}"</p>
              <p className="text-sm text-muted-foreground">Try the client's name, email, or phone number.</p>
            </div>
          ) : (
            filteredPackages.map(pkg => (
            <div
              key={pkg.id}
              className={cn(
                'bg-card rounded-xl border overflow-hidden',
                pkg.isExpiringSoon ? 'border-amber-500/40' : 'border-border',
              )}
            >
              {/* Package header */}
              <div className="bg-secondary/30 px-5 py-4 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <User className="h-5 w-5 text-violet-400 shrink-0" />
                    <h3 className="text-base font-bold text-foreground">{pkg.customer.name}</h3>

                    {/* Payment / status badge */}
                    {!pkg.isPaid ? (
                      <Badge variant="warning">Awaiting Payment</Badge>
                    ) : (
                      <Badge variant={
                        pkg.packageStatus === 'active'    ? 'success' :
                        pkg.packageStatus === 'completed' ? 'info' : 'secondary'
                      }>
                        {pkg.packageStatus.charAt(0).toUpperCase() + pkg.packageStatus.slice(1)}
                      </Badge>
                    )}

                    {pkg.isExpiringSoon && (
                      <Badge variant="warning" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Expires in {pkg.daysUntilExpiry}d
                      </Badge>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Potential Earnings</p>
                    <p className={cn('text-2xl font-bold', pkg.isPaid ? 'text-emerald-400' : 'text-muted-foreground/40')}>
                      ${pkg.potentialNet.toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">{pkg.isPaid ? 'when taught' : 'payment pending'}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{pkg.customer.email} · {pkg.customer.phone}</p>
              </div>

              {/* Package body */}
              <div className="p-5 space-y-4">
                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {pkg.packageHoursRemaining.toFixed(1)}h remaining of {pkg.packageHours}h
                    </span>
                    <span className="text-xs text-muted-foreground">{pkg.usagePercentage}% used</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2.5">
                    <div
                      className="bg-gradient-to-r from-violet-500 to-violet-400 h-2.5 rounded-full transition-all"
                      style={{ width: `${pkg.usagePercentage}%` }}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Hours',      value: `${pkg.packageHours}h`,                  color: '' },
                    { label: 'Hours Used',       value: `${pkg.packageHoursUsed.toFixed(1)}h`,   color: 'text-primary' },
                    { label: 'Hours Remaining',  value: `${pkg.packageHoursRemaining.toFixed(1)}h`, color: 'text-emerald-400' },
                    { label: 'Hourly Rate',      value: `$${pkg.hourlyRate.toFixed(0)}/h`,       color: '' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-background rounded-lg p-3 border border-border">
                      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                      <p className={cn('text-base font-bold text-foreground', color)}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Upcoming bookings */}
                {pkg.upcomingBookings.length > 0 && (
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      Upcoming {termBookings} ({pkg.upcomingBookingsCount})
                    </h4>
                    <div className="space-y-2">
                      {pkg.upcomingBookings.map(booking => (
                        <div key={booking.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {new Date(booking.startTime).toLocaleDateString('en-AU', {
                                weekday: 'short', month: 'short', day: 'numeric', timeZone: instructorTz,
                              })}{' '}
                              {new Date(booking.startTime).toLocaleTimeString('en-AU', {
                                hour: '2-digit', minute: '2-digit', timeZone: instructorTz,
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">{booking.duration}h {termBooking.toLowerCase()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-primary">${booking.providerPayout.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground/50">will earn</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <p className="text-sm text-emerald-400">
                        <span className="font-semibold">Total scheduled:</span>{' '}
                        ${pkg.upcomingBookingsValue.toFixed(2)} from {pkg.upcomingBookingsCount}{' '}
                        {pkg.upcomingBookingsCount > 1 ? termBookings.toLowerCase() : termBooking.toLowerCase()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Purchase / expiry dates */}
                <div className="border-t border-border pt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Purchased</p>
                    <p className="font-medium text-foreground">
                      {new Date(pkg.purchaseDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Expires</p>
                    <p className={cn('font-medium', pkg.isExpiringSoon ? 'text-amber-400' : 'text-foreground')}>
                      {pkg.packageExpiryDate
                        ? new Date(pkg.packageExpiryDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })
                        : <span className="text-muted-foreground/50">No expiry set</span>}
                    </p>
                  </div>
                </div>

                {/* Action hints */}
                {!pkg.isPaid && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-sm text-amber-400">
                      ⏳ <span className="font-semibold">Payment pending:</span>{' '}
                      {pkg.customer.name.split(' ')[0]} hasn&apos;t completed payment. Hours available once confirmed.
                    </p>
                  </div>
                )}
                {pkg.isPaid && pkg.packageHoursRemaining > 0 && pkg.upcomingBookingsCount === 0 && (
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm text-primary">
                      💡 <span className="font-semibold">Tip:</span>{' '}
                      Reach out to {pkg.customer.name.split(' ')[0]} to schedule their remaining{' '}
                      {pkg.packageHoursRemaining.toFixed(1)} hours.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )))}
        </div>
      )}

      {/* Footer info */}
      <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
        <h3 className="font-semibold text-violet-400 mb-2 text-sm">📦 About Packages</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>· Packages show hours clients have purchased but not yet scheduled</li>
          <li>· You earn money when {termBookings.toLowerCase()} are taught, not when packages are purchased</li>
          <li>· Encourage clients to book their remaining hours before expiry</li>
          <li>· Potential earnings are calculated based on your commission rate</li>
        </ul>
      </div>
    </DashboardPageLayout>
  )
}
