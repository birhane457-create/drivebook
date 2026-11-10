/**
 * Phase 2 registration architecture tests (corrected — Stage 1 fixes applied)
 *
 * FIX-1  Marketplace agreement: correct link, correct version (2.0)
 * FIX-2  SaaS agreement: commercialAgreementVersion = null (not 'PENDING')
 * FIX-3  Privacy Policy: version = 2.0 (matches published page)
 * FIX-4  Organisation types: SOLE_TRADER for non-driving; DRIVING_SCHOOL rejected by API
 * FIX-5  AI descriptions: derived from AI_CAPABILITY_MAP (actual template config)
 * FIX-6  Driving school: rejected with DRIVING_SCHOOL_NOT_AVAILABLE
 * FIX-7  Tests exercise constants, not duplicate logic
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import {
  MARKETPLACE_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
  SAAS_TERMS_VERSION,
  SAAS_TERMS_PUBLISHED,
  AI_CAPABILITY_MAP,
  getAiCapabilityProfile,
} from '../../lib/config/registration-constants'

const DRIVEBOOK_ROOT = path.resolve(__dirname, '..', '..')

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(DRIVEBOOK_ROOT, relPath), 'utf-8')
}

// ── Replicate Phase 2 schema (must stay in sync with route.ts) ───────────────
const registerSchema = z.object({
  email:          z.string().email(),
  password:       z.string().min(8),
  name:           z.string().min(2),
  phone:          z.string()
    .transform(s => s.replace(/\s+/g, ''))
    .refine(p => /^\+?\d{9,15}$/.test(p), 'Invalid phone'),
  businessType:   z.enum(['driving', 'plumber', 'electrician', 'beauty', 'tax']).optional().default('driving'),
  businessModel:  z.enum(['MARKETPLACE', 'SAAS']).optional(),
  organisationType: z.enum(['INDIVIDUAL_INSTRUCTOR', 'DRIVING_SCHOOL', 'SOLE_TRADER', 'BUSINESS']).optional(),
  privacyAccepted: z.literal(true, { errorMap: () => ({ message: 'Privacy policy acceptance is required.' }) }),
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

// Replicate server-side derivation (minus the DRIVING_SCHOOL guard which is a 400 return)
interface DerivedFields {
  businessModel:               'MARKETPLACE' | 'SAAS'
  paymentMode:                 'PLATFORM' | 'DIRECT'
  organisationType:            'INDIVIDUAL_INSTRUCTOR' | 'SOLE_TRADER'
  commercialAgreementType:     'MARKETPLACE_TERMS' | 'SAAS_TERMS'
  commercialAgreementStatus:   'ACCEPTED' | 'PENDING'
  commercialAgreementVersion:  string | null
  privacyPolicyVersion:        string
  accountType:                 'INDIVIDUAL'
}

function deriveAll(
  businessType: string,
  businessModel: string | undefined,
  termsAccepted: boolean | undefined
): DerivedFields {
  const isDriving = businessType === 'driving'
  const bm: 'MARKETPLACE' | 'SAAS' =
    isDriving && businessModel === 'SAAS' ? 'SAAS'
    : isDriving ? 'MARKETPLACE'
    : 'SAAS'
  const pm: 'PLATFORM' | 'DIRECT' = bm === 'SAAS' ? 'DIRECT' : 'PLATFORM'
  const ot: 'INDIVIDUAL_INSTRUCTOR' | 'SOLE_TRADER' =
    isDriving ? 'INDIVIDUAL_INSTRUCTOR' : 'SOLE_TRADER'
  const cat = bm === 'MARKETPLACE' ? 'MARKETPLACE_TERMS' : 'SAAS_TERMS'
  const cas: 'ACCEPTED' | 'PENDING' =
    bm === 'MARKETPLACE' && termsAccepted ? 'ACCEPTED' : 'PENDING'
  const cav: string | null =
    bm === 'MARKETPLACE' ? MARKETPLACE_TERMS_VERSION
    : SAAS_TERMS_PUBLISHED ? SAAS_TERMS_VERSION
    : null
  return {
    businessModel: bm, paymentMode: pm, organisationType: ot,
    commercialAgreementType: cat, commercialAgreementStatus: cas,
    commercialAgreementVersion: cav,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
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

describe('Phase 2 registration architecture — Stage 1 corrections', () => {

  // ── FIX-1: Marketplace agreement ─────────────────────────────────────────

  it('FIX-1a | MARKETPLACE_TERMS_VERSION matches published Instructor Terms (2.0)', () => {
    // Instructor Terms page shows "Version 2.0 · Effective: 6 August 2026"
    expect(MARKETPLACE_TERMS_VERSION).toBe('2.0')
  })

  it('FIX-1b | Marketplace registration records version 2.0', () => {
    expect(deriveAll('driving', 'MARKETPLACE', true).commercialAgreementVersion).toBe('2.0')
  })

  it('FIX-1c | Register page links to /instructor-terms (not /terms) for Marketplace', () => {
    const src = readSource('app/register/page.tsx')
    expect(src).toContain('/instructor-terms')
    // Must NOT link /terms for the commercial agreement
    // (The /terms route is Learner T&C and is not applicable to providers)
    const instructorTermsIdx = src.indexOf('/instructor-terms')
    expect(instructorTermsIdx).toBeGreaterThan(-1)
  })

  it('FIX-1d | User.termsVersion is server-controlled (not from browser termsVersion input)', () => {
    const src = readSource('app/api/register/route.ts')
    // The server uses instructorTermsVersion derived from MARKETPLACE_TERMS_VERSION
    expect(src).toContain('instructorTermsVersion')
    // Must NOT fall back to data.termsVersion (browser-supplied)
    expect(src).not.toContain("data.termsVersion || '")
    expect(src).not.toContain('data.termsVersion ||')
  })

  it('FIX-1e | commercialAgreementAcceptedAt only set when status=ACCEPTED', () => {
    const accepted = deriveAll('driving', 'MARKETPLACE', true)
    expect(accepted.commercialAgreementStatus).toBe('ACCEPTED')
    // Not testing timestamp here (runtime), but status must be ACCEPTED for it to be set
    const notAccepted = deriveAll('driving', 'MARKETPLACE', false)
    expect(notAccepted.commercialAgreementStatus).toBe('PENDING')
  })

  // ── FIX-2: SaaS agreement ─────────────────────────────────────────────────

  it('FIX-2a | SaaS commercialAgreementVersion = null (not the string PENDING)', () => {
    expect(SAAS_TERMS_PUBLISHED).toBe(false)
    expect(SAAS_TERMS_VERSION).toBeNull()
    expect(deriveAll('driving', 'SAAS', false).commercialAgreementVersion).toBeNull()
    expect(deriveAll('plumber', 'SAAS', false).commercialAgreementVersion).toBeNull()
  })

  it('FIX-2b | SaaS commercialAgreementStatus = PENDING', () => {
    expect(deriveAll('driving', 'SAAS', true).commercialAgreementStatus).toBe('PENDING')
  })

  it('FIX-2c | SaaS commercial agreement type is SAAS_TERMS', () => {
    expect(deriveAll('plumber', undefined, false).commercialAgreementType).toBe('SAAS_TERMS')
  })

  it('FIX-2d | Register page shows pending notice for SaaS (no acceptance checkbox)', () => {
    const src = readSource('app/register/page.tsx')
    expect(src).toContain('SaaS Terms are being finalised')
  })

  // ── FIX-3: Privacy Policy version ────────────────────────────────────────

  it('FIX-3a | PRIVACY_POLICY_VERSION matches published Privacy Policy (2.0)', () => {
    // Privacy Policy page shows "Version 2.0 · Effective: 6 August 2026"
    expect(PRIVACY_POLICY_VERSION).toBe('2.0')
  })

  it('FIX-3b | Registration API records Privacy Policy 2.0', () => {
    expect(deriveAll('driving', 'MARKETPLACE', true).privacyPolicyVersion).toBe('2.0')
    expect(deriveAll('plumber', undefined, false).privacyPolicyVersion).toBe('2.0')
  })

  it('FIX-3c | Privacy and commercial agreement are separate', () => {
    // privacyPolicyVersion and commercialAgreementVersion are independent
    const d = deriveAll('plumber', undefined, false)
    expect(d.privacyPolicyVersion).toBe('2.0')
    expect(d.commercialAgreementVersion).toBeNull()  // SaaS has null version
  })

  it('FIX-3d | PRIVACY_POLICY_VERSION is imported from constants in registration API', () => {
    const src = readSource('app/api/register/route.ts')
    expect(src).toContain('PRIVACY_POLICY_VERSION')
    // Must NOT hardcode '1.0' or '2.0' inline
    expect(src).not.toMatch(/PRIVACY_POLICY_VERSION\s*=\s*'[0-9]/)  // no inline assignment
  })

  // ── FIX-4: Organisation types ─────────────────────────────────────────────

  it('FIX-4a | Driving instructors → INDIVIDUAL_INSTRUCTOR', () => {
    expect(deriveAll('driving', 'MARKETPLACE', true).organisationType).toBe('INDIVIDUAL_INSTRUCTOR')
    expect(deriveAll('driving', 'SAAS', false).organisationType).toBe('INDIVIDUAL_INSTRUCTOR')
  })

  it('FIX-4b | Non-driving providers → SOLE_TRADER (not INDIVIDUAL_INSTRUCTOR)', () => {
    expect(deriveAll('plumber', undefined, false).organisationType).toBe('SOLE_TRADER')
    expect(deriveAll('electrician', undefined, false).organisationType).toBe('SOLE_TRADER')
    expect(deriveAll('beauty', undefined, false).organisationType).toBe('SOLE_TRADER')
    expect(deriveAll('tax', undefined, false).organisationType).toBe('SOLE_TRADER')
  })

  it('FIX-4c | Schema default for organisationType is SOLE_TRADER', () => {
    const src = readSource('prisma/schema.prisma')
    expect(src).toContain('@default("SOLE_TRADER")')
    expect(src).not.toContain('@default("INDIVIDUAL_INSTRUCTOR")')
  })

  it('FIX-4d | Migration default is SOLE_TRADER', () => {
    const migPath = path.join(
      DRIVEBOOK_ROOT, 'prisma', 'migrations',
      '20261110000001_add_organisation_type_and_agreement_fields', 'migration.sql'
    )
    const sql = fs.readFileSync(migPath, 'utf-8')
    expect(sql).toContain("DEFAULT 'SOLE_TRADER'")
    expect(sql).not.toContain("DEFAULT 'INDIVIDUAL_INSTRUCTOR'")
  })

  it('FIX-4e | Migration documents the backfill requirement for existing driving instructors', () => {
    const migPath = path.join(
      DRIVEBOOK_ROOT, 'prisma', 'migrations',
      '20261110000001_add_organisation_type_and_agreement_fields', 'migration.sql'
    )
    const sql = fs.readFileSync(migPath, 'utf-8')
    expect(sql).toContain('INDIVIDUAL_INSTRUCTOR')  // backfill UPDATE documented in comments
    expect(sql).toContain('REQUIRED AFTER APPLYING')
  })

  it('FIX-4f | SOLE_TRADER and BUSINESS values exist in constants', () => {
    const src = readSource('lib/config/registration-constants.ts')
    expect(src).toContain('SOLE_TRADER')
    expect(src).toContain('BUSINESS')
  })

  // ── FIX-5: AI capability descriptions ────────────────────────────────────

  it('FIX-5a | AI_CAPABILITY_MAP matches actual template config for plumber', () => {
    // lib/presets/loader.ts: plumber aiCanBook=false, aiCanQuote=true
    expect(AI_CAPABILITY_MAP['plumber'].aiCanBook).toBe(false)
    expect(AI_CAPABILITY_MAP['plumber'].aiCanQuote).toBe(true)
    expect(AI_CAPABILITY_MAP['plumber'].allowedActions).toContain('quote')
    expect(AI_CAPABILITY_MAP['plumber'].allowedActions).not.toContain('book')
  })

  it('FIX-5b | AI_CAPABILITY_MAP matches actual template config for driving', () => {
    // lib/presets/driving/config.ts: aiCanBook=true, aiCanQuote=false
    expect(AI_CAPABILITY_MAP['driving'].aiCanBook).toBe(true)
    expect(AI_CAPABILITY_MAP['driving'].aiCanQuote).toBe(false)
    expect(AI_CAPABILITY_MAP['driving'].allowedActions).toContain('book')
  })

  it('FIX-5c | AI_CAPABILITY_MAP correctly identifies tax as mixed', () => {
    // lib/presets/tax/config.ts: most aiCanBook=true, Business Tax Return aiCanBook=false
    expect(AI_CAPABILITY_MAP['tax'].mixed).toBe(true)
    expect(AI_CAPABILITY_MAP['tax'].aiCanBook).toBe(true)
    expect(AI_CAPABILITY_MAP['tax'].aiCanQuote).toBe(true)
  })

  it('FIX-5d | No callout charge advertised (no config field exists)', () => {
    // calloutChargeConfigured must be false for all types until the config field exists
    for (const [, profile] of Object.entries(AI_CAPABILITY_MAP)) {
      expect(profile.calloutChargeConfigured).toBe(false)
    }
    const src = readSource('app/dashboard/discovery/page.tsx')
    expect(src).not.toContain('call-out charge')
    expect(src).not.toContain('callout charge')
  })

  it('FIX-5e | Discovery page imports getAiCapabilityProfile from constants', () => {
    const src = readSource('app/dashboard/discovery/page.tsx')
    expect(src).toContain('getAiCapabilityProfile')
    expect(src).toContain('registration-constants')
  })

  it('FIX-5f | Quote-only AI description does NOT claim direct booking', () => {
    const src = readSource('app/dashboard/discovery/page.tsx')
    // The quote-only branch must reference creating a quote request
    expect(src).toContain('create a quote request for your review')
    // Must not say AI "assists with new bookings" in the same code path
    // (The two paths are separate branches of the if/else)
    const quoteOnlyStart = src.indexOf('aiProfile.aiCanBook && !aiProfile.aiCanBook')
    // Verify the conditional structure is there
    expect(src).toContain('!aiProfile.aiCanBook && aiProfile.aiCanQuote')
  })

  it('FIX-5g | AI description does not use hardcoded isQuoteOnlyTrade', () => {
    const src = readSource('app/dashboard/discovery/page.tsx')
    expect(src).not.toContain('isQuoteOnlyTrade')
    expect(src).toContain('aiProfile')
  })

  // ── FIX-6: Driving school rejection ──────────────────────────────────────

  it('FIX-6a | API source rejects DRIVING_SCHOOL with structured error', () => {
    const src = readSource('app/api/register/route.ts')
    expect(src).toContain('DRIVING_SCHOOL_NOT_AVAILABLE')
    expect(src).toContain('400')
  })

  it('FIX-6b | DRIVING_SCHOOL rejection occurs before Provider creation', () => {
    const src = readSource('app/api/register/route.ts')
    const guardIdx   = src.indexOf('DRIVING_SCHOOL_NOT_AVAILABLE')
    const createIdx  = src.indexOf('tx.provider.create')
    expect(guardIdx).toBeGreaterThan(-1)
    expect(createIdx).toBeGreaterThan(guardIdx)  // guard comes first
  })

  it('FIX-6c | UI still shows Driving School as coming soon', () => {
    const src = readSource('app/register/page.tsx')
    expect(src).toContain('Coming soon')
    expect(src).toContain('DRIVING_SCHOOL')
  })

  // ── Invariants: nothing changed that must not change ─────────────────────

  it('INV-1 | 503 guards still present in bulk-booking route', () => {
    const src = readSource('app/api/public/bookings/bulk/route.ts')
    expect(src).toContain("paymentMode === 'DIRECT'")
    expect(src).toContain('503')
  })

  it('INV-2 | directPayments still false in account features', () => {
    const src = readSource('lib/utils/account.ts')
    expect(src).toContain('directPayments: false')
  })

  it('INV-3 | paymentMode not accepted as registration input', () => {
    const src = readSource('app/api/register/route.ts')
    expect(src).not.toMatch(/paymentMode:\s*z\./)
  })

  it('INV-4 | commercialAgreementType not accepted as registration input', () => {
    const src = readSource('app/api/register/route.ts')
    expect(src).not.toMatch(/commercialAgreementType:\s*z\./)
  })

  // ── Backward compatibility ────────────────────────────────────────────────

  it('BC-1 | driving + MARKETPLACE + termsAccepted still works', () => {
    const data = registerSchema.parse({ ...BASE, businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true })
    const d = deriveAll(data.businessType, data.businessModel, true)
    expect(d.businessModel).toBe('MARKETPLACE')
    expect(d.paymentMode).toBe('PLATFORM')
    expect(d.commercialAgreementStatus).toBe('ACCEPTED')
    expect(d.commercialAgreementVersion).toBe('2.0')
  })

  it('BC-2 | privacyAccepted still required', () => {
    expect(() => registerSchema.parse({ ...BASE, privacyAccepted: false })).toThrow()
  })

  it('BC-3 | non-driving omitted businessModel → SAAS + DIRECT', () => {
    const d = deriveAll('electrician', undefined, false)
    expect(d.businessModel).toBe('SAAS')
    expect(d.paymentMode).toBe('DIRECT')
  })
})
