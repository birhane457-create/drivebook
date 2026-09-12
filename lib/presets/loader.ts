/**
 * lib/templates/loader.ts
 *
 * Template loader and business creation from templates.
 * Used during registration to initialize Business + BusinessConfig tables.
 */

import type { BusinessConfig } from '@/lib/core/types'
import type { PrismaClient } from '@prisma/client'
import { drivingDefaultConfig } from './driving/config'

// Template registry
const templates: Record<string, () => Promise<BusinessConfig>> = {
  driving: async () => drivingDefaultConfig,
  beauty: async () => {
    const { beautyDefaultConfig } = await import('./beauty/config')
    return beautyDefaultConfig
  },
  tax: async () => {
    const { taxDefaultConfig } = await import('./tax/config')
    return taxDefaultConfig
  },
  plumber: async () => {
    // Placeholder - create actual template later
    return createGenericTradeConfig('plumber', 'Plumber', 'Plumbing Services')
  },
  electrician: async () => {
    // Placeholder - create actual template later
    return createGenericTradeConfig('electrician', 'Electrician', 'Electrical Services')
  },
}

/**
 * Load a template configuration by business type.
 */
export async function loadTemplateConfig(businessType: string): Promise<BusinessConfig | null> {
  const loader = templates[businessType]
  if (!loader) {
    return null
  }
  return loader()
}

/**
 * Create Business + populate all Business* tables from a template.
 * Called during registration inside a transaction.
 */
export async function createBusinessFromTemplate(
  tx: any, // PrismaClient transaction
  businessId: string,
  providerId: string,
  config: BusinessConfig,
): Promise<void> {
  // 1. Create Business (upsert to handle retried registrations)
  await tx.business.upsert({
    where: { id: businessId },
    update: {},
    create: {
      id: businessId,
      name: config.name,
      legalName: config.legalName,
      abn: config.abn,
      supportEmail: config.supportEmail,
      timezone: config.timezone,
      paymentModel: config.paymentModel,
      subscriptionTier: config.subscriptionTier,
    },
  })

  // 2. Create BusinessSettings
  await tx.businessSettings.upsert({
    where: { businessId },
    update: {},
    create: { businessId },
  })

  // 3. Create BusinessBranding
  await tx.businessBranding.upsert({
    where: { businessId },
    update: {},
    create: {
      businessId,
      logo: config.branding?.logo,
      primaryColour: config.branding?.primaryColour ?? '#3B82F6',
      secondaryColour: config.branding?.secondaryColour,
      fontFamily: config.branding?.fontFamily,
      theme: config.branding?.theme ?? 'light',
    },
  })

  // 4. Create BusinessCapabilities
  await tx.businessCapabilities.upsert({
    where: { businessId },
    update: {},
    create: {
      businessId,
      onlineBooking: config.capabilities.onlineBooking,
      onlinePayments: config.capabilities.onlinePayments,
      quotes: config.capabilities.quotes,
      packages: config.capabilities.packages,
      waitingList: config.capabilities.waitingList,
      reviews: config.capabilities.reviews,
      aiReceptionist: config.capabilities.aiReceptionist,
      voiceLine: config.capabilities.voiceLine,
      mobileApp: config.capabilities.mobileApp,
      googleCalendar: config.capabilities.googleCalendar,
      documentVerification: config.capabilities.documentVerification,
      travelTime: config.capabilities.travelTime,
      assessmentTracking: config.capabilities.assessmentTracking,
      websiteBuilder: config.capabilities.websiteBuilder,
      wallet: config.capabilities.wallet,
      payouts: config.capabilities.payouts,
      commission: config.capabilities.commission,
    },
  })

  // 5. Create BusinessTerminology
  await tx.businessTerminology.upsert({
    where: { businessId },
    update: {},
    create: {
      businessId,
      provider: config.terminology.provider,
      providers: config.terminology.providers,
      customer: config.terminology.customer,
      customers: config.terminology.customers,
      booking: config.terminology.booking,
      bookings: config.terminology.bookings,
      service: config.terminology.service,
      services: config.terminology.services,
      providerGroup: config.terminology.providerGroup,
    },
  })

  // 6. Create BusinessAIConfig
  await tx.businessAIConfig.upsert({
    where: { businessId },
    update: {},
    create: {
      businessId,
      businessDescription: config.aiConfig.businessDescription,
      openingHours: config.aiConfig.openingHours,
      faq: config.aiConfig.faq as any,
      allowedActions: config.aiConfig.allowedActions as any,
      greetingScript: config.aiConfig.greetingScript,
      personality: config.aiConfig.personality,
    },
  })

  // 7. Create BusinessServices (upsert to handle retries)
  for (const [index, service] of config.services.entries()) {
    await tx.businessService.upsert({
      where: { id: service.id },
      update: {},
      create: {
        businessId,
        id: service.id,
        name: service.name,
        description: service.description,
        duration: service.duration,
        price: service.price,
        bookingMode: service.bookingMode,
        locationMode: service.locationMode,
        providerRequired: service.providerRequired,
        depositPercent: service.paymentRules.depositPercent,
        payOnBooking: service.paymentRules.payOnBooking,
        payOnCompletion: service.paymentRules.payOnCompletion,
        quoteRequired: service.paymentRules.quoteRequired,
        freeCancellationHours: service.cancellationRules.freeCancellationHours,
        refundPercent: service.cancellationRules.refundPercent,
        minAdvanceHours: service.availabilityRules.minAdvanceHours,
        maxAdvanceDays: service.availabilityRules.maxAdvanceDays,
        aiCanBook: service.aiCanBook,
        aiCanQuote: service.aiCanQuote,
        isActive: true,
        sortOrder: index,
      },
    })
  }

  // Note: Provider-Business relationship not yet implemented in schema
  // Providers are currently independent entities
  // TODO: Add businessId field to Provider schema when multi-provider businesses are supported
}

