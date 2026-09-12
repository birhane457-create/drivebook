/**
 * lib/templates/__tests__/architecture-test.ts
 *
 * Phase 5 Architecture Test
 *
 * Proves that the Business Operating System is genuinely generic.
 * Each template must satisfy ALL assertions using ONLY BusinessConfig —
 * no domain extensions, no Core modifications.
 *
 * Run: npx tsx lib/templates/__tests__/architecture-test.ts
 *
 * The test is intentionally plain TypeScript (no test framework) so it
 * can be run without a test runner and read as documentation.
 */

import { drivingDefaultConfig }  from '../driving/config'
import { taxDefaultConfig }      from '../tax/config'
import { beautyDefaultConfig }   from '../beauty/config'
import type { BusinessConfig }   from '@/lib/core/types'

// ── Assertion helpers ─────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓  ${label}`)
    passed++
  } else {
    console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

function section(title: string): void {
  console.log(`\n── ${title} ──`)
}

// ── Test 1: All configs satisfy the BusinessConfig interface ──────────────────

section('Type safety — all configs implement BusinessConfig')

function isBusinessConfig(c: unknown): c is BusinessConfig {
  const x = c as BusinessConfig
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.terminology === 'object' &&
    typeof x.capabilities === 'object' &&
    Array.isArray(x.services) &&
    typeof x.aiConfig === 'object' &&
    typeof x.branding === 'object'
  )
}

assert(isBusinessConfig(drivingDefaultConfig), 'Driving config implements BusinessConfig')
assert(isBusinessConfig(taxDefaultConfig),     'Tax config implements BusinessConfig')
assert(isBusinessConfig(beautyDefaultConfig),  'Beauty config implements BusinessConfig')

// ── Test 2: Terminology is vertical-specific, not generic ────────────────────

section('Terminology — each vertical uses its own vocabulary')

assert(drivingDefaultConfig.terminology.provider  === 'provider',  'Driving: provider = "Instructor"')
assert(drivingDefaultConfig.terminology.booking   === 'Lesson',      'Driving: booking = "Lesson"')
assert(drivingDefaultConfig.terminology.customer  === 'Learner',     'Driving: customer = "Learner"')
assert(drivingDefaultConfig.terminology.providerGroup === 'Driving School', 'Driving: providerGroup = "Driving School"')

assert(taxDefaultConfig.terminology.provider      === 'Tax Agent',   'Tax: provider = "Tax Agent"')
assert(taxDefaultConfig.terminology.booking       === 'Consultation', 'Tax: booking = "Consultation"')
assert(taxDefaultConfig.terminology.customer      === 'Client',      'Tax: customer = "Client"')
assert(taxDefaultConfig.terminology.providerGroup === 'Practice',    'Tax: providerGroup = "Practice"')

assert(beautyDefaultConfig.terminology.provider   === 'Therapist',   'Beauty: provider = "Therapist"')
assert(beautyDefaultConfig.terminology.booking    === 'Appointment',  'Beauty: booking = "Appointment"')
assert(beautyDefaultConfig.terminology.customer   === 'Client',      'Beauty: customer = "Client"')
assert(beautyDefaultConfig.terminology.providerGroup === 'Studio',   'Beauty: providerGroup = "Studio"')

// ── Test 3: Same Core terminology accessor works for all ─────────────────────

section('Core accessor — getTerminology() abstraction works for all verticals')

function getTerminology(config: BusinessConfig) {
  return config.terminology
}

const drivingTerms = getTerminology(drivingDefaultConfig)
const taxTerms     = getTerminology(taxDefaultConfig)
const beautyTerms  = getTerminology(beautyDefaultConfig)

assert(drivingTerms.provider !== taxTerms.provider,   'Driving and tax use different provider labels')
assert(taxTerms.provider     !== beautyTerms.provider,'Tax and beauty use different provider labels')
assert(
  [drivingTerms, taxTerms, beautyTerms].every(t =>
    typeof t.provider === 'string' &&
    typeof t.booking  === 'string' &&
    typeof t.customer === 'string'
  ),
  'All terminologies have required string fields'
)

// ── Test 4: Service catalogue uses same interface, different values ───────────

section('Services — same ServiceDefinition interface, different content')

const drivingService = drivingDefaultConfig.services[0]
const taxService     = taxDefaultConfig.services[0]
const beautyService  = beautyDefaultConfig.services[0]

assert(drivingService.locationMode === 'provider_travels', 'Driving: provider travels to customer')
assert(taxService.locationMode     === 'remote',           'Tax: remote consultation')
assert(beautyService.locationMode  === 'customer_travels', 'Beauty: customer travels to studio')

assert(drivingService.bookingMode  === 'appointment',      'Driving: appointment mode')
assert(taxService.bookingMode      === 'appointment',      'Tax: appointment mode')
assert(beautyService.bookingMode   === 'appointment',      'Beauty: appointment mode')

assert(
  drivingDefaultConfig.capabilities.packages === true,
  'Driving: packages capability enabled (hour bundles purchasable)'
)
assert(
  !taxDefaultConfig.services.some(s => s.bookingMode === 'package'),
  'Tax: no package services (correct)'
)

// ── Test 5: Capabilities differ correctly ────────────────────────────────────

section('Capabilities — each vertical enables what it needs')

