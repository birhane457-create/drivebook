// Subscription Pricing and Features Configuration

export const SUBSCRIPTION_PLANS = {
  BASIC: {
    name: 'Basic',
    monthlyPrice: 29,
    annualPrice: 290, // ~17% discount
    commissionRate: 15, // 15% per booking
    newStudentBonus: 8, // 8% extra for first booking
    trialDays: 14,
    features: [
      'Single instructor account',
      'Unlimited bookings',
      'Google Calendar sync',
      'Email notifications',
      'Basic analytics',
      'Student reviews',
      'Mobile app access',
      '15% commission per booking',
      '8% bonus for new students',
    ],
    limits: {
      instructors: 1,
      customDomain: false,
      brandedPages: false,
      prioritySupport: false,
      apiAccess: false,
    },
  },
  
  PRO: {
    name: 'Pro',
    monthlyPrice: 79,
    annualPrice: 790, // ~17% discount
    commissionRate: 12, // 12% per booking
    newStudentBonus: 10, // 10% extra for first booking
    trialDays: 14,
    features: [
      'Everything in Basic',
      'Advanced analytics & insights',
      'SMS notifications',
      'Waiting list management',
      'PDA test tracking',
      'Document management',
      'Check-in/Check-out system',
      'Custom service areas',
      '12% commission per booking',
      '10% bonus for new students',
      'Priority email support',
    ],
    limits: {
      instructors: 1,
      customDomain: false,
      brandedPages: false,
      prioritySupport: true,
      apiAccess: false,
    },
  },
  
  BUSINESS: {
    name: 'Business',
    monthlyPrice: 199,
    annualPrice: 1990, // ~17% discount
    commissionRate: 10, // 10% per booking
    newStudentBonus: 12, // 12% extra for first booking
    trialDays: 30, // Extended trial for Business
    features: [
      'Everything in Pro',
      'Multiple instructor accounts',
      'Branded booking pages',
      'Custom domain support',
      'White-label solution',
      'API access',
      'Advanced reporting',
      'Dedicated account manager',
      'Priority phone support',
      '10% commission per booking',
      '12% bonus for new students',
      'Custom integrations',
      'Training & onboarding',
    ],
    limits: {
      instructors: 999, // Unlimited
      customDomain: true,
      brandedPages: true,
      prioritySupport: true,
      apiAccess: true,
    },
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_PLANS;

// Stripe Price IDs (set these in environment variables)
export const STRIPE_PRICE_IDS = {
  BASIC_MONTHLY: process.env.STRIPE_BASIC_MONTHLY_PRICE_ID || 'price_basic_monthly',
  BASIC_ANNUAL: process.env.STRIPE_BASIC_ANNUAL_PRICE_ID || 'price_basic_annual',
  PRO_MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
  PRO_ANNUAL: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || 'price_pro_annual',
  BUSINESS_MONTHLY: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || 'price_business_monthly',
  BUSINESS_ANNUAL: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID || 'price_business_annual',
} as const;

// Helper functions
export function getPlanDetails(tier: SubscriptionTier) {
  return SUBSCRIPTION_PLANS[tier];
}

export function calculateCommission(amount: number, tier: SubscriptionTier, isNewStudent: boolean = false) {
  const plan = SUBSCRIPTION_PLANS[tier];
  const baseCommission = (amount * plan.commissionRate) / 100;
  const bonus = isNewStudent ? (amount * plan.newStudentBonus) / 100 : 0;
  
  return {
    baseCommission,
    bonus,
    totalCommission: baseCommission + bonus,
    instructorPayout: amount - baseCommission - bonus,
  };
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
  return SUBSCRIPTION_PLANS[tier].limits[feature] as boolean;
}

export function getStripePriceId(tier: SubscriptionTier, billingCycle: 'monthly' | 'annual'): string {
  const key = `${tier}_${billingCycle.toUpperCase()}` as keyof typeof STRIPE_PRICE_IDS;
  return STRIPE_PRICE_IDS[key];
}

// Commission rate tiers for easy reference
export const COMMISSION_RATES = {
  BASIC: 15,
  PRO: 12,
  BUSINESS: 10,
} as const;

// New student bonus rates
export const NEW_STUDENT_BONUS = {
  BASIC: 8,
  PRO: 10,
  BUSINESS: 12,
} as const;
