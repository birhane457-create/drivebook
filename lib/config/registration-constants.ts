/**
 * Registration constants — single source of truth for published document versions
 * and AI capability descriptions used at registration and in provider discovery.
 *
 * IMPORTANT: When a new version of a legal document is published, update ONLY
 * the constant here. The registration API and test suite both import from this
 * file so a change here propagates to both automatically.
 */

// ── Published document versions ──────────────────────────────────────────────

/**
 * Instructor Terms and Conditions — currently published at /instructor-terms
 * Version shown on page: "Version 2.0 · Effective: 6 August 2026"
 * This is the MARKETPLACE commercial agreement.
 */
export const MARKETPLACE_TERMS_VERSION = '2.0'

/**
 * Privacy Policy — currently published at /privacy
 * Version shown on page: "Version 2.0 · Effective: 6 August 2026"
 */
export const PRIVACY_POLICY_VERSION = '2.0'

/**
 * SaaS Terms — NOT YET PUBLISHED.
 *
 * Transition procedure when SaaS Terms are published:
 *   1. Set SAAS_TERMS_VERSION to the published version string (e.g. '1.0')
 *   2. Set SAAS_TERMS_PUBLISHED to true
 *
 * Effects (automatic — no other code changes required):
 *   - Registration API enforces saasTermsAccepted=true for SaaS registrations
 *   - Register page shows SaaS Terms checkbox (linking to SAAS_TERMS_URL)
 *   - Derivation utility produces ACCEPTED status, records version and timestamp
 *   - New SaaS registrations without acceptance are rejected with SAAS_TERMS_REQUIRED
 *
 * IMPORTANT: Existing SaaS providers registered before this flip will retain
 *   commercialAgreementStatus=PENDING until they explicitly accept the terms.
 *   A separate acceptance flow (not in registration) must handle existing accounts.
 */
export const SAAS_TERMS_VERSION:   string | null = process.env.SAAS_TERMS_VERSION_OVERRIDE   ?? null   // null = not published
export const SAAS_TERMS_PUBLISHED: boolean       = process.env.SAAS_TERMS_PUBLISHED_OVERRIDE === 'true'
export const SAAS_TERMS_URL:       string        = '/saas-terms' // future URL when published

// ── Organisation type values ──────────────────────────────────────────────────

export type OrganisationType =
  | 'INDIVIDUAL_INSTRUCTOR'   // driving instructor operating independently
  | 'DRIVING_SCHOOL'          // school with multiple instructors (designed, not yet enabled)
  | 'SOLE_TRADER'             // non-driving sole trader (plumber/electrician/beauty/tax default)
  | 'REGISTERED_BUSINESS'     // non-driving registered company (ABN, ACN or equivalent)
  | 'BUSINESS'                // multi-provider organisation (reserved; not assigned at registration)

export const ORGANISATION_TYPES = {
  INDIVIDUAL_INSTRUCTOR: 'INDIVIDUAL_INSTRUCTOR',
  DRIVING_SCHOOL:        'DRIVING_SCHOOL',
  SOLE_TRADER:           'SOLE_TRADER',
  REGISTERED_BUSINESS:   'REGISTERED_BUSINESS',
  BUSINESS:              'BUSINESS',
} as const

// ── AI capability map — maintained snapshot of actual service template configs ─
//
// This map is a MAINTAINED SNAPSHOT. It must agree with the actual template
// configurations in lib/presets/{driving,beauty,tax,loader}.ts. Tests in
// __tests__/integration/reg-phase2-architecture.test.ts verify this agreement
// and will fail if the templates change without updating this map.
//
// Effective capability = intersection of:
//   1. Service-level aiCanBook / aiCanQuote (from service definitions)
//   2. Business-level allowedActions (from aiConfig, the operative executable gate)
//
// 'quote' action is executable only when it appears in allowedActions.
// The app/api/business/ai-config/route.ts Zod schema confirms allowedActions
// is the gate: z.array(z.enum(['book','reschedule','cancel','quote','message','payment'])).
//
// calloutChargeConfigured: true only when a fixed call-out charge field exists
//   in the template config. Currently false for all types — no such field exists.
//
// Source: lib/presets/{driving,beauty,tax,loader}.ts

