import { prisma } from '@/lib/prisma';
import { type PackageTier, DEFAULT_PACKAGE_TIERS } from '@/lib/config/packages';

/**
 * IMPORTANT — Column naming:
 *   subscriptionTier 'PREMIUM' maps to the DB column `businessCommissionRate`.
 *   The column was named 'business' when the tier was called BUSINESS. The tier
 *   was renamed to PREMIUM; the DB column name was NOT changed to avoid a migration
 *   on live data. Never add a `premiumCommissionRate` column — use `businessCommissionRate`.
 *
 * accountType vs subscriptionTier:
 *   - accountType ('INDIVIDUAL' | 'BUSINESS') = legal entity type
 *   - subscriptionTier ('BASIC' | 'PRO' | 'STUDIO' | 'PREMIUM') = subscription plan
 *   These are independent. A BUSINESS accountType can be on any subscriptionTier.
 */
export interface PricingSettings {
  basicCommissionRate: number;
  proCommissionRate: number;
  studioCommissionRate: number;
  businessCommissionRate: number;  // Used by PREMIUM subscriptionTier — legacy column name
  platformFeePercentage: number;
  package6Discount: number;
  package10Discount: number;
  package15Discount: number;
  discountPaidBy: string;
  cancellationFee: number;
  lateCancellationWindowHours: number;
  noShowPenaltyAmount: number;
  walletTopUpMin: number;
  walletTopUpMax: number;
  gstEnabled: boolean;
  gstRate: number;
  withholdingTaxRate: number;
  peakSurchargeEnabled: boolean;
  peakSurchargePercent: number;
  packageTiers: PackageTier[];
}

// Fallback defaults — used if DB record doesn't exist yet
const DEFAULTS: PricingSettings = {
  basicCommissionRate: 15,
  proCommissionRate: 12,
  studioCommissionRate: 11,
  businessCommissionRate: 10,
  platformFeePercentage: 3.6,
  package6Discount: 5,
  package10Discount: 10,
  package15Discount: 12,
  discountPaidBy: 'shared',
  cancellationFee: 0,
  lateCancellationWindowHours: 24,
  noShowPenaltyAmount: 0,
  walletTopUpMin: 10,
  walletTopUpMax: 500,
  gstEnabled: true,
  gstRate: 10,
  withholdingTaxRate: 47,
  peakSurchargeEnabled: false,
  peakSurchargePercent: 0,
  packageTiers: DEFAULT_PACKAGE_TIERS,
};

/**
 * Get platform pricing settings from DB.
 * Falls back to defaults if no record exists yet.
 */
export async function getPlatformPricing(): Promise<PricingSettings> {
  try {
    const record = await prisma.platformSettings.findUnique({
      where: { key: 'default' },
    });
    if (!record) return DEFAULTS;
    return {
      basicCommissionRate: Number(record.basicCommissionRate),
      proCommissionRate: Number(record.proCommissionRate),
      studioCommissionRate: Number((record as any).studioCommissionRate ?? 11),
      businessCommissionRate: Number(record.businessCommissionRate),
      platformFeePercentage: Number(record.platformFeePercentage),
      package6Discount: Number(record.package6Discount),
      package10Discount: Number(record.package10Discount),
      package15Discount: Number(record.package15Discount),
      discountPaidBy: record.discountPaidBy,
      cancellationFee: Number(record.cancellationFee),
      lateCancellationWindowHours: Number(record.lateCancellationWindowHours),
      noShowPenaltyAmount: Number(record.noShowPenaltyAmount),
      walletTopUpMin: Number(record.walletTopUpMin),
      walletTopUpMax: Number(record.walletTopUpMax),
      gstEnabled: record.gstEnabled,
      gstRate: Number(record.gstRate),
      withholdingTaxRate: Number(record.withholdingTaxRate),
      peakSurchargeEnabled: record.peakSurchargeEnabled,
      peakSurchargePercent: Number(record.peakSurchargePercent),
      packageTiers: Array.isArray(record.packageTiers)
        ? (record.packageTiers as unknown as PackageTier[])
        : DEFAULT_PACKAGE_TIERS,
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Get commission rate for a specific subscription tier.
 * NOTE: subscriptionTier PREMIUM uses the DB column `businessCommissionRate` (legacy name).
 *       BUSINESS is kept as a backward-compat alias for any old DB records.
 */
export async function getCommissionRate(tier: string): Promise<number> {
  const pricing = await getPlatformPricing();
  switch (tier) {
    case 'PRO':      return pricing.proCommissionRate;
    case 'STUDIO':   return pricing.studioCommissionRate;
    case 'PREMIUM':  return pricing.businessCommissionRate;  // DB column: businessCommissionRate (legacy name)
    case 'BUSINESS': return pricing.businessCommissionRate;  // Backward compat — old DB records only
    default:         return pricing.basicCommissionRate;
  }
}

/**
 * MEDIUM-10 FIX: Get platform fee rate from DB instead of hardcoding
 * Returns the platform fee percentage (e.g., 3.6 means 3.6%)
 */
export async function getPlatformFeeRate(): Promise<number> {
  const pricing = await getPlatformPricing();
  return pricing.platformFeePercentage;
}
