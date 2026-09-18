/**
 * lib/templates/beauty/config.ts
 *
 * Default BusinessConfig for a beauty studio / salon.
 *
 * ARCHITECTURE TEST — Phase 5:
 *   Uses ONLY lib/core/types.ts — no extensions, no Core changes.
 *   Tests: appointment-based booking, customer_travels locationMode,
 *          reviews capability, packages (treatment bundles).
 */

import type { BusinessConfig } from '@/lib/core/types'

export const beautyDefaultConfig: BusinessConfig = {
  id: 'platform',
  name: process.env.PLATFORM_NAME ?? 'BeautyBook',
  legalName: process.env.PLATFORM_LEGAL_NAME ?? 'BeautyBook Pty Ltd',
  abn: process.env.PLATFORM_ABN ?? '',
  supportEmail: process.env.ADMIN_EMAIL ?? 'support@beautybook.com.au',
  timezone: 'Australia/Melbourne',

  // Beauty studios bill customers directly — platform earns via subscription only
  paymentModel: 'saas',

  terminology: {
    provider: 'Therapist',
    providers: 'Therapists',
    customer: 'Client',
    customers: 'Clients',
    booking: 'Appointment',
    bookings: 'Appointments',
    service: 'Treatment',
    services: 'Treatments',
    providerGroup: 'Studio',
  },

  capabilities: {
    onlineBooking: true,
    onlinePayments: true,
    quotes: false,
    packages: true,              // treatment bundles (e.g. 5 facials)
    waitingList: true,
    reviews: true,
    aiReceptionist: true,
    voiceLine: true,
    mobileApp: true,
    googleCalendar: true,
    documentVerification: false,
    travelTime: false,           // clients come to the studio
    assessmentTracking: false,
    websiteBuilder: true,
    // Payment model capabilities — saas: studio bills customer directly
    wallet: false,
    payouts: false,
    commission: false,
  },

  // MM-10-C: beauty studios use saas model — no platform commission.
  commissionPercent: 0,

  services: [
    {
      id: 'facial-60',
      name: '60-Minute Facial',
      description: 'Relaxing and restorative facial treatment tailored to your skin type.',
      duration: 60,
      price: 120,
      bookingMode: 'appointment',
      locationMode: 'customer_travels',
      providerRequired: true,
      paymentRules: {
        payOnBooking: true,
        payOnCompletion: false,
        quoteRequired: false,
      },
      cancellationRules: {
        freeCancellationHours: 24,
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
      id: 'deep-tissue-massage-60',
      name: '60-Minute Deep Tissue Massage',
      description: 'Therapeutic massage targeting deep muscle tension and chronic pain.',
      duration: 60,
      price: 110,
      bookingMode: 'appointment',
      locationMode: 'customer_travels',
      providerRequired: true,
      paymentRules: {
        payOnBooking: true,
        payOnCompletion: false,
        quoteRequired: false,
      },
      cancellationRules: {
        freeCancellationHours: 24,
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
      id: 'facial-bundle-5',
      name: 'Facial Bundle — 5 Treatments',
      description: 'Pre-purchase 5 facials at a discounted rate. Schedule each at your convenience.',
      duration: 60,
      price: 540,                 // 5 × $120 = $600, save $60
      bookingMode: 'package',
      locationMode: 'customer_travels',
      providerRequired: true,
      paymentRules: {
        payOnBooking: true,
        payOnCompletion: false,
        quoteRequired: false,
      },
      cancellationRules: {
        freeCancellationHours: 24,
        refundPercent: 100,
      },
      availabilityRules: {
        minAdvanceHours: 2,
        maxAdvanceDays: 60,
      },
      aiCanBook: true,
      aiCanQuote: false,
    },
  ],

  aiConfig: {
    businessDescription:
      'A professional beauty studio offering facials, massage, and skin treatments. ' +
      'We use premium products and tailor every treatment to your skin and wellness needs.',
    openingHours: 'Tue–Sat 9am–6pm',
    faq: [
      {
        question: 'Do I need to prepare anything before my appointment?',
        answer: 'Arrive with clean skin if possible for facial treatments. For massage, avoid eating a heavy meal beforehand. We\'ll take care of everything else.',
      },
      {
        question: 'What is your cancellation policy?',
        answer: 'Free cancellation up to 24 hours before your appointment. Late cancellations may incur a fee.',
      },
      {
        question: 'Do you offer gift vouchers?',
        answer: 'Yes! Gift vouchers are available for all treatments. Ask us when booking or visit our website.',
      },
      {
        question: 'How do I book?',
        answer: 'You can book online through our website or I can help you right now. Just let me know which treatment you\'d like and I\'ll find you a time.',
      },
    ],
    allowedActions: ['book', 'reschedule', 'cancel', 'message'],
    greetingScript: 'Welcome! How can I help you today?',
    personality: 'friendly',
  },

  branding: {
    primaryColour: '#c8738a',    // rose pink
    secondaryColour: '#f5e6d3',  // warm cream
    theme: 'light',
  },

  subscriptionTier: 'BASIC',

  // No domain extension — beauty studio uses only Core + BusinessConfig
  domainExtension: undefined,
}
