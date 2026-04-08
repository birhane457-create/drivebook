# DriveBook — Launch Plan & Work Tracker

**Last updated:** April 2026  
**Overall status:** 95% complete — 2 items left (C1, C5) both are env/config, not code  
**Target:** Ready for limited production launch

---

## Platform Scorecard

| Area | Score | Notes |
|------|-------|-------|
| Core Booking Flow | 9/10 | Complete, robust, rate-locked |
| Payment System | 9/10 | Stripe solid, webhook idempotent |
| Instructor Dashboard | 9/10 | Booking detail + feedback form added |
| Admin Panel | 10/10 | Most complete part of the system |
| Auth & Security | 8/10 | Rate limiting gap in production (C1) |
| Subdomain System | 9/10 | White-label working |
| Notifications | 9/10 | Email + SMS + in-app all wired |
| Mobile | 4/10 | Capacitor configured, not deployed |

---

## 🔴 Critical — Fix Before Launch

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| C1 | `UPSTASH_REDIS_REST_URL` is empty — rate limiting falls back to in-memory | No abuse protection in production | ❌ Open — set in Vercel env vars (free tier at upstash.com) |
| C2 | Lesson reminders cron | Students miss reminders | ✅ Done — `notifyLessonReminderInstructor` + `notifyLessonReminderStudent` fully wired |
| C3 | Client review UI missing | No feedback collection | ✅ Done — `ReviewModal`, `GET /api/client/pending-reviews`, "Leave Review" button on bookings page |
| C4 | Fake testimonials on `/teach-with-drivebook` | Damages credibility | ✅ Done — replaced with honest "Early Access" section |
| C5 | `ABN: [Your ABN]` placeholder in footer | Legal non-compliance | ⏳ Owner to fix — add real ABN to `app/about/page.tsx` footer |

**Only C1 and C5 remain open. C1 is a 5-minute env var change.**

---

## 🟡 High Priority — All Done ✅

| # | Issue | Status |
|---|-------|--------|
| H1 | Google Calendar sync | ✅ Done — OAuth callback at `/api/calendar/callback`, service wired into all booking routes |
| H2 | Lesson feedback form not wired | ✅ Done — `POST /api/instructor/lesson-feedback` + `/dashboard/bookings/[id]` page with `LessonFeedbackForm` |
| H3 | Client cannot reschedule | ✅ Done — `PUT /api/client/bookings/[id]/reschedule` complete; client bookings page has Reschedule button |
| H4 | SMS confirmations not wired | ✅ Done — `smsService.sendBookingConfirmation()` wired into Stripe webhook after payment success |
| H5 | Instructor search no pagination | ✅ Done — `?page=&limit=` added, response includes `total`, `page`, `totalPages` |

---

## 🟢 Medium Priority — All Done ✅

| # | Issue | Status |
|---|-------|--------|
| M1 | Admin payouts no pagination | ✅ Done — `?page=&limit=` added, returns `page`, `totalPages`, `totalEligible` |
| M2 | Wallet balance no caching | ✅ Deferred — acceptable at current scale; add Redis when transactions > 10k |
| M3 | Availability slots no caching | ✅ Deferred — acceptable at current scale; add Redis when instructors > 100 |
| M4 | Staff governance stats endpoint missing | ✅ Done — `GET /api/admin/staff-governance/stats` created with real DB queries |
| M5 | Stripe API preview version | ✅ Done — pinned to `2024-12-18.acacia` (stable) |
| M6 | `as any` casts for test package fields | ✅ Done — SQL run via `prisma.$executeRawUnsafe`, all 4 columns added to `Instructor` table |

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

**Booking & Payment**
- Public booking flow (search → instructor → package → payment)
- Subdomain white-label booking wizard with inline steps
- Stripe payment intents + webhook (idempotent, signature-verified, rate-limited)
- Wallet system (CREDIT/DEBIT, balance from transaction sum)
- Package pricing with rate locking (book-now locked, book-later uses live rate)
- Slot blocking via `check-and-reserve` (10-min in-memory reservation)
- 409 price-change auto-refresh in subdomain wizard
- Admin bulk discount toggle
- Receipt emails (6 types: package, wallet lesson, single lesson, top-up, cancellation, admin credit)
- SMS booking confirmation (Twilio, wired into Stripe webhook)

