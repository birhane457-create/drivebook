// Notification service - handles creating notifications for events

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getDisplayName } from '@/lib/utils/account';
import { formatLocalDate, formatLocalTime, resolveTimezone, timezoneFromState, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  actionUrl?: string;
  actionButtonLabel?: string;
  reminderStage?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}

function toNotificationData(input: CreateNotificationInput): Prisma.NotificationUncheckedCreateInput {
  const metadata: Record<string, string> = {};
  if (input.metadata) {
    for (const [key, value] of Object.entries(input.metadata)) {
      if (typeof value === 'string') metadata[key] = value;
    }
  }
  if (input.relatedEntityId) metadata.relatedEntityId = input.relatedEntityId;
  if (input.relatedEntityType) metadata.relatedEntityType = input.relatedEntityType;
  if (input.actionButtonLabel) metadata.actionButtonLabel = input.actionButtonLabel;

  return {
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.actionUrl,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  } as any;
}

/**
 * Create a single notification
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    const notification = await prisma.notification.create({
      data: toNotificationData(input),
    });

    console.log(`âœ… Created notification: ${notification.id} (${input.type})`);
    return notification;
  } catch (error) {
    console.error('âŒ Error creating notification:', error);
    throw error;
  }
}

/**
 * Create notification when instructor submits feedback
 */
export async function notifyFeedbackReceived(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: { select: { userId: true } },
        instructor: { select: { name: true, businessName: true, accountType: true, timezone: true, state: true } },
      },
    });

    if (!booking || !booking.client?.userId) {
      console.log(`âš ï¸ Could not notify feedback - booking not found or no client`);
      return;
    }

    // Check if already notified
    const existingNotif = await prisma.notification.findFirst({
      where: {
        userId: booking.client.userId,
        type: 'FEEDBACK_RECEIVED',
        metadata: {
          path: ['relatedEntityId'],
          equals: bookingId,
        },
      },
    });

    if (existingNotif) {
      console.log(`âš ï¸ Feedback notification already exists for booking ${bookingId}`);
      return;
    }

    return createNotification({
      userId: booking.client.userId,
      type: 'FEEDBACK_RECEIVED',
      title: 'âœ… Feedback Received',
      message: `Your instructor ${getDisplayName(booking.instructor)} left feedback on your lesson.`,
      relatedEntityId: bookingId,
      relatedEntityType: 'BOOKING',
      actionUrl: '/client-dashboard/progress',
      actionButtonLabel: 'View Feedback',
    });
  } catch (error) {
    console.error('âŒ Error notifying feedback received:', error);
    throw error;
  }
}

/**
 * Create notification when booking is confirmed
 */
export async function notifyBookingConfirmed(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: { select: { userId: true } },
        instructor: { select: { name: true, businessName: true, accountType: true, timezone: true, state: true } },
      },
    });

    if (!booking || !booking.client?.userId) {
      console.log(`âš ï¸ Could not notify booking confirmed - booking not found`);
      return;
    }

    const tz = booking.instructor ? resolveTimezone(booking.instructor.timezone) ?? timezoneFromState(booking.instructor.state) : DEFAULT_TIMEZONE;
    const bookingDate = booking.startTime ? formatLocalDate(booking.startTime, tz) : 'N/A';

    return createNotification({
      userId: booking.client.userId,
      type: 'BOOKING_CONFIRMED',
      title: 'ðŸ“… Booking Confirmed',
      message: `Your booking with ${getDisplayName(booking.instructor)} on ${bookingDate} has been confirmed.`,
      relatedEntityId: bookingId,
      relatedEntityType: 'BOOKING',
      actionUrl: '/client-dashboard/bookings',
      actionButtonLabel: 'View Booking',
    });
  } catch (error) {
    console.error('âŒ Error notifying booking confirmed:', error);
    throw error;
  }
}

/**
 * Create notification when booking is cancelled
 */
