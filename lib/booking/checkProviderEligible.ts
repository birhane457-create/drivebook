/**
 * lib/booking/checkProviderEligible.ts
 *
 * DOC-EXP-01 fix: single authoritative pre-booking provider eligibility check.
 *
 * Checks (in order):
 *  1. Provider exists
 *  2. approvalStatus === 'APPROVED'  (not PENDING / SUSPENDED / REJECTED)
 *  3. isActive === true
 *  4. subscriptionStatus is ACTIVE, or TRIAL with trialEndsAt in the future
 *  5. acceptingBookings !== false   (instructor self-service pause)
 *  6. No driving compliance document has passed its expiry date
 *     (only evaluated when a DrivingProviderProfile record exists —
 *      non-driving business types have no profile row and are exempt)
 *
 * WHY documentsVerified is NOT used as the sole gate:
 *  documentsVerified is set to true by the admin document-approve flow and
 *  to false by the admin document-reject flow. However the document-expiry
 *  cron does NOT flip it back to false when individual documents expire.
 *  A provider could have documentsVerified=true with a licenseExpiry in the
 *  past. We therefore check the actual expiry dates directly.
 *
 * USAGE in booking routes:
 *   const eligible = await checkProviderEligible(providerId, prisma)
 *   if (!eligible.allowed) {
 *     return NextResponse.json(
 *       { error: eligible.error, code: eligible.code },
 *       { status: eligible.status }
 *     )
 *   }
 *   // use eligible.provider for subsequent logic (hourlyRate, etc.)
 */

import { PrismaClient } from '@prisma/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EligibilityDenied {
  allowed:  false
  status:   403 | 404
  error:    string
  code:     string
  provider: null
}

export interface EligibilityGranted {
  allowed:  true
  provider: {
    id:                 string
    name:               string
    hourlyRate:         number
    approvalStatus:     string
    isActive:           boolean
    acceptingBookings:  boolean
    subscriptionStatus: string
    subscriptionTier:   string
    trialEndsAt:        Date | null
    paymentMode:        string
    businessModel:      string
    accountType:        string
    syncGoogleCalendar: boolean
    userId:             string | null
    timezone:           string | null
    state:              string | null
  }
}

export type EligibilityResult = EligibilityDenied | EligibilityGranted

// ── Main function ─────────────────────────────────────────────────────────────

export async function checkProviderEligible(
  providerId: string,
  db: PrismaClient | Parameters<typeof PrismaClient['prototype']['$transaction']>[0],
): Promise<EligibilityResult> {

  const deny = (
    status:  403 | 404,
    error:   string,
    code:    string,
  ): EligibilityDenied => ({ allowed: false, status, error, code, provider: null })

  // ── 1. Fetch provider + driving profile in one round-trip ─────────────────
  const raw = await (db as PrismaClient).provider.findUnique({
    where:  { id: providerId },
    select: {
      id:                 true,
      name:               true,
      hourlyRate:         true,
      approvalStatus:     true,
      isActive:           true,
      acceptingBookings:  true,
      subscriptionStatus: true,
      subscriptionTier:   true,
      trialEndsAt:        true,
      paymentMode:        true,
      businessModel:      true,
      accountType:        true,
      syncGoogleCalendar: true,
      userId:             true,
      timezone:           true,
      state:              true,
    },
  })

  if (!raw) {
    return deny(404 as any, 'Instructor not found', 'INSTRUCTOR_NOT_FOUND')
  }

  // ── 2. Approval status ────────────────────────────────────────────────────
  if (raw.approvalStatus !== 'APPROVED') {
    return deny(403, 'Instructor is not available for bookings.', 'INSTRUCTOR_NOT_APPROVED')
  }

  // ── 3. Active flag ────────────────────────────────────────────────────────
  if (!raw.isActive) {
    return deny(403, 'Instructor is not available for bookings.', 'INSTRUCTOR_INACTIVE_FLAG')
  }

  // ── 4. Subscription gate ──────────────────────────────────────────────────
  const subStatus   = raw.subscriptionStatus as string
  const trialEndsAt = raw.trialEndsAt ? new Date(raw.trialEndsAt) : null
  const trialActive = trialEndsAt !== null && trialEndsAt >= new Date()
  const subOk       = subStatus === 'ACTIVE' || (subStatus === 'TRIAL' && trialActive)

  if (!subOk) {
    return deny(403, 'This instructor is not currently accepting bookings.', 'INSTRUCTOR_INACTIVE')
  }

  // ── 5. Self-service pause ─────────────────────────────────────────────────
  if ((raw as any).acceptingBookings === false) {
    return deny(403, 'This instructor is not currently accepting new bookings.', 'INSTRUCTOR_PAUSED')
  }

  // ── 6. Driving document expiry (only for providers with a DrivingProviderProfile) ──
  const profile = await (db as any).drivingProviderProfile.findUnique({
    where:  { providerId },
    select: {
      licenseExpiry:     true,
      insuranceExpiry:   true,
      policeCheckExpiry: true,
      wwcCheckExpiry:    true,
    },
  })

  if (profile) {
    const now = new Date()

    const expiredDoc = (
      [
        { name: 'Driving licence',              expiry: profile.licenseExpiry },
        { name: 'Insurance policy',             expiry: profile.insuranceExpiry },
        { name: 'Police check',                 expiry: profile.policeCheckExpiry },
        { name: 'Working With Children Check',  expiry: profile.wwcCheckExpiry },
      ] as { name: string; expiry: Date | null }[]
    ).find(d => d.expiry !== null && new Date(d.expiry) < now)

    if (expiredDoc) {
      return deny(
        403,
        'This instructor is not currently available for bookings.',
        'INSTRUCTOR_DOCUMENT_EXPIRED',
      )
    }
  }

  // ── Granted ───────────────────────────────────────────────────────────────
  return {
    allowed:  true,
    provider: {
      id:                 raw.id,
      name:               raw.name,
      hourlyRate:         raw.hourlyRate,
      approvalStatus:     raw.approvalStatus,
      isActive:           raw.isActive,
      acceptingBookings:  (raw as any).acceptingBookings ?? true,
      subscriptionStatus: raw.subscriptionStatus,
      subscriptionTier:   raw.subscriptionTier,
      trialEndsAt:        raw.trialEndsAt ? new Date(raw.trialEndsAt) : null,
      paymentMode:        (raw as any).paymentMode ?? 'PLATFORM',
      businessModel:      (raw as any).businessModel ?? 'MARKETPLACE',
      accountType:        (raw as any).accountType ?? 'INDIVIDUAL',
      syncGoogleCalendar: (raw as any).syncGoogleCalendar ?? false,
      userId:             raw.userId ?? null,
      timezone:           (raw as any).timezone ?? null,
      state:              (raw as any).state ?? null,
    },
  }
}
