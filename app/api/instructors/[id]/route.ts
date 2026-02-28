import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const instructor = await prisma.instructor.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        bio: true,
        phone: true,
        profileImage: true,
        baseAddress: true,
        hourlyRate: true,
        averageRating: true,
        totalReviews: true,
        serviceRadiusKm: true,
      },
    });

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(instructor);
  } catch (error) {
    console.error('Instructor fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch instructor' },
      { status: 500 }
    );
  }
}
