import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const location = searchParams.get('location');

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 });
    }

    console.log('Searching for instructors with location:', location);

    // Get all instructors for now (location filtering needs serviceAreas to be populated)
    const instructors = await prisma.instructor.findMany({
      include: {
        bookings: true
      }
    });

    console.log(`Found ${instructors.length} instructors`);

    if (!instructors || instructors.length === 0) {
      return NextResponse.json({ 
        instructors: [],
        count: 0,
        message: location 
          ? `No instructors found in ${location}. Try searching for a different location or nearby suburb.`
          : 'No instructors found.'
      });
    }

    // Format instructors for the frontend
    const formattedInstructors = instructors.map(instructor => ({
      id: instructor.id,
      name: instructor.name,
      profileImage: instructor.profileImage,
      carImage: instructor.carImage,
      carMake: instructor.carMake,
      carModel: instructor.carModel,
      carYear: instructor.carYear,
      hourlyRate: instructor.hourlyRate,
      vehicleTypes: ['Manual', 'Automatic'], // Default values
      languages: ['English'], // Default values
      averageRating: 4.8, // Default rating
      totalReviews: 0, // TODO: implement reviews
      totalBookings: instructor.bookings?.length || 0,
      bio: instructor.bio || 'Experienced driving instructor',
      distance: 5.2, // Default distance
      offersTestPackage: false, // TODO: implement test packages
      testPackagePrice: null,
      testPackageDuration: null,
      testPackageIncludes: []
    }));

    return NextResponse.json({ 
      instructors: formattedInstructors,
      count: formattedInstructors.length,
      searchQuery: location,
      note: 'Location filtering not yet implemented - showing all available instructors'
    });
  } catch (error) {
    console.error('Instructor search error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search instructors',
        details: error instanceof Error ? error.message : 'Unknown error',
        message: 'Check that your Prisma schema includes all required Instructor fields'
      },
      { status: 500 }
    );
  }
}
