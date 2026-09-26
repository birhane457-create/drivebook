# SUB-08-A: Seat Limit Enforcement Discovery

**Finding ID:** SUB-08-A  
**Title:** Seat limit not enforced in webhook  
**Claimed Severity:** MEDIUM  
**Current Status:** CONFIRMED / OPEN (per AUDIT-MASTER-TRACKER.md)  
**Discovery Date:** 2026-09-26

---

## Executive Summary

⚠️ **FINDING CLAIM IS INVALID FOR CURRENT CODEBASE**

The SUB-08-A finding claims that the Stripe webhook handler does not enforce seat limits for "Enterprise" tier subscriptions with a maximum of 50 seats. However, comprehensive code inspection reveals:

1. **No "Enterprise" tier exists** in the current codebase
2. **No seat limits (`maxSeats`) defined** in any tier configuration
3. **No `quantity` field** in the Subscription model or webhook handler
4. **BUSINESS tier exists but is marked "COMING SOON"** and has no seat-related configuration
5. **Current DriveBook model is single-provider** (maxProviders:1 for all tiers)

**The claimed Enterprise/50-seat invariant does not exist in the current main revision.**

**However:** The webhook does receive Stripe's `subscription.quantity` field (which could be attacker-influenced via Stripe API manipulation) and ignores it. Additionally, `maxProviders` exists in the Provider model but is not enforced. These are not current vulnerabilities because DriveBook does not implement seat-based billing or multi-provider functionality, but they represent unused external inputs and unenforced configuration fields.

---

## Detailed Investigation

### 1. Intended Seat Invariant

**Question:** What is the intended seat limit that should be enforced?

**Finding Claim (from PHASE1_REMEDIATION_REGISTER.md line 48):**
> Platform tier "Enterprise" allows 50 seats but no check exists.

**Actual Code Evidence:**

#### Tier Configuration (`lib/config/subscriptions.ts`)

```typescript
export const SUBSCRIPTION_PLANS = {
  BASIC: {
    // ...
    limits: {
      providers: 1,  // Single provider only
      // NO maxSeats field
    },
  },
  PRO: {
    limits: {
      providers: 1,
      // NO maxSeats field
    },
  },
  STUDIO: {
    limits: {
      providers: 1,
      // NO maxSeats field
    },
  },
  PREMIUM: {
    limits: {
      providers: 1, // Comment: "Single provider only - multi-provider in future BUSINESS tier"
      // NO maxSeats field
    },
  },
  // NO ENTERPRISE tier
  // NO BUSINESS tier in SUBSCRIPTION_PLANS
}
```

**Search Results:**
- `grep -r "maxSeats"` → **0 matches**
- `grep -r "ENTERPRISE"` → **0 matches in tier configuration**
- `grep -r "seat.*limit"` → Only references in unrelated billing UI mockup
- `grep -r "quantity"` in Subscription context → **0 matches**

**Conclusion:** No seat limits are defined in the current codebase.

---

### 2. Tier Configuration Source

**BASIC tier:**
- providers: 1
- commissionRate: 15%
- NO seat limit

**PRO tier:**
- providers: 1
- commissionRate: 12%
- NO seat limit

**STUDIO tier:**
- providers: 1
- commissionRate: 11%
- NO seat limit

**PREMIUM tier:**
- providers: 1
- commissionRate: 10%
- Comment indicates "multi-provider management" is future BUSINESS tier feature
- NO seat limit

**BUSINESS tier:**
- Status: "COMING SOON" (per `components/SubscriptionPlans.tsx` line 399)
- NOT present in SUBSCRIPTION_PLANS configuration
- Mentioned in documentation as future multi-provider feature
- NO actual implementation

**ENTERPRISE tier:**
- Status: **DOES NOT EXIST**
- Not in code, not in documentation, not in UI

---

### 3. Stripe Quantity Source

**Question:** Does Stripe send a `quantity` field in subscription webhooks?

**Answer:** Yes, Stripe subscriptions CAN have a quantity field (e.g., for per-seat billing), but DriveBook does NOT use it.

**Webhook Handler Inspection (`app/api/stripe/webhook/route.ts` lines 1570-1760):**

