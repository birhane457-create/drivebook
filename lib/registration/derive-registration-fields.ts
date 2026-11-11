/**
 * derive-registration-fields.ts
 *
 * Single source of truth for server-side registration field derivation.
 *
 * Both the registration API and the test suite import this module.
 * Tests exercise the same logic the production route uses — not a duplicate.
 *
 * Rules:
 * - All derivation is server-side. Browser input is validated, not trusted.
 * - `paymentMode` is derived from `businessModel`, never supplied by browser.
 * - `commercialAgreementType` is derived from `businessModel`, never from browser.
 * - `organisationType` for driving is always INDIVIDUAL_INSTRUCTOR or rejected.
 * - Non-driving providers may select SOLE_TRADER or REGISTERED_BUSINESS.
 * - Privacy version and timestamp are always server-controlled constants.
 * - Marketplace acceptance requires explicit `termsAccepted === true`.
 * - SaaS commercial agreement remains PENDING while SaaS Terms are unpublished.
 * - `User.termsAcceptedAt` / `User.termsVersion` are Instructor Terms (MARKETPLACE)
 *   legacy fields. They are only written for MARKETPLACE providers.
 *   SaaS agreement acceptance is recorded in Provider.commercialAgreement* only.
 */

import {
  MARKETPLACE_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
  SAAS_TERMS_VERSION,
  SAAS_TERMS_PUBLISHED,
  type OrganisationType,
} from '@/lib/config/registration-constants'

// ── Input shape ──────────────────────────────────────────────────────────────

export interface RegistrationInput {
  businessType:      string                               // 'driving' | 'plumber' | ...
  businessModel?:    'MARKETPLACE' | 'SAAS' | undefined  // driving instructors only
  organisationType?: string | undefined                   // optional; non-driving may supply
  termsAccepted?:    boolean | undefined                  // Marketplace acceptance
  saasTermsAccepted?: boolean | undefined                 // SaaS acceptance (when published)
  /**
   * Override for testing: inject SaaS Terms publication state without changing
   * the module-level constants. If omitted, the production constants are used.
   * Never supply this in production — it is for test isolation only.
   */
  _testSaasPublished?: { published: boolean; version: string | null }
}

// ── Output shape ─────────────────────────────────────────────────────────────

export interface DerivedRegistrationFields {
  businessModel:               'MARKETPLACE' | 'SAAS'
  paymentMode:                 'PLATFORM' | 'DIRECT'
  organisationType:            OrganisationType
  commercialAgreementType:     'MARKETPLACE_TERMS' | 'SAAS_TERMS'
  commercialAgreementStatus:   'ACCEPTED' | 'PENDING'
  commercialAgreementVersion:  string | null
  commercialAgreementAcceptedAt: Date | null
  privacyPolicyVersion:        string
  privacyPolicyAcceptedAt:     Date
  /** When to write User.termsAcceptedAt — null means do not write */
  userTermsAcceptedAt:         Date | null
  /** Version to write to User.termsVersion — null means do not write */
  userTermsVersion:            string | null
}

// ── Validation error (thrown before any DB writes) ───────────────────────────

export class RegistrationValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'RegistrationValidationError'
  }
}

// ── Derivation ───────────────────────────────────────────────────────────────

/**
 * Derives all server-side registration fields from the validated input.
 *
 * Throws `RegistrationValidationError` for:
 * - MARKETPLACE registration without `termsAccepted === true`
 * - DRIVING_SCHOOL organisation type (not yet available)
 *
 * These errors must be surfaced to the caller as 400 responses
 * before any database writes occur.
 */
