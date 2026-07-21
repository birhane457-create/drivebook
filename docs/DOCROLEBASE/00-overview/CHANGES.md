# DriveBook — Change Log

---

## Session: 2026-07-19 — Identity Architecture + BUSINESS Tier Foundation

### Summary
Introduced the organisation-led identity model for the BUSINESS tier, created a central display identity utility, and traced `getDisplayName` through every student-facing surface. Also fixed homepage SEO gaps and added Platform to the nav.

---

### 1. Homepage SEO — 3 gaps closed

**`app/page.tsx`**
- Added `Platform` to desktop nav (between Blog and For Instructors)
- Added one instructor-facing line below hero headline: "Running a driving school? AI Receptionist, Bookings & Business Platform →"
- Added `Organization` + `WebSite` JSON-LD structured data blocks (entity anchor for Google, SearchAction for sitelinks)

---

### 2. Identity Architecture — `businessName` field

**Philosophy**
```
BASIC / PRO / STUDIO = person-led  → businessName (optional display name / trading name)
BUSINESS             = organisation-led → businessName (required school name)
```

Legal identity (`instructor.name`) is never replaced in payouts, ABN, audit logs, or admin panel.
Display identity (`getDisplayName(instructor)`) is used on every student-facing surface.

**`prisma/schema.prisma`**
- Added `businessName String?` to `Instructor` model with comments explaining the two-identity separation

**`prisma/migrations/20260717000001_add_business_name/migration.sql`**
```sql
ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "businessName" TEXT;
```

---

### 3. Central Identity Utility

**`lib/utils/account.ts`** ← source of truth (pre-existing, confirmed and extended)
- `getDisplayName(account)` — `businessName?.trim() || name`
- `getAccountFeatures(account)` — feature flags by tier
- `getPaymentMode(account)` — PLATFORM / DIRECT
- `assertPlatformPaymentMode(account)` — phase 2 safety guard

**`lib/branding/getDisplayIdentity.ts`** ← new convenience module
- Re-exports `getDisplayName`, `getAccountFeatures`, `getPaymentMode`, `assertPlatformPaymentMode` from `lib/utils/account`
- Adds `getProviderLabel(account, assignedInstructorName?)` — returns `{ label, value, secondaryLabel?, secondaryValue? }`
  - BUSINESS → `{ label: "Driving School", value: "Perth Drive Academy" }`
  - PRO/STUDIO/BASIC → `{ label: "Instructor", value: "Dave Smith" }`
  - Future multi-instructor: pass `assignedInstructorName` for secondary "Your instructor: Sarah" line
- Adds `validateBusinessName(account)` — returns `{ valid, error? }`; BUSINESS accounts must have `businessName` set
- Adds `getSenderName` alias

---

### 4. Branding API — `app/api/instructor/branding/route.ts`

- GET: now returns `businessName` in response
- PUT:
  - Accepts `businessName` for all tiers (removed BUSINESS-only gate — sole instructors need display names too)
  - Validates via `validateBusinessName` — BUSINESS accounts blocked from saving without a school name
  - Trims to 80 chars

---

### 5. Branding Page — `app/dashboard/branding/page.tsx`

- `businessName` state variable loaded from API and saved on submit
- Field label adapts by tier:
  - BASIC: "Display Name (optional)"
  - PRO: "Display Name (optional)"
  - STUDIO: "Brand Name (optional)"
  - BUSINESS: "School Name *" (required, amber border, required attribute)
- Description copy adapts by tier — BUSINESS copy explains the legal/display separation
- Live preview uses `businessName` when set
- Saving sends `businessName` to branding API for all tiers

---

### 6. Subdomain Booking Page — `app/subdomain/[slug]/page.tsx`

- Fetches `businessName` from DB
- `displayName` constant: `(isBusiness && businessName?.trim()) ? businessName : instructor.name`
- Navbar brand text: `hasBranding ? displayName : 'DriveBook'`
- Hero `<h1>`: `displayName`

---

### 7. Recommendations API — `app/api/instructors/recommendations/route.ts`

- Fetches `businessName` and `subscriptionTier` on each instructor
- Every result now includes `displayName` field (BUSINESS → school name, others → businessName ?? name)
- `voice.voiceName` phonetic mapping applies to `displayName` (covers school names with unusual words)
- VAPI AI must use `displayName`, not `name`, when speaking instructor/school name to caller

---

### 8. SMS Service — `lib/services/sms.ts`

