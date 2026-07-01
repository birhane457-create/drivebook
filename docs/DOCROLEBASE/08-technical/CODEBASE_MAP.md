# DriveBook — Codebase Map

**Stack:** Next.js 14 (App Router) · PostgreSQL (Supabase) · Prisma · Stripe · NextAuth · Azure Copilot Studio  
**Hosted:** Vercel · drivebook.com.au  
**Last Updated:** July 2026  

Everything is grouped by feature domain. Each entry shows: page → API route → service/lib → DB model.

---

## BOOKING

**What it does:** Learner searches for instructors, selects a slot, pays, gets SMS confirmation.

| Layer | File |
|-------|------|
| Search page | `app/book/page.tsx` |
| Instructor profile + booking form | `app/book/[instructorId]/page.tsx` |
| Payment page | `app/booking/[id]/payment/page.tsx` |
| Public booking API | `app/api/public/bookings/route.ts` |
| Bulk booking API | `app/api/public/bookings/bulk/route.ts` |
| Booking CRUD | `app/api/bookings/route.ts` |
| Single booking | `app/api/bookings/[id]/route.ts` |
| Confirm booking | `app/api/bookings/[id]/confirm/route.ts` |
| Cancel booking | `app/api/bookings/[id]/cancel/route.ts` |
| Reschedule (instructor) | `app/api/bookings/[id]/reschedule/route.ts` |
| Reschedule (client) | `app/api/client/bookings/[id]/reschedule/route.ts` |
| Check-in | `app/api/bookings/[id]/check-in/route.ts` |
| Send payment link | `app/api/bookings/send-payment-link/route.ts` |
| Create payment intent | `app/api/payments/create-intent/route.ts` |
| Instructor search hook | `lib/hooks/useInstructorSearch.ts` |
| Instructor search API | `app/api/instructors/search/route.ts` |
| Slot picker component | `components/SlotPicker.tsx` |
| Booking form component | `components/BookingFormNew.tsx` |
| Bulk booking form | `components/BulkBookingForm.tsx` |
| Location search | `components/LocationSearchBooking.tsx` |
| Instructor card | `components/CompactInstructorCard.tsx` |
| DB model | `Booking` in `prisma/schema.prisma` |
| Doc | `docs/DOCROLEBASE/01-public/BOOKING_FLOW.md` |

---

## PAYMENTS & WALLET

**What it does:** Stripe payment intents, client wallet top-up, wallet deductions, transaction ledger.

| Layer | File |
|-------|------|
| Wallet summary | `app/api/client/wallet/summary/route.ts` |
| Add wallet credit | `app/api/client/wallet-add/route.ts` |
| Wallet top-up intent | `app/api/client/wallet-topup-intent/route.ts` |
| Admin: add credit | `app/api/admin/clients/[id]/wallet/add-credit/route.ts` |
| Admin: deduct credit | `app/api/admin/clients/[id]/wallet/deduct-credit/route.ts` |
| Admin: wallet view | `app/api/admin/clients/[id]/wallet/route.ts` |
| Stripe webhook | `app/api/stripe/webhook/route.ts` |
| Wallet helpers | `lib/services/wallet-helpers.ts` |
| Platform pricing | `lib/services/platform-pricing.ts` |
| DB models | `ClientWallet`, `WalletTransaction`, `Transaction` in schema |
| Doc | `docs/DOCROLEBASE/02-student/WALLET.md` |
| Doc | `docs/DOCROLEBASE/06-payments/STRIPE.md` |

---

## PAYOUTS

**What it does:** Instructor payout eligibility, Stripe Connect transfer, bank/manual state machine, ledger.

