// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { geocodeAddress, calculateDistance, getBoundingBox } from '@/lib/utils/distance';

export const dynamic = 'force-dynamic';

/**
 * GET /api/instructors/recommendations
 * Smart instructor recommendation engine with ranking algorithm.
 *
 * Uses pre-aggregated averageRating + totalReviews stored on the Instructor row.
 * The schema has no separate Review relation on Instructor, so we never query it.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const location = searchParams.get('location');
    const vehicleType = searchParams.get('vehicleType');
    const language = searchParams.get('language');
    const maxBudget = searchParams.get('budget') ? parseFloat(searchParams.get('budget')!) : null;
    const experienceLevel = searchParams.get('experienceLevel');
    const limit = parseInt(searchParams.get('limit') || '3');

    if (!location) {
      return NextResponse.json(
        { error: 'location parameter is required' },
        { status: 400 }
      );
    }

    const coords = await geocodeAddress(location);

    if (!coords) {
      return NextResponse.json(
        { error: 'Location not found', message: 'Could not find coordinates for the specified location' },
        { status: 404 }
      );
    }

    if (!isFinite(coords.lat) || !isFinite(coords.lng)) {
      return NextResponse.json(
        { error: 'Location not found', message: 'Could not resolve coordinates for the specified location' },
        { status: 404 }
      );
    }

    const bbox = getBoundingBox(coords.lat, coords.lng, 50);

    const whereConditions: any = {
      isActive: true,
      approvalStatus: 'APPROVED',
      baseLatitude: { gte: bbox.minLat, lte: bbox.maxLat, not: null },
      baseLongitude: { gte: bbox.minLng, lte: bbox.maxLng, not: null },
    };

    if (vehicleType) {
      whereConditions.vehicleTypes = { contains: vehicleType.toUpperCase() };
    }
    if (language) {
      whereConditions.languages = { contains: language };
    }
    if (maxBudget) {
      whereConditions.hourlyRate = { lte: maxBudget };
    }

    // Use stored averageRating + totalReviews  no Review relation exists on Instructor
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
        averageRating: true,
        totalReviews: true,
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    });

    const scoredInstructors = instructors
      .map((instructor: any) => {
        if (
          instructor.baseLatitude == null ||
          instructor.baseLongitude == null ||
          !isFinite(instructor.baseLatitude) ||
          !isFinite(instructor.baseLongitude)
        ) {
          return null;
        }

        const distance = calculateDistance(
          instructor.baseLatitude,
          instructor.baseLongitude,
          coords.lat,
          coords.lng
        );

        if (distance > (instructor.serviceRadiusKm || 50)) {
          return null;
        }

        const averageRating = instructor.averageRating ?? 0;
        const totalReviews = instructor.totalReviews ?? 0;
        const totalBookings = instructor._count.bookings;

        const ratingScore = averageRating * 8;
        const distanceScore = Math.max(0, 25 - (distance * 1.25));
        const priceScore = Math.max(0, 20 - ((instructor.hourlyRate - 50) * 0.4));
        const experienceScore = Math.min(15, totalBookings * 0.15);

        let totalScore = ratingScore + distanceScore + priceScore + experienceScore;
        if (totalReviews > 50) totalScore += 5;

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
          distance: Math.round(distance * 10) / 10,
          rating: Math.round(averageRating * 10) / 10,
          reviews: totalReviews,
          totalBookings,
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
          voice: {
            summary: [
              reason,
              instructor.vehicleTypes || null,
              instructor.languages ? instructor.languages.split(',')[0].trim() : null,
              `$${instructor.hourlyRate} per hour`,
            ].filter(Boolean).join('  '),
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, limit);

    if (scoredInstructors.length === 0) {
      return NextResponse.json({
        recommendations: [],
        count: 0,
        message: 'No instructors found matching your criteria',
        searchLocation: { displayName: coords.displayName, lat: coords.lat, lng: coords.lng },
        filters: { vehicleType, language, maxBudget, experienceLevel },
      });
    }

    return NextResponse.json({
      recommendations: scoredInstructors,
      count: scoredInstructors.length,
      searchLocation: { displayName: coords.displayName, lat: coords.lat, lng: coords.lng },
      filters: { vehicleType, language, maxBudget, experienceLevel },
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