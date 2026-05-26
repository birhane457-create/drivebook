# Open Items & Known Gaps

**Purpose:** What still needs to be done. This is a forward-looking list only.  
**Last updated:** May 2026 (post deep pre-launch inspection)  
**For system documentation, read the feature docs in `DOCROLEBASE/`.**

---

## Open — Deployment / Configuration (must complete before go-live)

### OPEN-02: Prisma Migration for TestCentre

**Status:** Migration run locally. Must be confirmed on production DB.  
**Action:** Verify `TestCentre` table exists in production. If not: `npx prisma migrate deploy` then `node seed-test-centres.js`

**⚠️ Migration safety rule:** Always use `npx prisma migrate deploy` for production schema changes. Never use `prisma db push --accept-data-loss` on a database with real data. See `docs/DOCROLEBASE/08-technical/POSTGRES_MIGRATION.md`.

---

### OPEN-04: Rate Limiting — Redis Not Configured

**Status:** In-memory fallback only. Unsafe in serverless (resets on cold start). Rate limits are effectively disabled.  
**Action:** Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel env vars.  
**Risk:** Without Redis, brute-force and booking spam attacks are not blocked in production.

---

### OPEN-05: ABN Placeholder

**Status:** `app/about/page.tsx` has placeholder ABN text.  
**Action:** Replace with real ABN once registered. One-line change.

---

### OPEN-11: Live Mode Stripe Keys + Billing Portal Config

**Status:** All Stripe keys are test mode. Real payments cannot be processed.  
**Action before go-live:**
1. Create live Stripe products/prices for all tiers (8 prices: BASIC/PRO/STUDIO/BUSINESS × monthly/annual)
2. Update Vercel env vars:
   - `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_BASIC_MONTHLY_PRICE_ID`, `STRIPE_BASIC_ANNUAL_PRICE_ID`
   - `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`
   - `STRIPE_STUDIO_MONTHLY_PRICE_ID`, `STRIPE_STUDIO_ANNUAL_PRICE_ID`
   - `STRIPE_BUSINESS_MONTHLY_PRICE_ID`, `STRIPE_BUSINESS_ANNUAL_PRICE_ID`
3. Configure Stripe Billing Portal: add all 4 products, enable plan switching, set `proration_behavior = create_prorations`

---

### OPEN-16: Google Calendar Redirect URI

**Status:** Must be verified in Vercel and Google Cloud Console.  
**Action:** Confirm `GOOGLE_REDIRECT_URI=https://drivebook.com.au/api/calendar/callback` (not localhost, not typo).

---

## Open — Feature Gaps (acceptable for launch)

### OPEN-10: Analytics — No Chart Library

**Status:** Analytics page shows stat cards only. No visual trend charts.  
**Decision:** Acceptable for launch. Install `recharts` post-launch.  
**File:** `app/dashboard/analytics/page.tsx`

---

### OPEN-12: Admin Reviews — No Moderation Tools

**Status:** Admin can view reviews but cannot flag/hide/respond.  
**Decision:** Acceptable for launch. Post-launch: add `isFlagged`/`isHidden` to Booking.  
**File:** `app/admin/reviews/page.tsx`

---

### OPEN-13: Stripe Connect Status in Admin List

**Status:** Admin instructor detail page shows Connect status (fixed). Admin instructor *list* does not show it inline.  
**Decision:** Acceptable for launch.

---

### OPEN-14: Admin Bookings — No Pagination

**Status:** Fetches up to 200 bookings. No cursor-based pagination.  
**Decision:** Acceptable for launch. Add post-launch when volume warrants.

---

### OPEN-15: Client Suspend/Deactivate

**Status:** Admin cannot suspend a client account. No `isActive` flag on `Client`.  
**Decision:** Deferred. Requires schema change + middleware enforcement.

---

### OPEN-17: No Password Reset Flow for Clients

