# Payment White-Label — Design & Status

**Last updated:** 2026-08-20

---

## The Core Problem

Even with a custom domain and fully branded booking page, the student's **bank statement** reveals the platform. If they pay through DriveBook's Stripe account, their statement shows:

```
DRIVEBOOK.COM.AU    $699.30
```

For a school running as "Sarah's Driving School", this is a white-label failure at the most trust-critical moment.

---

## The Two Payment Models

### Model A — PLATFORM mode (current default)

```
Student → DriveBook Stripe account → commission deducted → instructor payout (weekly)

Bank statement:  "DRIVEBOOK.COM.AU"
Receipt from:    DriveBook
Stripe dashboard shows: DriveBook transaction
DriveBook earns: commission % per lesson
```

This is how all bookings work today. DriveBook is the merchant of record.

### Model B — DIRECT mode (built but disabled)

```
Student → Instructor's own Stripe account (via Stripe Connect)

Bank statement:  "SARAH'S DRIVING SCHOOL" (instructor's Stripe business name)
Receipt from:    Instructor's Stripe account
Stripe dashboard shows: Instructor's own dashboard
DriveBook earns: subscription fee only (zero commission)
```

This is the correct model for full payment white-label.

---

## Current State of DIRECT Mode in the Codebase

### What IS built

| Component | File | Status |
|-----------|------|--------|
| `createDirectPaymentIntent()` | `lib/services/stripe.ts:110` | ✅ Complete — uses `on_behalf_of` + `transfer_data.destination` |
| Payment intent handler (DIRECT branch) | `app/api/payments/create-intent/route.ts:284` | ✅ Complete — creates direct charge, returns `clientSecret` with `paymentMode: 'DIRECT'` |
| Check-out commission handling (DIRECT) | `app/api/bookings/[id]/check-out/route.ts:193` | ✅ Complete — `isDirectMode` branch: `txPlatformFee=0`, `txInstructorPayout=booking.price` |
| `paymentMode` field on Instructor schema | `prisma/schema.prisma` | ✅ Field exists: `paymentMode String @default("PLATFORM")` |
| `stripeAccountId` + `chargesEnabled` fields | `prisma/schema.prisma` | ✅ Fields exist |
| Stripe Connect account creation | `lib/services/stripe.ts:createConnectAccount()` | ✅ Complete |
| Stripe Connect onboarding flow | `app/api/stripe/connect/route.ts` | ✅ Complete |

### What is NOT built / blocked

| Component | File | Issue |
|-----------|------|-------|
| Bulk booking route DIRECT guard | `app/api/public/bookings/bulk/route.ts:~255` | ❌ Hard 503 block — `"Direct payment mode not yet available"` |
| Webhook DIRECT handling | `app/api/stripe/webhook/route.ts` | ❌ No `paymentMode === 'DIRECT'` branch — fires wrong ledger entries |
| Admin UI to enable DIRECT mode | Dashboard settings | ❌ No toggle to switch instructor to DIRECT mode |
| DIRECT mode Stripe Connect requirement gate | Branding/settings | ❌ No check that instructor has completed Connect onboarding before allowing DIRECT |
| Subscription enforcement for DIRECT | Settings API | ❌ DIRECT should require PREMIUM+ — no gate currently |
| Refund handling for DIRECT bookings | `app/api/stripe/webhook/route.ts` | ❌ Refund path has no DIRECT branch — may create wrong ledger entry |
| Admin revenue reporting DIRECT bookings | `app/api/admin/revenue/route.ts` | ⚠️ Aggregates `instructorPayout` sum — DIRECT bookings would show $0 commission which is correct but admin dashboard must not treat this as a data error |

---

## How `on_behalf_of` Works (Stripe Connect)

The `createDirectPaymentIntent` call uses:

```typescript
on_behalf_of: instructorStripeAccountId,   // instructor's account
transfer_data: {
  destination: instructorStripeAccountId,  // funds go to instructor immediately
}
```

**What this means:**
- The charge is created on **DriveBook's Stripe account** (the platform) but on behalf of the instructor
- Stripe routes the **full amount** to the instructor's `destination` account immediately
- The student sees the instructor's **statement descriptor** (their Stripe business name)
- The instructor sees this transaction in **their own Stripe dashboard**
- DriveBook sees a **zero-net** transaction (amount in = amount transferred out)
- **No weekly payout step needed** — instructor has the money immediately

**What DriveBook still sees:**
- The transaction does still appear in DriveBook's Stripe account as a `payment_intent` with metadata
- The webhook will fire `payment_intent.succeeded`
- This is where the current gap is — the webhook needs to recognise `paymentMode: 'DIRECT'` in metadata and skip commission ledger entries

---

## What Needs to Be Built to Enable DIRECT Mode

### Step 1 — Fix the webhook (most critical)

File: `app/api/stripe/webhook/route.ts`

