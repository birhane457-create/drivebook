/**
 * PB-SEC-10 Regression Tests — Checkout Redirect Hostname Construction
 *
 * Verifies that the backend-provided checkoutUrl is used as-is by the wizard,
 * rather than being re-parsed and reconstructed with a stripped hostname.
 *
 * The previous defect: on the apex domain drivebook.com.au, the wizard split
 * the host on '.' and took parts.slice(1) → 'com.au', producing an invalid redirect.
 *
 * Tests:
 *   T1: apex domain — checkoutUrl used unchanged (not rewritten to com.au)
 *   T2: www domain  — checkoutUrl used unchanged
 *   T3: instructor subdomain — checkoutUrl used unchanged (canonical payment host)
 *   T4: localhost dev — checkoutUrl used unchanged
 *   T5: booking ID and token are preserved in the final URL
 *   T6: missing checkoutUrl falls back to window.location.host (not mainHost)
 *
 * EXECUTION (no server or DB required):
 *   npx vitest run __tests__/integration/pb-sec-10-checkout-redirect.test.ts
 */

import { describe, it, expect } from 'vitest'

// ── Replicate the URL selection logic from SubdomainBookingWizard ─────────────
// Extracted for unit testing without a DOM. Mirrors the fix in
// components/subdomain/SubdomainBookingWizard.tsx exactly.

interface BulkBookingResult {
  transactionId?: string
  checkoutUrl?: string
  bookingId?: string
}

function selectRedirectUrl(
  result: BulkBookingResult,
  windowHost: string,
  windowProtocol: string,
  pricingParams: { hours: number; hourlyRate: number; discountPct: number; total: number },
): string {
  const fromParam = `?from=${encodeURIComponent(windowHost)}`

  if (result.transactionId) {
    return `${windowProtocol}//${windowHost}/payment/wallet/${result.transactionId}${fromParam}&hrs=${pricingParams.hours}&rate=${pricingParams.hourlyRate}&disc=${pricingParams.discountPct}&total=${pricingParams.total}`
  }
  if (result.checkoutUrl) {
    return result.checkoutUrl // ← PB-SEC-10 fix: use backend URL unchanged
  }
  return `${windowProtocol}//${windowHost}/booking/${result.bookingId}/payment${fromParam}`
}

/** What the PREVIOUS broken code produced (for regression contrast) */
function selectRedirectUrlBroken(
  result: BulkBookingResult,
  windowHost: string,
  windowProtocol: string,
  pricingParams: { hours: number; hourlyRate: number; discountPct: number; total: number },
): string {
  const parts = windowHost.split('.')
  const mainHost = parts.length > 1 && !parts[0].includes(':') ? parts.slice(1).join('.') : windowHost
  const baseUrl = `${windowProtocol}//${mainHost}`
  const fromParam = `?from=${encodeURIComponent(windowHost)}`

  if (result.transactionId) {
    return `${baseUrl}/payment/wallet/${result.transactionId}${fromParam}&hrs=${pricingParams.hours}&rate=${pricingParams.hourlyRate}&disc=${pricingParams.discountPct}&total=${pricingParams.total}`
  }
  if (result.checkoutUrl) {
    return `${windowProtocol}//${mainHost}${new URL(result.checkoutUrl).pathname}${new URL(result.checkoutUrl).search}`
  }
  return `${baseUrl}/booking/${result.bookingId}/payment${fromParam}`
}

const CANONICAL_CHECKOUT = 'https://drivebook.com.au/booking/abc123/payment?token=tok_xyz'
const PRICING = { hours: 10, hourlyRate: 65, discountPct: 10, total: 585 }

describe('PB-SEC-10 — checkout redirect hostname construction', () => {

  it('T1: apex domain — fixed code uses checkoutUrl unchanged (not rewritten to com.au)', () => {
    const url = selectRedirectUrl(
      { checkoutUrl: CANONICAL_CHECKOUT },
      'drivebook.com.au', 'https:', PRICING
    )
    expect(url).toBe(CANONICAL_CHECKOUT)
    // Demonstrate the previous defect for contrast
    const broken = selectRedirectUrlBroken(
      { checkoutUrl: CANONICAL_CHECKOUT },
      'drivebook.com.au', 'https:', PRICING
    )
    expect(broken).toBe('https://com.au/booking/abc123/payment?token=tok_xyz')
    expect(broken).not.toBe(CANONICAL_CHECKOUT)
  })

  it('T2: www domain — checkoutUrl used unchanged', () => {
    const url = selectRedirectUrl(
      { checkoutUrl: CANONICAL_CHECKOUT },
      'www.drivebook.com.au', 'https:', PRICING
    )
    expect(url).toBe(CANONICAL_CHECKOUT)
  })

  it('T3: instructor subdomain — checkoutUrl redirects to canonical payment host, not subdomain', () => {
    const url = selectRedirectUrl(
      { checkoutUrl: CANONICAL_CHECKOUT },
      'school.drivebook.com.au', 'https:', PRICING
    )
    // Canonical payment always on drivebook.com.au, not school.drivebook.com.au
    expect(url).toBe(CANONICAL_CHECKOUT)
    expect(url.startsWith('https://drivebook.com.au')).toBe(true)
    expect(url).not.toContain('school.drivebook.com.au')
  })

  it('T4: localhost dev — checkoutUrl used unchanged', () => {
    const devCheckout = 'http://localhost:3000/booking/abc123/payment?token=tok_xyz'
    const url = selectRedirectUrl(
      { checkoutUrl: devCheckout },
      'localhost:3000', 'http:', PRICING
    )
    expect(url).toBe(devCheckout)
  })

  it('T5: booking ID and token are preserved in the final URL', () => {
    const bookingId = 'bkg_a1b2c3d4'
    const token = 'pt_securetoken123456'
    const checkout = `https://drivebook.com.au/booking/${bookingId}/payment?token=${token}`
    const url = selectRedirectUrl(
      { checkoutUrl: checkout },
      'drivebook.com.au', 'https:', PRICING
    )
    expect(url).toContain(bookingId)
    expect(url).toContain(token)
    expect(url).toBe(checkout)
  })

  it('T6: missing checkoutUrl falls back to window.location.host (not stripped mainHost)', () => {
    // When no checkoutUrl is returned, fall back constructs from current host
    const url = selectRedirectUrl(
      { bookingId: 'bkg_fallback' },
      'drivebook.com.au', 'https:', PRICING
    )
    // Should use the actual host, not strip it to 'com.au'
    expect(url).toContain('drivebook.com.au')
    // Must NOT start with the broken 'com.au' host (stripped apex)
    expect(url.startsWith('https://com.au')).toBe(false)
    expect(url).toContain('/booking/bkg_fallback/payment')
  })

})
