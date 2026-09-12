// Booking Packages Configuration
import { prisma } from '@/lib/prisma';

// Default values (fallback if database settings not available)
const DEFAULT_SETTINGS = {
  platformFeePercentage: 3.6,
  package6Discount: 5,
  package10Discount: 10,
  package15Discount: 12,
  basicCommissionRate: 15,
  proCommissionRate: 12,
  studioCommissionRate: 11,
  businessCommissionRate: 10,
  basicNewStudentBonus: 8,
  proNewStudentBonus: 10,
  businessNewStudentBonus: 12,
  discountPaidBy: 'shared' as const
};

// Cache for pricing settings (to avoid repeated database calls)
type PricingSettings = Omit<typeof DEFAULT_SETTINGS, 'discountPaidBy'> & { discountPaidBy: 'platform' | 'shared' | 'provider' };
let cachedSettings: PricingSettings | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get pricing settings from database or cache
export async function getPricingSettings() {
  const now = Date.now();
  
  // Return cached settings if still valid
  if (cachedSettings && (now - cacheTime) < CACHE_DURATION) {
    return cachedSettings;
  }

  try {
    // Use PlatformSettings (the correct model) — not the non-existent Platform model
    const settings = await prisma.platformSettings.findFirst({
      where: { key: 'default' },
    });
    
    if (settings) {
      const mapped = {
        platformFeePercentage: Number(settings.platformFeePercentage),
        package6Discount: Number(settings.package6Discount),
        package10Discount: Number(settings.package10Discount),
        package15Discount: Number(settings.package15Discount),
        basicCommissionRate: Number(settings.basicCommissionRate),
        proCommissionRate: Number(settings.proCommissionRate),
        studioCommissionRate: Number((settings as any).studioCommissionRate ?? settings.businessCommissionRate),
        businessCommissionRate: Number(settings.businessCommissionRate),
        basicNewStudentBonus: Number(settings.basicNewStudentBonus),
        proNewStudentBonus: Number(settings.proNewStudentBonus),
        businessNewStudentBonus: Number(settings.businessNewStudentBonus),
        discountPaidBy: settings.discountPaidBy as 'platform' | 'shared' | 'provider',
      };
      cachedSettings = mapped;
      cacheTime = now;
      return mapped;
    }
  } catch (error) {
    console.error('Error fetching pricing settings:', error);
  }

  // Return defaults if database fetch fails
  return DEFAULT_SETTINGS;
}

// ============================================================================
// Package Tiers — DB-driven, admin-managed
// ============================================================================

/** Shape stored in PlatformSettings.packageTiers (JSONB) */
export interface PackageTier {
  hours:    number;
  label:    string;
  discount: number;   // percent, e.g. 10 = 10% off
  featured: boolean;  // shows "Most Popular" badge
}

/**
 * Fallback used when packageTiers is null in the DB
 * (i.e. the row predates the column, or has never been saved via new admin UI).
 * Mirrors the 3 named columns so behaviour is identical to before.
 */
export const DEFAULT_PACKAGE_TIERS: PackageTier[] = [
  { hours: 6,  label: 'Starter',    discount: DEFAULT_SETTINGS.package6Discount,  featured: false },
  { hours: 10, label: 'Popular',    discount: DEFAULT_SETTINGS.package10Discount, featured: true  },
  { hours: 15, label: 'Best Value', discount: DEFAULT_SETTINGS.package15Discount, featured: false },
];

/** Tier cache — separate from the flat settings cache */
let cachedTiers: PackageTier[] | null = null;
let tiersCacheTime = 0;

/**
 * getPackageTiers()
 * Returns the live package tiers from the DB.
 * Falls back to DEFAULT_PACKAGE_TIERS if:
 *   - packageTiers column is null (legacy row)
 *   - DB fetch fails
 * Shares the same 5-minute cache window as getPricingSettings.
 */
export async function getPackageTiers(): Promise<PackageTier[]> {
  const now = Date.now();

  if (cachedTiers && (now - tiersCacheTime) < CACHE_DURATION) {
    return cachedTiers;
  }

  try {
    const settings = await prisma.platformSettings.findFirst({
      where: { key: 'default' },
      select: { packageTiers: true },
    });

    if (settings?.packageTiers) {
      const tiers = settings.packageTiers as unknown as PackageTier[];
      cachedTiers = tiers;
      tiersCacheTime = now;
      return tiers;
    }
  } catch (error) {
    console.error('Error fetching packageTiers:', error);
  }

  return DEFAULT_PACKAGE_TIERS;
}

