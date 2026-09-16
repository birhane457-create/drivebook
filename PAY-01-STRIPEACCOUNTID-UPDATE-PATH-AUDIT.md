# PAY-01: Complete stripeAccountId Update Path Audit

**Date:** 2026-09-11  
**Auditor:** Security Investigation (PAY-01-C prerequisite)  
**Scope:** All code paths that can modify `Provider.stripeAccountId` after initial creation

## Executive Summary

✅ **COMPLETE CHAIN VERIFIED**  
❌ **METADATA IS NOT AUTHORITATIVE (yet)**

The `Provider.stripeAccountId` field can be modified through exactly **2 code paths**:
1. Initial creation during Stripe Connect onboarding
2. Webhook updates when Stripe sends `account.updated` events

**CRITICAL FINDING:** The webhook path (path #2) has mismatch detection but **throws an error and prevents the update** when `providerId` metadata doesn't match. However, this creates a **denial-of-service vector** rather than a takeover vector.

**SECURITY GAP:** The `executePayout()` function does **not verify the Stripe-side metadata** before calling `stripe.transfers.create()`. It trusts the database value unconditionally.

---

## Detailed Findings

### Path 1: Initial Onboarding (Write-Once)

**File:** `app/api/instructor/stripe-connect/onboard/route.ts`  
**Lines:** 46-68

```typescript
let stripeAccountId = instructor.stripeAccountId;
if (!stripeAccountId) {
  const account = await stripe.accounts.create({
    type: 'express',
    metadata: {
      providerId: instructor.id,
      instructorName: instructor.name,
      // ... other fields
    },
  });
  stripeAccountId = account.id;

  await prisma.provider.update({
    where: { id: instructor.id },
    data: { stripeAccountId }  as any,
  });
}
```

**Security Properties:**
- ✅ Metadata binding established at creation: `metadata.providerId` → `instructor.id`
- ✅ Write-once: only executes if `stripeAccountId` is null
- ✅ Atomic: Stripe account created first, then DB updated
- ❌ No verification of existing Stripe account if DB value already set

**Attack Surface:**
- Direct SQL injection/database write can modify `Provider.stripeAccountId` to attacker's account
- No runtime verification that the Stripe account's metadata matches the provider

---

### Path 2: Webhook Updates (Mismatch Protection)

**File:** `app/api/stripe/webhook/route.ts`  
**Lines:** 2595-2655  
**Event:** `account.updated`

```typescript
async function handleConnectAccountUpdated(
  account: Stripe.Account,
  idempotencyKey: string
): Promise<void> {
  const providerId = account.metadata?.providerId;
  if (!providerId) {
    // Skip: no metadata binding
    return;
  }

  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { id: true, stripeAccountId: true },
  });

  if (!provider) {
    throw new Error(`Connect account references unknown provider: ${providerId}`);
  }

  // SECURITY CHECK: Verify existing binding matches
  if (provider.stripeAccountId && provider.stripeAccountId !== account.id) {
    void sendAlert({
      type: 'RECONCILIATION_ISSUES',
      severity: 'CRITICAL',
      message: `Stripe Connect account mismatch for provider ${providerId}. ` +
               `Existing=${provider.stripeAccountId}, received=${account.id}. ` +
               `Account association was NOT changed.`,
      entityId: providerId,
      metadata: {
        providerId,
        existingStripeAccountId: provider.stripeAccountId,
        receivedStripeAccountId: account.id,
      },
    });
    throw new Error(`Stripe Connect account mismatch for provider ${providerId}`);
  }

  // Only updates if null or matches
  await prisma.provider.update({
    where: { id: providerId },
    data: {
      stripeAccountId: account.id,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
      ...(chargesEnabled && payoutsEnabled ? { payoutMethod: 'stripe_connect' } : {}),
    },
  });
}
```

**Security Properties:**
- ✅ Reads `metadata.providerId` from Stripe account
- ✅ Verifies existing DB value matches or is null
- ✅ **BLOCKS update** if mismatch detected (throws error + sends alert)
- ✅ Alert sent to operations team on mismatch
- ❌ Does not allow "reconnection" - legitimate account changes blocked

**Attack Surface:**
- **DoS Vector:** Attacker with DB write can modify `stripeAccountId` to prevent legitimate webhook updates
- **NOT a takeover vector:** Webhook won't update DB to attacker's account if legitimate account already set

---

### Path 3: Other `prisma.provider.update()` Calls

**Analysis:** Audited 20+ `prisma.provider.update()` calls across the codebase:

**Files checked:**
- `app/api/instructor/settings/route.ts` - profile/business settings
- `app/api/instructor/profile/route.ts` - instructor profile
- `app/api/instructor/payout-settings/route.ts` - payout preferences (NOT stripeAccountId)
- `app/api/admin/instructors/[id]/verify-abn/route.ts` - ABN verification
- `app/api/admin/instructors/[id]/suspend/route.ts` - suspension
- `app/api/stripe/webhook/route.ts` - dispute holds (lines 1953, 2130)
- `app/api/cron/recheck-abn/route.ts` - ABN status updates
- `app/api/reviews/route.ts` - rating updates
- ... (17+ other routes)

**Result:**  
✅ **NONE of these routes modify `stripeAccountId`**

They update:
- Profile fields (name, bio, hourly rate, service areas)
- Payout preferences (method, threshold, schedule, tax settings)
- Onboarding state (chargesEnabled, payoutsEnabled)
- Administrative flags (payoutHold, suspendedAt, approvalStatus)
- Integration tokens (stripeCustomerId, googleRefreshToken)

**Conclusion:** No hidden write paths exist.

---

## Vulnerability Assessment

### Current State: Database Value is NOT Authoritative

The `executePayout()` function (line 372) directly uses the database value:

```typescript
const transfer = await stripe.transfers.create({
  amount: Math.round(toNumber(toDecimal(payout.netAmount)) * 100),
  currency: 'aud',
  destination: payout.stripeAccountId!,  // ❌ No verification
  metadata: { payoutId: payout.id, providerId: payout.providerId },
});
```

**Attack Scenario:**
1. Legitimate provider completes onboarding → `Provider.stripeAccountId` set to `acct_LEGIT123`
2. Attacker gains database write access (SQL injection, compromised admin credentials)
3. Attacker updates `Provider.stripeAccountId` to their own account `acct_ATTACKER456`
4. When `executePayout()` runs, it reads the database and transfers money to `acct_ATTACKER456`
5. Stripe executes the transfer (no verification on Stripe's side that the account belongs to this provider)

**Why This Works:**
- Stripe API accepts any valid account ID for `destination`
- No cross-reference check between `transfer.destination` and `transfer.metadata.providerId`
- The `metadata.providerId` on the Stripe Account is never consulted

### Proposed Fix: Stripe Metadata as Authoritative Source

```typescript
// BEFORE executePayout() calls stripe.transfers.create()
const stripeAccount = await stripe.accounts.retrieve(payout.stripeAccountId!);

if (stripeAccount.metadata?.providerId !== payout.providerId) {
  throw new Error(
    `Payout security check failed: Stripe account ${payout.stripeAccountId} ` +
    `metadata.providerId=${stripeAccount.metadata?.providerId} does not match ` +
    `payout.providerId=${payout.providerId}. Possible account substitution detected.`
  );
}

// Only proceed if verification passes
const transfer = await stripe.transfers.create({ ... });
```

**This establishes the security invariant:**
> A payout can only be executed to a Stripe account whose `metadata.providerId` matches the `payout.providerId`.

**Why This Is Authoritative:**
1. ✅ Stripe account metadata is **write-protected** (only platform can modify)
2. ✅ Metadata set at account creation, never updated by application code
3. ✅ Database compromise cannot modify Stripe-side metadata
4. ✅ Runtime verification happens **before money movement**
5. ✅ Webhook path already enforces this binding (prevents reconnection)

---

## Remaining Questions

### Q1: Can Stripe account metadata be modified after creation?

**Answer:** Platform can call `stripe.accounts.update()` to change metadata, but:
- No code path in application does this (verified by grep)
- Webhook handler reads but never writes metadata
- Would require attacker to compromise Stripe API keys (catastrophic breach)

**Recommendation:** Add monitoring for unexpected `account.updated` events with metadata changes.

### Q2: What about account reconnection/replacement flows?

**Answer:** 
- Webhook handler **blocks** reconnection (throws error on mismatch)
- Onboarding route only creates new accounts if `stripeAccountId` is null
- No "replace account" functionality exists in codebase

**Conclusion:** No legitimate reconnection path exists. Mismatch = operational failure.

### Q3: Is the metadata binding truly immutable?

**Analysis:**
- Application code: ✅ Never modifies metadata (verified)
- Webhook handler: ✅ Never modifies metadata (only reads)
- Stripe platform: ⚠️ Theoretically mutable via API, but no code path does this

**Verdict:** **Functionally immutable** given current application architecture.

---

## Audit Conclusion

### Can We Call Stripe Metadata "Authoritative"?

**YES**, with these qualifications:

1. ✅ **Complete write-path audit:** Only 2 paths modify `stripeAccountId`, both verified
2. ✅ **Metadata binding established:** Set at account creation, never updated
3. ✅ **No reconnection paths:** Webhook blocks mismatches, no replace-account functionality
4. ✅ **Database cannot tamper:** Attacker with DB write cannot modify Stripe-side metadata
5. ⚠️ **Stripe API keys remain trust boundary:** Compromise of keys = catastrophic (out of scope)

**Recommendation:** Proceed with PAY-01-C test implementation using Stripe metadata verification as the security control.

---

## Next Steps (PAY-01-C)

Now that the authoritative binding is established:

1. **Extract verification helper:** `lib/services/payout-security.ts`
   ```typescript
   export async function verifyPayoutDestinationOwnership(
     stripe: Stripe,
     stripeAccountId: string,
     expectedProviderId: string
   ): Promise<{ valid: boolean; reason?: string }> { ... }
   ```

2. **Write unit tests:** Verify helper logic (matching/mismatched/missing providerId)

3. **Write service-level test:** Mock `stripe.accounts.retrieve()` and `stripe.transfers.create()`
   - **Critical assertion:** `expect(stripe.transfers.create).not.toHaveBeenCalled()` for tampered payouts

4. **Integrate into `executePayout()`:** Add verification before `stripe.transfers.create()`

5. **Verify tests pass:** Only then mark PAY-01-C closed

**Deliverable:** Executable evidence that money-moving call cannot occur when ownership verification fails.
