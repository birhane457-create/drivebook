# 05 — Business Tier

---

## Identity Model

```
BASIC / PRO / STUDIO = person-led  → instructor.name on all surfaces
BUSINESS             = organisation-led → businessName (school name) on all surfaces
```

`instructor.name` (legal/personal name) is always kept for payouts, ABN, Stripe, and compliance.
`businessName` is the display identity shown to students on booking pages, SMS, email, and AI receptionist.

---

## Pre-Launch Checklist (One-Time, Platform-Level)

- [ ] Stripe BUSINESS monthly product created in Stripe dashboard
- [ ] Stripe BUSINESS annual product created in Stripe dashboard
- [ ] `STRIPE_BUSINESS_MONTHLY_PRICE_ID` set in `.env`
- [ ] `STRIPE_BUSINESS_ANNUAL_PRICE_ID` set in `.env`
- [ ] `comingSoon: true` removed from `components/SubscriptionPlans.tsx`
- [ ] `businessName` column exists in production DB (migration applied)
- [ ] `accountType` and `paymentMode` columns exist in production DB (migration applied)

---

## Activating a BUSINESS Account

### Before activation:
- [ ] Instructor has set a school name in branding settings (`businessName`)
- [ ] ABN is verified (BUSINESS accounts must have ABN for payouts)
- [ ] Instructor understands multi-instructor features are Coming Soon
- [ ] SUPER_ADMIN approval required to enable the tier

### On activation (webhook handles automatically):
- Sets `subscriptionTier = BUSINESS`
- Sets `subscriptionStatus = ACTIVE` or `TRIAL` (30-day trial)
- Auto-assigns dedicated Twilio voice line from PRO+ pool
- Applies 10% commission rate going forward

### Do NOT:
- Manually set `subscriptionTier = BUSINESS` without a Stripe subscription — tier will revert on next sync
- Promise multi-instructor features — Phase 2, not yet built

---

## School Name (businessName) Rules

- Required for BUSINESS accounts — cannot save branding settings without it
- Optional for PRO/STUDIO — can use as a trading/display name
- Max 80 characters
- **Legal name (`instructor.name`) is never replaced** — only display identity changes
- Used on: booking page, AI receptionist, SMS confirmations, email, student dashboard

---

## Business Dashboard Rules (Current — Single Instructor)

Since multi-instructor is not yet live, BUSINESS accounts operate as a single instructor with school branding. When multi-instructor ships:

| Action | Notes |
|---|---|
| Invite sub-instructor | Requires `parentInstructorId` schema relation (Phase 2) |
| Remove sub-instructor | Must cancel/transfer their bookings first |
| Transfer ownership | SUPER_ADMIN action — requires legal verification |
| Instructor limits | Controlled by `maxInstructors` field (currently unused) |
| Team permissions | Phase 2 — role-based within school account |

---

## Coming Soon Features (Do Not Implement Yet)

| Feature | Status | Notes |
|---|---|---|
| Multi-instructor management | Coming Soon | Schema foundation (`parentInstructorId`) needed first |
| Centralised school payouts | Coming Soon | Requires Direct Charges (Phase 2) |
| Cross-instructor analytics | Coming Soon | Awaits multi-instructor model |
| White-label full removal | Coming Soon | `whiteLabel` feature flag exists, not yet active |
| Direct payment mode | Coming Soon | `paymentMode = DIRECT` is guarded — throws NotImplemented |
