import { prisma } from '@/lib/prisma';

export type NotificationType =
  | 'BOOKING_REQUEST'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'PAYMENT_RECEIVED'
  | 'LESSON_REMINDER'
  | 'NEW_MESSAGE'
  | 'DOCUMENT_EXPIRING'
  | 'REVIEW_RECEIVED';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        metadata: params.metadata || {},
      },
    });
  } catch (error) {
    // Never throw - notifications are non-critical
    console.error('Failed to create notification:', error);
  }
}

// Convenience helpers for common events
const AU_TZ = 'Australia/Perth';

export async function notifyBookingRequest(instructorUserId: string, clientName: string, bookingId: string, startTime: Date) {
  return createNotification({
    userId: instructorUserId,
    type: 'BOOKING_REQUEST',
    title: 'New Booking Request',
    message: `${clientName} requested a lesson on ${startTime.toLocaleDateString('en-AU', { timeZone: AU_TZ })} at ${startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: AU_TZ })}`,
    link: `/dashboard/bookings/${bookingId}`,
    metadata: { bookingId, clientName },
  });
}

export async function notifyBookingConfirmed(instructorUserId: string, clientName: string, bookingId: string, startTime: Date) {
  return createNotification({
    userId: instructorUserId,
    type: 'BOOKING_CONFIRMED',
    title: 'Booking Confirmed',
    message: `Booking with ${clientName} on ${startTime.toLocaleDateString('en-AU', { timeZone: AU_TZ })} is confirmed`,
    link: `/dashboard/bookings/${bookingId}`,
    metadata: { bookingId, clientName },
  });
}

export async function notifyBookingCancelled(instructorUserId: string, clientName: string, bookingId: string) {
  return createNotification({
    userId: instructorUserId,
    type: 'BOOKING_CANCELLED',
    title: 'Booking Cancelled',
    message: `${clientName} cancelled their booking`,
    link: `/dashboard/bookings`,
    metadata: { bookingId, clientName },
  });
}

export async function notifyPaymentReceived(instructorUserId: string, amount: number, clientName: string, bookingId: string) {
  return createNotification({
    userId: instructorUserId,
    type: 'PAYMENT_RECEIVED',
    title: 'Payment Received',
    message: `Payment of $${amount.toFixed(2)} received from ${clientName}`,
    link: `/dashboard/earnings`,
    metadata: { bookingId, amount, clientName },
  });
}

