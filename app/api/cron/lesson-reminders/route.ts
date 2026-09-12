import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyLessonReminderInstructor, notifyLessonReminderStudent } from '@/lib/services/notifications';
import { emailService } from '@/lib/services/email';
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health';
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

export const dynamic = 'force-dynamic';

/**
 * Lesson Reminder Cron
 * Runs daily at 10pm UTC (8am AEST next day).
 * Sends reminders to instructors and students for lessons starting in the next 23–25 hours.
 *
 * SMS policy:
 *   - Student: 1x SMS reminder (24hrs before)
 *   - Instructor: 1x SMS reminder (24hrs before)
 *   - No SMS on booking confirmation for instructor — in-app notification only
 *
 * Offline bookings: uses clientPhone/customerEmail stored directly on the booking
 * (no DriveBook account required for the student).
 *
 * Schedule: "0 22 * * *" in vercel.json
 */
export async function GET(req: NextRequest) {
  try {
    // P1-9 FIX: Both conditions must be checked together.
    // If CRON_SECRET is unset the previous guard (process.env.CRON_SECRET && ...)
    // short-circuits to false and lets anyone trigger this cron unauthenticated.
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const bookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        startTime: { gte: windowStart, lte: windowEnd },
      },
      include: {
        provider: { select: { userId: true, name: true, businessName: true, accountType: true, phone: true, timezone: true } },
        customer: { include: { user: { select: { id: true, email: true } } } },
      },
    });

    const { smsService } = await import('@/lib/services/sms');
    const { getDisplayName } = await import('@/lib/utils/account');

    let sent = 0;
    let failed = 0;

    for (const booking of bookings) {
      try {
        const startTime = booking.startTime!;
        const customerName = booking.customerName || booking.customer?.name || 'Student';
        const instructorName = getDisplayName(booking.provider);
        const pickupAddress = booking.pickupAddress ?? undefined;
        const isOffline = (booking as any).source === 'offline';

        // ── Instructor notifications ──────────────────────────────────────────
        // In-app notification (platform bookings only — offline students have no account)
        if (!isOffline && booking.provider.userId) {
          await notifyLessonReminderInstructor(
            booking.provider.userId,
            customerName,
            booking.id,
            startTime
          );
        }

        // SMS reminder to instructor (all bookings — instructor always has a phone)
        if (booking.provider.phone) {
          await smsService.sendLessonReminderInstructor({
            instructorPhone: booking.provider.phone,
            instructorName,
            customerName,
            startTime,
            pickupAddress,
          }).catch(e => console.error(`Instructor SMS failed for ${booking.id}:`, e));
        }

        // Email reminder to instructor (via in-app notification system — already handled above)
        // Additional direct email for offline bookings where instructor may want a record
        if (isOffline && booking.provider.userId) {
          // Instructor already gets in-app; no extra email needed
        }

        // ── Student notifications ─────────────────────────────────────────────
        const studentUserId = booking.customer?.user?.id;
        const studentPhone = booking.customerPhone || booking.customer?.user ? null : null;
        // For platform bookings: use client.user.id for in-app + client phone for SMS
        // For offline bookings: use clientPhone/customerEmail stored on booking directly

        // In-app notification (platform students only)
        if (!isOffline && studentUserId) {
          await notifyLessonReminderStudent(
            studentUserId,
            instructorName,
            booking.id,
            startTime
          );
        }

        // SMS reminder to student
        const customerPhone = booking.customerPhone || (booking as any).customer?.phone;
        if (customerPhone) {
          await smsService.sendLessonReminderStudent({
            customerPhone,
            customerName,
            instructorName,
            startTime,
            pickupAddress,
          }).catch(e => console.error(`Student SMS failed for ${booking.id}:`, e));
        }

        // Email reminder to student (offline students — send directly to stored email)
        if (isOffline) {
          // customerEmail is stored on the booking for offline bookings
          const offlineEmail = (booking as any).customerEmail;
          if (offlineEmail) {
            const tz = resolveTimezone(booking.provider?.timezone ?? DEFAULT_TIMEZONE);
            const dateStr = startTime.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz });
            const timeStr = startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: tz });
            await emailService.sendGenericEmail({
              from: 'DriveBook Bookings <bookings@drivebook.com.au>',
              to: offlineEmail,
              subject: `Reminder: Driving lesson tomorrow with ${instructorName}`,
              html: `
                <p>Hi ${customerName},</p>
                <p>This is a reminder that your driving lesson with <strong>${instructorName}</strong> is tomorrow.</p>
                <p><strong>Date:</strong> ${dateStr}<br>
                <strong>Time:</strong> ${timeStr}${pickupAddress ? `<br><strong>Pickup:</strong> ${pickupAddress}` : ''}</p>
                <p>See you then!</p>
              `,
            }).catch(e => console.error(`Offline student email failed for ${booking.id}:`, e));
          }
        }

        sent++;
      } catch (err) {
        console.error(`Reminder failed for booking ${booking.id}:`, err);
        failed++;
      }
    }

    console.log(`✅ Lesson reminders: ${sent} sent, ${failed} failed, ${bookings.length} total`);
    await pingCronHealth('lesson-reminders');
    return NextResponse.json({ success: true, sent, failed, total: bookings.length });
  } catch (error) {
    console.error('Lesson reminders cron error:', error);
    await failCronHealth('lesson-reminders', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
