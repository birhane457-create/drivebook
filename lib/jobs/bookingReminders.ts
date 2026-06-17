// @ts-nocheck
// Job to generate booking reminder notifications
// Runs daily: sends reminders 24h before and 1h before lessons

import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/services/notificationService';

interface BookingWithRelations {
  id: string;
  startTime: Date;
  instructor: {
    name: string;
  };
  client: {
    userId: string | null;
  } | null;
}

export async function generateBookingReminders() {
  try {
    console.log('⏰ Starting booking reminders job...');

    // Get tomorrow at 9:00 AM (Sydney time)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 9, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 9, 59, 59, 999);

    // Get bookings starting tomorrow at 9:00 AM
    const bookingsTomorrow = await prisma.booking.findMany({
      where: {
        startTime: {
          gte: tomorrowStart,
          lte: tomorrowEnd,
        },
        status: 'CONFIRMED',
        feedbackGivenAt: null, // Not yet completed
      },
      include: {
        instructor: { select: { name: true } },
        client: { select: { userId: true } },
      },
    }) as BookingWithRelations[];

    // Generate "Your lesson starts tomorrow" notifications
    for (const booking of bookingsTomorrow) {
      if (!booking.client?.userId) continue;

      // Check if notification already exists (within last 23 hours)
      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: booking.client.userId,
          type: 'BOOKING_REMINDER',
          metadata: {
            path: ['relatedEntityId'],
            equals: booking.id,
          },
          createdAt: {
            gte: new Date(Date.now() - 23 * 60 * 60 * 1000),
          },
        },
      });

      if (!existingNotif) {
        await createNotification({
          userId: booking.client.userId,
          type: 'BOOKING_REMINDER',
          title: 'Lesson Reminder',
          message: `Your lesson starts tomorrow at 9:00 AM with ${booking.instructor.name}`,
          relatedEntityId: booking.id,
          relatedEntityType: 'BOOKING',
          actionUrl: '/client-dashboard/bookings',
          actionButtonLabel: 'View Lesson',
        });
        console.log(`✅ Created "tomorrow" reminder for booking ${booking.id}`);
      }
    }

    // Get bookings starting in 1 hour
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const oneHourStart = new Date(inOneHour.getFullYear(), inOneHour.getMonth(), inOneHour.getDate(), inOneHour.getHours(), 0, 0, 0);
    const oneHourEnd = new Date(inOneHour.getFullYear(), inOneHour.getMonth(), inOneHour.getDate(), inOneHour.getHours(), 59, 59, 999);

    const bookingsInOneHour = await prisma.booking.findMany({
      where: {
        startTime: {
          gte: oneHourStart,
          lte: oneHourEnd,
        },
        status: 'CONFIRMED',
        feedbackGivenAt: null,
      },
      include: {
        instructor: { select: { name: true } },
        client: { select: { userId: true } },
      },
    }) as BookingWithRelations[];

    // Generate "Your lesson starts in 1 hour" notifications
    for (const booking of bookingsInOneHour) {
      if (!booking.client?.userId) continue;

      // Check if notification already exists (within last 30 minutes)
      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: booking.client.userId,
          type: 'BOOKING_REMINDER',
          metadata: {
            path: ['relatedEntityId'],
            equals: booking.id,
          },
          createdAt: {
            gte: new Date(Date.now() - 30 * 60 * 1000),
          },
        },
      });

      if (!existingNotif) {
        await createNotification({
          userId: booking.client.userId,
          type: 'BOOKING_REMINDER',
          title: '⏰ Lesson Starting Soon',
          message: `Your lesson starts in 1 hour with ${booking.instructor.name}`,
          relatedEntityId: booking.id,
          relatedEntityType: 'BOOKING',
          actionUrl: '/client-dashboard/bookings',
          actionButtonLabel: 'View Lesson',
        });
        console.log(`✅ Created "1 hour" reminder for booking ${booking.id}`);
      }
    }

    console.log('✅ Booking reminders job completed');
    return { success: true };
  } catch (error) {
    console.error('❌ Error in booking reminders job:', error);
    throw error;
  }
}
