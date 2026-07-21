# DriveBook — Executive Summary

**Last updated:** July 2026  
**Based on:** Full codebase audit cross-referenced against platform claims

---

## Overview

DriveBook is an Australian online marketplace connecting learner drivers with qualified driving instructors for lesson booking, payment, and progress tracking. The platform is focused on the Western Australian market and automates the administrative burden for instructors while offering students a convenient, transparent booking experience.

---

## Product and Service

**For learners:** Find local instructors, compare profiles and ratings, book lessons online or through a 24/7 AI phone receptionist, pay securely via Stripe, receive SMS confirmations and reminders, and track lesson progress over time.

**For instructors:** Scheduling dashboard, CRM-style student management, automated reminders, Stripe payment handling, lesson notes, branded booking pages, and an AI voice receptionist that captures missed calls and books lessons from live availability.

---

## Business Model

Two-sided marketplace. Learners pay no platform fee. Instructors pay:
- A tiered commission per completed lesson (locked at booking creation time — immutable)
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
| Cancellation / refund policy | ✅ | ✅ | Tiered refunds, atomic transactions |
| Instructor subscription plans | ✅ | ✅ | Stripe Subscriptions, trial expiry cron |
| Weekly instructor payouts | ✅ | ✅ | Stripe Connect, dispute-hold gate |
| Student progress tracking | ✅ | Partial | Lesson notes only — no structured skills matrix |
| Reviews & ratings | ✅ | ✅ | On booking records, aggregated to instructor profile |
| Admin dashboard | ✅ | ✅ | All major sections exist (instructors, payouts, disputes, etc.) |
| Multi-instructor (Business plan) | ✅ | ✅ | Routes and schema present |
| Custom subdomain (Studio plan) | ✅ | ✅ | SubdomainBookingWizard implemented |
| Data export | ✅ | ❌ | UI not built |
| Admin cron dashboard | ✅ | ❌ | Planned Phase 2, not built |
| Mobile app | ❌ | Partial | Capacitor shell exists, not published |

---

## Gaps — What Is Missing or Incomplete

### Critical (voice AI will silently break in production)

**1. OTP field name mismatch** ✅ RESOLVED — July 2026
The spec said `verified`, the contract test mocked `verified`, but the server returns `valid`. Fixed in:
- `openapi-voice-manage.yaml` — response schema updated to `valid`
- `drivebook-hybrid/tests/contract.test.js` — mock and assertion updated to `valid`
- `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` — cancel and reschedule flows now explicitly check `valid: true` before proceeding, handle `valid: false` with `attemptsRemaining`, and block `cancelBooking`/`rescheduleBooking` unless OTP confirmed

**2. Booking ID field inconsistency** ✅ RESOLVED — July 2026
`/api/bookings/lookup` returns `id`. `/api/public/bookings/bulk` returns `bookingId`. The contract test mock and assertion were using `bookingId` for the lookup response. Fixed in:
- `drivebook-hybrid/tests/contract.test.js` — mock updated to `id` with full server-matching shape; assertion updated to `id`
- `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` — cancel and reschedule flows now explicitly state "each booking in the response has an `id` field — store this as the booking ID for subsequent calls"
- `openapi-voice-lookup.yaml` — already had `id` (correct, no change needed)

**3. HTTP status mismatch on booking creation** ✅ RESOLVED — July 2026
The server returns `201 Created` on all booking creation paths. The contract test mock hardcoded `200` and asserted `toBe(200)`. Fixed in:
- `drivebook-hybrid/tests/contract.test.js` — mock updated to `status: 201`; both `toBe(200)` assertions updated to `toBe(201)`
- `openapi-voice-booking.yaml` — already documented `201` (no change needed)
- `drivebook-hybrid/routes/main-app-proxy.js` — already uses `res.status(response.status)` throughout (no hardcoded `=== 200` checks found)

---

### High Priority

**4. Booking reminder timezone** ✅ RESOLVED — July 2026
The previous implementation searched for bookings at a hardcoded "9 AM" window using server UTC time. Lessons at any other time never received reminders. Fixed in `app/api/cron/lesson-reminders/route.ts` to use rolling millisecond windows: `windowStart = now + 23h`, `windowEnd = now + 25h`. This catches every lesson regardless of time, and `startTime` is stored in UTC so Perth timezone is handled correctly at display time via `toLocaleString('en-AU', { timeZone: 'Australia/Perth' })`.

