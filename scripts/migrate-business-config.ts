/**
 * scripts/migrate-business-config.ts
 *
 * Data migration: create Business configuration records from existing Instructor data.
 *
 * Run AFTER applying the business-config-schema migration:
 *   npx prisma migrate dev --name add_business_config_tables
 *   npx tsx scripts/migrate-business-config.ts
 *
 * Safe to re-run â€” uses upsert throughout.
 */

import { PrismaClient } from '@prisma/client'
import { drivingDefaultConfig } from '../lib/templates/driving/config'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting Business Config migration...\n')

  const instructors = await prisma.provider.findMany({
    include: { user: { select: { email: true } } },
  })

  console.log(`Found ${instructors.length} instructors to migrate.\n`)

  let created = 0
  let skipped = 0

  for (const instructor of instructors) {
    try {
      // 1. Create Business record
      const business = await (prisma as any).business.upsert({
        where: { id: `biz_${instructor.id}` },
        create: {
          id: `biz_${instructor.id}`,
          name: instructor.businessName ?? instructor.name,
          legalName: instructor.businessName ?? instructor.name,
          abn: instructor.abn ?? undefined,
          abnVerified: instructor.abnVerified ?? false,
          supportEmail: instructor.user?.email ?? `support@drivebook.com.au`,
          phone: instructor.phone,
          timezone: instructor.timezone ?? 'Australia/Perth',
          templateSlug: 'driving',
          subscriptionTier: instructor.subscriptionTier ?? 'BASIC',
          isActive: instructor.isActive,
        },
        update: {
          name: instructor.businessName ?? instructor.name,
          subscriptionTier: instructor.subscriptionTier ?? 'BASIC',
          isActive: instructor.isActive,
        },
      })

      const bizId = business.id

      // 2. Branding
      await (prisma as any).businessBranding.upsert({
        where: { businessId: bizId },
        create: {
          businessId: bizId,
          logo: instructor.brandLogo ?? undefined,
          primaryColour: instructor.brandColorPrimary ?? '#3B82F6',
          secondaryColour: instructor.brandColorSecondary ?? undefined,
          showPlatformBranding: !instructor.showBrandingOnBookingPage,
          customSlug: instructor.customSlug ?? undefined,
        },
        update: {
          logo: instructor.brandLogo ?? undefined,
          primaryColour: instructor.brandColorPrimary ?? '#3B82F6',
          customSlug: instructor.customSlug ?? undefined,
        },
      })

      // 3. Terminology â€” all existing instructors get driving defaults
      const t = drivingDefaultConfig.terminology
      await (prisma as any).businessTerminology.upsert({
        where: { businessId: bizId },
        create: {
          businessId: bizId,
          provider:      t.provider,
          providers:     t.providers,
          customer:      t.customer,
          customers:     t.customers,
          booking:       t.booking,
          bookings:      t.bookings,
          service:       t.service,
          services:      t.services,
          providerGroup: t.providerGroup,
        },
        update: {},  // don't overwrite if already customised
      })

      // 4. Capabilities â€” derive from subscription tier
      const tier = instructor.subscriptionTier ?? 'BASIC'
      const isPro = ['PRO', 'STUDIO', 'BUSINESS'].includes(tier)
      const isStudio = ['STUDIO', 'BUSINESS'].includes(tier)

      await (prisma as any).businessCapabilities.upsert({
        where: { businessId: bizId },
        create: {
          businessId: bizId,
          onlineBooking:        true,
          onlinePayments:       true,
          quotes:               false,
          packages:             true,
          waitingList:          isPro,
          reviews:              true,
          aiReceptionist:       isPro,
          voiceLine:            isPro,
          mobileApp:            true,
          googleCalendar:       true,
          documentVerification: isPro,
          travelTime:           isPro && (instructor.enableTravelTime ?? false),
          assessmentTracking:   isPro,
          websiteBuilder:       true,
          // Driving instructors use marketplace payment model
          wallet:               true,
          payouts:              true,
          commission:           true,
        },
        update: {},  // don't overwrite if already customised
      })

      // 5. AI config â€” basic driving defaults
      await (prisma as any).businessAIConfig.upsert({
        where: { businessId: bizId },
        create: {
          businessId: bizId,
          businessDescription: drivingDefaultConfig.aiConfig.businessDescription,
          openingHours: drivingDefaultConfig.aiConfig.openingHours,
          faq: drivingDefaultConfig.aiConfig.faq,
          allowedActions: drivingDefaultConfig.aiConfig.allowedActions,
          personality: drivingDefaultConfig.aiConfig.personality ?? 'friendly',
        },
        update: {},  // don't overwrite if already customised
      })

      // 6. Domain â€” migrate custom domain if set
      if (instructor.customDomain && instructor.domainVerified) {
        await (prisma as any).businessDomain.upsert({
          where: { host: instructor.customDomain },
          create: {
            businessId: bizId,
            host: instructor.customDomain,
            type: 'custom',
            isPrimary: true,
            verified: instructor.domainVerified,
            verifiedAt: instructor.domainVerifiedAt ?? undefined,
          },
          update: {
            verified: instructor.domainVerified,
          },
        })
      }

      // 7. Default services from driving template
      const existingServices = await (prisma as any).businessService.count({
        where: { businessId: bizId },
      })

      if (existingServices === 0) {
        for (let i = 0; i < drivingDefaultConfig.services.length; i++) {
          const svc = drivingDefaultConfig.services[i]
          await (prisma as any).businessService.create({
            data: {
              businessId: bizId,
              name: svc.name,
              description: svc.description,
              duration: svc.duration,
              price: instructor.hourlyRate ?? svc.price,  // use instructor's actual rate
              sortOrder: i,
              isActive: true,
              bookingMode: svc.bookingMode,
              locationMode: svc.locationMode,
              providerRequired: svc.providerRequired,
              payOnBooking: svc.paymentRules.payOnBooking,
              payOnCompletion: svc.paymentRules.payOnCompletion,
              quoteRequired: svc.paymentRules.quoteRequired,
              freeCancellationHours: svc.cancellationRules.freeCancellationHours,
              refundPercent: svc.cancellationRules.refundPercent,
              minAdvanceHours: svc.availabilityRules.minAdvanceHours,
              maxAdvanceDays: svc.availabilityRules.maxAdvanceDays,
              aiCanBook: svc.aiCanBook,
              aiCanQuote: svc.aiCanQuote,
            },
          })
        }
      }

      created++
      if (created % 10 === 0) console.log(`  Migrated ${created}/${instructors.length}...`)

    } catch (err) {
      console.error(`  ERROR migrating instructor ${instructor.id}: ${err}`)
      skipped++
    }
  }

  console.log(`\nMigration complete.`)
  console.log(`  Created/updated: ${created}`)
  console.log(`  Errors/skipped:  ${skipped}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
