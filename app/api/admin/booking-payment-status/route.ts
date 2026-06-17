import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/booking-payment-status
 *
 * Returns breakdown of bookings by payment source and status.
 * Helps admin understand payment health at a glance.
 *
 * Returns:
 * {
 *   platformStripe: { count, value, avgPrice },
 *   platformWallet: { count, value },
 *   offlineCash: { count, value },
 *   offlineBankTransfer: { count, value },
 *   pendingPayment: { count, value, minutesToExpire: [] },
 *   expiredBookings: { count, value },
 *   summary: { totalBookings, totalValue, platformFeeCollected }
 * }
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  try {
    // Fetch all relevant bookings from last 24 hours
    const bookings = await prisma.booking.findMany({
      where: {
        createdAt: { gte: last24Hours },
        deletedAt: null,
      },
      select: {
        id: true,
        source: true,
        status: true,
        price: true,
        platformFee: true,
        offlinePaymentMethod: true,
        offlineAmountPaid: true,
        paymentIntentId: true,
        createdAt: true,
      },
    })

    // Categorize bookings
    const platformStripe: any = { count: 0, totalValue: 0, prices: [] }
    const platformWallet: any = { count: 0, totalValue: 0 }
    const offlineCash: any = { count: 0, totalValue: 0 }
    const offlineBankTransfer: any = { count: 0, totalValue: 0 }
    const pendingPayment: any = { count: 0, totalValue: 0, minutesToExpire: [] }
    const expiredBookings: any = { count: 0, totalValue: 0 }

    let totalPlatformFee = 0

    for (const booking of bookings) {
      // Offline bookings
      if (booking.source === 'offline') {
        if (booking.offlinePaymentMethod === 'cash') {
          offlineCash.count += 1
          offlineCash.totalValue += booking.offlineAmountPaid || 0
        } else if (booking.offlinePaymentMethod === 'bank_transfer') {
          offlineBankTransfer.count += 1
          offlineBankTransfer.totalValue += booking.offlineAmountPaid || 0
        }
      }

      // Platform bookings
      if (booking.source === 'platform') {
        totalPlatformFee += booking.platformFee || 0

        if (booking.status === 'PENDING_PAYMENT') {
          // Calculate time until expiry (10 minutes from creation)
          const expiryTime = new Date(booking.createdAt.getTime() + 10 * 60 * 1000)
          const minutesLeft = Math.floor((expiryTime.getTime() - now.getTime()) / (60 * 1000))

          pendingPayment.count += 1
          pendingPayment.totalValue += booking.price || 0
          pendingPayment.minutesToExpire.push({
            bookingId: booking.id,
            minutesLeft: Math.max(0, minutesLeft),
            expired: minutesLeft < 0,
          })
        } else if (booking.status === 'EXPIRED') {
          expiredBookings.count += 1
          expiredBookings.totalValue += booking.price || 0
        } else if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') {
          // Determine if paid by Stripe or wallet
          if (booking.paymentIntentId) {
            // Stripe payment
            platformStripe.count += 1
            platformStripe.totalValue += booking.price || 0
            platformStripe.prices.push(booking.price || 0)
          } else {
            // Wallet payment
            platformWallet.count += 1
            platformWallet.totalValue += booking.price || 0
          }
        }
      }
    }

    // Calculate averages
    const calculateAvg = (total: number, count: number) => count > 0 ? total / count : 0
    platformStripe.avgPrice = calculateAvg(platformStripe.totalValue, platformStripe.count)
    delete platformStripe.prices // don't return raw prices array

    return NextResponse.json({
      platformStripe: {
        count: platformStripe.count,
        totalValue: platformStripe.totalValue,
        avgPrice: platformStripe.avgPrice,
        label: 'Platform (Stripe)',
      },
      platformWallet: {
        count: platformWallet.count,
        totalValue: platformWallet.totalValue,
        label: 'Platform (Wallet)',
      },
      offlineCash: {
        count: offlineCash.count,
        totalValue: offlineCash.totalValue,
        label: 'Offline (Cash)',
      },
      offlineBankTransfer: {
        count: offlineBankTransfer.count,
        totalValue: offlineBankTransfer.totalValue,
        label: 'Offline (Bank Transfer)',
      },
      pendingPayment: {
        count: pendingPayment.count,
        totalValue: pendingPayment.totalValue,
        expiringBookings: pendingPayment.minutesToExpire.filter((b: any) => b.minutesLeft < 10),
        allBookings: pendingPayment.minutesToExpire,
        label: 'Awaiting Payment (expires in 10 min)',
      },
      expiredBookings: {
        count: expiredBookings.count,
        totalValue: expiredBookings.totalValue,
        label: 'Expired (Unpaid)',
      },
      summary: {
        totalBookings: bookings.length,
        totalValue: bookings.reduce((sum, b) => sum + (b.price || 0), 0),
        platformFeeCollected: totalPlatformFee,
        timeRange: '24 hours',
      },
    })
  } catch (error) {
    console.error('Booking payment status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