| Layer | File |
|-------|------|
| Admin payouts page | `app/admin/payouts/page.tsx` |
| Payouts list API | `app/api/admin/payouts/route.ts` |
| Process single payout | `app/api/admin/payouts/process/route.ts` |
| Process all payouts | `app/api/admin/payouts/process-all/route.ts` |
| Mark sent / confirm | `app/api/admin/payouts/[payoutId]/mark-sent/route.ts` |
| Hold payout | `app/api/admin/payouts/[payoutId]/hold/route.ts` |
| Resolve withheld | `app/api/admin/payouts/resolve/route.ts` |
| Resolve split | `app/api/admin/payouts/resolve-split/route.ts` |
| Payout service | `lib/services/payout-service.ts` |
| Ledger service | `lib/services/ledger-service.ts` |
| Instructor payout settings | `app/api/instructor/payout-settings/route.ts` |
| Payout settings page | `app/dashboard/settings/payout/page.tsx` |
| DB models | `Payout`, `PayoutTransaction`, `PlatformLedger`, `LedgerEntry` in schema |
| Doc | `docs/DOCROLEBASE/05-admin/PAYOUTS.md` |
| Doc | `docs/DOCROLEBASE/06-payments/PAYOUTS.md` |
| Financial doctrine | `docs/00-foundation/FINANCIAL_DOCTRINE.md` |

---

## SUBSCRIPTIONS

**What it does:** Instructor subscription tiers (BASIC/PRO/STUDIO/BUSINESS), Stripe billing, trial periods, scheduled rate changes.

| Layer | File |
|-------|------|
| Subscription page | `app/dashboard/subscription/page.tsx` |
| Subscription API | `app/api/instructor/subscription/route.ts` |
| Billing portal API | `app/api/instructor/subscription/billing-portal/route.ts` |
| Post-portal sync | `app/api/instructor/subscription/sync/route.ts` |
| Mobile subscription | `app/api/instructor/subscription/mobile/route.ts` |
| Rate changes API | `app/api/admin/rate-changes/route.ts` |
| Rate changes delete | `app/api/admin/rate-changes/[id]/route.ts` |
| Apply rate changes cron | `app/api/cron/apply-rate-changes/route.ts` |
| Rate change scheduler UI | `components/admin/RateChangeScheduler.tsx` |
| Subscription plans UI | `components/SubscriptionPlans.tsx` |
| Subscription config | `lib/config/subscriptions.ts` |
| Platform settings config | `lib/config/platform-settings.ts` |
| Stripe service | `lib/services/stripe.ts` |
| DB models | `Subscription`, `PlatformRateChange` in schema |
| Docs | `docs/DOCROLEBASE/07-subscriptions/` |

---

## INSTRUCTOR MANAGEMENT

**What it does:** Instructor onboarding, approval, ABN verification, suspension, profile, branding, subdomain.

| Layer | File |
|-------|------|
| Instructor profile API | `app/api/instructor/profile/route.ts` |
| Branding API | `app/api/instructor/branding/route.ts` |
| Branding page | `app/dashboard/branding/page.tsx` |
| Admin: instructor list | `app/api/admin/instructors/route.ts` |
| Admin: instructor detail | `app/api/admin/instructors/[id]/route.ts` |
| Admin: approve | `app/api/admin/instructors/[id]/approve/route.ts` |
| Admin: reject | `app/api/admin/instructors/[id]/reject/route.ts` |
| Admin: suspend | `app/api/admin/instructors/[id]/suspend/route.ts` |
| Admin: verify ABN | `app/api/admin/instructors/[id]/verify-abn/route.ts` |
| ABN verify (public) | `app/api/abn/verify/route.ts` |
| ABN validation util | `lib/utils/abn-validation.ts` |
| ABN recheck cron | `app/api/cron/recheck-abn/route.ts` |
| Admin instructors page | `app/admin/instructors/page.tsx` |
| Admin instructor detail | `app/admin/instructors/[id]/page.tsx` |
| Approval list component | `components/admin/InstructorApprovalList.tsx` |
| Subdomain page | `app/subdomain/[slug]/page.tsx` |
| Subdomain features | `components/subdomain/SubdomainClientFeatures.tsx` |
| DB model | `Instructor` in schema |
| Doc | `docs/SUBDOMAIN_SYSTEM.md` |
| Doc | `docs/DOCROLEBASE/05-admin/INSTRUCTOR_APPROVALS.md` |

