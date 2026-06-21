# Subscription Trial Enforcement

## Overview
The Trial Enforcement system manages instructor subscription trials, handles trial-to-paid conversions, and enforces trial-based feature limits. Instructors get a fixed trial period (14 days) before payment is required. Trial features and commission rates are tied to subscription tier.

**Status**: ✅ 100% IMPLEMENTED & VERIFIED (June 19, 2026)  
**Endpoints**:
- `GET /api/instructor/subscription` — Retrieve subscription status
- `POST /api/instructor/subscription` — Create/upgrade subscription (trial or checkout)
- `DELETE /api/instructor/subscription` — Cancel subscription  
**Authentication**: NextAuth (instructor only)  
**Payment Processor**: Stripe (for paid subscriptions)

---

## AS IS - Current Implementation

### Subscription Tiers

| Tier | Trial Days | Monthly | Annual | Booking Limit | Custom Domain | Branded Page | Instructors |
|------|-----------|---------|--------|---------------|---------------|--------------|-----------|
| **BASIC** | 14 | $0 | $0 | Unlimited | ❌ | ❌ | 1 |
| **PRO** | 14 | $29 | $290 | Unlimited | ✅ | ✅ | 1 |
| **STUDIO** | 14 | $79 | $790 | Unlimited | ✅ | ✅ | 5 |
| **BUSINESS** | 14 | $199 | $1,990 | Unlimited | ✅ | ✅ | 10 |

**Commission Rates** (configured in `SUBSCRIPTION_PLANS`):
- Derived from tier; varies by plan
- Not stored in DB; looked up at runtime from config

**Trial Features**:
- All tiers get 14-day trial
- During trial: Full feature access for tier
- After trial: Payment required to continue access

### Subscription States

```
[Created]
    ↓
  TRIAL (status='TRIAL', trialEndsAt=now+14d)
    ├─→ Trial expires → EXPIRED (booking/feature restrictions)
    ├─→ Upgrade tier (mid-trial) → TRIAL (tier changed, trial window preserved)
    └─→ Add payment → ACTIVE (stripe subscription starts, no trial reset)
    ↓
  ACTIVE (status='ACTIVE', stripeSubscriptionId=xxx)
    ├─→ Subscription expires → EXPIRED
    ├─→ Cancel → CANCELLED (cancelAtPeriodEnd=true)
    └─→ Stripe webhook (payment failed) → FAILED or CANCELLED
```

### Trial Start Flow (GET)

**Endpoint**: `GET /api/instructor/subscription`

**Response**: Current subscription details + all available plans

```json
{
  "current": {
    "tier": "BASIC",
    "status": "TRIAL",
    "commissionRate": 0.15,
    "trialEndsAt": "2026-06-28T12:00:00Z",
    "customDomain": null,
    "brandedBookingPage": false,
    "maxInstructors": 1,
    "subscription": {
      "id": "sub_123",
      "monthlyAmount": 0,
      "currentPeriodStart": "2026-06-14T00:00:00Z",
      "currentPeriodEnd": "2026-06-28T23:59:59Z",
      "trialEndsAt": "2026-06-28T12:00:00Z",
      "cancelAtPeriodEnd": false
    }
  },
  "plans": {
    "BASIC": { /* plan details */ },
    "PRO": { /* plan details */ },
    ...
  }
}
```

### First Subscription (POST - Trial Creation)

**Request**:
```json
{
  "tier": "PRO",
  "billingCycle": "monthly"  // or "annual"
}
```

**Flow**:
1. Check if subscription exists. If not, create first-ever trial.
2. Create Subscription record: `status='TRIAL'`, `trialEndsAt=now+14d`
3. Update Instructor: `subscriptionTier='PRO'`, `trialEndsAt=now+14d`, `maxInstructors=<plan_limit>`
4. Return: Trial created message + duration

**Response (200)**:
```json
{
  "success": true,
  "subscription": {
    "id": "sub_456",
    "tier": "PRO",
    "status": "TRIAL",
    "monthlyAmount": 29,
    "billingCycle": "monthly",
    "trialEndsAt": "2026-06-28T12:00:00Z",
    "currentPeriodEnd": "2026-06-28T12:00:00Z"
  },
  "message": "Started 14-day free trial of PRO plan"
}
```

### Upgrade Tier (Mid-Trial)

