import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyLessonReminderInstructor, notifyLessonReminderStudent } from '@/lib/services/notifications';

export const dynamic = 'force-dynamic';

/**
 * Lesson Reminder Cron
 * Runs daily at 10pm UTC (8am AEST next day).
 * Sends reminders to instructors and students for lessons starting in the next 23–25 hours.
 * 
 * Schedule: "0 22 * * *" in vercel.json
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23hrs from now
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // 25hrs from now

    const bookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        startTime: { gte: windowStart, lte: windowEnd },
      },
      include: {
        instructor: { select: { userId: true, name: true } },
        client: { include: { user: { select: { id: true } } } },
      },
    });

    let sent = 0;
    let failed = 0;

    for (const booking of bookings) {
      try {
        const startTime = booking.startTime!;
        const clientName = booking.clientName || booking.client?.name || 'Student';
        const instructorName = booking.instructor.name;

        // Notify instructor
        if (booking.instructor.userId) {
          await notifyLessonReminderInstructor(
            booking.instructor.userId,
            clientName,
            booking.id,
            startTime
          );
        }

        // Notify student
        const studentUserId = booking.client?.user?.id;
        if (studentUserId) {
          await notifyLessonReminderStudent(
            studentUserId,
            instructorName,
            booking.id,
            startTime
          );
        }

        sent++;
      } catch (err) {
        console.error(`Reminder failed for booking ${booking.id}:`, err);
        failed++;
      }
    }

    console.log(`✅ Lesson reminders: ${sent} sent, ${failed} failed`);
    return NextResponse.json({ success: true, sent, failed, total: bookings.length });
  } catch (error) {
    console.error('Lesson reminders cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