export function deriveRegistrationFields(input: RegistrationInput): DerivedRegistrationFields {
  const { businessType, businessModel: suppliedModel, organisationType: suppliedOrgType, termsAccepted, saasTermsAccepted, _testSaasPublished } = input
  const isDriving = businessType === 'driving'

  // Resolve SaaS Terms publication state.
  // In production: always read from the module-level constants.
  // In tests: _testSaasPublished may inject a different state without touching constants.
  const saasPublished = _testSaasPublished !== undefined ? _testSaasPublished.published : SAAS_TERMS_PUBLISHED
  const saasVersion   = _testSaasPublished !== undefined ? _testSaasPublished.version   : SAAS_TERMS_VERSION

  // ── Business model and payment mode ────────────────────────────────────────
  // - Driving + SAAS → SAAS + DIRECT
  // - Driving + omitted/MARKETPLACE → MARKETPLACE + PLATFORM (backward compat)
  // - Non-driving → always SAAS + DIRECT regardless of supplied value
  const businessModel: 'MARKETPLACE' | 'SAAS' =
    isDriving && suppliedModel === 'SAAS' ? 'SAAS'
    : isDriving ? 'MARKETPLACE'
    : 'SAAS'

  const paymentMode: 'PLATFORM' | 'DIRECT' = businessModel === 'SAAS' ? 'DIRECT' : 'PLATFORM'

  // ── Marketplace acceptance enforcement ────────────────────────────────────
  // Must reject BEFORE any DB writes. The Instructor Terms (v2.0) are published
  // and must be explicitly accepted before a Marketplace account is created.
  if (businessModel === 'MARKETPLACE' && termsAccepted !== true) {
    throw new RegistrationValidationError(
      'MARKETPLACE_TERMS_REQUIRED',
      'You must accept the Instructor Terms and Conditions to register on the DriveBook Marketplace.'
    )
  }

  // ── SAAS Terms enforcement (when published) ──────────────────────────────
  // When SAAS_TERMS_PUBLISHED = true, SaaS Terms must be explicitly accepted.
  // While unpublished: no acceptance required; status remains PENDING.
  if (businessModel === 'SAAS' && saasPublished && saasTermsAccepted !== true) {
    throw new RegistrationValidationError(
      'SAAS_TERMS_REQUIRED',
      'You must accept the DriveBook SaaS Terms to register.'
    )
  }

  // ── Organisation type ─────────────────────────────────────────────────────
  // DRIVING_SCHOOL: designed but not yet available — reject before DB writes.
  if (isDriving && suppliedOrgType === 'DRIVING_SCHOOL') {
    throw new RegistrationValidationError(
      'DRIVING_SCHOOL_NOT_AVAILABLE',
      'Driving school registration is not yet available. Please register as an independent instructor and contact support when the driving school feature becomes available.'
    )
  }

  // BUSINESS: reserved for multi-provider architecture — never assignable at registration.
  if (suppliedOrgType === 'BUSINESS') {
    throw new RegistrationValidationError(
      'ORGANISATION_TYPE_NOT_AVAILABLE',
      'The BUSINESS organisation type is reserved and cannot be selected at registration.'
    )
  }

  // INDIVIDUAL_INSTRUCTOR supplied for a non-driving provider is a mismatch —
  // reject explicitly rather than silently converting.
  if (!isDriving && suppliedOrgType === 'INDIVIDUAL_INSTRUCTOR') {
    throw new RegistrationValidationError(
      'INVALID_ORGANISATION_TYPE',
      'INDIVIDUAL_INSTRUCTOR is only valid for driving instructors. Please select SOLE_TRADER or REGISTERED_BUSINESS.'
    )
  }

  let organisationType: OrganisationType
  if (isDriving) {
    // Driving instructors are always INDIVIDUAL_INSTRUCTOR at this stage.
    organisationType = 'INDIVIDUAL_INSTRUCTOR'
  } else {
    // Non-driving providers may select SOLE_TRADER or REGISTERED_BUSINESS.
    // If the caller supplies REGISTERED_BUSINESS, honour it.
    // Default is SOLE_TRADER.
    // BUSINESS is reserved for multi-provider architecture — never assigned here.
    organisationType =
      suppliedOrgType === 'REGISTERED_BUSINESS' ? 'REGISTERED_BUSINESS' : 'SOLE_TRADER'
  }

  // ── Commercial agreement ──────────────────────────────────────────────────
  // Type is determined by businessModel, never from the browser.
  //
  // MARKETPLACE: Instructor Terms v2.0 are published.
  //   - termsAccepted=true (enforced above) → ACCEPTED, version 2.0, timestamp now
  //
  // SAAS: SaaS Terms not yet published.
  //   - status = PENDING, version = null, acceptedAt = null
  //   - When SAAS_TERMS_PUBLISHED flips to true in constants, this path
  //     automatically records the published version.
  const commercialAgreementType = businessModel === 'MARKETPLACE' ? 'MARKETPLACE_TERMS' : 'SAAS_TERMS'

  const commercialAgreementStatus: 'ACCEPTED' | 'PENDING' =
    businessModel === 'MARKETPLACE' ? 'ACCEPTED'   // termsAccepted validated above
    : businessModel === 'SAAS' && saasPublished && saasTermsAccepted === true ? 'ACCEPTED'
    : 'PENDING'

  const commercialAgreementVersion: string | null =
    businessModel === 'MARKETPLACE' ? MARKETPLACE_TERMS_VERSION
    : saasPublished                  ? saasVersion
    : null

  const commercialAgreementAcceptedAt: Date | null =
    commercialAgreementStatus === 'ACCEPTED' ? new Date() : null

  // ── Privacy consent ───────────────────────────────────────────────────────
  // Version and timestamp always set server-side from published constants.
  // privacyAccepted is validated by z.literal(true) in the Zod schema;
  // by the time we reach this function, it has already been verified.
  const privacyPolicyVersion    = PRIVACY_POLICY_VERSION
  const privacyPolicyAcceptedAt = new Date()

  // ── User.terms* fields — MARKETPLACE ONLY ────────────────────────────────
  // User.termsAcceptedAt and User.termsVersion are legacy Instructor Terms
  // (Marketplace) acceptance fields. They must only be populated when a
  // MARKETPLACE provider accepts the Instructor Terms.
  //
  // SaaS agreement acceptance is recorded exclusively in Provider.commercialAgreement*.
  // SaaS terms are distinct from Instructor Terms and must not share these fields.
  //
  // Important: app/api/public/bookings/route.ts also writes User.termsAcceptedAt
  // for CLIENT registrations — that is a separate path and is not affected here.
  const userTermsAcceptedAt: Date | null =
    businessModel === 'MARKETPLACE' ? new Date() : null
  const userTermsVersion: string | null =
    businessModel === 'MARKETPLACE' ? MARKETPLACE_TERMS_VERSION : null

  return {
    businessModel,
    paymentMode,
    organisationType,
    commercialAgreementType,
    commercialAgreementStatus,
    commercialAgreementVersion,
    commercialAgreementAcceptedAt,
    privacyPolicyVersion,
    privacyPolicyAcceptedAt,
    userTermsAcceptedAt,
    userTermsVersion,
  }
}
