# Phase 2: DIRECT Payment Mode Implementation Guide

**Status:** Planning / Not Yet Implemented  
**Priority:** Future Enhancement  
**Estimated Effort:** Medium-Large (2-3 weeks)

---

## Overview

Currently, DriveBook uses **PLATFORM payment mode**:
- Client → DriveBook Stripe → Provider Payout
- Platform takes commission (10-15% depending on tier)
- All payments centralized

Phase 2 will add **DIRECT payment mode**:
- Client → Provider's Stripe Connect → Provider keeps 100%
- 0% commission (key PREMIUM tier selling point)
- Providers manage their own Stripe accounts

---

## Prerequisites Completed ✅

### 1. Payment Customer Validation (Security)
**Location:** \pp/api/stripe/webhook/route.ts\ line ~975

The webhook handler already contains the security validation needed for DIRECT mode:
- Commented out but ready to enable
- Validates \paymentIntent.customer\ matches \provider.stripeCustomerId\
- Prevents payment routing attacks
- Simply remove \/* */\ wrapper when Phase 2 launches

### 2. Database Schema
**Status:** Already supports both modes

\\\prisma
model Provider {
  paymentMode String @default("PLATFORM") // "PLATFORM" | "DIRECT"
  stripeCustomerId String?
  stripeAccountId String?
  // ...
}
\\\

### 3. Utility Functions
**Location:** \lib/utils/account.ts\

\\\	ypescript
export function assertPlatformPaymentMode(provider: Provider): void {
  if (provider.paymentMode === 'DIRECT') {
    throw new Error('Direct payment mode not yet implemented');
  }
}
\\\

Currently throws error for DIRECT mode. Update this when implementing.

---

## Implementation Checklist

### Phase 2A: Stripe Connect Setup (Week 1)

#### 1. Stripe Connect Onboarding Flow
- [ ] Create \/api/stripe/connect/onboard\ endpoint
- [ ] Generate Stripe Connect account for provider
- [ ] Handle \ccount.updated\ webhooks
- [ ] Store \stripeAccountId\ in Provider table
- [ ] Create dashboard page: \/dashboard/stripe-connect\
- [ ] Add "Connect Stripe" button for PREMIUM tier providers

#### 2. Account Verification
- [ ] Handle Stripe Connect verification requirements
- [ ] Display verification status in dashboard
- [ ] Email notifications for verification steps
- [ ] Handle account restrictions and errors

#### 3. Testing
- [ ] Test in Stripe test mode
- [ ] Verify account creation flow
- [ ] Test verification requirements
- [ ] Test error scenarios

---

### Phase 2B: Payment Routing (Week 2)

#### 1. Update Checkout Flow
**Files to modify:**
- \pp/api/stripe/create-checkout-session/route.ts\
- \pp/api/payment-intent/route.ts\

**Changes needed:**
\\\	ypescript
// Check provider's payment mode
if (provider.paymentMode === 'DIRECT') {
  if (!provider.stripeAccountId) {
    throw new Error('Provider has not connected Stripe account');
  }
  
  // Create checkout on provider's Stripe Connect account
  const session = await stripe.checkout.sessions.create({
    // ... existing params
  }, {
    stripeAccount: provider.stripeAccountId, // Route to Connect account
  });
} else {
  // PLATFORM mode (existing flow)
  const session = await stripe.checkout.sessions.create({
    // ... existing params (no stripeAccount)
  });
}
\\\

#### 2. Update Webhook Handler
**File:** \pp/api/stripe/webhook/route.ts\

**Enable customer validation (line ~975):**
\\\	ypescript
// Remove /* */ wrapper:
if (booking.provider && booking.provider.paymentMode === 'DIRECT') {
  if (paymentIntent.customer && booking.provider.stripeCustomerId) {
    if (booking.provider.stripeCustomerId !== paymentIntent.customer) {
      throw new Error('Payment customer mismatch');
    }
  }
}
\\\

**Update commission logic:**
\\\	ypescript
// DIRECT mode = 0% commission
const commissionRate = provider.paymentMode === 'DIRECT' 
  ? 0 
  : getCommissionRate(provider.subscriptionTier);
\\\

#### 3. Update Payout Logic
**File:** \lib/services/payouts.ts\

**Changes needed:**
- PLATFORM mode: Create platform-initiated payouts (existing)
- DIRECT mode: Payments already in provider's account (skip platform payout)

\\\	ypescript
if (provider.paymentMode === 'DIRECT') {
  // Payment already in provider's Stripe account
  // Just update internal records, no payout needed
  await updateProviderEarnings(providerId, amount);
} else {
  // PLATFORM mode: Create Stripe transfer
  await createProviderPayout(providerId, amount);
}
\\\

