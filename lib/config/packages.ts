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
  businessCommissionRate: 10,
  basicNewStudentBonus: 8,
  proNewStudentBonus: 10,
  businessNewStudentBonus: 12,
  discountPaidBy: 'shared' as const
};

// Cache for pricing settings (to avoid repeated database calls)
type PricingSettings = Omit<typeof DEFAULT_SETTINGS, 'discountPaidBy'> & { discountPaidBy: 'platform' | 'shared' | 'instructor' };
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
        platformFeePercentage: settings.platformFeePercentage,
        package6Discount: settings.package6Discount,
        package10Discount: settings.package10Discount,
        package15Discount: settings.package15Discount,
        basicCommissionRate: settings.basicCommissionRate,
        proCommissionRate: settings.proCommissionRate,
        businessCommissionRate: settings.businessCommissionRate,
        basicNewStudentBonus: settings.basicNewStudentBonus,
        proNewStudentBonus: settings.proNewStudentBonus,
        businessNewStudentBonus: settings.businessNewStudentBonus,
        discountPaidBy: settings.discountPaidBy as 'platform' | 'shared' | 'instructor',
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
export async function calculateBulkCommissionDynamic(
  instructorId: string,
  totalAmount: number,
  isFirstBooking: boolean,
  subscriptionTier: 'BASIC' | 'PRO' | 'BUSINESS'
) {
  const settings = await getPricingSettings();
  
  // Commission rates by tier from database
  const commissionRates = {
    BASIC: settings.basicCommissionRate,
    PRO: settings.proCommissionRate,
    BUSINESS: settings.businessCommissionRate
  };
  
  const bonusRates = {
    BASIC: settings.basicNewStudentBonus,
    PRO: settings.proNewStudentBonus,
    BUSINESS: settings.businessNewStudentBonus
  };
  
  const commissionRate = commissionRates[subscriptionTier];
  const bonusRate = bonusRates[subscriptionTier];
  
  // Platform fee from client
  const platformFee = (totalAmount * settings.platformFeePercentage) / 100;
  
  // Amount instructor receives before commission
  const instructorAmount = totalAmount;
  
  // Commission from instructor's amount
  const platformCommission = (instructorAmount * commissionRate) / 100;
  
  // New student bonus (extra commission)
  const newStudentBonus = isFirstBooking ? (instructorAmount * bonusRate) / 100 : 0;
  
  // Total platform revenue
  const totalPlatformRevenue = platformFee + platformCommission + newStudentBonus;
  
  // Instructor payout
  const instructorPayout = instructorAmount - platformCommission - newStudentBonus;
  
  return {
    platformFee,
    commissionRate,
    platformCommission,
    newStudentBonus,
    totalPlatformRevenue,
    instructorPayout
  };
}

// Commission calculation for bulk bookings - Static version for backward compatibility
// Platform takes commission from instructor's payout, not from client
export function calculateBulkCommission(
  instructorId: string,
  totalAmount: number,
  isFirstBooking: boolean,
  subscriptionTier: 'BASIC' | 'PRO' | 'BUSINESS'
): {
  platformFee: number; // What client pays (3.6%)
  commissionRate: number; // What platform takes from instructor
  platformCommission: number; // Commission amount
  newStudentBonus: number; // Extra commission for new student
  totalPlatformRevenue: number; // Total platform makes
  instructorPayout: number; // What instructor receives
} {
  // Commission rates by tier
  const commissionRates = {
    BASIC: 15,
    PRO: 12,
    BUSINESS: 10
  };
  
  const bonusRates = {
    BASIC: 8,
    PRO: 10,
    BUSINESS: 12
  };
  
  const commissionRate = commissionRates[subscriptionTier];
  const bonusRate = bonusRates[subscriptionTier];
  
  // Platform fee from client (3.6%)
  const platformFee = (totalAmount * PLATFORM_FEE_PERCENTAGE) / 100;
  
  // Amount instructor receives before commission
  const instructorAmount = totalAmount; // Client pays total, instructor gets amount minus commission
  
  // Commission from instructor's amount
  const platformCommission = (instructorAmount * commissionRate) / 100;
  
  // New student bonus (extra commission)
  const newStudentBonus = isFirstBooking ? (instructorAmount * bonusRate) / 100 : 0;
  
  // Total platform revenue
  const totalPlatformRevenue = platformFee + platformCommission + newStudentBonus;
  
  // Instructor payout
  const instructorPayout = instructorAmount - platformCommission - newStudentBonus;
  
  return {
    platformFee,
    commissionRate,
    platformCommission,
    newStudentBonus,
    totalPlatformRevenue,
    instructorPayout
  };
}
