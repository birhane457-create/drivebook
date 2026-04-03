import { NextResponse } from 'next/server';
import { getPlatformPricing } from '@/lib/services/platform-pricing';

export const dynamic = 'force-dynamic';

/**
 * Public pricing endpoint — returns only the fields needed for the booking UI.
 * No auth required. Used by PackageSelector and BookingContext.
 */
export async function GET() {
  try {
    const settings = await getPlatformPricing();
    return NextResponse.json({
      platformFeePercentage: settings.platformFeePercentage,
      package6Discount: settings.package6Discount,
      package10Discount: settings.package10Discount,
      package15Discount: settings.package15Discount,
      drivingTestPackagePrice: settings.drivingTestPackagePrice,
    });
  } catch (error) {
    // Return defaults if DB unavailable — never block the booking flow
    return NextResponse.json({
      platformFeePercentage: 3.6,
      package6Discount: 5,
      package10Discount: 10,
      package15Discount: 12,
      drivingTestPackagePrice: 225,
    });
  }
}
