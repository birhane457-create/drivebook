// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkProviderEligible } from '@/lib/booking/checkProviderEligible';
import jwt from 'jsonwebtoken';
import { availabilityService } from '@/lib/services/availability';
import { googleCalendarService } from '@/lib/services/googleCalendar';
import { withSerializableRetry } from '@/lib/utils/transaction-retry';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    console.log('[Mobile API] Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Mobile API] No valid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('[Mobile API] Token:', token.substring(0, 20) + '...');
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
      userId: string;
      providerId: string;
    };
    
    console.log('[Mobile API] Decoded token:', decoded);

    if (!decoded.providerId) {
      console.log('[Mobile API] No providerId in token');
      return NextResponse.json({ error: 'Not an instructor' }, { status: 403 });
    }

    console.log('[Mobile API] Fetching bookings for instructor:', decoded.providerId);

    // Fetch bookings for this instructor
    const bookings = await (prisma as any).booking.findMany({
      where: {
        providerId: decoded.providerId,
        status: { in: ['CONFIRMED', 'COMPLETED', 'CANCELLED'] } // ✅ Exclude PENDING (failed/incomplete payments)
      },
      include: { customer: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    console.log('[Mobile API] Found bookings:', bookings.length);

    // Format bookings for mobile app
    const formattedBookings = bookings.map((booking: any) => ({
      id: booking.id,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      status: booking.status,
      bookingType: booking.bookingType || 'STANDARD_LESSON',
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      price: booking.price,
      notes: booking.notes,
      customer: {
        name: booking.customer.name,
        phone: booking.customer.phone,
        email: booking.customer.email,
      },
      checkInTime: booking.checkInTime?.toISOString(),
      checkOutTime: booking.checkOutTime?.toISOString(),
    }));

    console.log('[Mobile API] Returning formatted bookings');
    return NextResponse.json(formattedBookings);
  } catch (error: any) {
    console.error('[Mobile API] Error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
      userId: string;
      providerId: string;
    };

    if (!decoded.providerId) {
      return NextResponse.json({ error: 'Not an instructor' }, { status: 403 });
    }

    const body = await req.json();
    const {
      customerId,
      bookingType,
      startTime,
      endTime,
      pickupAddress,
      dropoffAddress,
      notes,
      testCenterName,
      testCenterAddress,
    } = body;

    // Validation
    if (!customerId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    // WLA-008-B fix: verify the customer belongs to this instructor before
    // creating a booking. An instructor must have at least one booking with
    // the customer, or the customer must be in their client list.
    // Using the same scoping logic as /api/instructor/clients/[id].
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        bookings: { some: { providerId: decoded.providerId } },
      },
      select: { id: true, name: true, phone: true, email: true },
    });
    if (!customer) {
      return NextResponse.json(
        { error: 'Client not found or does not belong to your clients' },
        { status: 404 }
      );
    }

    // Check for double booking
    const hasConflict = await availabilityService.checkDoubleBooking(
      decoded.providerId,
      start,
      end
    );

    if (hasConflict) {
      return NextResponse.json(
        { error: 'Time slot already booked' },
        { status: 409 }
      );
    }

    // Get instructor — full eligibility gate (DOC-EXP-01)
    const eligible = await checkProviderEligible(decoded.providerId, prisma)
    if (!eligible.allowed) {
      return NextResponse.json(
        { error: eligible.error, code: eligible.code },
        { status: eligible.status },
      )
    }
    const instructor = await prisma.provider.findUnique({
      where: { id: decoded.providerId },
      include: { user: true }
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Calculate price
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const price = instructor.hourlyRate * (durationMinutes / 60);

    // WLA-008-B fix (v2): balance check, booking creation, and wallet debit are
    // all performed inside a single $transaction. This prevents two concurrent
    // requests from both reading a sufficient balance before either debit commits
    // (race condition), and prevents a CONFIRMED/isPaid:true booking with no
    // corresponding wallet debit if the wallet disappears between an outer check
    // and an inner debit.
    //
    // Pattern mirrors the confirmed-path in POST /api/bookings/batch:
    //   1. Re-read wallet inside tx (authoritative, serialized)
    //   2. Aggregate confirmed transactions for the real spendable balance
    //   3. If balance < price → create PENDING_PAYMENT booking, no debit
    //   4. If balance >= price → create CONFIRMED booking + debit atomically
    const clientRecord = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { userId: true },
    });
    const clientUserId = clientRecord?.userId ?? null;

    // WLA-008-B-RUNTIME: SERIALIZABLE isolation ensures that two concurrent
    // transactions cannot both read the same wallet balance and both proceed
    // to debit. Under READ COMMITTED (Prisma default), both would see
    // sufficient funds before either debit commits — a double-spend.
    // Matches the isolation level used in POST /api/bookings, confirm-package-booking,
    // and the Stripe webhook handler.
    const MOBILE_BOOKING_TX = {
      isolationLevel: 'Serializable' as const,
      maxWait: 5000,
      timeout: 10000,
    };

    const booking = await withSerializableRetry(
      () => prisma.$transaction(async (tx) => {
      // Authoritative wallet balance read — inside the transaction so concurrent
      // requests see a consistent snapshot and cannot double-spend.
      let bookingStatus: 'CONFIRMED' | 'PENDING_PAYMENT' = 'PENDING_PAYMENT';
      let walletIdForDebit: string | null = null;

      if (clientUserId) {
        const wallet = await tx.clientWallet.findUnique({
          where: { userId: clientUserId },
          include: { transactions: { where: { status: 'CONFIRMED' } } },
        });
        if (wallet) {
          const credits = wallet.transactions.filter(t => t.type === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0);
          const debits  = wallet.transactions.filter(t => t.type === 'DEBIT').reduce((s, t) => s + Number(t.amount), 0);
          if (credits - debits >= price) {
            bookingStatus = 'CONFIRMED';
            walletIdForDebit = wallet.id;
          }
        }
      }

      const newBooking = await tx.booking.create({
        data: {
          providerId: decoded.providerId,
          customerId,
          bookingType: bookingType || 'LESSON',
          startTime: start,
          endTime: end,
          pickupAddress: bookingType === 'PDA_TEST' ? testCenterAddress : pickupAddress,
          dropoffAddress: bookingType === 'PDA_TEST' ? testCenterAddress : (dropoffAddress || pickupAddress),
          price,
          notes,
          status: bookingStatus,
          isPaid: bookingStatus === 'CONFIRMED',
          paidAt: bookingStatus === 'CONFIRMED' ? new Date() : undefined,
          createdBy: 'provider',
        } as any,
        include: { customer: true },
      });

      // Debit wallet atomically — only if the same tx confirms sufficient balance.
      // walletIdForDebit is non-null only when bookingStatus === 'CONFIRMED'.
      if (walletIdForDebit) {
        await tx.walletTransaction.create({
          data: {
            walletId: walletIdForDebit,
            type: 'DEBIT',
            amount: price,
            description: `Mobile lesson booking — ${start.toLocaleDateString('en-AU')}`,
            status: 'CONFIRMED',
          },
        });
        await tx.clientWallet.update({
          where: { id: walletIdForDebit },
          data: { balance: { decrement: price } },
        });
      }

      return newBooking;
      }, MOBILE_BOOKING_TX),
      { operationName: 'mobile-booking' }
    );

    // If booking type is PDA_TEST, create a PDA test entry
    if (bookingType === 'PDA_TEST' && testCenterName && testCenterAddress) {
      try {
        await prisma.pDATest.create({
          data: {
            providerId: decoded.providerId,
            customerId,
            testCenterName,
            testCenterAddress,
            testCenterLatitude: 0,
            testCenterLongitude: 0,
            testDate: start,
            testTime: start.toISOString().slice(11, 16),
            result: 'PENDING',
            notes,
          },
        });
      } catch (pdaError) {
        console.error('Failed to create PDA test entry:', pdaError);
        // Don't fail the booking if PDA test creation fails
      }
    }

    // Create Google Calendar event if instructor has calendar connected
    if (instructor.syncGoogleCalendar) {
      try {
        const result = await googleCalendarService.createCalendarEvent(
          decoded.providerId,
          {
            id: booking.id,
            startTime: booking.startTime,
            endTime: booking.endTime,
            customerName: booking.customer.name,
            customerPhone: booking.customer.phone,
            pickupAddress: booking.pickupAddress || undefined,
            notes: booking.notes || undefined,
          }
        );

        // Update booking with calendar event ID
        if (result.success && result.eventId) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { googleCalendarEventId: result.eventId },
          });
        }
      } catch (calendarError) {
        console.error('Failed to create calendar event:', calendarError);
        // Don't fail the booking if calendar creation fails
      }
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        status: booking.status,
        bookingType: booking.bookingType,
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        price: booking.price,
        notes: booking.notes,
        customer: {
          name: booking.customer.name,
          phone: booking.customer.phone,
          email: booking.customer.email,
        },
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Mobile API] Create booking error:', error);

    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // WLA-008-B-RUNTIME: P2034 = serialization conflict exhausted after retries.
    // The concurrent request that won has already committed; the client should
    // retry. 409 is more informative than 500 and matches the pattern used in
    // /api/bookings (SLOT_CONFLICT → 409).
    if (error?.code === 'P2034') {
      return NextResponse.json(
        { error: 'Booking could not be confirmed due to a concurrent request. Please try again.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