export async function notifyBookingCancelled(bookingId: string, cancellationReason?: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: { select: { userId: true } },
        instructor: { select: { name: true, businessName: true, accountType: true, timezone: true, state: true } },
      },
    });

    if (!booking || !booking.client?.userId) {
      console.log(`âš ï¸ Could not notify booking cancelled - booking not found`);
      return;
    }

    const tz = booking.instructor ? resolveTimezone(booking.instructor.timezone) ?? timezoneFromState(booking.instructor.state) : DEFAULT_TIMEZONE;
    const bookingDate = booking.startTime ? formatLocalDate(booking.startTime, tz) : 'N/A';

    return createNotification({
      userId: booking.client.userId,
      type: 'BOOKING_CANCELLED',
      title: 'âŒ Booking Cancelled',
      message: `Your booking with ${getDisplayName(booking.instructor)} on ${bookingDate} has been cancelled.${cancellationReason ? ` Reason: ${cancellationReason}` : ''}`,
      relatedEntityId: bookingId,
      relatedEntityType: 'BOOKING',
      actionUrl: '/client-dashboard/bookings',
      actionButtonLabel: 'View Bookings',
    });
  } catch (error) {
    console.error('âŒ Error notifying booking cancelled:', error);
    throw error;
  }
}

/**
 * Create notification when booking is rescheduled
 */
export async function notifyBookingRescheduled(bookingId: string, newDate: Date) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: { select: { userId: true } },
        instructor: { select: { name: true, businessName: true, accountType: true, timezone: true, state: true } },
      },
    });

    if (!booking || !booking.client?.userId) {
      console.log(`âš ï¸ Could not notify booking rescheduled - booking not found`);
      return;
    }

    const tz = booking.instructor ? resolveTimezone(booking.instructor.timezone) ?? timezoneFromState(booking.instructor.state) : DEFAULT_TIMEZONE;
    const newDateStr = formatLocalDate(newDate, tz);
    const newTimeStr = formatLocalTime(newDate, tz, { hour: '2-digit', minute: '2-digit' });

    return createNotification({
      userId: booking.client.userId,
      type: 'BOOKING_RESCHEDULED',
      title: 'â†» Booking Rescheduled',
      message: `Your lesson with ${getDisplayName(booking.instructor)} has been rescheduled to ${newDateStr} at ${newTimeStr}.`,
      relatedEntityId: bookingId,
      relatedEntityType: 'BOOKING',
      actionUrl: '/client-dashboard/bookings',
      actionButtonLabel: 'View Booking',
    });
  } catch (error) {
    console.error('âŒ Error notifying booking rescheduled:', error);
    throw error;
  }
}

/**
 * Create notification when package is purchased
 */
export async function notifyPackagePurchased(packageBookingId: string) {
  try {
    const pkg = await prisma.booking.findUnique({
      where: { id: packageBookingId },
      include: {
        client: { select: { userId: true } },
      },
    });

    if (!pkg || !pkg.client?.userId) {
      console.log(`âš ï¸ Could not notify package purchased - package not found`);
      return;
    }

    // Try to use instructor timezone if package belongs to an instructor; fallback to default
    const instrTz = DEFAULT_TIMEZONE;
    const expiryDate = pkg.packageExpiryDate ? formatLocalDate(pkg.packageExpiryDate, instrTz) : 'N/A';
    const hours = pkg.packageHours || 0;
    const price = pkg.packageTotalPaid || 0;

    return createNotification({
      userId: pkg.client.userId,
      type: 'PACKAGE_PURCHASED',
      title: 'ðŸŽ Package Purchased',
      message: `You've purchased a ${hours}h package for $${price.toFixed(2)}. Expires ${expiryDate}.`,
      relatedEntityId: packageBookingId,
      relatedEntityType: 'PACKAGE',
      actionUrl: '/client-dashboard/packages',
      actionButtonLabel: 'View Package',
    });
  } catch (error) {
    console.error('âŒ Error notifying package purchased:', error);
    throw error;
  }
}

/**
 * Batch create notifications (useful for admin actions or bulk updates)
 */
export async function createBatchNotifications(inputs: CreateNotificationInput[]) {
  try {
    const notifications = await prisma.notification.createMany({
      data: inputs.map(toNotificationData),
      skipDuplicates: true,
    });

    console.log(`âœ… Created ${notifications.count} notifications`);
    return notifications;
  } catch (error) {
    console.error('âŒ Error creating batch notifications:', error);
    throw error;
  }
}

/**
 * Delete old notifications (cleanup job - keep last 30 days)
 */
export async function deleteOldNotifications(daysToKeep: number = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deleted = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`âœ… Deleted ${deleted.count} old notifications (older than ${daysToKeep} days)`);
    return deleted;
  } catch (error) {
    console.error('âŒ Error deleting old notifications:', error);
    throw error;
  }
}


