# Stripe Connect Setup & Configuration

**Status:** ⚠️ MANUAL SETUP REQUIRED  
**Last Updated:** June 11, 2026  
**Category:** Payments → Stripe Integration → Connect

---

## Overview

Stripe Connect allows your platform to facilitate payments between students and instructors. Without Connect, instructors cannot receive payouts to their bank accounts.

**What you need:** A Stripe account with Connect enabled (not just basic payments)

---

## Setup Steps

### 1. Access Stripe Dashboard
Visit: https://dashboard.stripe.com

**Ensure you're logged into the correct Stripe account** (the one with your test API keys)

### 2. Enable Stripe Connect

1. Click **"Connect"** in the left sidebar
2. Click **"Sign up for Connect"** button
3. Answer the onboarding questions:
   - **Platform name:** "Drivebook" (or your platform name)
   - **What will you use Connect for:** Select "Pay other people" / "Marketplace or platform" / "Creator payments"
   - **Primary use case:** "Instructor or seller payouts"
   - **How will instructors make money:** "Fees collected from their students"

### 3. Complete Bank Account Registration

Stripe will ask for:
- Your bank account details (where platform fees are deposited)
- Business information
- Address verification

**Note:** In test mode, this is usually instant. In production, may take 1-5 business days.

### 4. Verify Connect is Active

Go to: https://dashboard.stripe.com/account/capabilities

Look for **"Transfers"** capability — should show **"Active"** ✅

If not active yet:
- Refresh the page (sometimes takes a minute)
- Check email for any verification requests
- Contact Stripe support if still not showing

---

## How It Works

### Instructor Payout Flow

```
1. Student books lesson with instructor
   ├─ Pays via platform (e.g., $100)
   └─ Payment processed through Stripe

2. Platform collects commission (e.g., $12 for Basic tier)
   ├─ Deposited into your bank account
   └─ Via automatic ACH/EFT transfer

3. Instructor receives payout (e.g., $88)
   ├─ Automatically transferred to their bank
   ├─ Via Stripe Connect automatic transfer
   └─ Usually weekly or per your payout schedule
```

### Key API Calls

**Creating instructor account:**
```typescript
// File: app/api/instructor/stripe-connect/onboard/route.ts
const account = await stripe.accounts.create({
  type: 'express',           // Express account (hosted onboarding)
  country: 'AU',
  email: instructor.email,
  capabilities: {
    transfers: { requested: true }  // ← Requires Connect enabled
  },
  business_type: 'individual',
});
```

**Generating onboarding link:**
```typescript
const accountLink = await stripe.accountLinks.create({
  account: stripeAccountId,
  refresh_url: 'https://yoursite/dashboard/settings/payout?stripe=refresh',
  return_url: 'https://yoursite/dashboard/settings/payout?stripe=success',
  type: 'account_onboarding',
});
// Redirect user to accountLink.url
```

---

## Test Mode vs Production

### Test Mode (Current)
- API keys start with: `test` (e.g., `sk_test_...`)
- No real money transfers
- Instant Connect setup
- Use test bank account details: `4111 1111 1111 1111`
- Useful for development and testing

### Production Mode
- API keys start with: `live` (e.g., `sk_live_...`)
- Real money transfers
- Full Stripe verification required (1-5 days)
- Requires real bank account
- Complete tax documentation

**Switching to Production:**
- Create live Stripe account (or convert test account)
- Complete Connect setup for live account
- Update `.env` with live API keys
- Deploy with new keys
- Monitor transfers and reconciliation

---

## Troubleshooting

### Error: "You can only create new accounts if you've signed up for Connect"

**Cause:** Stripe Connect not enabled on your account

**Fix:**
1. Go to https://dashboard.stripe.com/connect
2. Click "Sign up for Connect"
3. Complete onboarding (usually 5-15 minutes)
4. Verify "Transfers" capability is "Active" at https://dashboard.stripe.com/account/capabilities
5. Restart dev server: `npm run dev`
6. Try again at `/dashboard/settings/payout`

