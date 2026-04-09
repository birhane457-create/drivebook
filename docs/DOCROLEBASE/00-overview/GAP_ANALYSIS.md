# Gap Analysis

**Purpose:** Record of gaps identified during development and their resolution status.  
**For current system documentation, read the feature docs in `DOCROLEBASE/` and `docs/LAUNCH_PLAN.md`.**

---

## Resolved

| # | Area | What was wrong | What was done |
|---|------|---------------|---------------|
| 1 | Booking creation | Docs said all bookings start as PENDING_PAYMENT | SYSTEM_FLOWS.md updated — two paths documented: instructor wallet (CONFIRMED directly) and Stripe (PENDING_PAYMENT) |
| 2 | Commission rate | Hardcoded 15% regardless of tier | Both booking routes now call getCommissionRate(tier) from PlatformSettings |
| 3 | Wallet balance | Two different balance sources depending on entry point | SYSTEM_OF_RECORD.md clarified — transaction sum is authoritative |
| 4 | AuditLog on booking | Not logged on creation | POST /api/bookings now calls logBookingAction(BOOKING_CREATED) |
| 5 | No-account client booking | Hard 422 rejection | Creates PENDING_PAYMENT booking + sends claim email |
| 6 | Transaction status | Docs said COMPLETED for payout eligibility | Code uses SETTLED — FINANCIAL_DOCTRINE.md and STATE_MACHINES.md corrected |
| 7 | Webhook EXPIRED revival | Not documented | FAILURE_HANDLING.md and STATE_MACHINES.md document EXPIRED → CONFIRMED path |
| 8 | Package payment wallet | Not documented | WALLET.md documents CREDIT + DEBIT on package payment |
| 9 | Cancellation transaction | Docs said REFUNDED | Code uses CANCELLED — STATE_MACHINES.md corrected |
| 10 | Cancellation atomicity | Split transaction risk | Cancel route wraps wallet + booking + transaction in single prisma.$transaction |
| 11 | Admin booking audit | No AuditLog on status changes | PATCH /api/admin/bookings logs BOOKING_COMPLETED, BOOKING_NO_SHOW, BOOKING_CANCELLED |
| 12 | No-show party field | Stored in description string | noShowParty field added to Booking schema |
| 13 | Payout eligibility status | Docs said COMPLETED | Code uses SETTLED — all payout docs corrected |
| 14 | ABN gate behaviour | Not documented | INSTRUCTOR_APPROVALS.md documents: missing ABN = 47% withholding, present-but-unverified = blocked |
| 15 | Reconciliation stuck threshold | Docs said 24h | Code uses 10 minutes — FAILURE_HANDLING.md corrected |
| 16 | Reconciliation check 1 | Docs said Transaction check | Code checks LedgerEntry — SYSTEM_FLOWS.md corrected |
| 17 | ABN cron frequency | Docs said daily | Code is weekly (Mondays 2am) — INSTRUCTOR_APPROVALS.md corrected |
| 18 | ABN cron skip condition | Not documented | INSTRUCTOR_APPROVALS.md documents: skips if ABR_GUID not set |
| 19 | Wallet top-up amount validation | Not validated in webhook | Webhook now validates amount_received matches transaction amount |
| 20 | Wallet top-up orphan cleanup | PENDING transaction not cleaned on Stripe failure | wallet-topup-intent route deletes PENDING transaction if Stripe fails |
| 21 | Booking price from client | Accepted from request body | Price always calculated server-side; client value ignored |
| 22 | Slot conflict TOCTOU | Availability check outside transaction | Definitive conflict check now inside prisma.$transaction |
| 23 | Bulk booking instructor check | No active/approved check | public/bookings/bulk now checks approvalStatus and isActive |
| 24 | Short-notice booking expiry | Never expired | cleanup-expired-bookings cron expires PENDING bookings after 2 hours |
| 25 | WalletTransaction status | Mixed CONFIRMED/COMPLETED | All wallet transactions now use CONFIRMED |
| 26 | Wallet balance drift | Instructor path didn't update stored balance | Atomic decrement added to instructor booking path |
| 27 | sendReminder no-op | Only logged to console | Now sends real email to instructor listing expiring docs |
| 28 | Staff governance stats | Endpoint missing | GET /api/admin/staff-governance/stats implemented |
| 29 | Client review UI | Missing | ReviewModal + pending-reviews API + Leave Review button on bookings page |
| 30 | Lesson reminders cron | notifyLessonReminder never called | Cron fully wired with SMS + email for both instructor and student |
| 31 | Fake testimonials | On teach-with-drivebook page | Replaced with honest Early Access section |
| 32 | MongoDB references in docs | Multiple docs referenced MongoDB | All corrected to PostgreSQL |
| 33 | Rate locking | Not documented | BOOKING_FLOW.md and WALLET.md document book-now locked, book-later uses live rate |
| 34 | Slot blocking | check-and-reserve not documented | BOOKING_FLOW.md documents 10-min in-memory reservation |
| 35 | Admin bulk discount toggle | Not built | PricingSettingsForm now has master toggle for all three discount rates |
| 36 | 409 price-change refresh | Not built | SubdomainBookingWizard re-fetches pricing and shows amber banner |
| 37 | Offline booking system | Not built | POST /api/bookings/offline with PRO gate and platform client guard |
| 38 | SMS policy | Instructor received confirmation SMS | Confirmation SMS now student-only; instructor gets 24hr reminder SMS only |
| 39 | AuditLog indexes missing | No indexes on AuditLog table | 4 indexes created via SQL migration (createdAt, targetType, actorId, action) |
| 40 | Stripe payment events not in AuditLog | payment_intent.succeeded/failed not logged | PAYMENT_SUCCEEDED, PAYMENT_FAILED, WALLET_PAYMENT_SUCCEEDED actions added to webhook |
| 41 | Bank transfer risk undocumented | No warning about format-only BSB validation | PAYOUTS.md documents: format-only validation, admin must confirm before first transfer |

---

## Open

| # | Item | Owner |
|---|------|-------|
| C1 | UPSTASH_REDIS_REST_URL empty — rate limiting is in-memory only | Set in Vercel env vars |
| C5 | ABN placeholder in footer | Add real ABN to app/about/page.tsx |