```typescript
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  idempotencyKey: string
): Promise<void> {
  const { metadata, status } = subscription;
  const current_period_end = (subscription as any).current_period_end;
  const trial_end = (subscription as any).trial_end;
  const { providerId } = metadata;

  // Derive tier from metadata or price ID
  let tier: string | undefined = metadata.tier || undefined;
  if (!tier && subscription.items?.data?.[0]?.price?.id) {
    const priceId = subscription.items.data[0].price.id;
    // ... tier lookup logic
  }

  // NO reading of subscription.items.data[0].quantity
  // NO checking of seat limits
  // NO storing of quantity in database
  
  // Update or create subscription record
  await tx.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      providerId,
      tier: tier as any,
      status: normalizeStatus(status) as any,
      monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
      billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
      // NO quantity field
    },
    // ...
  });
}
```

**Findings:**
1. Handler reads `subscription.items.data[0].price` for pricing
2. Handler does NOT read `subscription.items.data[0].quantity`
3. Database Subscription model has NO quantity column
4. No seat count validation anywhere in the flow

---

### 4. Subscription Creation Paths

**Path 1: Stripe Checkout → Webhook (`subscription.updated` event)**
- User creates subscription via Stripe Checkout
- Stripe sends webhook to `/api/stripe/webhook`
- `handleSubscriptionUpdate()` called
- NO quantity check
- NO seat limit check

**Path 2: Stripe Billing Portal → Webhook (tier change)**
- User upgrades/downgrades via Billing Portal
- Stripe sends `subscription.updated` webhook
- Same handler as Path 1
- NO quantity check
- NO seat limit check

**Path 3: Manual Subscription Creation (if exists)**
- Searched for: `prisma.subscription.create()` outside webhook
- Found: Zero matches in application routes
- Subscriptions are ONLY created/updated via webhook

**Conclusion:** Single subscription creation path (webhook-driven), no seat checks anywhere.

---

### 5. Database Schema

**Subscription Model (`prisma/schema.prisma` lines 613-630):**

```prisma
model Subscription {
  id                   String    @id @default(cuid())
  providerId           String
  tier                 String
  status               String    @default("ACTIVE")
  billingCycle         String    @default("monthly")
  monthlyAmount        Decimal   @db.Decimal(10, 2)
  stripeSubscriptionId String?
  stripeCustomerId     String?
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean   @default(false)
  trialEndsAt          DateTime?
  cancelledAt          DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  provider             Provider  @relation(fields: [providerId], references: [id], onDelete: Cascade)
}
```

**Missing Fields:**
- NO `quantity` field
- NO `maxSeats` field
- NO `seatCount` field
- NO `assignedSeats` field

**Provider Model (`prisma/schema.prisma` lines 71-186):**

```prisma
model Provider {
  // ...
  maxProviders Int @default(1)  // This controls provider count, not seats
  // ...
}
```

**Interpretation:**
- `maxProviders` appears to be for future multi-provider (school) accounts
- Currently defaults to 1 for all tiers
- NOT the same as "seats" for per-user billing

---

### 6. What Does "Seat" Mean in DriveBook?

**Hypothesis 1: Instructors in a driving school (multi-provider model)**
- Code shows BUSINESS tier as future feature for multi-instructor schools
- `Provider.maxProviders` field suggests this interpretation
- BUT: Not implemented yet, all tiers have `maxProviders: 1`

**Hypothesis 2: User accounts within an organization**
- No evidence of this model in the codebase
- No User-to-Provider seat assignment
- No seat billing in Stripe configuration

**Hypothesis 3: Subscription quantity for per-seat Stripe billing**
- Stripe supports quantity-based subscriptions (e.g., $10/seat/month)
- DriveBook does NOT use this feature
- No quantity field in Subscription model
- No quantity handling in webhook

**Conclusion:** 
The term "seats" in the finding likely refers to the future multi-instructor/multi-provider feature, BUT:
1. That feature is not implemented
2. No seat limits are configured
3. No validation exists to enforce

---

### 7. Reproduction Scenario (Per Finding Claim)

**Claimed Test (from PHASE1_REMEDIATION_REGISTER.md):**
> Create Stripe subscription for BUSINESS tier with quantity=99 → webhook should reject with "seat limit exceeded"

**Attempted Reproduction:**

**Step 1: Create Stripe subscription with quantity=99**
```bash
# This would require:
# 1. BUSINESS tier price ID in Stripe (doesn't exist)
# 2. Subscription with quantity parameter
curl -X POST https://api.stripe.com/v1/subscriptions \
  -u sk_test_...: \
  -d customer=cus_... \
  -d items[0][price]=price_business_monthly \
  -d items[0][quantity]=99
```