### Error: "Invalid account"

**Cause:** Stripe account ID was corrupted or deleted

**Fix:**
1. Clear instructor's `stripeAccountId` in database:
   ```sql
   UPDATE instructors SET stripeAccountId = NULL WHERE id = 'instructor-id';
   ```
2. Have instructor try onboarding again
3. A new account will be created

### Transfers not working after instructor completes onboarding

**Check:**
1. Verify instructor's Stripe account status at https://dashboard.stripe.com/connect/accounts
2. Look for any incomplete verification (red warnings)
3. Have instructor complete any missing steps
4. Verify your account's "Transfers" capability is still "Active"

### Can't find Stripe Connect in dashboard

**If you don't see "Connect" in sidebar:**
1. Ensure you're at https://dashboard.stripe.com (not test.stripe.com)
2. Ensure you're logged in to correct account
3. Try clearing browser cache and refreshing
4. Contact Stripe support

---

## Security Notes

### What the Platform Never Sees
- ✅ Student credit card details (handled by Stripe)
- ✅ Instructor bank account details (handled by Stripe)
- ✅ Payment method tokens (handled by Stripe)

### What the Platform Controls
- ✅ Commission rates per tier
- ✅ When payouts are triggered
- ✅ Payout schedule (weekly, monthly, etc.)
- ✅ Dispute and chargeback handling

### Compliance
- ✅ Stripe handles PCI compliance
- ✅ Platform is not a money transmitter (Stripe is)
- ✅ All transfers are transparent to both parties
- ✅ Receipts and records maintained automatically

---

## Related Files & Documentation

**Code:**
- `app/api/instructor/stripe-connect/onboard/route.ts` — Creates instructor account
- `app/api/instructor/stripe-connect/refresh/route.ts` — Allows re-onboarding
- `app/api/payments/webhook/route.ts` — Handles payment events

**Configuration:**
- `.env` — Stripe API keys (see `.env.example`)
- `prisma/schema.prisma` — Instructor.stripeAccountId field

**Documentation:**
- `STRIPE_INTEGRATION.md` — Overall Stripe setup
- `PAYOUTS.md` — Payout mechanics and schedules
- `IMMEDIATE_ACTION_REQUIRED.md` — Quick action checklist

**Stripe Docs:**
- https://stripe.com/docs/connect — Official Connect documentation
- https://stripe.com/docs/connect/onboarding — Onboarding documentation
- https://stripe.com/docs/connect/payouts — Payout documentation

---

## Checklist: After Connect is Enabled

- [ ] Visited https://dashboard.stripe.com/connect
- [ ] Clicked "Sign up for Connect"
- [ ] Selected "Pay other people" use case
- [ ] Completed bank account verification
- [ ] Verified "Transfers" at https://dashboard.stripe.com/account/capabilities
- [ ] Restarted dev server: `npm run dev`
- [ ] Tested at http://localhost:3000/dashboard/settings/payout
- [ ] Clicked "Connect Stripe Account" (should redirect to Stripe)
- [ ] Verified no more 500 errors
- [ ] Ready to test full payment flows

---

## Instructor Experience: Connecting to Stripe

### Where Instructors Connect

**URL:** `/dashboard/settings/payout`

**Steps for Instructors:**

1. **Log in to their dashboard**
   - Go to `/dashboard`
   - Click "Settings" → "Payout & Tax Settings"

2. **Select Payout Method**
   - Options: Stripe Connect (recommended), Bank Transfer, Manual
   - **Stripe Connect is recommended** — automatic payouts, secure, no manual processing

3. **For Stripe Connect:**
   - If no Stripe account yet: Click **"Connect with Stripe →"** button
   - This redirects to Stripe's secure hosted page
   - **Instructor enters:**
     - Email address
     - Business type (individual or company)
     - Bank account details
     - Identity verification (ID, address)
   - Stripe handles all verification — DriveBook never sees bank details

