# Subscription System - Setup Required ⚠️

## Current Status

✅ **Completed**:
- Subscription UI with upgrade/downgrade buttons
- "Manage Billing & Payment" button visible
- All APIs ready (change-plan, billing-portal)
- Stripe connection working

❌ **Blocked**:
- No products created in Stripe dashboard
- Missing 6 price IDs in `.env` file
- Subscription upgrades/downgrades fail with error: `No such price: 'price_basic_monthly'`

---

## What You Need to Do

### Step 1: Create Products in Stripe (5 minutes)

1. **Login to Stripe Dashboard**
   - Go to: https://dashboard.stripe.com
   - Make sure you're in **TEST MODE** (toggle in top right)

2. **Create Product 1: DriveBook Basic**
   - Click **Products** → **Add Product**
   - Name: `DriveBook Basic`
   - Description: `Basic plan for individual instructors`
   - Click **Add pricing**:
     - **Monthly**: $29.00 USD, Recurring, Monthly
     - Click **Add another price**
     - **Annual**: $290.00 USD, Recurring, Yearly
   - Click **Save product**
   - **IMPORTANT**: Copy both Price IDs (they look like `price_xxxxxxxxxxxxx`)

3. **Create Product 2: DriveBook Pro**
   - Click **Products** → **Add Product**
   - Name: `DriveBook Pro`
   - Description: `Pro plan for growing businesses`
   - Add pricing:
     - **Monthly**: $79.00 USD, Recurring, Monthly
     - **Annual**: $790.00 USD, Recurring, Yearly
   - Click **Save product**
   - **IMPORTANT**: Copy both Price IDs

4. **Create Product 3: DriveBook Business**
   - Click **Products** → **Add Product**
   - Name: `DriveBook Business`
   - Description: `Business plan for driving schools`
   - Add pricing:
     - **Monthly**: $199.00 USD, Recurring, Monthly
     - **Annual**: $1990.00 USD, Recurring, Yearly
   - Click **Save product**
   - **IMPORTANT**: Copy both Price IDs

---

### Step 2: Add Price IDs to .env File

Open your `.env` file and add these 6 lines at the end:

```bash
# Stripe Subscription Price IDs
STRIPE_BASIC_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_BASIC_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_PRO_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx
```

Replace `price_xxxxxxxxxxxxx` with the actual Price IDs you copied from Stripe.

---

### Step 3: Enable Billing Portal

1. Go to **Settings** → **Billing** → **Customer Portal**
2. Click **Activate test link**
3. Configure features:
   - ✅ Update payment method
   - ✅ View invoices
   - ✅ Cancel subscription
4. Set return URL: `http://localhost:3000/dashboard/subscription`
5. Click **Save**

---

### Step 4: Restart Your Server

Stop your development server (Ctrl+C) and start it again:

```bash
npm run dev
```

---

## Testing After Setup

### Test 1: Check Configuration
```bash
node scripts/check-stripe-products.js
```

You should see:
- ✓ 3 products listed
- ✓ All 6 price IDs configured

### Test 2: Try Upgrade/Downgrade
1. Go to `/dashboard/subscription`
2. Click "Upgrade" or "Downgrade" button
3. Should work without errors
4. Commission rate should update immediately

### Test 3: Billing Portal
1. Click "Manage Billing & Payment"
2. Should redirect to Stripe portal
3. Can update payment method
4. Can view invoices

---

## Stripe Test Cards

Use these for testing:

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Card declined |
| 4000 0000 0000 9995 | Insufficient funds |

- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

---

## Current Error Explained

When you click "Upgrade" or "Downgrade", you see:

```
StripeInvalidRequestError: No such price: 'price_basic_monthly'
```

This happens because:
1. The system tries to use `price_basic_monthly` (placeholder)
2. This price doesn't exist in your Stripe account
3. You need to create the products and configure real price IDs

---

## Quick Reference

### What Each Price ID Is For

| Environment Variable | Plan | Billing | Price |
|---------------------|------|---------|-------|
| STRIPE_BASIC_MONTHLY_PRICE_ID | Basic | Monthly | $29 |
| STRIPE_BASIC_ANNUAL_PRICE_ID | Basic | Annual | $290 |
| STRIPE_PRO_MONTHLY_PRICE_ID | Pro | Monthly | $79 |
| STRIPE_PRO_ANNUAL_PRICE_ID | Pro | Annual | $790 |
| STRIPE_BUSINESS_MONTHLY_PRICE_ID | Business | Monthly | $199 |
| STRIPE_BUSINESS_ANNUAL_PRICE_ID | Business | Annual | $1990 |

---

## Need Help?

- **Stripe Dashboard**: https://dashboard.stripe.com/test/products
- **Detailed Guide**: See `STRIPE_SETUP_GUIDE.md`
- **Stripe Docs**: https://stripe.com/docs/billing/subscriptions/overview
- **Test Cards**: https://stripe.com/docs/testing

---

## After Setup is Complete

Once you've completed all steps, the subscription system will be 100% functional:

✅ New subscriptions with free trial
✅ Upgrade/downgrade with proration
✅ Payment method management
✅ Billing portal access
✅ Invoice viewing
✅ Commission rate updates

The system is already built and ready - it just needs the Stripe products configured!
