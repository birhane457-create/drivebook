import { prisma } from '@/lib/prisma';
import { getDisplayName, type DisplayIdentitySource } from '@/lib/branding/getDisplayIdentity'
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone'

/**
 * lib/services/notifications.ts
 *
 * Generic notification helpers for the Business Operating System.
 * Works for any business type — driving school, plumber, beauty studio, tax agent.
 *
 * All helpers accept an optional `terms` parameter sourced from BusinessTerminology.
 * Existing call sites that don't pass `terms` continue to work with generic defaults.
 *
 * UPGRADING A CALL SITE:
 * ─────────────────────
 * Before (driving-specific):
 *   await notifyBookingRequest(instructorUserId, customerName, bookingId, startTime, tz)
 *   → "John requested a lesson on Mon 12 Jan at 9:00am"
 *
 * After (terminology-aware):
 *   const terms = await getTerminology({ providerId })
 *   await notifyBookingRequest(providerUserId, customerName, bookingId, startTime, tz, terms)
 *   → Driving:  "John requested a lesson on Mon 12 Jan at 9:00am"
 *   → Plumbing: "John requested a job on Mon 12 Jan at 9:00am"
 *   → Beauty:   "John requested an appointment on Mon 12 Jan at 9:00am"
 *
 * BACKWARD COMPATIBILITY:
 * ───────────────────────
 * Old function names are kept as @deprecated aliases:
 *   notifyClientBookingConfirmed    → notifyCustomerBookingConfirmed
 *   notifyClientBookingCancelled    → notifyCustomerBookingCancelled
 *   notifyClientBookingRescheduled  → notifyCustomerBookingRescheduled
 *   notifyClientBookingPendingApproval → notifyCustomerBookingPendingApproval
 *   notifyLessonReminderInstructor  → notifyBookingReminderProvider
 *   notifyLessonReminderStudent     → notifyBookingReminderCustomer
 */

export type NotificationType =
  | 'BOOKING_REQUEST'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'PAYMENT_RECEIVED'
  | 'APPOINTMENT_REMINDER'
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

/**
 * Terminology labels used in notification messages.
 * Sourced from BusinessTerminology at the call site.
 * All fields optional — defaults to driving school vocabulary for
 * backward compatibility with existing call sites.
 *
 * Usage:
 *   const terms = await getTerminology({ providerId })
 *   await notifyBookingRequest(userId, customerName, bookingId, startTime, tz, {
 *     booking: terms.booking,    // "Lesson" | "Job" | "Appointment"
 *     provider: terms.provider,  // "Instructor" | "Plumber" | "Therapist"
 *     customer: terms.customer,  // "Learner" | "Client" | "Customer"
 *   })
 */
export interface NotificationTerminology {
  booking?: string   // default: "Booking"
  provider?: string  // default: "Provider"
  customer?: string  // default: "Customer"
}

/** Resolved terminology — all fields guaranteed non-null after defaults applied. */
interface ResolvedTerms {
  booking: string
  provider: string
  customer: string
}

/** Apply defaults so callers never need to pass a complete object. */
function resolveTerms(t?: NotificationTerminology): ResolvedTerms {
  return {
    booking:  t?.booking  ?? 'Booking',
    provider: t?.provider ?? 'Provider',
    customer: t?.customer ?? 'Customer',
  }
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
    // Never throw — notifications are non-critical
    console.error('Failed to create notification:', error);
  }
}

// ── Date/time helpers ─────────────────────────────────────────────────────────

// timezone defaults to the platform default for backward compatibility.
// Pass provider.timezone where available to support national expansion.
function fmtDate(d: Date, tz: string = DEFAULT_TIMEZONE, opts?: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString('en-AU', { timeZone: tz, ...opts });
}
function fmtTime(d: Date, tz: string = DEFAULT_TIMEZONE) {
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: tz });
}

// ── Provider-facing notifications ─────────────────────────────────────────────

export async function notifyBookingRequest(
  providerUserId: string,
  customerName: string,
  bookingId: string,
  startTime: Date,
  timezone = DEFAULT_TIMEZONE,
  terms?: NotificationTerminology,
) {
  const t = resolveTerms(terms)
  return createNotification({
    userId: providerUserId,
    type: 'BOOKING_REQUEST',
    title: `New ${t.booking} Request`,
    message: `${customerName} requested a ${t.booking.toLowerCase()} on ${fmtDate(startTime, timezone)} at ${fmtTime(startTime, timezone)}`,
    link: `/dashboard/bookings/${bookingId}`,
    metadata: { bookingId, customerName },
  });
}

export async function notifyBookingConfirmed(
  providerUserId: string,
  customerName: string,
  bookingId: string,
  startTime: Date,
  timezone = DEFAULT_TIMEZONE,
  terms?: NotificationTerminology,
) {
  const t = resolveTerms(terms)
  return createNotification({
    userId: providerUserId,
    type: 'BOOKING_CONFIRMED',
    title: `${t.booking} Confirmed`,
    message: `${t.booking} with ${customerName} on ${fmtDate(startTime, timezone)} is confirmed`,
    link: `/dashboard/bookings/${bookingId}`,
    metadata: { bookingId, customerName },
  });
}

