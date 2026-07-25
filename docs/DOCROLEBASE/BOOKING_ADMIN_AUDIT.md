# Booking Flow & Admin Dashboard — Audit

**Date:** 2026-07-23 (revised 2026-07-23)  
**Scope:** Public booking flow (`/book/**`), client payment flow (`/booking/**`), admin dashboard (`/admin/**`), supporting APIs  
**Method:** Direct file inspection + grep verification. Every finding below states what was checked.  

---

## SECTION 0 — RESOLVED (2026-07-23 to 2026-07-25)

| ID | What was fixed |
|---|---|
| ✅ C-08 | `window.confirm()` in admin subscription tab — replaced with `deleteRowConfirm` inline modal state |
| ✅ C-09 | `window.confirm()` on client payment page — replaced with `cancelConfirming` inline confirm panel |
| ✅ C-10 | Credits page stats from first 25 clients only — replaced with DB-aggregate endpoint `GET /api/admin/credits?stats=true` |
| ✅ C-11 | Admin booking stats from page slice — replaced with parallel `prisma.booking.count()` per status in `api/admin/bookings/route.ts` |
| ✅ C-12 | `BookingDetailsForm` unmount cleanup used hardcoded `sessionId: 'bulk-api'` — fixed to use actual session ID from context |
| ✅ C-13 | `/book/[instructorId]/schedule/page.tsx` orphaned redirect stub — deleted |
| ✅ C-14 | Admin bookings search was client-side — `search` param now wired to API with debounce, resets to page 1 |
| ✅ R-01 | `amount` param in PaymentIntent creation — confirmed safe (webhook validates `amount_received` vs `booking.price` server-side); recommendation noted as low priority, left as-is |
| ✅ R-03 | Revenue chart queries parallelised with `Promise.all` in `api/admin/revenue/route.ts` |
| ✅ C-02 | `alert()` on earnings receipt failure — replaced with toast |
| ✅ C-05 | `alert()` on reschedule failure — replaced with toast |
| ✅ C-03 | `alert()` on PDA tests page — replaced with `useToast()` + inline `slotError` |
| ✅ C-04 | `alert()` on booking/client payment link — replaced with `linkError` inline state + `role="alert"` |
| ✅ C-06 | `alert()` on setup/complete-profile — replaced with `useToast()` |

## SECTION 0B — SESSION 3 NEW FINDINGS (2026-07-25)

| ID | Severity | File | Issue | Status |
|---|---|---|---|---|
| **NF-01** | 🔴 | `dashboard/bookings/page.tsx` | 6 `window.confirm()` on check-in/out/cancel/delete/confirm/save | Open |
| **NF-02** | 🟠 | `dashboard/bookings/page.tsx` | `en-US` locale for all date/time — should be `en-AU` | Open |
| **NF-03** | 🟡 | `api/admin/payouts/route.ts` + `admin/payouts/page.tsx` | `bankBsb` unmasked in list table (P-02 resolved) | Open |
| **NF-04** | 🟡 | `client-dashboard/bookings/page.tsx` | Tab counts from page slice, not `upcomingCount`/`pastCount` | Open |
| **NF-05** | 🟡 | `api/client/wallet/route.ts` | Unbounded transaction query — no `take` limit on balance calc | Open |
| **NF-06** | 🟢 | `api/client/wallet/route.ts` | Dead `totalBookedHours` — loaded but never displayed | Open |
| **NF-07** | 🟢 | `staff/tasks/[id]/page.tsx` | 2 `alert()` calls on task creation failure (C-07 still open) | Open |

---

| Level | Meaning |
|---|---|
| **Confirmed** | Verified end-to-end from all relevant files. Safe to act on. |
| **Probable** | Strong evidence in one file, but a downstream file still needs checking before acting. |
| **Possible** | Worth investigating — not enough evidence yet to confirm. |
| **Recommendation** | Not a bug. An improvement for clarity, consistency, or maintainability. |

---

## SECTION 1 — CONFIRMED BUGS

These were verified by direct grep/read. The code is exactly as described.

---

### C-01 — `alert()` in public booking flow book-type page

**Confirmed by:** `grep alert\( app/book/[instructorId]/book-type/page.tsx` — line 42  
**File:** `app/book/[instructorId]/book-type/page.tsx`

```typescript
if (!bookingState.bookingType) {
  alert('Please select when you would like to schedule your lessons');
  return;
}
```

Every other step in the booking flow uses inline `FieldError` components. This is the only remaining `alert()` in the public flow.

**Fix:** Add `const [validationError, setValidationError] = useState<string | null>(null)`, set it instead of alerting, render below the buttons.