- Added `import { getDisplayName } from '@/lib/branding/getDisplayIdentity'`
- `sendBookingConfirmation` — accepts optional `provider: DisplayIdentitySource`; uses `getDisplayName(provider)` if provided, falls back to `instructorName` string
- `sendLessonReminderStudent` — same pattern

---

### 9. Notifications Service — `lib/services/notifications.ts`

All student-facing helpers now accept optional `provider?: DisplayIdentitySource` and resolve display name via `getDisplayName`:

| Function | Changed |
|---|---|
| `notifyClientBookingConfirmed` | + `provider?` param |
| `notifyClientBookingCancelled` | + `provider?` param |
| `notifyClientBookingRescheduled` | + `provider?` param |
| `notifyClientBookingPendingApproval` | + `provider?` param |
| `notifyLessonReminderStudent` | + `provider?` param |

Instructor-facing notifications unchanged — they always use personal name.

---

### 10. Call Sites Updated

All student-facing surfaces now pass the instructor object as `provider`:

| File | Change |
|---|---|
| `app/api/public/bookings/bulk/route.ts` | `notifyClientBookingConfirmed` + `notifyClientBookingPendingApproval` pass `instructor`; VAPI confirmation string uses `getDisplayName(instructor)` |
| `app/api/bookings/route.ts` | `notifyClientBookingConfirmed` passes `booking.instructor` |
| `app/api/bookings/[id]/route.ts` | `notifyClientBookingCancelled` passes `booking.instructor` |
| `app/api/bookings/[id]/cancel/route.ts` | Student cancellation email uses `getDisplayName(booking.instructor)` |
| `app/api/client/bookings/[id]/reschedule/route.ts` | `notifyClientBookingRescheduled` passes `booking.instructor` |
| `app/api/client/pending-reviews/route.ts` | `instructorName` in response uses `getDisplayName`; adds `businessName/accountType/subscriptionTier` to select |
| `app/api/client/dashboard/mobile/route.ts` | `instructorName` and `currentInstructor.name` use `getDisplayName`; adds identity fields to select |
| `app/api/client/bookings/mobile/route.ts` | `instructorName` uses `getDisplayName`; adds identity fields to select |

---

### 11. Legal Identity — NOT touched

The following surfaces still use raw `instructor.name` intentionally:

- Payout processing and payout SMS confirmations
- ABN verification records
- Stripe receipts and tax invoices
- Admin panel (instructors list, instructor detail page)
- Audit logs (`actorId`, metadata)
- Google Calendar sync
- Internal email to instructor on booking cancelled ("Hi John,")

---

### 12. BUSINESS Tier Audit — Status

| Item | Status |
|---|---|
| Config definition ($199/mo, 10% commission, 30-day trial) | ✅ Done |
| Stripe price ID env var slots | ✅ Slots exist — no real IDs in .env yet |
| Commission rate 10% applied | ✅ Done |
| Stripe webhook sets tier to BUSINESS | ✅ Done |
| Voice line auto-assigned on BUSINESS upgrade | ✅ Done |
| Subscription page shows BUSINESS | ✅ Done — `comingSoon: true` (disabled) |
| `businessName` display field | ✅ Done this session |
| Identity architecture (person-led vs org-led) | ✅ Done this session |
| Webhook bug (`commissionRate`/`newStudentBonus` missing from schema) | ⚠️ Latent — fix before enabling |
| Real Stripe price IDs in .env | ❌ Not yet |
| Remove `comingSoon: true` from subscription page | ❌ Not yet |
| `maxInstructors` enforcement | ❌ Not yet (schema field exists, never read) |
| Multi-instructor dashboard / invite flow | ❌ Phase 2 |
| `parentInstructorId` schema relation | ❌ Phase 2 |
| API access gating | ❌ Phase 2 |

### Next Steps Before BUSINESS Launch

1. Fix webhook bug — remove `commissionRate` and `newStudentBonus` from `handleSubscriptionUpdate` write (or add back to schema)
2. Create BUSINESS monthly + annual products in Stripe dashboard
3. Add `STRIPE_BUSINESS_MONTHLY_PRICE_ID` and `STRIPE_BUSINESS_ANNUAL_PRICE_ID` to `.env`
4. Remove `comingSoon: true` from `components/SubscriptionPlans.tsx`
5. Run migration in production: `ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "businessName" TEXT;`
6. Update VAPI system prompt: replace `name` with `displayName` in the instructor presentation step

---

## Previous Sessions

### Homepage SEO (same session, earlier)
- Added `Platform` link to desktop nav
- Added instructor-facing sub-headline to hero
- Added Organization + WebSite JSON-LD to homepage
- Subdomain page already had LocalBusiness JSON-LD — confirmed, no change needed