---

## LESSON FEEDBACK & PROGRESS TRACKING

**What it does:** Instructor logs PDA feedback codes after each lesson. Student sees scores, strengths, focus areas, and personalised content recommendations.

| Layer | File |
|-------|------|
| Feedback form (instructor) | `components/instructor/LessonFeedbackForm.tsx` |
| Feedback API | `app/api/instructor/lesson-feedback/route.ts` |
| Client performance API | `app/api/client/my-performance/route.ts` |
| Instructor client performance | `app/api/instructor/client-performance/route.ts` |
| Recommendations API | `app/api/client/recommendations/route.ts` |
| Admin: learning content | `app/api/admin/learning-content/route.ts` |
| Progress page (instructor dash) | `app/dashboard/progress/page.tsx` |
| Progress page (client dash) | `app/client-dashboard/progress/page.tsx` → re-exports above |
| PDA feedback codes | `lib/constants/pda-feedback-codes.ts` |
| Feedback service | `lib/services/lesson-feedback-service.ts` |
| DB fields | `lessonFeedback[]`, `performanceScore`, `studentStrengths[]`, `focusAreas[]` on `Booking` |
| DB model | `LearningContent` in schema |
| Landing showcase | `components/landing/ProgressTrackingShowcase.tsx` |

**PDA code ranges:**
- 10–16 Signal · 20–26 Look Behind · 30–37 Movement · 40–47 Path
- 50–57 Vehicle Management · 60–66 Responsiveness · 70–74 Flow · 80–86 Critical

---

## AUTHENTICATION

**What it does:** Login, register, email verification, password reset, session management.

| Layer | File |
|-------|------|
| Login page | `app/login/page.tsx` |
| Register page | `app/register/page.tsx` |
| Register API | `app/api/register/route.ts` |
| Check email | `app/api/auth/check-email/route.ts` |
| Forgot password | `app/api/auth/forgot-password/route.ts` |
| Verify email | `app/api/auth/verify-email/route.ts` |
| NextAuth config | `lib/auth.ts` |
| Middleware (route protection) | `middleware.ts` |
| DB model | `User` in schema |

---

## CLIENT DASHBOARD

**What it does:** Student's home — bookings, wallet, progress, book a lesson.

| Layer | File |
|-------|------|
| Book lesson | `app/client-dashboard/book-lesson/page.tsx` |
| Progress | `app/client-dashboard/progress/page.tsx` |
| Help | `app/client-dashboard/help/page.tsx` |
| Current instructor | `app/api/client/current-instructor/route.ts` |
| Mobile nav | `components/client/MobileBottomNav.tsx` |

---

## INSTRUCTOR DASHBOARD

**What it does:** Instructor's home — bookings, earnings, clients, availability, settings.

| Layer | File |
|-------|------|
| Dashboard nav | `components/DashboardNav.tsx` |
| Earnings page | `app/dashboard/earnings/page.tsx` |
| Clients page | `app/dashboard/clients/page.tsx` |
| Bookings reschedule | `app/dashboard/bookings/[id]/reschedule/page.tsx` |
| Mobile nav | `components/instructor/MobileBottomNav.tsx` |
| Check-in button | `components/mobile/CheckInButton.tsx` |

---

## ADMIN PANEL

**What it does:** Platform-wide management — instructors, clients, bookings, payouts, revenue, settings, audit log.

