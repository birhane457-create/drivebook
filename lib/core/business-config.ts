/**
 * lib/core/business-config.ts
 *
 * Runtime BusinessConfig resolution.
 *
 * Resolution order:
 *   1. DB lookup via Business tables (populated after migration + data migration script)
 *   2. Driving template fallback (Phase 1 — all existing businesses are driving schools)
 *
 * This file is the single seam. When the Business tables are populated,
 * only this file changes — all callers remain identical.
 */

import type {
  BusinessConfig, BusinessTerminology, BusinessCapabilities,
  ServiceDefinition, AIConfig, BusinessBranding,
} from './types'
import { drivingDefaultConfig } from '@/lib/presets/driving/config'
import { drivingExtension } from '@/lib/extensions/driving'
import { prisma } from '@/lib/prisma'

// ── DB resolution ─────────────────────────────────────────────────────────────

async function loadFromDB(businessId?: string, providerId?: string): Promise<BusinessConfig | null> {
  try {
    let bizId = businessId
    if (!bizId && providerId) {
      // Derive the deterministic business ID used in the migration script
      bizId = `biz_${providerId}`
    }
    if (!bizId) return null

    const [business, settings, branding, capabilities, terminology, aiConfig, services] =
      await Promise.all([
        prisma.business.findUnique({ where: { id: bizId } }),
        prisma.businessSettings.findUnique({ where: { businessId: bizId } }),
        prisma.businessBranding.findUnique({ where: { businessId: bizId } }),
        prisma.businessCapabilities.findUnique({ where: { businessId: bizId } }),
        prisma.businessTerminology.findUnique({ where: { businessId: bizId } }),
        prisma.businessAIConfig.findUnique({ where: { businessId: bizId } }),
        prisma.businessService.findMany({
          where: { businessId: bizId, isActive: true },
          orderBy: { sortOrder: 'asc' },
        }),
      ])

    if (!business) return null

    return assembleConfig(business, settings, branding, capabilities, terminology, aiConfig, services)
  } catch {
    // Tables may not exist yet on first boot before migration
    return null
  }
}

// ── Config assembler ──────────────────────────────────────────────────────────

