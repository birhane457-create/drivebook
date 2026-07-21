import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPlatformPricing } from '@/lib/services/platform-pricing';

export const dynamic = 'force-dynamic';

/**
 * GET /api/packages
 * Returns available lesson packages with pricing for a specific instructor.
 * Used by the AI voice assistant to present package options to students.
 *
 * Discount percentages and platform fee come from PlatformSettings (DB-configurable).
 * Test package price: instructor.testPackagePrice → PlatformSettings.drivingTestPackagePrice fallback.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const instructorId = searchParams.get('instructorId');

    if (!instructorId) {
      return NextResponse.json(
        { error: 'instructorId parameter is required' },
        { status: 400 }
      );
    }

    // Fetch instructor and platform settings in parallel
    const [instructor, pricing] = await Promise.all([
      prisma.instructor.findUnique({
        where: { id: instructorId },
        select: {
          hourlyRate: true,
          name: true,
          offersTestPackage: true,
          testPackagePrice: true,
          testPackageDuration: true,
          testPackageIncludes: true,
        },
      }),
      getPlatformPricing(),
    ]);

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    const hourlyRate = instructor.hourlyRate;

    // Discount percentages from DB — no hardcoded values
    const disc6  = pricing.package6Discount;   // default 5
    const disc10 = pricing.package10Discount;  // default 10
    const disc15 = pricing.package15Discount;  // default 12

    const packages = [
      {
        type: 'PACKAGE_6',
        name: '6-Hour Package',
        hours: 6,
        discountPercentage: disc6,
        originalPrice: hourlyRate * 6,
        discount: hourlyRate * 6 * (disc6 / 100),
        price: hourlyRate * 6 * (1 - disc6 / 100),
        savings: hourlyRate * 6 * (disc6 / 100),
        description: 'Great for beginners',
      },
      {
        type: 'PACKAGE_10',
        name: '10-Hour Package',
        hours: 10,
        discountPercentage: disc10,
        originalPrice: hourlyRate * 10,
        discount: hourlyRate * 10 * (disc10 / 100),
        price: hourlyRate * 10 * (1 - disc10 / 100),
        savings: hourlyRate * 10 * (disc10 / 100),
        description: 'Most popular - best value',
        popular: true,
        badge: 'Most Popular',
      },
      {
        type: 'PACKAGE_15',
        name: '15-Hour Package',
        hours: 15,
        discountPercentage: disc15,
        originalPrice: hourlyRate * 15,
        discount: hourlyRate * 15 * (disc15 / 100),
        price: hourlyRate * 15 * (1 - disc15 / 100),
        savings: hourlyRate * 15 * (disc15 / 100),
        description: 'Best savings for serious learners',
      },
    ];

    // Test package price: instructor-specific rate → platform default → 0 (not offered)
    // instructor.offersTestPackage gates availability; price falls back to platform setting
    const testPackagePrice =
      instructor.testPackagePrice ??
      (pricing as any).drivingTestPackagePrice ??
      225;

    const testPackage = {
      available: instructor.offersTestPackage ?? true,
      price: testPackagePrice,
      name: 'Driving Test Package',
      includes: Array.isArray(instructor.testPackageIncludes)
        ? (instructor.testPackageIncludes as string[]).join(', ')
        : '1-hour pre-test lesson, car rental for test, test day support',
      description: 'Can be added to any package',
    };

    const platformFeePercentage = pricing.platformFeePercentage;

    return NextResponse.json({
      instructor: {
        id: instructorId,
        name: instructor.name,
        hourlyRate,
      },
      packages: packages.map(pkg => ({
        ...pkg,
        originalPrice:  Math.round(pkg.originalPrice * 100) / 100,
        discount:       Math.round(pkg.discount * 100) / 100,
        price:          Math.round(pkg.price * 100) / 100,
        savings:        Math.round(pkg.savings * 100) / 100,
        priceWithFee:   Math.round(pkg.price * (1 + platformFeePercentage / 100) * 100) / 100,
      })),
      // voicePackages: pre-formatted strings for the AI to read verbatim — no calculation needed.
      // Discount percentages are read from live DB values so they stay accurate after admin changes.
      voicePackages: packages.map(pkg => {
        const priceWithFee = Math.round(pkg.price * (1 + platformFeePercentage / 100) * 100) / 100;
        const discStr = `${pkg.discountPercentage} percent off`;
        const popularStr = pkg.type === 'PACKAGE_10' ? ', the most popular choice' : '';
        const bestStr    = pkg.type === 'PACKAGE_15' ? ', the best savings' : '';
        return `${pkg.hours} hours for ${priceWithFee} dollars, ${discStr}${popularStr}${bestStr}`;
      }),
      testPackage,
      platformFee: {
        percentage: platformFeePercentage,
        description: 'Platform fee covers payment processing and booking services',
      },
      notes: [
        'All packages expire 365 days from purchase',
        'Unused hours cannot be refunded after expiry',
        'Credits can be used to schedule lessons anytime',
      ],
    });
  } catch (error) {
    console.error('Get packages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