export async function notifyBookingCancelled(
  providerUserId: string,
  customerName: string,
  bookingId: string,
  terms?: NotificationTerminology,
) {
  const t = resolveTerms(terms)
  return createNotification({
    userId: providerUserId,
    type: 'BOOKING_CANCELLED',
    title: `${t.booking} Cancelled`,
    message: `${customerName} cancelled their ${t.booking.toLowerCase()}`,
    link: `/dashboard/bookings`,
    metadata: { bookingId, customerName },
  });
}

export async function notifyPaymentReceived(
  providerUserId: string,
  amount: number,
  customerName: string,
  bookingId: string,
) {
  return createNotification({
    userId: providerUserId,
    type: 'PAYMENT_RECEIVED',
    title: 'Payment Received',
    message: `Payment of $${amount.toFixed(2)} received from ${customerName}`,
    link: `/dashboard/earnings`,
    metadata: { bookingId, amount, customerName },
  });
}

export async function notifyDocumentExpiring(
  providerUserId: string,
  docType: string,
  expiryDate: Date,
) {
  const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return createNotification({
    userId: providerUserId,
    type: 'DOCUMENT_EXPIRING',
    title: 'Document Expiring Soon',
    message: `Your ${docType} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    link: `/dashboard/documents`,
    metadata: { docType, expiryDate, daysLeft },
  });
}

export async function notifyReviewReceived(
  providerUserId: string,
  customerName: string,
  rating: number,
) {
  return createNotification({
    userId: providerUserId,
    type: 'REVIEW_RECEIVED',
    title: 'New Review',
    message: `${customerName} left you a ${rating}-star review`,
    link: `/dashboard/profile`,
    metadata: { customerName, rating },
  });
}

export async function notifyBookingRescheduled(
  providerUserId: string,
  customerName: string,
  bookingId: string,
  newStart: Date,
  timezone = DEFAULT_TIMEZONE,
  terms?: NotificationTerminology,
) {
  const t = resolveTerms(terms)
  return createNotification({
    userId: providerUserId,
    type: 'BOOKING_CONFIRMED',
    title: `${t.booking} Rescheduled`,
    message: `${t.booking} with ${customerName} rescheduled to ${fmtDate(newStart, timezone)} at ${fmtTime(newStart, timezone)}`,
    link: `/dashboard/bookings/${bookingId}`,
    metadata: { bookingId, customerName },
  });
}

// Short-notice booking — urgent approval request to provider
export async function notifyShortNoticeBookingRequest(
  providerUserId: string,
  customerName: string,
  bookingId: string,
  startTime: Date,
  terms?: NotificationTerminology,
) {
  const t = resolveTerms(terms)
  const timeStr = fmtTime(startTime);
  const minutesUntil = Math.round((startTime.getTime() - Date.now()) / 60000);
  return createNotification({
    userId: providerUserId,
    type: 'BOOKING_REQUEST',
    title: `⚡ Urgent: Last-Minute ${t.booking} Request`,
    message: `${customerName} wants to book TODAY at ${timeStr} (${minutesUntil} min away). Approve or decline from your dashboard.`,
    link: `/dashboard/bookings/${bookingId}`,
    metadata: { bookingId, customerName, isShortNotice: true, startTime: startTime.toISOString() },
  });
}

// Booking reminder — sent 24hrs before appointment to provider
export async function notifyBookingReminderProvider(
  providerUserId: string,
  customerName: string,
  bookingId: string,
  startTime: Date,
  timezone = DEFAULT_TIMEZONE,
  terms?: NotificationTerminology,
) {
  const t = resolveTerms(terms)
  const dateStr = fmtDate(startTime, timezone, { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = fmtTime(startTime, timezone);
  return createNotification({
    userId: providerUserId,
    type: 'APPOINTMENT_REMINDER',
    title: `📅 ${t.booking} Tomorrow`,
    message: `Reminder: ${t.booking.toLowerCase()} with ${customerName} tomorrow ${dateStr} at ${timeStr}.`,
    link: `/dashboard/bookings/${bookingId}`,
    metadata: { bookingId, customerName, startTime: startTime.toISOString() },
  });
}

/**
 * @deprecated Use notifyBookingReminderProvider instead.
 * Kept for backward compatibility — existing call sites pass instructorUserId as first arg.
 */
export const notifyLessonReminderInstructor = notifyBookingReminderProvider

// ── Customer-facing notifications ─────────────────────────────────────────────

export async function notifyCustomerBookingConfirmed(
  customerUserId: string,
  providerName: string,
  bookingId: string,
  startTime: Date,
  provider?: DisplayIdentitySource,
  timezone = DEFAULT_TIMEZONE,
  terms?: NotificationTerminology,
) {
  const t = resolveTerms(terms)
  const displayName = provider ? getDisplayName(provider) : providerName
  return createNotification({
    userId: customerUserId,
    type: 'BOOKING_CONFIRMED',
    title: `${t.booking} Confirmed`,
    message: `Your ${t.booking.toLowerCase()} with ${displayName} on ${fmtDate(startTime, timezone)} is confirmed`,
    link: `/client-dashboard/bookings`,
    metadata: { bookingId, providerName: displayName },
  });
}

/**
 * @deprecated Use notifyCustomerBookingConfirmed instead.
 * Kept for backward compatibility with existing call sites.
 */
export const notifyClientBookingConfirmed = notifyCustomerBookingConfirmed

export async function notifyCustomerBookingCancelled(
  customerUserId: string,
  providerName: string,
  bookingId: string,
  provider?: DisplayIdentitySource,
  terms?: NotificationTerminology,
) {
  const t = resolveTerms(terms)
  const displayName = provider ? getDisplayName(provider) : providerName
  return createNotification({
    userId: customerUserId,
    type: 'BOOKING_CANCELLED',
    title: `${t.booking} Cancelled`,
    message: `Your ${t.booking.toLowerCase()} with ${displayName} has been cancelled`,
    link: `/client-dashboard/bookings`,
    metadata: { bookingId, providerName: displayName },
  });
}

/**
 * @deprecated Use notifyCustomerBookingCancelled instead.
 * Kept for backward compatibility with existing call sites.
 */
export const notifyClientBookingCancelled = notifyCustomerBookingCancelled

export async function notifyCustomerBookingRescheduled(
  customerUserId: string,
  providerName: string,
  bookingId: string,
  newStart: Date,
  provider?: DisplayIdentitySource,
  timezone = DEFAULT_TIMEZONE,
  terms?: NotificationTerminology,
) {
  const t = resolveTerms(terms)
  const displayName = provider ? getDisplayName(provider) : providerName
  return createNotification({
    userId: customerUserId,
    type: 'BOOKING_CONFIRMED',
    title: `${t.booking} Rescheduled`,
    message: `Your ${t.booking.toLowerCase()} with ${displayName} has been rescheduled to ${fmtDate(newStart, timezone)} at ${fmtTime(newStart, timezone)}`,
    link: `/client-dashboard/bookings`,
    metadata: { bookingId, providerName: displayName },
  });
}

/**
 * @deprecated Use notifyCustomerBookingRescheduled instead.
 * Kept for backward compatibility with existing call sites.
 */
export const notifyClientBookingRescheduled = notifyCustomerBookingRescheduled

export async function notifyCustomerBookingPendingApproval(
  customerUserId: string,
  providerName: string,
  bookingId: string,
  startTime: Date,
  provider?: DisplayIdentitySource,
  terms?: NotificationTerminology,
) {
  const t = resolveTerms(terms)
  const displayName = provider ? getDisplayName(provider) : providerName
  return createNotification({
    userId: customerUserId,
    type: 'BOOKING_REQUEST',
    title: `${t.booking} Awaiting Approval`,
    message: `Your last-minute ${t.booking.toLowerCase()} request with ${displayName} at ${fmtTime(startTime)} is awaiting approval.`,
    link: `/client-dashboard/bookings`,
    metadata: { bookingId, providerName: displayName, isShortNotice: true },
  });
}

/**
 * @deprecated Use notifyCustomerBookingPendingApproval instead.
 * Kept for backward compatibility with existing call sites.
 */
export const notifyClientBookingPendingApproval = notifyCustomerBookingPendingApproval

// Booking reminder — sent 24hrs before appointment to customer
export async function notifyBookingReminderCustomer(
  customerUserId: string,
  providerName: string,
  bookingId: string,
  startTime: Date,
  provider?: DisplayIdentitySource,
  timezone = DEFAULT_TIMEZONE,
  terms?: NotificationTerminology,
) {
  const t = resolveTerms(terms)
  const displayName = provider ? getDisplayName(provider) : providerName
  const dateStr = fmtDate(startTime, timezone, { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = fmtTime(startTime, timezone);
  return createNotification({
    userId: customerUserId,
    type: 'APPOINTMENT_REMINDER',
    title: `📅 ${t.booking} Tomorrow`,
    message: `Reminder: your ${t.booking.toLowerCase()} with ${displayName} is tomorrow ${dateStr} at ${timeStr}.`,
    link: `/client-dashboard/bookings`,
    metadata: { bookingId, providerName: displayName, startTime: startTime.toISOString() },
  });
}

/**
 * @deprecated Use notifyBookingReminderCustomer instead.
 * Kept for backward compatibility with existing call sites.
 */
export const notifyLessonReminderStudent = notifyBookingReminderCustomer
