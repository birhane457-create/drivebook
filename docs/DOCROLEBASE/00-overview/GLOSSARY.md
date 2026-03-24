# Glossary

Terms used throughout DriveBook documentation and codebase.

---

## Roles

**CLIENT** — A learner driver who books lessons. Has a `User` record with `role: "CLIENT"` and optionally a `ClientWallet`.

**INSTRUCTOR** — A driving instructor. Has a `User` record with `role: "INSTRUCTOR"` and an `Instructor` record with profile, subscription, and branding data.

**ADMIN / SUPER_ADMIN** — Platform staff. Access to all admin routes at `/admin/*`.

**Guest** — A client who books via the public subdomain without a pre-existing account. An account is created automatically during booking.

---

## Booking

**Booking** — A time slot reservation between a client and instructor. Stored in the `Booking` model.

**Booking Status** — The lifecycle state of a booking:
- `PENDING` — Created but not yet confirmed (legacy/manual flows)
- `PENDING_PAYMENT` — Slot reserved, awaiting Stripe payment (max 10 min)
- `CONFIRMED` — Paid and confirmed, slot is locked
- `COMPLETED` — Lesson delivered
- `CANCELLED` — Cancelled by instructor, client, or admin
- `EXPIRED` — `PENDING_PAYMENT` not paid within 10 min
- `NO_SHOW` — Admin-tagged or auto-set 3h after end time with no check-in

**Slot** — A specific time window (startTime to endTime) on an instructor's calendar.

**Slot Hold** — When a booking is created as `PENDING_PAYMENT`, it holds the slot for 10 minutes while the client completes payment.

**Check-In** — The instructor (or client via mobile) marks the lesson as started. Required for the booking to auto-complete.

**Reschedule** — Moving a booking to a different time. Subject to notice period rules and potential wallet adjustments.

**Package Booking** — A bulk purchase of multiple lessons (e.g. 6, 10, or 15 hours). Stripe charges the full package amount; the wallet is credited with the total and debited per lesson.

**isFirstBooking** — Flag on a booking indicating it's the first lesson between this client and instructor. Affects commission rate (10% instead of standard rate).

**isNonRefundable** — Set to `true` when an instructor reschedules a booking within the 24-hour window. Means 0% refund on cancellation regardless of notice.

---

## Payments

**Wallet** — A client's credit balance on DriveBook. Stored in `ClientWallet`. Used to pay for lessons booked via the client dashboard.

**Wallet Balance** — Computed as: `SUM(CONFIRMED CREDIT transactions) - SUM(CONFIRMED DEBIT transactions)`. Never stored as a field.

**Top-Up** — Adding funds to a client wallet via Stripe. Creates a `WalletTransaction` of type `CREDIT`.

**Commission** — The percentage of a lesson price taken by the platform. Varies by instructor subscription tier. Configured via `/admin/pricing` and stored in `PlatformSettings`.

**Platform Fee** — The portion of the lesson price retained by DriveBook (= `price x commissionRate`).

**Instructor Payout** — The portion paid to the instructor (= `price - platformFee`). Locked at booking creation time.

**New Student Bonus** — A reduced commission rate applied to the first booking between a client and instructor. Configured per tier.

**GST** — Goods and Services Tax (10%). Applied to lesson prices. Governed by Australian tax law.

**PaymentIntent** — A Stripe object representing a payment in progress. Stored as `paymentIntentId` on the `Booking`.

**Webhook** — A Stripe event sent to `/api/stripe/webhook` when a payment succeeds or fails.

---

## Payouts

**Payout** — A record representing a batch payment from the platform to an instructor. Covers one or more eligible `Transaction` records. State machine: `ELIGIBLE -> PROCESSING -> PAID / FAILED / ON_HOLD`.

**PayoutTransaction** — An immutable join record linking a `Payout` to a `Transaction`. Transactions are never mutated — payout membership is tracked here only.

**idempotencyKey** — SHA-256 hash of the sorted transaction IDs included in a payout. Stored as a `@unique` DB constraint and passed to Stripe to prevent duplicate transfers on retry.

**ON_HOLD** — A payout state indicating an admin or dispute hold. The payout cannot be processed until explicitly released via `DELETE /api/admin/payouts/[payoutId]/hold`.

**withholdingTaxRate** — The ATO withholding percentage applied to an instructor's gross payout. 0% if ABN is verified; 47% (ATO statutory rate) if ABN is absent or unverified. Configurable platform-wide via `PlatformSettings`. TFN collection is not active.

**grossAmount** — Sum of `instructorPayout` across all transactions in a payout, before tax withholding.

**netAmount** — `grossAmount - taxWithheld`. The amount actually transferred to the instructor.

**payoutRef** — Human-readable payout reference, e.g. `PAYOUT-ABC123-1234567890`.

**Payout Snapshot** — When a `Payout` record is created (`buildPayout()`), the instructor's `payoutMethod` and `stripeAccountId` are copied onto the payout record at that moment. These values are immutable on the payout — changing payout settings later does not affect in-flight or completed payouts. This prevents mid-payout tampering and ensures a clean audit trail.

**abnVerified** — Boolean on the `Instructor` model. `true` only after an admin or the ABR API confirms the ABN is active and matches the instructor's name.

