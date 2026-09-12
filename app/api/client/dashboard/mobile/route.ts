// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { validateMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { getDisplayName } from '@/lib/utils/account';


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

    // Get client record
    const client = await prisma.customer.findFirst({
      where: { userId: auth.user!.id },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    const now = new Date();

    // Get upcoming lessons
    const upcomingBookings = await prisma.booking.findMany({
      where: {
        customerId: client.id,
        startTime: { gte: now },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            businessName: true,
            accountType: true,
            subscriptionTier: true,
            phone: true,
            profileImage: true,
            averageRating: true,
            totalReviews: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
      take: 10,
    });

    // Get total stats
    const allBookings = await prisma.booking.findMany({
      where: { customerId: client.id },
      select: { id: true },
    });

    // Get most recent instructor
    const lastBooking = await prisma.booking.findFirst({
      where: { customerId: client.id },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            businessName: true,
            accountType: true,
            subscriptionTier: true,
            phone: true,
            profileImage: true,
            hourlyRate: true,
            averageRating: true,
            totalReviews: true,
            user: {
              select: { email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as any;

    // Get client's average rating
    const reviews = await prisma.review.findMany({
      where: {
        booking: {
          customerId: client.id,
        },
      },
      select: { rating: true },
    });

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
        : 0;

    // Format upcoming lessons
    const formattedLessons = upcomingBookings.map((booking: typeof upcomingBookings[number]) => ({
      id: booking.id,
      instructorName: getDisplayName(booking.provider),
      date: booking.startTime.toISOString().split('T')[0],
      time: booking.startTime.toISOString().split('T')[1].substring(0, 5),
      location: booking.pickupAddress || 'Location TBD',
      duration: booking.duration,
    }));

    // Format current instructor
    const currentInstructor = lastBooking
      ? {
          id: lastBooking.provider.id,
          name: getDisplayName(lastBooking.provider),
          phone: lastBooking.provider.phone,
          email: lastBooking.provider.user.email,
          averageRating: lastBooking.provider.averageRating || 0,
          totalReviews: lastBooking.provider.totalReviews || 0,
          hourlyRate: lastBooking.provider.hourlyRate,
          profileImage: lastBooking.provider.profileImage,
        }
      : null;

    return NextResponse.json({
      upcomingLessons: formattedLessons,
      currentInstructor,
      totalBookings: allBookings.length,
      totalCredits: 0, // Will be calculated from wallet
      averageRating: Math.round(averageRating * 10) / 10,
    });
  } catch (error) {
    console.error('Error fetching client dashboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
