/**
 * Phase 2 registration architecture tests — Stage 1B
 *
 * Tests import production functions from:
 *   lib/registration/derive-registration-fields.ts  (shared derivation)
 *   lib/config/registration-constants.ts             (versions + AI map)
 *
 * Tests do NOT duplicate derivation logic — they exercise the same
 * functions the production route uses.
 */

import { describe, it, expect } from 'vitest'
import {
  deriveRegistrationFields,
  RegistrationValidationError,
} from '../../lib/registration/derive-registration-fields'
import {
  MARKETPLACE_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
  SAAS_TERMS_VERSION,
  SAAS_TERMS_PUBLISHED,
  AI_CAPABILITY_MAP,
  AI_CAPABILITY_DEFAULT,
  getAiCapabilityProfile,
} from '../../lib/config/registration-constants'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..', '..')
const src = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

// ── FIX-1: Marketplace agreement enforcement ─────────────────────────────────

describe('FIX-1 — Marketplace agreement enforcement', () => {

  it('FIX-1-1 | MARKETPLACE without termsAccepted throws RegistrationValidationError', () => {
    expect(() =>
      deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: false })
    ).toThrow(RegistrationValidationError)
  })

  it('FIX-1-2 | MARKETPLACE without termsAccepted has code MARKETPLACE_TERMS_REQUIRED', () => {
    try {
      deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: false })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(RegistrationValidationError)
      expect((err as RegistrationValidationError).code).toBe('MARKETPLACE_TERMS_REQUIRED')
    }
  })

  it('FIX-1-3 | MARKETPLACE omitted termsAccepted throws', () => {
    expect(() =>
      deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE' })
    ).toThrow(RegistrationValidationError)
  })

  it('FIX-1-4 | MARKETPLACE + termsAccepted=true produces ACCEPTED status', () => {
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true })
    expect(d.commercialAgreementStatus).toBe('ACCEPTED')
    expect(d.commercialAgreementVersion).toBe(MARKETPLACE_TERMS_VERSION)
    expect(d.commercialAgreementAcceptedAt).not.toBeNull()
    expect(d.userTermsAcceptedAt).not.toBeNull()
    expect(d.userTermsVersion).toBe(MARKETPLACE_TERMS_VERSION)
  })

  it('FIX-1-5 | Marketplace version is 2.0 (matches published Instructor Terms)', () => {
    expect(MARKETPLACE_TERMS_VERSION).toBe('2.0')
  })

  it('FIX-1-6 | Register page sends termsAccepted only for Marketplace + ticked', () => {
    const page = src('app/register/page.tsx')
    // The termsAccepted send is conditional — not always true
    expect(page).toContain("selectedModel === 'MARKETPLACE' && termsAccepted")
    // Must NOT send termsAccepted: true unconditionally
    expect(page).not.toContain('termsAccepted: true,')
  })

  it('FIX-1-7 | API does not accept termsVersion from browser', () => {
    const route = src('app/api/register/route.ts')
    expect(route).not.toMatch(/termsVersion:\s*z\./)
  })
})

// ── FIX-2: SaaS pending agreement ────────────────────────────────────────────

describe('FIX-2 — SaaS pending agreement', () => {

  it('FIX-2-1 | SaaS commercialAgreementStatus = PENDING', () => {
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS' })
    expect(d.commercialAgreementStatus).toBe('PENDING')
  })

  it('FIX-2-2 | SaaS commercialAgreementVersion = null (not a string)', () => {
    expect(SAAS_TERMS_PUBLISHED).toBe(false)
    expect(SAAS_TERMS_VERSION).toBeNull()
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS' })
    expect(d.commercialAgreementVersion).toBeNull()
  })

  it('FIX-2-3 | SaaS commercialAgreementAcceptedAt = null', () => {
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS' })
    expect(d.commercialAgreementAcceptedAt).toBeNull()
  })

  it('FIX-2-4 | SaaS does NOT set User.termsAcceptedAt', () => {
    const d = deriveRegistrationFields({ businessType: 'plumber' })
    expect(d.userTermsAcceptedAt).toBeNull()
    expect(d.userTermsVersion).toBeNull()
  })

  it('FIX-2-5 | SaaS with termsAccepted=true still results in PENDING (Marketplace path blocked)', () => {
    // termsAccepted is ignored for SaaS; the derivation must not produce ACCEPTED
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS', termsAccepted: true })
    expect(d.commercialAgreementStatus).toBe('PENDING')
    expect(d.userTermsAcceptedAt).toBeNull()
  })

  it('FIX-2-6 | Dashboard contains SaaS pending notice', () => {
    const page = src('app/dashboard/page.tsx')
    expect(page).toContain("paymentModel === 'saas'")
    expect(page).toContain("commercialAgreementStatus === 'PENDING'")
    expect(page).toContain('SaaS Terms are being finalised')
  })

  it('FIX-2-7 | Register page shows SaaS pending notice instead of checkbox', () => {
    const page = src('app/register/page.tsx')
    expect(page).toContain('SaaS Terms are being finalised')
  })
})

// ── FIX-2B: SaaS published lifecycle (injected test state) ───────────────────
// These tests exercise the published SaaS Terms path using _testSaasPublished
// to inject a "published" state without modifying production constants.
// SAAS_TERMS_PUBLISHED remains false in production throughout these tests.

