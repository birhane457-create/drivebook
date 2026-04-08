# DriveBook — Launch Plan & Work Tracker

**Last updated:** April 2026  
**Overall status:** 70% complete — ~8 hours of work to launch-ready  
**Target:** Limited production launch after critical + high-priority items resolved

---

## Platform Scorecard

| Area | Score | Notes |
|------|-------|-------|
| Core Booking Flow | 9/10 | Complete, robust, rate-locked |
| Payment System | 9/10 | Stripe solid, webhook idempotent |
| Instructor Dashboard | 8/10 | Mostly complete |
| Admin Panel | 10/10 | Most complete part of the system |
| Auth & Security | 8/10 | Rate limiting gap in production |
| Subdomain System | 9/10 | White-label working |
| Mobile | 4/10 | Capacitor configured, not deployed |
| Missing Features | 6/10 | Several gaps documented below |

---

## 🔴 Critical — Fix Before Launch

These block a safe production launch.

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| C1 | `UPSTASH_REDIS_REST_URL` is empty — rate limiting falls back to in-memory | No abuse protection in production | ❌ Open |
| C2 | Lesson reminders cron runs but `notifyLessonReminder()` is a no-op | Students miss lesson reminders | ❌ Open |
| C3 | Client review UI missing — no way for students to leave reviews | No feedback collection | ❌ Open |
| C4 | Fake testimonials on `/teach-with-drivebook` (James T., Sarah M., etc.) | Damages credibility | ❌ Open |
| C5 | `ABN: [Your ABN]` placeholder in footer | Legal non-compliance | ❌ Open |

**Fix C1:** Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel env vars (get from upstash.com — free tier is fine).

**Fix C2:** Wire `notifyLessonReminder()` into `app/api/cron/lesson-reminders/route.ts` — it currently logs but never calls the function.

**Fix C3:** Add a "Leave a Review" button on the client bookings page for COMPLETED bookings. Calls `POST /api/reviews` which already exists.

**Fix C4:** Remove or replace testimonials with real ones, or remove the section entirely until real reviews exist.

**Fix C5:** Add real ABN to footer or remove the placeholder.

---

## 🟡 High Priority — Week 1

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| H1 | Google Calendar sync — fields in schema, service exists, OAuth callback incomplete | Promised feature not working | ❌ Open |
| H2 | Lesson feedback form (`LessonFeedbackForm`) not wired into post-lesson flow | No PDA feedback collection | ❌ Open |
| H3 | Client cannot reschedule from their dashboard — instructor-only | Poor UX | ❌ Open |
| H4 | SMS confirmations not wired — Twilio configured but booking confirmation doesn't send SMS | No text notifications | ❌ Open |
| H5 | Instructor search has no pagination — returns all results | Won't scale past ~50 instructors | ❌ Open |

**Fix H2:** Wire `LessonFeedbackForm` into `app/dashboard/bookings/[id]/page.tsx` for COMPLETED bookings. Component already exists at `components/instructor/LessonFeedbackForm.tsx`.

**Fix H3:** Add reschedule option to `app/client-dashboard/bookings/[id]/page.tsx`. API route `app/api/client/bookings/[id]/reschedule/route.ts` already exists.

**Fix H4:** Call `twilioService.sendSMS()` after booking confirmation in `app/api/bookings/route.ts` and `app/api/stripe/webhook/route.ts`.

**Fix H5:** Add `?page=&limit=` params to `GET /api/instructors/search` and paginate results.

---

## 🟢 Medium Priority — Week 2

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| M1 | Admin payouts page loads all transactions — no pagination | Slow with real data | ❌ Open |
| M2 | Wallet balance recomputed from all transactions on every request — no caching | Performance degrades over time | ❌ Open |
| M3 | Availability slots recalculated on every request — no caching | Performance at scale | ❌ Open |
| M4 | Staff governance stats endpoint missing — page shows empty state | Admin page broken | ❌ Open |
| M5 | Stripe API version `2026-01-28.clover` is a preview version | Risk of breaking changes | ❌ Open |
| M6 | `(instructor as any)` casts for test package fields — DB migration not run | TypeScript debt | ❌ Open |

**Fix M4:** Create `GET /api/admin/staff-governance/stats` returning task counts by status.

**Fix M5:** Pin Stripe API version to `2024-12-18.acacia` (latest stable) in `app/api/stripe/webhook/route.ts`.