**Request** (same as first subscription):
```json
{
  "tier": "STUDIO",
  "billingCycle": "monthly"
}
```

**Flow**:
1. Find existing subscription with `status='TRIAL'`
2. **CRITICAL**: Don't reset trial end date. Preserve original `trialEndsAt`.
3. Update Subscription: `tier='STUDIO'`, `monthlyAmount=79` (ONLY, not trialEndsAt)
4. Update Instructor: `subscriptionTier='STUDIO'`, `maxInstructors=5` (not trialEndsAt)
5. Return: Tier upgraded message + remaining trial days

**Rationale**: Instructor gets ONE trial window across all tiers, not a fresh trial per tier change.

**Response (200)**:
```json
{
  "success": true,
  "subscription": { /* same structure */ },
  "message": "Switched to STUDIO plan — 12 trial days remaining"
}
```

### Payment Addition (Trial → Paid)

**Trigger**: When instructor clicks their current tier plan button while on TRIAL (no Stripe ID yet)

**Flow**:
1. Find existing trial subscription: `status='TRIAL' AND tier='PRO' AND stripeSubscriptionId=null`
2. Create Stripe checkout session to add payment method
3. Subscription does NOT change status (stays TRIAL)
4. Upon checkout success (Stripe webhook): Create/link Stripe subscription, update status to ACTIVE
5. Billing starts immediately after first payment

**Response (200)**:
```json
{
  "success": true,
  "checkoutUrl": "https://checkout.stripe.com/pay/...",
  "message": "Redirecting to payment setup..."
}
```

**Stripe Integration**:
- Line item: `{ price: <priceId>, quantity: 1 }`
- No `trial_period_days` — billing starts immediately
- Success/cancel URLs handle redirection
- Webhook updates subscription status to ACTIVE

### Subscription Status (GET)

After subscription state changes, GET endpoint shows:

| Field | Meaning |
|-------|---------|
| `status` | "TRIAL", "ACTIVE", "EXPIRED", "CANCELLED", "FAILED" |
| `trialEndsAt` | null if ACTIVE/EXPIRED/CANCELLED; timestamp if TRIAL |
| `currentPeriodEnd` | Billing period end (for ACTIVE subscriptions) |
| `cancelAtPeriodEnd` | true if instructor initiated cancellation (cancels at next billing date) |
| `stripeSubscriptionId` | Stripe subscription ID (populated only after payment) |

### Cancel Subscription (DELETE)

**Endpoint**: `DELETE /api/instructor/subscription`

**Flow**:
1. Find active subscription
2. Update: `cancelAtPeriodEnd=true`, `cancelledAt=now`
3. Return: Message + cancellation date (current period end)

**Response (200)**:
```json
{
  "success": true,
  "message": "Subscription will be cancelled at the end of the current period",
  "endsAt": "2026-07-14T23:59:59Z"
}
```

**Behavior**:
- Access continues until `currentPeriodEnd`
- After that, features revert to BASIC (or account suspended, depending on policy)
- If instructor resubscribes, gets fresh trial again (not mid-trial)

---

## ✅ Trial Expiration Enforcement - FULLY IMPLEMENTED (June 14, 2026)

### 1. Automatic Trial Expiry Cron Job ✅

**File**: `app/api/cron/check-trial-expiry/route.ts`  
**Schedule**: Daily (via external cron)  
**Logic**:
- Query: `subscription.status='TRIAL' AND trialEndsAt < now`
- Action: Update `status='EXPIRED'`, revert instructor `subscriptionTier='BASIC'`
- Audit: Log trial expiration event with metadata
- Health: Register with cron health monitoring

**Example**:
```
Tuesday 10am:
  ✅ Cron runs
  ✅ Finds 47 expired trials (trialEndsAt < now)
  ✅ Updates each: status='EXPIRED', tier='BASIC'
  ✅ Creates audit logs
  ✅ Returns: { count: 47, message: 'Expired 47 trial subscriptions' }
```

### 2. Trial Expiry Alerts Cron Job ✅

**File**: `app/api/cron/send-trial-expiry-alerts/route.ts`  
**Schedule**: Daily  
**Emails**:

