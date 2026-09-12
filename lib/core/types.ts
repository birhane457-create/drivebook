/**
 * lib/core/types.ts
 *
 * Core type definitions for the Business Operating System.
 * These types are the foundation — no industry vocabulary allowed here.
 *
 * Every business that runs on this platform is configured through
 * BusinessConfig. Core never branches on industry type.
 */

// ── Service Definition ────────────────────────────────────────────────────────

/**
 * Describes a single service a business offers.
 * This is how Core supports completely different industries without
 * industry-specific code — the same engine, different configuration.
 */
export interface ServiceDefinition {
  id: string
  name: string           // "60-min Driving Lesson" | "Tax Consultation" | "Deep Tissue Massage"
  description?: string
  duration: number       // minutes — 0 means variable/TBD (for request-based services)
  price: number          // 0 means quote required

  /**
   * How this service is booked:
   * - appointment: standard time-slot booking (lesson, consult, treatment)
   * - request:     customer submits a request; provider responds with quote/confirm (plumber, electrician)
   * - package:     multi-session bulk purchase (10-hour lesson pack)
   */
  bookingMode: 'appointment' | 'request' | 'package'

  /**
   * Where the service is delivered:
   * - provider_travels:  provider goes to the customer (driving instructor, plumber)
   * - customer_travels:  customer comes to provider (beauty studio, mechanic)
   * - remote:            video/phone (tax agent, consultant)
   * - flexible:          either works
   */
  locationMode: 'provider_travels' | 'customer_travels' | 'remote' | 'flexible'

  providerRequired: boolean

  paymentRules: {
    depositPercent?: number    // e.g. 30 for 30% upfront
    payOnBooking: boolean
    payOnCompletion: boolean
    quoteRequired: boolean     // if true, price=0 and a quote is sent first
  }

  cancellationRules: {
    freeCancellationHours: number
    refundPercent: number      // 0–100
  }

  availabilityRules: {
    minAdvanceHours: number
    maxAdvanceDays: number
  }

  // AI receptionist permissions for this service
  aiCanBook: boolean    // AI can complete a full booking for this service
  aiCanQuote: boolean   // AI can initiate a quote request for this service
}

// ── Business Terminology ──────────────────────────────────────────────────────

/**
 * What a business calls the generic platform concepts.
 * Core uses these labels in any UI or notification it renders.
 */
export interface BusinessTerminology {
  provider: string        // "Instructor" | "Plumber" | "Tax Agent" | "Therapist"
  providers: string       // plural
  customer: string        // "Learner" | "Customer" | "Client"
  customers: string       // plural
  booking: string         // "Lesson" | "Job" | "Consultation" | "Appointment"
  bookings: string        // plural
  service: string         // "Driving Lesson" | "Plumbing Service" | "Treatment"
  services: string        // plural
  providerGroup: string   // "Driving School" | "Practice" | "Studio" | "Business"
}

// ── Business Capabilities ─────────────────────────────────────────────────────

/**
 * Which Core platform capabilities this business has enabled.
 * Subscription tier determines what is available to enable.
 */
export interface BusinessCapabilities {
  onlineBooking: boolean
  onlinePayments: boolean
  quotes: boolean              // request → quote → approval → booking workflow
  packages: boolean            // multi-session / bulk purchase packages
  waitingList: boolean
  reviews: boolean
  aiReceptionist: boolean      // AI receptionist phone line
  voiceLine: boolean           // dedicated Twilio phone number
  mobileApp: boolean
  googleCalendar: boolean
  documentVerification: boolean   // provider licence/compliance document checks
  travelTime: boolean             // travel time added between bookings
  assessmentTracking: boolean     // structured outcome tracking per booking
  websiteBuilder: boolean         // configurable public website

  // ── Payment Model Capabilities ──────────────────────────────────────────
  // Set by the onboarding gate based on BusinessConfig.paymentModel.
  // marketplace → wallet=true, payouts=true, commission=true
  // saas        → wallet=false, payouts=false, commission=false
  //
  // wallet     — customers hold a prepaid credit balance (marketplace only)
  wallet: boolean
  // payouts    — platform collects, then pays provider via Stripe Connect (marketplace only)
  payouts: boolean
  // commission — platform takes a percentage cut per transaction (marketplace only)
  commission: boolean
}

// ── AI Receptionist Config ────────────────────────────────────────────────────

export interface FAQEntry {
  question: string
  answer: string
}

export interface AIConfig {
  businessDescription: string
  openingHours: string
  faq: FAQEntry[]
  allowedActions: Array<'book' | 'reschedule' | 'cancel' | 'quote' | 'message' | 'payment'>
  greetingScript?: string
  personality?: string          // e.g. "professional", "friendly", "concise"
}

// ── Branding ──────────────────────────────────────────────────────────────────

export interface BusinessBranding {
  logo?: string                 // URL
  primaryColour: string         // hex
  secondaryColour?: string      // hex
  fontFamily?: string
  theme: 'light' | 'dark'
}

// ── Domain Extension ──────────────────────────────────────────────────────────