---

### C-02 — `alert()` in instructor earnings receipt download (2 calls)

**Confirmed by:** `grep alert\( app/dashboard/earnings/page.tsx` — lines 426-427  
**File:** `app/dashboard/earnings/page.tsx`

```typescript
} else { alert('Failed to generate receipt.'); }
} catch { alert('Failed to download receipt.'); }
```

`PlatformEarningsSection.tsx` already has toast notifications for this exact button. The earnings page duplicates the receipt button inline and kept `alert()`.

**Fix:** Replace both with a toast, or refactor to use `PlatformEarningsSection` (which already has toast handling).

---

### C-03 — `alert()` in instructor dashboard — PDA tests page (4 calls)

**Confirmed by:** `grep alert\( app/dashboard/pda-tests/page.tsx`  
**File:** `app/dashboard/pda-tests/page.tsx`

Four `alert()` calls: slot validation, schedule failure (2 paths), and result update failure.

**Fix:** Add toast state matching the pattern in `settings/page.tsx`.

---

### C-04 — `alert()` in instructor booking detail pages (4 calls across 2 files)

**Confirmed by:** `grep alert\( app/dashboard/bookings/[id]/page.tsx` and `app/dashboard/clients/[id]/page.tsx`

- `bookings/[id]/page.tsx` lines 95, 101 — send payment link failures
- `clients/[id]/page.tsx` lines 81, 87 — send payment link failures

Both pages send a payment link and fall back to `alert()` on failure. The same action in the bookings list page uses toast.

**Fix:** Replace with inline error state, matching the toast pattern in other dashboard pages.

---

### C-05 — `alert()` in reschedule page (2 calls)

**Confirmed by:** `grep alert\( app/dashboard/bookings/[id]/reschedule/page.tsx`  
**File:** `app/dashboard/bookings/[id]/reschedule/page.tsx`

Two `alert()` calls on reschedule failure.

**Fix:** Toast state.

---

### C-06 — `alert()` in setup/complete-profile page (4 calls)

**Confirmed by:** `grep alert\( app/setup/complete-profile/page.tsx`  
**File:** `app/setup/complete-profile/page.tsx`

Upload failure, profile save failure. This page is the onboarding flow for new instructors.

**Fix:** Toast state.

---

### C-07 — `alert()` in staff tasks page (2 calls)

**Confirmed by:** `grep alert\( app/staff/tasks/[id]/page.tsx`  
**File:** `app/staff/tasks/[id]/page.tsx`

Two `alert()` calls on task creation failure.

**Fix:** Toast state or inline error message.

---

### C-08 — `window.confirm()` in admin instructor subscription tab

**Confirmed by:** `grep window\.confirm app/admin/instructors/[id]/page.tsx` — line 360  
**File:** `app/admin/instructors/[id]/page.tsx`

```typescript
if (window.confirm(`Delete subscription row ${row.id}? This cannot be undone.`)) {
  doAction('delete_subscription_row', ...);
}
```

**Fix:** Use the existing `cancelConfirm` modal pattern already in the same component — add a `deleteRowConfirm` state and render an inline confirm UI.

---

### C-09 — `window.confirm()` in client payment page

**Confirmed by:** `grep window\.confirm app/booking/[id]/payment/page.tsx` — line 213  
**File:** `app/booking/[id]/payment/page.tsx`

```typescript
if (!window.confirm("Cancel this booking?\n\nYour slot will be released...")) return
```

This is the client-facing PENDING_PAYMENT payment page. This is the worst place for a native dialog — it can be blocked by browser popup blockers on mobile, especially in WebView contexts (iOS Safari in standalone mode).

**Fix:** Replace with an inline confirmation panel that slides into view on "Cancel booking" click. Low friction since the page already has conditional rendering.

---

### C-10 — Credits page stats calculated from first 25 clients only

**Confirmed by:** 
- `grep fetch app/admin/credits/page.tsx` → `fetch('/api/admin/clients')` — no pagination params
- `app/api/admin/clients/route.ts` → default limit is 25, returns `{ clients, pagination }`
- Credits page does `clients.reduce(...)` on the raw response, which is the 25-item array, not all clients

**Impact:** All financial totals on the Credits page (Total Credits, Total Spent, Total Remaining, Averages) are wrong for any platform with more than 25 clients. The numbers shown are for the first 25 clients only.

**Additional note:** The credits page was partially updated in a previous session but the change didn't persist. The old code is still in place.