When `payment_intent.succeeded` fires for a DIRECT booking:
- Confirm the booking (same as PLATFORM) ✅
- Create `Transaction` with `platformFee=0`, `instructorPayout=fullAmount`, `commissionRate=0` ✅ (check-out handles this correctly)
- **Skip** the `FinancialLedger` commission entry — no DriveBook revenue for DIRECT
- **Skip** the weekly payout queue — instructor already has the money
- **Send** correct receipt — already handled by `brandedSender` 

The metadata on the PaymentIntent already includes `paymentMode: 'DIRECT'` so detection is straightforward:

```typescript
// In webhook payment_intent.succeeded handler:
const paymentMode = paymentIntent.metadata?.paymentMode;
if (paymentMode === 'DIRECT') {
  // Confirm booking, create Transaction with zero commission
  // Do NOT create FinancialLedger entry (no platform revenue)
  // Do NOT add to payout queue (funds already transferred)
  return;
}
// Existing PLATFORM flow continues below...
```

### Step 2 — Remove the 503 guard

File: `app/api/public/bookings/bulk/route.ts:~255`

Remove:
```typescript
if ((instructor as any).paymentMode === 'DIRECT') {
  console.error(`...`);
  return NextResponse.json({ error: 'Direct payment mode not yet available.' }, { status: 503 });
}
```

### Step 3 — Add DIRECT mode toggle to instructor settings

File: `app/dashboard/settings/page.tsx` (or branding page)

- Toggle: "Receive payments directly to my Stripe account"
- Requires: Stripe Connect onboarding completed (`chargesEnabled: true`)
- Requires: PREMIUM+ tier
- When enabled: sets `paymentMode = 'DIRECT'`
- Show clear explanation: "Students pay you directly. DriveBook earns only via your subscription. No commission per lesson."

### Step 4 — Gate DIRECT on Connect onboarding

In the settings save API, before setting `paymentMode = 'DIRECT'`:
```typescript
if (paymentMode === 'DIRECT') {
  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { stripeAccountId: true, chargesEnabled: true, subscriptionTier: true }
  });
  if (!instructor.chargesEnabled) {
    return NextResponse.json({ error: 'Complete Stripe Connect setup first' }, { status: 400 });
  }
  if (!['PREMIUM', 'STUDIO', 'PRO'].includes(instructor.subscriptionTier ?? '')) {
    return NextResponse.json({ error: 'DIRECT mode requires PREMIUM or above' }, { status: 403 });
  }
}
```

### Step 5 — Refund handling

File: `app/api/stripe/webhook/route.ts` (refund handlers)

When a DIRECT booking is refunded:
- Stripe automatically deducts from instructor's account (since that's where funds went)
- The DriveBook webhook still fires `charge.refunded`
- The refund handler must recognise DIRECT mode and **not** create a negative FinancialLedger entry against DriveBook's balance (there was no DriveBook revenue to reverse)

---

## The Statement Descriptor Question

When DIRECT mode is active, the student's bank statement shows **whatever the instructor has set as their Stripe account statement descriptor**. This is set during Stripe Connect onboarding.

For a school called "Sarah's Driving School":
- Stripe business name: `Sarah's Driving School`
- Statement descriptor: `SARAHS DRIVING` (max 22 chars, no special chars)
- Student sees: `SARAHS DRIVING    $699.30` ✅ fully white-labeled

This is controlled entirely by the instructor in their own Stripe dashboard — DriveBook does not set it.

---

## Business Model Implications

| Mode | DriveBook Revenue | When to Use |
|------|------------------|-------------|
| PLATFORM | Commission per lesson + subscription | BASIC / PRO — volume model |
| DIRECT | Subscription only, zero commission | PREMIUM+ — school wants full control |

DIRECT mode is the natural fit for PREMIUM/SCHOOL tier because:
- School has their own Stripe account and ABN
- They want bank statements in their own name
- They don't want DriveBook taking commission (they pay flat subscription instead)
- They need full control of their payment flow for accounting/GST purposes

---

## Summary Table

| Payment Touchpoint | PLATFORM mode | DIRECT mode (when built) |
|--------------------|--------------|--------------------------|
| Bank statement name | "DRIVEBOOK.COM.AU" | Instructor's business name |
| Stripe receipt email | From DriveBook | From instructor's Stripe |
| Funds arrive | Weekly payout from DriveBook | Immediately in instructor's account |
| Commission | % per lesson | Zero |
| DriveBook revenue | Commission | Subscription fee only |
| Booking page shows | ✅ Same branded UI | ✅ Same branded UI |
| Student experience | Pays "DriveBook" | Pays "School Name" |
| Full white-label payment | ❌ No | ✅ Yes |

---

## Effort to Complete DIRECT Mode

