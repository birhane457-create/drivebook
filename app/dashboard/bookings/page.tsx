'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, User, Plus, Search, ChevronDown, ChevronUp, Edit2, X, RefreshCw, Banknote, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { getStatusConfig } from '@/lib/config/booking-status'
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'
import PermissionGate from '@/components/instructor/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'
import { DashboardPageLayout } from '@/components/ui'
import { cn } from '@/lib/cn'

interface Booking {
  id: string
  startTime: string
  endTime: string
  status: string
  bookingType?: string | null
  pickupAddress?: string
  dropoffAddress?: string
  price: number
  notes?: string
  checkInTime?: string
  checkOutTime?: string
  source?: string // 'platform' | 'offline'
  offlinePaymentMethod?: string
  offlineAmountPaid?: number
  customer: {
    name: string
    phone: string
    email: string
  }
  customerName?: string // offline bookings may not have a client record
}

// NF-01: replaces all window.confirm() calls — one state handles all action types
type PendingAction = {
  id: string
  type: 'delete' | 'cancel' | 'checkIn' | 'checkOut' | 'confirm' | 'saveEdit'
  message: string
  confirmLabel: string
  confirmClass: string
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'platform' | 'offline'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Booking>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [instructorTz, setInstructorTz] = useState(DEFAULT_TIMEZONE)
  // NF-01: single inline confirm state — replaces all window.confirm() calls
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const { canCheckInOut } = usePermissions()

  useEffect(() => {
    // Fetch bookings and timezone in parallel
    Promise.all([
      fetchBookings(),
      fetch('/api/instructor/settings')
        .then(r => r.ok ? r.json() : null)
        .then(s => { if (s?.timezone) setInstructorTz(resolveTimezone(s.timezone)) })
        .catch(() => {}),
    ])
  }, [])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  // Request confirmation — sets the pending action, renders inline panel
  const requestConfirm = (action: PendingAction) => {
    setPendingAction(action)
  }

  // Execute confirmed action
  const executeConfirmed = async () => {
    if (!pendingAction) return
    const { id, type } = pendingAction
    setPendingAction(null)
    switch (type) {
      case 'delete':    return _doDelete(id)
      case 'cancel':    return _doCancel(id)
      case 'checkIn':   return _doCheckIn(id)
      case 'checkOut':  return _doCheckOut(id)
      case 'confirm':   return _doConfirm(id)
      case 'saveEdit':  return _doSaveEdit(id)
    }
  }

  const formatPrice = (value: number | string | null | undefined) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `$${value.toFixed(2)}`
    }
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return `$${parsed.toFixed(2)}`
    }
    return '$0.00'
  }

  const fetchBookings = async () => {
    try {
      // Fetch with a generous window — client-side filter handles the rest.
      // Past 90 days + future 60 days covers all realistic use without unbounded queries.
      const from = new Date(Date.now() - 90 * 86400000).toISOString()
      const to   = new Date(Date.now() + 60 * 86400000).toISOString()
      const res = await fetch(`/api/bookings?from=${from}&to=${to}&limit=400`)
      if (res.status === 401) {
        showToast('error', 'Your session has expired. Please refresh the page.')
        setLoading(false)
        return
      }
      if (!res.ok) {
        showToast('error', `Failed to load bookings (${res.status}). Please try again.`)
        setLoading(false)
        return
      }
      const data = await res.json()
      setBookings(data)
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
      showToast('error', 'Failed to load bookings. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // NF-01: action handlers no longer guard with window.confirm() — confirmation is via inline panel
  const handleDelete = (id: string) => requestConfirm({
    id, type: 'delete',
    message: 'Remove this booking from your list? The record will be retained for audit purposes.',
    confirmLabel: 'Remove',
    confirmClass: 'bg-destructive hover:bg-destructive/90',
  })

  const handleCancel = (id: string) => requestConfirm({
    id, type: 'cancel',
    message: 'Cancel this booking? The client will be notified and any applicable refund will be processed.',
    confirmLabel: 'Cancel Booking',
    confirmClass: 'bg-destructive hover:bg-destructive/90',
  })

  const handleCheckIn = (id: string) => requestConfirm({
    id, type: 'checkIn',
    message: 'Start this lesson now? This will record the check-in time.',
    confirmLabel: 'Yes, Check In',
    confirmClass: 'bg-emerald-600 hover:bg-green-700',
  })

  const handleCheckOut = (id: string) => requestConfirm({
    id, type: 'checkOut',
    message: 'End this lesson now? This will record the check-out time and mark the lesson complete.',
    confirmLabel: 'Yes, Check Out',
    confirmClass: 'bg-primary hover:bg-primary/90',
  })

  const handleConfirm = (id: string) => requestConfirm({
    id, type: 'confirm',
    message: 'Confirm this PENDING booking? The client will be notified.',
    confirmLabel: 'Confirm Booking',
    confirmClass: 'bg-yellow-600 hover:bg-yellow-700',
  })

  const saveEdit = (id: string) => requestConfirm({
    id, type: 'saveEdit',
    message: 'Save changes to this booking?',
    confirmLabel: 'Save Changes',
    confirmClass: 'bg-emerald-600 hover:bg-green-700',
  })

  // Private execution functions (called after confirmation)
  const _doDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('success', 'Booking removed.')
        fetchBookings()
      } else {
        const error = await res.json()
        showToast('error', error.error || 'Failed to remove booking.')
      }
    } catch {
      showToast('error', 'Failed to remove booking. Please try again.')
    }
  }

  const _doCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by instructor' }),
      })
      if (res.ok) {
        showToast('success', 'Booking cancelled successfully.')
        fetchBookings()
      } else {
        const error = await res.json()
        showToast('error', error.error || 'Failed to cancel booking.')
      }
    } catch {
      showToast('error', 'Failed to cancel booking. Please try again.')
    }
  }

  const _doCheckIn = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: 'Web check-in' }),
      })
      if (res.ok) {
        showToast('success', 'Checked in successfully.')
        fetchBookings()
      } else {
        const error = await res.json()
        showToast('error', error.error || 'Check-in failed.')
      }
    } catch {
      showToast('error', 'Check-in failed. Please try again.')
    }
  }

  const _doCheckOut = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: 'Web check-out' }),
      })
      if (res.ok) {
        showToast('success', 'Checked out successfully.')
        fetchBookings()
      } else {
        const error = await res.json()
        showToast('error', error.error || 'Check-out failed.')
      }
    } catch {
      showToast('error', 'Check-out failed. Please try again.')
    }
  }

  const _doConfirm = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}/confirm`, { method: 'POST' })
      if (res.ok) {
        showToast('success', 'Booking confirmed successfully! Client has been notified.')
        fetchBookings()
      } else {
        const error = await res.json()
        showToast('error', error.error || 'Failed to confirm booking.')
      }
    } catch {
      showToast('error', 'Failed to confirm booking. Please try again.')
    }
  }

  const _doSaveEdit = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupAddress: editForm.pickupAddress,
          dropoffAddress: editForm.dropoffAddress,
          notes: editForm.notes,
        }),
      })
      if (res.ok) {
        showToast('success', 'Booking updated successfully.')
        setEditingId(null)
        setEditForm({})
        fetchBookings()
      } else {
        const error = await res.json()
        showToast('error', error.error || 'Update failed.')
      }
    } catch {
      showToast('error', 'Update failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (booking: any) => {
    setEditingId(booking.id)
    setEditForm({
      startTime: booking.startTime,
      endTime: booking.endTime,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      notes: booking.notes,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const filteredBookings = bookings.filter(booking => {
    const customerName = booking.customer?.name || booking.customerName || ''
    const matchesSearch = customerName.toLowerCase().includes(search.toLowerCase())
    const bookingDate = new Date(booking.startTime)
    const now = new Date()
    const matchesSource = sourceFilter === 'all' || (booking.source ?? 'platform') === sourceFilter

    if (filter === 'upcoming') return bookingDate >= now && matchesSearch && matchesSource
    if (filter === 'past') return bookingDate < now && matchesSearch && matchesSource
    return matchesSearch && matchesSource
  })

  // KPI counts
  const now = new Date()
  const upcomingCount  = bookings.filter(b => new Date(b.startTime) >= now && b.status !== 'CANCELLED').length
  const pendingCount   = bookings.filter(b => b.status === 'PENDING').length
  const todayCount     = bookings.filter(b => {
    const d = new Date(b.startTime)
    return d.toDateString() === now.toDateString()
  }).length

  const kpis = [
    { label: 'Total',    value: bookings.length,  sub: 'in range' },
    { label: 'Upcoming', value: upcomingCount,     color: 'text-primary',      sub: 'confirmed' },
    { label: 'Today',    value: todayCount,        color: 'text-emerald-400',  sub: 'scheduled' },
    { label: 'Pending',  value: pendingCount,      color: pendingCount > 0 ? 'text-amber-400' : undefined, sub: 'need action' },
  ]

  // Status colours now come from lib/config/booking-status.ts (getStatusConfig)

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <DashboardPageLayout
      title="Bookings"
      description="Manage all your upcoming and past bookings"
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Bookings' }]}
      primaryAction={{ label: 'Platform Booking', icon: <Plus className="h-4 w-4" />, href: '/dashboard/bookings/new' }}
      secondaryActions={[{ label: 'Offline / Cash', icon: <Banknote className="h-4 w-4" />, href: '/dashboard/bookings/new?offline=true', variant: 'outline' }]}
      kpis={kpis}
      isLoading={loading}
    >
      {/* Last-minute pending alert */}
      {bookings.filter((b: any) => b.status === 'PENDING' && new Date(b.startTime) < new Date(Date.now() + 2 * 60 * 60 * 1000)).length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
          <span className="text-xl shrink-0">⚡</span>
          <div className="flex-1">
            <p className="font-bold text-amber-400">Last-minute booking requests need your approval</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {bookings.filter((b: any) => b.status === 'PENDING' && new Date(b.startTime) < new Date(Date.now() + 2 * 60 * 60 * 1000)).length} request(s) within the next 2 hours. Approve or decline below.
            </p>
          </div>
        </div>
      )}

        <div className="rounded-xl bg-card border border-border p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search by client name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-xl bg-background text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Time filter */}
              <button onClick={() => setFilter('all')}      className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filter === 'all'      ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'}`}>All</button>
              <button onClick={() => setFilter('upcoming')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filter === 'upcoming' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'}`}>Upcoming</button>
              <button onClick={() => setFilter('past')}     className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filter === 'past'     ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'}`}>Past</button>
              {/* Source filter */}
              <div className="w-px bg-border mx-1" />
              <button onClick={() => setSourceFilter('all')}      className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${sourceFilter === 'all'      ? 'bg-secondary text-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80'}`}>All Types</button>
              <button onClick={() => setSourceFilter('platform')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${sourceFilter === 'platform' ? 'bg-secondary text-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80'}`}>Platform</button>
              <button onClick={() => setSourceFilter('offline')}  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${sourceFilter === 'offline'  ? 'bg-secondary text-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80'}`}>Offline</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="rounded-xl bg-card border border-border p-12 text-center">
            <Calendar className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-foreground">No bookings found</h3>
            <p className="text-muted-foreground">Create your first booking to get started</p>
          </div>
        ) : (
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="divide-y divide-border">
              {filteredBookings.map((booking: any) => {
                const isExpanded = expandedId === booking.id
                const bookingDate = new Date(booking.startTime)
                const tzOpts = { timeZone: instructorTz }
                const startTime = bookingDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', ...tzOpts })
                const endTime   = booking.endTime
                  ? new Date(booking.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', ...tzOpts })
                  : '—'
                const canCheckIn  = canCheckInOut && booking.status === 'CONFIRMED' && !booking.checkInTime
                const canCheckOut = canCheckInOut && booking.status === 'CONFIRMED' && !!booking.checkInTime && !booking.checkOutTime
                const canConfirm = booking.status === 'PENDING'

                return (
                  <div key={booking.id} className="hover:bg-accent transition">
                    {/* Compact Row */}
                    <div
                      className="p-4 cursor-pointer flex items-center justify-between gap-4"
                      onClick={() => toggleExpand(booking.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-foreground truncate">
                              {booking.customer?.name || booking.customerName || 'Unknown Client'}
                            </h3>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusConfig(booking.status).badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getStatusConfig(booking.status).dot}`} />
                              {getStatusConfig(booking.status).label}
                            </span>
                            {(booking.source ?? 'platform') === 'offline' ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-foreground border border-border flex items-center gap-1">
                                <Banknote className="h-3 w-3" /> Offline
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground border border-border">
                                Platform
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {bookingDate.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', timeZone: instructorTz })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {startTime} - {endTime}
                            </span>
                            <span className="hidden sm:inline font-semibold text-foreground">
                              {formatPrice(booking.price)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="sm:hidden font-semibold text-foreground">
                          {formatPrice(booking.price)}
                        </span>
                        {isExpanded
                          ? <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          : <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        }
                      </div>
                    </div>

                    {/* Check-in/out/Confirm Quick Actions (Compact View) */}
                    {(canCheckIn || canCheckOut || canConfirm) && !isExpanded && (
                      <div className="px-4 pb-4 flex gap-2">
                        {canConfirm && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleConfirm(booking.id)
                            }}
                            className="flex-1 bg-yellow-600 text-foreground px-3 py-2 rounded-lg hover:bg-yellow-700 text-sm font-medium"
                          >
                            ⚠️ Confirm Pending Booking
                          </button>
                        )}
                        {canCheckIn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCheckIn(booking.id)
                            }}
                            className="flex-1 bg-emerald-600 text-foreground px-3 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                          >
                            ✓ Ready to Check In
                          </button>
                        )}
                        {canCheckOut && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCheckOut(booking.id)
                            }}
                            className="flex-1 bg-primary text-foreground px-3 py-2 rounded-lg hover:bg-primary/90 text-sm font-medium"
                          >
                            ✓ Ready to Check Out
                          </button>
                        )}
                      </div>
                    )}
                    {/* Show lock hint when check-in/out is available but not permitted */}
                    {!canCheckInOut && (booking.status === 'CONFIRMED') && !booking.checkOutTime && !isExpanded && (
                      <div className="px-4 pb-3">
                        <PermissionGate capability="canCheckInOut" showLockCard />
                      </div>
                    )}

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 bg-background/60 border-t border-border">
                        <div className="grid sm:grid-cols-2 gap-4 text-sm pt-4">
                          <div>
                            <h4 className="font-medium text-foreground mb-2">Client Details</h4>
                            <div className="space-y-2 text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {booking.customer?.name || booking.customerName || 'Unknown Client'}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs">📞</span>
                                {booking.customer?.phone || booking.customerPhone || 'N/A'}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs">✉️</span>
                                {booking.customer?.email || (booking as any).customerEmail || 'N/A'}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-foreground mb-2">Booking Details</h4>
                            <div className="space-y-2 text-muted-foreground">
                              <div>
                                <span className="font-medium text-foreground">Date:</span>{' '}
                                {bookingDate.toLocaleDateString('en-AU', {
                                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                                  timeZone: instructorTz,
                                })}
                              </div>
                              <div>
                                <span className="font-medium text-foreground">Time:</span> {startTime} - {endTime}
                              </div>
                              <div>
                                <span className="font-medium text-foreground">Type:</span>{' '}
                                {booking.bookingType ? booking.bookingType.replace(/_/g, ' ') : 'Standard Booking'}
                              </div>
                              <div>
                                <span className="font-medium text-foreground">Price:</span> {formatPrice(booking.price)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {(booking.pickupAddress || booking.dropoffAddress || editingId === booking.id) && (
                          <div>
                            <h4 className="font-medium text-foreground mb-2">Locations</h4>
                            <div className="space-y-2 text-sm text-muted-foreground">
                              {editingId === booking.id ? (
                                <>
                                  <div>
                                    <label className="block font-medium text-foreground mb-1">Pickup Address</label>
                                    <input
                                      type="text"
                                      value={editForm.pickupAddress || ''}
                                      onChange={(e) => setEditForm({ ...editForm, pickupAddress: e.target.value })}
                                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:outline-none"
                                      placeholder="Enter pickup address"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-medium text-foreground mb-1">Dropoff Address</label>
                                    <input
                                      type="text"
                                      value={editForm.dropoffAddress || ''}
                                      onChange={(e) => setEditForm({ ...editForm, dropoffAddress: e.target.value })}
                                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:outline-none"
                                      placeholder="Enter dropoff address"
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  {booking.pickupAddress && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-4 w-4 text-emerald-400 mt-0.5" />
                                      <div>
                                        <div className="font-medium text-foreground">Pickup</div>
                                        {booking.pickupAddress}
                                      </div>
                                    </div>
                                  )}
                                  {booking.dropoffAddress && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-4 w-4 text-destructive mt-0.5" />
                                      <div>
                                        <div className="font-medium text-foreground">Dropoff</div>
                                        {booking.dropoffAddress}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {(booking.notes || editingId === booking.id) && (
                          <div>
                            <h4 className="font-medium text-foreground mb-2">Notes</h4>
                            {editingId === booking.id ? (
                              <textarea
                                value={editForm.notes || ''}
                                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:outline-none"
                                rows={3}
                                placeholder="Add notes..."
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground italic">{booking.notes}</p>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
                          {editingId === booking.id ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); saveEdit(booking.id) }}
                                disabled={saving}
                                className="flex-1 min-w-[120px] bg-emerald-600 text-foreground px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {saving ? 'Saving...' : '✓ Save/Update'}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); cancelEdit() }}
                                disabled={saving}
                                className="flex-1 min-w-[120px] border border-border text-foreground px-4 py-2 rounded-lg hover:bg-accent disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                Cancel (No Change)
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(booking.id) }}
                                disabled={saving}
                                className="flex-1 min-w-[120px] bg-destructive text-destructive-foreground px-4 py-2 rounded-lg hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                <X className="h-4 w-4" />
                                Cancel Booking
                              </button>
                            </>
                          ) : (
                            <>
                              {canConfirm && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleConfirm(booking.id) }}
                                  className="flex-1 min-w-[120px] bg-amber-500 text-foreground px-4 py-2 rounded-lg hover:bg-amber-600 flex items-center justify-center gap-2"
                                >
                                  ⚠️ Confirm Booking
                                </button>
                              )}
                              {canCheckIn && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCheckIn(booking.id) }}
                                  className="flex-1 min-w-[120px] bg-emerald-600 text-foreground px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                                >
                                  ✓ Check In
                                </button>
                              )}
                              {canCheckOut && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCheckOut(booking.id) }}
                                  className="flex-1 min-w-[120px] bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2"
                                >
                                  ✓ Check Out
                                </button>
                              )}
                              {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
                                <>
                                  <Link
                                    href={`/dashboard/bookings/${booking.id}/reschedule`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 min-w-[120px] bg-amber-500 text-foreground px-4 py-2 rounded-lg hover:bg-amber-600 flex items-center justify-center gap-2 no-underline"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                    Reschedule
                                  </Link>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startEdit(booking) }}
                                    className="flex-1 min-w-[120px] bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleCancel(booking.id) }}
                                    className="flex-1 min-w-[120px] bg-destructive text-destructive-foreground px-4 py-2 rounded-lg hover:bg-destructive/90 flex items-center justify-center gap-2"
                                  >
                                    <X className="h-4 w-4" />
                                    Cancel
                                  </button>
                                </>
                              )}
                              {(booking.status === 'CANCELLED' || booking.status === 'COMPLETED') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(booking.id) }}
                                  className="flex-1 min-w-[120px] border border-border text-foreground px-4 py-2 rounded-lg hover:bg-accent flex items-center justify-center gap-2"
                                >
                                  <X className="h-4 w-4" />
                                  Remove from List
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
     

      {/* NF-01: Inline confirm panel — replaces all window.confirm() calls */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{pendingAction.message}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingAction(null)}
                className="flex-1 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmed}
                disabled={saving}
                className={`flex-1 py-2 text-foreground text-sm rounded-lg font-semibold transition disabled:opacity-50 ${pendingAction.confirmClass}`}
              >
                {saving ? 'Working...' : pendingAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={cn(
            'max-w-sm rounded-xl shadow-2xl px-4 py-3 text-sm text-foreground',
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-destructive',
          )}>
            {toast.message}
          </div>
        </div>
      )}
    </DashboardPageLayout>
  )
}