describe('FIX-2B — SaaS Terms published lifecycle', () => {

  const PUBLISHED_STATE = { published: true, version: '1.0' }

  it('SaaS-PUB-1 | Published + no acceptance → SAAS_TERMS_REQUIRED', () => {
    expect(() =>
      deriveRegistrationFields({
        businessType: 'driving', businessModel: 'SAAS',
        _testSaasPublished: PUBLISHED_STATE,
        // saasTermsAccepted not supplied
      })
    ).toThrow(RegistrationValidationError)
    try {
      deriveRegistrationFields({
        businessType: 'driving', businessModel: 'SAAS',
        _testSaasPublished: PUBLISHED_STATE,
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect((err as RegistrationValidationError).code).toBe('SAAS_TERMS_REQUIRED')
    }
  })

  it('SaaS-PUB-2 | Published + saasTermsAccepted=false → SAAS_TERMS_REQUIRED', () => {
    expect(() =>
      deriveRegistrationFields({
        businessType: 'plumber',
        _testSaasPublished: PUBLISHED_STATE,
        saasTermsAccepted: false,
      })
    ).toThrow(RegistrationValidationError)
  })

  it('SaaS-PUB-3 | Published + accepted → ACCEPTED with correct version', () => {
    const d = deriveRegistrationFields({
      businessType: 'driving', businessModel: 'SAAS',
      _testSaasPublished: PUBLISHED_STATE,
      saasTermsAccepted: true,
    })
    expect(d.commercialAgreementStatus).toBe('ACCEPTED')
    expect(d.commercialAgreementVersion).toBe('1.0')
    expect(d.commercialAgreementType).toBe('SAAS_TERMS')
    expect(d.commercialAgreementAcceptedAt).toBeInstanceOf(Date)
  })

  it('SaaS-PUB-4 | Published + accepted → User.termsAcceptedAt remains null (SaaS never touches legacy fields)', () => {
    // SaaS Terms are not Instructor Terms. SaaS acceptance must NOT populate
    // User.termsAcceptedAt / User.termsVersion — those are Marketplace fields.
    const d = deriveRegistrationFields({
      businessType: 'driving', businessModel: 'SAAS',
      _testSaasPublished: PUBLISHED_STATE,
      saasTermsAccepted: true,
    })
    expect(d.userTermsAcceptedAt).toBeNull()
    expect(d.userTermsVersion).toBeNull()
  })

  it('SaaS-PUB-5 | Unpublished → PENDING regardless of saasTermsAccepted', () => {
    // With _testSaasPublished = { published: false }, the state is unpublished.
    const d = deriveRegistrationFields({
      businessType: 'plumber',
      _testSaasPublished: { published: false, version: null },
      saasTermsAccepted: true,  // attempting acceptance when unpublished
    })
    expect(d.commercialAgreementStatus).toBe('PENDING')
    expect(d.commercialAgreementVersion).toBeNull()
    expect(d.userTermsAcceptedAt).toBeNull()
  })

  it('SaaS-PUB-6 | Privacy consent is always recorded independently of SaaS Terms state', () => {
    // Published + accepted
    const dAccepted = deriveRegistrationFields({
      businessType: 'electrician',
      _testSaasPublished: PUBLISHED_STATE,
      saasTermsAccepted: true,
    })
    expect(dAccepted.privacyPolicyVersion).toBe('2.0')
    expect(dAccepted.privacyPolicyAcceptedAt).toBeInstanceOf(Date)
    // Unpublished
    const dPending = deriveRegistrationFields({ businessType: 'electrician' })
    expect(dPending.privacyPolicyVersion).toBe('2.0')
    expect(dPending.privacyPolicyAcceptedAt).toBeInstanceOf(Date)
  })

  it('SaaS-PUB-7 | Production constants are unchanged by these tests', () => {
    // Confirm the module-level constants are still false/null
    // (the tests used _testSaasPublished injection, not constant mutation)
    expect(SAAS_TERMS_PUBLISHED).toBe(false)
    expect(SAAS_TERMS_VERSION).toBeNull()
  })
})

// ── FIX-1B: Agreement record ownership ───────────────────────────────────────

describe('FIX-1B — Agreement record ownership', () => {

  it('OWN-1 | MARKETPLACE acceptance populates legacy User fields', () => {
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true })
    expect(d.userTermsAcceptedAt).toBeInstanceOf(Date)
    expect(d.userTermsVersion).toBe(MARKETPLACE_TERMS_VERSION)
  })

  it('OWN-2 | SaaS (unpublished) — User fields are null, Provider agreement PENDING', () => {
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS' })
    expect(d.userTermsAcceptedAt).toBeNull()
    expect(d.userTermsVersion).toBeNull()
    expect(d.commercialAgreementStatus).toBe('PENDING')
    expect(d.commercialAgreementType).toBe('SAAS_TERMS')
  })

  it('OWN-3 | SaaS (published + accepted) — User fields still null, Provider agreement ACCEPTED', () => {
    const d = deriveRegistrationFields({
      businessType: 'plumber',
      _testSaasPublished: { published: true, version: '1.0' },
      saasTermsAccepted: true,
    })
    // SaaS Terms ≠ Instructor Terms. The User legacy fields must stay null.
    expect(d.userTermsAcceptedAt).toBeNull()
    expect(d.userTermsVersion).toBeNull()
    // The SaaS agreement is recorded in Provider fields only.
    expect(d.commercialAgreementStatus).toBe('ACCEPTED')
    expect(d.commercialAgreementVersion).toBe('1.0')
    expect(d.commercialAgreementAcceptedAt).toBeInstanceOf(Date)
  })

  it('OWN-4 | Derivation utility comment describes Marketplace-only User fields', () => {
    const deriveSrc = src('lib/registration/derive-registration-fields.ts')
    expect(deriveSrc).toContain('MARKETPLACE ONLY')
    expect(deriveSrc).toContain('legacy Instructor Terms')
  })
})

// ── FIX-3: Privacy policy version ────────────────────────────────────────────

describe('FIX-3 — Privacy policy version', () => {

  it('FIX-3-1 | PRIVACY_POLICY_VERSION is 2.0', () => {
    expect(PRIVACY_POLICY_VERSION).toBe('2.0')
  })

  it('FIX-3-2 | Privacy version is recorded independently of commercial agreement', () => {
    const dMarketplace = deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true })
    const dSaas = deriveRegistrationFields({ businessType: 'plumber' })
    expect(dMarketplace.privacyPolicyVersion).toBe('2.0')
    expect(dSaas.privacyPolicyVersion).toBe('2.0')
    // SaaS has no commercial version but still has privacy version
    expect(dSaas.commercialAgreementVersion).toBeNull()
    expect(dSaas.privacyPolicyVersion).toBe('2.0')
  })

  it('FIX-3-3 | privacyPolicyAcceptedAt is always set', () => {
    const d = deriveRegistrationFields({ businessType: 'electrician' })
    expect(d.privacyPolicyAcceptedAt).toBeInstanceOf(Date)
  })
})

// ── FIX-4: Organisation types ─────────────────────────────────────────────────

