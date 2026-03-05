# Stripe Setup Guide for Subscription System

## Current Issue

The subscription system is trying to use Stripe price IDs that don't exist yet:
- `price_basic_monthly`
- `price_pro_monthly`
- `price_business_monthly`
- etc.

You need to create these products in Stripe first.

---

## Quick Setup (5 minutes)

### Step 1: Login to Stripe Dashboard
1. Go to https://dashboard.stripe.com
2. Make sure you're in **TEST MODE** (toggle in top right)

### Step 2: Create Products

#### Product 1: Basic Plan
1. Go to **Products** → **Add Product**
2. Name: `DriveBook Basic`
3. Description: `Basic plan for individual instructors`
4. Pricing:
   - **Monthly**: $29.00 USD, Recurring monthly
   - **Annual**: $290.00 USD, Recurring yearly
5. Click **Save product**
6. Copy the Price IDs (they look like `price_xxxxxxxxxxxxx`)

#### Product 2: Pro Plan
1. Go to **Products** → **Add Product**
2. Name: `DriveBook Pro`
3. Description: `Pro plan for growing businesses`
4. Pricing:
   - **Monthly**: $79.00 USD, Recurring monthly
   - **Annual**: $790.00 USD, Recurring yearly
5. Click **Save product**
6. Copy the Price IDs

#### Product 3: Business Plan
1. Go to **Products** → **Add Product**
2. Name: `DriveBook Business`
3. Description: `Business plan for driving schools`
4. Pricing:
   - **Monthly**: $199.00 USD, Recurring monthly
   - **Annual**: $1990.00 USD, Recurring yearly
5. Click **Save product**
6. Copy the Price IDs

---

### Step 3: Add Price IDs to Environment Variables

Add these to your `.env` file:

```bash
# Stripe Price IDs (from Stripe Dashboard)
STRIPE_BASIC_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_BASIC_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_PRO_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx
```

---

### Step 4: Enable Billing Portal

1. Go to **Settings** → **Billing** → **Customer Portal**
2. Click **Activate test link**
3. Configure features:
   - ✅ Update payment method
   - ✅ View invoices
   - ✅ Cancel subscription
4. Set return URL: `http://localhost:3000/dashboard/subscription`
5. Click **Save**

---

### Step 5: Configure Webhooks (Optional for now)

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `http://localhost:3000/api/stripe/webhook`
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add to `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

---

### Step 6: Restart Your Server

```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

---

## Testing the System

### Test 1: Add Payment Method (Trial User)
1. Go to `/dashboard/subscription`
2. Click "Add Payment Method"
3. You'll see a message to select a plan
4. Click on your current plan button
5. Use test card: `4242 4242 4242 4242`
6. Any future date, any CVC
7. Complete checkout

### Test 2: Upgrade Plan
1. After adding payment method
2. Click "Upgrade" on a higher tier
3. Confirm upgrade
4. Check that commission rate changed

### Test 3: Billing Portal
1. Click "Manage Billing & Payment"
2. Should redirect to Stripe portal
3. Update payment method
4. View invoices
5. Return to platform

---

## Stripe Test Cards

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0002 | Card declined |
| 4000 0000 0000 9995 | Insufficient funds |
| 4000 0000 0000 0341 | Requires authentication (3D Secure) |

---

## Troubleshooting

### Error: "No such price"
- **Cause**: Price ID doesn't exist in Stripe
- **Fix**: Create the product in Stripe dashboard and update `.env`

### Error: "No payment method on file"
- **Cause**: Trial user hasn't added payment method
- **Fix**: Click "Add Payment Method" and complete checkout

### Error: "Billing portal not enabled"
- **Cause**: Customer portal not activated in Stripe
- **Fix**: Go to Settings → Billing → Customer Portal → Activate

### Webhook not receiving events
- **Cause**: Webhook endpoint not configured
- **Fix**: Add webhook endpoint in Stripe dashboard

---

## Production Setup

When ready for production:

1. **Switch to Live Mode** in Stripe dashboard
2. **Create products again** in live mode (test products don't transfer)
3. **Update `.env`** with live price IDs
4. **Update webhook URL** to production domain
5. **Test with real card** (small amount)
6. **Monitor** Stripe dashboard for issues

---

## Environment Variables Checklist

```bash
# Required for subscriptions
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx

# Required for billing portal
STRIPE_BASIC_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_BASIC_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_PRO_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx

# Required for webhooks
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Required for redirects
NEXTAUTH_URL=http://localhost:3000
```

---

## Quick Commands

```bash
# Check if environment variables are loaded
node -e "console.log(process.env.STRIPE_BASIC_MONTHLY_PRICE_ID)"

# Test Stripe connection
node -e "const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); stripe.prices.list().then(console.log)"
```

---

## Summary

1. ✅ Create 3 products in Stripe (Basic, Pro, Business)
2. ✅ Add 6 price IDs to `.env` (monthly + annual for each)
3. ✅ Enable billing portal in Stripe settings
4. ✅ Restart server
5. ✅ Test with test cards

After this setup, all subscription features will work:
- ✅ New subscriptions
- ✅ Upgrades/downgrades
- ✅ Payment method management
- ✅ Billing portal
- ✅ Invoices

---

**Need Help?**
- Stripe Docs: https://stripe.com/docs/billing/subscriptions/overview
- Test Cards: https://stripe.com/docs/testing
- Support: https://support.stripe.com
