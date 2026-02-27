import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get the most recent instructor the client has booked with OR their preferred instructor
    const client = await prisma.client.findFirst({
      where: { userId: user.id },
      select: { 
        id: true,
        preferredInstructorId: true
      }
    });

    if (!client) {
      return NextResponse.json({ currentInstructor: null });
    }

    let instructorId = client.preferredInstructorId;

    // If no preferred instructor, get from latest booking
    if (!instructorId) {
      const latestBooking = await prisma.booking.findFirst({
        where: {
          userId: user.id,
          status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING'] }
        },
        select: { instructorId: true },
        orderBy: { createdAt: 'desc' }
      });
      
      instructorId = latestBooking?.instructorId || null;
    }

    if (!instructorId) {
      return NextResponse.json({ currentInstructor: null });
    }

    // Get instructor details
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      include: {
        user: { select: { email: true } },
        reviews: { select: { rating: true } }
      }
    });

    if (!instructor) {
      return NextResponse.json({ currentInstructor: null });
    }

    const avgRating = instructor.reviews.length > 0
      ? instructor.reviews.reduce((sum, r) => sum + r.rating, 0) / instructor.reviews.length
      : 0;

    // Get package info if this booking is a package
    let packageInfo = null;
    const latestPackageBooking = await prisma.booking.findFirst({
      where: {
        userId: user.id,
        instructorId: instructor.id,
        isPackageBooking: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (latestPackageBooking && latestPackageBooking.isPackageBooking) {
      packageInfo = {
        totalHours: latestPackageBooking.packageHours || 0,
        usedHours: latestPackageBooking.packageHoursUsed || 0,
        remainingHours: (latestPackageBooking.packageHours || 0) - (latestPackageBooking.packageHoursUsed || 0),
        expiryDate: latestPackageBooking.packageExpiryDate,
        status: latestPackageBooking.packageStatus
      };
    }

    // Get services offered by the instructor
    const services = [];
    if (instructor.qualifications) {
      // Extract services from qualifications or add default services
      services.push('Regular Driving Lessons');
      if (JSON.stringify(instructor.qualifications).includes('test') || JSON.stringify(instructor.qualifications).includes('PDA')) {
        services.push('PDA Test Package');
      }
      services.push('Mock Test');
    } else {
      services.push('Regular Driving Lessons');
      services.push('PDA Test Package');
      services.push('Mock Test');
    }

    return NextResponse.json({
      currentInstructor: {
        id: instructor.id,
        name: instructor.name,
        profileImage: instructor.profileImage,
        phone: instructor.phone,
        email: instructor.user.email,
        baseAddress: instructor.baseAddress,
        hourlyRate: instructor.hourlyRate,
        averageRating: parseFloat(avgRating.toFixed(1)),
        totalReviews: instructor.reviews.length,
        offersTestPackage: true,
        services: services
      },
      packageInfo,
      latestBookingId: latestPackageBooking?.id,
      latestBookingStatus: latestPackageBooking?.status
    });
  } catch (error) {
    console.error('Error fetching current instructor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