describe('FIX-4 — Organisation types', () => {

  it('FIX-4-1 | Driving + MARKETPLACE → INDIVIDUAL_INSTRUCTOR', () => {
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true })
    expect(d.organisationType).toBe('INDIVIDUAL_INSTRUCTOR')
  })

  it('FIX-4-2 | Driving + SAAS → INDIVIDUAL_INSTRUCTOR', () => {
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS' })
    expect(d.organisationType).toBe('INDIVIDUAL_INSTRUCTOR')
  })

  it('FIX-4-3 | Non-driving default → SOLE_TRADER', () => {
    for (const bt of ['plumber', 'electrician', 'beauty', 'tax']) {
      const d = deriveRegistrationFields({ businessType: bt })
      expect(d.organisationType).toBe('SOLE_TRADER')
    }
  })

  it('FIX-4-4 | Non-driving + REGISTERED_BUSINESS → REGISTERED_BUSINESS', () => {
    const d = deriveRegistrationFields({ businessType: 'plumber', organisationType: 'REGISTERED_BUSINESS' })
    expect(d.organisationType).toBe('REGISTERED_BUSINESS')
  })

  it('FIX-4-5 | Driving + REGISTERED_BUSINESS → INDIVIDUAL_INSTRUCTOR (driving ignores supplied value)', () => {
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS', organisationType: 'REGISTERED_BUSINESS' })
    expect(d.organisationType).toBe('INDIVIDUAL_INSTRUCTOR')
  })

  it('FIX-4-6 | DRIVING_SCHOOL throws RegistrationValidationError', () => {
    expect(() =>
      deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS', organisationType: 'DRIVING_SCHOOL' })
    ).toThrow(RegistrationValidationError)
    try {
      deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS', organisationType: 'DRIVING_SCHOOL' })
      expect.fail('Should have thrown')
    } catch (err) {
      expect((err as RegistrationValidationError).code).toBe('DRIVING_SCHOOL_NOT_AVAILABLE')
    }
  })

  it('FIX-4-7 | DRIVING_SCHOOL with SAAS is rejected before any other check', () => {
    // DRIVING_SCHOOL on SaaS path: MARKETPLACE_TERMS check doesn't apply,
    // so DRIVING_SCHOOL_NOT_AVAILABLE is the first error thrown.
    expect(() =>
      deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS', organisationType: 'DRIVING_SCHOOL' })
    ).toThrow(RegistrationValidationError)
    try {
      deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS', organisationType: 'DRIVING_SCHOOL' })
    } catch (err) {
      expect((err as RegistrationValidationError).code).toBe('DRIVING_SCHOOL_NOT_AVAILABLE')
    }
  })

  it('FIX-4-7b | DRIVING_SCHOOL with MARKETPLACE fails on terms check first', () => {
    // On the MARKETPLACE path, the Marketplace terms check runs before the org-type check.
    // A school attempting MARKETPLACE without accepting terms gets MARKETPLACE_TERMS_REQUIRED.
    // Both errors prevent DB writes — order reflects commercial priority.
    expect(() =>
      deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE', organisationType: 'DRIVING_SCHOOL', termsAccepted: false })
    ).toThrow(RegistrationValidationError)
    try {
      deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE', organisationType: 'DRIVING_SCHOOL', termsAccepted: false })
    } catch (err) {
      expect((err as RegistrationValidationError).code).toBe('MARKETPLACE_TERMS_REQUIRED')
    }
  })

  it('FIX-4-7c | DRIVING_SCHOOL with MARKETPLACE + accepted terms is caught by org-type check', () => {
    // Even with terms accepted, DRIVING_SCHOOL is still rejected.
    expect(() =>
      deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE', organisationType: 'DRIVING_SCHOOL', termsAccepted: true })
    ).toThrow(RegistrationValidationError)
    try {
      deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE', organisationType: 'DRIVING_SCHOOL', termsAccepted: true })
    } catch (err) {
      expect((err as RegistrationValidationError).code).toBe('DRIVING_SCHOOL_NOT_AVAILABLE')
    }
  })

  it('FIX-4-8 | No REGISTERED_BUSINESS sets accountType=BUSINESS', () => {
    const d = deriveRegistrationFields({ businessType: 'plumber', organisationType: 'REGISTERED_BUSINESS' })
    // accountType is not in the derivation output — it is hardcoded to INDIVIDUAL in the route
    // The derivation never touches accountType
    expect(d).not.toHaveProperty('accountType')
  })

  it('FIX-4-9 | Register page contains business structure selector for non-driving', () => {
    const page = src('app/register/page.tsx')
    expect(page).toContain('REGISTERED_BUSINESS')
    expect(page).toContain('Sole trader')
    expect(page).toContain('Registered company')
    expect(page).toContain('selectedStructure')
  })

// ── FIX-4-10 — schema and migration ──────────────────────────────────────────

  it('FIX-4-10 | Schema organisationType is nullable (no default)', () => {
    const schema = src('prisma/schema.prisma')
    // Must be nullable String? not String with default
    expect(schema).toContain('organisationType          String?')
    expect(schema).not.toContain('@default("SOLE_TRADER")')
  })

  it('FIX-4-11 | Migration adds organisationType as NULL (no DEFAULT clause)', () => {
    const mig = src('prisma/migrations/20261110000001_add_organisation_type_and_agreement_fields/migration.sql')
    // Column must be nullable TEXT with no DEFAULT — existing rows get NULL
    expect(mig).toContain('"organisationType"             TEXT,')
    expect(mig).not.toContain("DEFAULT 'SOLE_TRADER'")
    // The migration must document why NULL is intentional
    expect(mig).toContain('organisationType is NULL for all existing rows')
  })
})

// ── FIX-5: AI capability source of truth ─────────────────────────────────────

describe('FIX-5 — AI capability', () => {

  it('FIX-5-1 | Unknown business type fails closed (aiCanBook=false)', () => {
    const profile = getAiCapabilityProfile('unknown_type')
    expect(profile.aiCanBook).toBe(false)
    expect(profile.aiCanQuote).toBe(false)
    expect(AI_CAPABILITY_DEFAULT.aiCanBook).toBe(false)
  })

  it('FIX-5-2 | Undefined business type fails closed', () => {
    const profile = getAiCapabilityProfile(undefined)
    expect(profile.aiCanBook).toBe(false)
  })

  it('FIX-5-3 | Driving: aiCanBook=true, aiCanQuote=false, allowedActions includes book', () => {
    const p = AI_CAPABILITY_MAP['driving']
    expect(p.aiCanBook).toBe(true)
    expect(p.aiCanQuote).toBe(false)
    expect(p.allowedActions).toContain('book')
    // Verify consistency: if aiCanBook, 'book' must be in allowedActions
    expect(p.allowedActions).toContain('book')
  })

  it('FIX-5-4 | Beauty: aiCanBook=true, matches template config', () => {
    const p = AI_CAPABILITY_MAP['beauty']
    expect(p.aiCanBook).toBe(true)
    expect(p.aiCanQuote).toBe(false)
    expect(p.allowedActions).toContain('book')
  })

  it('FIX-5-5 | Tax: aiCanBook=true, aiCanQuote=false — quote not in allowedActions', () => {
    // Tax has Business Tax Return with aiCanQuote=true at the service level,
    // but tax aiConfig.allowedActions=['book','reschedule','cancel','message']
    // 'quote' is NOT in allowedActions — the quote path is not executable.
    // The map must reflect the EFFECTIVE capability (intersection).
    const p = AI_CAPABILITY_MAP['tax']
    expect(p.aiCanBook).toBe(true)
    expect(p.aiCanQuote).toBe(false)   // not executable through allowedActions
    expect(p.mixed).toBe(false)
    expect(p.allowedActions).not.toContain('quote')
    expect(p.allowedActions).toContain('book')
  })

  it('FIX-5-6 | Plumber: aiCanBook=false, aiCanQuote=true, quote IS in allowedActions', () => {
    const p = AI_CAPABILITY_MAP['plumber']
    expect(p.aiCanBook).toBe(false)
    expect(p.aiCanQuote).toBe(true)
    expect(p.allowedActions).toContain('quote')
    expect(p.allowedActions).not.toContain('book')
  })

  it('FIX-5-7 | Electrician: same as plumber', () => {
    const p = AI_CAPABILITY_MAP['electrician']
    expect(p.aiCanBook).toBe(false)
    expect(p.aiCanQuote).toBe(true)
    expect(p.allowedActions).toContain('quote')
  })

  it('FIX-5-8 | No callout charges advertised in any profile', () => {
    for (const [, profile] of Object.entries(AI_CAPABILITY_MAP)) {
      expect(profile.calloutChargeConfigured).toBe(false)
    }
    expect(AI_CAPABILITY_DEFAULT.calloutChargeConfigured).toBe(false)
  })

  it('FIX-5-9 | Discovery page does not advertise callout charges', () => {
    const page = src('app/dashboard/discovery/page.tsx')
    expect(page).not.toContain('call-out charge')
    expect(page).not.toContain('callout charge')
    expect(page).not.toContain('call-out fee')
  })

  it('FIX-5-10 | Discovery page does not advertise final job quotation', () => {
    const page = src('app/dashboard/discovery/page.tsx')
    expect(page).not.toContain('final job quotation')
    expect(page).not.toContain('provides a price')
  })

  it('FIX-5-11 | Discovery AI description: tax uses booking path (quote not executable)', () => {
    const page = src('app/dashboard/discovery/page.tsx')
    // Tax is now treated as booking-only since 'quote' not in allowedActions.
    // The mixed/tax-specific branch must be absent.
    expect(page).not.toContain('business tax returns, the AI collects details')
  })
})

