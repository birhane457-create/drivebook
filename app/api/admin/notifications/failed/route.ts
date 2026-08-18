/**
 * Admin API: Failed Notifications
 * View and retry failed notification delivery
 *
 * NOTE: Full per-booking notification tracking requires the
 * add_notification_tracking migration to be run first.
 * Until then, this route surfaces failures from the audit log.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/notifications/failed
 * List notification failures from the audit log
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Surface failures from the audit log — works without the schema migration
    const [failureLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          action: 'NOTIFICATION_FAILED',
          targetType: 'BOOKING',
          success: false,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({
        where: {
          action: 'NOTIFICATION_FAILED',
          targetType: 'BOOKING',
          success: false,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ])

    // Enrich with booking data where available
    const bookingIds = [...new Set(failureLogs.map(l => l.targetId).filter(Boolean))]
    const bookings = bookingIds.length
      ? await prisma.booking.findMany({
          where: { id: { in: bookingIds as string[] } },
          select: {
            id: true,
            status: true,
            startTime: true,
            clientName: true,
            clientPhone: true,
            instructorId: true,
          },
        })
      : []

    const bookingMap = new Map(bookings.map(b => [b.id, b]))

    return NextResponse.json({
      failures: failureLogs.map(log => ({
        id: log.id,
        bookingId: log.targetId,
        booking: log.targetId ? bookingMap.get(log.targetId) ?? null : null,
        timestamp: log.createdAt,
        error: (log as any).errorMessage ?? null,
        metadata: log.metadata,
      })),
      total,
      limit,
      offset,
      note: 'Full per-booking notification tracking available after running the add_notification_tracking migration.',
    })
  } catch (error) {
    console.error('Failed to fetch failed notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/notifications/retry
 * Log a manual retry attempt for a booking notification
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookingId } = await request.json()

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, clientName: true },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Log the manual retry attempt
    await prisma.auditLog.create({
      data: {
        action: 'NOTIFICATION_RETRY',
        actorId: session!.user.id,
        actorRole: session!.user.role,
        targetType: 'BOOKING',
        targetId: bookingId,
        success: true,
        metadata: {
          retriedBy: session!.user.email,
          note: 'Manual retry initiated from admin notifications dashboard',
        } as any,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Retry logged for booking ${bookingId}. Re-send notifications manually or via the booking detail page.`,
    })
  } catch (error) {
    console.error('Failed to log notification retry:', error)
    return NextResponse.json(
      { error: 'Failed to process retry' },
      { status: 500 }
    )
  }
}
