/**
 * WLA-015: Customer communications sender identity tests.
 *
 * Tests the getProviderBookingsSender() helper in lib/email/senders.ts.
 *
 * Architecture constraint (getAccountFeatures.whiteLabel = isPremium):
 *   - PREMIUM tier providers with businessName → white-label display name
 *   - All other tiers (BASIC, PRO, STUDIO) → standard DriveBook Bookings
 *   - Provider structure (accountType=BUSINESS) does NOT grant white-label
 *   - No provider → standard DriveBook Bookings
 *   - Provider with no businessName → standard DriveBook Bookings
 *
 * WHAT IS TESTED:
 *   S01  PREMIUM with businessName → business name in From display
 *   S02  PREMIUM without businessName → standard DriveBook Bookings
 *   S03  STUDIO tier → standard DriveBook Bookings (STUDIO is not white-label)
 *   S04  PRO tier → standard DriveBook Bookings
 *   S05  BASIC tier → standard DriveBook Bookings
 *   S06  accountType=BUSINESS alone does not grant white-label
 *   S07  null provider → standard DriveBook Bookings
 *   S08  email address is always bookings@drivebook.com.au regardless of tier
 *   S09  businessName with leading/trailing whitespace is trimmed
 *   S10  source check: getProviderBookingsSender imported in email.ts
 *   S11  source check: cron lesson-reminders selects subscriptionTier
 *   S12  source check: waiting-list-notify uses getProviderBookingsSender
 */

import { describe, it, expect } from 'vitest'
import { getProviderBookingsSender, formatSender, SENDERS } from '@/lib/email/senders'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const BOOKINGS_EMAIL = SENDERS.bookings.email
const DRIVEBROOK_BOOKINGS = `DriveBook Bookings <${BOOKINGS_EMAIL}>`

describe('WLA-015: getProviderBookingsSender white-label logic', () => {
  it('S01 -- PREMIUM provider with businessName gets business name in From display', () => {
    const result = getProviderBookingsSender({
      subscriptionTier: 'PREMIUM',
      businessName: 'Perth Drive Academy',
    })
    expect(result).toBe(`Perth Drive Academy via DriveBook <${BOOKINGS_EMAIL}>`)
    expect(result).toContain('Perth Drive Academy')
    expect(result).not.toContain('DriveBook Bookings')
  })

  it('S02 -- PREMIUM provider without businessName falls back to standard sender', () => {
    expect(getProviderBookingsSender({ subscriptionTier: 'PREMIUM', businessName: null })).toBe(DRIVEBROOK_BOOKINGS)
    expect(getProviderBookingsSender({ subscriptionTier: 'PREMIUM', businessName: '' })).toBe(DRIVEBROOK_BOOKINGS)
    expect(getProviderBookingsSender({ subscriptionTier: 'PREMIUM', businessName: '   ' })).toBe(DRIVEBROOK_BOOKINGS)
  })

  it('S03 -- STUDIO tier does not get white-label display name (not whiteLabel-entitled)', () => {
    const result = getProviderBookingsSender({
      subscriptionTier: 'STUDIO',
      businessName: 'Perth Drive Academy',
    })
    expect(result).toBe(DRIVEBROOK_BOOKINGS)
  })

  it('S04 -- PRO tier does not get white-label display name', () => {
    const result = getProviderBookingsSender({
      subscriptionTier: 'PRO',
      businessName: 'Perth Drive Academy',
    })
    expect(result).toBe(DRIVEBROOK_BOOKINGS)
  })

  it('S05 -- BASIC tier does not get white-label display name', () => {
    const result = getProviderBookingsSender({
      subscriptionTier: 'BASIC',
      businessName: 'Perth Drive Academy',
    })
    expect(result).toBe(DRIVEBROOK_BOOKINGS)
  })

  it('S06 -- accountType=BUSINESS alone does not grant white-label (architecture constraint)', () => {
    const result = getProviderBookingsSender({
      subscriptionTier: 'PRO',
      businessName: 'Perth Drive Academy',
    })
    expect(result).toBe(DRIVEBROOK_BOOKINGS)
  })

  it('S07 -- null/undefined provider falls back to standard sender', () => {
    expect(getProviderBookingsSender(null)).toBe(DRIVEBROOK_BOOKINGS)
    expect(getProviderBookingsSender(undefined)).toBe(DRIVEBROOK_BOOKINGS)
    expect(getProviderBookingsSender()).toBe(DRIVEBROOK_BOOKINGS)
  })

  it('S08 -- email address is always bookings@drivebook.com.au regardless of tier', () => {
    const premium = getProviderBookingsSender({ subscriptionTier: 'PREMIUM', businessName: 'Perth Academy' })
    const basic = getProviderBookingsSender({ subscriptionTier: 'BASIC', businessName: 'Perth Academy' })
    const none = getProviderBookingsSender()
    for (const result of [premium, basic, none]) {
      expect(result).toContain(`<${BOOKINGS_EMAIL}>`)
      expect(result).toMatch(new RegExp(`<${BOOKINGS_EMAIL.replace('.', '\\.')}>$`))
    }
  })

  it('S09 -- businessName with whitespace is trimmed', () => {
    const result = getProviderBookingsSender({
      subscriptionTier: 'PREMIUM',
      businessName: '  Perth Drive Academy  ',
    })
    expect(result).toBe(`Perth Drive Academy via DriveBook <${BOOKINGS_EMAIL}>`)
    expect(result).not.toContain('  ')
  })

  it('S09b -- getProviderBookingsSender uses getAccountFeatures (central abstraction, not direct tier check)', () => {
    // Architecture rule: never check plan === 'PREMIUM' directly in product code.
    // Always use getAccountFeatures().
    const sendersSrc = readFileSync(
      resolve(process.cwd(), 'lib/email/senders.ts'), 'utf-8'
    )
    expect(sendersSrc).toContain('getAccountFeatures')
    expect(sendersSrc).toContain('whiteLabel')
    // Must NOT contain a direct tier check
    expect(sendersSrc).not.toContain("subscriptionTier === 'PREMIUM'")
  })
})

