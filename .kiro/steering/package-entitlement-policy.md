---
inclusion: always
---

# Package Entitlement Policy — Authoritative Rules

This document records the approved business rules for DriveBook lesson packages. Every component, API route, notification, and UI element that references package value, hours, or entitlement must conform to these rules.

---

## What a Package Is

A DriveBook lesson package is **dollar-denominated wallet credit**, not a fixed-hour entitlement.

When a student selects a package during booking, the wizard multiplies the selected instructor's current hourly rate by the chosen number of hours to produce an estimated purchase price. That estimate is used solely to calculate the Stripe payment amount. It does not guarantee any number of lessons or hours.

**Example:**
> Student selects 10-hour package. Selected instructor charges $60/hr.
> Estimated value = 10 × $60 = $600.
> Student pays $600.
> Wallet is credited $600.
> The student has $600 of wallet credit — not 10 guaranteed hours.

---

## Lesson Pricing — The Booking-Time Price Lock

Each lesson is priced at the time the booking is confirmed:

```
lesson price = instructor.hourlyRate × lesson duration (hours)
```

This is the **booking-time price lock**. The rate used is the booking instructor's current hourly rate at the moment of confirmation — not the rate that was used during the initial package estimate.

**What this means:**

| Scenario | Effect on student |
|---|---|
| Same instructor, same rate | $600 buys 10 × 1hr lessons at $60 — exactly as estimated |
| Same instructor raises rate to $70 | Each lesson costs $70; $600 buys ~8.6 lessons; student must top up |
| Student switches to $80/hr instructor | Each lesson costs $80; $600 buys 7.5 lessons; student must top up |
| Student switches to $50/hr instructor | Each lesson costs $50; $600 buys 12 lessons — more than estimated |

**No compensation or adjustment is made for rate differences.** The student was informed at purchase that the package value was an estimate based on the selected instructor's rate at that time.

**How to avoid rate uncertainty:** Students may book all lessons upfront in the wizard. Each confirmed booking carries its own `lockedHourlyRate` and `price` — these are immutable after confirmation. Pre-booking all lessons is the only mechanism for a full price lock.

---

## Booking Record Requirements

Every confirmed child booking (a lesson drawn from a package) must store:

| Field | Value | Purpose |
|---|---|---|
| `price` | `instructor.hourlyRate × durationHours` | Audit trail, refund attribution, payout |
| `providerPayout` | `price × (1 - commissionRate)` | Instructor settlement |
| `commissionRate` | Rate at confirmation time (locked) | Payout calculation — never re-fetched |
| `lockedHourlyRate` | `instructor.hourlyRate` at confirmation | Immutable rate record |
| `source` | `'package_credit'` | Distinguishes from Stripe-paid bookings |
| `isPaid` | `true` | Lesson was paid from wallet credit |
| `parentBookingId` | ID of the parent package booking | Links child to package for refund attribution |

**`price: 0` is wrong on a confirmed lesson booking.** The lesson has a real economic value. Setting it to zero breaks audit trails, payout calculations, and refund attribution. The fact that no new Stripe charge occurs is indicated by `source: 'package_credit'`, not by zeroing the price.

---

## Refund Attribution — Authoritative Formula

When a package is cancelled, the refundable base amount is:

```
consumed = SUM(Booking.price)
           WHERE parentBookingId = packageBookingId
           AND status IN ('CONFIRMED', 'COMPLETED')

refundable_base = Booking.packageTotalPaid - consumed
```

**Why this formula:**
- `Booking.price` on each child booking is the actual amount deducted from the wallet for that lesson (once H-02 is fixed)
- `packageTotalPaid` is the Stripe amount — the ceiling for any refund
- The formula never produces a negative number (consumed cannot exceed packageTotalPaid because each lesson deducts from the wallet balance, which is capped at packageTotalPaid)
- No stale hour counters are involved

**This formula only works after H-02 is fixed** (child bookings storing correct `price`). Until H-02 is deployed and verified, the existing `calculatePartialPackageRefund()` formula remains in use. Do not change the refund formula before H-02 is verified safe.

**After time-based cancellation policy is applied:**
```
final_refund = refundable_base × refund_percentage
```
Where `refund_percentage` comes from `PlatformSettings` (48h+ = 100%, 24-48h = 50%, <24h = 0%).

---

## Refund Execution — Payment Authority

Per `booking-engine-architecture.md`:

