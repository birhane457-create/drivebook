/**
 * lib/services/waiting-list-notify.ts
 *
 * Triggers a notification to the first active waiting list entry
 * for an instructor when a slot opens (booking cancelled/expired).
 *
 * Called from:
 *   - app/api/bookings/[id]/cancel/route.ts    (instructor/admin cancel)
 *   - app/api/public/bookings/[id]/cancel/route.ts  (student self-cancel)
 *   - app/api/cron/cleanup-expired-bookings/route.ts (auto-expire)
 *
 * Non-fatal — never throws. Errors are logged but don't affect the cancel flow.
 *
 * Rate: each waiting list entry is only notified once (isActive set to false after notify).
 */

import { prisma } from '@/lib/prisma'
import { getDisplayName } from '@/lib/utils/account'

interface SlotOpenedEvent {
  instructorId: string
  /** ISO date string of the slot that opened — used to personalise the message */
  slotDate?: string | null
  /** ISO time string e.g. "14:00" */
  slotTime?: string | null
}

export async function notifyWaitingList(event: SlotOpenedEvent): Promise<void> {
  try {
    // Find the first active entry for this instructor (FIFO — oldest first)
    const entry = await (prisma as any).waitingList.findFirst({
      where: { instructorId: event.instructorId, isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!entry) return // nobody waiting

    // Fetch instructor display name for the message
    const instructor = await prisma.instructor.findUnique({
      where: { id: event.instructorId },
      select: { name: true, businessName: true, subscriptionTier: true, accountType: true },
    })

    const instructorName = instructor ? getDisplayName(instructor) : 'your instructor'

    // Build SMS message
    let slotInfo = ''
    if (event.slotDate) {
      const date = new Date(event.slotDate)
      const dateStr = date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
      slotInfo = event.slotTime
        ? ` on ${dateStr} at ${event.slotTime}`
        : ` on ${dateStr}`
    }

    const message =
      `Hi ${entry.clientName.split(' ')[0]}! A lesson slot has opened up with ${instructorName}${slotInfo}. Book now at drivebook.com.au before it's taken!`

    // Send SMS
    if (entry.clientPhone) {
      const { smsService } = await import('@/lib/services/sms')
      await smsService.sendSMS({ to: entry.clientPhone, message })
    }

    // Send email as backup
    if (entry.clientEmail) {
      const { emailService } = await import('@/lib/services/email')
      await emailService.sendGenericEmail({
        to: entry.clientEmail,
        subject: `A lesson slot has opened up with ${instructorName}`,
        html: `
          <p>Hi ${entry.clientName.split(' ')[0]},</p>
          <p>Great news — a lesson slot has just opened up with <strong>${instructorName}</strong>${slotInfo}.</p>
          <p>Book now before someone else takes it:</p>
          <p><a href="https://www.drivebook.com.au/book" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Book Now</a></p>
          <p style="color:#888;font-size:13px;">You're on the waiting list for ${instructorName}. You'll only receive one notification per opening.</p>
        `,
      }).catch(() => {/* non-fatal */})
    }

    // Mark entry as notified so we don't spam them
    await (prisma as any).waitingList.update({
      where: { id: entry.id },
      data: { isActive: false },
    })

    // Audit log
    await (prisma as any).auditLog.create({
      data: {
        action: 'WAITING_LIST_NOTIFIED',
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        targetType: 'WAITING_LIST',
        targetId: entry.id,
        success: true,
        metadata: {
          instructorId: event.instructorId,
          clientName: entry.clientName,
          slotDate: event.slotDate ?? null,
          slotTime: event.slotTime ?? null,
        },
      },
    }).catch(() => {/* non-fatal */})

  } catch (err) {
    // Never let waiting list notification failure affect the cancellation
    console.error('[waiting-list-notify] Error:', err instanceof Error ? err.message : err)
  }
}
