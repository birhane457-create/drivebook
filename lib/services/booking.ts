/**
 * Unified Booking Service
 * 
 * This service is the SINGLE source of truth for all booking lifecycle operations.
 * All booking state transitions MUST go through this service to ensure consistency
 * across public, instructor, client, admin, webhook, and payment verification paths.
 * 
 * Key principles:
 * 1. All state changes are transactional
 * 2. Notifications are tracked separately (can fail without rolling back)
 * 3. Audit logs are mandatory for all state changes
 * 4. Idempotent operations (safe to call multiple times)
 * 5. Consistent status mapping across all contexts
 */

import { prisma } from '@/lib/prisma';
import { Booking, Instructor, Client, User } from '@prisma/client';
import { notifyBookingConfirmed, notifyBookingCancelled } from './notifications';
import { emailService } from './email';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BookingStatus = 
  | 'PENDING'       // Awaiting payment or instructor approval
  | 'CONFIRMED'     // Paid and confirmed
  | 'COMPLETED'     // Lesson finished
  | 'CANCELLED'     // Cancelled by either party
  | 'NO_SHOW'       // Student didn't show up
  | 'EXPIRED';      // Payment window expired

export type BookingSource = 
  | 'platform'      // Created via instructor dashboard
  | 'public'        // Created via public booking form
  | 'offline'       // Offline lesson logged by instructor
  | 'admin';        // Created by admin

export interface BookingWithRelations extends Booking {
  instructor: Instructor;
  client: Client | null;
}

export interface ConfirmBookingParams {
  bookingId: string;
  confirmedBy: 'webhook' | 'verify' | 'instructor' | 'admin';
  actorId?: string;
  paymentIntentId?: string;
  metadata?: Record<string, any>;
}

export interface CancelBookingParams {
  bookingId: string;
  cancelledBy: 'client' | 'instructor' | 'admin' | 'system';
  actorId: string;
  reason?: string;
  refundAmount?: number;
  metadata?: Record<string, any>;
}

export interface BookingNotificationStatus {
  emailSent: boolean;
  smsSent: boolean;
  inAppSent: boolean;
  failureReason?: string;
}

// ── Status Mapping (Unified) ──────────────────────────────────────────────────

/**
 * Maps internal booking status to user-facing display status.
 * This is the SINGLE mapping used across all dashboards.
 */
export function getBookingDisplayStatus(booking: Booking): {
  status: string;
  label: string;
  color: string;
} {
  const now = new Date();
  const startTime = booking.startTime ? new Date(booking.startTime) : null;
  const endTime = booking.endTime ? new Date(booking.endTime) : null;

  // Completed states
  if (booking.status === 'COMPLETED') {
    return { status: 'completed', label: 'Completed', color: 'green' };
  }
  if (booking.status === 'NO_SHOW') {
    return { status: 'no_show', label: 'No Show', color: 'red' };
  }
  if (booking.status === 'CANCELLED') {
    return { status: 'cancelled', label: 'Cancelled', color: 'gray' };
  }
  if (booking.status === 'EXPIRED') {
    return { status: 'expired', label: 'Expired', color: 'gray' };
  }

  // Active booking states
  if (booking.status === 'CONFIRMED') {
    if (startTime && endTime) {
      if (now >= startTime && now <= endTime) {
        return { status: 'in_progress', label: 'In Progress', color: 'blue' };
      }
      if (now < startTime) {
        return { status: 'upcoming', label: 'Upcoming', color: 'green' };
      }
      // Past confirmed but not marked complete
      return { status: 'pending_completion', label: 'Pending Completion', color: 'yellow' };
    }
    return { status: 'confirmed', label: 'Confirmed', color: 'green' };
  }

  // Pending states
  if (booking.status === 'PENDING') {
    if (booking.source === 'public' && !booking.isPaid) {
      return { status: 'awaiting_payment', label: 'Awaiting Payment', color: 'yellow' };
    }
    return { status: 'pending_approval', label: 'Pending Approval', color: 'yellow' };
  }

  // Fallback
  return { status: 'unknown', label: booking.status || 'Unknown', color: 'gray' };
}

// ── Core Service Functions ────────────────────────────────────────────────────

