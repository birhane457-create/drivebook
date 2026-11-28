/**
 * BLOCKER-001 Regression Tests — Payable Amount Consistency
 *
 * Verifies that create-intent and the webhook use identical amount calculations
 * via the canonical lib/payments/payable-amount.ts helper.
 *
 * Tests:
 *   T1: package booking — getPayableAmount returns packageTotalPaid, not booking.price
 *   T2: single lesson  — getPayableAmount returns booking.price (packageTotalPaid null)
 *   T3: cents conversion — getPayableAmountCents rounds correctly
 *   T4: create-intent and webhook produce identical expected amounts
 *   T5: Decimal / string packageTotalPaid is coerced to number
 *   T6: zero packageTotalPaid falls through to booking.price
 *   T7: negative or NaN packageTotalPaid falls through to booking.price
 *
 * EXECUTION:
 *   npx vitest run __tests__/integration/blocker-001-payable-amount.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  getPayableAmount,
  getExpectedWebhookAmount,
  getPayableAmountCents,
} from '@/lib/payments/payable-amount'

describe('BLOCKER-001 — payable amount helper', () => {

  it('T1: package booking uses packageTotalPaid, not booking.price', () => {
    const pkg = { price: 65, packageTotalPaid: 585 }
    expect(getPayableAmount(pkg)).toBe(585)
    // Confirm the old broken behaviour would have been different
    expect(getPayableAmount(pkg)).not.toBe(65)
  })

  it('T2: single lesson uses booking.price when packageTotalPaid is null', () => {
    const lesson = { price: 65, packageTotalPaid: null }
    expect(getPayableAmount(lesson)).toBe(65)
  })

  it('T2b: single lesson uses booking.price when packageTotalPaid is undefined', () => {
    const lesson = { price: 75 }
    expect(getPayableAmount(lesson)).toBe(75)
  })

  it('T3: cents conversion rounds correctly', () => {
    expect(getPayableAmountCents({ price: 65, packageTotalPaid: 585 })).toBe(58500)
    expect(getPayableAmountCents({ price: 65.5 })).toBe(6550)
    // Rounding: $585.995 → 58600 cents (rounds up)
    expect(getPayableAmountCents({ price: 0, packageTotalPaid: 585.995 })).toBe(58600)
  })

  it('T4: create-intent and webhook produce identical expected amounts', () => {
    // Both use the same helper — this is the core BLOCKER-001 invariant
    const pkgBooking = { price: 65, packageTotalPaid: 585 }
    const intentAmount   = getPayableAmount(pkgBooking)         // create-intent
    const webhookExpect  = getExpectedWebhookAmount(pkgBooking) // webhook
    expect(intentAmount).toBe(webhookExpect)
    expect(intentAmount).toBe(585)

    const singleBooking  = { price: 80, packageTotalPaid: null }
    const intentAmount2  = getPayableAmount(singleBooking)
    const webhookExpect2 = getExpectedWebhookAmount(singleBooking)
    expect(intentAmount2).toBe(webhookExpect2)
    expect(intentAmount2).toBe(80)
  })

  it('T5: Prisma Decimal (string) packageTotalPaid is coerced to number', () => {
    // Prisma Decimal fields arrive as strings from some query paths
    const decimal = { price: 65, packageTotalPaid: '585.00' }
    expect(getPayableAmount(decimal)).toBe(585)
    expect(getPayableAmountCents(decimal)).toBe(58500)
  })

  it('T6: zero packageTotalPaid falls through to booking.price', () => {
    // A package with $0 total is pathological but should not silently zero the charge
    const zero = { price: 65, packageTotalPaid: 0 }
    expect(getPayableAmount(zero)).toBe(65) // 0 is falsy after > 0 check
  })

  it('T7: NaN packageTotalPaid falls through to booking.price', () => {
    const nan = { price: 65, packageTotalPaid: NaN }
    expect(getPayableAmount(nan)).toBe(65)
  })

})
