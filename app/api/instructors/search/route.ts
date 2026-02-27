import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { geocodeAddress, calculateDistance, getBoundingBox } from '@/lib/utils/distance';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const location = searchParams.get('location');

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 });
    }

    console.log('Searching for location:', location);

    // Geocode the search location
    const coords = await geocodeAddress(location);
    
    if (!coords) {
      console.log('Geocoding failed for:', location);
      return NextResponse.json({ 
        error: 'Location not found',
        message: 'Could not find coordinates for the specified location. Try a different format like "Maylands WA" or "6051"'
      }, { status: 404 });
    }

    console.log('Geocoded to:', coords);

    // Get bounding box for pre-filtering (50km max radius)
    const bbox = getBoundingBox(coords.lat, coords.lng, 50);

    console.log('Bounding box:', bbox);

    // Get all active approved instructors within rough bounding box
    const instructors = await prisma.instructor.findMany({
      where: {
        isActive: true,
        approvalStatus: 'APPROVED',
        baseLatitude: {
          gte: bbox.minLat,
          lte: bbox.maxLat
        },
        baseLongitude: {
          gte: bbox.minLng,
          lte: bbox.maxLng
        }
      },
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
        // Test package fields
        offersTestPackage: true,
        testPackagePrice: true,
        testPackageDuration: true,
        testPackageIncludes: true
      }
    });

    console.log(`Found ${instructors.length} instructors in bounding box`);

    // Filter by actual distance within service radius
    const instructorsWithDistance = instructors
      .map(instructor => {
        const distance = calculateDistance(
          instructor.baseLatitude,
          instructor.baseLongitude,
          coords.lat,
          coords.lng
        );

        console.log(`${instructor.name}: ${distance.toFixed(1)}km away, radius: ${instructor.serviceRadiusKm}km, within: ${distance <= instructor.serviceRadiusKm}`);

        return {
          ...instructor,
          distance,
          isWithinRadius: distance <= instructor.serviceRadiusKm
        };
      })
      .filter(instructor => instructor.isWithinRadius)
      .sort((a, b) => {
        // Sort by: featured first, then by distance
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return a.distance - b.distance;
      });

    console.log(`${instructorsWithDistance.length} instructors within service radius`);

    return NextResponse.json({ 
      instructors: instructorsWithDistance,
      count: instructorsWithDistance.length,
      searchQuery: location,
      searchLocation: {
        lat: coords.lat,
        lng: coords.lng,
        displayName: coords.displayName
      },
      debug: {
        totalInstructorsInBbox: instructors.length,
        instructorsWithinRadius: instructorsWithDistance.length,
        bbox
      }
    });
  } catch (error) {
    console.error('Instructor search error:', error);
    return NextResponse.json(
      { error: 'Failed to search instructors', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
