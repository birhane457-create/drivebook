import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/packages
 * Returns available lesson packages with pricing for a specific instructor
 * Used by AI voice assistant to present package options to students
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

    // Get instructor's hourly rate
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: {
        hourlyRate: true,
        name: true,
      },
    });

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    const hourlyRate = instructor.hourlyRate;

    // Calculate package pricing
    const packages = [
      {
        type: 'PACKAGE_6',
        name: '6-Hour Package',
        hours: 6,
        discountPercentage: 5,
        originalPrice: hourlyRate * 6,
        discount: hourlyRate * 6 * 0.05,
        price: hourlyRate * 6 * 0.95,
        savings: hourlyRate * 6 * 0.05,
        description: 'Great for beginners',
      },
      {
        type: 'PACKAGE_10',
        name: '10-Hour Package',
        hours: 10,
        discountPercentage: 10,
        originalPrice: hourlyRate * 10,
        discount: hourlyRate * 10 * 0.10,
        price: hourlyRate * 10 * 0.90,
        savings: hourlyRate * 10 * 0.10,
        description: 'Most popular - best value',
        popular: true,
        badge: 'Most Popular',
      },
      {
        type: 'PACKAGE_15',
        name: '15-Hour Package',
        hours: 15,
        discountPercentage: 12,
        originalPrice: hourlyRate * 15,
        discount: hourlyRate * 15 * 0.12,
        price: hourlyRate * 15 * 0.88,
        savings: hourlyRate * 15 * 0.12,
        description: 'Best savings for serious learners',
      },
    ];

    // Test package info
    const testPackage = {
      available: true,
      price: 150,
      name: 'Driving Test Package',
      includes: '1-hour pre-test lesson, car rental for test, test day support',
      description: 'Can be added to any package',
    };

    // Get platform fee rate from DB (same source as bulk booking route)
    const { getPlatformFeeRate } = await import('@/lib/services/platform-pricing');
    const platformFeePercentage = await getPlatformFeeRate();

    return NextResponse.json({
      instructor: {
        id: instructorId,
        name: instructor.name,
        hourlyRate: hourlyRate,
      },
      packages: packages.map(pkg => ({
        ...pkg,
        // Round to 2 decimal places
        originalPrice: Math.round(pkg.originalPrice * 100) / 100,
        discount: Math.round(pkg.discount * 100) / 100,
        price: Math.round(pkg.price * 100) / 100,
        savings: Math.round(pkg.savings * 100) / 100,
        priceWithFee: Math.round(pkg.price * (1 + platformFeePercentage / 100) * 100) / 100,
      })),
      // voicePackages: pre-formatted strings for the AI to read verbatim — no calculation needed
      voicePackages: packages.map(pkg => {
        const priceWithFee = Math.round(pkg.price * (1 + platformFeePercentage / 100) * 100) / 100;
        const labels: Record<string, string> = {
          PACKAGE_6:  `6 hours for ${priceWithFee} dollars, that is 5 percent off`,
          PACKAGE_10: `10 hours for ${priceWithFee} dollars, 10 percent off, the most popular choice`,
          PACKAGE_15: `15 hours for ${priceWithFee} dollars, 12 percent off, the best savings`,
        };
        return labels[pkg.type] || `${pkg.hours} hours for ${priceWithFee} dollars`;
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
