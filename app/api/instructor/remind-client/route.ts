/**
 * POST /api/instructor/remind-client
 *
 * Sends an SMS reminder to a client who has unused package hours.
 * Called from the instructor dashboard "Clients Needing Attention" widget.
 *
 * Auth: instructor only — can only remind their own clients.
 * Rate: a client can only be reminded once every 24 hours per instructor.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDisplayName } from '@/lib/utils/account'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { clientId, bookingId } = body as { clientId?: string; bookingId?: string }

    if (!clientId && !bookingId) {
      return NextResponse.json({ error: 'clientId or bookingId required' }, { status: 400 })
    }

    // Verify the booking/client belongs to this instructor
    // Works for both package bookings and regular bookings
    const booking = await prisma.booking.findFirst({
      where: {
        instructorId: session.user.instructorId,
        ...(bookingId ? { id: bookingId } : {}),
        ...(clientId ? { clientId } : {}),
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      select: {
        id: true,
        packageHoursRemaining: true,
        client: { select: { id: true, name: true, phone: true } },
        instructor: { select: { name: true, businessName: true, subscriptionTier: true, accountType: true } },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or not eligible' }, { status: 404 })
    }

    const client = booking.client
    if (!client?.phone) {
      return NextResponse.json({ error: 'Client has no phone number on file' }, { status: 422 })
    }

    // Rate limit: check last reminder sent to this client by this instructor in past 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentReminder = await prisma.notification.findFirst({
      where: {
        type: 'LESSON_REMINDER',
        metadata: {
          path: ['reminderType'],
          equals: 'package_followup',
        },
        createdAt: { gte: oneDayAgo },
        // Link via clientId in metadata
        ...(client.id ? {
          metadata: {
            path: ['clientId'],
            equals: client.id,
          },
        } : {}),
      },
    }).catch(() => null) // non-fatal if notification table doesn't have this

    // Simpler rate limit: check audit log
    const recentAudit = await (prisma as any).auditLog.findFirst({
      where: {
        action: 'INSTRUCTOR_CLIENT_REMIND',
        actorId: session.user.instructorId,
        targetId: client.id,
        createdAt: { gte: oneDayAgo },
      },
    }).catch(() => null)

    if (recentAudit) {
      return NextResponse.json({
        error: 'A reminder was already sent to this client in the last 24 hours.',
        code: 'RATE_LIMITED',
      }, { status: 429 })
    }

    // Build the reminder message — different for package vs general clients
    const instructorDisplayName = getDisplayName(booking.instructor)
    const hoursRemaining = booking.packageHoursRemaining ?? 0
    const message = hoursRemaining > 0
      ? `Hi ${client.name.split(' ')[0]}! This is a reminder from ${instructorDisplayName} — you have ${hoursRemaining.toFixed(1)} lesson hour${hoursRemaining !== 1 ? 's' : ''} available in your package. Book your next lesson at drivebook.com.au`
      : `Hi ${client.name.split(' ')[0]}! ${instructorDisplayName} would love to see you back for another lesson. Book online at drivebook.com.au`

    // Send SMS
    const { smsService } = await import('@/lib/services/sms')
    const sent = await smsService.sendSMS({ to: client.phone, message })

    if (!sent) {
      return NextResponse.json({ error: 'SMS could not be delivered — check Twilio config' }, { status: 503 })
    }

    // Audit log — creates a record so rate limit check works
    await (prisma as any).auditLog.create({
      data: {
        action: 'INSTRUCTOR_CLIENT_REMIND',
        actorId: session.user.instructorId,
        actorRole: 'INSTRUCTOR',
        targetType: 'CLIENT',
        targetId: client.id,
        success: true,
        metadata: {
          bookingId: booking.id,
          hoursRemaining,
          clientPhone: client.phone.slice(-4).padStart(client.phone.length, '*'), // mask for log
          message: message.slice(0, 100),
        },
      },
    }).catch(() => {/* non-fatal */})

    return NextResponse.json({
      success: true,
      message: `Reminder sent to ${client.name.split(' ')[0]}`,
    })
  } catch (error) {
    console.error('[remind-client]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
