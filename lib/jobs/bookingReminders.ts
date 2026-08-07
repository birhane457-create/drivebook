// Job to generate booking reminder notifications.
// Runs every 15 min via the notifications cron and sends reminders for
// bookings that fall within rolling windows around their actual start time.

import { prisma } from '@/lib/prisma';
import { createBatchNotifications } from '@/lib/services/notificationService';
import { resolveTimezone, timezoneFromState, formatLocalDate, formatLocalTime, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

interface BookingWithRelations {
  id: string;
  startTime: Date | null;
  timezone?: string | null;
  instructor: {
    name: string;
    timezone?: string | null;
  };
  client: {
    userId: string | null;
  } | null;
}

const BOOKING_REMINDER_TYPE = 'BOOKING_REMINDER';
const REMINDER_STAGES = [
  {
    key: 'DAY_BEFORE',
    title: 'Lesson Reminder',
    channels: ['APP'],
    windowStartMs: 23 * 60 * 60 * 1000 + 45 * 60 * 1000,
    windowEndMs: 24 * 60 * 60 * 1000 + 15 * 60 * 1000,
  },
  {
    key: 'ONE_HOUR',
    title: '⏰ Lesson Starting Soon',
    channels: ['APP', 'SMS'],
    windowStartMs: 45 * 60 * 1000,
    windowEndMs: 75 * 60 * 1000,
  },
] as const;

function resolveReminderTimezone(booking: BookingWithRelations) {
  const tzCandidate = booking.timezone || booking.instructor?.timezone || process.env.DEFAULT_TIMEZONE || DEFAULT_TIMEZONE;
  return resolveTimezone(tzCandidate);
}

function formatReminderDateTime(date: Date, timezone: string) {
  const tz = resolveTimezone(timezone);
  const datePart = formatLocalDate(date, tz, { weekday: 'short', day: 'numeric', month: 'short' } as any);
  const timePart = formatLocalTime(date, tz, { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

function buildReminderMessage(booking: BookingWithRelations, stageKey: string, startTime: Date, timezone: string) {
  const formattedStart = formatReminderDateTime(startTime, timezone);

  if (stageKey === 'ONE_HOUR') {
    return `Your lesson with ${booking.instructor.name} starts at ${formattedStart}.`;
  }

  return `Your lesson with ${booking.instructor.name} is scheduled for ${formattedStart}.`;
}

export async function generateBookingReminders() {
  try {
    console.log('⏰ Starting booking reminders job...');

    const now = new Date();
    const earliestStart = new Date(now.getTime() + 45 * 60 * 1000);
    const latestStart = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 1000);

    const bookings = (await prisma.booking.findMany({
      where: {
        startTime: {
          gte: earliestStart,
          lte: latestStart,
        },
        status: 'CONFIRMED',
        feedbackGivenAt: null,
      },
      select: {
        id: true,
        startTime: true,
        timezone: true,
        instructor: { select: { name: true, timezone: true } },
        client: { select: { userId: true } },
      } as any,
    })) as unknown as BookingWithRelations[];

    if (bookings.length === 0) {
      console.log('✅ No relevant bookings found for reminder processing');
      return { success: true };
    }

    const bookingIds = bookings.map((booking) => booking.id);
    const reminderStages = REMINDER_STAGES.map((stage) => stage.key);
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const recentReminderNotifications = await prisma.notification.findMany({
      where: {
        type: BOOKING_REMINDER_TYPE,
        createdAt: {
          gte: cutoff,
        },
        relatedEntityId: {
          in: bookingIds,
        },
        reminderStage: {
          in: reminderStages,
        },
      } as any,
      select: {
        relatedEntityId: true,
        reminderStage: true,
      } as any,
    });

    const sentReminderKeys = new Set<string>();
    for (const reminder of recentReminderNotifications) {
      if (typeof reminder.relatedEntityId === 'string' && typeof reminder.reminderStage === 'string') {
        sentReminderKeys.add(`${reminder.relatedEntityId}:${reminder.reminderStage}`);
      }
    }

    const notificationsToCreate = [] as Array<{
      userId: string;
      type: string;
      title: string;
      message: string;
      relatedEntityId: string;
      relatedEntityType: string;
      actionUrl: string;
      actionButtonLabel: string;
      metadata: Record<string, string>;
    }>;

    for (const booking of bookings) {
      if (!booking.client?.userId || !booking.startTime) continue;

      const timezone = resolveReminderTimezone(booking);
      const msUntilStart = booking.startTime.getTime() - now.getTime();
      if (msUntilStart <= 0) continue;

      for (const stage of REMINDER_STAGES) {
        if (msUntilStart < stage.windowStartMs || msUntilStart > stage.windowEndMs) {
          continue;
        }

        const reminderKey = `${booking.id}:${stage.key}`;
        if (sentReminderKeys.has(reminderKey)) {
          continue;
        }

        notificationsToCreate.push({
          userId: booking.client.userId,
          type: BOOKING_REMINDER_TYPE,
          title: stage.title,
          message: buildReminderMessage(booking, stage.key, booking.startTime, timezone),
          relatedEntityId: booking.id,
          relatedEntityType: 'BOOKING',
          actionUrl: '/client-dashboard/bookings',
          actionButtonLabel: 'View Lesson',
          reminderStage: stage.key,
          channel: stage.channels[0],
          metadata: {
            reminderStage: stage.key,
            reminderChannels: stage.channels.join(','),
            bookingTimezone: timezone,
            bookingStartTime: booking.startTime.toISOString(),
          },
        } as any);

        sentReminderKeys.add(reminderKey);
        console.log(`✅ Prepared ${stage.key} reminder for booking ${booking.id}`);
      }
    }

    const startedAt = Date.now();
    if (notificationsToCreate.length > 0) {
      const result = await createBatchNotifications(notificationsToCreate);
      console.log(`📬 Batch inserted ${result.count} reminder notifications`);
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(`✅ Booking reminders job completed | Bookings scanned: ${bookings.length} | Reminders prepared: ${notificationsToCreate.length} | Duplicates skipped: ${Math.max(0, notificationsToCreate.length - (notificationsToCreate.length))} | Elapsed: ${elapsedMs}ms`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error in booking reminders job:', error);
    throw error;
  }
}
