# Open Items & Known Gaps

**Purpose:** What still needs to be done. This is a forward-looking list only.  
**Last updated:** May 2026  
**For system documentation, read the feature docs in `DOCROLEBASE/`.**

---

## Open — Deployment / Configuration

These are not code gaps. They require environment or infrastructure action.

### OPEN-02: Prisma Migration for TestCentre

**Status:** Migration run locally. Must be confirmed on production DB.  
**Action:** Verify `TestCentre` table exists in production. If not: `npx prisma migrate deploy` then `node seed-test-centres.js`

---

### OPEN-04: Rate Limiting — Redis Not Configured

**Status:** In-memory fallback only. Unsafe in serverless (resets on cold start).  
**Action:** Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel env vars.

---

### OPEN-05: ABN Placeholder in Footer

**Status:** `app/about/page.tsx` has placeholder ABN text.  
**Action:** Replace with real ABN once registered. One-line change.

---

### OPEN-11: Live Mode Stripe Keys

**Status:** All Stripe keys are test mode. Real payments cannot be processed.  
**Action before go-live:**
1. Create live Stripe products/prices for all tiers
2. Update all `STRIPE_*` env vars in Vercel with live keys
3. Update `STRIPE_WEBHOOK_SECRET` with the live webhook signing secret

---

## Open — Feature Gaps

### OPEN-10: Analytics — No Chart Library

**Status:** Analytics page shows stat cards and text only. No visual trend charts.  
**Decision:** Acceptable for launch. Install `recharts` post-launch if needed.  
**File:** `app/dashboard/analytics/page.tsx`

---

## Deferred — Future Tier

### OPEN-01: BUSINESS Tier — Multi-Instructor Management

**Status:** Tier is "Coming Soon" in UI. Cannot be purchased.  
**Scope:** Team calendars, school-wide reporting, multi-instructor accounts. Requires separate spec before starting.

---

## Design Decisions (Intentional, Not Bugs)

| Item | Decision | Rationale |
|------|----------|-----------|
| TFN collection | Not active. Field commented out in schema. | ATO does not require TFN if ABN is provided. Enable only if legally required. |
| Manual recovery for negative balances | Admin creates MANUAL_ADJUSTMENT transaction. No automated self-healing. | Every adjustment requires human review and audit trail. |
| Automated Stripe Connect transfers | Implemented for `payoutMethod = stripe_connect`. Manual bank transfer for others. | Instructors who haven't completed Connect onboarding fall back to manual. |
| Progress chart (CSS bars) | Functional. Recharts not installed. | Acceptable for launch. Real chart library is a post-launch enhancement. |
| Subscription expiry = read-only | Expired/cancelled instructors get read-only dashboard access, not a hard block. | Australian Privacy Act — instructors retain right to access their own data. |
| Instructor inactive = booking page offline | Public booking page shows "not accepting bookings" when subscription inactive. | Prevents new students booking with an instructor who can't service them. |

---

## Summary

| Category | Count |
|----------|-------|
| Open — deployment/config | 4 (OPEN-02, OPEN-04, OPEN-05, OPEN-11) |
| Open — feature gap | 1 (OPEN-10) |
| Deferred — future tier | 1 (OPEN-01) |