export interface AiCapabilityProfile {
  aiCanBook:              boolean
  aiCanQuote:            boolean
  mixed:                 boolean   // some services book, some quote-only
  calloutChargeConfigured: boolean // a configured fixed call-out charge exists
  allowedActions:        string[]  // from aiConfig.allowedActions
}

export const AI_CAPABILITY_MAP: Record<string, AiCapabilityProfile> = {
  driving: {
    // Driving config: 60min, 90min, 2h lessons → aiCanBook=true, aiCanQuote=false
    // PDA Test Package → aiCanBook=false (but other services cover booking)
    // allowedActions: ['book', 'reschedule', 'cancel', 'message'] ✅
    aiCanBook:              true,
    aiCanQuote:            false,
    mixed:                 false,
    calloutChargeConfigured: false,
    allowedActions:        ['book', 'reschedule', 'cancel', 'message'],
  },
  beauty: {
    // Beauty config: all services aiCanBook=true, aiCanQuote=false
    // allowedActions: ['book', 'reschedule', 'cancel', 'message'] ✅
    aiCanBook:              true,
    aiCanQuote:            false,
    mixed:                 false,
    calloutChargeConfigured: false,
    allowedActions:        ['book', 'reschedule', 'cancel', 'message'],
  },
  tax: {
    // Tax config: initial consultation, individual return, BAS → aiCanBook=true
    // Business Tax Return → aiCanBook=false, aiCanQuote=true
    // BUT: tax aiConfig.allowedActions = ['book', 'reschedule', 'cancel', 'message']
    // 'quote' is NOT in allowedActions — the quote path is not executable.
    // Effective capability = intersection of service config AND allowedActions.
    // Therefore: aiCanBook=true, aiCanQuote=false (quote not in allowedActions).
    // The Business Tax Return note is for the provider's own quoting process,
    // not an AI-executable action.
    aiCanBook:              true,
    aiCanQuote:            false,   // 'quote' not in tax allowedActions — not executable
    mixed:                 false,   // treated as booking-only given the action constraint
    calloutChargeConfigured: false,
    allowedActions:        ['book', 'reschedule', 'cancel', 'message'],
  },
  plumber: {
    // Generic trade loader: all services aiCanBook=false, aiCanQuote=true
    // allowedActions: ['quote', 'message'] ✅ — quote IS executable
    aiCanBook:              false,
    aiCanQuote:            true,
    mixed:                 false,
    calloutChargeConfigured: false, // no callout charge config field exists in templates
    allowedActions:        ['quote', 'message'],
  },
  electrician: {
    // Same as plumber — generic trade loader
    aiCanBook:              false,
    aiCanQuote:            true,
    mixed:                 false,
    calloutChargeConfigured: false,
    allowedActions:        ['quote', 'message'],
  },
}

/**
 * Fallback profile for unknown business types.
 * Fails CLOSED — assumes no AI capability when the business type is unrecognised.
 * This prevents advertising booking or quoting for untested configurations.
 */
export const AI_CAPABILITY_DEFAULT: AiCapabilityProfile = {
  aiCanBook:              false,  // fail closed — unknown type, do not assume booking
  aiCanQuote:            false,
  mixed:                 false,
  calloutChargeConfigured: false,
  allowedActions:        [],
}

/** Returns the AI capability profile for a given industry/businessType */
export function getAiCapabilityProfile(businessType: string | undefined): AiCapabilityProfile {
  if (!businessType) return AI_CAPABILITY_DEFAULT
  return AI_CAPABILITY_MAP[businessType] ?? AI_CAPABILITY_DEFAULT
}