**Fix M6:** Run the SQL migration in Supabase dashboard:
```sql
ALTER TABLE "Instructor"
  ADD COLUMN IF NOT EXISTS "offersTestPackage" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "testPackagePrice" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "testPackageDuration" INTEGER,
  ADD COLUMN IF NOT EXISTS "testPackageIncludes" JSONB;
```
Then remove `(instructor as any)` casts in `app/subdomain/[slug]/page.tsx`.

---

## 🔵 Low Priority — Post-Launch

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| L1 | Push notifications — Capacitor configured but not tested | Mobile feature | ❌ Open |
| L2 | App Store / Play Store deployment | Mobile launch | ❌ Open |
| L3 | Instructor performance metrics dashboard | Nice to have | ❌ Open |
| L4 | Cancellation policy per instructor (currently platform-wide only) | Feature enhancement | ❌ Open |
| L5 | Availability templates (copy last week) | Feature enhancement | ❌ Open |
| L6 | Bulk admin operations (approve/reject/suspend multiple instructors) | Operational efficiency | ❌ Open |
| L7 | Instructor referral system | Growth feature | ❌ Open |
| L8 | Advanced student progress analytics | Nice to have | ❌ Open |

---

## What's Fully Working ✅

- Public booking flow (search → instructor → package → payment)
- Subdomain white-label booking wizard
- Stripe payment intents + webhook (idempotent, signature-verified)
- Wallet system (CREDIT/DEBIT, balance from transaction sum)
- Package pricing with rate locking (book-now locked, book-later uses live rate)
- Slot blocking via `check-and-reserve` (10-min in-memory reservation)
- 409 price-change auto-refresh in subdomain wizard
- Admin bulk discount toggle
- Receipt emails (6 types: package, wallet lesson, single lesson, top-up, cancellation, admin credit)
- Instructor dashboard (bookings, clients, earnings, availability, settings, branding)
- Admin panel (full suite — instructors, clients, bookings, payouts, pricing, revenue, audit log)
- Auth (email/password, email verify, password reset, role-based access)
- Cron jobs (booking cleanup, document expiry, ABN recheck, Stripe reconciliation)
- Subscription billing (BASIC/PRO/BUSINESS with trial periods)
- Payout processing (Stripe Connect + manual bank transfer)
- Audit log (immutable record of all financial and admin actions)
- About page and teach-with-drivebook page (honest founder story)

---

## Production Deployment Checklist

### Must do before going live
- [ ] Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel
- [ ] Set `STRIPE_WEBHOOK_SECRET` to production webhook secret (not test)
- [ ] Rotate DB password (was in git history)
- [ ] Rotate Stripe keys (were in git history)
- [ ] Set real ABN in footer or remove placeholder
- [ ] Remove fake testimonials from `/teach-with-drivebook`
- [ ] Wire lesson reminders cron (C2)
- [ ] Run Supabase SQL migration for test package fields (M6)
- [ ] Verify email delivery end-to-end (send a test booking)
- [ ] Test full booking flow: search → package → pay → confirm → receipt

### Nice to have before going live
- [ ] Configure ABR_GUID for live ABN verification (currently set to test GUID)
- [ ] Set up Vercel cron schedules for all cron routes
- [ ] Configure Cloudinary for production image uploads
- [ ] Set `NEXTAUTH_URL` to production domain

---

## Key Files Reference

| Feature | Files |
|---------|-------|
| Public booking | `app/book/`, `components/BulkBookingForm.tsx`, `app/api/public/bookings/bulk/` |
| Subdomain booking | `components/subdomain/SubdomainBookingWizard.tsx`, `app/subdomain/[slug]/` |
| Stripe webhook | `app/api/stripe/webhook/route.ts` |
| Wallet | `app/api/client/wallet*`, `lib/services/wallet-helpers.ts` |
| Pricing | `app/api/public/pricing/`, `app/api/admin/pricing/`, `lib/services/platform-pricing.ts` |
| Slot blocking | `app/api/availability/check-and-reserve/route.ts` |
| Cron jobs | `app/api/cron/` |
| Notifications | `lib/services/notifications.ts`, `app/api/notifications/` |
| Receipts | `lib/services/receipt-email.ts` |
| Payouts | `lib/services/payout-service.ts`, `app/api/admin/payouts/` |
| Auth | `lib/auth.ts`, `app/api/auth/`, `app/api/register/` |
| Schema | `prisma/schema.prisma` |
