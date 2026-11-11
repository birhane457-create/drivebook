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
 * When published, set this to the version string (e.g. '1.0') and update
 * SAAS_TERMS_PUBLISHED to true. The registration API will then:
 *   - Set commercialAgreementVersion = SAAS_TERMS_VERSION
 *   - Show the SaaS Terms checkbox to SaaS providers
 *   - Accept commercialAgreementStatus = ACCEPTED on acceptance
 */
export const SAAS_TERMS_VERSION:   string | null = null   // null = not published
export const SAAS_TERMS_PUBLISHED: boolean       = false

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

// ── AI capability map — derived from actual service template configurations ───
//
// Source of truth: lib/presets/{driving,beauty,tax,loader}.ts service definitions
//
// Each entry describes what the AI receptionist can and cannot do for that
// industry. Used by the discovery page to show accurate capability descriptions.
//
// aiCanBook:  At least one configured service has aiCanBook = true
// aiCanQuote: At least one configured service has aiCanQuote = true
// mixed:      true when aiCanBook and aiCanQuote are both true across different services
// calloutChargeConfigured: true only when a fixed call-out charge field exists in config
//             (currently false for all business types — no such config field exists yet)

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
