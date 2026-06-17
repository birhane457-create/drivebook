# Earnings Separation Update — Implementation Complete

**Date:** June 2026  
**Status:** Ready for Integration  
**Related:** [EARNINGS.md](./EARNINGS.md), [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md)

---

## What Changed

The earnings dashboard now displays **separated views** of platform and offline income to clearly show what DriveBook owes vs. what the instructor earned directly.

### Before
Mixed earnings made it unclear what was platform-processed vs self-reported:
```
This Week: $1,050
(Contained $750 platform + $300 offline — confusing payout calculation)
```

### After
Clear separation shows exactly what you're getting paid:
```
💳 Platform Earnings: $675 (verified by DriveBook)
💰 Offline Lessons: $300 (self-reported, not affecting payout)
📊 Total Income: $975
Payout: $675 (platform only)
```

---

## Key Changes to EARNINGS.md

### 1. New "What It Shows" Section
Describes both platform and offline views with visual icons and clear labeling.

### 2. "Why Separated?" Section
Explains the business logic difference with a comparison table:
- Payment handling (platform vs instructor)
- Commission (yes vs no)
- DriveBook verification (yes vs no)
- Payout impact (yes vs no)

### 3. API Response Structure
Documents the new separated response from `GET /api/instructor/earnings`:
- `platform.*` — Verified platform earnings only
- `offline.*` — Self-reported offline amounts
- Both include pending and scheduled amounts

### 4. "Platform vs Offline Payout" Section
Critical clarification that only platform bookings affect payouts with an example scenario.

### 5. Updated "Payout Eligibility"
Notes that only platform bookings are processed for payout.

### 6. Related Section
Added link to [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) for context.

---

## API Endpoint Changes

### GET /api/instructor/earnings

**New Response Structure:**
```typescript
{
  platform: {
    totalEarnings: number,         // Net after commission
    totalGross: number,            // Before commission
    totalFees: number,             // Commission deducted
    thisMonthEarnings: number,
    thisMonthGross: number,
    thisMonthFees: number,
    pendingPayouts: number,        // For payout calculation
    scheduledTotal: number,        // Upcoming platform lessons
    // ... counts and other fields
  },
  offline: {
    totalLogged: number,           // Sum of offlineAmountPaid
    thisMonthLogged: number,
    scheduledTotal: number,        // Upcoming offline lessons
    // ... counts
  },
  totalEarnings: number,           // Combined (backward compat)
  thisMonthEarnings: number,       // Combined (backward compat)
  transactions: [],                // Platform transactions only
  scheduledOffline: []             // Offline lessons scheduled
}
```

---

## Frontend Components

### PlatformEarningsSection
- Location: `components/instructor/PlatformEarningsSection.tsx`
- Shows: Weekly breakdown, daily details, commission info, receipts
- Theme: Green (verified earnings)
- Stats: This Week, Last Week, This Month, Scheduled

### OfflineEarningsSection
- Location: `components/instructor/OfflineEarningsSection.tsx`
- Shows: Completed and scheduled offline lessons, payment methods
- Theme: Amber (self-reported, unverified)
- Warning banner explaining self-reported nature
- Explicit note: "Does not affect payout"

---

## Payout Card Update

The payout card now shows **platform amount only** with explicit messaging:

```
Next Payout
Friday

Amount: $675 (platform earnings only)
10 completed platform lessons

💡 Only platform earnings included. 
   Offline lessons do not affect your payout.
```

---

## Dashboard Overview Card

The dashboard overview now shows split income:

```
This Month Income
💳 Platform: $2,500    ← Verified, affects payout
💰 Offline: $300       ← Self-reported
📊 Total: $2,800
```

---

## Implementation Status

| Item | Status |
|------|--------|
| Backend API (earnings separation) | ✅ Complete |
| PlatformEarningsSection component | ✅ Complete |
| OfflineEarningsSection component | ✅ Complete |
| EARNINGS.md documentation | ✅ Updated |
| OFFLINE_BOOKINGS.md documentation | ✅ Existing (no changes needed) |
| Earnings page integration | ⏳ In progress |
| Testing | ⏳ Planned |

---

## Backward Compatibility

✅ **Fully maintained** — Old code using `totalEarnings` and `thisMonthEarnings` continues working. New code uses separated `platform` and `offline` objects.

---

## Protection Against Disputes

This architecture prevents the most common dispute:

**Problem (Old):**
```
Instructor sees: "This month I earned $2,800"
Thinks: "DriveBook owes me $2,800"
Reality: "DriveBook only owes $2,500 (platform)
         + $300 was cash you handled yourself"
Result: Dispute, confusion, frustration
```

**Solution (New):**
```
Instructor sees:
- Platform: $2,500 (what DriveBook owes)
- Offline: $300 (what you earned directly)
- Payout: $2,500 (only platform)

Clear about expectations. No disputes.
```

---

## Related Documentation

- [EARNINGS.md](./EARNINGS.md) — Main earnings documentation (updated)
- [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) — Offline booking system
- [BOOKINGS.md](./BOOKINGS.md) — Platform booking system
- `docs/06-payments/PAYOUTS.md` — Payout processing (admin perspective)
- `docs/06-payments/COMMISSIONS.md` — Commission rates by tier

---

## Next Steps

1. **Integration Phase** — Update `/dashboard/earnings/page.tsx` to use new components
2. **Testing Phase** — Verify with mixed platform/offline bookings
3. **Deployment Phase** — Deploy and monitor
4. **Monitoring** — Watch for any confusion or support questions

---

## Questions?

- **Why separate offline from platform?** See [OFFLINE_BOOKINGS.md](./OFFLINE_BOOKINGS.md) "Platform Client Guard" section
- **How does payout work?** See [EARNINGS.md](./EARNINGS.md) "Platform vs Offline Payout"
- **What about commissions on offline?** None — instructor keeps 100% for offline