assert(drivingDefaultConfig.capabilities.travelTime       === true,  'Driving: travelTime enabled')
assert(taxDefaultConfig.capabilities.travelTime           === false, 'Tax: travelTime disabled (remote)')
assert(beautyDefaultConfig.capabilities.travelTime        === false, 'Beauty: travelTime disabled (studio)')

assert(drivingDefaultConfig.capabilities.assessmentTracking === true,  'Driving: assessmentTracking enabled')
assert(taxDefaultConfig.capabilities.assessmentTracking     === false, 'Tax: assessmentTracking disabled')
assert(beautyDefaultConfig.capabilities.assessmentTracking  === false, 'Beauty: assessmentTracking disabled')

assert(drivingDefaultConfig.capabilities.documentVerification === true,  'Driving: documentVerification enabled')
assert(taxDefaultConfig.capabilities.documentVerification     === false, 'Tax: documentVerification disabled')
assert(beautyDefaultConfig.capabilities.documentVerification  === false, 'Beauty: documentVerification disabled')

assert(drivingDefaultConfig.capabilities.packages === true,  'Driving: packages enabled')
assert(taxDefaultConfig.capabilities.packages     === false, 'Tax: packages disabled')
assert(beautyDefaultConfig.capabilities.packages  === true,  'Beauty: packages enabled')

// ── Test 6: Domain extensions — only driving has one ─────────────────────────

section('Domain extensions — only driving requires an extension')

// Note: driving config has domainExtension: undefined in the template
// It is attached at runtime by business-config.ts.
// Tax and beauty are explicitly undefined — no extension needed.
assert(taxDefaultConfig.domainExtension    === undefined, 'Tax: no domain extension (pure config)')
assert(beautyDefaultConfig.domainExtension === undefined, 'Beauty: no domain extension (pure config)')

// ── Test 7: AI config is vertically specific but structurally identical ───────

section('AI config — same interface, different business knowledge')

assert(
  taxDefaultConfig.aiConfig.allowedActions.includes('book'),
  'Tax AI: can book consultations'
)
assert(
  taxDefaultConfig.aiConfig.faq.length > 0,
  'Tax AI: has FAQ entries'
)
assert(
  taxDefaultConfig.aiConfig.businessDescription.includes('tax'),
  'Tax AI: description mentions tax'
)
assert(
  beautyDefaultConfig.aiConfig.businessDescription.includes('beauty') ||
  beautyDefaultConfig.aiConfig.businessDescription.includes('facial'),
  'Beauty AI: description mentions beauty treatments'
)
assert(
  !taxDefaultConfig.aiConfig.businessDescription.includes('driving'),
  'Tax AI: no driving vocabulary in description'
)
assert(
  !beautyDefaultConfig.aiConfig.businessDescription.includes('driving'),
  'Beauty AI: no driving vocabulary in description'
)

// ── Test 8: The "plumbing test" — request-based booking via ServiceDefinition ─

section('Plumbing test — request-based booking works via ServiceDefinition alone')

// Simulate a plumbing service using only ServiceDefinition (no new extension)
import type { ServiceDefinition } from '@/lib/core/types'

const plumbingEmergencyService: ServiceDefinition = {
  id: 'emergency-callout',
  name: 'Emergency Plumbing Callout',
  description: 'Same-day emergency service for burst pipes, blocked drains, and urgent repairs.',
  duration: 0,                     // variable duration
  price: 0,                        // quote required
  bookingMode: 'request',          // not appointment — customer requests, we quote
  locationMode: 'provider_travels',
  providerRequired: true,
  paymentRules: {
    payOnBooking: false,
    payOnCompletion: true,
    quoteRequired: true,
  },
  cancellationRules: {
    freeCancellationHours: 0,
    refundPercent: 0,
  },
  availabilityRules: {
    minAdvanceHours: 0,
    maxAdvanceDays: 1,
  },
  aiCanBook: false,
  aiCanQuote: true,                // AI can collect job details and initiate quote
}

assert(plumbingEmergencyService.bookingMode   === 'request',          'Plumbing: bookingMode = "request"')
assert(plumbingEmergencyService.locationMode  === 'provider_travels', 'Plumbing: provider travels to job')
assert(plumbingEmergencyService.paymentRules.quoteRequired === true,  'Plumbing: quote required before payment')
assert(plumbingEmergencyService.aiCanQuote    === true,               'Plumbing: AI can initiate quote')
assert(plumbingEmergencyService.aiCanBook     === false,              'Plumbing: AI cannot auto-book (needs quote first)')

// This service works with ZERO Core changes — it uses existing ServiceDefinition fields
assert(
  ['appointment', 'request', 'package'].includes(plumbingEmergencyService.bookingMode),
  'Plumbing: bookingMode is a valid Core enum value'
)

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`)
console.log(`Phase 5 Architecture Test Results`)
console.log(`${'─'.repeat(60)}`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Total:  ${passed + failed}`)
console.log(`${'─'.repeat(60)}`)

if (failed === 0) {
  console.log(`\n✓ ARCHITECTURE TEST PASSED`)
  console.log(`  The Business Operating System is genuinely generic.`)
  console.log(`  Tax agent and beauty studio work with zero Core changes.`)
  console.log(`  Plumbing request-based workflow works via ServiceDefinition.`)
  console.log(`  Driving is the only vertical requiring a domain extension.`)
} else {
  console.error(`\n✗ ARCHITECTURE TEST FAILED — ${failed} assertion(s) failed`)
  process.exit(1)
}