**Email 1: 7-Day Warning**
- Trigger: `status='TRIAL' AND trialEndsAt between now and now+7d`
- Dedup: Checked via `AuditLog` — action `TRIAL_WARNING_EMAIL_SENT` on this subscription. Sends once only.
- Subject: `Your {tier} trial ends in X days`
- Content: Countdown, plan list with prices from `SUBSCRIPTION_PLANS` config (not hardcoded), upgrade CTA
- Note: Prices in email always reflect current env var config — no stale hardcoded values

**Email 2: 3-Day Reminder** *(added June 19, 2026)*
- Trigger: `status='TRIAL' AND trialEndsAt between now and now+3d`
- Dedup: `AuditLog` action `TRIAL_3DAY_WARNING_EMAIL_SENT` — sends once only
- Subject: `⏰ X days left on your DriveBook trial`
- Content: Urgency escalation, "add payment in 2 minutes" CTA, consequences of expiry

**Email 3: Expiry Notification**
- Trigger: `status='EXPIRED' AND trialEndsAt in last 24h`
- Dedup: `AuditLog` action `TRIAL_EXPIRED_EMAIL_SENT` — sends once only
- Subject: `Your DriveBook trial ended — action required to restore access`
- Content: Features now in READ-ONLY, plan table with live prices from config, upgrade CTA

**Deduplication mechanism**: All three emails use `AuditLog` entries (not DB fields on Subscription).
Each send writes a record: `{ action: 'TRIAL_*_EMAIL_SENT', targetType: 'SUBSCRIPTION', targetId: sub.id }`.
Before each send, the cron queries for an existing record — if found, skips. This avoids adding extra fields to the schema.

**Non-blocking**: Each email is individually try/caught. One failure does not abort others.

### 3. Feature Gate Enforcement at Endpoints ✅

**Domain Verification** (`app/api/instructor/domain/verify/route.ts`):
- Check: `subscriptionTier != STUDIO|BUSINESS` → 403 "Requires Studio+ plan"
- Check: `status='TRIAL' AND trialEndsAt < now` → 403 "Trial expired, upgrade required"

**Branding** (`app/api/instructor/branding/route.ts`):
- Check: `status='TRIAL' AND trialEndsAt < now AND tier != BASIC` → 403 "Trial expired"

**Bookings** (`app/api/bookings/route.ts`):
- Already protected by `requireActiveSubscription()` middleware
- Returns 403 with `readOnly: true` if trial expired
- Message: "Your free trial has expired. Subscribe to create new bookings."

### 4. Cron Health Monitoring ✅

**Updated**: `lib/services/cron-health.ts`

Added two new cron jobs to monitoring:
```typescript
'check-trial-expiry': { 
  maxAgeMinutes: 1500,  // 25 hours — daily job
  description: 'Marks TRIAL subscriptions as EXPIRED when trial ends'
},
'send-trial-expiry-alerts': {
  maxAgeMinutes: 1500,  // 25 hours — daily job
  description: 'Sends trial expiry warnings and notifications'
}
```

Now monitored for stale runs. Alert if job hasn't executed in 25 hours.

---

## AS IT SHOULD BE - Recommended Enhancements

### 1. Trial Expiration Soft-Delete (Grace Period) — PHASE 2

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Hard cutoff at trial end (features disabled immediately) | Harsh; client might be mid-lesson |
| **Enhancement** | 3-day grace period after trial ends. Features work but message: "Trial ended. Upgrade by DATE or access ends." | Better UX |
| **Implementation** | Update feature gates: Allow if `(trialEndsAt < 3 days ago AND status='TRIAL')` show warning | Gentle nudge |
| **Effort** | Low (~1-2 hours: update feature gate logic) | Phase 1-2 |

### 3. Trial Extension (Admin Only)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | No way to extend trial | Inflexible for support scenarios (e.g., "My trial bugged out") |
| **Enhancement** | Admin can extend trial by X days via `/api/admin/instructors/{id}/subscription/extend-trial` | Support tool |
| **Implementation** | Add `PATCH` endpoint: `{ extensionDays: 7 }` → Update `trialEndsAt` | Audit logged |
| **Effort** | Low (~1-2 hours: API endpoint, audit log) | Phase 1 |

### 4. Trial Usage Analytics

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current Gap** | No tracking of trial-to-paid conversion rate | Can't optimize trial offer |
| **Enhancement** | Dashboard: % of trial users who converted, avg conversion time, churn rate | Visibility |
| **Metrics** | Total trials started, trials expired unpaid, trials converted to paid, trials cancelled | KPIs |
| **Reporting** | Weekly email to admin with trends | Monitoring |
| **Effort** | Medium (~3-4 hours: dashboard widget, analytics queries) | Phase 2 |