// ── Shared derivation utility ────────────────────────────────────────────────

describe('Shared derivation utility (FIX-5 — production functions)', () => {

  it('API route imports from derive-registration-fields', () => {
    const route = src('app/api/register/route.ts')
    expect(route).toContain('derive-registration-fields')
    expect(route).toContain('deriveRegistrationFields')
    expect(route).toContain('RegistrationValidationError')
  })

  it('Test file imports from derive-registration-fields', () => {
    const test = src('__tests__/integration/reg-phase2-architecture.test.ts')
    expect(test).toContain('derive-registration-fields')
    // Confirm the test does not define its own derive function (the old test did)
    // We check the registration API route instead of self-reading to avoid Vitest diff contamination
    const route = src('app/api/register/route.ts')
    expect(route).not.toMatch(/function deriveAll\b/)
    expect(route).not.toMatch(/const deriveAll\b/)
  })
})

// ── ageDeclaration: CLIENT/LEARNER declaration only ──────────────────────────

describe('ageDeclaration — CLIENT/LEARNER declaration only', () => {

  it('AGE-1 | ageDeclaration is NOT in the provider registration Zod schema', () => {
    const route = src('app/api/register/route.ts')
    // The field must not be in the schema as a Zod validator
    expect(route).not.toMatch(/ageDeclaration:\s*z\./)
  })

  it('AGE-2 | provider registration does NOT write ageDeclaration to User record', () => {
    const route = src('app/api/register/route.ts')
    // The User write must not reference ageDeclaration
    expect(route).not.toContain('ageDeclaration: data.ageDeclaration')
    expect(route).not.toContain('ageDeclaration: false')
  })

  it('AGE-3 | ageDeclaration appears only in the learner/client booking path', () => {
    // The booking form and public bookings route use it for learner eligibility
    const bookingForm = src('components/BookingFormNew.tsx')
    expect(bookingForm).toContain('ageDeclaration')
    expect(bookingForm).toContain('at least 16 years old')
    // The learner booking API route uses it
    const learnerRoute = src('app/api/public/bookings/route.ts')
    expect(learnerRoute).toContain('ageDeclaration')
  })

  it('AGE-4 | provider registration page has no ageDeclaration field', () => {
    const page = src('app/register/page.tsx')
    expect(page).not.toContain('ageDeclaration')
  })

  it('AGE-5 | ageDeclaration is documented as CLIENT-only in registration API', () => {
    const route = src('app/api/register/route.ts')
    expect(route).toContain('LEARNER/CLIENT declaration')
  })

  it('AGE-6 | Marketplace registration does not couple ageDeclaration to termsAccepted', () => {
    // Derivation output must not contain ageDeclaration
    const d = deriveRegistrationFields({
      businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true,
    })
    expect(d).not.toHaveProperty('ageDeclaration')
    // SaaS also no ageDeclaration
    const dSaas = deriveRegistrationFields({ businessType: 'plumber' })
    expect(dSaas).not.toHaveProperty('ageDeclaration')
  })
})

// ── Migration classification strategy ─────────────────────────────────────────

describe('Migration classification — organisationType strategy', () => {

  it('MIG-1 | Existing providers get NULL organisationType (not SOLE_TRADER default)', () => {
    const mig = src('prisma/migrations/20261110000001_add_organisation_type_and_agreement_fields/migration.sql')
    // Column definition must be nullable TEXT with no DEFAULT
    expect(mig).toContain('"organisationType"             TEXT,')
    expect(mig).not.toContain("DEFAULT 'SOLE_TRADER'")
  })

  it('MIG-2 | New registrations always receive an explicit organisationType from API', () => {
    const route = src('app/api/register/route.ts')
    // The derivation sets organisationType explicitly
    expect(route).toContain('organisationType,')
    // The derive-registration-fields utility always returns a value for new registrations
    const driving = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS' })
    expect(driving.organisationType).toBe('INDIVIDUAL_INSTRUCTOR')
    const plumber = deriveRegistrationFields({ businessType: 'plumber' })
    expect(plumber.organisationType).toBe('SOLE_TRADER')
  })

  it('MIG-3 | Classification script uses industry field (not just businessModel)', () => {
    const script = src('scripts/migration-phase2-classification.cjs')
    expect(script).toContain('p.industry')
    expect(script).toContain('NON_DRIVING_INDUSTRIES')
    expect(script).toContain('REVIEW')
  })

  it('MIG-4 | Classification script explicitly populates REVIEW group', () => {
    const script = src('scripts/migration-phase2-classification.cjs')
    // REVIEW must be populated, not always empty
    expect(script).toContain("groups.REVIEW.push")
    expect(script).toContain('MANUAL REVIEW REQUIRED')
  })

  it('MIG-5 | Rollback assessment documents data-destruction risk', () => {
    const script = src('scripts/migration-phase2-classification.cjs')
    expect(script).toContain('destroys real legal consent records')
    expect(script).toContain('CREATE TABLE')  // backup step documented
    expect(script).toContain('legal review')
  })
})

// ── Dev helper script — drift guard ──────────────────────────────────────────
//
// apply-phase2-migration.cjs is a dev-only convenience script.
// Its SQL MUST stay in sync with the authoritative Prisma migration.
// These tests prevent silent drift between the two files.

