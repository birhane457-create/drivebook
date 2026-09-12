import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { MessageSquare, Clock, CheckCircle, XCircle, DollarSign, Calendar } from 'lucide-react'
import Link from 'next/link'
import DashboardPageLayout from '@/components/ui/page-layout'

export const dynamic = 'force-dynamic'

export default async function QuotesPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.providerId) {
    redirect('/login')
  }

  // Only show quotes for SaaS businesses
  if (session!.user.paymentModel === 'marketplace') {
    redirect('/dashboard')
  }

  // Fetch quotes for this provider
  const quotes = await prisma.quote.findMany({
    where: {
      providerId: session!.user!.providerId,
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      booking: {
        select: {
          id: true,
          serviceId: true,
          requestDescription: true,
          preferredDate: true,
          siteAddress: true,
          requestedAt: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Group quotes by status
  const pendingQuotes = quotes.filter(q => q.status === 'PENDING')
  const acceptedQuotes = quotes.filter(q => q.status === 'ACCEPTED' || q.status === 'PENDING_PAYMENT')
  const completedQuotes = quotes.filter(q => q.status === 'PAID')
  const otherQuotes = quotes.filter(q => !['PENDING', 'ACCEPTED', 'PENDING_PAYMENT', 'PAID'].includes(q.status))

  const statusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4 text-amber-400" />
      case 'ACCEPTED': return <CheckCircle className="h-4 w-4 text-emerald-400" />
      case 'PENDING_PAYMENT': return <DollarSign className="h-4 w-4 text-primary" />
      case 'PAID': return <CheckCircle className="h-4 w-4 text-emerald-400" />
      case 'DECLINED': return <XCircle className="h-4 w-4 text-destructive" />
      case 'EXPIRED': return <Clock className="h-4 w-4 text-muted-foreground/60" />
      default: return <MessageSquare className="h-4 w-4 text-muted-foreground" />
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Awaiting Response'
      case 'ACCEPTED': return 'Accepted'
      case 'PENDING_PAYMENT': return 'Awaiting Payment'
      case 'PAID': return 'Paid'
      case 'DECLINED': return 'Declined'
      case 'EXPIRED': return 'Expired'
      case 'REVISED': return 'Revised'
      case 'CANCELLED': return 'Cancelled'
      default: return status
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'ACCEPTED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'PENDING_PAYMENT': return 'bg-sky-500/10 text-primary border-sky-500/20'
      case 'PAID': return 'bg-green-500/10 text-emerald-400 border-green-500/20'
      case 'DECLINED': return 'bg-red-500/10 text-destructive border-red-500/20'
      case 'EXPIRED': return 'bg-slate-500/10 text-muted-foreground border-slate-500/20'
      default: return 'bg-slate-500/10 text-muted-foreground border-slate-500/20'
    }
  }

  return (
    <DashboardPageLayout title="Quote Requests" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'S' }]}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Quote Requests</h1>
        <p className="text-muted-foreground">Manage customer quote requests and job inquiries</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card/80 rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-400">{pendingQuotes.length}</p>
        </div>
        <div className="bg-card/80 rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Accepted</p>
          <p className="text-2xl font-bold text-emerald-400">{acceptedQuotes.length}</p>
        </div>
        <div className="bg-card/80 rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Completed</p>
          <p className="text-2xl font-bold text-emerald-400">{completedQuotes.length}</p>
        </div>
        <div className="bg-card/80 rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total</p>
          <p className="text-2xl font-bold text-foreground">{quotes.length}</p>
        </div>
      </div>

      {/* Pending Quotes - Priority Section */}
      {pendingQuotes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-400" />
            Needs Your Response ({pendingQuotes.length})
          </h2>
          <div className="space-y-3">
            {pendingQuotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/dashboard/bookings/${quote.bookingId}`}
                className="block bg-amber-950/20 border-2 border-amber-500/30 hover:border-amber-500/50 rounded-xl p-4 transition-all hover:shadow-lg hover:shadow-amber-500/10"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-semibold text-foreground">
                        {quote.customer.name}
                      </p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(quote.status)}`}>
                        {statusIcon(quote.status)}
                        {statusLabel(quote.status)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mb-1">
                      {(quote as any).booking.requestDescription || 'Job request'}
                    </p>
                    {(quote as any).booking.siteAddress && (
                      <p className="text-xs text-muted-foreground">📍 {(quote as any).booking.siteAddress}</p>
                    )}
                    {(quote as any).booking.preferredDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Preferred: {new Date((quote as any).booking.preferredDate).toLocaleDateString('en-AU', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground/60">
                      {new Date(quote.createdAt).toLocaleDateString('en-AU', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Quotes */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">All Quotes</h2>
        {quotes.length === 0 ? (
          <div className="bg-card/80 rounded-xl border border-border p-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No quote requests yet</h3>
            <p className="text-sm text-muted-foreground">
              When customers request quotes for your services, they'll appear here.
            </p>
          </div>
        ) : (
          <div className="bg-card/80 rounded-xl border border-border overflow-hidden">
            <div className="divide-y divide-white/10">
              {quotes.map((quote) => (
                <Link
                  key={quote.id}
                  href={`/dashboard/bookings/${quote.bookingId}`}
                  className="block p-4 hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold text-foreground">
                          #{(quote as any)?.quoteNumber} — {quote.customer.name}
                        </p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(quote.status)}`}>
                          {statusIcon(quote.status)}
                          {statusLabel(quote.status)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mb-1">
                        {(quote as any).booking.requestDescription || 'Job request'}
                      </p>
                      {(quote as any).totalAmount > 0 && (
                        <p className="text-sm font-semibold text-emerald-400">
                          ${(quote as any).totalAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground/60">
                        {new Date(quote.createdAt).toLocaleDateString('en-AU', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
          </div>
</DashboardPageLayout>
  )
}
