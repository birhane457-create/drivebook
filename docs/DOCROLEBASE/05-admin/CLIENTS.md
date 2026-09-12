# Admin Clients

**Routes:** `/admin/clients`, `/admin/clients/[id]`
**Auth required:** ADMIN or SUPER_ADMIN
**Files:** `app/admin/clients/page.tsx`, `app/admin/clients/[id]/page.tsx`
**APIs:**
- `GET /api/admin/clients` — list all clients
- `GET /api/admin/clients/[id]/wallet` — client detail + wallet + bookings
- `PATCH /api/admin/clients/[id]` — update client profile
- `POST /api/admin/clients/[id]/wallet/add-credit` — add wallet credit
- `POST /api/admin/clients/[id]/wallet/deduct-credit` — deduct wallet credit

---

## Client List (`/admin/clients`)

### Stats bar

| Stat | Description |
|------|-------------|
| Total Clients | All registered clients |
| Active Wallets | Clients with `creditsRemaining > 0` |
| Total Credits Paid | Sum of all wallet top-ups across all clients |
| Total Spent | Sum of all booking charges across all clients |
| Zero Balance | Clients with exactly $0 remaining |

### Filters

- Search by name or email (client-side filter)
- Status filter: All / Active (has credits) / Zero Balance / Negative Balance

### Table columns

| Column | Notes |
|--------|-------|
| Client Name | |
| Email | |
| Total Paid | All credits ever loaded into wallet |
| Spent | All booking charges (net of cancellation refunds) |
| Remaining | Current wallet balance — green if > 0, amber if 0, red if negative |
| Bookings | Total booking count |
| Status | Active / Zero / Negative badge |
| Actions | "Details" link → `/admin/clients/[id]` |

### Status definitions

| Status | Condition |
|--------|-----------|
| Active | `creditsRemaining > 0` |
| Zero Balance | `creditsRemaining = 0` |
| Negative | `creditsRemaining < 0` (should not occur in normal operation) |

---

## Client Detail (`/admin/clients/[id]`)

Full management page for a single client. Loaded from `GET /api/admin/clients/[id]/wallet`.

### Profile section

Shows: name, email, phone, notes, account creation date, current instructor (if assigned).

Admin can edit all profile fields inline via "Edit Details" mode:
- Name, email, phone, notes
- Saved via `PATCH /api/admin/clients/[id]`

### Wallet summary

| Field | Description |
|-------|-------------|
| Total Paid | All credits loaded |
| Total Spent | All booking charges |
| Remaining | Current balance |
| Usage bar | Visual `totalSpent / totalPaid` percentage |

### Wallet actions

**Add credit:**
- Admin enters amount + optional reason
- Calls `POST /api/admin/clients/[id]/wallet/add-credit`
- Creates a `CREDIT` wallet transaction — the `WalletTransaction.id` becomes the receipt reference
- Sends type F receipt email to the student with the transaction ID
- Writes `WALLET_CREDITED` to `AuditLog` with `transactionId`, `amount`, `reason`, `balanceBefore`, `balanceAfter`

**Deduct credit:**
- Admin enters amount + reason (required, min 3 chars)
- Calls `POST /api/admin/clients/[id]/wallet/deduct-credit`
- Creates a `DEBIT` wallet transaction — the `WalletTransaction.id` becomes the receipt reference
- Sends type G receipt email to the student showing the transaction ID prominently (for dispute reference)
- Writes `WALLET_DEDUCTED` to `AuditLog` with `transactionId`, `amount`, `reason`, `balanceBefore`, `balanceAfter`
- Returns 400 if balance is insufficient

Both operations require a positive amount. Reason is optional for credits, required for deductions.

### Transaction history drawer

Slide-in drawer showing all wallet transactions for the client.

Filterable by: All / Credits / Debits.

Each entry shows: description, timestamp, type badge (CREDIT/REFUND = green, DEBIT = red), amount with +/- prefix.

### Bookings drawer

Slide-in drawer showing all bookings for the client.

Filterable by: All / Confirmed / Completed / Cancelled / Pending.

**Per-booking actions (⋯ menu):**

| Action | When available | Effect |
|--------|---------------|--------|
| Reschedule | CONFIRMED or PENDING | Inline date/time picker. Calls `PATCH /api/bookings/[id]` with new `startTime`/`endTime`. Duration preserved. |
| Mark Complete | CONFIRMED or PENDING | Calls `PATCH /api/bookings/[id]` with `status: COMPLETED` |
| Cancel + Refund | CONFIRMED or PENDING | Calls `POST /api/bookings/[id]/cancel`. Refund per cancellation policy. |
| Remove record | Any status | Soft-delete via `DELETE /api/bookings/[id]`. Audit log entry created. |

### Create booking (from client detail)

Admin can create a new booking for the client directly from the bookings drawer.

Steps:
1. Select instructor — search by name or suburb/postcode. Current instructor shown as shortcut.
2. Select date + duration (1–3 hours in 30-min increments)
3. Select time slot — fetched from `GET /api/availability/slots`
4. Credit check — shows lesson cost vs wallet balance. Blocks creation if insufficient.
5. Optional notes
6. Submit → `POST /api/admin/bookings`

The booking is created as CONFIRMED + isPaid = true. Wallet is debited atomically.

---

## API Details

### `GET /api/admin/clients`

Returns all clients with computed wallet stats:
- `totalPaid` — sum of non-refund CREDIT transactions + confirmed/completed booking prices
- `totalSpent` — sum of DEBIT transactions minus cancellation refunds
- `creditsRemaining` — `ClientWallet.balance` (source of truth)
- `bookingCount` — total bookings
- `status` — `active | zero-balance | negative`

### `GET /api/admin/clients/[id]/wallet`

Returns full client detail:
```json
{
  "user": { "id", "name", "email", "phone", "notes", "createdAt" },
  "wallet": { "id", "totalPaid", "totalSpent", "creditsRemaining", "transactions": [...] },
  "bookings": [...],
  "clientId": "string",
  "currentInstructor": { "id", "name", "hourlyRate", "serviceAreas", "baseAddress" } | null
}
```

---

## Related

- [BOOKINGS.md](./BOOKINGS.md) — Booking status management
- `docs/02-student/WALLET.md` — Wallet mechanics from the client perspective
- `docs/06-payments/REFUNDS.md` — Refund policy on cancellation
