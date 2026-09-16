# PAY-01-C: Reproduction and Regression Test

**Status:** ✅ CLOSED  
**Finding:** Reproduction and regression test established; vulnerable path demonstrated and protected by verified Stripe-side destination ownership check.

---

## What Was Done

### Phase A — Vulnerability Established (Code Audit)

`executePayout()` called `stripe.transfers.create()` with `destination: payout.stripeAccountId` with no prior verification that the account ID belongs to the provider being paid. An attacker with database write access could substitute their own Stripe account ID in the `Payout` record and receive the transfer.

Vulnerable line (`lib/services/payout-service.ts`, pre-fix):
```typescript
destination: payout.stripeAccountId!,   // ← no ownership check
```

### Phase B — Authoritative Binding Established

Audited all `Provider.stripeAccountId` write paths (see `PAY-01-STRIPEACCOUNTID-UPDATE-PATH-AUDIT.md`).  
Conclusion: Stripe account `metadata.providerId` is **authoritative for this application threat model**:

- Set once at account creation, never updated by application code
- Webhook handler enforces immutability (throws on mismatch, never overwrites)
- Database compromise cannot tamper with Stripe-side metadata
- Only Stripe API key compromise could alter it (out of this threat model's scope)

### Phase C — Security Control Implemented

**New module:** `lib/services/payout-security.ts`  
**Function:** `verifyPayoutDestinationOwnership(stripe, stripeAccountId, expectedProviderId)`

Behaviour:
- Retrieves Stripe account from Stripe (authoritative source)
- Fails closed if account missing, metadata absent, or `metadata.providerId !== expectedProviderId`
- Returns `{ valid, reason, stripeAccountId, expectedProviderId, actualProviderId }`

Integrated into `executePayout()` immediately before `stripe.transfers.create()`:
```typescript
// PAY-01 SECURITY: Verify destination ownership before money movement
const { verifyPayoutDestinationOwnership } = await import('./payout-security');
const ownershipCheck = await verifyPayoutDestinationOwnership(
  stripe,
  payout.stripeAccountId!,
  payout.providerId
);

if (!ownershipCheck.valid) {
  throw new Error(
    `Payout destination ownership verification failed: ${ownershipCheck.reason}. ...`
  );
}

// TOCTOU Protection: captured here, used below — no second DB read
const verifiedAccountId = payout.stripeAccountId!;

const transfer = await stripe.transfers.create({
  ...
  destination: verifiedAccountId,   // ← same value we just verified
  ...
});
```

**TOCTOU protection:** The `stripeAccountId` is captured in a `const` immediately after the ownership check passes. The transfer `destination` uses that captured value — not a second database read — eliminating any time-of-check/time-of-use window.

---

## Test Results

### Unit tests — `lib/services/__tests__/payout-security.test.ts`

✅ 7/7 passing

| Test | Result |
|---|---|
| Passes when `metadata.providerId` matches | ✅ |
| Fails on `metadata.providerId` mismatch | ✅ |
| Fails closed when `metadata.providerId` missing | ✅ |
| Fails closed when `metadata` object absent | ✅ |
| Fails closed when Stripe account not found | ✅ |
| Fails closed on Stripe API error | ✅ |
| Requires exact string match (no coercion) | ✅ |

### Service-level tests — `lib/services/__tests__/pay-01-executePayout-security.test.ts`

✅ 5/5 passing

| Test | Critical assertion | Result |
|---|---|---|
| Account substitution attack | `mockTransfersCreate` not called | ✅ |
| Missing `metadata.providerId` | `mockTransfersCreate` not called | ✅ |
| Stripe API error during verification | `mockTransfersCreate` not called | ✅ |
| Legitimate payout | `mockTransfersCreate` called once, destination correct | ✅ |
| TOCTOU: verified ID === transfer destination | `checkedAccount === transferDest` | ✅ |

Combined: **12/12 tests passing, exit code 0.**

---

## Security Invariant

> A payout can only be executed to a Stripe account whose `metadata.providerId` (authoritative for this application threat model) exactly equals `payout.providerId`. Any mismatch, missing metadata, or Stripe lookup error blocks the transfer.

---

## Audit Trail

| File | Purpose |
|---|---|
| `lib/services/payout-security.ts` | Security helper (production) |
| `lib/services/__tests__/payout-security.test.ts` | Unit tests for helper |
| `lib/services/__tests__/pay-01-executePayout-security.test.ts` | Service-level tests |
| `lib/services/__tests__/pay-01-FAILED-module-mocking-attempt.test.ts.skip` | Preserved: earlier mocking failure audit evidence |
| `PAY-01-STRIPEACCOUNTID-UPDATE-PATH-AUDIT.md` | Complete write-path audit |
| `PAY-01-STRIPE-RELATIONSHIP-AUDIT.md` | Metadata binding analysis |

---

## Next Step

**PAY-01-D:** Production verification — confirm the fix is correct under load, no idempotency regressions, and alert path fires correctly on ownership failure.
