'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, User, Plus, Search, ChevronDown, ChevronUp, Edit2, X } from 'lucide-react'
import Link from 'next/link'

interface Booking {
  id: string
  startTime: string
  endTime: string
  status: string
  bookingType: string
  pickupAddress?: string
  dropoffAddress?: string
  price: number
  notes?: string
  checkInTime?: string
  checkOutTime?: string
  client: {
    name: string
    phone: string
    email: string
  }
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Booking>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/bookings')
      const data = await res.json()
      setBookings(data)
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this booking? This action cannot be undone.')) return
    
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Deleted by instructor' })
      })

      if (res.ok) {
        fetchBookings()
      }
    } catch (error) {
      console.error('Failed to delete booking:', error)
    }
  }

  const handleCheckIn = async (id: string) => {
    if (!confirm('Start this lesson now?')) return
    
    try {
      const res = await fetch(`/api/bookings/${id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: 'Web check-in' })
      })

      if (res.ok) {
        alert('Checked in successfully!')
        fetchBookings()
      } else {
        const error = await res.json()
        alert(error.error || 'Check-in failed')
      }
    } catch (error) {
      console.error('Failed to check in:', error)
      alert('Check-in failed')
    }
  }

  const handleCheckOut = async (id: string) => {
    if (!confirm('End this lesson now?')) return
    
    try {
      const res = await fetch(`/api/bookings/${id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: 'Web check-out' })
      })

      if (res.ok) {
        alert('Checked out successfully!')
        fetchBookings()
      } else {
        const error = await res.json()
        alert(error.error || 'Check-out failed')
      }
    } catch (error) {
      console.error('Failed to check out:', error)
      alert('Check-out failed')
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

  const saveEdit = async (id: string) => {
    if (!confirm('Save changes to this booking?')) return
    
    setSaving(true)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      if (res.ok) {
        alert('Booking updated successfully!')
        setEditingId(null)
        setEditForm({})
        fetchBookings()
      } else {
        const error = await res.json()
        alert(error.error || 'Update failed')
      }
    } catch (error) {
      console.error('Failed to update booking:', error)
      alert('Update failed')
    } finally {
      setSaving(false)
    }
  }

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = booking.client.name.toLowerCase().includes(search.toLowerCase())
    const bookingDate = new Date(booking.startTime)
    const now = new Date()
    
    if (filter === 'upcoming') return bookingDate >= now && matchesSearch
    if (filter === 'past') return bookingDate < now && matchesSearch
    return matchesSearch
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-100 text-green-800'
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED': return 'bg-blue-100 text-blue-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Bookings ({bookings.length})</h1>
          <Link 
            href="/dashboard/bookings/new"
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            New Booking
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search by client name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('upcoming')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg ${filter === 'upcoming' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
              >
                Upcoming
              </button>
              <button
                onClick={() => setFilter('past')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg ${filter === 'past' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
              >
                Past
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No bookings found</h3>
            <p className="text-gray-600">Create your first booking to get started</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="divide-y">
              {filteredBookings.map((booking) => {
                const isExpanded = expandedId === booking.id
                const bookingDate = new Date(booking.startTime)
                const startTime = bookingDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                const endTime = new Date(booking.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                const canCheckIn = booking.status === 'CONFIRMED' && !booking.checkInTime
                const canCheckOut = booking.checkInTime && !booking.checkOutTime

                return (
                  <div key={booking.id} className="hover:bg-gray-50 transition">
                    {/* Compact Row */}
                    <div 
                      className="p-4 cursor-pointer flex items-center justify-between gap-4"
                      onClick={() => toggleExpand(booking.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{booking.client.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(booking.status)}`}>
                              {booking.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {bookingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {startTime} - {endTime}
                            </span>
                            <span className="hidden sm:inline font-semibold text-blue-600">
                              ${booking.price}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="sm:hidden font-semibold text-blue-600">
                          ${booking.price}
                        </span>
                        {isExpanded ? 
                          <ChevronUp className="h-5 w-5 text-gray-400" /> : 
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        }
                      </div>
                    </div>

                    {/* Check-in/out Quick Actions (Compact View) */}
                    {(canCheckIn || canCheckOut) && !isExpanded && (
                      <div className="px-4 pb-4 flex gap-2">
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
                      <div className="px-4 pb-4 space-y-4 bg-gray-50">
                        <div className="grid sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Client Details</h4>
                            <div className="space-y-2 text-gray-600">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {booking.client.name}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs">📞</span>
                                {booking.client.phone}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs">✉️</span>
                                {booking.client.email}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Booking Details</h4>
                            <div className="space-y-2 text-gray-600">
                              <div>
                                <span className="font-medium">Date:</span> {bookingDate.toLocaleDateString('en-US', {
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
                                <span className="font-medium">Type:</span> {booking.bookingType.replace('_', ' ')}
                              </div>
                              <div>
                                <span className="font-medium">Price:</span> ${booking.price}
                              </div>
                            </div>
                          </div>
                        </div>

                        {(booking.pickupAddress || booking.dropoffAddress || editingId === booking.id) && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Locations</h4>
                            <div className="space-y-2 text-sm text-gray-600">
                              {editingId === booking.id ? (
                                <>
                                  <div>
                                    <label className="block font-medium text-gray-700 mb-1">Pickup Address</label>
                                    <input
                                      type="text"
                                      value={editForm.pickupAddress || ''}
                                      onChange={(e) => setEditForm({ ...editForm, pickupAddress: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      placeholder="Enter pickup address"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-medium text-gray-700 mb-1">Dropoff Address</label>
                                    <input
                                      type="text"
                                      value={editForm.dropoffAddress || ''}
                                      onChange={(e) => setEditForm({ ...editForm, dropoffAddress: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      placeholder="Enter dropoff address"
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  {booking.pickupAddress && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-4 w-4 text-green-600 mt-0.5" />
                                      <div>
                                        <div className="font-medium text-gray-700">Pickup</div>
                                        {booking.pickupAddress}
                                      </div>
                                    </div>
                                  )}
                                  {booking.dropoffAddress && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-4 w-4 text-red-600 mt-0.5" />
                                      <div>
                                        <div className="font-medium text-gray-700">Dropoff</div>
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
                            <h4 className="font-medium text-gray-700 mb-2">Notes</h4>
                            {editingId === booking.id ? (
                              <textarea
                                value={editForm.notes || ''}
                                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={3}
                                placeholder="Add notes..."
                              />
                            ) : (
                              <p className="text-sm text-gray-600 italic">{booking.notes}</p>
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
                                className="flex-1 min-w-[120px] border border-gray-400 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                Cancel (No Change)
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCancel(booking.id)
                                }}
                                disabled={saving}
                                className="flex-1 min-w-[120px] bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                <X className="h-4 w-4" />
                                Delete Booking
                              </button>
                            </>
                          ) : (
                            // View Mode Buttons
                            <>
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
      </div>
    </div>
  )
}