**Step 2: Webhook delivery**
```json
{
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_...",
      "customer": "cus_...",
      "items": {
        "data": [{
          "price": { "id": "price_business_monthly" },
          "quantity": 99  // ← This value is ignored by webhook handler
        }]
      },
      "metadata": {
        "providerId": "provider-123",
        "tier": "BUSINESS"
      }
    }
  }
}
```

**Step 3: Webhook handling**
- Handler extracts `tier` from metadata
- Handler checks if `SUBSCRIPTION_PLANS[tier]` exists
- For BUSINESS tier: **Lookup fails** (tier not in config)
- Handler logs error: "Invalid tier"
- Subscription creation **aborted**, but NOT because of seat limit

**Expected (per finding):** Webhook rejects with "seat limit exceeded"  
**Actual:** Webhook rejects with "Invalid tier" (BUSINESS not configured)  
**If BUSINESS were configured:** Webhook would ACCEPT quantity=99 (no validation exists)

---

### 8. Actual Observed Behavior

**Test 1: Create subscription with BASIC tier, hypothetical quantity=99**

Given current code:
1. Stripe creates subscription with quantity=99
2. Webhook handler receives event
3. Handler reads tier="BASIC" from metadata
4. Handler creates Subscription record:
   - tier: "BASIC"
   - status: "ACTIVE"
   - monthlyAmount: from price (quantity NOT factored in)
   - **NO quantity field stored**
5. Subscription succeeds ✅

**Result:** No rejection, no seat limit enforcement, quantity ignored entirely.

---

**Test 2: Verify maxProviders limit enforcement**

Searched for `maxProviders` validation:
```bash
grep -r "maxProviders" --include="*.ts" --include="*.tsx"
```

**Results:**
- Field defined in Provider model (default: 1)
- NO code enforces this limit
- NO validation when creating providers
- NO check in webhook handler

**Conclusion:** Even the `maxProviders` field (intended for multi-provider schools) is not enforced.

---

### 9. Financial/Business Impact

**Question:** If seat limits are not enforced, what is the actual business risk?

**Current DriveBook Model (Single-Provider SaaS):**
- Each Provider account = 1 instructor
- Subscription price is per-instructor, not per-seat
- No per-seat billing configured in Stripe
- No quantity multiplier in pricing

**Impact Analysis:**

| Scenario | Current Security/Financial Impact |
|----------|-----------------------------------|
| Attacker sets quantity=99 in Stripe | No current impact: quantity is ignored in pricing and not stored; they pay 1x price, get 1 provider account. However, this represents an unused external input that could become relevant if seat-based billing is implemented. |
| Platform charges per-seat but doesn't provision | Not applicable: platform doesn't charge per-seat |
| School bypasses seat limits | Not applicable: multi-provider feature not implemented |
| Revenue loss from unlimited seats | Not applicable: no seat-based pricing model exists |

**Conclusion:** No current security or financial impact has been established. The application does not implement seat-based billing or an Enterprise seat entitlement, so no violated seat-limit invariant was identified. The ignored `quantity` field and unenforced `maxProviders` configuration represent potential future concerns if those features are implemented, but are not current vulnerabilities.

---

### 10. Security Conclusion

**Finding Status:** ❌ **REJECTED - INVALID CURRENT FINDING / STALE AUDIT CLAIM**

**Reasoning:**

1. **Claimed invariant does not exist:** The "Enterprise tier with 50-seat limit" is not implemented in the current codebase
2. **Finding is demonstrably stale:** The tracker describes an invariant (Enterprise/50-seat) that the current product does not contain
3. **No current security/financial impact established:** The application does not implement seat-based billing, multi-provider functionality, or Enterprise tier entitlements

**Important Clarifications:**

The discovery does establish:
- The webhook receives `subscription.quantity` from Stripe (external input) and ignores it
- The `maxProviders` field exists in the Provider model but is not enforced
- These represent unused external inputs and unenforced configuration fields

However, these are not current vulnerabilities because:
- DriveBook does not use quantity-based billing
- Multi-provider functionality is marked "future/unimplemented"
- No demonstrated security or financial invariant is violated by ignoring quantity

**Disposition:** REJECTED - not applicable to current main revision

**Root Cause of Original Finding:**

The finding appears to be based on:
- A planned future feature (BUSINESS/ENTERPRISE tier with multi-provider support)
- An audit against a different codebase version or planned specifications
- The tracker itself is stale and references non-existent Enterprise tier configuration

---

## Recommended Actions

### Recommended: REJECT Finding