4. **Return from Stripe**
   - After completing Stripe setup:
     - If successful: `?stripe=success` → shows "Stripe account ready"
     - If cancelled: `?stripe=refresh` → shows "Try again" message

5. **Track Status in UI**
   - **Not started:** Green button "Connect with Stripe →"
   - **In progress:** Shows checklist:
     - ✅ Account created
     - ⏳ Identity verified (charges enabled)
     - ⏳ Bank account linked (payouts enabled)
   - **Complete:** Green badge "Automatic payouts active"

6. **Optional: Add Tax Details**
   - **ABN (Australian Business Number):**
     - Reduces withholding tax from 47% to 0%
     - Auto-verifies against Australian Business Register
     - If no ABN: 47% withholding applies
   - **GST Registration:**
     - Toggle if registered
     - Noted in system but doesn't affect withholding until ABN verified

### Code Flow Behind the Scenes

**When instructor clicks "Connect with Stripe →":**

```
1. Client calls: POST /api/instructor/stripe-connect/onboard
   ↓
2. Server (route.ts):
   - Checks if instructor is APPROVED (404 if not)
   - Creates Stripe Express Account
   - Generates Stripe Account Link (hosted onboarding)
   - Returns URL to redirect to
   ↓
3. Instructor redirected to Stripe hosted page
   ↓
4. Instructor completes onboarding on Stripe domain
   ↓
5. Stripe redirects back with return_url or refresh_url
   - Success: /dashboard/settings/payout?stripe=success
   - Cancelled: /dashboard/settings/payout?stripe=refresh
   ↓
6. Frontend fetches payout settings
   - Checks stripeAccountId, chargesEnabled, payoutsEnabled
   - Shows appropriate status message
```

**Files involved:**
- `app/api/instructor/stripe-connect/onboard/route.ts` — Creates account
- `app/api/instructor/stripe-connect/refresh/route.ts` — Allows re-attempt
- `app/dashboard/settings/payout/page.tsx` — Instructor UI

### What Happens After Connection

**Automatic Payouts:**
- DriveBook transfers instructor earnings every **Tuesday at 2:00 AM**
- Requirements: Lesson completed ≥ 48 hours before payout run
- Amount = Booking price × (1 - commission rate)
- Examples:
  - $100 booking, Basic tier (12% commission) → Instructor gets $88
  - $100 booking, Premium tier (18% commission) → Instructor gets $82

**Instructor Visibility:**
- Can see payout status in their dashboard earnings section
- Can view past transfers in Stripe Connect portal
- Can check their bank account for deposits

### Troubleshooting for Instructors

**"Connect with Stripe" button does nothing or shows 500 error:**
- **Cause:** Stripe Connect not enabled on account (this is the platform issue, not instructor's fault)
- **Fix:** Admin needs to enable Stripe Connect in Stripe Dashboard first

**"Your account is not ready for payouts":**
- **Cause:** Stripe identity or bank verification incomplete
- **Fix:** Click "Continue Stripe setup →" button, complete missing steps with Stripe
- Usually takes 2-3 minutes

**"Stripe account ready" but money not arriving:**
- **Cause:** Recent lesson not yet 48 hours old, or next payout batch hasn't run
- **Fix:** Check lesson date, wait until next Tuesday
- First payout may take up to 7 business days from initial Stripe verification

**"I want to change my bank account":**
- Option 1: Via Stripe portal (if Stripe account already connected)
- Option 2: Admin deletes stripeAccountId in database, instructor reconnects from scratch

---

**Category:** Payments  
**Subcategory:** Stripe  
**Topic:** Connect Setup  
**Priority:** HIGH (blocks instructor payouts)  
**Effort:** 5-15 minutes (for instructors)  
**Environment:** Test mode (for now)