/** Invalidate both caches — call after admin saves pricing settings */
export function invalidatePricingCache(): void {
  cachedSettings = null;
  cacheTime = 0;
  cachedTiers = null;
  tiersCacheTime = 0;
}
// Static exports for backward compatibility (uses defaults)
export const HOUR_PACKAGES = {
  CUSTOM: {
    hours: 0,
    discount: 0,
    name: 'Custom Hours',
    description: 'Choose your own number of hours'
  },
  PACKAGE_6: {
    hours: 6,
    discount: DEFAULT_SETTINGS.package6Discount,
    name: '6 Hour Package',
    description: `Save ${DEFAULT_SETTINGS.package6Discount}% on 6 hours of lessons`
  },
  PACKAGE_10: {
    hours: 10,
    discount: DEFAULT_SETTINGS.package10Discount,
    name: '10 Hour Package',
    description: `Save ${DEFAULT_SETTINGS.package10Discount}% on 10 hours of lessons`
  },
  PACKAGE_15: {
    hours: 15,
    discount: DEFAULT_SETTINGS.package15Discount,
    name: '15 Hour Package',
    description: `Save ${DEFAULT_SETTINGS.package15Discount}% on 15 hours of lessons`
  }
} as const;

/**
 * PREDEFINED_PACKAGES — single source of truth for the 3 standard package tiers.
 *
 * To add, remove, or rename a tier: edit this array only.
 * Discount %  values come from PlatformSettings (admin-adjustable, already handled).
 * Do NOT duplicate this structure in public pages or components.
 *
 * `featured: true` = "Most Popular" badge in PackageSelector and public pages.
 * Only one entry should have featured: true.
 */
export const PREDEFINED_PACKAGES = [
  {
    type:     'PACKAGE_6'  as const,
    hours:    HOUR_PACKAGES.PACKAGE_6.hours,
    label:    'Starter',
    featured: false,
  },
  {
    type:     'PACKAGE_10' as const,
    hours:    HOUR_PACKAGES.PACKAGE_10.hours,
    label:    'Popular',
    featured: true,   // ★ Most Popular badge
  },
  {
    type:     'PACKAGE_15' as const,
    hours:    HOUR_PACKAGES.PACKAGE_15.hours,
    label:    'Best Value',
    featured: false,
  },
] as const;

export type PredefinedPackage = typeof PREDEFINED_PACKAGES[number];

export const PLATFORM_FEE_PERCENTAGE = DEFAULT_SETTINGS.platformFeePercentage; // 3.6% platform processing fee

// Dynamic package getter that uses database settings
export async function getHourPackages() {
  const settings = await getPricingSettings();
  
  return {
    CUSTOM: {
      hours: 0,
      discount: 0, // Discount determined dynamically based on hours
      name: 'Custom Hours',
      description: 'Choose your own number of hours'
    },
    PACKAGE_6: {
      hours: 6,
      discount: settings.package6Discount,
      name: '6 Hour Package',
      description: `Save ${settings.package6Discount}% on 6 hours of lessons`
    },
    PACKAGE_10: {
      hours: 10,
      discount: settings.package10Discount,
      name: '10 Hour Package',
      description: `Save ${settings.package10Discount}% on 10 hours of lessons`
    },
    PACKAGE_15: {
      hours: 15,
      discount: settings.package15Discount,
      name: '15 Hour Package',
      description: `Save ${settings.package15Discount}% on 15 hours of lessons`
    }
  };
}

// Helper function to determine discount for custom hours based on thresholds
export async function getDiscountForCustomHours(hours: number): Promise<number> {
  const settings = await getPricingSettings();
  
  if (hours >= 15) return settings.package15Discount;
  if (hours >= 10) return settings.package10Discount;
  if (hours >= 6) return settings.package6Discount;
  return 0;
}

export type PackageType = keyof typeof HOUR_PACKAGES;

// Dynamic calculation using database settings
export async function calculatePackagePriceDynamic(
  hourlyRate: number,
  hours: number,
  packageType: PackageType,
  includeTestPackage = false,
  testPackagePrice = 0
) {
  const settings = await getPricingSettings();
  const packages = await getHourPackages();
  
  const pkg = packages[packageType];
  
  // For CUSTOM type, determine discount based on hour thresholds
  let discountPercentage = pkg.discount;
  if (packageType === 'CUSTOM') {
    discountPercentage = await getDiscountForCustomHours(hours);
  }
  
  const testPackageAmount = includeTestPackage ? testPackagePrice : 0;

  // Calculate base price
  const subtotal = hourlyRate * hours + testPackageAmount;
  
  // Calculate discount
  const discount = (hourlyRate * hours * discountPercentage) / 100;
  
  // Subtotal after discount
  const afterDiscount = subtotal - discount;
  
  // Platform fee
  const platformFee = (afterDiscount * settings.platformFeePercentage) / 100;
  
  // Total
  const total = afterDiscount + platformFee;
  
  // 4 installments
  const installments = total / 4;
  
  return {
    subtotal,
    discount,
    discountPercentage,
    testPackage: testPackageAmount,
    platformFee,
    total,
    installments
  };
}