| Task | Effort | Risk |
|------|--------|------|
| Fix webhook for DIRECT | 4 hours | Medium — must not double-count or miss transactions |
| Remove 503 guard | 5 min | Low |
| Add settings toggle + gate | 3 hours | Low |
| Refund handler for DIRECT | 2 hours | Medium — test with Stripe test refunds |
| Admin dashboard awareness | 1 hour | Low — just label DIRECT transactions correctly |
| End-to-end test suite | 1 day | Medium — test card → webhook → payout flow |

**Total: 2–3 days of focused work** to fully activate DIRECT mode and have genuinely white-labeled payments.

---

## Platform Fee & Stripe Processing Cost in DIRECT Mode

### The Problem

In PLATFORM mode, DriveBook charges students a 3.6% platform fee which covers:
- Stripe's processing fee (~1.75% + $0.30 AU)
- A small DriveBook margin

In DIRECT mode with `on_behalf_of`, **Stripe's processing fee is charged to DriveBook's platform account by default**, not to the instructor's connected account.

This means without additional configuration, DriveBook would pay Stripe's fee (~$1.61 on a $75 lesson) while earning zero commission — a net loss per transaction.

### Recommended Rate: 2.5% for DIRECT Mode

3.6% applied to DIRECT mode would have the instructor absorbing $2.70 on a $75 lesson on top of their subscription fee. Over 40 lessons/month that's $108/month in fees beyond the subscription — defensible but aggressive.

**2.5% is the right number for DIRECT mode:**

```
Per $75 lesson (DIRECT mode):
  Student pays:           $75.00  (clean, no surcharge)
  application_fee_amount:  $1.88  (2.5%) → DriveBook
  Stripe deducts:          $1.61  (1.75% + $0.30) from application_fee
  DriveBook net margin:    $0.27  (thin but positive)
  Instructor nets:        $73.12  (97.5% of lesson price)

On refund:
  DriveBook returns:       $0.27  (profit margin only)
  DriveBook keeps:         $1.61  (Stripe's non-refundable sunk cost)
  DriveBook net:           $0.00  (perfect break-even)
```

Why 2.5% beats 3.6% for this mode:
- **Instructor absorbs $1.88 not $2.70** — over 40 lessons/month that's $75 vs $108
- **Honest to explain:** "2.5% covers card processing and fraud protection" is accurate
- **The gap above raw Stripe cost is $0.27/lesson** — no instructor will argue about 27 cents
- **DriveBook stays revenue-positive** without subsidising Stripe
- **3.6% is right for PLATFORM mode** where DriveBook handles payouts, commission, disputes, reconciliation — the full payment lifecycle. For DIRECT where the instructor owns the account, 2.5% is proportionate.

### Dashboard Copy for DIRECT Mode Onboarding

```
⚙️ Enable White-Label Payments

Your students pay you directly. Their bank statement shows your business name,
not DriveBook's.

Platform Service Fee: 2.5% deducted from your lesson earnings.
This covers card processing (~1.75% + $0.30) and DriveBook's fraud
protection and dispute handling.

Rate tip: To maintain a strict $75.00 net per hour, set your rate to $76.92.
```

### The Options (for reference)

| Rate | DriveBook nets per $75 | Instructor nets | Notes |
|------|----------------------|-----------------|-------|
| 3.6% | $1.55 | $72.30 | Current PLATFORM rate — too high for DIRECT |
| **2.5%** | **$0.27** | **$73.12** | **Recommended for DIRECT** |
| 1.75%+$0.30 (pass-through) | $0.00 | $73.39 | DriveBook absorbs risk, no margin |

### Correct Stripe API for Refunds

The refund code requires two separate Stripe API calls — `refund_application_fee` is a **boolean**, not an amount:

```typescript
// Step 1: Full refund to student (application_fee kept initially)
const refund = await stripe.refunds.create({
  charge: chargeId,
  refund_application_fee: false,
});

// Step 2: Refund only DriveBook's profit margin back to instructor
// (keep the Stripe sunk cost — it's non-refundable)
const stripeSunkCents = Math.round(originalAmountCents * 0.0175) + 30;
const appFeeCents = Math.round(originalAmountCents * 0.025);
const driveBookProfitCents = appFeeCents - stripeSunkCents;

if (driveBookProfitCents > 0) {
  await stripe.applicationFeeRefunds.create(applicationFeeId, {
    amount: driveBookProfitCents,
  });
}
```

This requires storing the `application_fee` ID from the original charge on the booking record. Add `directApplicationFeeId String?` to the Booking schema when implementing.

---



There is a third theoretical model where the instructor provides their own Stripe publishable + secret keys and DriveBook acts purely as the booking interface with no involvement in payment processing at all. This is the maximum white-label option.

**Not worth building now.** It eliminates DriveBook from the payment flow entirely which means:
- No webhook visibility into whether payments succeeded
- No ability to auto-confirm bookings
- No dispute handling
- No refund management
- DriveBook cannot enforce booking rules

DIRECT mode via Stripe Connect gives 95% of the white-label benefit with full platform visibility retained.
