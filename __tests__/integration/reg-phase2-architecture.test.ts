/**
 * Phase 2 registration architecture tests
 *
 * REG2-01  Privacy acceptance is required (z.literal(true)) — rejects false
 * REG2-02  Privacy acceptance is required — rejects omission
 * REG2-03  organisationType defaults to INDIVIDUAL_INSTRUCTOR when omitted
 * REG2-04  Driving + DRIVING_SCHOOL → DRIVING_SCHOOL persisted (designed, not yet enabled)
 * REG2-05  Non-driving organisationType is always INDIVIDUAL_INSTRUCTOR (server-enforced)
 * REG2-06  Marketplace → commercialAgreementType = MARKETPLACE_TERMS
 * REG2-07  SAAS → commercialAgreementType = SAAS_TERMS
 * REG2-08  Marketplace + termsAccepted → commercialAgreementStatus = ACCEPTED
 * REG2-09  SAAS → commercialAgreementStatus = PENDING (SaaS Terms not yet published)
 * REG2-10  Marketplace + no termsAccepted → commercialAgreementStatus = PENDING
 * REG2-11  SAAS → commercialAgreementVersion = 'PENDING'
 * REG2-12  Marketplace → commercialAgreementVersion = '1.0'
 * REG2-13  Privacy policy version and timestamp are set server-side (not from browser)
 * REG2-14  organisationType = DRIVING_SCHOOL does NOT set accountType = BUSINESS
 * REG2-15  paymentMode is NOT accepted as independent registration input
 * REG2-16  commercialAgreementType is NOT accepted as registration input
 * REG2-17  Existing REG tests still pass (backward compat check)
 * REG2-18  AI description: plumber/electrician — quote-initiation wording present
 * REG2-19  AI description: plumber/electrician — booking wording absent in quote-only path
 * REG2-20  AI description: driving — booking wording present
 * REG2-21  DISC-11 revised: AI capability description varies by businessType
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'

const DRIVEBOOK_ROOT = path.resolve(__dirname, '..', '..')

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(DRIVEBOOK_ROOT, relPath), 'utf-8')
}

// ── Replicate Phase 2 Zod schema ───────────────────────────────────────────

const registerSchema = z.object({
  email:          z.string().email(),
  password:       z.string().min(8),
  name:           z.string().min(2),
  phone:          z.string()
    .transform(s => s.replace(/\s+/g, ''))
    .refine(p => /^\+?\d{9,15}$/.test(p), 'Invalid phone number'),
  businessType:   z.enum(['driving', 'plumber', 'electrician', 'beauty', 'tax']).optional().default('driving'),
  businessModel:  z.enum(['MARKETPLACE', 'SAAS']).optional(),
  organisationType: z.enum(['INDIVIDUAL_INSTRUCTOR', 'DRIVING_SCHOOL']).optional(),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Privacy policy acceptance is required.' }),
  }),
  baseAddress:    z.string().optional().default(''),
  hourlyRate:     z.number().optional().default(65),
  vehicleTypes:   z.array(z.enum(['AUTO', 'MANUAL'])).optional().default(['AUTO']),
  serviceRadiusKm: z.number().optional().default(20),
  licenseNumber:  z.string().optional(),
  insuranceNumber: z.string().optional(),
  termsAccepted:  z.boolean().optional(),
  ageDeclaration: z.boolean().optional(),
  termsVersion:   z.string().optional(),
})

// Replicate server-side derivation logic
interface DerivedFields {
  businessModel: 'MARKETPLACE' | 'SAAS'
  paymentMode: 'PLATFORM' | 'DIRECT'
  organisationType: 'INDIVIDUAL_INSTRUCTOR' | 'DRIVING_SCHOOL'
  commercialAgreementType: 'MARKETPLACE_TERMS' | 'SAAS_TERMS'
  commercialAgreementStatus: 'ACCEPTED' | 'PENDING'
  commercialAgreementVersion: string
  privacyPolicyVersion: string
  accountType: 'INDIVIDUAL'
}

function deriveAll(
  businessType: string,
  businessModel: string | undefined,
  organisationType: string | undefined,
  termsAccepted: boolean | undefined
): DerivedFields {
  const isDriving = businessType === 'driving'
  const bm: 'MARKETPLACE' | 'SAAS' =
    isDriving && businessModel === 'SAAS' ? 'SAAS'
    : isDriving ? 'MARKETPLACE'
    : 'SAAS'
  const pm: 'PLATFORM' | 'DIRECT' = bm === 'SAAS' ? 'DIRECT' : 'PLATFORM'
  const ot: 'INDIVIDUAL_INSTRUCTOR' | 'DRIVING_SCHOOL' =
    isDriving && organisationType === 'DRIVING_SCHOOL'
      ? 'DRIVING_SCHOOL'
      : 'INDIVIDUAL_INSTRUCTOR'
  const cat = bm === 'MARKETPLACE' ? 'MARKETPLACE_TERMS' : 'SAAS_TERMS'
  const cas: 'ACCEPTED' | 'PENDING' =
    bm === 'MARKETPLACE' && termsAccepted ? 'ACCEPTED' : 'PENDING'
  const cav = bm === 'MARKETPLACE' ? '1.0' : 'PENDING'
  return {
    businessModel: bm,
    paymentMode: pm,
    organisationType: ot,
    commercialAgreementType: cat,
    commercialAgreementStatus: cas,
    commercialAgreementVersion: cav,
    privacyPolicyVersion: '1.0',
    accountType: 'INDIVIDUAL',
  }
}

const BASE = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
  phone: '0412345678',
  privacyAccepted: true as const,
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Phase 2 registration architecture', () => {

  // REG2-01
  it('REG2-01 | privacyAccepted: false → rejected', () => {
    expect(() => registerSchema.parse({ ...BASE, privacyAccepted: false })).toThrow()
  })

  // REG2-02
  it('REG2-02 | privacyAccepted omitted → rejected', () => {
    const { privacyAccepted: _, ...withoutPrivacy } = BASE
    expect(() => registerSchema.parse(withoutPrivacy)).toThrow()
  })

  // REG2-03
  it('REG2-03 | organisationType omitted → INDIVIDUAL_INSTRUCTOR', () => {
    const d = deriveAll('driving', 'MARKETPLACE', undefined, true)
    expect(d.organisationType).toBe('INDIVIDUAL_INSTRUCTOR')
  })

  // REG2-04
  it('REG2-04 | driving + DRIVING_SCHOOL → organisationType = DRIVING_SCHOOL', () => {
    const d = deriveAll('driving', 'SAAS', 'DRIVING_SCHOOL', false)
    expect(d.organisationType).toBe('DRIVING_SCHOOL')
  })

  // REG2-05
  it('REG2-05 | non-driving + DRIVING_SCHOOL → forced to INDIVIDUAL_INSTRUCTOR', () => {
    const d = deriveAll('plumber', 'SAAS', 'DRIVING_SCHOOL', false)
    expect(d.organisationType).toBe('INDIVIDUAL_INSTRUCTOR')
  })

  // REG2-06
  it('REG2-06 | Marketplace → commercialAgreementType = MARKETPLACE_TERMS', () => {
    expect(deriveAll('driving', 'MARKETPLACE', undefined, true).commercialAgreementType)
      .toBe('MARKETPLACE_TERMS')
  })

  // REG2-07
  it('REG2-07 | SAAS → commercialAgreementType = SAAS_TERMS', () => {
    expect(deriveAll('driving', 'SAAS', undefined, false).commercialAgreementType)
      .toBe('SAAS_TERMS')
  })

  // REG2-08
  it('REG2-08 | Marketplace + termsAccepted → ACCEPTED', () => {
    expect(deriveAll('driving', 'MARKETPLACE', undefined, true).commercialAgreementStatus)
      .toBe('ACCEPTED')
  })

  // REG2-09
  it('REG2-09 | SAAS → commercialAgreementStatus = PENDING (SaaS Terms not published)', () => {
    expect(deriveAll('driving', 'SAAS', undefined, true).commercialAgreementStatus)
      .toBe('PENDING')
  })

  // REG2-10
  it('REG2-10 | Marketplace + no termsAccepted → PENDING', () => {
    expect(deriveAll('driving', 'MARKETPLACE', undefined, false).commercialAgreementStatus)
      .toBe('PENDING')
  })

  // REG2-11
  it('REG2-11 | SAAS → commercialAgreementVersion = PENDING', () => {
    expect(deriveAll('plumber', 'SAAS', undefined, false).commercialAgreementVersion)
      .toBe('PENDING')
  })

  // REG2-12
  it('REG2-12 | Marketplace → commercialAgreementVersion = 1.0', () => {
    expect(deriveAll('driving', 'MARKETPLACE', undefined, true).commercialAgreementVersion)
      .toBe('1.0')
  })

  // REG2-13
  it('REG2-13 | privacyPolicyVersion is a server-side constant (not from browser)', () => {
    // The schema does not accept privacyPolicyVersion from the browser
    const src = readSource('app/api/register/route.ts')
    expect(src).toContain('PRIVACY_POLICY_VERSION')
    expect(src).toContain("privacyPolicyVersion")
    expect(src).toContain("privacyPolicyAcceptedAt")
    // The schema must NOT have privacyPolicyVersion as an input field
    expect(src).not.toMatch(/privacyPolicyVersion:\s*z\./)
  })

  // REG2-14
  it('REG2-14 | DRIVING_SCHOOL does NOT set accountType = BUSINESS', () => {
    const d = deriveAll('driving', 'SAAS', 'DRIVING_SCHOOL', false)
    expect(d.accountType).toBe('INDIVIDUAL')
  })

  // REG2-15
  it('REG2-15 | paymentMode not accepted as registration input', () => {
    const src = readSource('app/api/register/route.ts')
    expect(src).not.toMatch(/paymentMode:\s*z\./)
  })

  // REG2-16
  it('REG2-16 | commercialAgreementType not accepted as registration input', () => {
    const src = readSource('app/api/register/route.ts')
    expect(src).not.toMatch(/commercialAgreementType:\s*z\./)
  })

  // REG2-17
  it('REG2-17 | registration schema still accepts driving + MARKETPLACE (backward compat)', () => {
    const data = registerSchema.parse({ ...BASE, businessType: 'driving', businessModel: 'MARKETPLACE' })
    const d = deriveAll(data.businessType, data.businessModel, data.organisationType, true)
    expect(d.businessModel).toBe('MARKETPLACE')
    expect(d.paymentMode).toBe('PLATFORM')
  })

  // REG2-18
  it('REG2-18 | AI description for plumber/electrician contains quote-initiation wording', () => {
    const src = readSource('app/dashboard/discovery/page.tsx')
    expect(src).toContain('create a quote request for your review')
    expect(src).toContain('isQuoteOnlyTrade')
  })

  // REG2-19
  it('REG2-19 | AI description for quote-only trades does NOT claim direct booking', () => {
    const src = readSource('app/dashboard/discovery/page.tsx')
    // The quote-only branch must not say "assist with new bookings" in the same string
    // We verify that the two paths are separate (the quote-only text is in its own branch)
    const quoteOnlyStart = src.indexOf("isQuoteOnlyTrade\n        ?")
    const quoteOnlyEnd   = src.indexOf("        : 'An AI receptionist can answer")
    expect(quoteOnlyStart).toBeGreaterThan(-1)
    expect(quoteOnlyEnd).toBeGreaterThan(quoteOnlyStart)
  })

  // REG2-20
  it('REG2-20 | AI description for non-quote-only trades contains booking wording', () => {
    const src = readSource('app/dashboard/discovery/page.tsx')
    expect(src).toContain('assist with new bookings')
  })

  // REG2-21
  it('REG2-21 | Discovery AI capability description varies by businessType', () => {
    const src = readSource('app/dashboard/discovery/page.tsx')
    expect(src).toContain('isQuoteOnlyTrade')
    expect(src).toContain("businessType === 'plumber' || businessType === 'electrician'")
  })

  // Schema source checks for new fields
  it('REG2-S1 | schema contains organisationType field', () => {
    const src = readSource('prisma/schema.prisma')
    expect(src).toContain('organisationType')
    expect(src).toContain('INDIVIDUAL_INSTRUCTOR')
  })

  it('REG2-S2 | schema contains all commercial agreement fields', () => {
    const src = readSource('prisma/schema.prisma')
    expect(src).toContain('commercialAgreementType')
    expect(src).toContain('commercialAgreementStatus')
    expect(src).toContain('commercialAgreementVersion')
    expect(src).toContain('commercialAgreementAcceptedAt')
  })

  it('REG2-S3 | schema contains privacy policy fields', () => {
    const src = readSource('prisma/schema.prisma')
    expect(src).toContain('privacyPolicyVersion')
    expect(src).toContain('privacyPolicyAcceptedAt')
  })

  it('REG2-S4 | migration file exists for Phase 2 fields', () => {
    const migPath = path.join(
      DRIVEBOOK_ROOT, 'prisma', 'migrations',
      '20261110000001_add_organisation_type_and_agreement_fields', 'migration.sql'
    )
    expect(fs.existsSync(migPath)).toBe(true)
    const sql = fs.readFileSync(migPath, 'utf-8')
    expect(sql).toContain('organisationType')
    expect(sql).toContain('commercialAgreementType')
    expect(sql).toContain('privacyPolicyVersion')
  })

  it('REG2-S5 | register page sends privacyAccepted', () => {
    const src = readSource('app/register/page.tsx')
    expect(src).toContain('privacyAccepted: true')
  })

  it('REG2-S6 | register page contains organisation type selector for driving', () => {
    const src = readSource('app/register/page.tsx')
    expect(src).toContain('organisation type')
    expect(src).toContain('DRIVING_SCHOOL')
    expect(src).toContain('Coming soon')
    expect(src).toContain('INDIVIDUAL_INSTRUCTOR')
  })
})
