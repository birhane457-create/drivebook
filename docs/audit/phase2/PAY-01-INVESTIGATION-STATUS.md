# PAY-01: Payout Destination Ownership - Investigation Status

**Date:** 2026-09-16  
**Finding:** Database compromise enables payout redirection  
**Status:** Code-level vulnerability established; tests required before fix implementation

## Current Status

| Item | Status | Evidence |
|------|--------|----------|
| Vulnerable code path identified | ✅ Complete | `payout-service.ts` line 377 |
| Attack condition demonstrated | ✅ Complete | Code inspection shows no verification |
| Authoritative binding established | ✅ Complete | PAY-01-STRIPE-RELATIONSHIP-AUDIT.md |
| Write-path audit | ✅ Complete | PAY-01-A (no API vulnerability) |
| Invariant establishment | ⚠️ Partial | PAY-01-B (GitHub-verified, runtime unverified) |
| Executable reproduction test | ❌ Blocked | Module mocking complexity |
| Unit test for verification logic | ❌ Required | Must extract helper first |
| Service-level regression test | ❌ Required | Must create with clean mocks |
| Proposed fix verified | ❌ Not yet | Awaiting test completion |
| Severity justification | ⚠️ Draft | Needs trust boundary analysis |

## Documentation Artifacts

### ✅ Completed
1. **PAY-01-A-WRITE-PATH-AUDIT.md** - No API-level vulnerability, database write is attack vector
2. **PAY-01-B-INVARIANT-ESTABLISHMENT.md** - Metadata binding verified in GitHub
3. **PAY-01-STRIPE-RELATIONSHIP-AUDIT.md** - Authoritative binding established
4. **PAY-01-C-REPRODUCTION-TEST.md** - Current status, test strategy, next steps

### 📁 Test Artifacts
1. **lib/services/__tests__/pay-01-FAILED-module-mocking-attempt.test.ts.skip** - Preserved failed test attempt

## Vulnerability Summary

### Vulnerable Code
**File:** `lib/services/payout-service.ts`  
**Lines:** 373-388

```typescript
const transfer = await stripe.transfers.create(
  {
    amount: Math.round(toNumber(toDecimal(payout.netAmount)) * 100),
    currency: 'aud',
    destination: payout.stripeAccountId!,  // ← NO OWNERSHIP VERIFICATION
    // ...
  }
);
```

### Security Gap

**What's missing:**
```typescript
// BEFORE transferring funds, should verify:
const account = await stripe.accounts.retrieve(payout.stripeAccountId!);
if (account.metadata?.providerId !== payout.providerId) {
  throw new Error('Ownership verification failed');
}
```

### Why This Matters

**Authoritative binding (Stripe-side):**
```
Stripe Account.metadata.providerId = "provider-A"  ← Set at creation, immutable
```

**Database binding (DriveBook-side):**
```
Payout.providerId = "provider-A"
Payout.stripeAccountId = "acct_A"  ← MUTABLE by database attacker
```

**Attack:**
```sql
-- Attacker modifies stripeAccountId
UPDATE Payout SET stripeAccountId = 'acct_attacker' WHERE providerId = 'provider-A';
```

**Result without fix:**
- Money transferred to `acct_attacker`
- Transfer metadata says `providerId: provider-A` (but money already gone)

**Result with fix:**
- Retrieve `acct_attacker` from Stripe
- Check: `metadata.providerId` ("provider-attacker") ≠ `payout.providerId` ("provider-A")
- Reject payout BEFORE calling `stripe.transfers.create()`

## Next Steps (In Order)

### Step 1: Extract Verification Helper
Create `lib/services/payout-security.ts`:
```typescript
export async function verifyPayoutDestinationOwnership(
  payoutProviderId: string,
  stripeAccountId: string
): Promise<void> {
  const account = await stripe.accounts.retrieve(stripeAccountId);
  const metadataProviderId = account.metadata?.providerId;
  
  if (metadataProviderId !== payoutProviderId) {
    throw new PayoutSecurityError(
      `Payout destination ownership verification failed: ` +
      `expected providerId=${payoutProviderId}, ` +
      `found providerId=${metadataProviderId || 'missing'}`
    );
  }
}
```

### Step 2: Unit Test Verification Logic
Create `lib/services/__tests__/payout-security.test.ts`:
```typescript
describe('verifyPayoutDestinationOwnership', () => {
  it('succeeds when providerId matches', async () => { ... });
  it('throws when providerId mismatches', async () => { ... });
  it('throws when metadata.providerId is missing', async () => { ... });
  it('throws when Stripe account retrieval fails', async () => { ... });
});
```

### Step 3: Service-Level Test
Create `lib/services/__tests__/payout-execution-security.test.ts`:
```typescript
describe('executePayout() security', () => {
  it('CRITICAL: rejects tampered payout before stripe.transfers.create()', async () => {
    // Mock: Payout has providerId=A, stripeAccountId=B
    // Mock: Stripe account B has metadata.providerId=B (mismatch)
    // Assert: stripe.transfers.create() NEVER called
    // Assert: Payout marked FAILED
  });
  
  it('allows legitimate payout with matching ownership', async () => {
    // Mock: Payout has providerId=A, stripeAccountId=A
    // Mock: Stripe account A has metadata.providerId=A (match)
    // Assert: stripe.transfers.create() WAS called
    // Assert: Payout marked PAID
  });
});
```

### Step 4: Implement Fix (PAY-01-D)
Only after tests exist:
1. Add `verifyPayoutDestinationOwnership()` call before `stripe.transfers.create()`
2. Run tests to verify fix works
3. Ensure no legitimate payouts are broken

### Step 5: Production Verification (PAY-01-E)
1. Deploy to staging
2. Manual test with tampered database record
3. Verify monitoring/alerting triggers correctly
4. Document residual risk

## Severity Assessment (Draft)

**Preliminary:** HIGH (not CRITICAL)

**Rationale:**
- **Barrier:** Requires database write access (SQL injection, credential compromise, privilege escalation)
- **Impact:** Complete payout redirection for compromised provider records
- **Scope:** Affects only providers whose Payout records are tampered
- **Detection:** Delayed (depends on instructor monitoring)
- **Financial:** Platform liable for legitimate payouts (double payment risk)

**NOT CRITICAL because:**
- Requires serious security breach (database write access)
- NOT exploitable via ordinary API requests
- NOT remote code execution
- Defense-in-depth layer, not primary security control

**Needs review:**
- What database access level enables this attack?
- Are there other detective/preventive controls?
- What is realistic post-compromise attacker capability?

## Audit Principles Applied

### ✅ Following rigor standard from SUB-22/SUB-12-A
1. Code inspection to identify vulnerability
2. Establish security invariant
3. Create reproduction test BEFORE fix
4. Implement fix
5. Verify fix with tests
6. Production verification

### ✅ Preserved failed test evidence
- Not hiding test infrastructure problems
- Demonstrates learning/iteration process
- Maintains audit trail integrity

### ✅ No premature fix implementation
- NOT proceeding to PAY-01-D without tests
- Establishing authoritative relationships first
- Following "test → fix → verify" sequence

## References

- **Vulnerable code:** `lib/services/payout-service.ts`, lines 373-388
- **Onboarding code:** `app/api/instructor/stripe-connect/onboard/route.ts`, lines 52-64
- **PAY-01-A:** Write-path audit
- **PAY-01-B:** Invariant establishment
- **PAY-01-C:** This status document
- **PAY-01 Stripe Relationship:** Complete authoritative binding analysis

---

**Last Updated:** 2026-09-16  
**Next Review:** After Step 1 (verification helper extraction) complete
