// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { validateMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { checkProviderEligible } from '@/lib/booking/checkProviderEligible';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    // Validate mobile token
    const auth = await validateMobileToken(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a client
    if (auth.user?.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get client records
    const clientRecords = await prisma.customer.findMany({
      where: { userId: auth.user!.id },
    });

    const clientIds = clientRecords.map((c: typeof clientRecords[number]) => c.id);

    if (clientIds.length === 0) {
      return NextResponse.json({
        packages: [],
        summary: {
          total: 0,
          used: 0,
          remaining: 0,
          activeCount: 0,
          expiring_soon: 0,
        },
      });
    }

    // Get package bookings
    const packageBookings = await prisma.booking.findMany({
      where: {
        customerId: { in: clientIds },
        isPackageBooking: true,
      },
      include: {
        provider: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Process packages
    const packages = await Promise.all(
      packageBookings.map(async (packageBooking: typeof packageBookings[number]) => {
        const childBookings = await prisma.booking.findMany({
          where: {
            parentBookingId: packageBooking.id,
            isPackageBooking: false,
          },
          orderBy: { startTime: 'asc' },
        });

        const hoursUsed = childBookings
          .filter((b: typeof childBookings[number]) => b.status === 'COMPLETED' || b.status === 'CONFIRMED')
          .reduce((sum: any, b: any) => {
            const duration =
              (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) /
              (1000 * 60 * 60);
            return sum + duration;
          }, 0);

        const packageHours = packageBooking.packageHours || 0;
        const remaining = Math.max(0, packageHours - hoursUsed);

        const now = new Date();
        const isExpired =
          packageBooking.packageExpiryDate &&
          new Date(packageBooking.packageExpiryDate) < now;
        const isCompleted = remaining === 0;
        const status = isExpired
          ? 'expired'
          : isCompleted
          ? 'completed'
          : packageBooking.packageStatus || 'active';

        return {
          id: packageBooking.id,
          purchaseDate: packageBooking.createdAt,
          expiryDate: packageBooking.packageExpiryDate,
          hoursTotal: packageHours,
          hoursUsed: hoursUsed,
          hoursRemaining: remaining,
          status: status,
          instructor: packageBooking.provider,
          canScheduleMore: status === 'active' && remaining > 0,
        };
      })
    );

    // Calculate summary
    const summary = {
      total: packages.reduce((sum: number, p: typeof packages[number]) => sum + p.hoursTotal, 0),
      used: packages.reduce((sum: number, p: typeof packages[number]) => sum + p.hoursUsed, 0),
      remaining: packages.reduce((sum: number, p: typeof packages[number]) => sum + p.hoursRemaining, 0),
      activeCount: packages.filter((p: typeof packages[number]) => p.status === 'active').length,
      expiring_soon: packages.filter((p: typeof packages[number]) => {
        if (!p.expiryDate) return false;
        const daysUntilExpiry =
          (new Date(p.expiryDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24);
        return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
      }).length,
    };

    return NextResponse.json({
      packages,
      summary,
    });
  } catch (error) {
    console.error('Error fetching client packages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // INT-M-PKG-01 CONTAINMENT: This endpoint is disabled pending security remediation.
  // Three defects require architectural redesign:
  //   1. IDOR: packageId (caller-supplied) used as providerId with no ownership check
  //   2. Hardcoded pricing: price, packageHours, duration are server constants
  //   3. Payment bypass: status='CONFIRMED' regardless of isPaid
  //
  // This endpoint will remain disabled until a replacement package catalog + payment
  // flow is implemented. The replacement must enforce:
  //   - Server-side package identity/pricing authority (InstructorPackage catalog)
  //   - Client entitlement verification (ownership/relationship check)
  //   - Payment-before-activation (Stripe payment intent required)
  //
  // To re-enable after proper implementation, set: ENABLE_MOBILE_PACKAGE_PURCHASE=true
  // See: docs/audit/phase2/INT-M-PKG-01-DISCOVERY.md
  
  const enabled = process.env.ENABLE_MOBILE_PACKAGE_PURCHASE === 'true'
  
  if (!enabled) {
    return NextResponse.json(
      {
        error: 'Mobile package purchase is temporarily unavailable',
        message: 'Please visit the web app to purchase lesson packages',
        code: 'MOBILE_PURCHASE_DISABLED',
        webUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://drivebook.com.au',
      },
      { status: 503 }
    )
  }

  try {
    // Validate mobile token
    const auth = await validateMobileToken(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { packageId, paymentMethod } = await req.json();

    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID is required' },
        { status: 400 }
      );
    }

    // Verify user is a client
    if (auth.user?.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get client
    const client = await prisma.customer.findFirst({
      where: { userId: auth.user!.id },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client profile not found' },
        { status: 404 }
      );
    }

    // Create package booking from packageId (which is actually booking or instructor package)
    // NOTE: packageId is used as providerId — deeper validation tracked in INT-M-PKG-01
    // Minimum safety gate: verify the provider exists and is eligible (DOC-EXP-01)
    const eligible = await checkProviderEligible(packageId, prisma)
    if (!eligible.allowed) {
      return NextResponse.json(
        { error: eligible.error, code: eligible.code },
        { status: eligible.status },
      )
    }

    // For now, just create a basic package booking
    const booking = await prisma.booking.create({
      data: {
        customerId: client.id,
        providerId: packageId, // packageId should be instructor ID in this context
        isPackageBooking: true,
        packageHours: 10, // Default package hours
        packageStatus: 'active',
        packageExpiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        price: 500,
        status: 'CONFIRMED',
        isPaid: paymentMethod !== 'manual',
        duration: 10,
        startTime: new Date(),
        endTime: new Date(Date.now() + 10 * 60 * 60 * 1000),
        createdBy: auth.user!.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        bookingId: booking.id,
        message: 'Package purchased successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating package booking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
