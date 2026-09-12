/**
 * lib/templates/tax/config.ts
 *
 * Default BusinessConfig for a tax / accounting practice.
 *
 * This is an ONBOARDING TEMPLATE — not a Core concept.
 * When a tax agent or accounting firm signs up, their BusinessConfig
 * is pre-populated from this template. They can customise everything.
 *
 * ARCHITECTURE TEST — Phase 5:
 *   This file must NOT import anything from lib/extensions/driving/
 *   This file must NOT require any Core modification to work
 *   This file uses ONLY lib/core/types.ts interfaces
 *
 * Acceptance criterion:
 *   businessConfig.terminology.provider === "Tax Agent"
 *   businessConfig.terminology.booking  === "Consultation"
 *   Zero lines changed in lib/core/, lib/services/, lib/rbac/
 */

import type { BusinessConfig } from '@/lib/core/types'

export const taxDefaultConfig: BusinessConfig = {
  id: 'platform',
  name: process.env.PLATFORM_NAME ?? 'TaxBook',
  legalName: process.env.PLATFORM_LEGAL_NAME ?? 'TaxBook Pty Ltd',
  abn: process.env.PLATFORM_ABN ?? '',
  supportEmail: process.env.ADMIN_EMAIL ?? 'support@taxbook.com.au',
  timezone: 'Australia/Sydney',

  // Tax agents bill customers directly — platform earns via subscription only
  paymentModel: 'saas',

  // ── Terminology ─────────────────────────────────────────────────────────────
  // Core reads these — never hardcodes "Instructor" or "Lesson"
  terminology: {
    provider: 'Tax Agent',
    providers: 'Tax Agents',
    customer: 'Client',
    customers: 'Clients',
    booking: 'Consultation',
    bookings: 'Consultations',
    service: 'Tax Service',
    services: 'Tax Services',
    providerGroup: 'Practice',
  },

  // ── Capabilities ─────────────────────────────────────────────────────────────
  // A tax practice uses appointments, payments, reminders, AI receptionist.
  // No travel time (remote), no assessment tracking, no document verification.
  capabilities: {
    onlineBooking: true,
    onlinePayments: true,
    quotes: false,               // tax consults have fixed prices, no quotes
    packages: false,             // no bulk session packages for tax
    waitingList: false,
    reviews: true,
    aiReceptionist: true,
    voiceLine: true,
    mobileApp: false,            // desktop-first for tax clients
    googleCalendar: true,
    documentVerification: false, // no regulatory licence checks needed
    travelTime: false,           // all remote/in-office, no travel
    assessmentTracking: false,   // no structured outcome scoring
    websiteBuilder: true,
    // Payment model capabilities — saas: provider bills customer directly
    wallet: false,
    payouts: false,
    commission: false,
  },

  // ── Service catalogue ────────────────────────────────────────────────────────
  // Same ServiceDefinition interface as driving — different values
  services: [
    {
      id: 'initial-consultation',
      name: 'Initial Tax Consultation',
      description: 'One-hour consultation to discuss your tax situation and requirements.',
      duration: 60,
      price: 250,
      bookingMode: 'appointment',
      locationMode: 'remote',      // video or phone call
      providerRequired: true,
      paymentRules: {
        depositPercent: 30,        // 30% deposit upfront
        payOnBooking: false,
        payOnCompletion: true,
        quoteRequired: false,
      },
      cancellationRules: {
        freeCancellationHours: 48,
        refundPercent: 100,
      },
      availabilityRules: {
        minAdvanceHours: 24,
        maxAdvanceDays: 90,
      },
      aiCanBook: true,
      aiCanQuote: false,
    },
    {
      id: 'individual-tax-return',
      name: 'Individual Tax Return',
      description: 'Preparation and lodgement of your personal income tax return.',
      duration: 45,
      price: 180,
      bookingMode: 'appointment',
      locationMode: 'remote',
      providerRequired: true,
      paymentRules: {
        payOnBooking: false,
        payOnCompletion: true,
        quoteRequired: false,
      },
      cancellationRules: {
        freeCancellationHours: 24,
        refundPercent: 100,
      },
      availabilityRules: {
        minAdvanceHours: 24,
        maxAdvanceDays: 90,
      },
      aiCanBook: true,
      aiCanQuote: false,
    },
    {
      id: 'bas-preparation',
      name: 'BAS Preparation',
      description: 'Business Activity Statement preparation and lodgement.',
      duration: 60,
      price: 220,
      bookingMode: 'appointment',
      locationMode: 'remote',
      providerRequired: true,
      paymentRules: {
        payOnBooking: false,
        payOnCompletion: true,
        quoteRequired: false,
      },
      cancellationRules: {
        freeCancellationHours: 24,
        refundPercent: 100,
      },
      availabilityRules: {
        minAdvanceHours: 24,
        maxAdvanceDays: 90,
      },
      aiCanBook: true,
      aiCanQuote: false,
    },
    {
      id: 'business-tax-return',
      name: 'Business Tax Return',
      description: 'Company or trust tax return preparation.',
      duration: 90,
      price: 0,                   // price varies — requires quote
      bookingMode: 'appointment',
      locationMode: 'remote',
      providerRequired: true,
      paymentRules: {
        payOnBooking: false,
        payOnCompletion: true,
        quoteRequired: true,      // price depends on complexity
      },
      cancellationRules: {
        freeCancellationHours: 24,
        refundPercent: 100,
      },
      availabilityRules: {
        minAdvanceHours: 48,
        maxAdvanceDays: 90,
      },
      aiCanBook: false,           // needs quote first
      aiCanQuote: true,           // AI can collect details and initiate quote
    },
  ],

  // ── AI receptionist ──────────────────────────────────────────────────────────
  // Same AIConfig interface — different business description and FAQ
  aiConfig: {
    businessDescription:
      'A professional tax and accounting practice providing personal and business ' +
      'tax services. We offer consultations, tax return preparation, and BAS lodgement.',
    openingHours: 'Mon–Fri 9am–5pm',
    faq: [
      {
        question: 'What do I need to bring to my consultation?',
        answer: 'For an initial consultation, just bring a summary of your income sources and any major expenses. We\'ll guide you through what documents we need after the first meeting.',
      },
      {
        question: 'How do I book a consultation?',
        answer: 'You can book online through our website or I can help you find a time right now. Consultations are available by phone or video call.',
      },
      {
        question: 'What is your cancellation policy?',
        answer: 'You can cancel or reschedule at no charge up to 24 hours before your consultation.',
      },
      {
        question: 'How much does a tax return cost?',
        answer: 'Individual tax returns start from $180. Business returns vary depending on complexity — we can provide a quote after a brief initial consultation.',
      },
      {
        question: 'Do you handle late tax returns?',
        answer: 'Yes, we can assist with overdue lodgements. Please book an initial consultation so we can assess your situation.',
      },
    ],
    allowedActions: ['book', 'reschedule', 'cancel', 'message'],
    greetingScript: 'Thank you for calling. How can I help you today?',
    personality: 'professional',
  },

  // ── Branding ─────────────────────────────────────────────────────────────────
  branding: {
    primaryColour: '#1e3a5f',    // deep navy — professional
    secondaryColour: '#c8a951',  // gold accent
    theme: 'light',
  },

  subscriptionTier: 'BASIC',

  // ── No domain extension ──────────────────────────────────────────────────────
  // Tax agents use ONLY Core capabilities + BusinessConfig.
  // No PDA assessment. No vehicle profiles. No regulatory document types.
  // domainExtension is intentionally undefined.
  domainExtension: undefined,
}