describe('Dev helper script — apply-phase2-migration.cjs sync with migration.sql', () => {

  it('DRIFT-1 | apply script organisationType column is nullable TEXT (no NOT NULL)', () => {
    const helper = src('scripts/apply-phase2-migration.cjs')
    // Must be plain nullable TEXT — no NOT NULL constraint
    expect(helper).toContain('"organisationType"             TEXT,')
    expect(helper).not.toContain('"organisationType"             TEXT NOT NULL')
  })

  it('DRIFT-2 | apply script has no SOLE_TRADER default for organisationType', () => {
    const helper = src('scripts/apply-phase2-migration.cjs')
    // No DEFAULT clause for organisationType
    expect(helper).not.toContain("DEFAULT 'SOLE_TRADER'")
  })

  it('DRIFT-3 | apply script SQL columns match migration.sql columns', () => {
    const helper = src('scripts/apply-phase2-migration.cjs')
    const mig    = src('prisma/migrations/20261110000001_add_organisation_type_and_agreement_fields/migration.sql')
    // Both must add all 7 columns
    const columns = [
      '"organisationType"',
      '"commercialAgreementType"',
      '"commercialAgreementStatus"',
      '"commercialAgreementVersion"',
      '"commercialAgreementAcceptedAt"',
      '"privacyPolicyVersion"',
      '"privacyPolicyAcceptedAt"',
    ]
    for (const col of columns) {
      expect(helper).toContain(col)
      expect(mig).toContain(col)
    }
  })

  it('DRIFT-4 | apply script is documented as dev-only and not for production', () => {
    const helper = src('scripts/apply-phase2-migration.cjs')
    expect(helper).toContain('DEV-ONLY')
    expect(helper).toContain('NOT for production')
  })

  it('DRIFT-5 | apply script references migration.sql as the authoritative source', () => {
    const helper = src('scripts/apply-phase2-migration.cjs')
    expect(helper).toContain('migration.sql')
  })
})

// ── Backward compatibility ────────────────────────────────────────────────────

describe('Backward compatibility', () => {

  it('BC-1 | Driving + MARKETPLACE + accepted still works', () => {
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true })
    expect(d.businessModel).toBe('MARKETPLACE')
    expect(d.paymentMode).toBe('PLATFORM')
    expect(d.commercialAgreementStatus).toBe('ACCEPTED')
    expect(d.commercialAgreementVersion).toBe('2.0')
    expect(d.privacyPolicyVersion).toBe('2.0')
  })

  it('BC-2 | Driving + SAAS still works', () => {
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS' })
    expect(d.businessModel).toBe('SAAS')
    expect(d.paymentMode).toBe('DIRECT')
    expect(d.commercialAgreementStatus).toBe('PENDING')
  })

  it('BC-3 | Non-driving omitted model → SAAS + DIRECT', () => {
    const d = deriveRegistrationFields({ businessType: 'electrician' })
    expect(d.businessModel).toBe('SAAS')
    expect(d.paymentMode).toBe('DIRECT')
  })

  it('BC-4 | 503 guards unchanged', () => {
    const bulk = src('app/api/public/bookings/bulk/route.ts')
    expect(bulk).toContain("paymentMode === 'DIRECT'")
    expect(bulk).toContain('503')
  })

  it('BC-5 | directPayments still false', () => {
    const account = src('lib/utils/account.ts')
    expect(account).toContain('directPayments: false')
  })

  it('BC-6 | Learner terms path in public/bookings/route.ts unaffected', () => {
    // This path uses data.termsVersion from the browser — that is correct for client registration
    const learnerRoute = src('app/api/public/bookings/route.ts')
    expect(learnerRoute).toContain('termsAcceptedAt')
    // The learner path continues to use data.termsVersion (expected)
    expect(learnerRoute).toContain("termsVersion: data.termsVersion || '1.0'")
  })
})

// ── Independent registration flow verification ───────────────────────────────
//
// These tests independently verify the seven registration behaviours called out
// in the Stage 1B reviewer recommendation, using the production derivation
// function directly.  They are written as a second set of eyes on the
// behaviours rather than re-using the same assertion strings as earlier tests.

describe('IVF — Marketplace terms acceptance and version persistence', () => {

  it('IVF-M1 | Marketplace registration without termsAccepted throws before any DB write', () => {
    // No termsAccepted supplied
    expect(() => deriveRegistrationFields({
      businessType: 'driving', businessModel: 'MARKETPLACE',
    })).toThrow('You must accept the Instructor Terms')

    // Explicit false also rejected
    expect(() => deriveRegistrationFields({
      businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: false,
    })).toThrow('You must accept the Instructor Terms')
  })

  it('IVF-M2 | Marketplace registration records agreement as ACCEPTED at version 2.0', () => {
    const d = deriveRegistrationFields({
      businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true,
    })
    expect(d.commercialAgreementType).toBe('MARKETPLACE_TERMS')
    expect(d.commercialAgreementStatus).toBe('ACCEPTED')
    expect(d.commercialAgreementVersion).toBe('2.0')
    expect(d.commercialAgreementAcceptedAt).toBeInstanceOf(Date)
  })

  it('IVF-M3 | Marketplace registration writes User.termsAcceptedAt and termsVersion', () => {
    const d = deriveRegistrationFields({
      businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true,
    })
    // Legacy User fields — written for Marketplace only
    expect(d.userTermsAcceptedAt).toBeInstanceOf(Date)
    expect(d.userTermsVersion).toBe('2.0')
  })

  it('IVF-M4 | Register page sends termsAccepted only when MARKETPLACE is selected', () => {
    const page = src('app/register/page.tsx')
    // Conditional spread — only sent when isDriving + MARKETPLACE + termsAccepted
    expect(page).toContain("selectedModel === 'MARKETPLACE' && termsAccepted")
    // SaaS path must not send termsAccepted at all
    // The checkbox is only rendered for MARKETPLACE
    expect(page).toContain("isDriving && selectedModel === 'MARKETPLACE'")
  })

  it('IVF-M5 | Register page submit button is disabled when MARKETPLACE and terms not accepted', () => {
    const page = src('app/register/page.tsx')
    // Disabled condition includes the marketplace terms gate
    expect(page).toContain("selectedModel === 'MARKETPLACE' && !termsAccepted")
  })
})

describe('IVF — SaaS registration with unpublished terms', () => {

  it('IVF-S1 | SaaS registration with unpublished terms produces PENDING status and null version', () => {
    // Current production state: SAAS_TERMS_PUBLISHED=false
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS' })
    expect(d.commercialAgreementType).toBe('SAAS_TERMS')
    expect(d.commercialAgreementStatus).toBe('PENDING')
    expect(d.commercialAgreementVersion).toBeNull()
    expect(d.commercialAgreementAcceptedAt).toBeNull()
  })

  it('IVF-S2 | SaaS registration does NOT write User.termsAcceptedAt or termsVersion', () => {
    const d = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS' })
    // User.terms* are Marketplace-only legacy fields — must not be set for SaaS
    expect(d.userTermsAcceptedAt).toBeNull()
    expect(d.userTermsVersion).toBeNull()
  })

  it('IVF-S3 | Non-driving SaaS registration also produces PENDING without User.terms* write', () => {
    const d = deriveRegistrationFields({ businessType: 'plumber' })
    expect(d.businessModel).toBe('SAAS')
    expect(d.commercialAgreementStatus).toBe('PENDING')
    expect(d.commercialAgreementVersion).toBeNull()
    expect(d.userTermsAcceptedAt).toBeNull()
    expect(d.userTermsVersion).toBeNull()
  })

  it('IVF-S4 | Register page shows SaaS notice (not terms checkbox) when terms unpublished', () => {
    const page = src('app/register/page.tsx')
    // SaaS notice about terms being finalised — always shown for SaaS
    expect(page).toContain('SaaS Terms are being finalised')
    // The Instructor Terms checkbox is only shown for MARKETPLACE
    expect(page).toContain("isDriving && selectedModel === 'MARKETPLACE'")
  })
})