- If `Provider.paymentMode = 'PLATFORM'`: DriveBook executes a Stripe refund of `final_refund` to the original payment method. The wallet is simultaneously debited by the remaining balance to prevent the student spending wallet credit that is being returned to their card.
- If `Provider.paymentMode = 'DIRECT'` (phase 2): DriveBook records the refund obligation and notifies the business. DriveBook does NOT issue a Stripe refund.

The refund destination is always the **original Stripe payment method**, not the wallet. The wallet is a holding ledger — money sits there only until it is used for a lesson or returned to the card. A wallet credit on top of a card refund would double-pay the student.

---

## `packageHoursRemaining` and `packageHoursUsed` — Audit Fields Only

These fields remain in the database and are not removed. Their roles after H-02 is deployed:

| Field | Authoritative for | Not authoritative for |
|---|---|---|
| `packageHoursRemaining` | Historical record; approximate display | Booking authorization; refund calculation |
| `packageHoursUsed` | Historical record; approximate display | Booking authorization; refund calculation |

Both fields may continue to be updated as a convenience. They must not be read in any financial decision path after H-02 is verified.

---

## Wallet Balance Display — Rules for UI

**Primary display:** Dollar balance. `$240.00 remaining`

**Secondary display (optional):** Estimated lessons. This estimate must:
1. Identify the instructor rate used: `≈ 4 lessons at your current instructor's rate ($60/hr)`
2. Use the word "approximately" or "≈" — never a definite claim
3. Not appear if no relevant instructor rate is available
4. Never be used as a booking gate or eligibility check

**Prohibited copy:**
- "X hours remaining" as the primary display — this implies a fixed-hour entitlement
- "X hours left before expiry" — uses stale `packageHoursRemaining`
- "You only have X hours remaining" as a hard error — must use wallet balance check instead
- Any copy that describes the package as a guaranteed number of lessons or hours

---

## Expiry Policy — Authoritative Statement

The legal terms of service (`app/terms/page.tsx` clauses 15.2 and 21) are the authoritative expiry policy:

> Wallet credits expire after 12 months of **account inactivity**.
> "Inactivity" means no booking has been made and no wallet transaction has occurred within the preceding 12 months.

**Contradictions to correct (do not change expiry enforcement logic — correct copy only):**

| File | Current copy | Required correction |
|---|---|---|
| `components/BulkBookingForm.tsx:379` | "Credits never expire" | "Credit is valid for 12 months from last account activity" |
| `app/dashboard/credits/add-funds/page.tsx:247` | "Credits never expire" | Same |
| `lib/services/receipt-email.ts:399,533` | "Credits never expire and can be used with any instructor on DriveBook" | "Credit is valid for 12 months from last activity and can be used with any instructor on DriveBook" |
| `components/BookNowOrLater.tsx:113` | "Your hours are valid for 12 months from purchase date" | "Your credit is valid for 12 months from last activity" |
| `components/PackageSelector.tsx:213` | "Hours secured & valid for 12 months from purchase" | "Credit secured — valid for 12 months from last activity" |
| `app/lessons/packages/page.tsx:94,130,167` | Three claims of "12 months from purchase date" | "12 months from last account activity" |
| `app/api/public/bookings/bulk/route.ts:647` | Stripe product description: "Valid for 12 months from purchase" | "Valid for 12 months from last account activity" |

**Do not retroactively expire existing credit.** Do not change any enforcement code. Correct copy only to match the existing legal terms.

---

## Summary — What Each Part of the System Must Do

| Part | Rule |
|---|---|
| Package purchase wizard | Show estimated hours and price. Label it as an estimate. |
| Stripe Checkout description | State inactivity-based expiry, not purchase-date expiry |
| `confirm-package-booking` route | Set `Booking.price = instructorRate × duration`; debit wallet by same amount; add `SERIALIZABLE` isolation |
| `schedule-package-hours` route | Gate on wallet balance ≥ lesson price, not on hour counter |
| Refund calculation (`calculatePartialPackageRefund`) | Use `SUM(child Booking.price)` after H-02 is verified; until then, existing formula remains |
| Admin cancellation UI | Call the same server calculation function as the approval route — no separate formula |
| `PackageCancellationModal` | Call a preview endpoint; do not recalculate in the browser |
| Student dashboard | Show wallet dollar balance as primary; estimated hours as secondary with rate qualifier |
| Notifications and SMS | Use wallet balance; do not claim a fixed hour count |
| `packageHoursRemaining` | Display as approximate; never use in financial decision |
