/**
 * PB-UI-01 / PB-UI-02 / PB-UI-04 — Targeted copy-correction tests
 *
 * These tests verify that the approved legal-term wording is present in every
 * file listed in the audit master tracker, and that the old contradictory copy
 * is absent.  Each test WILL FAIL if the fix is reverted.
 *
 * Scope: copy-only assertions — no DB, no HTTP, no Stripe.
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

// ---------------------------------------------------------------------------
// PB-UI-01 — "Credits never expire" → inactivity-based wording
// ---------------------------------------------------------------------------

describe('PB-UI-01 — credits-never-expire copy removed', () => {
  const OLD = 'Credits never expire'
  const NEW = '12 months from last'   // matches both "last account activity" and "last activity"

  test('BulkBookingForm.tsx: old copy absent', () => {
    expect(read('components/BulkBookingForm.tsx')).not.toContain(OLD)
  })
  test('BulkBookingForm.tsx: new copy present', () => {
    expect(read('components/BulkBookingForm.tsx')).toContain(NEW)
  })

  test('add-funds/page.tsx: old copy absent', () => {
    expect(read('app/dashboard/credits/add-funds/page.tsx')).not.toContain(OLD)
  })
  test('add-funds/page.tsx: new copy present', () => {
    expect(read('app/dashboard/credits/add-funds/page.tsx')).toContain(NEW)
  })

  test('receipt-email.ts: old copy absent (wallet top-up receipt)', () => {
    expect(read('lib/services/receipt-email.ts')).not.toContain(OLD)
  })
  test('receipt-email.ts: new copy present', () => {
    expect(read('lib/services/receipt-email.ts')).toContain(NEW)
  })

  test('ReceiptD_WalletTopUp.tsx: old copy absent', () => {
    expect(read('components/invoice/receipts/ReceiptD_WalletTopUp.tsx')).not.toContain(OLD)
  })
  test('ReceiptD_WalletTopUp.tsx: new copy present', () => {
    expect(read('components/invoice/receipts/ReceiptD_WalletTopUp.tsx')).toContain(NEW)
  })

  test('ReceiptF_AdminCredit.tsx: old copy absent', () => {
    expect(read('components/invoice/receipts/ReceiptF_AdminCredit.tsx')).not.toContain(OLD)
  })
  test('ReceiptF_AdminCredit.tsx: new copy present', () => {
    expect(read('components/invoice/receipts/ReceiptF_AdminCredit.tsx')).toContain(NEW)
  })
})

// ---------------------------------------------------------------------------
// PB-UI-02 — "12 months from purchase" → "last account activity"
// ---------------------------------------------------------------------------

describe('PB-UI-02 — 12-months-from-purchase copy removed', () => {
  const OLD_PURCHASE = '12 months from purchase'
  const OLD_PURCHASE_DATE = '12 months from purchase date'
  const NEW = '12 months from last'

  test('BookNowOrLater.tsx: old copy absent', () => {
    const src = read('components/BookNowOrLater.tsx')
    expect(src).not.toContain(OLD_PURCHASE)
    expect(src).not.toContain(OLD_PURCHASE_DATE)
  })
  test('BookNowOrLater.tsx: new copy present', () => {
    expect(read('components/BookNowOrLater.tsx')).toContain(NEW)
  })

  test('PackageSelector.tsx: old copy absent', () => {
    const src = read('components/PackageSelector.tsx')
    expect(src).not.toContain(OLD_PURCHASE)
    expect(src).not.toContain(OLD_PURCHASE_DATE)
  })
  test('PackageSelector.tsx: new copy present', () => {
    expect(read('components/PackageSelector.tsx')).toContain(NEW)
  })

  test('packages/page.tsx: old copy absent', () => {
    const src = read('app/lessons/packages/page.tsx')
    expect(src).not.toContain(OLD_PURCHASE)
    expect(src).not.toContain(OLD_PURCHASE_DATE)
  })
  test('packages/page.tsx: new copy present (at least 3 occurrences)', () => {
    const src = read('app/lessons/packages/page.tsx')
    const matches = src.split(NEW).length - 1
    expect(matches).toBeGreaterThanOrEqual(3)
  })

  test('bulk/route.ts Stripe description: old copy absent', () => {
    expect(read('app/api/public/bookings/bulk/route.ts')).not.toContain(OLD_PURCHASE)
  })
  test('bulk/route.ts Stripe description: new copy present', () => {
    expect(read('app/api/public/bookings/bulk/route.ts')).toContain('last account activity')
  })
})

// ---------------------------------------------------------------------------
// PB-UI-04 — fixed hour-count claims removed from notifications and SMS
// ---------------------------------------------------------------------------

describe('PB-UI-04 — hour-count claims removed from notifications and SMS', () => {
  // Pattern that matched the old messages: toFixed(1) used in message template literal
  const OLD_PATTERN_REMAINING = 'packageHoursRemaining?.toFixed'
  const OLD_PATTERN_SMS       = 'lesson hour'   // "lesson hour" or "lesson hours"

  test('packageExpiryAlerts.ts: old hour-count pattern absent from messages', () => {
    const src = read('lib/jobs/packageExpiryAlerts.ts')
    // The old messages contained the toFixed pattern inside the message string
    // We check that no message literal still contains it
    expect(src).not.toContain(OLD_PATTERN_REMAINING)
  })
  test('packageExpiryAlerts.ts: all four messages mention wallet credit', () => {
    const src = read('lib/jobs/packageExpiryAlerts.ts')
    const walletMatches = src.split('wallet credit').length - 1
    expect(walletMatches).toBeGreaterThanOrEqual(4)
  })

  test('remind-client/route.ts: old SMS hour-count pattern absent', () => {
    // The old message contained "lesson hour" as a literal in the template
    const src = read('app/api/instructor/remind-client/route.ts')
    // Extract only the message template literal lines for targeted assertion
    const messageLines = src.split('\n').filter(l => l.includes('const message =') || (l.includes('`Hi') && l.includes('drivebook.com.au`')))
    const joined = messageLines.join('\n')
    expect(joined).not.toContain('lesson hour')
  })
  test('remind-client/route.ts: positive copy references wallet credit', () => {
    const src = read('app/api/instructor/remind-client/route.ts')
    expect(src).toContain('wallet credit available in your package')
  })

  // PB-UI-04 scope note: dollar balance display requires a new DB query (out of
  // approved copy-only scope). Messages correctly reference "wallet credit" and
  // remove fixed hour counts.  Full dollar-balance display is tracked as a
  // follow-up requiring H-02 resolution per PB-UI-03.
})
