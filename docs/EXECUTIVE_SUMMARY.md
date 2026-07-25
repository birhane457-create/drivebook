# DriveBook — Executive Summary

**Last updated:** July 2026  
**Based on:** Full codebase audit cross-referenced against platform claims

---

## Overview

DriveBook is an Australian online marketplace connecting learner drivers with qualified driving instructors for lesson booking, payment, and progress tracking. The platform is focused on the Western Australian market and automates the administrative burden for instructors while offering students a convenient, transparent booking experience.

---

## Product and Service

**For learners:** Find local instructors, compare profiles and ratings, book lessons online or through a 24/7 AI phone receptionist, pay securely via Stripe, receive SMS confirmations and reminders, and track lesson progress over time.

**For instructors:** Scheduling dashboard, CRM-style student management, automated reminders, Stripe payment handling, lesson notes with COACHING/MOCK assessment types, branded booking pages, and an AI voice receptionist that captures missed calls and books lessons from live availability.

---

## Business Model

Two-sided marketplace. Learners pay no platform fee. Instructors pay:
- A tiered commission per completed lesson (locked at booking creation time — immutable, DB-backed rate)
- Optional monthly/annual subscription for premium features (Basic / Pro / Studio / Business)

Revenue scales directly with lesson volume. No setup fee for instructors. Free 14–30 day trial on all plans.

---

## Current Implementation Status

| Feature | Claimed | Built | Notes |
|---------|---------|-------|-------|
| Online booking (web) | ✅ | ✅ | Both instructor-initiated and public flows |
| AI phone receptionist | ✅ | ✅ | VAPI + drivebook-hybrid proxy on Railway |
| Stripe payments & wallet | ✅ | ✅ | Production-grade with dispute handling |
| SMS confirmations | ✅ | ✅ | Twilio, with retry queue |
| Booking reminders | ✅ | ✅ | Rolling time-window logic, Perth timezone |
| Package bookings (6/10/15h) | ✅ | ✅ | Server-side pricing, discount locked |
| Cancellation / refund policy | ✅ | ✅ | Tiered refunds, atomic transactions, DB-backed windows |
| Instructor subscription plans | ✅ | ✅ | Stripe Subscriptions, trial expiry cron, all 4 tiers live |
| Admin subscription management | ✅ | ✅ | Full tab on instructor profile + list page |
| Weekly instructor payouts | ✅ | ✅ | Stripe Connect, dispute-hold gate, DB-backed buffer |
| Student progress tracking | ✅ | Partial | COACHING notes + MOCK PDA scores — no full skills matrix |
| Lesson feedback (COACHING/MOCK) | ✅ | ✅ | Two assessment types, score only for MOCK |
| Reviews & ratings | ✅ | ✅ | On booking records, aggregated to instructor profile |
| Admin dashboard | ✅ | ✅ | All major sections, including Subscriptions list and Cron Jobs |
| BUSINESS tier (school identity) | ✅ | ✅ | businessName on all student-facing surfaces, VAPI deferred |
| Multi-instructor (Business plan) | Partial | ❌ | Schema foundation present, Phase 2 |
| Custom subdomain (Studio plan) | ✅ | ✅ | SubdomainBookingWizard implemented |
| Document verification system | ✅ | ✅ | Full admin review UI with approve/reject/expiry |
| Admin cron health dashboard | ✅ | ✅ | `/admin/cron-jobs` with live status, auto-refresh |
| Data export | ✅ | ❌ | Admin CSV built, instructor UI not built |
| Mobile app | ❌ | Partial | Capacitor shell exists, not published |

---

## Gaps Resolved — July 2026 Session

### Subscription system
- **Subscription bug fixed:** Book Later flow was broken (wrong API response shape — tried to use `transactionId` but bulk API returns `checkoutUrl`). Fixed in payment page.
- **Webhook race condition fixed:** `handleSubscriptionUpdate` now links existing trial row instead of creating a duplicate `Subscription` DB row.
- **Atomic checkout:** `handleCheckoutCompleted` now updates tier/status/stripeSubscriptionId inside a single `$transaction`.
- **Duplicate customer prevention:** `POST /api/instructor/subscription` checkout now uses `customer: customerId` not `customer_email`.
- **Legacy webhook retired:** `/api/subscriptions/webhook` returns 200 + CRITICAL log. Remove from Stripe dashboard.
- **Admin subscription UI built:** Full Subscription tab on instructor profile (sync, cancel, link, override, delete duplicate rows) + `/admin/subscriptions` list page.