| Layer | File |
|-------|------|
| Admin layout | `app/admin/layout.tsx` |
| Admin nav | `components/admin/AdminNav.tsx` |
| Admin mobile nav | `components/admin/MobileBottomNav.tsx` |
| Dashboard | `app/admin/page.tsx` |
| Bookings | `app/admin/bookings/page.tsx` · `app/api/admin/bookings/route.ts` |
| Clients | `app/admin/clients/[id]/page.tsx` · `app/api/admin/clients/route.ts` |
| Revenue | `app/admin/revenue/page.tsx` · `app/api/admin/revenue/route.ts` |
| Pricing | `app/admin/pricing/page.tsx` · `app/api/admin/pricing/route.ts` |
| Settings | `app/admin/settings/page.tsx` · `app/api/admin/settings/route.ts` |
| Documents | `app/admin/documents/review/[instructorId]/page.tsx` · `app/api/admin/documents/compliance/route.ts` |
| Reviews | `app/admin/reviews/page.tsx` |
| Credits | `app/admin/credits/page.tsx` |
| Support | `app/admin/support/page.tsx` |
| Staff governance | `app/admin/staff-governance/page.tsx` |
| Audit log | `app/admin/audit-log/page.tsx` · `app/api/admin/audit-log/route.ts` |
| Register admin | `app/admin/register/page.tsx` · `app/api/admin/register/route.ts` |
| Pricing form | `components/admin/PricingSettingsForm.tsx` |
| Platform settings form | `components/admin/PlatformSettingsForm.tsx` |
| DB model | `AuditLog`, `PlatformSettings` in schema |

---

## NOTIFICATIONS & ALERTS

**What it does:** In-app notifications, SMS via Twilio, platform alerts for critical events, email/SMS retry queue.

| Layer | File |
|-------|------|
| Notifications API | `app/api/notifications/route.ts` |
| Mark read | `app/api/notifications/mark-read/route.ts` |
| Notifications service | `lib/services/notifications.ts` |
| Alert service | `lib/services/alert-service.ts` |
| Email service | `lib/services/email.ts` |
| SMS service | `lib/services/sms.ts` |
| Notification retry service | `lib/services/notificationRetry.ts` |
| Notification retry cron | `app/api/cron/notification-retry/route.ts` |
| Mobile push service | `lib/services/pushNotification.ts` |
| Device token registration | `app/api/mobile/push/register-device/route.ts` |
| DB model | `Notification`, `NotificationRetry`, `DeviceToken` in schema |

---

## AI VOICE RECEPTIONIST

**What it does:** Azure Copilot Studio hybrid — answers calls 24/7, creates bookings, sends payment links.

| Layer | File |
|-------|------|
| Message log model | `Message` in schema |
| Landing showcase | `components/landing/AIReceptionistShowcase.tsx` |
| Doc | `docs/DOCROLEBASE/01-public/LANDING_PAGE.md` (AI section) |

---

## BUSINESS RECORDS & EXPENSES

**What it does:** Instructors track business expenses (fuel, insurance, training, etc.) alongside income from analytics. CSV export for accountant use. No tax advice given.

| Layer | File |
|-------|------|
| Expenses page | `app/dashboard/expenses/page.tsx` |
| Expenses API | `app/api/instructor/expenses/route.ts` |
| Expense delete | `app/api/instructor/expenses/[id]/route.ts` |
| DB model | `InstructorExpense` in schema |
| Doc | `docs/DOCROLEBASE/03-instructor/BUSINESS_RECORDS.md` |

---

## ADMIN SUPPORT CENTRE

**What it does:** Admin can view and manage any user account — edit profile, reset password, add/deduct wallet credit, approve/suspend instructor.

| Layer | File |
|-------|------|
| Support list | `app/admin/support/page.tsx` |
| User detail | `app/admin/support/user/[userId]/page.tsx` |
| User PATCH API | `app/api/admin/users/[userId]/route.ts` |
| Password reset API | `app/api/admin/users/[userId]/reset-password/route.ts` |
| Contact user API | `app/api/admin/contact/route.ts` |

---

**What it does:** Platform analytics, Stripe reconciliation cron, mobile analytics.

| Layer | File |
|-------|------|
| Analytics API | `app/api/analytics/route.ts` |
| Mobile analytics | `app/api/analytics/mobile/route.ts` |
| Stripe reconcile cron | `app/api/cron/reconcile-stripe/route.ts` |
| Cleanup cron | `app/api/cron/cleanup-expired-bookings/route.ts` |
| DB model | `ReconciliationReport` in schema |