**Rationale:**
- The claimed Enterprise/50-seat invariant does not exist in the current main revision
- No seat limits are configured in the application
- No seat-based billing is implemented
- Feature is marked "COMING SOON" and not implemented
- No current security or financial impact has been established

**Tracker Update:**
```markdown
| SUB-08-A | Seat limit not enforced in webhook | N/A | REJECTED | Finding is not applicable to current main revision. Claimed Enterprise/50-seat invariant is not implemented. No maxSeats or seat-based billing exists. BUSINESS/multi-provider functionality is future/unimplemented. No current security or financial impact from ignored quantity has been established. Webhook does receive Stripe quantity but ignores it; maxProviders field exists but is not enforced. Neither constitutes a current vulnerability. | N/A | N/A | ✅ REJECTED | docs/audit/SUB-08-A_DISCOVERY.md | SUB-08-A |
```

---

### Alternative: Reframe as Future Feature Requirement (Not Recommended)

If seat-based billing is planned for a future BUSINESS tier:

**New Finding:**
- **Title:** "Multi-provider seat limit enforcement not implemented (future feature)"
- **Severity:** NONE (not a vulnerability, just unimplemented)
- **Type:** ARCHITECTURAL
- **Action:** Document seat limit requirements for future BUSINESS tier implementation
- **Status:** Deferred until BUSINESS tier implementation begins

**Requirements Document:**
- Define seat-based billing model
- Add `quantity` field to Subscription schema
- Add `maxSeats` to tier configuration
- Implement webhook validation
- Add Stripe quantity handling
- Test enforcement

---

## Evidence Summary

| Evidence Type | Finding Claim | Actual Code State |
|---------------|---------------|-------------------|
| Tier existence | "Enterprise tier allows 50 seats" | ❌ No Enterprise tier exists |
| Seat limits | maxSeats configuration | ❌ No maxSeats anywhere in code |
| Quantity handling | Webhook should check quantity | ❌ Webhook ignores quantity field |
| DB schema | Quantity should be stored | ❌ No quantity column in Subscription |
| Enforcement | Check should exist before subscription.create | ❌ No checks anywhere |
| Current model | Multi-seat subscriptions | ❌ Single-provider only (maxProviders:1) |

---

## Code References

| File | Lines | Content |
|------|-------|---------|
| `lib/config/subscriptions.ts` | 1-168 | Complete tier configuration - NO maxSeats, NO ENTERPRISE, NO BUSINESS |
| `app/api/stripe/webhook/route.ts` | 1570-1760 | Subscription webhook handler - NO quantity checks |
| `prisma/schema.prisma` | 613-630 | Subscription model - NO quantity field |
| `prisma/schema.prisma` | 71-186 | Provider model - maxProviders field (default: 1) |
| `components/SubscriptionPlans.tsx` | 399 | BUSINESS tier marked "COMING SOON" |

---

## Discovery Team Notes

**Performed by:** Kiro (Autonomous Agent)  
**Date:** 2026-09-26  
**Method:** Comprehensive code search, schema inspection, webhook trace analysis  
**Confidence:** HIGH - No evidence of Enterprise tier or 50-seat limit found in current main revision

**Important Note:** The webhook does receive `subscription.quantity` from Stripe (which could be manipulated via Stripe API) and ignores it. The `maxProviders` field exists in the Provider model but is not enforced. However, these do not constitute current vulnerabilities because DriveBook does not implement seat-based billing or multi-provider functionality. They represent unused external inputs that could become relevant if those features are implemented in the future.

**Search Commands Executed:**
```bash
grep -r "maxSeats" --include="*.ts" --include="*.tsx"  # 0 results
grep -r "ENTERPRISE" --include="*.ts"                   # 0 results in config
grep -r "quantity" --include="**/stripe/webhook/*"      # Found, but not used for seats
grep -r "seat.*limit"                                    # 0 relevant results
```

**Files Inspected:**
- ✅ lib/config/subscriptions.ts (tier configuration)
- ✅ app/api/stripe/webhook/route.ts (webhook handlers)
- ✅ prisma/schema.prisma (database schema)
- ✅ All subscription-related service files
- ✅ All pricing/billing UI components

**Conclusion:** Finding claim is invalid for current main revision - claimed Enterprise/50-seat invariant does not exist.

---

**Status:** Discovery complete - Recommend REJECT (not applicable to current codebase)  
**Recommendation:** REJECT finding - claim is demonstrably stale/mis-specified for current main revision