### Payout system
- **Buffer inconsistency fixed:** `buildPayout()` now reads `PlatformSettings.lateCancellationWindowHours` (same as the cron).
- **`payoutHold` check in process-all:** Manual "Process All" button now skips instructors with active dispute holds.
- **Dispute refund crash fixed:** `walletTransaction.create` was using `referenceId` (doesn't exist). Fixed to `bookingId`.
- **Instructor payout history built:** `GET /api/instructor/payouts` was an empty directory. Now returns payout history, pending amounts, next payout date.
- **Payout day corrected:** Earnings page footer said "Fridays". Cron runs Tuesday 2am AWST.

### Booking flow
- **Book Later fully broken — fixed:** Payment page was expecting `transactionId` from Book Later response. Bulk API returns `checkoutUrl` (Stripe Checkout Session). Now redirects directly to `checkoutUrl`.
- **`alert()` in registration replaced:** All 7 `alert()` validation calls replaced with inline error state.
- **Confirmation page step number fixed:** Was hardcoded `currentStep={3}`. Now dynamic based on `bookingType` and `offersTestPackage`.
- **Slot countdown added:** Payment page shows live 10-minute countdown when slots are held.
- **Unmount cleanup fixed:** `BookingDetailsForm` now calls server `DELETE /api/availability/check-and-reserve` with `keepalive: true` on unmount.
- **`sessionId` fixed:** `SlotReservation` rows now use `idempotencyKey ?? 'bulk-{timestamp}'` instead of hardcoded `'bulk-api'`.
- **`EMAIL_EXISTS` dead code removed:** This error code was never returned by the API. The UI branch is cleaned up.

### Document system
- **Expiry storage bug fixed:** `licenseExpiry`, `insuranceExpiry`, `policeCheckExpiry`, `wwcCheckExpiry` DateTime columns were never written to. The `/expiry` API now writes to both the real columns AND `workingHours.expiry` JSON for compatibility. Compliance API reads real columns first.
- **INSTRUCTOR_APPROVALS.md updated:** Now reflects 4-tab instructor profile, full API route inventory, reject SMS+audit behaviour.
- **DOCUMENTS.md created** for instructor-facing `/dashboard/documents` page.

### Admin improvements
- **Cron Jobs added to AdminNav:** `/admin/cron-jobs` was not linked from any nav menu.
- **STUDIO commission rate:** `studioCommissionRate` added to `PlatformSettings` schema, `platform-pricing.ts`, admin pricing form (now 4 columns).
- **Admin pricing form:** Now shows Basic/Pro/Studio/Business commission fields (was missing Studio).

### BUSINESS tier
- `comingSoon: true` removed — BUSINESS plan is live.
- `businessName` field used on all student-facing surfaces.
- Commission and identity architecture complete for single-instructor operation.

---

## Known Outstanding Items

| Item | Priority | Location |
|---|---|---|
| Remove `/api/subscriptions/webhook` from Stripe dashboard | 🔴 High | Stripe Dashboard → Webhooks |
| Refund 2 of 3 duplicate $129 charges for birhane457@gmail.com | 🔴 High | Stripe Dashboard + admin `/admin/subscriptions` |
| Create BUSINESS Stripe price IDs + set in env | 🔴 High | Stripe Dashboard + Vercel env vars |
| Set live Stripe keys and webhook secret | 🔴 High | Vercel env vars |
| Expiry columns backfill SQL (non-urgent) | 🟡 Medium | Run SQL in TODO.md against production DB |
| Student progress tracking — no structured skills model | 🟡 Medium | Product design required |
| VAPI system prompt re-upload (deferred to end of all changes) | 🟡 Medium | `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` |
| Data export — instructor self-serve | 🟢 Low | Phase 2 |
| Multi-instructor management (BUSINESS Phase 2) | 🟢 Low | Phase 2 — schema foundation present |
| Mobile app publication | 🟢 Low | Capacitor shell exists |
| Failed payout UI retry button | 🟢 Low | `/admin/payouts` — currently no retry UI |

---

## Architecture at a Glance

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Auth | NextAuth.js (credentials + JWT) |
| Database | PostgreSQL via Prisma ORM (Supabase) |
| Payments | Stripe (Subscriptions, Connect, Checkout Sessions, Webhooks) |
| SMS | Twilio |
| File storage | Cloudinary |
| Voice AI | VAPI + custom proxy on Railway (`drivebook-hybrid`) |
| Rate limiting | Upstash Redis |
| Hosting | Vercel (web) + Railway (voice proxy) |
| Cron | Vercel cron, managed via `lib/services/cron-health.ts` |

---

## Strengths

- Booking and payment flows are production-grade with atomic transactions, idempotency, and server-side pricing validation
- Stripe integration is thorough: disputes, out-of-band refunds, Connect transfer failures, subscription lifecycle all handled
- OTP verification for voice AI: hashed storage, timing-safe compare, rate-limited, Redis-backed
- Commission rates fully DB-backed (`PlatformSettings`) — no hardcoded values in payout paths
- Cancellation windows DB-backed — one setting controls refund tiers, payout dispute buffer, and client-facing UI
- 10 cron jobs fully registered, health-tracked, with immediate failure alerting
- Admin has full subscription management (sync, override, cancel, link Stripe sub, delete duplicates) with audit trail
- Document verification system complete: approve, reject (SMS + audit), expiry tracking with real DB columns
- Voice AI proxy: session recovery, stable idempotency keys, sensitive param masking

## Weaknesses

- Student progress tracking does not match what is advertised (no skills matrix, no logbook)
- Data export not built for instructors
- Geographic focus WA only — no national content or instructor network yet
- BUSINESS tier multi-instructor features are Phase 2 — currently operates as single instructor with school branding

---

## Conclusion

The platform is production-ready for the core instructor + student flows. The subscription system, payout pipeline, booking wizard, and admin tooling are all solid after the July 2026 audit and fix session. The primary remaining work before full launch is Stripe configuration (live keys, BUSINESS price IDs, webhook cleanup) and the VAPI prompt re-upload. Strategic gaps (student progress model, data export, mobile publication) are deferred to Phase 2.
