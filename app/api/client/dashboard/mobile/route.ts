import { NextRequest, NextResponse } from 'next/server';
import { validateMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';


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
    const client = await prisma.client.findFirst({
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
        clientId: client.id,
        startTime: { gte: now },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
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
      where: { clientId: client.id },
      select: { id: true },
    });

    // Get most recent instructor
    const lastBooking = await prisma.booking.findFirst({
      where: { clientId: client.id },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
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
    });

    // Get client's average rating
    const reviews = await prisma.review.findMany({
      where: {
        booking: {
          clientId: client.id,
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
      instructorName: booking.instructor.name,
      date: booking.startTime.toISOString().split('T')[0],
      time: booking.startTime.toISOString().split('T')[1].substring(0, 5),
      location: booking.pickupAddress || 'Location TBD',
      duration: booking.duration,
    }));

    // Format current instructor
    const currentInstructor = lastBooking
      ? {
          id: lastBooking.instructor.id,
          name: lastBooking.instructor.name,
          phone: lastBooking.instructor.phone,
          email: lastBooking.instructor.user.email,
          averageRating: lastBooking.instructor.averageRating || 0,
          totalReviews: lastBooking.instructor.totalReviews || 0,
          hourlyRate: lastBooking.instructor.hourlyRate,
          profileImage: lastBooking.instructor.profileImage,
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
