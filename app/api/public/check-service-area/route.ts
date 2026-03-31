import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Haversine distance in km between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocode(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=au&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.results?.[0]) {
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get('instructorId');
  const pickupAddress = searchParams.get('address');

  if (!instructorId || !pickupAddress?.trim()) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  if (!apiKey) {
    // No API key — skip check gracefully
    return NextResponse.json({ result: 'unknown', reason: 'no_api_key' });
  }

  // Fetch instructor's base address and radius — never exposed to client
  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { baseAddress: true, serviceRadiusKm: true, serviceAreas: true },
  });

  if (!instructor) {
    return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
  }

  // If no radius/base set, check is not applicable
  if (!instructor.baseAddress || !instructor.serviceRadiusKm) {
    return NextResponse.json({
      result: 'unknown',
      reason: 'no_service_area_configured',
      serviceAreas: instructor.serviceAreas ?? null,
    });
  }

  try {
    const [pickupCoords, baseCoords] = await Promise.all([
      geocode(pickupAddress, apiKey),
      geocode(instructor.baseAddress, apiKey),
    ]);

    if (!pickupCoords || !baseCoords) {
      return NextResponse.json({ result: 'unknown', reason: 'geocode_failed' });
    }

    const distanceKm = haversineKm(baseCoords.lat, baseCoords.lng, pickupCoords.lat, pickupCoords.lng);
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
