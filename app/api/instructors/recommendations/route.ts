// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { geocodeAddress, calculateDistance, getBoundingBox } from '@/lib/utils/distance';

export const dynamic = 'force-dynamic';

/**
 * GET /api/instructors/recommendations
 * Smart instructor recommendation engine with ranking algorithm
 * Returns top instructors based on location, preferences, and intelligent scoring
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const location = searchParams.get('location');
    const vehicleType = searchParams.get('vehicleType'); // AUTO, MANUAL
    const language = searchParams.get('language');
    const maxBudget = searchParams.get('budget') ? parseFloat(searchParams.get('budget')!) : null;
    const experienceLevel = searchParams.get('experienceLevel'); // beginner, intermediate, advanced
    const limit = parseInt(searchParams.get('limit') || '3');

    if (!location) {
      return NextResponse.json(
        { error: 'location parameter is required' },
        { status: 400 }
      );
    }

    // Geocode the location
    const coords = await geocodeAddress(location);
    
    if (!coords) {
      return NextResponse.json(
        { error: 'Location not found', message: 'Could not find coordinates for the specified location' },
        { status: 404 }
      );
    }

    // Get bounding box for pre-filtering (50km radius)
    const bbox = getBoundingBox(coords.lat, coords.lng, 50);

    // Build filter conditions
    const whereConditions: any = {
      isActive: true,
      approvalStatus: 'APPROVED',
      baseLatitude: { gte: bbox.minLat, lte: bbox.maxLat },
      baseLongitude: { gte: bbox.minLng, lte: bbox.maxLng },
    };

    // Filter by vehicle type if specified
    if (vehicleType) {
      whereConditions.vehicleTypes = { contains: vehicleType.toUpperCase() };
    }

    // Filter by language if specified
    if (language) {
      whereConditions.languages = { contains: language };
    }

    // Filter by budget if specified
    if (maxBudget) {
      whereConditions.hourlyRate = { lte: maxBudget };
    }

    // Get instructors
    const instructors = await prisma.instructor.findMany({
      where: whereConditions,
      select: {
        id: true,
        name: true,
        hourlyRate: true,
        baseLatitude: true,
        baseLongitude: true,
        baseAddress: true,
        vehicleTypes: true,
        languages: true,
        serviceRadiusKm: true,
        bio: true,
        profileImage: true,
        carMake: true,
        carModel: true,
        carYear: true,
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
    } as any); // Type assertion until Prisma client is regenerated

    // Calculate scores and filter by service radius
    const scoredInstructors = instructors
      .map((instructor: any) => { // Type assertion for each instructor
        const distance = calculateDistance(
          instructor.baseLatitude,
          instructor.baseLongitude,
          coords.lat,
          coords.lng
        );

        // Skip if outside service radius
        if (distance > (instructor.serviceRadiusKm || 50)) {
          return null;
        }

        // Calculate average rating from reviews
        const averageRating = instructor.reviews.length > 0
          ? instructor.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / instructor.reviews.length
          : 0;

        const totalReviews = instructor._count.reviews;
        const totalBookings = instructor._count.bookings;

        // Scoring algorithm (0-100 scale)
        
        // 1. Rating score (40% weight) - 0-40 points
        const ratingScore = averageRating * 8; // 5 stars = 40 points
        
        // 2. Distance score (25% weight) - 0-25 points
        // Closer = better. 0km = 25 points, 20km+ = 0 points
        const distanceScore = Math.max(0, 25 - (distance * 1.25));
        
        // 3. Price score (20% weight) - 0-20 points
        // Lower price = better. $50 = 20 points, $100 = 0 points
        const priceScore = Math.max(0, 20 - ((instructor.hourlyRate - 50) * 0.4));
        
        // 4. Experience score (15% weight) - 0-15 points
        // More bookings = better. 100+ bookings = 15 points
        const experienceScore = Math.min(15, totalBookings * 0.15);
        
        // Total score
        let totalScore = ratingScore + distanceScore + priceScore + experienceScore;
        
        // Bonus points
        if (totalReviews > 50) totalScore += 5;
        
        // Determine recommendation reason
        let reason = 'Recommended for you';
        if (ratingScore >= 38) {
          reason = 'Top rated instructor near you';
        } else if (distance < 3) {
          reason = 'Closest instructor';
        } else if (instructor.hourlyRate < 65) {
          reason = 'Best value option';
        } else if (totalBookings > 100) {
          reason = 'Highly experienced';
        }

        return {
          id: instructor.id,
          name: instructor.name,
          hourlyRate: instructor.hourlyRate,
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal
          rating: Math.round(averageRating * 10) / 10,
          reviews: totalReviews,
          totalBookings: totalBookings,
          vehicleTypes: instructor.vehicleTypes,
          languages: instructor.languages,
          bio: instructor.bio,
          profileImage: instructor.profileImage,
          car: `${instructor.carMake || ''} ${instructor.carModel || ''} ${instructor.carYear || ''}`.trim(),
          score: Math.round(totalScore),
          reason,
          badges: [
            averageRating >= 4.8 && 'Top Rated',
            totalBookings > 100 && 'Experienced',
            distance < 3 && 'Nearby',
          ].filter(Boolean),
          // voice — all fields the AI needs to present this instructor, grouped for clarity.
          // Web and mobile clients can ignore this object and use the structured fields above.
          voice: {
            // Pre-assembled string read verbatim by the AI.
            // e.g. "Top Rated • Automatic • English • $75 per hour"
            summary: [
              reason,
              instructor.vehicleTypes || null,
              instructor.languages ? instructor.languages.split(',')[0].trim() : null,
              `$${instructor.hourlyRate} per hour`,
            ].filter(Boolean).join(' • '),
          },
        };
      })
      .filter(Boolean) // Remove nulls (instructors outside service radius)
      .sort((a, b) => b!.score - a!.score) // Sort by score descending
      .slice(0, limit); // Take top N

    if (scoredInstructors.length === 0) {
      return NextResponse.json({
        recommendations: [],
        count: 0,
        message: 'No instructors found matching your criteria',
        searchLocation: {
          displayName: coords.displayName,
          lat: coords.lat,
          lng: coords.lng,
        },
        filters: {
          vehicleType,
          language,
          maxBudget,
          experienceLevel,
        },
      });
    }

    return NextResponse.json({
      recommendations: scoredInstructors,
      count: scoredInstructors.length,
      searchLocation: {
        displayName: coords.displayName,
        lat: coords.lat,
        lng: coords.lng,
      },
      filters: {
        vehicleType,
        language,
        maxBudget,
        experienceLevel,
      },
      message: `Found ${scoredInstructors.length} recommended instructor${scoredInstructors.length > 1 ? 's' : ''} near you`,
    });
  } catch (error) {
    console.error('Instructor recommendations error:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
