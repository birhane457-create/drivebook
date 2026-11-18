# Client Portal Audit — Phase 6

**Version:** 1.0  
**Status:** FIX-IMPLEMENTED — all 7 findings fixed in ec380043 (2026-11-18); runtime verification pending  
**Auditor:** Independent source inspection  
**Baseline commit:** 4dbf4e54 (after runtime error fixes)  
**Audit rules:** docs/audit/AUDIT-PROCESS.md  
**Authoritative tracker:** docs/audit/AUDIT-MASTER-TRACKER.md (Section 14)

---

## Scope

| Area | Files |
|------|-------|
| Main dashboard | `app/client-dashboard/page.tsx` |
| Access control | `app/client-dashboard/layout.tsx` |
| Booking history | `app/client-dashboard/bookings/` |
| Booking details | `app/client-dashboard/bookings/[id]/` |
| Wallet | `app/client-dashboard/wallet/` |
| Packages | `app/client-dashboard/packages/` |
| Profile/settings | `app/client-dashboard/profile/` |
| Notifications | `app/client-dashboard/notifications/` |
| Progress/feedback | `app/client-dashboard/progress/` |
| Booking workflow | `app/client-dashboard/book-lesson/` |
| Server APIs | All `/api/client/*` routes |

---

## Finding Register

### CP-01 (HIGH): Cross-account booking disclosure via null customerId fallback

**File:** `app/api/client/profile/route.ts`

**Source evidence:**
```typescript
const clientIds = user.customers.map((c) => c.id);

where: clientIds.length > 0
  ? { customerId: { in: clientIds } }
  : { customerId: null }   // ← discloses unrelated bookings
```

**Chain of conditions:**
1. `prisma/schema.prisma` — `Booking.customerId` is nullable (`String?`)
2. `app/api/bookings/offline/route.ts` — creates offline bookings without setting `customerId`
3. `app/api/client/profile/route.ts` — when user has no linked Customer records, falls back to `customerId: null`
4. The profile endpoint checks authentication but does not positively require the CLIENT role
5. The response includes booking dates, provider info, pickup addresses and notes

**Impact:** An authenticated account without a linked Customer record can retrieve bookings belonging to other people, including offline bookings. The API is directly accessible; the portal layout guard does not protect it.

**Fix direction:** When `clientIds` is empty, return an empty booking list rather than querying for `customerId: null`.

**Status:** FIX-IMPLEMENTED (`ec380043`) — runtime verification pending

---

### CP-02 (HIGH): Decimal wallet balance arithmetic — implicit string concatenation

**File:** `app/api/client/bookings/create-bulk/route.ts`

**Source evidence:**
```typescript
.reduce((s: any, t: any) => s + t.amount, 0)
```

`WalletTransaction.amount` is `Decimal` in the Prisma schema. JavaScript `+` operator on a Decimal object uses implicit string conversion — with multiple credits, the accumulated sum can be a concatenated string rather than a number, substantially overstating the balance.

**Example:** Two credits of `$70.00` → `0 + "70.00" + "70.00"` → `"070.0070.00"` instead of `140`.

**Fix direction:** Use `Number(t.amount)` or Decimal arithmetic (`new Decimal(s).add(t.amount)`) consistently.

**Status:** FIX-IMPLEMENTED (`ec380043`) — runtime verification pending

---

### CP-03 (HIGH): Concurrent wallet double-spending — balance checked outside transaction

**File:** `app/api/client/bookings/create-bulk/route.ts`

**Source evidence (sequence):**
1. Reads wallet transactions outside the database transaction
2. Calculates available balance
3. Starts a transaction
4. Creates confirmed bookings and wallet debits
5. Does not re-read or validate the balance inside that transaction

Two simultaneous booking requests can both pass the same initial balance check and both create confirmed, paid bookings totalling more than the available credit.

**Note:** Existing WLA-008 coverage checks server-side price recalculation, not concurrent wallet spending. Distinct defect requiring its own regression test.

**Fix direction:** Read and lock the wallet balance inside the transaction, or use a conditional `updateMany` that fails if balance is insufficient (compare with the SUB-22 `updateMany` count-check pattern).

**Status:** FIX-IMPLEMENTED (`ec380043`) — runtime verification pending

---

### CP-04 (HIGH): Missing instructor eligibility gate in wallet booking route

**File:** `app/api/client/bookings/create-bulk/route.ts`

**Source evidence:**  
Route retrieves instructor using only id, userId, and hourlyRate. It does not call `checkProviderEligible()`.

**Comparison:** `app/api/bookings/combined/route.ts` checks:
- `approvalStatus === 'APPROVED'`
- `isActive`
- Subscription status (ACTIVE or non-expired TRIAL)
- `acceptingBookings` pause flag
- Document expiry (DrivingLessonOutcome)