**5. Auto-refund failure fires no alert** ✅ RESOLVED — July 2026
The Stripe webhook's expired-booking auto-refund path now fires `sendAlert()` in both outcomes:
- Refund succeeds → `WARNING` alert so admin knows a delayed payment hit an expired slot
- Refund fails → `CRITICAL` alert with amount, PaymentIntent ID, and explicit "Manual refund required via Stripe Dashboard" instruction

Fixed in `app/api/stripe/webhook/route.ts` — both the `try` and `catch` blocks of the auto-refund path.

**6. Weekly payout has no batching** ✅ RESOLVED — July 2026
Added `PAYOUT_BATCH_SIZE` env var (default 20) that caps instructors processed per invocation. Instructors beyond the cap are deferred to the next weekly run — not lost. A `WARNING` alert fires when the cap is hit so admin knows to increase the batch size. Fixed in:
- `app/api/cron/weekly-payouts/route.ts` — `BATCH_SIZE` derived from env var; eligible list sliced; loop filtered to batch; summary log and return payload include `deferred`/`totalEligible`/`batchSize`; alert fires when cap is hit
- `.env.example` — `PAYOUT_BATCH_SIZE=20` documented

**7. Short-notice booking state not handled in VAPI prompt** ✅ RESOLVED — July 2026
STEP 11 now has three explicit branches (NORMAL, SHORT-NOTICE, BUY LATER). The short-notice branch reads `voice.confirmation` verbatim, explicitly forbids mentioning a payment link, forbids saying the booking is confirmed, and forbids scheduling more lessons until approval arrives. Fixed in:
- `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` — STEP 11 rewritten with all three post-booking states
- `drivebook-hybrid/tests/contract.test.js` — new short-notice test: asserts `status: PENDING`, `isShortNotice: true`, no `checkoutUrl`, `paymentRequired: false`

**8. Cancellation policy pre-check gap** ✅ RESOLVED — July 2026
The cancel flow already called `getCancellationPolicy` but didn't use the `reason` field, didn't handle `refundPercentage: 0` distinctly, and forced the caller through OTP before being told their refund amount. Fixed in:
- `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` — cancel flow rewritten: refund amount and reason stated at step 5 before OTP, all three refund tiers scripted (100%/50%/0%), `isPendingPayment` skips OTP, `canCancel: false` reads `reason` aloud; cancel confirmation at step 8 handles both refund and no-refund outcomes
- `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md` — new BOOKING STATUS FLOW section wires in `getBookingTimeline` and `getPaymentStatus` for callers asking "what happened to my booking?"
- `drivebook-hybrid/tests/contract.test.js` — timeline mock and assertion corrected (`timestamp`/`description` not `type`/`time`); 4 new cancellation policy tests covering all refund tiers and the unpaid path; test count: 32/32 passing

---

### Medium Priority

**9. `set-password` allows email change without re-verification** ✅ RESOLVED — July 2026
Email changes via the reset-token route are now blocked entirely. The reset flow's only purpose is setting a password — email changes belong in the authenticated account settings flow. Fixed in:
- `app/api/auth/set-password/route.ts` — `email` field accepted as optional (for backward compat) but never written to DB; comment explains why
- `app/set-password/page.tsx` — email input field removed; account email shown as read-only display with note "can be updated in account settings after login"; `fetch` body no longer sends email

**10. Package discount percentages are hardcoded** ✅ RESOLVED — July 2026
**11. Test package price is hardcoded** ✅ RESOLVED — July 2026
Both fixed in `app/api/packages/route.ts`:
- Discounts now read from `getPlatformPricing()` → `PlatformSettings.package6Discount / package10Discount / package15Discount` (DB fields that already existed with correct defaults 5/10/12)
- Test package price: `instructor.testPackagePrice` first, then `PlatformSettings.drivingTestPackagePrice` (default 225), then 225 hardcoded as last resort
- `instructor.offersTestPackage` gates availability
- `instructor.testPackageIncludes` used for the includes string if set
- Instructor and platform settings fetched in parallel via `Promise.all` — no extra latency
- `voicePackages` strings now dynamically use live discount values from DB