export async function notifyDocumentExpiring(instructorUserId: string, docType: string, expiryDate: Date) {
  const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return createNotification({
    userId: instructorUserId,
    type: 'DOCUMENT_EXPIRING',
    title: 'Document Expiring Soon',
    message: `Your ${docType} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    link: `/dashboard/documents`,
    metadata: { docType, expiryDate, daysLeft },
  });
}

export async function notifyReviewReceived(instructorUserId: string, clientName: string, rating: number) {
  return createNotification({
    userId: instructorUserId,
    type: 'REVIEW_RECEIVED',
    title: 'New Review',
    message: `${clientName} left you a ${rating}-star review`,
    link: `/dashboard/profile`,
    metadata: { clientName, rating },
  });
}

// Rescheduled notifications
export async function notifyBookingRescheduled(instructorUserId: string, clientName: string, bookingId: string, newStart: Date) {
  return createNotification({
    userId: instructorUserId,
    type: 'BOOKING_CONFIRMED', // reuse closest type
    title: 'Booking Rescheduled',
    message: `Booking with ${clientName} rescheduled to ${newStart.toLocaleDateString('en-AU', { timeZone: AU_TZ })} at ${newStart.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: AU_TZ })}`,
    link: `/dashboard/bookings/${bookingId}`,
    metadata: { bookingId, clientName },
  });
}

export async function notifyClientBookingRescheduled(clientUserId: string, instructorName: string, bookingId: string, newStart: Date) {
  return createNotification({
    userId: clientUserId,
    type: 'BOOKING_CONFIRMED',
    title: 'Booking Rescheduled',
    message: `Your lesson with ${instructorName} has been rescheduled to ${newStart.toLocaleDateString('en-AU', { timeZone: AU_TZ })} at ${newStart.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: AU_TZ })}`,
    link: `/client-dashboard/bookings`,
    metadata: { bookingId, instructorName },
  });
}

// Client-facing notifications
export async function notifyClientBookingConfirmed(clientUserId: string, instructorName: string, bookingId: string, startTime: Date) {
  return createNotification({
    userId: clientUserId,
    type: 'BOOKING_CONFIRMED',
    title: 'Booking Confirmed',
    message: `Your lesson with ${instructorName} on ${startTime.toLocaleDateString('en-AU', { timeZone: AU_TZ })} is confirmed`,
    link: `/client-dashboard/bookings`,
    metadata: { bookingId, instructorName },
  });
}

export async function notifyClientBookingCancelled(clientUserId: string, instructorName: string, bookingId: string) {
  return createNotification({
    userId: clientUserId,
    type: 'BOOKING_CANCELLED',
    title: 'Booking Cancelled',
    message: `Your booking with ${instructorName} has been cancelled`,
    link: `/client-dashboard/bookings`,
    metadata: { bookingId, instructorName },
  });
}

// Short-notice booking — urgent approval request to instructor
export async function notifyShortNoticeBookingRequest(
  instructorUserId: string,
  clientName: string,
  bookingId: string,
  startTime: Date
) {
  const timeStr = startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: AU_TZ });
  const minutesUntil = Math.round((startTime.getTime() - Date.now()) / 60000);
  return createNotification({
    userId: instructorUserId,
    type: 'BOOKING_REQUEST',
    title: '⚡ Urgent: Last-Minute Booking Request',
    message: `${clientName} wants to book TODAY at ${timeStr} (${minutesUntil} min away). Approve or decline from your dashboard.`,
    link: `/dashboard/bookings/${bookingId}`,
    metadata: { bookingId, clientName, isShortNotice: true, startTime: startTime.toISOString() },
  });
}

// Client notification — booking pending instructor approval
export async function notifyClientBookingPendingApproval(
  clientUserId: string,
  instructorName: string,
  bookingId: string,
  startTime: Date
) {
  return createNotification({
    userId: clientUserId,
    type: 'BOOKING_REQUEST',
    title: 'Booking Awaiting Approval',
    message: `Your last-minute lesson request with ${instructorName} at ${startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: AU_TZ })} is awaiting approval.`,
    link: `/client-dashboard/bookings`,
    metadata: { bookingId, instructorName, isShortNotice: true },
  });
}

// Lesson reminder — sent 24hrs before lesson to both instructor and student
export async function notifyLessonReminderInstructor(
  instructorUserId: string,
  clientName: string,
  bookingId: string,
  startTime: Date
) {
  const dateStr = startTime.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: AU_TZ });
  const timeStr = startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: AU_TZ });
  return createNotification({
    userId: instructorUserId,
    type: 'LESSON_REMINDER',
    title: '📅 Lesson Tomorrow',
    message: `Reminder: lesson with ${clientName} tomorrow ${dateStr} at ${timeStr}.`,
    link: `/dashboard/bookings/${bookingId}`,
    metadata: { bookingId, clientName, startTime: startTime.toISOString() },
  });
}

export async function notifyLessonReminderStudent(
  studentUserId: string,
  instructorName: string,
  bookingId: string,
  startTime: Date
) {
  const dateStr = startTime.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: AU_TZ });
  const timeStr = startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: AU_TZ });
  return createNotification({
    userId: studentUserId,
    type: 'LESSON_REMINDER',
    title: '📅 Lesson Tomorrow',
    message: `Reminder: your lesson with ${instructorName} is tomorrow ${dateStr} at ${timeStr}.`,
    link: `/client-dashboard/bookings`,
    metadata: { bookingId, instructorName, startTime: startTime.toISOString() },
  });
}
