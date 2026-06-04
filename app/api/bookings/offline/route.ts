import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireActiveSubscription } from '@/lib/middleware/subscriptionValidation';

export const dynamic = 'force-dynamic';

const offlineBookingSchema = z.object({
  clientName: z.string().min(1).max(100),
  clientPhone: z.string().optional().default(''),
  clientEmail: z.string().email().optional(), // used only for platform client guard check
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().min(30).max(480),
  pickupAddress: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  offlinePaymentMethod: z.enum(['cash', 'bank_transfer', 'other']).optional(),
  offlineAmountPaid: z.number().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // PRO+ gate
    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: { subscriptionTier: true, hourlyRate: true, approvalStatus: true },
    });
    if (!instructor) return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });

    // Subscription / read-only gate
    const subCheck = await requireActiveSubscription(session.user.id);
    if (!subCheck.valid) {
      return NextResponse.json({ error: subCheck.message, requiresSubscription: true }, { status: 403 });
    }

    // Approval gate — must be APPROVED to create bookings
    if (instructor.approvalStatus !== 'APPROVED') {
      return NextResponse.json({
        error: 'Your account is pending approval. You can create bookings once an admin approves your application.',
        requiresApproval: true,
      }, { status: 403 });
    }

    const tier = instructor.subscriptionTier ?? 'BASIC';
    if (tier === 'BASIC') {
      return NextResponse.json({
        error: 'Offline booking tracking requires PRO or above',
        upgradeRequired: true,
        upgradeUrl: '/dashboard/subscription',
      }, { status: 403 });
    }

    const body = await req.json();
    const data = offlineBookingSchema.parse(body);

    // ── Platform client guard ─────────────────────────────────────────────────
    // Offline bookings are only for the instructor's pre-existing cash students.
    // If a client with this email already has a DriveBook account linked to this
    // instructor, they must book through the platform — not offline.
    // This prevents instructors from routing platform-acquired students to cash.
    if (data.clientEmail) {
      const existingClient = await prisma.client.findFirst({
        where: {
          instructorId: session.user.instructorId,
          email: data.clientEmail,
          userId: { not: null }, // has a DriveBook account
        },
        select: { id: true },
      });
      if (existingClient) {
        return NextResponse.json({
          error: 'This student has a DriveBook account linked to your profile. Please use a platform booking so they can pay through their wallet.',
          platformClientBlocked: true,
        }, { status: 403 });
      }
    }

    // Parse date + time into start/end
    const [year, month, day] = data.date.split('-').map(Number);
    const [hour, minute] = data.time.split(':').map(Number);
    const startTime = new Date(year, month - 1, day, hour, minute, 0, 0);
    const endTime = new Date(startTime.getTime() + data.durationMinutes * 60 * 1000);

    if (startTime < new Date()) {
      // Allow past offline bookings — instructors may log historical lessons
    }

    // Conflict check — offline bookings still block the slot
    const conflict = await prisma.booking.findFirst({
      where: {
        instructorId: session.user.instructorId,
        status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
        OR: [
          { startTime: { lte: startTime }, endTime: { gt: startTime } },
          { startTime: { lt: endTime }, endTime: { gte: endTime } },
          { startTime: { gte: startTime }, endTime: { lte: endTime } },
        ],
      },
      select: { id: true, source: true } as any,
    });

    if (conflict) {
      return NextResponse.json({
        error: 'This time slot conflicts with an existing booking',
        conflictingBookingId: conflict.id,
      }, { status: 409 });
    }

    const booking = await prisma.booking.create({
      data: {
        instructorId: session.user.instructorId,
        clientName: data.clientName,
        clientPhone: data.clientPhone || null,
        bookingType: 'LESSON',
        status: 'CONFIRMED',
        startTime,
        endTime,
        duration: data.durationMinutes,
        price: data.offlineAmountPaid ?? 0,
        platformFee: 0,
        instructorPayout: data.offlineAmountPaid ?? 0,
        commissionRate: 0,
        isPaid: true,
        paidAt: new Date(),
        pickupAddress: data.pickupAddress || null,
        notes: data.notes || null,
        createdBy: 'instructor',
        originalStartTime: startTime,
        source: 'offline',
        offlinePaymentMethod: data.offlinePaymentMethod ?? null,
        offlineAmountPaid: data.offlineAmountPaid ?? null,
        clientEmail: data.clientEmail ?? null,
      } as any,
    });

    // Audit log — offline bookings must be traceable for dispute resolution
    try {
      await (prisma as any).auditLog.create({
        data: {
          action: 'BOOKING_CREATED',
          actorId: session.user.id!,
          actorRole: 'INSTRUCTOR',
          targetType: 'BOOKING',
          targetId: booking.id,
          success: true,
          metadata: {
            clientName: data.clientName,
            clientPhone: data.clientPhone || null,
            startTime: startTime.toISOString(),
            price: data.offlineAmountPaid ?? 0,
            paymentMethod: data.offlinePaymentMethod ?? null,
            source: 'offline',
          },
        },
      });
    } catch (auditErr) {
      console.error('Audit log failed for offline booking creation:', auditErr);
    }

    return NextResponse.json({ success: true, booking }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Offline booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}