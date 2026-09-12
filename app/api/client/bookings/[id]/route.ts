import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { mergeLessonOutcome } from '@/lib/extensions/driving/lessonOutcome';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session!.user!.email },
      include: { customers: { select: { id: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const clientIds = (user as any).customers.map((c: any) => c.id);

    const booking = await prisma.booking.findFirst({
      where: {
        id: params.id,
        customerId: { in: clientIds },
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            hourlyRate: true,
            phone: true,
            whatsapp: true,
          },
        },
      },
    }) as any;

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const now = new Date();
    const raw = booking as any;

    // Map DB status to display status
    let displayStatus: string;
    switch (booking.status) {
      case 'CONFIRMED':
        displayStatus = booking.endTime && booking.endTime <= now ? 'completed' : 'upcoming';
        break;
      case 'COMPLETED':
      case 'NO_SHOW':
        displayStatus = 'completed';
        break;
      case 'PENDING_PAYMENT':
        displayStatus = 'awaiting_payment';
        break;
      case 'PENDING':
        displayStatus = 'awaiting_confirmation';
        break;
      case 'CANCELLED':
        displayStatus = 'cancelled';
        break;
      case 'EXPIRED':
        displayStatus = 'expired';
        break;
      default:
        displayStatus = 'upcoming';
    }

    // Price guard for old package bug
    const price =
      raw.isPackageBooking && raw.packageTotalPaid && booking.price === raw.packageTotalPaid
        ? booking.provider.hourlyRate
        : booking.price;

    // Merge outcome fields from extension table (falls back to Booking cols)
    const outcome = await mergeLessonOutcome(booking.id, raw)

    return NextResponse.json({
      bookingType: raw.bookingType || null,
      id: booking.id,
      date: booking.startTime ? booking.startTime.toISOString().split('T')[0] : null,
      time: booking.startTime ? booking.startTime.toISOString().split('T')[1].substring(0, 5) : null,
      endTime: booking.endTime ? booking.endTime.toISOString() : null,
      startTime: booking.startTime ? booking.startTime.toISOString() : null,
      duration: booking.duration || null,
      status: displayStatus,
      dbStatus: booking.status,
      price,
      isPaid: booking.isPaid,
      pickupAddress: raw.pickupAddress || null,
      notes: raw.notes || null,
      isPackageBooking: raw.isPackageBooking || false,
      packageHours: raw.packageHours || null,
      isReviewed: raw.isReviewed || false,
      performanceScore: (outcome as any).performanceScore || null,
      instructorNotes: (outcome as any).instructorNotes || null,
      lessonFeedback: (outcome as any).lessonFeedback || [],
      studentStrengths: (outcome as any).studentStrengths || [],
      focusAreas: (outcome as any).focusAreas || [],
      whiteboardSketchUrl: (outcome as any).whiteboardSketchUrl || null,
      provider: {
        id: raw.provider.id,
        name: raw.provider.name,
        hourlyRate: raw.provider.hourlyRate,
        phone: raw.provider.phone || null,
        whatsapp: raw.provider.whatsapp || null,
        email: null,
      },
    });
  } catch (error) {
    console.error('Get client booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
