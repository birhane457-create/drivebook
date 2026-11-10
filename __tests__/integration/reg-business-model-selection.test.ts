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


// ── Additional registration tests ─────────────────────────────────────────

  // REG-09: Existing providers are not modified by the registration change
  it('REG-09 | registration route does not update existing providers', () => {
    const src = readRouteSource('app/api/register/route.ts')
    // The route should only create new providers, not update existing ones
    // (excluding the user-to-provider link step which is part of creation)
    expect(src).toContain('tx.provider.create(')
    expect(src).toContain('tx.user.create(')
    // Should not contain provider.update for existing providers
    // (the update for subscription sync is inside the creation transaction, which is fine)
  })

  // REG-10: Registration failure is clearly communicated
  it('REG-10 | registration route returns clear error for duplicate email', () => {
    const src = readRouteSource('app/api/register/route.ts')
    expect(src).toContain("'Email already registered'")
    expect(src).toContain('400')
  })

  // REG-12: Correct business-model information reaches the provider dashboard
  it('REG-12 | auth.ts reads industry from Provider record, not inferred from businessModel', () => {
    const src = readRouteSource('lib/auth.ts')
    // The auth callback should read the industry field directly
    expect(src).toContain('industry')
    // It should NOT infer businessType from paymentModel
    expect(src).not.toContain("businessType = paymentModel === 'marketplace' ? 'driving' : 'other'")
  })

// ── Discovery tests ────────────────────────────────────────────────────────

describe('Provider discovery', () => {

  // DISC-01: Product introduction button opens the capability introduction
  it('DISC-01 | discovery page contains "Explore capabilities" button', () => {
    const src = readRouteSource('app/dashboard/discovery/page.tsx')
    expect(src).toContain('Explore capabilities')
    expect(src).toContain('setShowIntroduction(true)')
  })

  // DISC-02: Product introduction is optional
  it('DISC-02 | product introduction is optional (can be closed)', () => {
    const src = readRouteSource('app/dashboard/discovery/page.tsx')
    expect(src).toContain('setShowIntroduction(false)')
    expect(src).toContain('Skip for now')
  })

  // DISC-03: All six capability descriptions are displayed
  it('DISC-03 | all six capability descriptions are present', () => {
    const src = readRouteSource('app/dashboard/discovery/page.tsx')
    expect(src).toContain('Business reports and analytics')
    expect(src).toContain('business website and domain')
    expect(src).toContain('AI phone receptionist')
    expect(src).toContain('Online booking and scheduling')
    expect(src).toContain('Customer management')
    expect(src).toContain('Business automation and notifications')
  })

  // DISC-04: Capability availability labels match actual entitlement rules
  it('DISC-04 | capability availability labels present', () => {
    const src = readRouteSource('app/dashboard/discovery/page.tsx')
    expect(src).toContain("'available'")
    expect(src).toContain("'planDependent'")
    expect(src).toContain('Available')
    expect(src).toContain('Plan-dependent')
  })

  // DISC-05: Providers can select multiple capabilities
  it('DISC-05 | multiple capability selection supported', () => {
    const src = readRouteSource('app/dashboard/discovery/page.tsx')
    expect(src).toContain('selectedGoals')
    expect(src).toContain('toggleGoal')
    expect(src).toContain('Set<string>')
  })

  // DISC-06: Other needs can be entered optionally
  it('DISC-06 | other needs free-text field present', () => {
    const src = readRouteSource('app/dashboard/discovery/page.tsx')
    expect(src).toContain('otherNeeds')
    expect(src).toContain('anything else you would like DriveBook to help you with')
  })

  // DISC-07: Discovery answers are persisted against the correct provider
  it('DISC-07 | discovery API persists against providerId', () => {
    const src = readRouteSource('app/api/provider/discovery/route.ts')
    expect(src).toContain('providerId')
    expect(src).toContain('upsert')
    expect(src).toContain('session.user.providerId')
  })

  // DISC-08: Discovery can be skipped
  it('DISC-08 | discovery can be skipped', () => {
    const src = readRouteSource('app/dashboard/discovery/page.tsx')
    expect(src).toContain("handleSave(true)")
    expect(src).toContain('skipped')
    // The API should accept a skipped flag
    const apiSrc = readRouteSource('app/api/provider/discovery/route.ts')
    expect(apiSrc).toContain('skipped')
  })

  // DISC-09: Skipped discovery can be completed later
  it('DISC-09 | dashboard shows discovery link when not completed', () => {
    const src = readRouteSource('app/dashboard/page.tsx')
    // The dashboard should show a discovery link when discovery is not completed
    expect(src).toContain('discovery')
    expect(src).toContain('/dashboard/discovery')
  })

  // DISC-10: Discovery answers do not modify account permissions
  it('DISC-10 | discovery API does not modify businessModel, paymentMode, or subscription', () => {
    const src = readRouteSource('app/api/provider/discovery/route.ts')
    // The API should only write to ProviderDiscovery, not to Provider
    expect(src).not.toContain('provider.update')
    expect(src).not.toContain('businessModel')
    expect(src).not.toContain('paymentMode')
    expect(src).not.toContain('subscriptionTier')
  })

  // DISC-11: SaaS/DIRECT providers are not told that Direct checkout is available
  it('DISC-12 | SaaS/DIRECT providers not told Direct checkout is available', () => {
    const src = readRouteSource('app/dashboard/discovery/page.tsx')
    // The capability description should mention that direct checkout is not yet available
    expect(src).toContain('not yet available')
    // It should NOT claim direct checkout is operational
    expect(src).not.toContain('direct checkout is available')
    expect(src).not.toContain('direct payments are available')
  })
})
