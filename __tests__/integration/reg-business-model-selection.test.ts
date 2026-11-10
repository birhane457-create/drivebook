/**
 * Regression tests: Driving-instructor business-model selection during registration.
 *
 * Covers:
 *   REG-01  Driving + MARKETPLACE → MARKETPLACE + PLATFORM
 *   REG-02  Driving + SAAS → SAAS + DIRECT
 *   REG-03  Driving + omitted businessModel → MARKETPLACE + PLATFORM (backward compat)
 *   REG-04  Non-driving (plumber) + MARKETPLACE in request → still SAAS + DIRECT (forced)
 *   REG-05  Non-driving + omitted → SAAS + DIRECT (always)
 *   REG-06  Driving + invalid businessModel value → rejected by Zod (400)
 *   REG-07  Invalid businessType → rejected by Zod (400)
 *   REG-08  503 guard still present in bulk-booking route source
 *   REG-09  503 guard still present in create-intent route source
 *   REG-10  503 guard still present in quotes accept route source
 *   REG-11  getAccountFeatures().directPayments is still false
 *   REG-12  Registration API does not accept paymentMode as an independent field
 *
 * These tests validate the server-side derivation logic and guard invariants.
 * They do not execute the real API server — they test the schema, the
 * derivation logic, and the source-code presence of the 503 guards.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'

// ── Replicate the registration schema from the route ──────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  phone: z.string()
    .transform(s => s.replace(/\s+/g, ''))
    .refine(p => /^\+?\d{9,15}$/.test(p), 'Invalid phone number'),
  businessType: z.enum(['driving', 'plumber', 'electrician', 'beauty', 'tax']).optional().default('driving'),
  businessModel: z.enum(['MARKETPLACE', 'SAAS']).optional(),
  baseAddress: z.string().optional().default(''),
  hourlyRate: z.number().optional().default(65),
  vehicleTypes: z.array(z.enum(['AUTO', 'MANUAL'])).optional().default(['AUTO']),
  serviceRadiusKm: z.number().optional().default(20),
  licenseNumber: z.string().optional(),
  insuranceNumber: z.string().optional(),
  termsAccepted: z.boolean().optional(),
  ageDeclaration: z.boolean().optional(),
  termsVersion: z.string().optional(),
})

// Replicate the derivation logic from the registration route
function deriveModelAndPayment(businessType: string, businessModel?: string) {
  const isDriving = businessType === 'driving'
  const resolvedBusinessModel: 'MARKETPLACE' | 'SAAS' =
    isDriving && businessModel === 'SAAS' ? 'SAAS'
    : isDriving ? 'MARKETPLACE'
    : 'SAAS'
  const paymentMode: 'PLATFORM' | 'DIRECT' =
    resolvedBusinessModel === 'SAAS' ? 'DIRECT' : 'PLATFORM'
  return { businessModel: resolvedBusinessModel, paymentMode }
}

// ── Helpers ───────────────────────────────────────────────────────────────

const DRIVEBOOK_ROOT = path.resolve(__dirname, '..', '..')

function readRouteSource(relPath: string): string {
  return fs.readFileSync(path.join(DRIVEBOOK_ROOT, relPath), 'utf-8')
}

const VALID_BODY = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
  phone: '0412345678',
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Registration business-model selection', () => {

  // REG-01: Driving + MARKETPLACE
  it('REG-01 | driving + MARKETPLACE → MARKETPLACE + PLATFORM', () => {
    const data = registerSchema.parse({ ...VALID_BODY, businessType: 'driving', businessModel: 'MARKETPLACE' })
    const result = deriveModelAndPayment(data.businessType, data.businessModel)
    expect(result.businessModel).toBe('MARKETPLACE')
    expect(result.paymentMode).toBe('PLATFORM')
  })

  // REG-02: Driving + SAAS
  it('REG-02 | driving + SAAS → SAAS + DIRECT', () => {
    const data = registerSchema.parse({ ...VALID_BODY, businessType: 'driving', businessModel: 'SAAS' })
    const result = deriveModelAndPayment(data.businessType, data.businessModel)
    expect(result.businessModel).toBe('SAAS')
    expect(result.paymentMode).toBe('DIRECT')
  })

  // REG-03: Driving + omitted → MARKETPLACE (backward compatible)
  it('REG-03 | driving + omitted businessModel → MARKETPLACE + PLATFORM', () => {
    const data = registerSchema.parse({ ...VALID_BODY, businessType: 'driving' })
    const result = deriveModelAndPayment(data.businessType, data.businessModel)
    expect(result.businessModel).toBe('MARKETPLACE')
    expect(result.paymentMode).toBe('PLATFORM')
  })

  // REG-04: Non-driving + MARKETPLACE in request → forced to SAAS
  it('REG-04 | non-driving + MARKETPLACE in request → still SAAS + DIRECT (forced)', () => {
    const data = registerSchema.parse({ ...VALID_BODY, businessType: 'plumber', businessModel: 'MARKETPLACE' })
    const result = deriveModelAndPayment(data.businessType, data.businessModel)
    expect(result.businessModel).toBe('SAAS')
    expect(result.paymentMode).toBe('DIRECT')
  })

  // REG-05: Non-driving + omitted → SAAS + DIRECT
  it('REG-05 | non-driving + omitted → SAAS + DIRECT', () => {
    const data = registerSchema.parse({ ...VALID_BODY, businessType: 'electrician' })
    const result = deriveModelAndPayment(data.businessType, data.businessModel)
    expect(result.businessModel).toBe('SAAS')
    expect(result.paymentMode).toBe('DIRECT')
  })

  // REG-06: Driving + invalid businessModel → Zod rejects
  it('REG-06 | driving + invalid businessModel → rejected by Zod', () => {
    expect(() =>
      registerSchema.parse({ ...VALID_BODY, businessType: 'driving', businessModel: 'INVALID' })
    ).toThrow()
  })

  // REG-07: Invalid businessType → Zod rejects
  it('REG-07 | invalid businessType → rejected by Zod', () => {
    expect(() =>
      registerSchema.parse({ ...VALID_BODY, businessType: 'astronaut' })
    ).toThrow()
  })

  // REG-08: 503 guard still present in bulk-booking route
  it('REG-08 | 503 guard present in bulk-booking route source', () => {
    const src = readRouteSource('app/api/public/bookings/bulk/route.ts')
    expect(src).toContain("paymentMode === 'DIRECT'")
    expect(src).toContain('503')
    expect(src).toContain('PAYMENT_MODE_NOT_IMPLEMENTED')
  })

  // REG-09: 503 guard still present in create-intent route
  it('REG-09 | 503 guard present in create-intent route source', () => {
    const src = readRouteSource('app/api/payments/create-intent/route.ts')
    expect(src).toContain("paymentMode === 'DIRECT'")
    expect(src).toContain('503')
    expect(src).toContain('PAYMENT_MODE_NOT_IMPLEMENTED')
  })

  // REG-10: 503 guard still present in quotes accept route
  it('REG-10 | 503 guard present in quotes accept route source', () => {
    const src = readRouteSource(path.join('app', 'api', 'client', 'quotes', '[id]', 'accept', 'route.ts'))
    expect(src).toContain("paymentMode === 'DIRECT'")
    expect(src).toContain('503')
    expect(src).toContain('PAYMENT_MODE_NOT_IMPLEMENTED')
  })

  // REG-11: getAccountFeatures().directPayments is still false
  it('REG-11 | getAccountFeatures().directPayments is still false', () => {
    const src = readRouteSource('lib/utils/account.ts')
    // The directPayments flag should be hardcoded to false
    expect(src).toContain('directPayments: false')
    // Should NOT contain directPayments: true or directPayments: isPremium
    expect(src).not.toContain('directPayments: true')
    expect(src).not.toContain('directPayments: isPremium')
  })

  // REG-12: Registration schema does not accept paymentMode as input
  it('REG-12 | registration schema does not accept paymentMode field', () => {
    // If paymentMode were in the schema, parsing would succeed. Since it's not,
    // Zod with .strict() would reject it, but without .strict() extra keys are
    // silently stripped. We verify the schema definition does not include paymentMode.
    const src = readRouteSource('app/api/register/route.ts')
    // The schema should not contain paymentMode as a field definition
    expect(src).not.toMatch(/paymentMode:\s*z\./)
    // But it should contain businessModel as a field
    expect(src).toMatch(/businessModel:\s*z\.enum/)
  })
})