**Fix:** Add a `GET /api/admin/credits/stats` route that runs DB-level aggregates directly:
```typescript
const walletAgg = await prisma.clientWallet.aggregate({
  _sum: { balance: true },
  _count: true,
});
const debitAgg = await prisma.walletTransaction.aggregate({
  where: { type: 'DEBIT', status: 'CONFIRMED' },
  _sum: { amount: true },
});
```
This is O(1) vs the current O(N) client-side calculation.

---

### C-11 — Admin bookings stats bar counts from current page, not full DB

**Confirmed by:**
- `app/api/admin/bookings/route.ts` lines 76-86: `stats.confirmed = bookings.filter(...).length` where `bookings` is the page slice (max 50 rows)
- `app/admin/bookings/page.tsx` lines 536-541: renders `stats.confirmed`, `stats.pending` etc. directly

`stats.total` uses `prisma.booking.count()` (correct). Every other stat uses `.filter()` on the fetched page (wrong for page > 1).

The "Ended (unpaid)" banner — which drives admin action to release payouts — is also from the page slice. On a busy platform, page 2+ might have more ended-but-confirmed lessons that are never shown in the banner.

**Fix in API:** Replace page-slice stats with parallel DB counts:
```typescript
const [confirmedCount, pendingCount, completedCount, cancelledCount, noShowCount, endedConfirmedCount] = await Promise.all([
  prisma.booking.count({ where: { ...where, status: 'CONFIRMED' } }),
  prisma.booking.count({ where: { ...where, status: 'PENDING' } }),
  prisma.booking.count({ where: { ...where, status: 'COMPLETED' } }),
  prisma.booking.count({ where: { ...where, status: 'CANCELLED' } }),
  prisma.booking.count({ where: { ...where, status: 'NO_SHOW' } }),
  prisma.booking.count({ where: { ...where, status: 'CONFIRMED', endTime: { lte: now } } }),
]);
```

---

### C-12 — `BookingDetailsForm` unmount cleanup uses hardcoded `sessionId: 'bulk-api'`

**Confirmed by:** `grep bulk-api components/BookingDetailsForm.tsx` — line 152

```typescript
const params = new URLSearchParams({
  ...
  sessionId: 'bulk-api', // ← hardcoded, doesn't match the actual session
});
fetch('/api/availability/check-and-reserve?...',  { method: 'DELETE' });
```

The slot reservation was made with `getSessionId()` from context. The DELETE uses `'bulk-api'`. The server matches reservations by `instructorId + date + time + duration + sessionId` — if the sessionId doesn't match, the server-side reservation is not released on unmount. The cron cleanup handles it eventually (10-min TTL), but the slot is unavailable to other users for up to 10 minutes unnecessarily.

**Fix:**
```typescript
const sessionIdRef = React.useRef(getSessionId());
// In cleanup:
sessionId: sessionIdRef.current,
```

---

### C-13 — `/book/[instructorId]/schedule/page.tsx` is an orphaned redirect stub

