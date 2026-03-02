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

    // Get all instructors from database (schema is simplified)
    // TODO: Once schema is updated with location fields, implement geo-based filtering
    const instructors = await prisma.instructor.findMany({
      include: {
        bookings: true
      }
    });

    if (!instructors || instructors.length === 0) {
      return NextResponse.json({ 
        instructors: [],
        count: 0,
        message: 'No instructors found. Please ensure instructors exist in the database.'
      });
    }

    // Format instructors for the frontend
    const formattedInstructors = instructors.map(instructor => ({
      id: instructor.id,
      name: instructor.name,
      phone: instructor.phone,
      hourlyRate: instructor.hourlyRate,
      serviceAreas: instructor.serviceAreas || 'Multiple areas',
      // Default values for missing fields (set defaults for UI compatibility)
      profileImage: null,
      carImage: null,
      carMake: null,
      carModel: null,
      carYear: null,
      averageRating: 4.8,  // Default rating
      totalReviews: 0,
      totalBookings: instructor.bookings?.length || 0,
      distance: 5.2,  // Default distance - improve with geocoding later
      offersTestPackage: false,
      testPackagePrice: null,
      testPackageDuration: null,
      testPackageIncludes: [],
      languages: ['English'],
      vehicleTypes: ['Manual', 'Automatic']
    }));

    return NextResponse.json({ 
      instructors: formattedInstructors,
      count: formattedInstructors.length,
      searchQuery: location,
      note: 'Using simplified schema - add location fields to Prisma for better filtering'
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
