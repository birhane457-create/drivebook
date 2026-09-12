/**
 * lib/templates/driving/config.ts
 *
 * Default BusinessConfig for a driving school.
 *
 * This is an ONBOARDING TEMPLATE — not a Core concept.
 * When a new driving school signs up, their BusinessConfig is pre-populated
 * from this template. They can then customise everything.
 *
 * Core never imports this file directly.
 * It is loaded by lib/core/business-config.ts during Phase 1,
 * and will be replaced by a DB-backed config in Phase 2.
 *
 * Rules:
 * - No business logic here — only configuration values
 * - No Prisma imports — this is pure data
 * - No references to other lib/ files — self-contained
 */

import type { BusinessConfig } from '@/lib/core/types'

export const drivingDefaultConfig: BusinessConfig = {
  // Phase 1: identity comes from env, not hardcoded
  id: 'platform',
  name: process.env.PLATFORM_NAME ?? 'DriveBook',
  legalName: process.env.PLATFORM_LEGAL_NAME ?? 'DriveBook Pty Ltd',
  abn: process.env.PLATFORM_ABN ?? '23 806 069 420',
  supportEmail: process.env.ADMIN_EMAIL ?? 'support@drivebook.com.au',
  timezone: 'Australia/Perth',

  // Driving schools use marketplace model:
  // platform collects from learners, pays instructors via Stripe Connect
  paymentModel: 'marketplace',

  terminology: {
    provider: 'provider',
    providers: 'Instructors',
    customer: 'Learner',
    customers: 'Learners',
    booking: 'Lesson',
    bookings: 'Lessons',
    service: 'Driving Lesson',
    services: 'Driving Lessons',
    providerGroup: 'Driving School',
  },

  capabilities: {
    onlineBooking: true,
    onlinePayments: true,
    quotes: false,               // driving schools don't use quote-based workflow
    packages: true,              // hour packages (6h, 10h, 15h)
    waitingList: true,
    reviews: true,
    aiReceptionist: true,
    voiceLine: true,
    mobileApp: true,
    googleCalendar: true,
    documentVerification: true,  // WWC, police check, driving authority licence
    travelTime: true,            // instructor travels to learner
    assessmentTracking: true,    // lesson feedback + PDA assessment
    websiteBuilder: true,
    // Payment model capabilities — marketplace: platform holds money
    wallet: true,                // learners top up a prepaid wallet
    payouts: true,               // platform pays instructors via Stripe Connect
    commission: true,            // platform takes commission per lesson
  },

  services: [
    {
      id: 'driving-lesson-60',
      name: '60-Minute Driving Lesson',
      description: 'Standard one-hour driving lesson with a qualified instructor.',
      duration: 60,
      price: 0,                  // set per-instructor, not platform-wide
      bookingMode: 'appointment',
      locationMode: 'provider_travels',
      providerRequired: true,
      paymentRules: {
        payOnBooking: true,
        payOnCompletion: false,
        quoteRequired: false,
      },
      cancellationRules: {
        freeCancellationHours: 48,
        refundPercent: 100,
      },
      availabilityRules: {
        minAdvanceHours: 2,
        maxAdvanceDays: 60,
      },
      aiCanBook: true,
      aiCanQuote: false,
    },
    {
      id: 'driving-lesson-90',
      name: '90-Minute Driving Lesson',
      description: 'Extended lesson — ideal for building confidence on busy roads.',
      duration: 90,
      price: 0,
      bookingMode: 'appointment',
      locationMode: 'provider_travels',
      providerRequired: true,
      paymentRules: {
        payOnBooking: true,
        payOnCompletion: false,
        quoteRequired: false,
      },
      cancellationRules: {
        freeCancellationHours: 48,
        refundPercent: 100,
      },
      availabilityRules: {
        minAdvanceHours: 2,
        maxAdvanceDays: 60,
      },
      aiCanBook: true,
      aiCanQuote: false,
    },
    {
      id: 'driving-lesson-120',
      name: '2-Hour Driving Lesson',
      description: 'Two-hour lesson for intensive practice or test preparation.',
      duration: 120,
      price: 0,
      bookingMode: 'appointment',
      locationMode: 'provider_travels',
      providerRequired: true,
      paymentRules: {
        payOnBooking: true,
        payOnCompletion: false,
        quoteRequired: false,
      },
      cancellationRules: {
        freeCancellationHours: 48,
        refundPercent: 100,
      },
      availabilityRules: {
        minAdvanceHours: 2,
        maxAdvanceDays: 60,
      },
      aiCanBook: true,
      aiCanQuote: false,
    },
    {
      id: 'pda-test-package',
      name: 'PDA Test Package',
      description: 'Practical Driving Assessment — includes pre-test lesson and test escort.',
      duration: 165,             // 2h45 — standard PDA duration
      price: 0,                  // set per-instructor config
      bookingMode: 'appointment',
      locationMode: 'provider_travels',
      providerRequired: true,
      paymentRules: {
        payOnBooking: true,
        payOnCompletion: false,
        quoteRequired: false,
      },
      cancellationRules: {
        freeCancellationHours: 48,
        refundPercent: 100,
      },
      availabilityRules: {
        minAdvanceHours: 24,     // PDA tests need more notice
        maxAdvanceDays: 90,
      },
      aiCanBook: false,          // PDA requires manual config selection — AI collects enquiry only
      aiCanQuote: false,
    },
  ],

  aiConfig: {
    businessDescription:
      'A professional driving school connecting learners with qualified, verified instructors. ' +
      'We offer flexible lesson packages, online booking, and secure payments.',
    openingHours: 'Mon–Sat 7am–7pm, Sun 8am–5pm',
    faq: [
      {
        question: "What should I bring to my first lesson?",
        answer: "Your learner's permit, comfortable closed-toe shoes, and glasses or contacts if you need them for driving.",
      },
      {
        question: "Where will my instructor pick me up?",
        answer: "You enter your pickup address when booking. Your instructor comes to you — home, work, or anywhere in the service area.",
      },
      {
        question: "What is the cancellation policy?",
        answer: "Full refund for cancellations 48+ hours before the lesson. 50% refund for 24–48 hours notice. No refund under 24 hours.",
      },
      {
        question: "Can I book a lesson if I've never driven before?",
        answer: "Absolutely. Most learners start with zero experience. Your instructor will tailor every lesson to your level.",
      },
      {
        question: "How do lesson packages work?",
        answer: "You pay upfront and the credit goes into your wallet. Your first lesson is booked immediately — schedule the rest from your dashboard whenever you like.",
      },
    ],
    allowedActions: ['book', 'reschedule', 'cancel', 'message'],
    greetingScript: "Thanks for calling. How can I help you today?",
    personality: 'friendly',
  },

  branding: {
    primaryColour: '#3B82F6',
    secondaryColour: '#10B981',
    theme: 'light',
  },

  subscriptionTier: 'BASIC',

  // The driving domain extension is registered separately.
  // See lib/extensions/assessment/ (Phase 3).
  // domainExtension is not set here — it is attached at runtime by the
  // extension registry when a business has assessmentTracking enabled.
  domainExtension: undefined,
}