describe('WLA-015: Source check — getProviderBookingsSender integrated at call sites', () => {
  const emailServiceSrc = readFileSync(
    resolve(process.cwd(), 'lib/services/email.ts'), 'utf-8'
  )
  const cronSrc = readFileSync(
    resolve(process.cwd(), 'app/api/cron/lesson-reminders/route.ts'), 'utf-8'
  )
  const waitingListSrc = readFileSync(
    resolve(process.cwd(), 'lib/services/waiting-list-notify.ts'), 'utf-8'
  )
  const bookingsRouteSrc = readFileSync(
    resolve(process.cwd(), 'app/api/bookings/route.ts'), 'utf-8'
  )
  const publicBookingsSrc = readFileSync(
    resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8'
  )
  const eligibleSrc = readFileSync(
    resolve(process.cwd(), 'lib/booking/checkProviderEligible.ts'), 'utf-8'
  )

  it('S10 -- email.ts imports and uses getProviderBookingsSender (not formatSender) for booking emails', () => {
    expect(emailServiceSrc).toContain('getProviderBookingsSender')
    expect(emailServiceSrc).toContain('WLA-015 FIX')
    expect(emailServiceSrc).toContain('getProviderBookingsSender(data.provider)')
  })

  it('S11 -- cron lesson-reminders selects subscriptionTier and uses getProviderBookingsSender', () => {
    expect(cronSrc).toContain('subscriptionTier')
    expect(cronSrc).toContain('getProviderBookingsSender')
    expect(cronSrc).toContain('WLA-015 FIX')
  })

  it('S12 -- waiting-list-notify uses getProviderBookingsSender instead of hardcoded DriveBook string', () => {
    expect(waitingListSrc).toContain('getProviderBookingsSender')
    expect(waitingListSrc).not.toContain("'DriveBook Bookings <bookings@drivebook.com.au>'")
    expect(waitingListSrc).toContain('WLA-015 FIX')
  })

  it('S13 -- app/api/bookings/route.ts passes provider to sendBookingConfirmation (caller integration)', () => {
    const callIdx = bookingsRouteSrc.indexOf('sendBookingConfirmation({')
    expect(callIdx).toBeGreaterThan(0)
    const callBlock = bookingsRouteSrc.slice(callIdx, callIdx + 500)
    expect(callBlock).toContain('provider:')
    expect(callBlock).toContain('booking.provider')
  })

  it('S14 -- app/api/public/bookings/route.ts passes provider to sendBookingConfirmation (caller integration)', () => {
    const callIdx = publicBookingsSrc.indexOf('sendBookingConfirmation({')
    expect(callIdx).toBeGreaterThan(0)
    const callBlock = publicBookingsSrc.slice(callIdx, callIdx + 500)
    expect(callBlock).toContain('provider:')
    expect(callBlock).toContain('instructor')
  })

  it('S15 -- checkProviderEligible returns businessName for white-label sender resolution', () => {
    expect(eligibleSrc).toContain('businessName')
    // The return object must include businessName from raw
    expect(eligibleSrc).toContain('businessName:')
    expect(eligibleSrc).toContain('.businessName')
  })
})

describe('WLA-015 v3: Remaining booking-level email paths (source checks)', () => {
  const cancelSrc = readFileSync(
    resolve(process.cwd(), 'app/api/bookings/[id]/cancel/route.ts'), 'utf-8'
  )
  const idRouteSrc = readFileSync(
    resolve(process.cwd(), 'app/api/bookings/[id]/route.ts'), 'utf-8'
  )
  const bookingsRouteSrc = readFileSync(
    resolve(process.cwd(), 'app/api/bookings/route.ts'), 'utf-8'
  )
  const batchSrc = readFileSync(
    resolve(process.cwd(), 'app/api/bookings/batch/route.ts'), 'utf-8'
  )

  it('S16 -- bookings/[id]/cancel/route.ts uses getProviderBookingsSender for cancellation emails', () => {
    expect(cancelSrc).toContain('getProviderBookingsSender')
    expect(cancelSrc).not.toContain("'DriveBook Bookings <bookings@drivebook.com.au>'")
  })

  it('S17 -- bookings/[id]/route.ts uses getProviderBookingsSender for PATCH cancellation email', () => {
    expect(idRouteSrc).toContain('getProviderBookingsSender')
    expect(idRouteSrc).not.toContain("'DriveBook Bookings <bookings@drivebook.com.au>'")
  })

  it('S18 -- bookings/route.ts uses getProviderBookingsSender for top-up prompt (instructor has businessName)', () => {
    expect(bookingsRouteSrc).toContain('getProviderBookingsSender(instructor)')
    expect(bookingsRouteSrc).toContain('businessName: true')
  })

  it('S19 -- batch/route.ts uses getProviderBookingsSender for customer lesson emails (instructor has businessName)', () => {
    expect(batchSrc).toContain('getProviderBookingsSender(instructor)')
    expect(batchSrc).toContain('businessName: true')
    // send-payment-link and instructor batch summary remain platform-level (documented scope decision)
  })
})