function assembleConfig(
  business: NonNullable<Awaited<ReturnType<typeof prisma.business.findUnique>>>,
  settings:     Awaited<ReturnType<typeof prisma.businessSettings.findUnique>>,
  branding:     Awaited<ReturnType<typeof prisma.businessBranding.findUnique>>,
  capabilities: Awaited<ReturnType<typeof prisma.businessCapabilities.findUnique>>,
  terminology:  Awaited<ReturnType<typeof prisma.businessTerminology.findUnique>>,
  aiConfig:     Awaited<ReturnType<typeof prisma.businessAIConfig.findUnique>>,
  services:     Awaited<ReturnType<typeof prisma.businessService.findMany>>,
): BusinessConfig {
  const termDefaults = drivingDefaultConfig.terminology

  const assembledTerminology: BusinessTerminology = {
    provider:      terminology?.provider      ?? termDefaults.provider,
    providers:     terminology?.providers     ?? termDefaults.providers,
    customer:      terminology?.customer      ?? termDefaults.customer,
    customers:     terminology?.customers     ?? termDefaults.customers,
    booking:       terminology?.booking       ?? termDefaults.booking,
    bookings:      terminology?.bookings      ?? termDefaults.bookings,
    service:       terminology?.service       ?? termDefaults.service,
    services:      terminology?.services      ?? termDefaults.services,
    providerGroup: terminology?.providerGroup ?? termDefaults.providerGroup,
  }

  const capDefaults = drivingDefaultConfig.capabilities
  const assembledCapabilities: BusinessCapabilities = {
    onlineBooking:        capabilities?.onlineBooking        ?? capDefaults.onlineBooking,
    onlinePayments:       capabilities?.onlinePayments       ?? capDefaults.onlinePayments,
    quotes:               capabilities?.quotes               ?? capDefaults.quotes,
    packages:             capabilities?.packages             ?? capDefaults.packages,
    waitingList:          capabilities?.waitingList          ?? capDefaults.waitingList,
    reviews:              capabilities?.reviews              ?? capDefaults.reviews,
    aiReceptionist:       capabilities?.aiReceptionist       ?? capDefaults.aiReceptionist,
    voiceLine:            capabilities?.voiceLine            ?? capDefaults.voiceLine,
    mobileApp:            capabilities?.mobileApp            ?? capDefaults.mobileApp,
    googleCalendar:       capabilities?.googleCalendar       ?? capDefaults.googleCalendar,
    documentVerification: capabilities?.documentVerification ?? capDefaults.documentVerification,
    travelTime:           capabilities?.travelTime           ?? capDefaults.travelTime,
    assessmentTracking:   capabilities?.assessmentTracking   ?? capDefaults.assessmentTracking,
    websiteBuilder:       capabilities?.websiteBuilder       ?? capDefaults.websiteBuilder,
    // Payment model capabilities — driven by Business.paymentModel at onboarding
    wallet:               capabilities?.wallet               ?? capDefaults.wallet,
    payouts:              capabilities?.payouts              ?? capDefaults.payouts,
    commission:           capabilities?.commission           ?? capDefaults.commission,
  }

  const assembledBranding: BusinessBranding = {
    logo:            branding?.logo            ?? undefined,
    primaryColour:   branding?.primaryColour   ?? '#3B82F6',
    secondaryColour: branding?.secondaryColour ?? undefined,
    fontFamily:      branding?.fontFamily      ?? undefined,
    theme:           (branding?.theme as 'light' | 'dark') ?? 'light',
  }

  const assembledAIConfig: AIConfig = {
    businessDescription: aiConfig?.businessDescription ?? drivingDefaultConfig.aiConfig.businessDescription,
    openingHours:        aiConfig?.openingHours        ?? drivingDefaultConfig.aiConfig.openingHours,
    faq:                 (aiConfig?.faq as any[])      ?? drivingDefaultConfig.aiConfig.faq,
    allowedActions:      (aiConfig?.allowedActions as any[]) ?? drivingDefaultConfig.aiConfig.allowedActions,
    greetingScript:      aiConfig?.greetingScript      ?? drivingDefaultConfig.aiConfig.greetingScript,
    personality:         aiConfig?.personality         ?? drivingDefaultConfig.aiConfig.personality,
  }

  const assembledServices: ServiceDefinition[] = services.length > 0
    ? services.map(s => ({
        id:           s.id,
        name:         s.name,
        description:  s.description ?? undefined,
        duration:     s.duration,
        price:        Number(s.price),
        bookingMode:  s.bookingMode as ServiceDefinition['bookingMode'],
        locationMode: s.locationMode as ServiceDefinition['locationMode'],
        providerRequired: s.providerRequired,
        paymentRules: {
          depositPercent:  s.depositPercent != null ? Number(s.depositPercent) : undefined,
          payOnBooking:    s.payOnBooking,
          payOnCompletion: s.payOnCompletion,
          quoteRequired:   s.quoteRequired,
        },
        cancellationRules: {
          freeCancellationHours: s.freeCancellationHours,
          refundPercent:         Number(s.refundPercent ?? 0),
        },
        availabilityRules: {
          minAdvanceHours: s.minAdvanceHours,
          maxAdvanceDays:  s.maxAdvanceDays,
        },
        aiCanBook:  s.aiCanBook,
        aiCanQuote: s.aiCanQuote,
      }))
    : drivingDefaultConfig.services

  // Attach the driving domain extension when assessment/document capabilities are enabled
  const needsExtension =
    assembledCapabilities.assessmentTracking ||
    assembledCapabilities.documentVerification

  return {
    id:               business.id,
    name:             business.name,
    legalName:        business.legalName ?? undefined,
    abn:              business.abn ?? undefined,
    supportEmail:     business.supportEmail,
    timezone:         business.timezone,
    paymentModel:     (business.paymentModel as BusinessConfig['paymentModel']) ?? 'saas',
    terminology:      assembledTerminology,
    capabilities:     assembledCapabilities,
    services:         assembledServices,
    aiConfig:         assembledAIConfig,
    branding:         assembledBranding,
    subscriptionTier: business.subscriptionTier as BusinessConfig['subscriptionTier'],
    domainExtension:  needsExtension ? drivingExtension : undefined,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the BusinessConfig for a given business/provider context.
 *
 * Resolution order:
 *   1. DB lookup — Business tables populated by migrate-business-config.ts
 *   2. Driving template fallback (Phase 1 compatibility)
 *
 * @param options.providerId  Provider (Instructor) ID — derives businessId as `biz_{providerId}`
 * @param options.businessId  Direct Business record ID
 */
export async function getBusinessConfig(
  options: { providerId?: string; businessId?: string } = {}
): Promise<BusinessConfig> {
  const dbConfig = await loadFromDB(options.businessId, options.providerId)
  if (dbConfig) return dbConfig

  // Phase 1 fallback — driving template for all businesses
  return {
    ...drivingDefaultConfig,
    domainExtension: drivingExtension,
  }
}

/**
 * Returns a minimal identity object for emails, invoices and footers.
 * Replaces the old PLATFORM_IDENTITY constant.
 */
export async function getPlatformIdentity(options: {
  providerId?: string
  businessId?: string
} = {}) {
  const config = await getBusinessConfig(options)
  return {
    name:      config.name,
    legalName: config.legalName ?? config.name,
    abn:       config.abn ?? '',
    email:     config.supportEmail,
    website:   process.env.NEXTAUTH_URL ?? 'https://drivebook.com.au',
    baseUrl:   process.env.NEXTAUTH_URL ?? 'https://drivebook.com.au',
  }
}

/**
 * Returns the terminology for a business.
 * Use instead of hardcoding "instructor", "lesson", etc. in UI and notifications.
 */
export async function getTerminology(options: {
  providerId?: string
  businessId?: string
} = {}) {
  const config = await getBusinessConfig(options)
  return config.terminology
}