**Status:** `resetToken`/`resetTokenExpiry` fields exist on User but no UI or email flow for clients to reset their password.  
**Decision:** Acceptable for launch (clients can contact support). Add self-service reset post-launch.

---

### OPEN-18: No Email Verification Enforcement

**Status:** `emailVerified` field added to schema. Email verification endpoint exists. But login does not block unverified users.  
**Decision:** Acceptable for launch. Enforce post-launch once email delivery is confirmed reliable.

---

## Deferred — Future Tier

### OPEN-01: BUSINESS Tier — Multi-Instructor Management

**Status:** "Coming Soon" in UI. Cannot be purchased.  
**Scope:** Team calendars, school-wide reporting, multi-instructor accounts. Requires separate spec.

---

## Resolved — Previously Open (closed May 2026)

| Item | Resolution |
|------|-----------|
| Admin wallet add-credit broken in production | Fixed — `authOptions` added to `getServerSession` |
| Payment intent endpoint had no auth | Fixed — session check + ownership verification added |
| Email verification cookie wrong name in production | Fixed — cookie name derived from `NODE_ENV` |
| Email verification fields missing from schema | Fixed — 4 fields added, pushed to DB |
| Admin instructor detail missing catch block | Fixed — proper try/catch added |
| Cleanup cron ran daily instead of every 5 min | Fixed — `vercel.json` updated to `*/5 * * * *` |
| `apply-rate-changes` cron missing from vercel.json | Fixed — added |
| Public search `?admin=true` bypass unauthenticated | Fixed — requires admin session |
| Mobile login crashes on null password | Fixed — null guard added |
| Rate-change notification links pointed to deleted page | Fixed — updated to `/dashboard/subscription` |
| Admin instructors page queried non-existent `reviews` count | Fixed |
| ~40 TypeScript errors hidden by `ignoreBuildErrors` | Fixed — 0 errors, flags removed from `next.config.js` |
| `newStudentBonus` confusing terminology | Removed from subscription system |
| Subscription upgrade/downgrade dialogs used `confirm()` | Replaced with proper modal dialogs |
| Billing Portal return didn't sync tier changes | Fixed — `POST /api/instructor/subscription/sync` added |
| Instructor expense tracking | Added — `/dashboard/expenses` + DB model |
| Scheduled rate changes | Added — `PlatformRateChange` model + admin UI + cron |

---

## Design Decisions (Intentional, Not Bugs)

| Item | Decision | Rationale |
|------|----------|-----------|
| TFN collection | Not active. | ATO does not require TFN if ABN is provided. |
| Manual recovery for negative balances | Admin creates MANUAL_ADJUSTMENT. No auto-healing. | Every adjustment requires human review and audit trail. |
| Automated Stripe Connect transfers | Implemented for `payoutMethod = stripe_connect`. Manual bank transfer for others. | Instructors without Connect onboarding fall back to manual. |
| Subscription expiry = read-only | Expired instructors get read-only dashboard, not hard block. | Australian Privacy Act — instructors retain right to access their own data. |
| Instructor inactive = booking page offline | Public booking page shows "not accepting bookings". | Prevents new students booking with inactive instructors. |
| `prisma db push` used in dev | Acceptable in dev with no real data. Production must use `prisma migrate deploy`. | See `POSTGRES_MIGRATION.md`. |
| Dead-code services (`governance`, `staff`, `pda`, `ledger.ts`) | `@ts-nocheck` added. Not called in production paths. | Future features. Schema models not yet created. |

---

## Summary

| Category | Count |
|----------|-------|
| Open — deployment/config (must fix before go-live) | 4 (OPEN-02, OPEN-04, OPEN-05, OPEN-11) + OPEN-16 |
| Open — feature gap (acceptable for launch) | 6 (OPEN-10, OPEN-12, OPEN-13, OPEN-14, OPEN-15, OPEN-17, OPEN-18) |
| Deferred — future tier | 1 (OPEN-01) |
