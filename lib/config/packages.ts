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
  drivingTestPackagePrice: 225,
  discountPaidBy: 'shared' as const
};

// Cache for pricing settings (to avoid repeated database calls)
let cachedSettings: typeof DEFAULT_SETTINGS | null = null;
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
    const platform = await prisma.platform.findFirst();
    const settings = (platform?.settings as any)?.pricing;
    
    if (settings) {
      cachedSettings = settings;
      cacheTime = now;
      return settings;
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

export const DRIVING_TEST_PACKAGE = {
  price: DEFAULT_SETTINGS.drivingTestPackagePrice,
  name: 'Driving Test Package',
  description: '2.5hr Test Package',
  features: [
    'Use instructor\'s vehicle for test',
    'Pick up & Drop off included',
    '45 minute pre-test warm up lesson',
    'Test center drop-off and pickup'
  ]
};

export const PLATFORM_FEE_PERCENTAGE = DEFAULT_SETTINGS.platformFeePercentage; // 3.6% platform processing fee

// Dynamic package getter that uses database settings
export async function getHourPackages() {
  const settings = await getPricingSettings();
  
  return {
    CUSTOM: {
      hours: 0,
      discount: 0,
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

export async function getDrivingTestPackage() {
  const settings = await getPricingSettings();
  
  return {
    price: settings.drivingTestPackagePrice,
    name: 'Driving Test Package',
    description: '2.5hr Test Package',
    features: [
      'Use instructor\'s vehicle for test',
      'Pick up & Drop off included',
      '45 minute pre-test warm up lesson',
      'Test center drop-off and pickup'
    ]
  };
}

export type PackageType = keyof typeof HOUR_PACKAGES;

// Dynamic calculation using database settings
export async function calculatePackagePriceDynamic(
  hourlyRate: number,
  hours: number,
  packageType: PackageType,
  includeTestPackage: boolean = false
) {
  const settings = await getPricingSettings();
  const packages = await getHourPackages();
  const testPackage = await getDrivingTestPackage();
  
  const pkg = packages[packageType];
  
  // Calculate base price
  const subtotal = hourlyRate * hours;
  
  // Calculate discount
  const discountPercentage = pkg.discount;
  const discount = (subtotal * discountPercentage) / 100;
  
  // Test package
  const testPackageAmount = includeTestPackage ? testPackage.price : 0;
  
  // Subtotal after discount
  const afterDiscount = subtotal - discount + testPackageAmount;
  
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
  packageType: PackageType,
  includeTestPackage: boolean = false
): {
  subtotal: number;
  discount: number;
  discountPercentage: number;
  testPackage: number;
  platformFee: number;
  total: number;
  installments: number; // 4 payments
} {
  const pkg = HOUR_PACKAGES[packageType];
  
  // Calculate base price
  const subtotal = hourlyRate * hours;
  
  // Calculate discount
  const discountPercentage = pkg.discount;
  const discount = (subtotal * discountPercentage) / 100;
  
  // Test package
  const testPackage = includeTestPackage ? DRIVING_TEST_PACKAGE.price : 0;
  
  // Subtotal after discount
  const afterDiscount = subtotal - discount + testPackage;
  
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
    testPackage,
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