export class BookingService {
  /**
   * Confirm a booking (idempotent)
   * Called by: webhook handler, payment verify endpoint, instructor approval
   */
  static async confirmBooking(params: ConfirmBookingParams): Promise<{
    success: boolean;
    booking: BookingWithRelations;
    notificationStatus: BookingNotificationStatus;
    alreadyConfirmed: boolean;
  }> {
    const { bookingId, confirmedBy, actorId, paymentIntentId, metadata } = params;

    // Fetch booking with relations
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { instructor: true, client: true },
    });

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Idempotency: already confirmed
    if (booking.status === 'CONFIRMED') {
      return {
        success: true,
        booking: booking as BookingWithRelations,
        notificationStatus: { emailSent: false, smsSent: false, inAppSent: false },
        alreadyConfirmed: true,
      };
    }

    // Validate state transition
    if (!['PENDING'].includes(booking.status)) {
      throw new Error(`Cannot confirm booking from status ${booking.status}`);
    }

    // Atomic confirmation transaction
    const updatedBooking = await prisma.$transaction(async (tx) => {
      // Update booking status
      const confirmed = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
          isPaid: true,
          paidAt: new Date(),
          paymentCaptured: true,
          paymentCapturedAt: new Date(),
          ...(paymentIntentId && { paymentIntentId }),
        },
        include: { instructor: true, client: true },
      });

      // Create transaction record for platform accounting
      await tx.transaction.create({
        data: {
          bookingId,
          instructorId: booking.instructorId,
          type: 'BOOKING_PAYMENT',
          amount: booking.price,
          platformFee: booking.platformFee,
          instructorPayout: booking.instructorPayout,
          commissionRate: booking.commissionRate,
          status: 'COMPLETED',
          description: `Booking confirmed - ${confirmedBy}`,
          stripePaymentIntentId: paymentIntentId,
          metadata: metadata as any,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'BOOKING_CONFIRMED',
          actorId: actorId || 'system',
          actorRole: confirmedBy === 'webhook' || confirmedBy === 'verify' ? 'SYSTEM' : 'ADMIN',
          targetType: 'BOOKING',
          targetId: bookingId,
          success: true,
          metadata: {
            confirmedBy,
            paymentIntentId,
            ...metadata,
          } as any,
        },
      });

      return confirmed;
    });

    // Send notifications (outside transaction - failures don't rollback)
    const notificationStatus: BookingNotificationStatus = {
      emailSent: false,
      smsSent: false,
      inAppSent: false,
    };

    try {
      // In-app notification
      if (booking.client?.userId) {
        await notifyBookingConfirmed(
          booking.client.userId,
          booking.instructor.name,
          bookingId,
          booking.startTime || new Date()
        );
        notificationStatus.inAppSent = true;
      }

      // Email notification
      if (booking.clientEmail) {
        await emailService.sendGenericEmail({
          to: booking.clientEmail,
          subject: 'Driving Lesson Confirmed ✓',
          html: `<p>Hi ${booking.clientName || 'Student'}, your booking with ${booking.instructor.name} has been confirmed.</p>`,
        });
        notificationStatus.emailSent = true;
      }
    } catch (notifError: any) {
      console.error('Booking confirmation notification failed:', notifError);
      notificationStatus.failureReason = notifError.message;

      // Log notification failure to database for admin visibility
      await prisma.auditLog.create({
        data: {
          action: 'NOTIFICATION_FAILED',
          actorId: 'system',
          actorRole: 'SYSTEM',
          targetType: 'BOOKING',
          targetId: bookingId,
          success: false,
          errorMessage: notifError.message,
          metadata: {
            notificationType: 'booking_confirmed',
            ...notificationStatus,
          } as any,
        },
      }).catch(() => {}); // Silent fail if audit log also fails
    }

    return {
      success: true,
      booking: updatedBooking as BookingWithRelations,
      notificationStatus,
      alreadyConfirmed: false,
    };
  }

  /**
   * Cancel a booking (idempotent)
   * Handles refunds, notifications, and audit trail
   */
  static async cancelBooking(params: CancelBookingParams): Promise<{
    success: boolean;
    booking: BookingWithRelations;
    refundIssued: boolean;
    notificationStatus: BookingNotificationStatus;
  }> {
    const { bookingId, cancelledBy, actorId, reason, refundAmount, metadata } = params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { instructor: true, client: true },
    });

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Idempotency: already cancelled
    if (booking.status === 'CANCELLED') {
      return {
        success: true,
        booking: booking as BookingWithRelations,
        refundIssued: false,
        notificationStatus: { emailSent: false, smsSent: false, inAppSent: false },
      };
    }

    // Calculate refund (if applicable)
    let refundToIssue = refundAmount || 0;
    if (refundAmount === undefined && booking.isPaid && booking.price > 0) {
      // Default refund policy based on time until lesson
      const now = new Date();
      const startTime = booking.startTime ? new Date(booking.startTime) : null;
      
      if (startTime) {
        const hoursUntil = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        if (booking.isNonRefundable) {
          refundToIssue = 0; // No refund for non-refundable bookings
        } else if (hoursUntil >= 48) {
          refundToIssue = booking.price; // Full refund if >48h
        } else if (hoursUntil >= 24) {
          refundToIssue = booking.price * 0.5; // 50% refund if 24-48h
        } else {
          refundToIssue = 0; // No refund if <24h
        }
      }
    }

    // Atomic cancellation transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update booking
      const cancelled = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          notes: reason
            ? `${booking.notes || ''}\nCancelled: ${reason}`.trim()
            : booking.notes,
        },
        include: { instructor: true, client: true },
      });

      // Issue wallet refund if applicable
      let refundIssued = false;
      if (refundToIssue > 0 && booking.client?.userId) {
        const wallet = await tx.clientWallet.findUnique({
          where: { userId: booking.client.userId },
        });

        if (wallet) {
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'CREDIT',
              amount: refundToIssue,
              status: 'CONFIRMED',
              description: `Refund for cancelled booking - ${cancelledBy}`,
              bookingId,
              metadata: { reason, cancelledBy } as any,
            },
          });
          refundIssued = true;
        }
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'BOOKING_CANCELLED',
          actorId,
          actorRole: cancelledBy.toUpperCase(),
          targetType: 'BOOKING',
          targetId: bookingId,
          success: true,
          metadata: {
            cancelledBy,
            reason,
            refundAmount: refundToIssue,
            refundIssued,
            ...metadata,
          } as any,
        },
      });

      return { cancelled, refundIssued };
    });

    // Notifications (outside transaction)
    const notificationStatus: BookingNotificationStatus = {
      emailSent: false,
      smsSent: false,
      inAppSent: false,
    };

    try {
      if (booking.client?.userId) {
        await notifyBookingCancelled(
          booking.client.userId,
          booking.instructor.name,
          bookingId
        );
        notificationStatus.inAppSent = true;
      }

      if (booking.instructor.userId) {
        await notifyBookingCancelled(
          booking.instructor.userId,
          booking.clientName || 'Student',
          bookingId
        );
        notificationStatus.inAppSent = true;
      }
    } catch (notifError: any) {
      console.error('Cancellation notification failed:', notifError);
      notificationStatus.failureReason = notifError.message;
    }

    return {
      success: true,
      booking: result.cancelled as BookingWithRelations,
      refundIssued: result.refundIssued,
      notificationStatus,
    };
  }

  /**
   * Mark booking as completed
   */
  static async completeBooking(bookingId: string, actorId: string): Promise<Booking> {
    return await prisma.$transaction(async (tx) => {
      const completed = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'COMPLETED' },
      });

      await tx.auditLog.create({
        data: {
          action: 'BOOKING_COMPLETED',
          actorId,
          actorRole: 'INSTRUCTOR',
          targetType: 'BOOKING',
          targetId: bookingId,
          success: true,
        },
      });

      return completed;
    });
  }

  /**
   * Mark booking as no-show
   */
  static async markNoShow(
    bookingId: string,
    noShowParty: 'client' | 'instructor',
    actorId: string
  ): Promise<Booking> {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'NO_SHOW',
          noShowParty,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'BOOKING_NO_SHOW',
          actorId,
          actorRole: 'INSTRUCTOR',
          targetType: 'BOOKING',
          targetId: bookingId,
          success: true,
          metadata: { noShowParty } as any,
        },
      });

      return updated;
    });
  }

  /**
   * Get booking with unified status
   */
  static async getBookingWithStatus(bookingId: string): Promise<{
    booking: BookingWithRelations;
    displayStatus: ReturnType<typeof getBookingDisplayStatus>;
  }> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { instructor: true, client: true },
    });

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    return {
      booking: booking as BookingWithRelations,
      displayStatus: getBookingDisplayStatus(booking),
    };
  }
}

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Check if notification failed for a booking
 */
export async function getBookingNotificationFailures(bookingId: string): Promise<{
  hasFailures: boolean;
  failures: any[];
}> {
  const failures = await prisma.auditLog.findMany({
    where: {
      action: 'NOTIFICATION_FAILED',
      targetType: 'BOOKING',
      targetId: bookingId,
      success: false,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return {
    hasFailures: failures.length > 0,
    failures,
  };
}

/**
 * Retry failed notifications for a booking
 */
export async function retryBookingNotifications(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { instructor: true, client: true },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Determine which notification to send based on booking status
  if (booking.status === 'CONFIRMED' && booking.clientEmail) {
    await emailService.sendGenericEmail({
      to: booking.clientEmail,
      subject: 'Driving Lesson Confirmed ✓',
      html: `<p>Hi ${booking.clientName || 'Student'}, your booking with ${booking.instructor.name} has been confirmed.</p>`,
    });
  }
}