**abnStatus** — The current ABR status of the instructor's ABN. Possible values:
- `PENDING` — ABN submitted but not yet verified
- `ACTIVE` — ABN confirmed active by ABR
- `CANCELLED` — ABN is cancelled per ABR records
- `REVIEW_REQUIRED` — ABN lookup returned a mismatch or ambiguous result; admin must manually verify

**abnEntityName** — The legal entity name returned by the ABR for the instructor's ABN. Used for name-match verification and audit records.

**ABN Name Match Score** — A Jaccard similarity score (0–1) comparing the instructor's registered name against the ABR entity name. Computed in `lib/utils/abn-validation.ts`:
- ≥ 0.8 — auto-approved (`MATCHED`)
- 0.5–0.79 — flagged for admin review (`REVIEW_REQUIRED`)
- < 0.5 — no match (`NO_MATCH`)

**ABN Drift** — The risk that an ABN becomes cancelled after it was verified. Mitigated by a weekly cron job (`GET /api/cron/recheck-abn`) that rechecks all verified ABNs against the ABR. If cancelled, `abnVerified` is cleared, `withholdingTaxRate` reverts to 47%, and an `ABN_VERIFICATION_REVOKED` audit entry is created.

**BSB** — Bank State Branch code. A 6-digit Australian bank routing number (format: XXX-XXX). Validated for format only — there is no official Australian API to verify BSB ownership. The platform maps known BSB prefixes to bank names for UX feedback (e.g. `062` → Commonwealth Bank). Account ownership is confirmed manually by admin before the first bank transfer payout.

**bankAccountName** — The account holder name provided by the instructor for bank transfer payouts. Not verified against the bank — admin must confirm before processing.

---

## Platform Ledger

**PlatformLedger** — A singleton DB record (key = `"default"`) tracking running financial totals for the platform. Updated atomically on every payment, payout, and refund event.

| Field | Meaning |
|---|---|
| `totalCollected` | Total money received from students |
| `totalReserved` | Money earmarked for instructor payouts (not yet paid) |
| `totalPaidOut` | Total paid to instructors |
| `totalRefunded` | Total refunded to clients |
| `totalTaxWithheld` | Total ATO withholding retained |
| `availableBalance` | `totalCollected - totalPaidOut - totalRefunded` (computed on read) |

**LedgerEntry** — An append-only record of every financial event. Never updated after creation. Types:
- `PAYMENT_COLLECTED` — student payment captured; increases `totalCollected` and `totalReserved`
- `PAYOUT_PAID` — net payout transferred to instructor; decreases `totalPaidOut`
- `TAX_WITHHELD` — ATO withholding retained by platform; increases `totalTaxWithheld`
- `REFUND_ISSUED` — refund back to client; increases `totalRefunded`
- `ADJUSTMENT` — manual correction or post-payout deduction (e.g. instructor owes platform after a refund was issued post-payout). Amount is negative. Recovered from the instructor's next payout.

**availableBalance** — The safe payout ceiling. No payout can exceed this value. Computed as `totalCollected - totalPaidOut - totalRefunded`.

---

## Subscriptions

**Tier** — The instructor's subscription level: `BASIC`, `PRO`, or `BUSINESS`.

**Trial** — A free period before payment is required. BASIC/PRO: 14 days. BUSINESS: 30 days.

**trialEndsAt** — The date the trial expires. Stored on both `Instructor` and `Subscription` models.

**subscriptionStatus** — Current state: `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELLED`.

**billingCycle** — `monthly` or `annual`. Annual plans are discounted.

**cancelAtPeriodEnd** — If `true`, the subscription cancels at the end of the current billing period rather than immediately.

**Stripe Price ID** — The Stripe product price identifier for each tier/cycle combination. Set in `.env` as `STRIPE_BASIC_MONTHLY_PRICE_ID` etc.

---

## Branding

**Subdomain** — An instructor's public booking page at `[slug].drivebook.com.au`. Configured via `customDomain` on the `Instructor` model.

**Branded Booking Page** — When `showBrandingOnBookingPage: true`, the subdomain page shows the instructor's logo, colors, and name instead of the DriveBook defaults. Requires PRO or BUSINESS tier.

**brandColorPrimary / brandColorSecondary** — Hex color codes for the instructor's brand. Applied to the subdomain page.

---

## Technical

**Prisma** — The ORM used to interact with MongoDB. Schema at `prisma/schema.prisma`.

**PlatformSettings** — A singleton DB record (key = `"default"`) storing all admin-configurable rates and fees, including commission rates per tier, `withholdingTaxRate`, and surcharges. Accessed via `lib/services/platform-pricing.ts`.

**AuditLog** — An append-only record of every significant action (booking created, cancelled, payout state transitions, etc.). Never deleted.

**WebhookEvent** — Idempotency record for Stripe webhooks. Prevents double-processing on duplicate delivery.

**CRON_SECRET** — Bearer token required to call cron endpoints (e.g. `/api/cron/cleanup-expired-bookings`, `/api/cron/recheck-abn`).

**NextAuth** — Authentication library. Session-based auth for web. JWT-based auth for mobile.

**Capacitor** — Framework used to wrap the Next.js app as a native iOS/Android app.

---

## Locations

**Perth / AWST** — All times stored in UTC in the database. Displayed in `Australia/Perth` (UTC+8) timezone.

**serviceAreas** — A string field on `Instructor` describing the geographic areas they cover.

**serviceRadiusKm** — The radius (in km) from the instructor's base address within which they operate.

**pickupAddress** — The client's requested pickup location for a lesson.
