# DriveBook — Admin Business Rules & Pre-Action Policy

> **Who this is for:** ADMIN and SUPER_ADMIN roles operating the DriveBook platform.
> **Purpose:** Before taking any significant action, check the relevant section here.
> Prevents double-processing, policy violations, and audit failures.
>
> **Rule source:** `lib/config/governance.ts` — all financial thresholds come from there.

---

## Quick Navigation

| I need to... | Go to section |
|---|---|
| Approve or reject an instructor | [§1 Instructor Approval](#1-instructor-approval) |
| Process or trigger a payout | [§2 Payouts](#2-payouts) |
| Issue a refund or override a refund | [§3 Refunds](#3-refunds) |
| Cancel a booking on behalf of a user | [§4 Booking Cancellation](#4-booking-cancellation) |
| Suspend or unsuspend an instructor | [§5 Instructor Suspension](#5-instructor-suspension) |
| Change commission rates or platform fees | [§6 Pricing Changes](#6-pricing-changes) |
| Enable or configure the BUSINESS tier | [§7 Business Tier Activation](#7-business-tier-activation) |
| Assign or remove a voice line | [§8 Voice Line Management](#8-voice-line-management) |
| Handle a dispute or chargeback | [§9 Disputes](#9-disputes) |
| Modify wallet credits | [§10 Wallet Adjustments](#10-wallet-adjustments) |
| Close or reopen a support task | [§11 Task Management](#11-task-management) |
| Understand what the system does automatically | [§12 Automated Actions](#12-automated-actions) |
| Understand who can do what | [§13 Permission Matrix](#13-permission-matrix) |
| Understand escalation rules | [§14 Escalation & SLA](#14-escalation--sla) |
| Know what gets logged | [§15 Audit Requirements](#15-audit-requirements) |

---

## 1. Instructor Approval

**Admin page:** `/admin/instructors/[id]`

### Before approving:

- [ ] License number present and not expired
- [ ] Insurance policy document uploaded and not expired
- [ ] Police check uploaded and not expired (check expiry date)
- [ ] WWC check uploaded (if required for state)
- [ ] Profile photo uploaded
- [ ] ABN provided (if operating as a business) — ABN must be verified via `/admin/instructors/[id]` before their first payout
- [ ] Phone number confirmed (used by AI receptionist and SMS)
- [ ] Hourly rate set (cannot be $0)
- [ ] Working hours configured (instructor cannot receive bookings without this)
- [ ] Base address set (used for instructor search radius)
- [ ] `approvalStatus` is currently `PENDING` — not already `APPROVED` or `SUSPENDED`

### On approval:

The system automatically:
- Sets `approvalStatus = APPROVED`
- Makes the instructor visible in search results
- Activates their trial subscription (14 days for BASIC/PRO/STUDIO, 30 days for BUSINESS)

### Do NOT:

- Approve without all required documents — compliance liability falls on DriveBook
- Manually set `subscriptionStatus` — this is managed by the subscription webhook
- Approve an instructor with an expired document — system will block payouts until renewed

---

## 2. Payouts

**Admin page:** `/admin/payouts`
**Automated run:** Every Tuesday 2am AWST (cron: `weekly-payouts`)

### Automated payout eligibility (system checks these automatically):

The weekly cron processes instructors who meet ALL of these:
- `payoutMethod = 'stripe_connect'`
- `stripeAccountId` is set
- `chargesEnabled = true` (Stripe Connect onboarding complete)
- `payoutsEnabled = true` (bank account linked)
- `payoutHold = false` (no open dispute freeze)
- ABN verified (or no ABN on file — 47% withholding applies)
- Lesson ended more than 48 hours ago (dispute buffer = `lateCancellationWindowHours * 2`)

### Before triggering a manual payout:

- [ ] Check the automated run log first — the cron may have already processed it
- [ ] Confirm the instructor's Stripe Connect onboarding is complete (`chargesEnabled` + `payoutsEnabled` both true)
- [ ] Check for open disputes — if `payoutHold = true`, payout is blocked. **Do not override a payout hold without dispute resolution.**
- [ ] Confirm ABN status if payout > $0 — unverified ABN triggers 47% withholding
- [ ] Check payout amount against approval threshold:

| Amount | Who can approve |
|---|---|
| Up to $200 | ADMIN |
| $200 – $1,000 | SUPERVISOR or ADMIN |
| Over $1,000 | SUPER_ADMIN |

### Do NOT:

- Manually trigger a payout for an instructor with `payoutHold = true`
- Process bank transfer payouts through the Stripe route — bank transfer instructors are manual
- Pay the same instructor twice in the same week without checking the cron run log
- Modify `payoutsEnabled` or `chargesEnabled` directly — these are set by Stripe webhook

---

## 3. Refunds

**Admin page:** `/admin/bookings/[id]` or `/admin/disputes`

### Refund tiers (system-calculated, not manual):

| Notice given | Refund |
|---|---|
| 48+ hours before lesson | 100% — full refund to wallet |
| 24–48 hours before lesson | 50% — partial refund to wallet |
| Under 24 hours | 0% — no refund |
| Booking not paid (PENDING_PAYMENT) | 100% — slot released, no money moved |

> These thresholds are configurable via `PlatformSettings.lateCancellationWindowHours`. See `HARDCODED_VALUES.md`.

### Before issuing a manual refund override:

- [ ] Confirm the automatic calculation is incorrect (show reason)
- [ ] Check if instructor has been notified and agrees
- [ ] Check override amount against staff authority limit:

| Override amount | Who can approve |
|---|---|
| Up to $50 per booking | ADMIN (goodwill refund) |
| Up to $100 | ADMIN |
| $100 – $500 | SUPERVISOR or SUPER_ADMIN |
| Over $500 | SUPER_ADMIN only |

- [ ] Check monthly override cap: max **$200 per staff member per month**
- [ ] Write justification (minimum 20 characters) — required for audit log

### Do NOT:

- Issue a refund by directly modifying wallet balance — always go through the refund API so the ledger stays consistent
- Issue a refund on a booking that has already been refunded — check `refundedAt` first
- Override a $0 refund (under 24h cancellation) without SUPER_ADMIN approval — this is a policy exception
- Process refund if `payoutHold = true` on the instructor — the dispute must be resolved first

---

## 4. Booking Cancellation

**Admin page:** `/admin/bookings`

### Before cancelling a booking on behalf of a user:

- [ ] Confirm the booking status allows cancellation — only `PENDING_PAYMENT`, `PENDING`, or `CONFIRMED` can be cancelled
- [ ] Check `isNonRefundable` flag — if true, student gets no refund regardless of notice
- [ ] Calculate the refund tier (see §3) or use the system's `cancellation-policy` API
- [ ] Notify both instructor and student before cancelling if the lesson is within 48 hours
- [ ] Record reason in the cancellation note

### Refund after admin cancellation:

- Admin cancellations follow the same refund tier rules as student cancellations
- If cancelling due to instructor fault (instructor no-show, emergency), issue 100% refund regardless of notice period — requires justification in audit log
- If cancelling due to student breach of terms, issue 0% refund — requires SUPER_ADMIN sign-off

### Do NOT:

- Cancel `COMPLETED` or `CANCELLED` bookings — the system will reject this
- Cancel without a reason — the notes field is required
- Cancel a `PENDING_PAYMENT` booking via the full cancel flow — use the slot-release path (no payment captured, so no refund calculation needed)

---

## 5. Instructor Suspension

**Admin page:** `/admin/instructors/[id]`

### Before suspending:

- [ ] Document the reason (policy breach, compliance failure, dispute, etc.)
- [ ] Check for upcoming confirmed bookings — these must be cancelled or reassigned first
- [ ] Check for open wallet credits — students with paid packages need to be notified
- [ ] Check for pending payouts — hold any pending payout (`payoutHold = true`) before suspending
- [ ] Suspension requires ADMIN or SUPER_ADMIN — SUPPORT role cannot suspend

### On suspension:

The system automatically:
- Sets `approvalStatus = SUSPENDED`
- Hides the instructor from all public search results immediately
- Blocks new bookings on their subdomain page (shows "not accepting bookings")
- Does NOT cancel existing confirmed bookings — admin must do this manually

### Before unsuspending:

- [ ] Confirm the reason for suspension has been resolved
- [ ] Re-verify any expired documents
- [ ] Check with SUPER_ADMIN if suspension was for a dispute or chargeback
- [ ] Confirm the instructor's Stripe Connect status is still valid

### Do NOT:

- Unsuspend without clearing the `payoutHold` flag if it was set for a dispute
- Unsuspend without re-verifying documents if the suspension was compliance-related
- Reinstate a suspended instructor without audit log entry explaining the reason

---

## 6. Pricing Changes

**Admin page:** `/admin/pricing`

### Before changing commission rates:

- [ ] Rate changes are **prospective only** — they apply to new bookings, never retroactive
- [ ] All existing confirmed bookings retain the rate locked at payment time
- [ ] Notify instructors at least 7 days before a commission rate increase
- [ ] SUPER_ADMIN approval required for any commission rate change
- [ ] Document the business reason in the audit log

### Before changing platform fee:

- [ ] Platform fee is charged to the student at booking time — a change affects student-facing prices immediately
- [ ] Test the pricing calculation after changing (`/admin/pricing` shows a preview)
- [ ] SUPER_ADMIN approval required
- [ ] Announce to instructors (affects their take-home rate display)

### Before changing cancellation window:

- [ ] The `lateCancellationWindowHours` value controls BOTH the cancellation tier AND the dispute buffer for payouts
- [ ] Changing it affects: cancel routes, cancellation-policy API, weekly-payouts cron, and CancelDialog UI
- [ ] Announce to instructors and students before changing — affects refund expectations

### Do NOT:

- Change commission rates without SUPER_ADMIN approval
- Change `PlatformSettings` directly in the DB — use `/admin/pricing` so the change is logged
- Apply a new rate to already-paid bookings

---

## 7. Business Tier Activation

**Admin page:** `/admin/instructors/[id]` → subscription section

### Pre-launch checklist (one-time, platform-level):

- [ ] Stripe BUSINESS monthly and annual products created in Stripe dashboard
- [ ] `STRIPE_BUSINESS_MONTHLY_PRICE_ID` and `STRIPE_BUSINESS_ANNUAL_PRICE_ID` set in `.env`
- [ ] `comingSoon: true` removed from `components/SubscriptionPlans.tsx`
- [ ] Migration applied: `businessName` column exists in production DB

### Before manually setting an instructor to BUSINESS tier:

- [ ] Instructor has provided a school/business name (set in branding settings)
- [ ] ABN is verified (BUSINESS accounts must have ABN for payouts)
- [ ] Instructor understands BUSINESS = organisation-led identity (school name on all surfaces)
- [ ] Multi-instructor features are Coming Soon — set expectation clearly

### On BUSINESS activation:

The subscription webhook automatically:
- Sets `subscriptionTier = BUSINESS`
- Sets `subscriptionStatus = ACTIVE` or `TRIAL`
- Auto-assigns a dedicated Twilio voice line (PRO+ pool)
- Applies 10% commission rate going forward

### Do NOT:

- Manually set `subscriptionTier = BUSINESS` without Stripe subscription — the webhook won't fire and the tier will revert on next subscription sync
- Promise multi-instructor features — they are Phase 2, not yet built

---

## 8. Voice Line Management

**Admin page:** `/admin/voice-lines`

### Assigning a voice line:

- [ ] Instructor must be on PRO, STUDIO, or BUSINESS tier
- [ ] Check pool status — if no `AVAILABLE` numbers exist, the instructor goes on the waiting list
- [ ] Assignment is logged automatically in the audit log
- [ ] The line becomes active immediately after assignment

### Releasing a voice line:

- [ ] Check if the instructor is downgrading, cancelling, or being suspended
- [ ] Released line returns to `AVAILABLE` in the pool for reassignment
- [ ] Notify instructor before releasing — their booking number will stop working

### Do NOT:

- Assign a line to a BASIC tier instructor — voice lines are PRO+ only
- Manually edit `voiceLine` on the instructor record without going through the assignment service — the `TwilioPhoneNumber` pool record must also be updated

---

## 9. Disputes

**Admin page:** `/admin/disputes`

### On a new dispute / chargeback:

1. **Immediately** set `instructor.payoutHold = true` — blocks all payouts for that instructor
2. Document the dispute ID and amount in the audit log
3. Gather evidence: booking details, payment records, SMS confirmation, booking timeline
4. Stripe dispute response deadline is 7 days from notification

### Refund during active dispute:

- **Do not issue a refund** while a dispute is open — Stripe may count it as double-refund
- Wait for Stripe dispute resolution before processing wallet credit

### On dispute win (platform wins):

- [ ] Clear `payoutHold = false` on the instructor
- [ ] Verify the instructor payout was not blocked for too long — check weekly cron ran correctly after hold cleared
- [ ] Audit log entry confirming dispute resolution and hold cleared

### On dispute loss (student wins, chargeback):

- [ ] The student's payment is already reversed by Stripe — do not also issue a wallet refund
- [ ] Assess whether instructor owes the platform (check `instructorPayout` on the booking)
- [ ] SUPER_ADMIN decision required if instructor recovery is needed

---

## 10. Wallet Adjustments

**Admin page:** `/admin/credits`

### Before adding wallet credit:

- [ ] Document reason (goodwill, dispute resolution, error correction)
- [ ] Check approval threshold:

| Amount | Who can approve |
|---|---|
| Up to $50 | ADMIN |
| $50 – $200 | SUPERVISOR |
| Over $200 | SUPER_ADMIN |

- [ ] Write reason (minimum 20 characters for audit)
- [ ] Confirm the student's account is active

### Do NOT:

- Add wallet credit by directly editing `ClientWallet.balance` — always use the wallet transaction API so the ledger stays consistent
- Add credit to offset a legitimate no-refund cancellation without SUPER_ADMIN approval

---

## 11. Task Management

**Admin page:** `/admin/support`

### Before closing a support task:

- [ ] Resolution text is present (minimum 30 characters)
- [ ] At least one note recorded in the task timeline
- [ ] If financial — financial impact is recorded
- [ ] Linked entities verified (booking exists, instructor exists, etc.)
- [ ] SUPERVISOR or ADMIN role required to close — SUPPORT role can only resolve

### Reopening a task:

- [ ] Document reason for reopening
- [ ] Notify original assignee
- [ ] Reset SLA timer from reopen date

---

## 12. Automated Actions

> **Read this before doing anything manually.** The system handles these automatically.
> Doing them manually will cause duplicates, ledger inconsistencies, or audit failures.

| Action | Automated | Frequency | Do NOT do manually |
|---|---|---|---|
| Stripe Connect payouts | ✅ Yes | Every Tuesday 2am AWST | Don't manually transfer unless cron failed |
| Stripe payment confirmation | ✅ Yes | On `payment_intent.succeeded` webhook | Don't manually mark booking as paid |
| Booking expiry (unpaid, 10 min) | ✅ Yes | Every 5 min | Don't manually expire — let cron run |
| Short-notice booking expiry (2 hrs) | ✅ Yes | Every 5 min | Don't manually expire |
| Auto-complete (lesson ended + check-in) | ✅ Yes | Every 5 min | Don't manually set COMPLETED |
| Auto no-show (no check-in, 3 hrs past) | ✅ Yes | Every 5 min | Don't manually set NO_SHOW |
| Lesson SMS reminders (24h before) | ✅ Yes | Daily 10pm UTC | Don't send duplicate reminders |
| Stripe reconciliation | ✅ Yes | Daily 3am AWST | Only intervene if flagged report |
| Stripe auto-confirm missed webhooks | ✅ Yes | Daily (reconcile cron) | Check reconciliation report first |
| FinancialLedger gap backfill | ✅ Yes | Daily (reconcile cron) | Don't manually add ledger entries |
| Document expiry alerts | ✅ Yes | Weekly Monday | Don't send manual emails — system handles |
| Trial expiry enforcement | ✅ Yes | Daily | Don't manually change subscriptionStatus |
| Package expiry alerts | ✅ Yes | Every 15 min | Don't manually notify |

---

## 13. Permission Matrix

Defined in `lib/config/governance.ts` → `STAFF_PERMISSIONS`.

| Action | SUPPORT | FINANCIAL | TECHNICAL | SUPERVISOR | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|---|
| Approve refund (≤$100) | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Approve refund ($100–$500) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve refund (>$500) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Process payout (≤$200) | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Process payout (>$1,000) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cancel booking | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve instructor | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Suspend instructor | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Change commission rates | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Modify wallet (any amount) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Override refund policy | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Access audit log | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Close support tasks | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Assign voice lines | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 14. Escalation & SLA

Defined in `lib/config/governance.ts` → `SLA_RULES` + `ESCALATION_RULES`.

### Response time SLAs:

| Priority | Must respond within | Must resolve within | Escalate after |
|---|---|---|---|
| URGENT | 15 min | 60 min | 30 min |
| HIGH | 30 min | 4 hours | 2 hours |
| NORMAL | 2 hours | 24 hours | 12 hours |
| LOW | 8 hours | 3 days | 2 days |

### Escalation hierarchy:

1. Level 1 → Supervisor — escalate if no response in 30 min
2. Level 2 → Admin — escalate if Supervisor no response in 60 min
3. Level 3 → SUPER_ADMIN — final, no further escalation

### Always notify SUPER_ADMIN directly for:

- `PAYMENT_DISPUTE`
- `COMPLAINT`
- Any payout failure (CRITICAL severity alert auto-fires)
- Any action requiring over $500 approval

---

## 15. Audit Requirements

Defined in `lib/config/governance.ts` → `AUDIT_REQUIREMENTS`.

**Every admin action that touches money or status must be logged.**

### Actions that are automatically logged to `AuditLog`:

- Booking payment confirmed
- Booking cancelled
- Booking rescheduled
- Payout processed
- Payout failed
- Instructor approved / suspended
- Wallet credited / debited
- Refund issued
- Admin AI query (`ADMIN_AI_QUERY`)
- Any action using `actorId: 'SYSTEM_CRON'` (automated actions)

### For manual overrides, additionally required:

- Override reason (minimum 20 characters)
- SUPER_ADMIN approval reference if amount exceeds threshold
- Dual-control: amounts over $500 require second admin confirmation (`DUAL_CONTROL_THRESHOLD`)

### Audit log retention:

Audit records are retained for **7 years** (`AUDIT_RETENTION_DAYS = 2555`).
Do not delete audit log entries — this is a compliance requirement.

---

## 16. What Requires SUPER_ADMIN vs ADMIN

| Action | ADMIN | SUPER_ADMIN |
|---|---|---|
| Approve instructor | ✅ | ✅ |
| Suspend instructor | ✅ | ✅ |
| Refund ≤$500 | ✅ | ✅ |
| Refund >$500 | ❌ | ✅ |
| Change commission rates | ❌ | ✅ |
| Change platform fee | ❌ | ✅ |
| Override refund policy | ❌ (SUPERVISOR can) | ✅ |
| Enable BUSINESS tier | ❌ | ✅ |
| Clear payout hold after dispute | ✅ (after resolution) | ✅ |
| Payout >$1,000 | ❌ | ✅ |
| Add wallet credit >$200 | ❌ | ✅ |
| Emergency platform override | ❌ | ✅ |

---

*Last updated: 2026-07-19*
*Governed by: `lib/config/governance.ts` — changes to thresholds require SUPER_ADMIN approval and must be reflected in this document.*
