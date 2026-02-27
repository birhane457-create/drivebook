import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    const instructors = await prisma.instructor.findMany({
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
        phone: true,
        vehicleTypes: true,
        qualifications: true,
        _count: {
          select: {
            bookings: true,
            reviews: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Calculate average rating and format response
    const formattedInstructors = instructors.map((instructor: typeof instructors[number]) => {
      const avgRating =
        instructor.reviews.length > 0
          ? instructor.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / instructor.reviews.length
          : null;

      return {
        id: instructor.id,
        name: instructor.name,
        bio: instructor.bio,
        profileImage: instructor.profileImage,
        hourlyRate: instructor.hourlyRate,
        baseAddress: instructor.baseAddress,
        languages: instructor.languages,
        phone: instructor.phone,
        vehicleTypes: instructor.vehicleTypes,
        rating: avgRating ? Number(avgRating.toFixed(1)) : null,
        reviews: instructor._count.reviews,
        totalBookings: instructor._count.bookings,
      };
    });

    return NextResponse.json(formattedInstructors);
  } catch (error) {
    console.error('Error fetching public instructors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
