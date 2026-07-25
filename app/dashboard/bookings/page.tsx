'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, User, Plus, Search, ChevronDown, ChevronUp, Edit2, X, RefreshCw, Banknote, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { getStatusConfig } from '@/lib/config/booking-status'

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
  client: {
    name: string
    phone: string
    email: string
  }
  clientName?: string // offline bookings may not have a client record
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
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'platform' | 'offline'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Booking>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  // NF-01: single inline confirm state — replaces all window.confirm() calls
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  useEffect(() => {
    fetchBookings()
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
      const res = await fetch('/api/bookings')
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
    confirmClass: 'bg-red-600 hover:bg-red-700',
  })

  const handleCancel = (id: string) => requestConfirm({
    id, type: 'cancel',
    message: 'Cancel this booking? The client will be notified and any applicable refund will be processed.',
    confirmLabel: 'Cancel Booking',
    confirmClass: 'bg-red-600 hover:bg-red-700',
  })

  const handleCheckIn = (id: string) => requestConfirm({
    id, type: 'checkIn',
    message: 'Start this lesson now? This will record the check-in time.',
    confirmLabel: 'Yes, Check In',
    confirmClass: 'bg-green-600 hover:bg-green-700',
  })

  const handleCheckOut = (id: string) => requestConfirm({
    id, type: 'checkOut',
    message: 'End this lesson now? This will record the check-out time and mark the lesson complete.',
    confirmLabel: 'Yes, Check Out',
    confirmClass: 'bg-blue-600 hover:bg-blue-700',
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
    confirmClass: 'bg-green-600 hover:bg-green-700',
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

  const startEdit = (booking: Booking) => {
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
    const clientName = booking.client?.name || (booking as any).clientName || ''
    const matchesSearch = clientName.toLowerCase().includes(search.toLowerCase())
    const bookingDate = new Date(booking.startTime)
    const now = new Date()
    const matchesSource = sourceFilter === 'all' || (booking.source ?? 'platform') === sourceFilter

    if (filter === 'upcoming') return bookingDate >= now && matchesSearch && matchesSource
    if (filter === 'past') return bookingDate < now && matchesSearch && matchesSource
    return matchesSearch && matchesSource
  })

  // Status colours now come from lib/config/booking-status.ts (getStatusConfig)

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Bookings ({bookings.length})</h1>

          {/* Urgent: pending short-notice approval requests */}
          {bookings.filter(b => b.status === 'PENDING' && new Date(b.startTime) < new Date(Date.now() + 2 * 60 * 60 * 1000)).length > 0 && (
            <div className="w-full mt-4 p-4 bg-amber-950 border-2 border-amber-700 rounded-xl flex items-start gap-3">
              <span className="text-2xl shrink-0">⚡</span>
              <div className="flex-1">
                <p className="font-bold text-amber-200">Last-minute booking requests need your approval</p>
                <p className="text-sm text-amber-300 mt-0.5">
                  {bookings.filter(b => b.status === 'PENDING' && new Date(b.startTime) < new Date(Date.now() + 2 * 60 * 60 * 1000)).length} request(s) within the next 2 hours. Approve or decline below.
                </p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Link 
              href="/dashboard/bookings/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 text-sm font-medium shadow-sm shadow-blue-600/30"
            >
              <Plus className="h-4 w-4" />
              Platform Booking
            </Link>
            <Link
              href="/dashboard/bookings/new?offline=true"
              className="bg-white/10 border border-white/10 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-white/20 text-sm font-medium"
            >
              <Banknote className="h-4 w-4" />
              Offline / Cash
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search by client name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-white/10 rounded-xl bg-white/5 text-slate-100 placeholder-white/30 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 focus:outline-none"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {/* Time filter */}
              <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filter === 'all' ? 'bg-sky-600 text-white shadow-sm' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}>All</button>
              <button onClick={() => setFilter('upcoming')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filter === 'upcoming' ? 'bg-sky-600 text-white shadow-sm' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}>Upcoming</button>
              <button onClick={() => setFilter('past')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filter === 'past' ? 'bg-sky-600 text-white shadow-sm' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}>Past</button>
              {/* Source filter */}
              <div className="w-px bg-white/10 mx-1" />
              <button onClick={() => setSourceFilter('all')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${sourceFilter === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}>All Types</button>
              <button onClick={() => setSourceFilter('platform')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${sourceFilter === 'platform' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}>Platform</button>
              <button onClick={() => setSourceFilter('offline')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${sourceFilter === 'offline' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}>Offline</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-12 text-center">
            <Calendar className="h-16 w-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-white">No bookings found</h3>
            <p className="text-white/40">Create your first booking to get started</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
            <div className="divide-y divide-white/[0.06]">
              {filteredBookings.map((booking) => {
                const isExpanded = expandedId === booking.id
                const bookingDate = new Date(booking.startTime)
                const startTime = bookingDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
                const endTime = new Date(booking.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
                const canCheckIn = booking.status === 'CONFIRMED' && !booking.checkInTime
                const canCheckOut = booking.checkInTime && !booking.checkOutTime
                const canConfirm = booking.status === 'PENDING'

                return (
                  <div key={booking.id} className="hover:bg-slate-900 transition">
                    {/* Compact Row */}
                    <div 
                      className="p-4 cursor-pointer flex items-center justify-between gap-4"
                      onClick={() => toggleExpand(booking.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-sky-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">
                              {booking.client?.name || (booking as any).clientName || 'Unknown Client'}
                            </h3>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusConfig(booking.status).badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getStatusConfig(booking.status).dot}`} />
                              {getStatusConfig(booking.status).label}
                            </span>
                            {/* Source badge */}
                            {(booking.source ?? 'platform') === 'offline' ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1">
                                <Banknote className="h-3 w-3 text-slate-200" /> Offline
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-200 border border-slate-700">
                                Platform
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {bookingDate.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {startTime} - {endTime}
                            </span>
                            <span className="hidden sm:inline font-semibold text-slate-100">
                              {formatPrice(booking.price)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="sm:hidden font-semibold text-slate-100">
                          {formatPrice(booking.price)}
                        </span>
                        {isExpanded ? 
                          <ChevronUp className="h-5 w-5 text-slate-500" /> : 
                          <ChevronDown className="h-5 w-5 text-slate-500" />
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
                            className="flex-1 bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 text-sm font-medium"
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
                            className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
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
                            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                          >
                            ✓ Ready to Check Out
                          </button>
                        )}
                      </div>
                    )}

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 bg-white/[0.02] border-t border-white/[0.06]">
                        <div className="grid sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <h4 className="font-medium text-slate-100 mb-2">Client Details</h4>
                            <div className="space-y-2 text-slate-400">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {booking.client?.name || (booking as any).clientName || 'Unknown Client'}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs">📞</span>
                                {booking.client?.phone || (booking as any).clientPhone || 'N/A'}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs">✉️</span>
                                {booking.client?.email || (booking as any).clientEmail || 'N/A'}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-slate-100 mb-2">Booking Details</h4>
                            <div className="space-y-2 text-slate-400">
                              <div>
                                <span className="font-medium">Date:</span> {bookingDate.toLocaleDateString('en-AU', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </div>
                              <div>
                                <span className="font-medium">Time:</span> {startTime} - {endTime}
                              </div>
                              <div>
                                <span className="font-medium">Type:</span> {booking.bookingType ? booking.bookingType.replace(/_/g, ' ') : 'Standard Lesson'}
                              </div>
                              <div>
                                <span className="font-medium">Price:</span> {formatPrice(booking.price)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {(booking.pickupAddress || booking.dropoffAddress || editingId === booking.id) && (
                          <div>
                            <h4 className="font-medium text-slate-100 mb-2">Locations</h4>
                            <div className="space-y-2 text-sm text-slate-400">
                              {editingId === booking.id ? (
                                <>
                                  <div>
                                    <label className="block font-medium text-slate-100 mb-1">Pickup Address</label>
                                    <input
                                      type="text"
                                      value={editForm.pickupAddress || ''}
                                      onChange={(e) => setEditForm({ ...editForm, pickupAddress: e.target.value })}
                                      className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                      placeholder="Enter pickup address"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-medium text-slate-100 mb-1">Dropoff Address</label>
                                    <input
                                      type="text"
                                      value={editForm.dropoffAddress || ''}
                                      onChange={(e) => setEditForm({ ...editForm, dropoffAddress: e.target.value })}
                                      className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
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
                                        <div className="font-medium text-slate-100">Pickup</div>
                                        {booking.pickupAddress}
                                      </div>
                                    </div>
                                  )}
                                  {booking.dropoffAddress && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-4 w-4 text-rose-400 mt-0.5" />
                                      <div>
                                        <div className="font-medium text-slate-100">Dropoff</div>
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
                            <h4 className="font-medium text-slate-100 mb-2">Notes</h4>
                            {editingId === booking.id ? (
                              <textarea
                                value={editForm.notes || ''}
                                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                rows={3}
                                placeholder="Add notes..."
                              />
                            ) : (
                              <p className="text-sm text-slate-400 italic">{booking.notes}</p>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t flex-wrap">
                          {editingId === booking.id ? (
                            // Edit Mode Buttons
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  saveEdit(booking.id)
                                }}
                                disabled={saving}
                                className="flex-1 min-w-[120px] bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {saving ? 'Saving...' : '✓ Save/Update'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  cancelEdit()
                                }}
                                disabled={saving}
                                className="flex-1 min-w-[120px] border border-slate-700 text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                Cancel (No Change)
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(booking.id)
                                }}
                                disabled={saving}
                                className="flex-1 min-w-[120px] bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                <X className="h-4 w-4" />
                                Cancel Booking
                              </button>
                            </>
                          ) : (
                            // View Mode Buttons
                            <>
                              {canConfirm && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleConfirm(booking.id)
                                  }}
                                  className="flex-1 min-w-[120px] bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 flex items-center justify-center gap-2"
                                >
                                  ⚠️ Confirm Booking
                                </button>
                              )}
                              {canCheckIn && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCheckIn(booking.id)
                                  }}
                                  className="flex-1 min-w-[120px] bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                                >
                                  ✓ Check In
                                </button>
                              )}
                              {canCheckOut && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCheckOut(booking.id)
                                  }}
                                  className="flex-1 min-w-[120px] bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                                >
                                  ✓ Check Out
                                </button>
                              )}
                              {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
                                <>
                                  <Link
                                    href={`/dashboard/bookings/${booking.id}/reschedule`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 min-w-[120px] bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 flex items-center justify-center gap-2"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                    Reschedule
                                  </Link>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      startEdit(booking)
                                    }}
                                    className="flex-1 min-w-[120px] bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCancel(booking.id)
                                    }}
                                    className="flex-1 min-w-[120px] bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                                  >
                                    <X className="h-4 w-4" />
                                    Cancel
                                  </button>
                                </>
                              )}
                              {/* Remove from view (soft delete) — for cancelled/past bookings */}
                              {(booking.status === 'CANCELLED' || booking.status === 'COMPLETED') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDelete(booking.id)
                                  }}
                                  className="flex-1 min-w-[120px] border border-slate-700 text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center justify-center gap-2"
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
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200">{pendingAction.message}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingAction(null)}
                className="flex-1 py-2 border border-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmed}
                disabled={saving}
                className={`flex-1 py-2 text-white text-sm rounded-lg font-semibold transition disabled:opacity-50 ${pendingAction.confirmClass}`}
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
          <div className={`max-w-sm rounded-lg shadow-lg px-4 py-3 text-sm text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  )
}