/**
 * An escape hatch for genuinely unique domain logic that cannot be expressed
 * through BusinessConfig or ServiceDefinition alone.
 *
 * Extensions are named after the CAPABILITY they provide, not the industry:
 *   "assessment"           — structured outcome scoring (driving, flight, trades)
 *   "regulatory-documents" — compliance doc types + expiry (driving, plumbing, electrical)
 *   "vehicle-profile"      — vehicle details attached to a provider (driving, courier)
 *
 * NOT named after industries:
 *   "driving"    ← wrong framing
 *   "plumbing"   ← premature
 *
 * Core calls hooks. Core never imports extension modules directly.
 * Most businesses will NOT have a DomainExtension.
 */
export interface TimeSlot {
  start: Date
  end: Date
}

export interface AvailabilityContext {
  providerId: string
  date: Date
  durationMinutes: number
}

export interface FieldDefinition {
  key: string
  label: string
  type: 'text' | 'date' | 'file' | 'select' | 'boolean'
  required: boolean
  options?: string[]           // for select type
  acceptedFileTypes?: string[] // for file type
}

export interface NavItem {
  label: string
  href: string
  icon?: string
}

export interface DomainExtension {
  slug: string

  /**
   * Hooks called by Core at defined points.
   * Core never calls extension code outside of these hooks.
   */
  hooks: {
    additionalSlotBlocker?: (slot: TimeSlot, ctx: AvailabilityContext) => boolean
    onBookingCreated?: (bookingId: string, data: unknown) => Promise<void>
    providerProfileFields?: () => FieldDefinition[]
    bookingOutcomeFields?: () => FieldDefinition[]
    adminNavItems?: () => NavItem[]
  }

  /**
   * Payment extension — only present for marketplace verticals (e.g. driving school)
   * where the platform collects customer money and pays providers.
   *
   * For all other verticals (plumber, tax agent, beauty etc.) this is undefined.
   * Providers charge customers directly. Platform earns via SaaS subscription only.
   *
   * BookingService calls these hooks:
   *   await extension.paymentExtension?.onBookingConfirmed?.(bookingId, amount)
   *   await extension.paymentExtension?.onBookingCancelled?.(bookingId, refundAmount)
   *   await extension.paymentExtension?.onBookingCompleted?.(bookingId)
   *
   * Core never imports wallet, ledger, or Stripe Connect code directly.
   */
  paymentExtension?: {
    mode: 'wallet' | 'stripe_direct' | 'invoice' | 'external'
    onBookingConfirmed?: (bookingId: string, amount: number) => Promise<void>
    onBookingCancelled?: (bookingId: string, refundAmount: number) => Promise<void>
    onBookingCompleted?: (bookingId: string) => Promise<void>
  }
}

// ── Business Config ───────────────────────────────────────────────────────────

/**
 * The complete configuration for a single business tenant.
 * Loaded on every request after domain resolution.
 * Controls everything about how the platform behaves for this business.
 *
 * This is the primary abstraction. Core never branches on industry type —
 * it reads from BusinessConfig instead.
 */
export interface BusinessConfig {
  // Identity
  id: string                    // Business DB record ID
  name: string                  // "Smith Tax & Accounting" | "Perth Drive Academy"
  legalName?: string
  abn?: string
  supportEmail: string
  timezone: string              // IANA timezone e.g. "Australia/Perth"

  /**
   * Payment model — set once at onboarding, drives capability flags.
   *
   * 'marketplace' — platform collects customer payments, then pays providers.
   *                 Enables: wallet, payouts, commission, Stripe Connect.
   *                 Used by: driving schools, any business where the platform
   *                 holds money in transit.
   *
   * 'saas'        — providers charge customers directly.
   *                 Platform earns via monthly subscription fee only.
   *                 Disables: wallet, payouts, commission.
   *                 Used by: plumbers, electricians, tax agents, beauty studios,
   *                 and any business that bills customers themselves.
   */
  paymentModel: 'marketplace' | 'saas'

  // What this business calls Core concepts
  terminology: BusinessTerminology

  // Which platform capabilities are active for this business
  capabilities: BusinessCapabilities

  // The services this business offers
  services: ServiceDefinition[]

  // AI receptionist configuration
  aiConfig: AIConfig

  // Visual branding
  branding: BusinessBranding

  // Subscription tier — BASIC | PRO | STUDIO | PREMIUM
  // NOTE: 'BUSINESS' is NOT a valid tier. It was renamed to PREMIUM.
  //       accountType ('INDIVIDUAL'|'BUSINESS') is a separate concept — legal entity type.
  subscriptionTier: 'BASIC' | 'PRO' | 'STUDIO' | 'PREMIUM'

  /**
   * Optional domain extension — present only when this business has
   * genuinely unique workflow requirements that cannot be expressed
   * through BusinessConfig or ServiceDefinition.
   *
   * Most businesses will NOT have this set.
   */
  domainExtension?: DomainExtension
}

// ── Subscription Tiers ────────────────────────────────────────────────────────
// These are the subscription plan tiers (NOT accountType).
// accountType = 'INDIVIDUAL' | 'BUSINESS' (legal entity — independent of tier).
// DB column for PREMIUM commission is `businessCommissionRate` (legacy name — do NOT rename).
export type SubscriptionTier = 'BASIC' | 'PRO' | 'STUDIO' | 'PREMIUM'
