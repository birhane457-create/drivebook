// Subscription Pricing and Features Configuration
// Commission rates and pricing can be overridden via environment variables
//
// Phase 4: Feature descriptions no longer contain driving-specific vocabulary.
// "Single provider account", "Provider reviews", etc. — generic across all business types.
// Driving-specific plan copy lives in lib/templates/driving/config.ts (planFeatures).

export const SUBSCRIPTION_PLANS = {
  BASIC: {
    name: 'Basic',
    monthlyPrice: Number(process.env.BASIC_MONTHLY_PRICE) || 29,
    annualPrice: Number(process.env.BASIC_ANNUAL_PRICE) || 290,
    commissionRate: Number(process.env.BASIC_COMMISSION_RATE) || 15,
    trialDays: Number(process.env.BASIC_TRIAL_DAYS) || 14,
    features: [
      'Single provider account',
      'Unlimited bookings',
      'Google Calendar sync',
      'Email notifications',
      'Basic analytics',
      'Customer reviews',
      'Mobile app access',
      `${Number(process.env.BASIC_COMMISSION_RATE) || 15}% commission per booking`,
    ],
    limits: {
      providers: 1,
      customDomain: false,
      brandedPages: false,
      prioritySupport: false,
      apiAccess: false,
    },
  },

  PRO: {
    name: 'Pro',
    monthlyPrice: Number(process.env.PRO_MONTHLY_PRICE) || 79,
    annualPrice: Number(process.env.PRO_ANNUAL_PRICE) || 790,
    commissionRate: Number(process.env.PRO_COMMISSION_RATE) || 12,
    trialDays: Number(process.env.PRO_TRIAL_DAYS) || 14,
    features: [
      'Everything in Basic',
      'Advanced analytics & insights',
      'SMS notifications',
      'Waiting list management',
      'Assessment tracking',
      'Document management',
      'Check-in/Check-out system',
      'Custom service areas',
      `${Number(process.env.PRO_COMMISSION_RATE) || 12}% commission per booking`,
      'Priority email support',
    ],
    limits: {
      providers: 1,
      customDomain: false,
      brandedPages: true,
      prioritySupport: true,
      apiAccess: false,
    },
  },

  STUDIO: {
    name: 'Studio',
    monthlyPrice: Number(process.env.STUDIO_MONTHLY_PRICE) || 129,
    annualPrice: Number(process.env.STUDIO_ANNUAL_PRICE) || 1290,
    commissionRate: Number(process.env.STUDIO_COMMISSION_RATE) || 11,
    trialDays: Number(process.env.STUDIO_TRIAL_DAYS) || 14,
    features: [
      'Everything in Pro',
      'Custom domain (bring your own)',
      '1 year free domain included',
      'Branded booking page on your domain',
      'White-label experience',
      `${Number(process.env.STUDIO_COMMISSION_RATE) || 11}% commission per booking`,
      'Priority support',
    ],
    limits: {
      providers: 1,
      customDomain: true,
      brandedPages: true,
      prioritySupport: true,
      apiAccess: false,
    },
  },

  PREMIUM: {
    name: 'Premium',
    monthlyPrice: Number(process.env.PREMIUM_MONTHLY_PRICE) || 199,
    annualPrice: Number(process.env.PREMIUM_ANNUAL_PRICE) || 1990,
    commissionRate: Number(process.env.PREMIUM_COMMISSION_RATE) || 10,
    trialDays: Number(process.env.PREMIUM_TRIAL_DAYS) || 30,
    features: [
      'Everything in Studio',
      'Business name across all surfaces',
      'AI receptionist answers as your business',
      'Full white-label experience',
      `${Number(process.env.PREMIUM_COMMISSION_RATE) || 10}% commission per booking`,
      'Advanced reporting',
      'Priority phone support',
      'API access',
      '— Coming Soon —',
      'Option for direct payments (0% commission)',
      'Multi-provider management (BUSINESS tier)',
    ],
    limits: {
      providers: 1, // Single provider only - multi-provider in future BUSINESS tier
      customDomain: true,
      brandedPages: true,
      prioritySupport: true,
      apiAccess: true,
    },
  },

} as const

export type SubscriptionTier = keyof typeof SUBSCRIPTION_PLANS;

// Stripe Price IDs (set these in environment variables)
export const STRIPE_PRICE_IDS = {
  BASIC_MONTHLY:   process.env.STRIPE_BASIC_MONTHLY_PRICE_ID   || 'price_basic_monthly',
  BASIC_ANNUAL:    process.env.STRIPE_BASIC_ANNUAL_PRICE_ID    || 'price_basic_annual',
  PRO_MONTHLY:     process.env.STRIPE_PRO_MONTHLY_PRICE_ID     || 'price_pro_monthly',
  PRO_ANNUAL:      process.env.STRIPE_PRO_ANNUAL_PRICE_ID      || 'price_pro_annual',
  STUDIO_MONTHLY:  process.env.STRIPE_STUDIO_MONTHLY_PRICE_ID  || 'price_studio_monthly',
  STUDIO_ANNUAL:   process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID   || 'price_studio_annual',
  PREMIUM_MONTHLY: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || 'price_premium_monthly',
  PREMIUM_ANNUAL:  process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID   || 'price_premium_annual',
} as const;

// Helper functions
export function getPlanDetails(tier: SubscriptionTier) {
  return SUBSCRIPTION_PLANS[tier];
}

export function calculateCommission(amount: number, tier: SubscriptionTier) {
  const plan = SUBSCRIPTION_PLANS[tier]
  const commission = (amount * plan.commissionRate) / 100
  return {
    commission,
    providerPayout: amount - commission,
  }
}

export function getTrialEndDate(tier: SubscriptionTier): Date {
  const plan = SUBSCRIPTION_PLANS[tier];
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.trialDays);
  return endDate;
}

export function isTrialExpired(trialEndsAt: Date | null): boolean {
  if (!trialEndsAt) return false;
  return new Date() > new Date(trialEndsAt);
}

export function canAccessFeature(
  tier: SubscriptionTier,
  feature: keyof typeof SUBSCRIPTION_PLANS.BASIC.limits
): boolean {
  return SUBSCRIPTION_PLANS[tier].limits[feature] as boolean
}

export function getStripePriceId(tier: SubscriptionTier, billingCycle: 'monthly' | 'annual'): string {
  const key = `${tier}_${billingCycle.toUpperCase()}` as keyof typeof STRIPE_PRICE_IDS;
  return STRIPE_PRICE_IDS[key];
}

// Commission rate tiers for easy reference
export const COMMISSION_RATES = {
  BASIC: 15,
  PRO: 12,
  STUDIO: 11,
  PREMIUM: 10
} as const;