### 5. Tier Feature Breakdown (Tiered Access)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Hard tier boundaries (BASIC has none of PRO features) | No room for nuance |
| **Enhancement** | Gradual feature rollout: BASIC tier + add custom domain for $9/mo | Upsell flexibility |
| **Tiers** | Core + à la carte features (domain=$9, branded=$15, instructors=$50 each) | Users pick what they need |
| **Implementation** | Feature flags per instructor. Check `instructor.enabledFeatures` at runtime | Backward compatible |
| **Effort** | High (~6-8 hours: schema changes, feature gate rewrites) | Phase 3 |

### 6. Subscription Pause (Temporary Suspension)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Cancel or continue; no pause | Instructor needs break (vacation) but doesn't want to lose account |
| **Enhancement** | Allow instructor to pause subscription for up to 3 months. Resume anytime. | Reduce churn |
| **Implementation** | New status: "PAUSED". Set `pausedAt`, `resumeBy` dates. Restrict bookings during pause. | Don't bill while paused |
| **Effort** | Medium (~4-5 hours: new status, feature gates, email notifications) | Phase 2-3 |

### 7. Annual Prepay Incentives

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Annual = 12× monthly but no discount | No incentive to prepay |
| **Enhancement** | Offer 15% discount for annual: PRO $290/yr (vs $348 monthly). Highlight savings. | Revenue optimization |
| **Implementation** | Marketing messaging in checkout. Stripe price IDs for annual already configured. | Quick add |
| **Effort** | Low (~1 hour: copy changes, price visibility) | Phase 1-2 |

### 8. Subscription Downgrade (Step Down Tiers)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Upgrade or cancel; no downgrade | Instructor paying too much wants to step down |
| **Enhancement** | Allow downgrade tier: STUDIO → PRO, charge difference immediately or apply credit | Better retention |
| **Implementation** | Prorated charge/credit. Update `tier` + `maxInstructors`. Stripe webhook handles billing | Fair pricing |
| **Effort** | Medium (~3-4 hours: downgrade logic, prorating, Stripe sync) | Phase 2-3 |

### 9. Subscription Auto-Renewal Confirmation

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | Subscription auto-renews; instructor gets invoice but may not realize | Can feel like surprise charge |
| **Enhancement** | Email reminder 7 days before renewal. Button to "Confirm renewal" or cancel early | Transparency |
| **Implementation** | Cron job checks `currentPeriodEnd - 7 days`. Send email with ONE-CLICK cancel link. | Reduce chargebacks |
| **Effort** | Low (~2 hours: email template, cron job) | Phase 1-2 |

### 10. Family/Group Pricing (Multi-Instructor Accounts)

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Current** | STUDIO allows 5 instructors but one tier for all | Inflexible for group studios |
| **Enhancement** | Allow STUDIO instructor to add instructors gradually. Charge per additional instructor ($30/mo) | Volume pricing |
| **Implementation** | Track instructor count in real-time. Add seat billing. | Scalable revenue |
| **Effort** | High (~6-8 hours: billing logic, Stripe line items, admin dashboard) | Phase 3 |

---

## Implementation Checklist

- [x] Subscription models (Subscription, Instructor.subscriptionTier/Status/trialEndsAt)
- [x] Trial creation flow (14-day duration)
- [x] Tier upgrade mid-trial (preserve original trial end date)
- [x] Payment addition (Stripe checkout for trial → paid conversion)
- [x] Subscription cancellation with period-end effectiveness
- [x] GET endpoint returns subscription status + plans
- [x] POST endpoint creates/upgrades subscriptions
- [x] DELETE endpoint cancels subscriptions
- [x] Trial expiration enforcement — cron `check-trial-expiry` marks EXPIRED daily at 1am UTC ✅
- [x] Feature restriction on trial expiration — read-only via `subscriptionValidation.ts` ✅
- [x] Trial expiration notifications — 7-day warning + 3-day reminder + expiry notice ✅ (June 19, 2026)
- [x] All crons registered in vercel.json ✅ (June 19, 2026)
- [ ] Trial grace period (3 days after expiry) — Phase 2
- [ ] Admin trial extension capability — Phase 2
- [ ] Trial-to-paid conversion analytics — Phase 2
- [ ] Tiered feature breakdown with à la carte options — Phase 3
- [ ] Subscription pause functionality — Phase 2-3
- [ ] Annual prepay discounts — Phase 1-2
- [ ] Subscription downgrade — Phase 2-3
- [ ] Auto-renewal confirmation emails — Phase 1-2
- [ ] Multi-instructor account pricing — Phase 3

