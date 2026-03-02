import { NextRequest, NextResponse } from 'next/server';
import { validateMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { geocodeAddress, calculateDistance, getBoundingBox } from '@/lib/utils/distance';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    // Validate mobile token (optional - allow searches without auth too)
    const auth = await validateMobileToken(req);
    
    const { searchParams } = new URL(req.url);
    const location = searchParams.get('location');
    const specialty = searchParams.get('specialty');
    const minRating = searchParams.get('minRating');
    const maxDistance = parseInt(searchParams.get('maxDistance') || '50');

    if (!location) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      );
    }

    // Geocode the search location
    const coords = await geocodeAddress(location);
    
    if (!coords) {
      return NextResponse.json(
        { 
          error: 'Location not found',
          message: 'Could not find coordinates for the specified location.',
        },
        { status: 404 }
      );
    }

    // Get bounding box for pre-filtering
    const bbox = getBoundingBox(coords.lat, coords.lng, maxDistance);

    // Get instructors within bounding box
    let whereClause: any = {
      isActive: true,
      approvalStatus: 'APPROVED',
      baseLatitude: {
        gte: bbox.minLat,
        lte: bbox.maxLat,
      },
      baseLongitude: {
        gte: bbox.minLng,
        lte: bbox.maxLng,
      },
    };

    // Add specialty filter if provided
    if (specialty) {
      whereClause.services = {
        some: {
          name: { contains: specialty, mode: 'insensitive' },
        },
      };
    }

    // Add rating filter if provided
    if (minRating) {
      whereClause.averageRating = {
        gte: parseFloat(minRating),
      };
    }

    const instructors = await prisma.instructor.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        phone: true,
        bio: true,
        profileImage: true,
        carImage: true,
        carMake: true,
        carModel: true,
        carYear: true,
        baseLatitude: true,
        baseLongitude: true,
        baseAddress: true,
        hourlyRate: true,
        vehicleTypes: true,
        languages: true,
        serviceRadiusKm: true,
        averageRating: true,
        totalReviews: true,
        totalBookings: true,
        isFeatured: true,
        offersTestPackage: true,
        testPackagePrice: true,
        testPackageDuration: true,
      },
    });

    // Filter by actual distance and service radius
    const instructorsWithDistance = instructors
      .map((instructor) => {
        const distance = calculateDistance(
          instructor.baseLatitude,
          instructor.baseLongitude,
          coords.lat,
          coords.lng
        );

        return {
          ...instructor,
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal
          isWithinRadius: distance <= instructor.serviceRadiusKm,
        };
      })
      .filter((instructor) => instructor.isWithinRadius)
      .sort((a, b) => {
        // Sort by: featured first, then by rating, then by distance
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        if ((b.averageRating || 0) !== (a.averageRating || 0)) {
          return (b.averageRating || 0) - (a.averageRating || 0);
        }
        return a.distance - b.distance;
      });

    return NextResponse.json({
      instructors: instructorsWithDistance,
      count: instructorsWithDistance.length,
      searchLocation: {
        lat: coords.lat,
        lng: coords.lng,
        displayName: coords.displayName,
      },
    });
  } catch (error) {
    console.error('Error searching instructors:', error);
    return NextResponse.json(
      {
        error: 'Failed to search instructors',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
