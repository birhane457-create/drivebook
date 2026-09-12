# DriveBook â€” Executive Summary

**Status:** ✅ Current  
**Last Updated:** 2026-09-01

---

**Last updated:** August 2026  
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
- A tiered commission per completed lesson (locked at booking creation time â€” immutable, DB-backed rate)
- Optional monthly/annual subscription for premium features (Basic / Pro / Studio / Business)

Revenue scales directly with lesson volume. No setup fee for instructors. Free 14-day trial on all plans (configurable via `BASIC_TRIAL_DAYS`).

---

## Current Implementation Status

| Feature | Claimed | Built | Notes |
|---------|---------|-------|-------|
| Online booking (web) | âœ… | âœ… | Both instructor-initiated and public flows |
| AI phone receptionist | âœ… | âœ… | VAPI + drivebook-hybrid proxy on Railway |
| Stripe payments & wallet | âœ… | âœ… | Production-grade with dispute handling |
| SMS confirmations | âœ… | âœ… | Twilio, with retry queue |
| Booking reminders | âœ… | âœ… | Rolling time-window logic, Perth timezone |
| Package bookings (6/10/15h) | âœ… | âœ… | Server-side pricing, discount locked |
| Cancellation / refund policy | âœ… | âœ… | Tiered refunds, atomic transactions, DB-backed windows |
| Instructor subscription plans | âœ… | âœ… | Stripe Subscriptions, trial expiry cron, all 4 tiers live |
| Admin subscription management | âœ… | âœ… | Full tab on instructor profile + list page |
| Weekly instructor payouts | âœ… | âœ… | Stripe Connect, dispute-hold gate, DB-backed buffer |
| Student progress tracking | âœ… | Partial | COACHING notes + MOCK PDA scores â€” no full skills matrix |
| Lesson feedback (COACHING/MOCK) | âœ… | âœ… | Two assessment types, score only for MOCK |
| Reviews & ratings | âœ… | âœ… | On booking records, aggregated to instructor profile |
| Admin dashboard | âœ… | âœ… | All major sections, Subscriptions list, Cron Jobs |
| BUSINESS tier (school identity) | âœ… | âœ… | businessName on all student-facing surfaces |
| Multi-instructor (Business plan) | Partial | âŒ | Schema foundation present, Phase 2 |
| Custom subdomain (Studio plan) | âœ… | âœ… | SubdomainBookingWizard implemented |
| Document verification system | âœ… | âœ… | Full admin review UI with approve/reject/expiry; signed Cloudinary URLs |
| Admin cron health dashboard | âœ… | âœ… | `/admin/cron-jobs` with live status, auto-refresh |
| Data export | âœ… | âŒ | Admin CSV built, instructor UI not built |
| Mobile app | âŒ | Partial | Capacitor shell exists, not published |
| Session security | âœ… | âœ… | 30-min idle timeout + new device OTP for instructors |
| Instructor search | âœ… | âœ… | Suburb-based exact match, radius fallback |
| Business card builder | âœ… | âœ… | Client-side PDF, print request system |

---

## Known Outstanding Items

| Item | Priority |
|---|---|
| Set live Stripe keys + webhook secret | ðŸ”´ Launch blocker |
| Remove `/api/subscriptions/webhook` from Stripe dashboard | ðŸ”´ Launch blocker |
| Create BUSINESS Stripe price IDs | ðŸ”´ Launch blocker |
| Configure Stripe Billing Portal | ðŸ”´ Launch blocker |
| Refund 2 duplicate $129 charges for birhane457@gmail.com | ðŸ”´ Action required |
| Set `UPSTASH_REDIS_REST_URL` + token (rate limiting) | ðŸ”´ Launch blocker |
| LLM document scanning on upload (DOC-2) | ðŸŸ¡ Medium |
| Force logout all devices â€” SEC-3 (requires DB sessions strategy) | ðŸŸ¡ Medium |
| Failed payout retry button in admin | ðŸŸ¡ Medium |
| Student progress tracking â€” no structured skills model | ðŸŸ¡ Medium |
| Instructor data export self-serve | ðŸŸ¢ Low |
| Mobile app publication | ðŸŸ¢ Low |

---

## Architecture at a Glance

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Auth | NextAuth.js (credentials + JWT) |
| Database | PostgreSQL via Prisma ORM (Supabase) |
| Payments | Stripe (Subscriptions, Connect, Checkout Sessions, Webhooks) |
| SMS | Twilio |
| File storage | Cloudinary (private docs via signed URLs) |
| Voice AI | VAPI + custom proxy on Railway (`drivebook-hybrid`) |
| Rate limiting | Upstash Redis |
| Hosting | Vercel (web) + Railway (voice proxy) |
| Cron | Vercel cron, managed via `lib/services/cron-health.ts` |

---

## Strengths

- Production-grade booking + payment flows: atomic transactions, idempotency, server-side pricing validation
- Stripe integration thorough: disputes, out-of-band refunds, Connect transfer failures, full subscription lifecycle
- Commission rates fully DB-backed â€” no hardcoded values in any payout path
- 30-min idle timeout + new-device OTP gate for instructors â€” financial risk addressed
- Suburb-based instructor search â€” no air-distance inaccuracy, instructors control their territory
- Document verification: signed Cloudinary URLs, no raw URLs exposed to clients
- Business card builder: print-ready A4 PDF, no external services
- 10 cron jobs fully health-tracked with immediate failure alerting

## Weaknesses

- Student progress tracking does not match what is advertised (no skills matrix, no logbook)
- Data export not built for instructors
- Geographic focus WA only â€” no national content or instructor network yet
- BUSINESS tier multi-instructor features are Phase 2
- Rate limiting requires Upstash Redis in production â€” not yet configured

---

## Conclusion

Core instructor + student flows are production-ready. The main remaining work before launch is Stripe configuration (live keys, price IDs, webhook cleanup) and Upstash Redis for rate limiting. See `TODO.md` for the full pre-launch checklist.