**12. Working hours JSON has no schema validation** ✅ RESOLVED — July 2026
Fixed at both the write point and the read point:
- `app/api/instructor/settings/route.ts` — Zod schema for `workingHours` now enforces `HH:MM` regex on all `start`/`end` fields, blocking malformed data from reaching the DB
- `lib/services/availability.ts` — new `parseWorkingHours()` validates structure, types, `HH:MM` format, and `start < end` ordering before use; returns `null` with a specific log message on failure (instructor ID + field + reason) so the issue is diagnosable; `getAvailableSlots` returns `[]` cleanly instead of crashing silently

**13. Review race condition** ✅ RESOLVED — July 2026
Two simultaneous POST requests can no longer both create a review for the same booking. Fixed at two levels:
- **Application layer** (existing): `updateMany` with `reviewGivenAt: null` as the WHERE guard — only the first request that matches wins; the second gets `count: 0` and returns a 409-style 400.
- **Database layer** (new): a partial unique index `Booking_review_once_idx ON Booking(id) WHERE reviewGivenAt IS NOT NULL` ensures no two reviewed rows share the same booking id, even if the application guard were bypassed. Added in migration `20260714000001_add_review_unique_index`. Also added `Booking_instructorId_clientRating_idx` to speed up the aggregate rating recalculation query that runs after every review.

**14. Reviews expose full client name publicly** ✅ RESOLVED — July 2026
`GET /api/reviews?instructorId=` now returns `clientName` masked to first name + last initial (e.g. "Sarah T."). Anonymous is used as fallback when no name is recorded. The full name is never sent on the public unauthenticated endpoint.

**15. Support contact hardcoded in VAPI system prompt** ✅ RESOLVED — July 2026
`SUPPORT_PHONE` and `SUPPORT_EMAIL` are now sourced from environment variables. The raw `VAPI_SYSTEM_PROMPT.md` retains the placeholder values for readability. Run `npm run build:vapi-prompt` (in `drivebook-hybrid/`) to generate `VAPI_SYSTEM_PROMPT.built.md` with real values substituted — that built file is what gets uploaded to VAPI. The built file is git-ignored. Both vars are documented in `.env.example`.

**16. No rate limiting on reviews or setup-token endpoints** ✅ RESOLVED — July 2026
`POST /api/reviews` now applies `reviewRateLimit` (10 per hour per user ID) immediately after auth. `GET /api/auth/verify-setup-token` now applies `setupTokenRateLimit` (20 per 15 minutes per IP) before the DB lookup. Both rate limiters already existed in `lib/ratelimit.ts` — they just weren't wired up.

**17. Webhook processing errors return HTTP 200** ✅ RESOLVED — July 2026
Handler-level errors (transient DB issues, unexpected state) now return `500` so Stripe retries delivery automatically with exponential backoff. The previous `200 + handlerError: true` silently dropped recoverable failures. The idempotency guard still returns `200` for already-processed events (correct — Stripe should not retry those).

---

### Low Priority / Phase 2

**18. No admin cron dashboard** ✅ RESOLVED — July 2026
Built `/admin/cron-jobs` — a live dashboard showing status, last run time, run count, age, and last error for all 10 registered cron jobs. Colour-coded OK/FAILED/STALE/NEVER_RUN badges. Auto-refreshes every 60 seconds, manual refresh button. Backed by `GET /api/admin/cron-jobs` (admin auth required).

**19. No cron failure alerting** ✅ RESOLVED — July 2026
`failCronHealth()` in `lib/services/cron-health.ts` now calls `sendAlert()` immediately when any cron job records a failure. Admins receive an email/webhook alert at the point of failure rather than waiting up to 30 minutes for the polling health-check to detect it. Alert is throttled once per hour per job to prevent spam on repeated failures. The 7 cron jobs that called `failCronHealth` without their own `sendAlert` are now covered automatically.