---

## Related Features

- **Instructor Onboarding**: `ONBOARDING_APPROVAL.md` — Subscription assignment during onboarding
- **Payments**: `06-payments/DISPUTES_AND_CHARGEBACKS.md` — Subscription payment failures
- **Stripe Integration**: `07-subscriptions/STRIPE_CONNECT_SETUP.md` — Stripe webhook handling

---

## Database Schema (Fields Used)

```prisma
model Instructor {
  // ... existing fields

  subscriptionTier     String        @default("BASIC")  // BASIC | PRO | STUDIO | BUSINESS
  subscriptionStatus   String        @default("TRIAL")  // TRIAL | ACTIVE | EXPIRED | CANCELLED | FAILED
  trialEndsAt          DateTime?     // When trial period ends (not reset on tier upgrade)
  maxInstructors       Int           @default(1)        // Max instructors allowed for this tier
}

model Subscription {
  id                   String        @id @default(cuid())
  instructorId         String        @unique
  tier                 String        // BASIC | PRO | STUDIO | BUSINESS
  status               String        @default('TRIAL')  // TRIAL | ACTIVE | EXPIRED | CANCELLED | FAILED
  monthlyAmount        Float         // Plan price (monthly or annual)
  billingCycle         String        // 'monthly' | 'annual'
  
  currentPeriodStart   DateTime      // Billing period start
  currentPeriodEnd     DateTime      // Billing period end
  trialEndsAt          DateTime?     // Trial end date (null if ACTIVE)
  
  stripeSubscriptionId String?       // Stripe sub ID (populated on payment)
  stripeCustomerId     String?       // Stripe customer ID
  
  cancelAtPeriodEnd    Boolean       @default(false)   // Marked for cancellation
  cancelledAt          DateTime?     // When cancellation was initiated
  
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt
}
```

---

## Testing Recommendations

### Trial Creation
- ✅ Create first subscription → TRIAL status, trialEndsAt set to now+14d
- ✅ Trial created for each tier → correct tier saved
- ✅ GET subscription → Returns trial details + commission rate

### Mid-Trial Upgrades
- ✅ Upgrade tier mid-trial → Tier changed, original trialEndsAt preserved
- ✅ Downgrade tier mid-trial → Same behavior (trial window unchanged)
- ✅ Multiple tier changes → Only original trial end date applies

### Trial → Paid Conversion
- ✅ Click current tier plan on TRIAL → Stripe checkout created
- ✅ Complete payment → Subscription status → ACTIVE, stripeSubscriptionId populated
- ✅ Cancel payment → Stay in TRIAL, no charge

### Subscription Management
- ✅ DELETE subscription → Status marked for cancellation
- ✅ Access continues until currentPeriodEnd
- ✅ Resubscribe after cancellation → Fresh trial (not mid-trial pickup)

### Authorization
- ✅ Instructor can manage own subscription
- ✅ Instructor cannot access another instructor's subscription
- ✅ Client cannot access subscription endpoints

---

## Security Considerations

1. **Trial Enforcement**: Must verify `trialEndsAt` on every feature access (not just at initial create)
2. **Stripe Integration**: Validate webhook signature; don't trust client-submitted Stripe data
3. **Authorization**: Always verify session instructor ID before allowing subscription modifications
4. **PII**: Stripe data (customer ID, subscription ID) should not be exposed to client directly
5. **Audit Trail**: Log all subscription changes (tier changes, cancellations, payment failures)

---

## Performance Notes

- **Subscription Lookups**: Cache in session; invalidate on logout
- **Plan Config**: Load `SUBSCRIPTION_PLANS` from config (not DB) for fast lookups
- **Stripe Calls**: Async; don't block checkout creation
- **Trial Expiration**: Cron job runs once daily (low frequency is OK)

---

**Status (June 19, 2026):** All trial enforcement is fully implemented and verified. The CRITICAL GAP described below was resolved — cron jobs are registered, running, and emails send correctly with deduplication via AuditLog.

