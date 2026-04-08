import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { geocode, distanceKm } from '@/lib/services/geocode';

export const dynamic = 'force-dynamic';

const DEFAULT_RADIUS_KM = 20; // fallback if instructor hasn't set their radius

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const location = searchParams.get('location') || '';
    const nameQuery = searchParams.get('name') || '';
    // ?admin=true — skip approved-only filter, return extra fields
    const isAdmin = searchParams.get('admin') === 'true';
    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!location && !nameQuery) {
      return NextResponse.json({ error: 'Provide location or name' }, { status: 400 });
    }

    // Fetch all approved instructors with location fields
    const instructors = await prisma.instructor.findMany({
      where: isAdmin ? {} : { approvalStatus: 'APPROVED', isActive: true },
      select: {
        id: true,
        name: true,
        profileImage: true,
        carImage: true,
        carMake: true,
        carModel: true,
        carYear: true,
        hourlyRate: true,
        vehicleTypes: true,
        languages: true,
        averageRating: true,
        totalReviews: true,
        bio: true,
        serviceAreas: true,
        baseAddress: true,
        serviceRadiusKm: true,
        lessonPackages: true,
        _count: { select: { bookings: true } },
      },
    });

    // --- Name-only search (no geocoding needed) ---
    if (nameQuery && !location) {
      const nl = nameQuery.toLowerCase();
      const matched = instructors.filter(i => i.name.toLowerCase().includes(nl));
      const total = matched.length;
      const paginated = matched.slice((page - 1) * limit, page * limit);
      return NextResponse.json({
        instructors: format(paginated, null),
        count: paginated.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    }

    // --- Location / radius search ---
    // 1. Geocode the searched location
    const searchPoint = await geocode(location);

    if (!searchPoint) {
      // Nominatim couldn't resolve — fall back to text match on serviceAreas/baseAddress
      const tokens = location.toLowerCase().split(/[\s,]+/).filter(t => t.length >= 3);
      const fallback = instructors.filter(i => {
        const hay = `${i.serviceAreas || ''} ${i.baseAddress || ''}`.toLowerCase();
        return tokens.some(t => hay.includes(t));
      });
      const total = fallback.length;
      const paginated = fallback.slice((page - 1) * limit, page * limit);
      return NextResponse.json({
        instructors: format(paginated, null),
        count: paginated.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        geocodeFailed: true,
        message: `Could not resolve "${location}" to coordinates — showing text matches`,
      });
    }

    // 2. For each instructor geocode their base address, then check radius
    const results: { instructor: typeof instructors[0]; distKm: number }[] = [];

    await Promise.all(
      instructors.map(async (i) => {
        if (!i.baseAddress) return;
        const base = await geocode(i.baseAddress);
        if (!base) return;
        const radius = i.serviceRadiusKm ?? DEFAULT_RADIUS_KM;
        const dist = distanceKm(searchPoint, base);
        if (dist <= radius) {
          results.push({ instructor: i, distKm: Math.round(dist * 10) / 10 });
        }
      })
    );

    // Sort closest first
    results.sort((a, b) => a.distKm - b.distKm);

    const total = results.length;
    const paginated = results.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      instructors: paginated.map(({ instructor: i, distKm }) => ({
        ...format([i], searchPoint)[0],
        distance: distKm,
      })),
      count: paginated.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      searchQuery: location,
      searchPoint,
    });
  } catch (error) {
    console.error('Instructor search error:', error);
    return NextResponse.json({ error: 'Failed to search instructors' }, { status: 500 });
  }
}

/** Shape instructors for the frontend */
function format(
  instructors: {
    id: string; name: string; profileImage: string | null; carImage: string | null;
    carMake: string | null; carModel: string | null; carYear: string | number | null;
    hourlyRate: number; vehicleTypes: string | null; languages: string | null;
    averageRating: number | null; totalReviews: number; bio: string | null;
    serviceAreas: string | null; baseAddress: string | null; serviceRadiusKm: number | null;
    lessonPackages: unknown; _count: { bookings: number };
  }[],
  _searchPoint: unknown
) {
  return instructors.map(i => ({
    id: i.id,
    name: i.name,
    profileImage: i.profileImage,
    carImage: i.carImage,
    carMake: i.carMake,
    carModel: i.carModel,
    carYear: i.carYear,
    hourlyRate: i.hourlyRate,
    serviceAreas: i.serviceAreas,
    baseAddress: i.baseAddress,
    serviceRadiusKm: i.serviceRadiusKm ?? DEFAULT_RADIUS_KM,
    vehicleTypes: i.vehicleTypes ? i.vehicleTypes.split(',').map((v: string) => v.trim()) : ['Manual', 'Automatic'],
    languages: i.languages ? i.languages.split(',').map((l: string) => l.trim()) : ['English'],
    averageRating: i.averageRating ?? 4.8,
    totalReviews: i.totalReviews ?? 0,
    totalBookings: i._count.bookings,
    bio: i.bio || 'Experienced driving instructor',
    distance: null as number | null,
    offersTestPackage: !!(i.lessonPackages as any[])?.some((p: any) => p.isActive !== false),
    testPackagePrice: null,
    testPackageDuration: null,
    testPackageIncludes: [],
    lessonPackages: ((i.lessonPackages as any[]) || []).filter((p: any) => p.isActive !== false),
  }));
}