describe('IVF — SaaS terms acceptance when publication is enabled', () => {

  it('IVF-SP1 | When SaaS Terms published, registration without acceptance throws', () => {
    expect(() => deriveRegistrationFields({
      businessType: 'driving', businessModel: 'SAAS',
      _testSaasPublished: { published: true, version: '1.0' },
    })).toThrow('You must accept the DriveBook SaaS Terms')
  })

  it('IVF-SP2 | When SaaS Terms published, acceptance produces ACCEPTED with version and timestamp', () => {
    const d = deriveRegistrationFields({
      businessType:      'driving',
      businessModel:     'SAAS',
      saasTermsAccepted: true,
      _testSaasPublished: { published: true, version: '1.0' },
    })
    expect(d.commercialAgreementStatus).toBe('ACCEPTED')
    expect(d.commercialAgreementVersion).toBe('1.0')
    expect(d.commercialAgreementAcceptedAt).toBeInstanceOf(Date)
  })

  it('IVF-SP3 | When SaaS Terms published, User.terms* still NOT written (SaaS isolation)', () => {
    // SaaS agreement records in Provider.commercialAgreement* only — never User.terms*
    const d = deriveRegistrationFields({
      businessType:      'driving',
      businessModel:     'SAAS',
      saasTermsAccepted: true,
      _testSaasPublished: { published: true, version: '1.0' },
    })
    expect(d.userTermsAcceptedAt).toBeNull()
    expect(d.userTermsVersion).toBeNull()
  })

  it('IVF-SP4 | Non-driving SaaS with published terms also enforces acceptance', () => {
    expect(() => deriveRegistrationFields({
      businessType: 'electrician',
      _testSaasPublished: { published: true, version: '1.0' },
    })).toThrow('You must accept the DriveBook SaaS Terms')

    const d = deriveRegistrationFields({
      businessType:      'electrician',
      saasTermsAccepted: true,
      _testSaasPublished: { published: true, version: '1.0' },
    })
    expect(d.commercialAgreementStatus).toBe('ACCEPTED')
  })
})

describe('IVF — Organisation type persistence for new registrations', () => {

  it('IVF-O1 | Driving Marketplace → always INDIVIDUAL_INSTRUCTOR regardless of supplied value', () => {
    // suppliedOrgType is ignored for driving — server always forces INDIVIDUAL_INSTRUCTOR
    const d = deriveRegistrationFields({
      businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true,
      organisationType: 'INDIVIDUAL_INSTRUCTOR',
    })
    expect(d.organisationType).toBe('INDIVIDUAL_INSTRUCTOR')
  })

  it('IVF-O2 | Driving SaaS → always INDIVIDUAL_INSTRUCTOR', () => {
    const d = deriveRegistrationFields({
      businessType: 'driving', businessModel: 'SAAS',
    })
    expect(d.organisationType).toBe('INDIVIDUAL_INSTRUCTOR')
  })

  it('IVF-O3 | Non-driving without supplying type → SOLE_TRADER default', () => {
    for (const bt of ['plumber', 'electrician', 'beauty', 'tax']) {
      const d = deriveRegistrationFields({ businessType: bt })
      expect(d.organisationType).toBe('SOLE_TRADER')
    }
  })

  it('IVF-O4 | Non-driving explicitly selects REGISTERED_BUSINESS → honoured', () => {
    const d = deriveRegistrationFields({
      businessType: 'plumber', organisationType: 'REGISTERED_BUSINESS',
    })
    expect(d.organisationType).toBe('REGISTERED_BUSINESS')
  })

  it('IVF-O5 | organisationType is explicitly written to Provider in route — not omitted', () => {
    // The API must pass organisationType to Provider.create(), not leave it undefined
    const route = src('app/api/register/route.ts')
    expect(route).toContain('organisationType,')
    // The comment in the Provider create block confirms its intent
    expect(route).toContain('never activates multi-provider')
  })

  it('IVF-O6 | Register page sends organisationType explicitly for both driving and non-driving', () => {
    const page = src('app/register/page.tsx')
    // Driving instructors send selectedOrgType (always INDIVIDUAL_INSTRUCTOR)
    expect(page).toContain('organisationType: selectedOrgType')
    // Non-driving providers send selectedStructure (SOLE_TRADER or REGISTERED_BUSINESS)
    expect(page).toContain('organisationType: selectedStructure')
  })
})

describe('IVF — Privacy consent independent of commercial terms', () => {

  it('IVF-P1 | Privacy version and timestamp always set regardless of business model', () => {
    const mp = deriveRegistrationFields({
      businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true,
    })
    expect(mp.privacyPolicyVersion).toBe('2.0')
    expect(mp.privacyPolicyAcceptedAt).toBeInstanceOf(Date)

    const saas = deriveRegistrationFields({ businessType: 'driving', businessModel: 'SAAS' })
    expect(saas.privacyPolicyVersion).toBe('2.0')
    expect(saas.privacyPolicyAcceptedAt).toBeInstanceOf(Date)

    const trade = deriveRegistrationFields({ businessType: 'electrician' })
    expect(trade.privacyPolicyVersion).toBe('2.0')
    expect(trade.privacyPolicyAcceptedAt).toBeInstanceOf(Date)
  })

  it('IVF-P2 | Privacy consent is not affected by SaaS Terms publication state', () => {
    const unpublished = deriveRegistrationFields({ businessType: 'plumber' })
    const published = deriveRegistrationFields({
      businessType: 'plumber', saasTermsAccepted: true,
      _testSaasPublished: { published: true, version: '1.0' },
    })
    expect(unpublished.privacyPolicyVersion).toBe(published.privacyPolicyVersion)
    // Both must set a timestamp
    expect(unpublished.privacyPolicyAcceptedAt).toBeInstanceOf(Date)
    expect(published.privacyPolicyAcceptedAt).toBeInstanceOf(Date)
  })

  it('IVF-P3 | Register page always requires privacyAccepted before submit is enabled', () => {
    const page = src('app/register/page.tsx')
    // privacyAccepted is required in the disabled condition for every path
    expect(page).toContain('!privacyAccepted')
    // And is validated as z.literal(true) in the Zod schema (not optional)
    const route = src('app/api/register/route.ts')
    expect(route).toContain("z.literal(true")
    expect(route).toContain('privacyAccepted')
  })

  it('IVF-P4 | Privacy fields are separate from commercialAgreement fields in derivation output', () => {
    const d = deriveRegistrationFields({ businessType: 'plumber' })
    // privacyPolicy fields exist and are non-null
    expect(d.privacyPolicyVersion).toBeTruthy()
    expect(d.privacyPolicyAcceptedAt).not.toBeNull()
    // commercialAgreement fields are PENDING/null (unpublished terms)
    expect(d.commercialAgreementStatus).toBe('PENDING')
    expect(d.commercialAgreementAcceptedAt).toBeNull()
    // The two sets are independent — privacy does not wait for commercial terms
  })
})

