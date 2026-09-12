'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import PageLayout from '@/components/ui/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, CheckCircle, XCircle, Clock, DollarSign, TrendingUp, Search, Phone, Mail, Copy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Booking {
  id: string
  status: string
  cancellationStatus: string
  cancellationRequestedAt: string
  cancellationRequestedBy: string
  cancellationReason: string | null
  adminReviewedAt: string | null
  adminReviewedBy: string | null
  adminReviewNote: string | null
  adminOverrideAmount: number | null
  packageTotalPaid: number
  packageHoursUsed: number
  packageHours: number
  startTime: string
  customer: {
    user: { name: string; email: string }
    phone?: string
  }
  provider: {
    user: { name: string; email: string }
  }
}

interface Stats {
  pendingCount: number
  approvedToday: number
  rejectedToday: number
  totalRefundedToday: string
  avgApprovalTimeHours: string
}

export default function CancellationsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('pending')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [overrideAmount, setOverrideAmount] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (session?.user?.role !== 'SUPER_ADMIN' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, router])

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchBookings(activeTab.toUpperCase())
  }, [activeTab])

  useEffect(() => {
    // Filter bookings based on search query
    if (!searchQuery.trim()) {
      setFilteredBookings(bookings)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = bookings.filter((booking) => {
      return (
        booking.customer.user.name.toLowerCase().includes(query) ||
        booking.customer.user.email.toLowerCase().includes(query) ||
        booking.provider.user.name.toLowerCase().includes(query) ||
        booking.provider.user.email.toLowerCase().includes(query) ||
        booking.id.toLowerCase().includes(query)
      )
    })
    setFilteredBookings(filtered)
  }, [searchQuery, bookings])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/cancellations/stats')
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchBookings = async (status: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/cancellations?status=${status}`)
      const data = await res.json()
      setBookings(data.bookings || [])
      setFilteredBookings(data.bookings || [])
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedBooking) return
    
    try {
      setProcessing(true)
      const res = await fetch(`/api/admin/cancellations/${selectedBooking.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideAmount: overrideAmount ? parseFloat(overrideAmount) : undefined,
          adminNote,
        }),
      })

      if (!res.ok) throw new Error('Failed to approve cancellation')

      const data = await res.json()
      alert(`✅ ${data.message}`)
      setShowApproveDialog(false)
      setSelectedBooking(null)
      setOverrideAmount('')
      setAdminNote('')
      fetchBookings(activeTab.toUpperCase())
      fetchStats()
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedBooking || !rejectReason.trim()) return

    try {
      setProcessing(true)
      const res = await fetch(`/api/admin/cancellations/${selectedBooking.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })

      if (!res.ok) throw new Error('Failed to reject cancellation')

      const data = await res.json()
      alert(`✅ ${data.message}`)
      setShowRejectDialog(false)
      setSelectedBooking(null)
      setRejectReason('')
      fetchBookings(activeTab.toUpperCase())
      fetchStats()
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
    } finally {
      setProcessing(false)
    }
  }

  const calculateRefund = (booking: Booking) => {
    const totalPaid = booking.packageTotalPaid || 0
    const hoursUsed = booking.packageHoursUsed || 0
    const totalHours = booking.packageHours || 1
    const hourlyRate = totalPaid / totalHours
    const baseRefund = totalPaid - (hoursUsed * hourlyRate)
    return baseRefund.toFixed(2)
  }

  const getRefundBreakdown = (booking: Booking) => {
    const totalPaid = booking.packageTotalPaid || 0
    const hoursUsed = booking.packageHoursUsed || 0
    const totalHours = booking.packageHours || 1
    const hourlyRate = totalPaid / totalHours
    const usedAmount = hoursUsed * hourlyRate
    const refundableBase = totalPaid - usedAmount
    
    return {
      totalPaid: totalPaid.toFixed(2),
      hourlyRate: hourlyRate.toFixed(2),
      hoursUsed,
      usedAmount: usedAmount.toFixed(2),
      refundableBase: refundableBase.toFixed(2),
      finalRefund: refundableBase.toFixed(2)
    }
  }

  const isOverdue = (booking: Booking) => {
    if (booking.cancellationStatus !== 'PENDING') return false
    const requestedAt = new Date(booking.cancellationRequestedAt)
    const hoursSince = (Date.now() - requestedAt.getTime()) / (1000 * 60 * 60)
    return hoursSince > 24
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    alert(`✅ Copied ${label} to clipboard`)
  }

  const renderBookingCard = (booking: Booking) => {
    const breakdown = getRefundBreakdown(booking)
    const overdue = isOverdue(booking)

    return (
      <Card 
        key={booking.id} 
        className={`mb-6 ${overdue ? 'border-red-500 border-2' : ''}`}
      >
        {overdue && (
          <div className="bg-red-100 dark:bg-red-900/30 px-4 py-2 text-sm text-red-800 dark:text-red-200 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            ⚠️ OVERDUE: Pending &gt; 24 hours
          </div>
        )}
        
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg mb-1">
                {booking.customer.user.name} → {booking.provider.user.name}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Requested {formatDistanceToNow(new Date(booking.cancellationRequestedAt))} ago
              </CardDescription>
            </div>
            <Badge variant={
              booking.cancellationStatus === 'PENDING' ? 'warning' :
              booking.cancellationStatus === 'APPROVED' ? 'success' : 'destructive'
            }>
              {booking.cancellationStatus}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Customer Contact */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg space-y-2">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Customer Contact
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-blue-600" />
              <a 
                href={`mailto:${booking.customer.user.email}`}
                className="text-blue-600 dark:text-blue-400 hover:underline flex-1"
              >
                {booking.customer.user.email}
              </a>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(booking.customer.user.email, 'email')}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            {booking.customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-blue-600" />
                <a 
                  href={`tel:${booking.customer.phone}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline flex-1"
                >
                  {booking.customer.phone}
                </a>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 w-6 p-0"
                  onClick={() => copyToClipboard(booking.customer.phone!, 'phone')}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Refund Calculation Breakdown */}
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-2">
            <p className="text-sm font-semibold text-green-900 dark:text-green-200 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Refund Calculation
            </p>
            <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Package total paid:</span>
                <span className="font-mono">${breakdown.totalPaid}</span>
              </div>
              <div className="flex justify-between">
                <span>Hours used:</span>
                <span className="font-mono">{breakdown.hoursUsed} / {booking.packageHours}hr</span>
              </div>
              <div className="flex justify-between">
                <span>Hourly rate:</span>
                <span className="font-mono">${breakdown.hourlyRate}/hr</span>
              </div>
              <div className="flex justify-between text-red-600 dark:text-red-400">
                <span>Amount for used hours:</span>
                <span className="font-mono">-${breakdown.usedAmount}</span>
              </div>
              <div className="border-t border-gray-300 dark:border-gray-600 my-1 pt-1"></div>
              <div className="flex justify-between font-bold text-green-700 dark:text-green-300 text-base">
                <span>Refundable amount:</span>
                <span className="font-mono">${breakdown.finalRefund}</span>
              </div>
            </div>
          </div>

          {/* Customer Reason */}
          {booking.cancellationReason && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-1">Customer Reason:</p>
              <p className="text-sm text-muted-foreground italic">&quot;{booking.cancellationReason}&quot;</p>
            </div>
          )}

          {/* Admin Note */}
          {booking.adminReviewNote && (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
              <p className="text-sm font-medium mb-1 text-purple-900 dark:text-purple-200">Admin Note:</p>
              <p className="text-sm text-purple-700 dark:text-purple-300">{booking.adminReviewNote}</p>
            </div>
          )}

          {/* Action Buttons */}
          {booking.cancellationStatus === 'PENDING' && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1 min-w-[120px]"
                onClick={() => {
                  setSelectedBooking(booking)
                  setShowApproveDialog(true)
                }}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 min-w-[120px]"
                onClick={() => {
                  setSelectedBooking(booking)
                  setShowRejectDialog(true)
                }}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/admin/bookings/${booking.id}`)}
              >
                View Details
              </Button>
            </div>
          )}

          {/* Booking ID (small footer) */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Booking ID: <span className="font-mono">{booking.id}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <PageLayout
      title="Package Cancellations"
      description="Review and approve cancellation requests with refund calculations"
    >
      <div className="space-y-6">
        
        {/* Stats Widgets */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className={stats.pendingCount > 5 ? 'border-yellow-500 border-2' : ''}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Pending Requests</CardDescription>
                <CardTitle className="text-3xl font-bold">{stats.pendingCount}</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.pendingCount > 5 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    High volume
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Approved Today</CardDescription>
                <CardTitle className="text-3xl font-bold text-green-600">{stats.approvedToday}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Refunds issued</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Rejected Today</CardDescription>
                <CardTitle className="text-3xl font-bold text-red-600">{stats.rejectedToday}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Requests denied</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Refunded Today</CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center gap-1">
                  <DollarSign className="w-5 h-5" />{stats.totalRefundedToday}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Total issued</p>
              </CardContent>
            </Card>

            <Card className={parseFloat(stats.avgApprovalTimeHours) > 24 ? 'border-yellow-500 border-2' : ''}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Avg Approval Time</CardDescription>
                <CardTitle className="text-2xl font-bold">{stats.avgApprovalTimeHours}h</CardTitle>
              </CardHeader>
              <CardContent>
                {parseFloat(stats.avgApprovalTimeHours) > 24 ? (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Above target
                  </p>
                ) : (
                  <p className="text-xs text-green-600 dark:text-green-400">On target</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by customer, instructor, email, or booking ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending {stats && stats.pendingCount > 0 && `(${stats.pendingCount})`}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Rejected
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {loading ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Loading...</p>
                </CardContent>
              </Card>
            ) : filteredBookings.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{searchQuery ? 'No matching cancellation requests' : 'No pending cancellation requests'}</p>
                </CardContent>
              </Card>
            ) : (
              <div>
                {searchQuery && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Showing {filteredBookings.length} of {bookings.length} results
                  </p>
                )}
                {filteredBookings.map(renderBookingCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="mt-6">
            {loading ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Loading...</p>
                </CardContent>
              </Card>
            ) : filteredBookings.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <p>{searchQuery ? 'No matching approved cancellations' : 'No approved cancellations'}</p>
                </CardContent>
              </Card>
            ) : (
              <div>
                {searchQuery && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Showing {filteredBookings.length} of {bookings.length} results
                  </p>
                )}
                {filteredBookings.map(renderBookingCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="mt-6">
            {loading ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Loading...</p>
                </CardContent>
              </Card>
            ) : filteredBookings.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <p>{searchQuery ? 'No matching rejected cancellations' : 'No rejected cancellations'}</p>
                </CardContent>
              </Card>
            ) : (
              <div>
                {searchQuery && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Showing {filteredBookings.length} of {bookings.length} results
                  </p>
                )}
                {filteredBookings.map(renderBookingCard)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve Cancellation</DialogTitle>
            <DialogDescription>
              Review and approve this cancellation request. Refund will be issued to customer&apos;s card.
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded space-y-2">
                <p><strong>Customer:</strong> {selectedBooking.customer.user.name}</p>
                <p><strong>Email:</strong> {selectedBooking.customer.user.email}</p>
                <p><strong>Package:</strong> {selectedBooking.packageHours}hr (used {selectedBooking.packageHoursUsed}hr)</p>
                <div className="pt-2 border-t">
                  <p className="text-lg font-bold text-green-600">Calculated Refund: ${calculateRefund(selectedBooking)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="overrideAmount">Override Amount (optional)</Label>
                <Input
                  id="overrideAmount"
                  type="number"
                  step="0.01"
                  placeholder="Leave blank to use calculated amount"
                  value={overrideAmount}
                  onChange={(e) => setOverrideAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use this for goodwill adjustments or special cases
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNote">Admin Note (optional)</Label>
                <Textarea
                  id="adminNote"
                  placeholder="Internal note for audit trail..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? 'Processing...' : 'Approve & Issue Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Cancellation</DialogTitle>
            <DialogDescription>
              Explain why this cancellation cannot be approved. Customer will receive this reason.
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded space-y-2">
                <p><strong>Customer:</strong> {selectedBooking.customer.user.name}</p>
                <p><strong>Package:</strong> {selectedBooking.packageHours}hr (used {selectedBooking.packageHoursUsed}hr)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectReason">Rejection Reason *</Label>
                <Textarea
                  id="rejectReason"
                  placeholder="E.g., 'Cancellation window has passed' or 'Package already partially used beyond refund eligibility'"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This message will be sent to the customer via email
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || !rejectReason.trim()}
            >
              {processing ? 'Processing...' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}