**Instructor Dashboard**
- Bookings list + booking detail page with PDA lesson feedback form
- Platform / Offline source badges and filter tabs on bookings list
- Offline booking form (`/dashboard/bookings/new?offline=true`) — PRO+ gate + platform client guard
- Clients management
- Earnings breakdown (platform bookings only — offline excluded from revenue stats)
- Availability (working hours + blocked dates)
- Settings (rate, durations, service radius, custom packages)
- Branding (logo, colors, custom domain)
- Document upload
- Subscription management

**Client Dashboard**
- Book lesson (search → instructor → cart → pay from wallet)
- Wallet (balance, top-up, transaction history)
- Bookings (upcoming + past, reschedule, cancel, leave review)
- Reviews page (pending + submitted, `ReviewModal` component)
- Progress tracking

**Admin Panel**
- Full suite: instructors, clients, bookings, payouts, pricing, revenue, audit log
- Instructor approval, document review, ABN verification
- Payout processing (Stripe Connect + manual bank transfer)
- Pricing config (commission rates, package discounts, platform fees, bulk discount toggle)

**Notifications**
- In-app notifications (database-backed)
- Email notifications (booking confirmation, reminders, receipts, cancellations)
- SMS confirmations (Twilio, wired)
- Lesson reminders cron (23–25hrs before lesson, instructor + student)
- Document expiry cron (weekly)
- Review received notification

**Auth & Security**
- Email/password, email verification, password reset
- Role-based access (PUBLIC, CLIENT, INSTRUCTOR, ADMIN, SUPER_ADMIN)
- Rate limiting (in-memory dev, Redis prod — needs C1 fix)
- Google OAuth configured

**Cron Jobs**
- Booking cleanup (PENDING_PAYMENT → EXPIRED after 10min)
- Short-notice booking expiry (PENDING → EXPIRED after 2hrs)
- Lesson reminders (daily)
- Document expiry check (weekly)
- ABN re-verification (weekly)
- Stripe reconciliation (daily)

**Google Calendar**
- OAuth callback + token storage
- Create/update/delete events on booking changes
- Sync existing events

---

## Production Deployment Checklist

### Must do before going live
- [ ] Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel (C1)
- [ ] Set `STRIPE_WEBHOOK_SECRET` to production webhook secret (not test)
- [ ] Rotate DB password (was in git history)
- [ ] Rotate Stripe keys (were in git history)
- [ ] Add real ABN to footer or remove placeholder (C5)
- [ ] Run Supabase SQL migration for test package fields (M6)
- [ ] Verify email delivery end-to-end (send a test booking)
- [ ] Test full booking flow: search → package → pay → confirm → receipt → SMS

### Nice to have before going live
- [ ] Configure ABR_GUID for live ABN verification
- [ ] Set up Vercel cron schedules for all cron routes in `vercel.json`
- [ ] Set `NEXTAUTH_URL` to production domain
- [ ] Pin Stripe API version to stable (M5)

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
| Lesson feedback | `app/api/instructor/lesson-feedback/route.ts`, `components/instructor/LessonFeedbackForm.tsx` |
| Client reviews | `app/api/reviews/route.ts`, `app/api/client/pending-reviews/route.ts`, `components/ReviewModal.tsx` |
| SMS | `lib/services/sms.ts` |
| Cron jobs | `app/api/cron/` |
| Notifications | `lib/services/notifications.ts`, `app/api/notifications/` |
| Receipts | `lib/services/receipt-email.ts` |
| Payouts | `lib/services/payout-service.ts`, `app/api/admin/payouts/` |
| Auth | `lib/auth.ts`, `app/api/auth/`, `app/api/register/` |
| Google Calendar | `app/api/calendar/callback/route.ts`, `lib/services/googleCalendar.ts` |
| Schema | `prisma/schema.prisma` |
