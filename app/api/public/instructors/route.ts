// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const instructors = await prisma.provider.findMany({
      where: {
        // Only return approved and active instructors
        approvalStatus: 'APPROVED',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        bio: true,
        profileImage: true,
        hourlyRate: true,
        baseAddress: true,
        languages: true,
        // DATA-EXP-01: phone removed — not required by any public booking flow
        // averageRating and totalReviews are pre-aggregated on the Provider row;
        // there is no separate Review model — ratings live on Booking.customerRating
        averageRating: true,
        totalReviews: true,
        _count: {
          select: {
            bookings: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Format response — shape matches what mobile and web booking flows expect
    const formattedInstructors = instructors.map((instructor: any) => {
      return {
        id: instructor.id,
        name: instructor.name,
        bio: instructor.bio,
        profileImage: instructor.profileImage,
        hourlyRate: instructor.hourlyRate,
        baseAddress: instructor.baseAddress,
        languages: instructor.languages,
        // DATA-EXP-01: phone intentionally omitted from public response
        rating: instructor.averageRating ? Number(instructor.averageRating.toFixed(1)) : null,
        reviews: instructor.totalReviews,
        totalBookings: instructor._count.bookings,
      };
    });

    return NextResponse.json(formattedInstructors);
  } catch (error) {
    console.error('Error fetching public providers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