---

## LANDING PAGE & PUBLIC PAGES

| Page | File |
|------|------|
| Homepage | `app/page.tsx` |
| Book search | `app/book/page.tsx` |
| For instructors | `app/teach-with-drivebook/page.tsx` |
| About | `app/about/page.tsx` |
| Contact | `app/contact/page.tsx` |
| Privacy | `app/privacy/page.tsx` |
| Terms | `app/terms/page.tsx` |
| Blog listing | `app/blog/page.tsx` |
| Blog post | `app/blog/[slug]/page.tsx` |
| Blog tag archive | `app/blog/tag/[tag]/page.tsx` |
| Landing components | `components/landing/` |
| Doc | `docs/DOCROLEBASE/01-public/LANDING_PAGE.md` |
| Doc | `docs/DOCROLEBASE/01-public/BLOG.md` |

---

## BLOG

**What it does:** Static MDX-based blog at `/blog`. Serves both learner drivers and driving instructors. Powers SEO organic traffic. Every post has a category-appropriate CTA.

| Layer | File |
|-------|------|
| Blog utility lib | `lib/blog.ts` |
| Listing page | `app/blog/page.tsx` |
| Individual post | `app/blog/[slug]/page.tsx` |
| Tag archive | `app/blog/tag/[tag]/page.tsx` |
| RSS feed | `app/rss.xml/route.ts` |
| Post content | `content/blog/*.mdx` (23 posts, July 2026) |
| Doc | `docs/DOCROLEBASE/01-public/BLOG.md` |

---

## SEO & DISCOVERY

**What it does:** Sitemap, robots.txt, RSS feed, OpenGraph, JSON-LD structured data, page metadata.

| Layer | File |
|-------|------|
| Root metadata + JSON-LD | `app/layout.tsx` |
| Dynamic sitemap | `app/sitemap.ts` |
| Robots.txt | `app/robots.ts` |
| RSS feed | `app/rss.xml/route.ts` |
| Book page metadata | `app/book/layout.tsx` |
| Instructor microsite metadata | `app/subdomain/[slug]/page.tsx` (`generateMetadata`) |
| Blog post metadata | `app/blog/[slug]/page.tsx` (`generateMetadata`) |
| Instructor search API | `app/api/instructors/search/route.ts` |
| Doc | `docs/DOCROLEBASE/08-technical/SEO.md` |

---

## INFRASTRUCTURE

| Concern | File |
|---------|------|
| Prisma schema | `prisma/schema.prisma` |
| Prisma client | `lib/prisma.ts` |
| Prisma migrations | `prisma/migrations/` |
| Database | PostgreSQL via Supabase (project: zzntmozvppyzeaqautpi, pooler port 6543) |
| NextAuth | `lib/auth.ts` |
| Middleware | `middleware.ts` |
| Next.js config | `next.config.js` |
| Vercel config (crons) | `vercel.json` |
| Environment vars | `.env` |
| Health check | `app/api/health/route.ts` |
| Mobile (Capacitor) | `capacitor.config.ts` · `mobile/` · `styles/mobile.css` |

---

## KEY RULES (don't break these)

- `commissionRate` is NEVER stored on `Instructor` — always derived from `PlatformSettings`
- `newStudentBonus` was removed in May 2026 — do not re-add it
- Ledger is append-only — `LedgerEntry` records are never mutated
- Never mark a payout PAID unless money actually moved
- ABN verification uses ABR GUID lookup — `lib/utils/abn-validation.ts`
- Timezone: `Australia/Perth` (AWST, UTC+8)
- Currency: AUD, `$` symbol only
- Governing law: Western Australia
- Rate changes must go through the Rate Change Scheduler — never update `PlatformSettings` commission rates directly without scheduling
- `prisma db push` is dev-only — production schema changes must use `prisma migrate deploy`
- Dead-code services (`governance`, `staff`, `pda`, `ledger.ts`, `fraudDetection`) have `@ts-nocheck` — do not call them from production paths