#### 4. Testing
- [ ] Test PLATFORM mode still works (regression)
- [ ] Test DIRECT mode payment routing
- [ ] Test commission calculation (0% vs percentage)
- [ ] Test customer validation
- [ ] Test both modes with packages
- [ ] Test both modes with wallets

---

### Phase 2C: Dashboard & UX (Week 3)

#### 1. Provider Dashboard Updates
- [ ] Show payment mode badge (PLATFORM / DIRECT)
- [ ] Display Stripe Connect status
- [ ] Show commission rate (0% for DIRECT, X% for PLATFORM)
- [ ] Add "Connect Stripe" CTA for PREMIUM users

#### 2. Earnings Display
- [ ] Update earnings page to show mode-specific data
- [ ] PLATFORM: Show gross, commission, net
- [ ] DIRECT: Show gross only (no commission)
- [ ] Historical earnings by mode

#### 3. Admin Dashboard
- [ ] Show payment mode per provider
- [ ] Filter bookings by payment mode
- [ ] Revenue reports separated by mode
- [ ] Commission reports (PLATFORM only)

#### 4. Documentation
- [ ] Update DOCROLEBASE docs
- [ ] Provider onboarding guide for DIRECT mode
- [ ] FAQ: PLATFORM vs DIRECT
- [ ] Migration guide (PLATFORM → DIRECT)

---

## Security Considerations

### 1. Payment Customer Validation ✅
**Status:** Already implemented (commented out)
- Prevents routing attacks
- Validates customer IDs match
- Ready to enable

### 2. Stripe Connect Security
- [ ] Validate Connect account ownership
- [ ] Prevent account takeover attacks
- [ ] Monitor for suspicious Connect activity
- [ ] Rate limit Connect API calls

### 3. Commission Bypass Prevention
- [ ] Audit all commission calculation code
- [ ] Prevent manual paymentMode changes without verification
- [ ] Log all payment mode changes
- [ ] Admin approval for DIRECT mode enrollment?

### 4. Payout Security
- [ ] Verify Connect account before enabling DIRECT
- [ ] Validate bank account ownership
- [ ] Monitor for fraudulent accounts

---

## Testing Strategy

### Unit Tests
- [ ] Payment routing logic
- [ ] Commission calculation (0% vs percentage)
- [ ] Customer validation
- [ ] Mode switching

### Integration Tests
- [ ] Full checkout flow (both modes)
- [ ] Webhook processing (both modes)
- [ ] Payout generation (both modes)
- [ ] Refund handling (both modes)

### Manual Testing
- [ ] PREMIUM provider connects Stripe
- [ ] PREMIUM provider receives DIRECT payment
- [ ] Client books lesson (DIRECT mode)
- [ ] Client cancels/refunds (DIRECT mode)
- [ ] Switch provider PLATFORM → DIRECT
- [ ] Verify commission = 0% for DIRECT

---

## Rollout Plan

### Stage 1: Beta (PREMIUM only, invite-only)
1. Select 3-5 PREMIUM providers
2. Enable DIRECT mode manually
3. Monitor for 2 weeks
4. Fix any issues

### Stage 2: PREMIUM Tier (Opt-in)
1. Add "Connect Stripe" button to dashboard
2. Email announcement to PREMIUM users
3. Self-service enrollment
4. Monitor for 1 month

### Stage 3: General Availability
1. Open to all PREMIUM tier users
2. Marketing push (0% commission)
3. Track adoption rate
4. Gather feedback

---

## Monitoring & Alerts

### Key Metrics
- DIRECT mode adoption rate
- Payment success rate by mode
- Average transaction value by mode
- Commission revenue impact
- Connect account verification rate

### Alerts
- Payment customer mismatch detected
- Connect account verification failed
- DIRECT payment routing error
- Commission calculation anomaly

---

## Rollback Plan

If critical issues arise:

1. **Immediate:** Set \ssertPlatformPaymentMode\ back to throwing for DIRECT
2. **Short-term:** Migrate affected providers back to PLATFORM mode
3. **Long-term:** Fix issues, re-test, re-launch

---

## Resources

- **Stripe Connect Docs:** https://stripe.com/docs/connect
- **Stripe Connect Onboarding:** https://stripe.com/docs/connect/onboarding
- **Stripe Accounts API:** https://stripe.com/docs/api/accounts
- **Platform Model:** \.kiro/steering/platform-model.md\
- **Webhook Security:** \docs/WEBHOOK_SECURITY_FIXES_COMPLETE.md\

---

**Created:** 2026-09-11  
**Status:** Planning  
**Next Action:** Schedule Phase 2 kickoff meeting