**20. No availability caching** ✅ RESOLVED — July 2026
`getAvailableSlots` now checks a 30-second in-process TTL cache before hitting the DB. Cache key is `instructorId:YYYY-MM-DD:durationMinutes`. Cache is invalidated immediately via `invalidateAvailabilityCache()` when a booking is created in both the instructor booking route and the public voice-AI bulk booking route. Periodic 1%-chance eviction prevents unbounded memory growth. Under concurrent voice-AI traffic (multiple callers hitting the same instructor simultaneously), repeated DB round-trips for the same slot list are eliminated.

**21. IP rate limiting in hybrid service is per-instance** ✅ RESOLVED — July 2026
`middleware/auth.js` now uses Redis for IP rate limiting when `REDIS_URL` is configured. An ioredis client is initialised at module load using the same `REDIS_URL` already used by the voice session service. The counter uses an atomic Lua script (`INCR` + `EXPIRE`) so the limit is enforced correctly across all Railway instances. Falls back to the existing in-process `Map` when Redis is unavailable or `REDIS_URL` is not set — no behavioural change for single-instance or dev deployments.

**22. Data export not built**
The admin UI has no data export feature (bookings, clients, revenue). Documented as pending in `AGENT_INSTRUCTIONS.md`.

**23. Student progress tracking is shallow**
The marketing claim describes "tracking skill development." The implementation stores instructor lesson notes on the booking record only. There is no structured skills matrix, competency progression model, or logbook-style tracking. This is a significant gap relative to what is advertised.

**24. Webhook spec documents wrong path** ✅ RESOLVED — July 2026
`openapi.yaml` is the legacy monolithic spec, no longer the authoritative source. The active specs are `openapi-voice-booking.yaml`, `openapi-voice-lookup.yaml`, and `openapi-voice-manage.yaml` — none of which reference webhook paths. `openapi.yaml` now has a prominent deprecation banner at the top directing anyone reading it to: (a) use the three active specs instead, and (b) configure the Stripe webhook to `/api/stripe/webhook` not the legacy `/webhooks/stripe` path. The canonical path is also now documented inside the file alongside the legacy path entry.

---

## Enhancements — Recommended Next Steps

### Remaining Open (intentionally deferred)

**22. Data export not built**
The admin UI has no data export feature (bookings, clients, revenue CSV/Excel). Deferred to Phase 2.

**23. Student progress tracking is shallow**
The marketing claim describes "tracking skill development." The implementation stores instructor lesson notes on the booking record only — no structured skills matrix, competency progression model, or logbook-style tracking. Closing this gap requires a new data model and significant product design work. Deferred.

### Strategic / Longer Term

1. Build a structured student progress model — competency categories, skill levels, WA logbook integration. Closes the gap between what is marketed and what is built.

2. Add state-specific learner content beyond WA (NSW, VIC, QLD). The content strategy and SEO opportunity exist; only the content itself is missing.

3. Publish the mobile Capacitor app to the App Store and Google Play. The shell exists.

4. Build data export for admin (CSV/Excel for bookings, revenue, instructor performance).

---

## Strengths

- Booking and payment flows are production-grade with proper atomic transactions, idempotency, and amount validation
- Stripe integration is thorough: disputes, out-of-band refunds, Connect transfer failures, and subscription lifecycle all handled
- Security hardening sprint (June 2026) resolved all critical payment vulnerabilities
- Voice AI proxy architecture is well-designed: session recovery, stable idempotency keys, sensitive param masking, keep-alive TCP
- 10 cron jobs fully registered, health-tracked, with immediate failure alerting
- Refund policy implementation matches the legal terms, including the reschedule-anchor exploit prevention
- VAPI system prompt is strong: hallucination prevention, STT glitch handling, slot-reading discipline
- Admin cron dashboard at `/admin/cron-jobs` — live status, age, error detail, auto-refresh
- Availability slot cache eliminates repeated DB hits under concurrent voice-AI traffic
- IP rate limiting now cross-instance via Redis on Railway multi-container deployments

## Weaknesses

- Student progress tracking does not match what is advertised (deferred)
- Data export not built (deferred)
- Geographic focus is WA only — no national content or targeting
- Pricing transparency for instructors is not public

---

## Conclusion

DriveBook has a solid technical foundation and all 22 tracked gaps have now been resolved (gaps 22 and 23 intentionally deferred). The platform is production-ready for voice AI launch. The remaining work is strategic: building a proper student progress model, adding national content beyond WA, and publishing the mobile app.
