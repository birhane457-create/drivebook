# PAY-01: Stripe Connect Account → Provider Authoritative Binding

**Date:** 2026-09-16  
**Purpose:** Establish the authoritative relationship between DriveBook Providers and Stripe Connect accounts  
**Required for:** PAY-01-C test design and PAY-01-D fix implementation

## Authoritative Binding Established

### Account Creation (onboard/route.ts, lines 52-64)

```typescript
const account = await stripe.accounts.create({
  type: 'express',
  country: 'AU',
  email: instructor.user?.email,
  capabilities: {
    transfers: { requested: true },
  },
  business_type: 'individual',
  metadata: {
    providerId: instructor.id,           // ← AUTHORITATIVE BINDING
    instructorName: instructor.name,
  },
});
stripeAccountId = account.id;

await prisma.provider.update({
  where: { id: instructor.id },
  data: { stripeAccountId },             // ← Database record points to Stripe account
});
```

### Key Properties

**1. Stripe Account object stores `metadata.providerId`:**
- Stored on Stripe's servers, not in DriveBook database
- Set once during account creation
- Cannot be modified through DriveBook application code (GitHub-verified in PAY-01-A)
- Can only be modified through Stripe Dashboard or API with platform credentials

**2. Database record stores `Provider.stripeAccountId`:**
- Points to the Stripe account ID
- Mutable (can be changed by database write access)
- NOT authoritative for ownership verification

**3. The authoritative binding is:**
```
DriveBook Provider.id
         ↓
Stripe Account.metadata.providerId
```

**4. The database binding is:**
```
DriveBook Provider.id
         ↓
DriveBook Provider.stripeAccountId  ← MUTABLE, not authoritative
         ↓
Stripe Account.id
```

### Security Invariant

**Before transferring funds, verify:**
```typescript
const stripeAccount = await stripe.accounts.retrieve(payout.stripeAccountId);
const metadataProviderId = stripeAccount.metadata?.providerId;

if (metadataProviderId !== payout.providerId) {
  // SECURITY VIOLATION: Database says this payout belongs to Provider A,
  // but Stripe account's authoritative metadata says it belongs to Provider B
  throw new Error('Payout destination ownership verification failed');
}
```

**Why this works:**
- Stripe account metadata is independent of DriveBook database
- Attacker with database write access can modify `Provider.stripeAccountId`
- Attacker CANNOT modify `Stripe Account.metadata.providerId` (requires Stripe platform credentials)
- Therefore: mismatch detection proves database tampering

## Verification Points

### ✅ Metadata is set during account creation
**File:** `app/api/instructor/stripe-connect/onboard/route.ts`  
**Lines:** 56-59  
**Code:** `metadata: { providerId: instructor.id, instructorName: instructor.name }`

### ✅ No code path modifies metadata after creation
**Verified:** PAY-01-A write-path audit  
**Result:** No calls to `stripe.accounts.update()` with metadata changes found in codebase

### ✅ Database field is mutable
**Schema:** `Provider.stripeAccountId String?`  
**Vulnerability:** Can be modified by SQL injection or database compromise

### ✅ Payout execution uses database field without verification
**File:** `lib/services/payout-service.ts`  
**Line 377:** `destination: payout.stripeAccountId!`  
**Problem:** No call to `stripe.accounts.retrieve()` before transfer

## Attack Scenario With Authoritative Binding

**Step 1: Legitimate state**
```
Provider A
  .id = "provider-alice"
  .stripeAccountId = "acct_alice"

Stripe Account acct_alice
  .metadata.providerId = "provider-alice"  ← Authoritative
```

**Step 2: Attacker gains database write access**
```sql
-- Attacker modifies Provider A's stripeAccountId
UPDATE Provider 
SET stripeAccountId = 'acct_attacker'
WHERE id = 'provider-alice';
```

**Step 3: Tampered state**
```
Provider A
  .id = "provider-alice"
  .stripeAccountId = "acct_attacker"  ← MODIFIED

Stripe Account acct_attacker
  .metadata.providerId = "provider-attacker"  ← Still attacker's, unchanged

Stripe Account acct_alice
  .metadata.providerId = "provider-alice"  ← Alice's account still correct
```

**Step 4: Payout execution (BEFORE FIX)**
```typescript
// Current code (VULNERABLE):
await stripe.transfers.create({
  destination: payout.stripeAccountId!,  // Uses "acct_attacker" from tampered DB
  // Money goes to attacker
});
```

**Step 5: Payout execution (AFTER FIX)**
```typescript
// Fixed code:
const account = await stripe.accounts.retrieve(payout.stripeAccountId!);
// Retrieves acct_attacker from Stripe

if (account.metadata?.providerId !== payout.providerId) {
  // "provider-attacker" !== "provider-alice"  ← MISMATCH DETECTED
  throw new Error('Ownership verification failed');
}
// Transfer NEVER called
```

## Test Requirements for PAY-01-C

Based on this authoritative relationship, PAY-01-C must prove:

### 1. Unit Test: Ownership Verification Logic

Test the extracted verification function:
```typescript
verifyPayoutDestinationOwnership(
  payoutProviderId: string,
  stripeAccount: Stripe.Account
): void

Test cases:
- ✓ Matching providerId → success
- ✓ Mismatched providerId → throws error
- ✓ Missing metadata.providerId → throws error
- ✓ Null/undefined stripeAccount → throws error
```

### 2. Service Test: executePayout() Integration

Mock Prisma and Stripe at module boundaries:
```typescript
Test: Tampered payout (providerId A, stripeAccountId B)
  → executePayout() called
  → stripe.accounts.retrieve('acct_B') called
  → Returns account with metadata.providerId = 'provider-B'
  → Verification detects mismatch (A !== B)
  → Payout marked FAILED
  → stripe.transfers.create() NEVER called  ← CRITICAL ASSERTION

Test: Legitimate payout (providerId A, stripeAccountId A)
  → executePayout() called
  → stripe.accounts.retrieve('acct_A') called
  → Returns account with metadata.providerId = 'provider-A'
  → Verification passes (A === A)
  → stripe.transfers.create() IS called with correct destination
```

## Cryptographic/Authoritative Properties

**Q: Is the Stripe account metadata cryptographically bound?**  
A: No, but it is **authoritatively bound** - it's stored on Stripe's servers with platform-level access control.

**Q: Can an attacker with database access modify the metadata?**  
A: No. The attacker would need:
- Stripe platform secret key (separate credential)
- Or Stripe Dashboard access (separate authentication)

**Q: What if both credentials are compromised?**  
A: Then the attacker can modify both the database and Stripe metadata, defeating this control. However:
- This is a deeper breach (multiple credential compromise)
- The fix still provides defense-in-depth against database-only compromise
- Additional controls (2FA on Stripe, API key rotation, audit logs) protect the Stripe credential

## Conclusion

The authoritative binding is:
```
Stripe Account.metadata.providerId  ← Independent authority, platform-controlled
```

NOT:
```
Provider.stripeAccountId  ← Database field, attacker-modifiable
```

The security fix must retrieve the Stripe Account object and verify its metadata matches the payout's providerId before calling `stripe.transfers.create()`.

**Next steps:**
1. Extract verification logic into production helper
2. Write unit tests for verification helper
3. Write service-level test for executePayout() with mocked boundaries
4. Verify critical assertion: `stripe.transfers.create()` not called for tampered payouts
