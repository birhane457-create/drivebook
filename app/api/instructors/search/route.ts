// @ts-nocheck
/**
 * GET /api/instructors/search
 *
 * Instructor search with suburb-first matching.
 *
 * Search priority:
 *   1. If instructor has a serviceAreas suburb list → exact suburb/postcode match
 *   2. If no suburb list → Haversine radius fallback (same as before)
 *
 * This eliminates the air-distance inaccuracy for instructors who have configured
 * their served suburbs. Radius remains the fallback for instructors who haven't.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { geocode, distanceKm } from '@/lib/services/geocode';
import { resolveLocationStatic } from '@/lib/services/resolve-location';

export const dynamic = 'force-dynamic';

const DEFAULT_RADIUS_KM = 20;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const location        = searchParams.get('location') || '';
    const nameQuery       = searchParams.get('name')     || '';
    const languageFilter  = searchParams.get('language') || '';
    const vehicleTypeFilter = searchParams.get('vehicleType') || '';

    // Normalise UI-friendly names to DB values
    const normaliseVehicleType = (v: string) => {
      const u = v.toUpperCase();
      if (u === 'AUTOMATIC') return 'AUTO';
      if (u === 'MANUAL')    return 'MANUAL';
      return u;
    };
    const normalisedVehicleType = vehicleTypeFilter ? normaliseVehicleType(vehicleTypeFilter) : '';

    // Admin bypass — check session
    const adminParam = searchParams.get('admin') === 'true';
    let isAdmin = false;
    if (adminParam) {
      const { getServerSession } = await import('next-auth');
      const { authOptions }      = await import('@/lib/auth');
      const session = await getServerSession(authOptions);
      isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
    }

    // Pagination
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1',  10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!location && !nameQuery) {
      return NextResponse.json({ error: 'Provide location or name' }, { status: 400 });
    }

    // Fetch approved, active instructors with active/trial subscriptions
    const now = new Date();
    const instructors = await prisma.instructor.findMany({
      where: isAdmin ? {} : {
        approvalStatus: 'APPROVED',
        isActive: true,
        OR: [
          { subscriptionStatus: 'ACTIVE' },
          { subscriptionStatus: 'TRIAL', trialEndsAt: { gt: now } },
        ],
      },
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
        baseLatitude: true,
        baseLongitude: true,
        serviceRadiusKm: true,
        offersTestPackage: true,
        testPackagePrice: true,
        testPackageDuration: true,
        testPackageIncludes: true,
        _count: { select: { bookings: true } },
      },
    });

    // ── Name-only search ────────────────────────────────────────────────────────
    if (nameQuery && !location) {
      const nl = nameQuery.toLowerCase();
      let matched = instructors.filter(i => i.name.toLowerCase().includes(nl));
      if (languageFilter) {
        const lf = languageFilter.toLowerCase();
        matched = matched.filter(i => i.languages?.toLowerCase().includes(lf));
      }
      if (normalisedVehicleType) {
        matched = matched.filter(i => i.vehicleTypes?.toUpperCase().includes(normalisedVehicleType));
      }
      const total     = matched.length;
      const paginated = matched.slice((page - 1) * limit, page * limit);
      return NextResponse.json({
        instructors: format(paginated, null),
        count: paginated.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    }

    // ── Location search ─────────────────────────────────────────────────────────
    // 1. Resolve location — static postcode/suburb lookup first, Nominatim fallback
    const staticResolved = resolveLocationStatic(location);
    const searchPoint    = staticResolved
      ? { lat: staticResolved.lat, lng: staticResolved.lng, displayName: staticResolved.displayName }
      : await geocode(location);

    if (!searchPoint) {
      // Geocode failed — text match on serviceAreas/baseAddress as last resort
      const tokens = location.toLowerCase().split(/[\s,]+/).filter(t => t.length >= 3);
      let fallback = instructors.filter(i => {
        const hay = `${i.serviceAreas || ''} ${i.baseAddress || ''}`.toLowerCase();
        return tokens.some(t => hay.includes(t));
      });
      if (languageFilter)         fallback = fallback.filter(i => i.languages?.toLowerCase().includes(languageFilter.toLowerCase()));
      if (normalisedVehicleType)  fallback = fallback.filter(i => i.vehicleTypes?.toUpperCase().includes(normalisedVehicleType));
      const total     = fallback.length;
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

    // 2. Extract normalised suburb + postcode from the resolved location
    //    staticResolved will have suburb/postcode if resolved from static data
    const searchedSuburb   = staticResolved?.suburb?.toLowerCase()  ?? '';
    const searchedPostcode = staticResolved?.postcode               ?? '';

    // 3. For each instructor: suburb-list match first, radius fallback
    const results: { instructor: typeof instructors[0]; distKm: number }[] = [];

    await Promise.all(
      instructors.map(async (i) => {
        // Cheap filters first
        if (languageFilter        && !i.languages?.toLowerCase().includes(languageFilter.toLowerCase())) return;
        if (normalisedVehicleType && !i.vehicleTypes?.toUpperCase().includes(normalisedVehicleType))     return;

        // ── Suburb-list match (primary — no maths, exact token match) ──────────
        if (i.serviceAreas) {
          try {
            const tokens: string[] = JSON.parse(i.serviceAreas);
            if (Array.isArray(tokens) && tokens.length > 0) {
              const matched = tokens.some(token => {
                const parts = token.split('|');
                if (parts.length !== 3) return false;
                const [tSuburb, , tPostcode] = parts;
                if (searchedPostcode && tPostcode === searchedPostcode)           return true;
                if (searchedSuburb   && tSuburb.toLowerCase() === searchedSuburb) return true;
                return false;
              });
              if (!matched) return;
              // Still compute display distance if coords are available
              let distKm = 0;
              if (i.baseLatitude != null && i.baseLongitude != null &&
                  isFinite(i.baseLatitude) && isFinite(i.baseLongitude)) {
                distKm = Math.round(distanceKm(searchPoint, { lat: i.baseLatitude, lng: i.baseLongitude }) * 10) / 10;
              }
              results.push({ instructor: i, distKm });
              return;
            }
          } catch { /* fall through to radius */ }
        }

        // ── Radius fallback (for instructors without a suburb list) ────────────
        let base: { lat: number; lng: number } | null = null;
        if (i.baseLatitude != null && i.baseLongitude != null &&
            isFinite(i.baseLatitude) && isFinite(i.baseLongitude)) {
          base = { lat: i.baseLatitude, lng: i.baseLongitude };
        } else if (i.baseAddress) {
          base = await geocode(i.baseAddress);
        }
        if (!base) return;

        const radius = i.serviceRadiusKm ?? DEFAULT_RADIUS_KM;
        const dist   = distanceKm(searchPoint, base);
        if (dist <= radius) {
          results.push({ instructor: i, distKm: Math.round(dist * 10) / 10 });
        }
      })
    );

    results.sort((a, b) => a.distKm - b.distKm);

    const total     = results.length;
    const paginated = results.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      instructors: paginated.map(({ instructor: i, distKm }) => ({
        ...format([i], searchPoint)[0],
        distance: distKm,
      })),
      count:       paginated.length,
      total,
      page,
      totalPages:  Math.ceil(total / limit),
      searchQuery: location,
      searchPoint,
    });
  } catch (error) {
    console.error('Instructor search error:', error);
    return NextResponse.json({ error: 'Failed to search instructors' }, { status: 500 });
  }
}