/**
 * Create a generic trade template (plumber, electrician, etc.)
 * Used as placeholder until proper templates are created.
 */
function createGenericTradeConfig(
  id: string,
  providerLabel: string,
  serviceLabel: string,
): BusinessConfig {
  return {
    id: 'platform',
    name: process.env.PLATFORM_NAME ?? 'DriveBook',
    legalName: process.env.PLATFORM_LEGAL_NAME ?? 'DriveBook Pty Ltd',
    abn: process.env.PLATFORM_ABN ?? '23 806 069 420',
    supportEmail: process.env.ADMIN_EMAIL ?? 'support@drivebook.com.au',
    timezone: 'Australia/Perth',
    paymentModel: 'saas',
    terminology: {
      provider: providerLabel,
      providers: `${providerLabel}s`,
      customer: 'Customer',
      customers: 'Customers',
      booking: 'Job',
      bookings: 'Jobs',
      service: serviceLabel,
      services: `${serviceLabel}s`,
      providerGroup: `${providerLabel} Business`,
    },
    capabilities: {
      onlineBooking: true,
      onlinePayments: true,
      quotes: true,
      packages: false,
      waitingList: false,
      reviews: true,
      aiReceptionist: true,
      voiceLine: true,
      mobileApp: false,
      googleCalendar: true,
      documentVerification: true,
      travelTime: false,
      assessmentTracking: false,
      websiteBuilder: false,
      wallet: false,
      payouts: false,
      commission: false,
    },
    services: [
      {
        id: `${id}-standard`,
        name: `Standard ${serviceLabel}`,
        description: `Professional ${serviceLabel.toLowerCase()} service`,
        duration: 60,
        price: 0,
        bookingMode: 'request',
        locationMode: 'flexible',
        providerRequired: true,
        paymentRules: {
          payOnBooking: false,
          payOnCompletion: true,
          quoteRequired: true,
        },
        cancellationRules: {
          freeCancellationHours: 24,
          refundPercent: 100,
        },
        availabilityRules: {
          minAdvanceHours: 4,
          maxAdvanceDays: 90,
        },
        aiCanBook: false,
        aiCanQuote: true,
      },
    ],
    aiConfig: {
      businessDescription: `Professional ${serviceLabel.toLowerCase()} services with qualified ${providerLabel.toLowerCase()}s. Quote-based pricing for transparent, fair costs.`,
      openingHours: 'Mon–Fri 8am–5pm, Sat 9am–2pm',
      faq: [
        {
          question: 'How does pricing work?',
          answer: 'We provide a free quote after assessing your needs. No obligation until you accept.',
        },
        {
          question: 'How quickly can you come out?',
          answer: 'Most jobs can be quoted within 24 hours. Emergency call-outs available.',
        },
      ],
      allowedActions: ['quote', 'message'],
      greetingScript: 'Thanks for calling. How can we help you today?',
      personality: 'professional',
    },
    branding: {
      primaryColour: '#3B82F6',
      secondaryColour: '#10B981',
      theme: 'light',
    },
    subscriptionTier: 'BASIC',
    domainExtension: undefined,
  }
}
