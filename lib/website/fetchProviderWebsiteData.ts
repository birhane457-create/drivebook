/**
 * lib/website/fetchProviderWebsiteData.ts
 *
 * Fetches all data needed to render a provider's public website page.
 * Used by both subdomain and custom-domain routes.
 *
 * Returns null if no provider is found for the given slug/id.
 */

import { prisma } from '@/lib/prisma'
import { getBusinessConfig } from '@/lib/core/business-config'
import type { BusinessConfig } from '@/lib/core/types'
import type { ProviderPublicData } from '@/components/website/BusinessWebsitePage'
import type { Review } from '@/components/website/WebsiteReviews'
import { addMinutes } from 'date-fns'

export interface ProviderWebsiteData {
  config: BusinessConfig
  provider: ProviderPublicData
  reviews: Review[]
  nextAvailableSlots: string[]
  isAcceptingBookings: boolean
  canonicalUrl: string
}

export async function fetchProviderWebsiteData(
  slug: string,
  rootDomain: string
): Promise<ProviderWebsiteData | null> {
  // Resolve provider by customSlug or id
  const instructor = await prisma.provider.findFirst({
    where: {
      OR: [
        { customSlug: slug },
        { id: slug },
      ],
    },
    select: {
      id: true,
      name: true,
      businessName: true,
      bio: true,
      phone: true,
      profileImage: true,
      serviceAreas: true,
      baseAddress: true,
      serviceRadiusKm: true,
      hourlyRate: true,
      averageRating: true,
      totalReviews: true,
      yearsExperience: true,
      whatsapp: true,
      instagram: true,
      facebook: true,
            workingHours: true,
      bookingBufferMinutes: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionTier: true,
      customSlug: true,
      customDomain: true,
      brandLogo: true,
      brandColorPrimary: true,
      brandColorSecondary: true,
      showBrandingOnBookingPage: true,
      timezone: true,
      state: true,
    },
  }) as any

  if (!instructor) return null

  // Subscription / accepting-bookings check
  const trialEndsAt = instructor.trialEndsAt ? new Date(instructor.trialEndsAt) : null
  const trialExpired = trialEndsAt && trialEndsAt < new Date()
  const isAcceptingBookings =
    instructor.subscriptionStatus === 'ACTIVE' ||
    (instructor.subscriptionStatus === 'TRIAL' && !trialExpired)

  // Load BusinessConfig — tries DB first, falls back to driving template
  const config = await getBusinessConfig({ providerId: instructor.id })

  // Override branding from Instructor fields if not in BusinessConfig yet
  // (during migration period before Business tables are fully populated)
  if (!config.branding.logo && instructor.brandLogo) {
    config.branding.logo = instructor.brandLogo
  }
  if (instructor.brandColorPrimary) {
    config.branding.primaryColour = instructor.brandColorPrimary
  }
  if (instructor.brandColorSecondary) {
    config.branding.secondaryColour = instructor.brandColorSecondary
  }

  // Display name
  const displayName = instructor.businessName?.trim() || instructor.name

  // Extract suburb from baseAddress
  const baseSuburb = extractSuburb(instructor.baseAddress)

  // Vehicle types (driving-specific)
  const vehicleTypes = (instructor as any).vehicleTypes
    ? (instructor as any).vehicleTypes.split(',').map((v: string) => v.trim()).filter(Boolean)
    : undefined

  // Recent reviews
  const reviews = await prisma.booking.findMany({
    where: {
      providerId: instructor.id,
      customerRating: { not: null },
      status: 'COMPLETED',
    },
    select: {
      customerName: true,
      customerRating: true,
      startTime: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  }) as Review[]

  // Next available slots
  const nextAvailableSlots = await computeNextAvailableSlots(
    instructor.id,
    instructor.workingHours,
    instructor.bookingBufferMinutes ?? 10
  )

  // Canonical URL
  const canonicalSlug = instructor.customSlug ?? instructor.id
  const canonicalUrl = instructor.customDomain
    ? `https://${instructor.customDomain}`
    : `https://${canonicalSlug}.${rootDomain}`

  const provider: ProviderPublicData = {
    id: instructor.id,
    displayName,
    profileImage: instructor.profileImage,
    bio: instructor.bio,
    phone: instructor.phone,
    serviceAreas: instructor.serviceAreas,
    baseSuburb,
    averageRating: instructor.averageRating,
    totalReviews: instructor.totalReviews,
    yearsExperience: instructor.yearsExperience,
    whatsapp: instructor.whatsapp,
    instagram: instructor.instagram,
    facebook: instructor.facebook,
    vehicleTypes,
  }

  return {
    config,
    provider,
    reviews,
    nextAvailableSlots,
    isAcceptingBookings,
    canonicalUrl,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractSuburb(baseAddress: string | null | undefined): string | null {
  if (!baseAddress) return null
  const addr = baseAddress.trim()
  const commaParts = addr.split(',').map((s: string) => s.trim()).filter(Boolean)
  for (let i = commaParts.length - 1; i >= 0; i--) {
    const clean = commaParts[i].replace(/\b[A-Z]{2,3}\b/g, '').replace(/\b\d{4,}\b/g, '').trim()
    if (clean && !/^\d/.test(clean)) return clean
  }
  const tokens = addr.split(/\s+/)
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]
    if (/^[A-Z]{2,3}$/.test(t) || /^\d+$/.test(t)) continue
    if (/[A-Za-z]/.test(t) && !/^\d/.test(t)) return t
  }
  return null
}

function getDaySlots(wh: any, dayName: string): { start: string; end: string }[] {
  const val = wh?.[dayName]
  if (!val) return []
  if (Array.isArray(val)) return val.filter((s: any) => s.start && s.end)
  if (typeof val === 'object' && val.start && val.end && val.enabled !== false) {
    return [{ start: val.start, end: val.end }]
  }
  return []
}

async function computeNextAvailableSlots(
  providerId: string,
  workingHoursRaw: any,
  bufferMinutes: number
): Promise<string[]> {
  try {
    const now = new Date()
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
    const workingHours = workingHoursRaw || {}

    const minBookableTime = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    if (minBookableTime.getMinutes() !== 0 || minBookableTime.getSeconds() !== 0) {
      minBookableTime.setHours(minBookableTime.getHours() + 1, 0, 0, 0)
    }

    const upcomingBookings = await prisma.booking.findMany({
      where: {
        providerId,
        status: { in: ['CONFIRMED', 'PENDING'] },
        startTime: { gte: now, lte: new Date(now.getTime() + 14 * 86400000) },
      },
      select: { startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
      take: 100,
    })

    const slots: string[] = []
    for (let i = 0; i < 14 && slots.length < 3; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() + i)
      d.setHours(0, 0, 0, 0)

      const dayName = days[d.getDay()]
      const daySlots = getDaySlots(workingHours, dayName)
      if (daySlots.length === 0) continue

      for (const slot of daySlots) {
        if (slots.length >= 3) break
        const [sh, sm] = slot.start.split(':').map(Number)
        const [eh, em] = slot.end.split(':').map(Number)
        const dayStart = new Date(d); dayStart.setHours(sh, sm, 0, 0)
        const dayEnd   = new Date(d); dayEnd.setHours(eh, em, 0, 0)

        let cursor = new Date(Math.max(dayStart.getTime(), minBookableTime.getTime()))
        if (cursor.getMinutes() !== 0) cursor.setHours(cursor.getHours() + 1, 0, 0, 0)

        while (cursor < dayEnd && slots.length < 3) {
          const slotEnd = new Date(cursor.getTime() + 60 * 60 * 1000)
          const blocked = upcomingBookings.some(b => {
            const bs = new Date(b.startTime!); const be = new Date(b.endTime!)
            return cursor < be && slotEnd > bs
          })
          if (!blocked) {
            const todayMidnight = new Date(now); todayMidnight.setHours(0,0,0,0)
            const tomorrowMidnight = new Date(todayMidnight.getTime() + 86400000)
            const labelDate = new Date(d)
            const label =
              labelDate.getTime() === todayMidnight.getTime() ? 'Today' :
              labelDate.getTime() === tomorrowMidnight.getTime() ? 'Tomorrow' :
              labelDate.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
            const timeStr = cursor.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
            slots.push(`${label} ${timeStr}`)
          }
          cursor = slotEnd
        }
      }
    }
    return slots
  } catch {
    return []
  }
}