// ── Format helper ─────────────────────────────────────────────────────────────

function format(
  instructors: any[],
  _searchPoint: unknown
) {
  return instructors.map(i => {
    const testIncludes = Array.isArray(i.testPackageIncludes)
      ? (i.testPackageIncludes as string[])
      : [];

    // Parse suburb list for display on cards ("Maylands, Bayswater +2 more")
    let suburbList: string[] = [];
    if (i.serviceAreas) {
      try {
        const tokens: string[] = JSON.parse(i.serviceAreas);
        suburbList = tokens
          .map((t: string) => t.split('|')[0])
          .filter(Boolean)
          .slice(0, 5);
      } catch { /* ignore */ }
    }

    return {
      id:             i.id,
      name:           i.name,
      profileImage:   i.profileImage,
      carImage:       i.carImage,
      carMake:        i.carMake,
      carModel:       i.carModel,
      carYear:        i.carYear,
      hourlyRate:     i.hourlyRate,
      serviceAreas:   i.serviceAreas,
      suburbList,
      baseAddress:    i.baseAddress,
      serviceRadiusKm: i.serviceRadiusKm ?? DEFAULT_RADIUS_KM,
      vehicleTypes:   i.vehicleTypes ? i.vehicleTypes.split(',').map((v: string) => v.trim()) : ['Manual', 'Automatic'],
      languages:      i.languages    ? i.languages.split(',').map((l: string) => l.trim())    : ['English'],
      averageRating:  i.averageRating ?? null,
      totalReviews:   i.totalReviews  ?? 0,
      totalBookings:  i._count.bookings,
      bio:            i.bio || 'Experienced driving instructor',
      distance:       null as number | null,
      offersTestPackage:  i.offersTestPackage  ?? false,
      testPackagePrice:   i.testPackagePrice,
      testPackageDuration: i.testPackageDuration,
      testPackageIncludes: testIncludes,
    };
  });
}