**Confirmed by:** Full file read — the entire page is:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    router.replace(`/book/${params.instructorId}/booking-details`);
  }, 200);
}, [params, router]);
return <MultiStepBookingLayout currentStep={3}><spinner /></MultiStepBookingLayout>;
```

No content, no purpose. Nothing links to it. If a student bookmarks or shares this URL they get a 200ms spinner then an unexpected redirect.

**Fix:** Delete the file.

---

### C-14 — Admin bookings search is client-side on a paginated dataset

**Confirmed by:**
- `app/admin/bookings/page.tsx` line 477: `fetch('/api/admin/bookings?page=${page}&limit=50')` — no `search` param
- Line 492-500: `const filtered = bookings.filter(b => { if (search) { ... } })` — filters the 50-item page slice

The API already has server-side search support (`where.OR = [...]` when `search` param is present). The frontend just never passes it.

**Fix:** Pass `search` as a URL param to `fetchBookings`, debounced and reset to page 1:
```typescript
const fetchBookings = async (page: number) => {
  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (search) params.set('search', search);
  const res = await fetch(`/api/admin/bookings?${params.toString()}`);
  // ...
};
useEffect(() => {
  const t = setTimeout(() => fetchBookings(1), 300);
  return () => clearTimeout(t);
}, [search]);
```

---

## SECTION 2 — RECOMMENDATIONS

Not bugs. Improvements worth making.

---

### R-01 — Remove redundant `amount` parameter from booking PaymentIntents

**Files:** `payment/page.tsx` → `create-intent/route.ts` → `stripe/webhook/route.ts`

**Full trail verified:**
- `payment/page.tsx` sends `amount: bookingState.pricing.total` (client-computed)
- `create-intent/route.ts` uses `const paymentAmount = amount || booking.price`
- `stripe/webhook/route.ts` validates `paymentIntent.amount_received` (from Stripe) against `booking.price` (from DB) before confirming — throws and rolls back if they don't match

**Conclusion:** Not exploitable. A manipulated PaymentIntent cannot confirm a booking because the webhook validates against the server-side price. The `amount` parameter is harmless but pointless.

**Recommendation:** Remove `amount` from `handleBookingPaymentIntent`. Use `booking.price` directly. Makes the intent clear, eliminates dead code.

---

### R-02 — `admin/instructors/route.ts` fetches user from DB to check role

**Confirmed by:** Full file read — fetches `prisma.user.findUnique({ where: { email } })` on every request purely to check `role`, when `session.user.role` from JWT is already available and trusted.

**Recommendation:** Replace with `session.user.role` check, matching every other admin route.

---

### R-03 — 6 sequential DB queries for monthly revenue chart

**Confirmed by:** `app/api/admin/revenue/route.ts` — `for` loop with `await` inside.

**Recommendation:** Parallelise with `Promise.all`. Saves ~100-300ms on the revenue page load.

---

### R-04 — `admin/settings/page.tsx` masked SMTP field gives false confidence

**Confirmed by:** File read — `<ConfigRow label="SMTP password" masked />` renders `••••••••` whether or not the env var is set.

**Recommendation:** Only render dots if the env var exists. Show `—` when absent, so admins can distinguish "configured but hidden" from "not set".

---

### R-05 — `/book/[instructorId]/confirmation` route name collides with post-payment confirmation

**Confirmed by:** File read — this page's heading is "Review Your Booking", CTA is "Proceed to Payment". The post-payment receipt is at `/booking/[id]/confirmation`.

**Recommendation:** Rename to `/review` or `/order-summary`. Low urgency — no broken behaviour, just confusing naming.

---

## SECTION 3 — PROBABLE (needs one more file checked)

---

### P-01 — `BookingContext` platform fee defaults may show wrong pricing if API fetch fails

**Evidence:** `BookingContext.tsx` — hardcoded defaults `platformFeePercentage: 3.6`, `package6Discount: 5` etc. A `useEffect` fetches `/api/public/pricing` on mount to override these.

**What needs checking:** Does `POST /api/public/bookings/bulk` recalculate prices server-side, or does it accept the client's `pricing.total`?

**If server recalculates:** This is a display-only issue — the user sees a slightly wrong price for a moment, but pays the correct amount.  
**If server trusts client pricing:** This is a bug where a stale default could cause the payment to be for the wrong amount.

**Status:** Read `app/api/public/bookings/bulk/route.ts` to resolve.

---

### P-02 — BSB + last 3 account digits in payout API may be enough to identify a bank account

**Evidence:** `api/admin/payouts/route.ts` — full BSB is returned unmasked alongside `'****' + account.slice(-3)`.

**What needs checking:** What does the payout page UI actually display? Is the BSB + masked account shown in a table visible to all admin staff, or only when an admin actively opens a specific payout record?

**If it's a table visible to all admins:** Worth tightening — show only account name by default, add a "Reveal" action logged to audit trail.  
**If it's behind a deliberate action:** Current masking is acceptable.

**Status:** Read `app/admin/payouts/page.tsx` payout detail rendering to resolve.

---

## SECTION 4 — POSSIBLE (worth investigating, not yet evidenced)

---

### X-01 — `alert()` in other unaudited pages

**Note:** The audit searched `app/**/*.tsx`. Matches were found in 7 files beyond what was previously known. There may be more in `components/`, `lib/`, or pages not yet opened. A complete codebase `alert()` sweep is worth running before closing this finding class.

---

## SECTION 5 — FULL FINDINGS TABLE

| ID | Class | Severity | File | Issue | Status |
|---|---|---|---|---|---|
| **C-01** | Confirmed | 🟠 | `book/[id]/book-type/page.tsx` | `alert()` for missing booking type selection | Open |
| **C-02** | Confirmed | 🟡 | `dashboard/earnings/page.tsx` | `alert()` on receipt download failure (2 calls) | ✅ Fixed |
| **C-03** | Confirmed | 🟡 | `dashboard/pda-tests/page.tsx` | `alert()` on schedule/update failures (4 calls) | Open |
| **C-04** | Confirmed | 🟡 | `dashboard/bookings/[id]/page.tsx`, `clients/[id]/page.tsx` | `alert()` on payment link send failure (4 calls) | Open |
| **C-05** | Confirmed | 🟡 | `dashboard/bookings/[id]/reschedule/page.tsx` | `alert()` on reschedule failure (2 calls) | ✅ Fixed |
| **C-06** | Confirmed | 🟡 | `setup/complete-profile/page.tsx` | `alert()` on upload/save failure (4 calls) | Open |
| **C-07** | Confirmed | 🟢 | `staff/tasks/[id]/page.tsx` | `alert()` on task creation failure (2 calls) | Open |
| **C-08** | Confirmed | 🟠 | `admin/instructors/[id]/page.tsx` | `window.confirm()` for subscription row deletion | ✅ Fixed |
| **C-09** | Confirmed | 🟠 | `booking/[id]/payment/page.tsx` | `window.confirm()` for cancel on client payment page | ✅ Fixed |
| **C-10** | Confirmed | 🔴 | `admin/credits/page.tsx` | Stats from first 25 clients only | ✅ Fixed |
| **C-11** | Confirmed | 🔴 | `api/admin/bookings/route.ts` | Status stats from page slice, not full DB | ✅ Fixed |
| **C-12** | Confirmed | 🟡 | `components/BookingDetailsForm.tsx` | Unmount cleanup hardcoded `sessionId: 'bulk-api'` | ✅ Fixed |
| **C-13** | Confirmed | 🟡 | `book/[id]/schedule/page.tsx` | Orphaned redirect stub | ✅ Deleted |
| **C-14** | Confirmed | 🟠 | `admin/bookings/page.tsx` | Search client-side on 50-row page | ✅ Fixed |
| **R-01** | Recommendation | — | `payment/page.tsx` + `create-intent/route.ts` | Remove redundant `amount` param | Deferred — safe as-is |
| **R-02** | Recommendation | — | `api/admin/instructors/route.ts` | Fetch role from JWT not DB | Open |
| **R-03** | Recommendation | — | `api/admin/revenue/route.ts` | Parallelise 6 sequential monthly chart queries | ✅ Fixed |
| **R-04** | Recommendation | — | `admin/settings/page.tsx` | Masked SMTP field shows dots when env var absent | Open |
| **R-05** | Recommendation | — | `book/[id]/confirmation/page.tsx` | Route name collides with post-payment receipt | Open |
| **P-01** | Probable | — | `BookingContext.tsx` | Stale defaults on pricing fetch failure | Resolved — bulk API recalculates server-side |
| **P-02** | Probable | — | `api/admin/payouts/route.ts` | BSB + last 3 digits — depends on display | Open — needs payouts UI read |
| **X-01** | Possible | — | Various | More `alert()` calls in unaudited files | C-03/04/06/07 confirmed; main sweep complete |

---

## SECTION 6 — REMAINING OPEN ITEMS

### Instructor bookings page (NF-01 / NF-02) — high priority
1. **NF-01** — Replace 6 `window.confirm()` in `dashboard/bookings/page.tsx` with inline confirm states
2. **NF-02** — Change `en-US` → `en-AU` locale in same file

### Admin payouts — BSB masking
3. **NF-03** — Mask BSB in list table; keep full BSB only inside `MarkSentModal`

### Student bookings tab counts
4. **NF-04** — Use `upcomingCount`/`pastCount` from API for tab badge labels

### Wallet API performance
5. **NF-05** — Replace unbounded transaction query with aggregate for balance calc
6. **NF-06** — Remove dead `totalBookedHours` query

### Legacy alerts still to fix
7. **C-01** — `alert()` in book-type page with inline validation error
8. **NF-07 / C-07** — `alert()` in staff tasks page (2 calls, internal only)

### Recommendations (do when touching relevant file)
9. **R-02** — Use JWT role in `admin/instructors/route.ts`
10. **R-04** — Fix masked SMTP field to show `—` when env var is absent

---

## SECTION 7 — WHAT'S CONFIRMED SOLID

These were verified end-to-end and are production-grade:

- **Stripe webhook pipeline** — signature verification (fails closed), idempotency via `WebhookEvent` table, rate limiting, `amount_received` vs `booking.price` validation, expired-booking auto-refund with ops alert
- **Slot reservation** — reserve on select, server-side DELETE on remove, validate-before-charge at payment time
- **3DS/SCA** — `handleNextAction()` called on `requires_action`, not just an error
- **Booking creation race condition** — `prisma.$transaction` with `pg_advisory_xact_lock` per booking ID
- **PaymentIntent deduplication** — same advisory lock pattern, reuses existing intent when in reusable state
- **Admin role gating** — layout redirects by role (instructor → dashboard, client → client-dashboard)
- **Password exclusion from localStorage** — explicitly stripped in `saveToLocalStorage()`
- **No-show dispute routing** — party picker feeds correctly into Payouts Withheld/Disputes tabs