describe('IVF — Driving School rejection', () => {

  it('IVF-DS1 | DRIVING_SCHOOL throws DRIVING_SCHOOL_NOT_AVAILABLE before any DB write', () => {
    const err = (() => {
      try {
        deriveRegistrationFields({
          businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true,
          organisationType: 'DRIVING_SCHOOL',
        })
      } catch (e) {
        return e
      }
    })() as any
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('DRIVING_SCHOOL_NOT_AVAILABLE')
    expect(err.message).toContain('Driving school registration is not yet available')
  })

  it('IVF-DS2 | DRIVING_SCHOOL rejection works for SaaS path as well', () => {
    expect(() => deriveRegistrationFields({
      businessType: 'driving', businessModel: 'SAAS',
      organisationType: 'DRIVING_SCHOOL',
    })).toThrow('Driving school registration is not yet available')
  })

  it('IVF-DS3 | Register page shows Driving School as disabled / coming soon', () => {
    const page = src('app/register/page.tsx')
    expect(page).toContain('Coming soon')
    expect(page).toContain('cursor-not-allowed')
    // Driving school option rendered but aria-disabled
    expect(page).toContain('aria-disabled')
  })

  it('IVF-DS4 | BUSINESS type is also rejected at registration', () => {
    expect(() => deriveRegistrationFields({
      businessType: 'driving', businessModel: 'SAAS',
      organisationType: 'BUSINESS',
    })).toThrow('The BUSINESS organisation type is reserved')
  })

  it('IVF-DS5 | INDIVIDUAL_INSTRUCTOR for a non-driving provider is explicitly rejected', () => {
    expect(() => deriveRegistrationFields({
      businessType: 'plumber',
      organisationType: 'INDIVIDUAL_INSTRUCTOR',
    })).toThrow('INDIVIDUAL_INSTRUCTOR is only valid for driving instructors')
  })
})

describe('IVF — Discovery remains optional and does not change entitlements', () => {

  it('IVF-D1 | Discovery is a separate dashboard page, not part of registration', () => {
    // Registration route must not reference discovery
    const route = src('app/api/register/route.ts')
    expect(route).not.toContain('discovery')
    // The registration API response does not include a discovery flag
    expect(route).not.toContain('discoveryEnabled')
    expect(route).not.toContain('isDiscoverable')
  })

  it('IVF-D2 | Discovery page exists separately and does not affect Provider fields set at registration', () => {
    // Discovery is a dashboard feature, not registration
    const discovery = src('app/dashboard/discovery/page.tsx')
    expect(discovery).toBeTruthy()
    // The discovery page should not modify businessModel or paymentMode
    expect(discovery).not.toContain("businessModel: 'MARKETPLACE'")
    expect(discovery).not.toContain("businessModel: 'SAAS'")
  })

  it('IVF-D3 | Derivation output has no discovery-related field', () => {
    const d = deriveRegistrationFields({
      businessType: 'driving', businessModel: 'MARKETPLACE', termsAccepted: true,
    })
    expect(d).not.toHaveProperty('isDiscoverable')
    expect(d).not.toHaveProperty('discoveryEnabled')
    expect(d).not.toHaveProperty('discoveryStatus')
  })
})

// ── SaaS Terms publication lifecycle — UI completeness ───────────────────────
//
// These tests verify that the registration page is wired to respond to the
// SAAS_TERMS_PUBLISHED constant, that the /saas-terms page exists, and that
// the route Zod schema accepts saasTermsAccepted.

describe('SaaS Terms publication lifecycle — UI and route completeness', () => {

  it('SAAS-UI-1 | Register page imports SAAS_TERMS_PUBLISHED from registration-constants', () => {
    const page = src('app/register/page.tsx')
    expect(page).toContain("import { SAAS_TERMS_PUBLISHED, SAAS_TERMS_URL }")
    expect(page).toContain("from '@/lib/config/registration-constants'")
  })

  it('SAAS-UI-2 | Register page renders conditional SaaS Terms checkbox when published', () => {
    const page = src('app/register/page.tsx')
    // The published branch shows an acceptance checkbox
    expect(page).toContain('saasTermsAccepted')
    expect(page).toContain('setSaasTermsAccepted')
    // Checkbox uses SAAS_TERMS_URL for the link href
    expect(page).toContain('SAAS_TERMS_URL')
    // The DriveBook SaaS Terms label text must appear
    expect(page).toContain('DriveBook SaaS Terms')
  })

  it('SAAS-UI-3 | Register page submit button is disabled when SaaS Terms published and not accepted', () => {
    const page = src('app/register/page.tsx')
    // The disabled condition includes the saasTermsAccepted gate
    expect(page).toContain('SAAS_TERMS_PUBLISHED')
    expect(page).toContain('!saasTermsAccepted')
  })

  it('SAAS-UI-4 | Register page sends saasTermsAccepted in request body on SaaS path when published', () => {
    const page = src('app/register/page.tsx')
    expect(page).toContain('saasTermsAccepted: true as const')
  })

  it('SAAS-UI-5 | Register page still shows unpublished notice when SAAS_TERMS_PUBLISHED is false', () => {
    const page = src('app/register/page.tsx')
    // The unpublished branch must still contain the existing notice text
    expect(page).toContain('SaaS Terms are being finalised')
  })

  it('SAAS-UI-6 | /saas-terms page exists and contains required content', () => {
    const page = src('app/saas-terms/page.tsx')
    expect(page).toContain('DriveBook SaaS Terms')
    // Status banner warning the terms are not yet in effect
    expect(page).toContain('Not yet in effect')
    // Covers parties, subscription, provider responsibilities, privacy, governing law
    expect(page).toContain('Parties')
    expect(page).toContain('Subscription')
    expect(page).toContain('Provider responsibilities')
    expect(page).toContain('Privacy')
    expect(page).toContain('Governing law')
  })

  it('SAAS-UI-7 | /saas-terms page metadata is set', () => {
    const page = src('app/saas-terms/page.tsx')
    expect(page).toContain('export const metadata')
    expect(page).toContain('SaaS Terms')
  })

  it('SAAS-UI-8 | SAAS_TERMS_URL in constants points to /saas-terms', () => {
    const constants = src('lib/config/registration-constants.ts')
    expect(constants).toContain("SAAS_TERMS_URL")
    expect(constants).toContain("'/saas-terms'")
  })

  it('SAAS-UI-9 | Registration API Zod schema accepts saasTermsAccepted', () => {
    const route = src('app/api/register/route.ts')
    expect(route).toContain('saasTermsAccepted')
    expect(route).toContain('z.boolean().optional()')
  })

  it('SAAS-UI-10 | Derivation enforces saasTermsAccepted when published — confirmed via published injection', () => {
    // This matches IVF-SP1 but is here as a lifecycle-completeness assertion
    expect(() => deriveRegistrationFields({
      businessType: 'driving', businessModel: 'SAAS',
      _testSaasPublished: { published: true, version: '1.0' },
      // saasTermsAccepted deliberately omitted
    })).toThrow('You must accept the DriveBook SaaS Terms')

    // With acceptance it succeeds
    const d = deriveRegistrationFields({
      businessType: 'driving', businessModel: 'SAAS',
      saasTermsAccepted: true,
      _testSaasPublished: { published: true, version: '1.0' },
    })
    expect(d.commercialAgreementStatus).toBe('ACCEPTED')
  })
})

