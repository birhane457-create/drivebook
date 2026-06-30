import { prisma } from '@/lib/prisma';

export interface PricingSettings {
  basicCommissionRate: number;
  proCommissionRate: number;
  businessCommissionRate: number;
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
}

// Fallback defaults — used if DB record doesn't exist yet
const DEFAULTS: PricingSettings = {
  basicCommissionRate: 15,
  proCommissionRate: 12,
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
      basicCommissionRate: record.basicCommissionRate,
      proCommissionRate: record.proCommissionRate,
      businessCommissionRate: record.businessCommissionRate,
      platformFeePercentage: record.platformFeePercentage,
      package6Discount: record.package6Discount,
      package10Discount: record.package10Discount,
      package15Discount: record.package15Discount,
      discountPaidBy: record.discountPaidBy,
      cancellationFee: record.cancellationFee,
      lateCancellationWindowHours: record.lateCancellationWindowHours,
      noShowPenaltyAmount: record.noShowPenaltyAmount,
      walletTopUpMin: record.walletTopUpMin,
      walletTopUpMax: record.walletTopUpMax,
      gstEnabled: record.gstEnabled,
      gstRate: record.gstRate,
      withholdingTaxRate: record.withholdingTaxRate,
      peakSurchargeEnabled: record.peakSurchargeEnabled,
      peakSurchargePercent: record.peakSurchargePercent,
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Get commission rate for a specific subscription tier.
 */
export async function getCommissionRate(tier: string): Promise<number> {
  const pricing = await getPlatformPricing();
  switch (tier) {
    case 'PRO': return pricing.proCommissionRate;
    case 'BUSINESS': return pricing.businessCommissionRate;
    default: return pricing.basicCommissionRate; // BASIC + fallback
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
