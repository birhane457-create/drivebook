import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { geocodeAddress, calculateDistance } from '@/lib/utils/distance';
import { resolveLocationStatic } from '@/lib/services/resolve-location';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get('instructorId');
  const pickupAddress = searchParams.get('address');

  if (!instructorId || !pickupAddress?.trim()) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { baseLatitude: true, baseLongitude: true, baseAddress: true, serviceRadiusKm: true, serviceAreas: true },
  });

  if (!instructor) {
    return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
  }

  // If no radius/base set, check is not applicable
  if (!instructor.serviceRadiusKm || (instructor.baseLatitude == null && !instructor.baseAddress)) {
    return NextResponse.json({
      result: 'unknown',
      reason: 'no_service_area_configured',
      serviceAreas: instructor.serviceAreas ?? null,
    });
  }

  try {
    // Resolve pickup address — static lookup first (postcode/suburb), fall back to Nominatim
    const staticPickup = resolveLocationStatic(pickupAddress);
    const pickupCoords = staticPickup
      ? { lat: staticPickup.lat, lng: staticPickup.lng }
      : await geocodeAddress(pickupAddress);
    if (!pickupCoords) {
      return NextResponse.json({ result: 'unknown', reason: 'geocode_failed' });
    }

    // Use stored instructor coords if available, otherwise geocode baseAddress
    let baseLat = instructor.baseLatitude;
    let baseLng = instructor.baseLongitude;
    if (baseLat == null || baseLng == null) {
      const baseCoords = await geocodeAddress(instructor.baseAddress!);
      if (!baseCoords) {
        return NextResponse.json({ result: 'unknown', reason: 'geocode_failed' });
      }
      baseLat = baseCoords.lat;
      baseLng = baseCoords.lng;
    }

    const distanceKm = calculateDistance(baseLat, baseLng, pickupCoords.lat, pickupCoords.lng);
    const isInRange = distanceKm <= instructor.serviceRadiusKm;

    return NextResponse.json({
      result: isInRange ? 'in' : 'out',
      distanceKm: Math.round(distanceKm * 10) / 10,
      radiusKm: instructor.serviceRadiusKm,
    });
  } catch {
    return NextResponse.json({ result: 'unknown', reason: 'error' });
  }
}