// Static calculation for backward compatibility (uses defaults)
export function calculatePackagePrice(
  hourlyRate: number,
  hours: number,
  packageType: PackageType
): {
  subtotal: number;
  discount: number;
  discountPercentage: number;
  platformFee: number;
  total: number;
  installments: number; // 4 payments
} {
  const pkg = HOUR_PACKAGES[packageType];
  
  // For CUSTOM type, determine discount based on hour thresholds
  let discountPercentage = pkg.discount;
  if (packageType === 'CUSTOM') {
    if (hours >= 15) discountPercentage = DEFAULT_SETTINGS.package15Discount;
    else if (hours >= 10) discountPercentage = DEFAULT_SETTINGS.package10Discount;
    else if (hours >= 6) discountPercentage = DEFAULT_SETTINGS.package6Discount;
    else discountPercentage = 0;
  }
  
  // Calculate base price
  const subtotal = hourlyRate * hours;
  
  // Calculate discount
  const discount = (subtotal * discountPercentage) / 100;
  
  // Subtotal after discount
  const afterDiscount = subtotal - discount;
  
  // Platform fee (3.6% of total)
  const platformFee = (afterDiscount * PLATFORM_FEE_PERCENTAGE) / 100;
  
  // Total
  const total = afterDiscount + platformFee;
  
  // 4 installments
  const installments = total / 4;
  
  return {
    subtotal,
    discount,
    discountPercentage,
    platformFee,
    total,
    installments
  };
}

export function getPackageByHours(hours: number): PackageType {
  if (hours === 6) return 'PACKAGE_6';
  if (hours === 10) return 'PACKAGE_10';
  if (hours === 15) return 'PACKAGE_15';
  return 'CUSTOM';
}

// Commission calculation for bulk bookings - Dynamic version
// newStudentBonus removed May 2026 — commission is a flat rate per tier.
// isFirstBooking is recorded for analytics but no longer affects payout.
export async function calculateBulkCommissionDynamic(
  providerId: string,
  totalAmount: number,
  isFirstBooking: boolean,
  subscriptionTier: 'BASIC' | 'PRO' | 'STUDIO' | 'PREMIUM' | 'BUSINESS'
) {
  const settings = await getPricingSettings();

  const commissionRates: Record<string, number> = {
    BASIC:    settings.basicCommissionRate,
    PRO:      settings.proCommissionRate,
    STUDIO:   settings.studioCommissionRate,
    PREMIUM:  settings.businessCommissionRate,  // DB column is 'businessCommissionRate' — legacy name, maps to PREMIUM subscriptionTier
    BUSINESS: settings.businessCommissionRate,  // Backward compat: any old DB records with tier='BUSINESS' still get correct rate
  };

  const commissionRate = commissionRates[subscriptionTier];

  const platformFee = (totalAmount * settings.platformFeePercentage) / 100;
  const instructorAmount = totalAmount;
  const platformCommission = (instructorAmount * commissionRate) / 100;
  const totalPlatformRevenue = platformFee + platformCommission;
  const providerPayout = instructorAmount - platformCommission;

  return {
    platformFee,
    commissionRate,
    platformCommission,
    totalPlatformRevenue,
    providerPayout,
    isFirstBooking, // retained for analytics/recording only
  };
}

// Commission calculation for bulk bookings - Static version for backward compatibility
// Uses PlatformSettings defaults — commission rates must match DB values.
// Prefer calculateBulkCommissionDynamic for any new code.
export function calculateBulkCommission(
  providerId: string,
  totalAmount: number,
  isFirstBooking: boolean,
  subscriptionTier: 'BASIC' | 'PRO' | 'STUDIO' | 'PREMIUM' | 'PREMIUM'
): {
  platformFee: number;
  commissionRate: number;
  platformCommission: number;
  totalPlatformRevenue: number;
  providerPayout: number;
  isFirstBooking: boolean;
} {
  // These must match PlatformSettings defaults in the DB.
  // Do not hardcode here — use calculateBulkCommissionDynamic for live rates.
  // Kept as a static fallback for offline/test contexts only.
  const commissionRates: Record<string, number> = {
    BASIC:    DEFAULT_SETTINGS.basicCommissionRate,
    PRO:      DEFAULT_SETTINGS.proCommissionRate,
    STUDIO:   DEFAULT_SETTINGS.businessCommissionRate, // studio uses business rate as fallback
    PREMIUM:  DEFAULT_SETTINGS.businessCommissionRate,
    BUSINESS: DEFAULT_SETTINGS.businessCommissionRate,
  };
  const commissionRate = commissionRates[subscriptionTier];

  const platformFee = (totalAmount * DEFAULT_SETTINGS.platformFeePercentage) / 100;
  const instructorAmount = totalAmount;
  const platformCommission = (instructorAmount * commissionRate) / 100;
  const totalPlatformRevenue = platformFee + platformCommission;
  const providerPayout = instructorAmount - platformCommission;

  return {
    platformFee,
    commissionRate,
    platformCommission,
    totalPlatformRevenue,
    providerPayout,
    isFirstBooking,
  };
}
