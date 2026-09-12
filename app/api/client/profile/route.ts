import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Pagination params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const skip = (page - 1) * limit

    const user = await prisma.user.findUnique({
      where: { email: session!.user!.email },
      include: {
        customers: {
          orderBy: { id: 'desc' }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get the most recent client record (for display details)
    const clientRecord = (user as any).customers[0];

    // Collect all client IDs linked to this user
    const clientIds = (user as any).customers.map((c: any) => c.id);

    // Get total count
    const total = await prisma.booking.count({
      where: clientIds.length > 0
        ? { customerId: { in: clientIds } }
        : { customerId: null },
    })

    // Get user's bookings via customerId only
    const bookingsRaw = await prisma.booking.findMany({
      where: clientIds.length > 0
        ? { customerId: { in: clientIds } }
        : { customerId: null }, // Return empty if no client IDs
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            hourlyRate: true,
            phone: true,
            whatsapp: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });

    // De-duplicate bookings in case a record matches both customerId and customerEmail
    const bookingMap = new Map<string, typeof bookingsRaw[number]>();
    for (const b of bookingsRaw) {
      bookingMap.set(b.id, b);
    }
    const bookings = Array.from(bookingMap.values());

    const now = new Date();
    const upcomingBookings = bookings.filter((b: any) => {
      if (!b.startTime) return false;
      return b.startTime > now && b.status === 'CONFIRMED';
    });
    const pastBookings = bookings.filter((b: any) => {
      if (!b.startTime) return false;
      return b.startTime <= now && b.status === 'COMPLETED';
    });

    const activeBookings = bookings.filter((b: any) => {
      // Always show these â€” student needs to see them
      if (b.status === 'PENDING_PAYMENT') return true; // "Awaiting Payment"
      if (b.status === 'PENDING') return true;          // "Awaiting Confirmation"
      // Show terminal states so student has history
      if (b.status === 'CONFIRMED') return true;
      if (b.status === 'COMPLETED') return true;
      if (b.status === 'NO_SHOW') return true;
      if (b.status === 'CANCELLED') return true;
      if (b.status === 'EXPIRED') return true;
      return false;
    });

    return NextResponse.json({
      user: {
        name: clientRecord?.name || user.name || user.email.split('@')[0],
        email: user.email,
        phone: clientRecord?.phone || '',
        address: clientRecord?.defaultPickupAddress || ''
      },
      bookings: activeBookings.map((b: any) => {
        // Map database status to frontend display status
        // Rule: only use time-based fallback for CONFIRMED bookings that the
        // cron hasn't processed yet (endTime passed but still CONFIRMED).
        // Never override an explicit terminal status (COMPLETED, NO_SHOW, etc.)
        let displayStatus: string;
        switch (b.status) {
          case 'CONFIRMED':
            displayStatus = b.endTime && b.endTime <= now ? 'completed' : 'upcoming';
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

        return {
          id: b.id,
          date: b.startTime ? b.startTime.toISOString().split('T')[0] : null,
          time: b.startTime ? b.startTime.toISOString().split('T')[1].substring(0, 5) : null,
          duration: b.duration || null,
          status: displayStatus,
          dbStatus: b.status,
          pickupAddress: (b as any).pickupAddress || null,
          notes: (b as any).notes || null,
          // For package bookings: price should always be the per-lesson rate (1hr Ã— hourlyRate).
          // Guard against old-bug bookings where price was incorrectly set to packageTotalPaid.
          // AUDIT FIX #13: Use lockedHourlyRate instead of current hourlyRate for historical packages
          price: (() => {
            const raw = b as any;
            if (raw.isPackageBooking) {
              const lockedRate = raw.lockedHourlyRate ?? b.provider.hourlyRate;
              const durationHours = (b.duration ?? 60) / 60;
              const expectedPrice = lockedRate * durationHours;
              // If price suspiciously high (>150% of expected), assume package total bug
              if (b.price > expectedPrice * 1.5) {
                return parseFloat(expectedPrice.toFixed(2));
              }
            }
            return b.price;
          })(),
          isPaid: b.isPaid,
          isPackageBooking: (b as any).isPackageBooking || false,
          packageHours: (b as any).packageHours || null,
          provider: {
            id: b.provider.id,
            name: b.provider.name,
            hourlyRate: b.provider.hourlyRate,
            phone: (b.provider as any).phone || null,
            whatsapp: (b.provider as any).whatsapp || null,
          }
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
      upcomingCount: activeBookings.filter((b: any) => {
        if (!b.startTime) return false;
        return (b.status === 'CONFIRMED') && (!b.endTime || b.endTime > now);
      }).length,
      pastCount: activeBookings.filter((b: any) => {
        return b.status === 'COMPLETED' || b.status === 'NO_SHOW' ||
          (b.status === 'CONFIRMED' && b.endTime != null && b.endTime <= now);
      }).length
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, phone, address } = body;

    const user = await prisma.user.findUnique({
      where: { email: session!.user!.email },
      include: {
        customers: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update all client records for this user to keep consistency
    if ((user as any).customers.length > 0) {
      await prisma.customer.updateMany({
        where: { userId: user.id },
        data: {
            name,
            phone,
            defaultPickupAddress: address || null
          }
      });
    }

    return NextResponse.json({
      success: true,
      user: {
          name,
          email: user.email,
          phone,
          address: address || ''
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