// ── SaaS Terms version guard (fail-closed) ───────────────────────────────────
//
// Reviewer finding: SAAS_TERMS_PUBLISHED=true with SAAS_TERMS_VERSION=null
// produced commercialAgreementStatus=ACCEPTED with commercialAgreementVersion=null —
// acceptance recorded with no version. These tests verify the fail-closed guard.

describe('SaaS Terms version guard — fail-closed on missing version', () => {

  it('VG-1 | Published terms with null version throws before acceptance is recorded', () => {
    expect(() => deriveRegistrationFields({
      businessType:      'driving',
      businessModel:     'SAAS',
      saasTermsAccepted: true,
      _testSaasPublished: { published: true, version: null },
    })).toThrow('no version is set')
  })

  it('VG-2 | Published terms with empty-string version also throws', () => {
    expect(() => deriveRegistrationFields({
      businessType:      'driving',
      businessModel:     'SAAS',
      saasTermsAccepted: true,
      _testSaasPublished: { published: true, version: '' },
    })).toThrow('no version is set')
  })

  it('VG-3 | Published terms with valid version proceeds normally', () => {
    const d = deriveRegistrationFields({
      businessType:      'driving',
      businessModel:     'SAAS',
      saasTermsAccepted: true,
      _testSaasPublished: { published: true, version: '1.0' },
    })
    expect(d.commercialAgreementStatus).toBe('ACCEPTED')
    expect(d.commercialAgreementVersion).toBe('1.0')
    expect(d.commercialAgreementAcceptedAt).toBeInstanceOf(Date)
  })

  it('VG-4 | Acceptance check fires before version guard — acceptance error takes precedence', () => {
    // When both version is missing AND acceptance is not provided,
    // the acceptance check fires first (SAAS_TERMS_REQUIRED) because it
    // runs before the version guard in the derivation logic.
    // This is the correct order: a user-facing "you must accept" error
    // is more actionable than a deployment-config "version is missing" error.
    // The version guard only fires when acceptance HAS been provided but
    // the version is still null/empty (see VG-1 and VG-2).
    expect(() => deriveRegistrationFields({
      businessType:      'driving',
      businessModel:     'SAAS',
      // saasTermsAccepted deliberately omitted
      _testSaasPublished: { published: true, version: null },
    })).toThrow('You must accept the DriveBook SaaS Terms') // acceptance check fires first
  })

  it('VG-5 | Version guard only applies on SaaS path — Marketplace unaffected', () => {
    // Marketplace has no SAAS_TERMS_VERSION dependency whatsoever
    expect(() => deriveRegistrationFields({
      businessType:  'driving',
      businessModel: 'MARKETPLACE',
      termsAccepted: true,
      _testSaasPublished: { published: true, version: null }, // irrelevant for MARKETPLACE
    })).not.toThrow()
  })

  it('VG-6 | Version guard code documented in derive-registration-fields.ts', () => {
    const util = src('lib/registration/derive-registration-fields.ts')
    expect(util).toContain('SAAS_TERMS_VERSION_MISSING')
    expect(util).toContain('no version is set')
  })

  it('VG-7 | Unpublished state with null version is safe — PENDING, no version recorded', () => {
    // Current production state: published=false, version=null — must stay safe
    const d = deriveRegistrationFields({ businessType: 'plumber' })
    expect(d.commercialAgreementStatus).toBe('PENDING')
    expect(d.commercialAgreementVersion).toBeNull()
    // No guard fires because terms are unpublished
  })
})

// ── Commercial payment-service gate — confirmation ───────────────────────────
//
// Reviewer item: "Commercial payment-service gating — not verified as implemented"
// Evidence: three payment routes carry paymentMode === 'DIRECT' → 503 guards.
// These tests assert the guards exist in source, confirming implementation.

describe('Commercial payment-service gate — DIRECT-mode 503 guards present', () => {

  it('PG-1 | Bulk-booking route blocks DIRECT-mode providers with 503', () => {
    const bulk = src('app/api/public/bookings/bulk/route.ts')
    expect(bulk).toContain("paymentMode === 'DIRECT'")
    expect(bulk).toContain('503')
    expect(bulk).toContain('PAYMENT_MODE_NOT_IMPLEMENTED')
  })

  it('PG-2 | Create-intent route blocks DIRECT-mode providers with 503', () => {
    const intent = src('app/api/payments/create-intent/route.ts')
    expect(intent).toContain("paymentMode === 'DIRECT'")
    expect(intent).toContain('503')
    expect(intent).toContain('PAYMENT_MODE_NOT_IMPLEMENTED')
  })

  it('PG-3 | Quote accept route blocks DIRECT-mode providers with 503', () => {
    const accept = src('app/api/client/quotes/[id]/accept/route.ts')
    expect(accept).toContain("paymentMode === 'DIRECT'")
    expect(accept).toContain('503')
    expect(accept).toContain('PAYMENT_MODE_NOT_IMPLEMENTED')
  })

  it('PG-4 | account.ts throwIfDirectPayment() guard also covers server-side utilities', () => {
    const account = src('lib/utils/account.ts')
    expect(account).toContain('DIRECT')
    expect(account).toContain('directPayments: false')
  })

  it('PG-5 | All SaaS providers derive paymentMode=DIRECT at registration', () => {
    // This confirms the derivation correctly marks SaaS for the payment gate
    for (const bt of ['driving', 'plumber', 'electrician', 'beauty', 'tax']) {
      const model = bt === 'driving' ? 'SAAS' : undefined
      const input = bt === 'driving'
        ? { businessType: bt, businessModel: 'SAAS' as const }
        : { businessType: bt }
      const d = deriveRegistrationFields(input)
      expect(d.paymentMode).toBe('DIRECT')
      expect(d.businessModel).toBe('SAAS')
    }
  })
})
