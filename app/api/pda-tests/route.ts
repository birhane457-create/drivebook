// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireActiveSubscription } from '@/lib/middleware/subscriptionValidation';
import { availabilityService } from '@/lib/services/availability';

export const dynamic = 'force-dynamic';

const scheduleSchema = z.object({
  clientId: z.string(),
  testDate: z.string(),   // YYYY-MM-DD
  testTime: z.string(),   // HH:mm
  testCentreId: z.string().optional(), // from TestCentre table
  // fallback if instructor types manually (no centre selected)
  testCenterName: z.string().optional(),
  testCenterAddress: z.string().optional(),
  price: z.number().min(0).optional(), // instructor can override
  notes: z.string().optional(),
});

// GET — list all PDA test bookings for this instructor
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        instructorId: session.user.instructorId,
        bookingType: 'PDA_TEST',
        deletedAt: null,
      } as any,
      include: { client: true },
      orderBy: { startTime: 'desc' },
    });

    const tests = bookings.map((b: any) => ({
      id: b.id,
      testDate: b.startTime,
      // Extract HH:mm directly from the UTC ISO string — avoids server TZ shifting the display time
      testTime: b.startTime
        ? new Date(b.startTime).toISOString().slice(11, 16)
        : '',
      // notes field stores "CentreName|CentreAddress" for structured display
      testCenterName: b.notes?.includes('|') ? b.notes.split('|')[0] : (b.pickupAddress || 'Test Centre'),
      testCenterAddress: b.notes?.includes('|') ? b.notes.split('|')[1] : (b.pickupAddress || ''),
      result: b.instructorNotes?.startsWith('RESULT:')
        ? b.instructorNotes.split(':')[1]?.trim() ?? 'PENDING'
        : 'PENDING',
      instructorNotes: b.instructorNotes || '',
      price: b.price,
      status: b.status,
      client: b.client
        ? { name: b.client.name, phone: b.client.phone, email: b.client.email }
        : { name: b.clientName || 'Unknown', phone: b.clientPhone || '', email: '' },
    }));

    return NextResponse.json(tests);
  } catch (error) {
    console.error('PDA tests fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch PDA tests' }, { status: 500 });
  }
}

// POST — schedule a PDA test
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read-only guard
    const subCheck = await requireActiveSubscription(session.user.id);
    if (!subCheck.valid) {
      return NextResponse.json({ error: subCheck.message, requiresSubscription: true }, { status: 403 });
    }

    // Approval gate — must be APPROVED to schedule PDA tests
    const instructorApproval = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: { approvalStatus: true }
    });
    if (!instructorApproval || instructorApproval.approvalStatus !== 'APPROVED') {
      return NextResponse.json({
        error: 'Your account is pending approval. You can schedule PDA tests once an admin approves your application.',
        requiresApproval: true,
      }, { status: 403 });
    }

    const body = await req.json();
    const data = scheduleSchema.parse(body);

    // Resolve centre name + address
    let centreName = data.testCenterName || '';
    let centreAddress = data.testCenterAddress || '';

    if (data.testCentreId) {
      const centre = await (prisma as any).testCentre.findUnique({
        where: { id: data.testCentreId },
      });
      if (!centre) return NextResponse.json({ error: 'Test centre not found' }, { status: 404 });
      centreName = centre.name;
      centreAddress = `${centre.address}, ${centre.suburb} ${centre.state}`;
    }

    if (!centreName || !centreAddress) {
      return NextResponse.json({ error: 'Test centre name and address are required' }, { status: 400 });
    }

    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: { testPackagePrice: true, testPackageDuration: true },
    });
    if (!instructor) return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });

    // Verify client belongs to instructor
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, instructorId: session.user.instructorId },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    // Price: use override if provided, else instructor's testPackagePrice, else 0
    const price = data.price !== undefined ? data.price : (instructor.testPackagePrice ?? 0);

    // Duration: use instructor's configured testPackageDuration, fall back to 165 min (WA PDA standard)
    const durationMinutes = (instructor.testPackageDuration && instructor.testPackageDuration > 0)
      ? instructor.testPackageDuration
      : 165;

    // Build start/end times — parse as UTC to avoid server timezone shifting the date.
    // The frontend sends YYYY-MM-DD + HH:mm in the instructor's local context;
    // we treat that as a wall-clock time stored without TZ conversion.
    const startTime = new Date(`${data.testDate}T${data.testTime}:00.000Z`);
    if (isNaN(startTime.getTime())) {
      return NextResponse.json({ error: 'Invalid date or time format' }, { status: 400 });
    }
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    // Reject past bookings
    if (startTime < new Date()) {
      return NextResponse.json({ error: 'Test date and time must be in the future' }, { status: 400 });
    }

    // Check for double-booking — PDA test must not overlap any existing confirmed/pending booking
    const hasConflict = await availabilityService.checkDoubleBooking(
      session.user.instructorId,
      startTime,
      endTime
    );
    if (hasConflict) {
      return NextResponse.json({
        error: 'This time slot conflicts with an existing booking. Please choose a different date or time.',
      }, { status: 409 });
    }

    const booking = await prisma.booking.create({
      data: {
        instructorId: session.user.instructorId,
        clientId: data.clientId,
        clientName: client.name,
        clientPhone: client.phone,
        bookingType: 'PDA_TEST',
        startTime,
        endTime,
        duration: durationMinutes,
        price,
        platformFee: 0,
        instructorPayout: price,
        commissionRate: 0,
        isPaid: false,
        // Store centre address as pickupAddress for availability blocking
        pickupAddress: centreAddress,
        // Store "CentreName|CentreAddress" in notes for structured retrieval
        notes: `${centreName}|${centreAddress}`,
        instructorNotes: 'RESULT: PENDING',
        status: 'PENDING_PAYMENT',
        source: 'platform',
        createdBy: 'instructor',
        originalStartTime: startTime,
      } as any,
      include: { client: true },
    });

    // Audit log — PDA tests are instructor-managed but must be traceable
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
            bookingType: 'PDA_TEST',
            clientId: data.clientId,
            clientName: client.name,
            testDate: data.testDate,
            testTime: data.testTime,
            centreName,
            centreAddress,
            price,
            source: 'platform',
          },
        },
      });
    } catch (auditErr) {
      console.error('Audit log failed for PDA test creation:', auditErr);
    }

    return NextResponse.json({ success: true, booking }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('PDA test schedule error:', error);
    return NextResponse.json({ error: 'Failed to schedule PDA test' }, { status: 500 });
  }
}