The wallet booking route creates immediately confirmed, paid bookings without any of these checks.

**Impact:** A client may book and pay for an instructor who has become inactive, suspended, or document-expired after appearing in search.

**Fix direction:** Call `checkProviderEligible()` before creating the booking, identical to the pattern in the combined booking route.

**Status:** FIX-IMPLEMENTED (`ec380043`) — runtime verification pending

---

### CP-05 (HIGH): Instructor timezone conversion uses server timezone

**File:** `app/api/client/bookings/create-bulk/route.ts`

**Source evidence:**
```typescript
return new Date(year, month - 1, day, hour, minute);
```

`new Date(year, month-1, day, hour, minute)` uses the **server's local timezone**, not the instructor's timezone. The availability API returns slots in the instructor's local time. For a Perth instructor, `9:00 AM` availability returned and then submitted is interpreted as `9:00 AM UTC` on a UTC server — 7 hours before the intended time (or 8 hours during daylight saving).

**Risk:** Incorrect booking times, misleading confirmations, incorrect conflict detection.

**Fix direction:** Use the instructor's timezone (available on the Provider record) with a timezone-aware conversion, following the pattern in `localDateTimeToUTC()` already used in the Book Now route.

**Status:** FIX-IMPLEMENTED (`ec380043`) — runtime verification pending; runtime reproduction needed to quantify production impact

---

### CP-06 (MEDIUM): Review persistence and display mismatch

**Files:** `app/api/reviews/route.ts`, `prisma/schema.prisma`

**Source evidence — write side:**
```typescript
reviewComment: comment ?? null   // field does not exist in Booking schema
```
`Booking` has `customerReview String?` and `customerRating Int?`. `reviewComment` is not a Prisma field. The `as any` cast suppresses the TypeScript error; Prisma throws at runtime when it encounters the unknown field.

**Source evidence — read side:**  
The API returns `customerRating` as the review comment instead of `customerReview`.

**Impact:** Review submissions may fail silently or store to the wrong field. The displayed review text is the numeric rating value, not the comment text.

**Fix direction:** Replace `reviewComment` with `customerReview` on the write path. Return `customerReview` (not `customerRating`) on the read path.

**Status:** FIX-IMPLEMENTED (`ec380043`) — runtime verification pending; test submission needed to confirm runtime failure

---

### CP-07 (LOW): Paginated profile endpoint returns incorrect booking counts

**File:** `app/api/client/profile/route.ts`

**Source evidence:**  
The endpoint paginates bookings first (e.g. 10 per page), then calculates `upcomingCount` and `pastCount` from the paginated subset rather than the full dataset.

**Impact:** The booking tab counts shown in the client dashboard are counts of the current page, not the customer's total bookings.

**Fix direction:** Use separate `prisma.booking.count()` calls for upcoming and past totals, independent of the pagination query.

**Status:** FIX-IMPLEMENTED (`ec380043`) — runtime verification pending

---

## Controls Confirmed Working

The following protections were verified in source and should be preserved:

- Client dashboard layout requires CLIENT role
- Booking detail API scopes bookings to authenticated user's customer IDs
- Rescheduling verifies booking ownership
- Cancellation checks client ownership
- Wallet top-up intent creation has CLIENT role check and rate limiting
- Wallet-add verifies PaymentIntent ownership metadata
- Notification updates and deletion check notification ownership
- Package retrieval scopes to authenticated user's customer records
- Wallet booking prices are recalculated from instructor's database rate (not client-submitted)

---

## Verification Requirements

Before any finding can be marked VERIFIED (not just source-confirmed):

| Finding | Required test |
|---------|--------------|
| CP-01 | Two-account test: account A has no customer record, account B has offline bookings; confirm A cannot read B's bookings |
| CP-02 | Multiple-credit wallet with Decimal amounts; confirm balance calculation is numeric not string |
| CP-03 | Concurrent booking requests against same wallet; confirm only one succeeds or both are within balance |
| CP-04 | Booking attempt against suspended/inactive instructor; confirm rejection |
| CP-05 | Perth timezone test: submit 9:00 AM Perth slot; confirm booking stored as correct UTC offset |
| CP-06 | Submit a review; confirm `customerReview` field is written and read back correctly |
| CP-07 | Account with >10 bookings; confirm tab counts reflect total not page |

---

## Remediation Order

**Priority 1 — Security and financial integrity (address first):**
1. CP-01: Client booking data disclosure
2. CP-02: Decimal wallet balance arithmetic
3. CP-03: Concurrent wallet double-spending
4. CP-04: Instructor eligibility gate

**Priority 2 — Booking correctness:**
5. CP-05: Timezone conversion
6. CP-06: Review persistence and retrieval

**Priority 3 — Dashboard quality:**
7. CP-07: Pagination counts

---

**Last updated:** 2026-11-18 (findings registered; no code changes made)
