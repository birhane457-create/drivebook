# How to Get Stripe Price IDs - Visual Guide

## Quick Steps

1. Login to Stripe Dashboard
2. Create 3 products with 2 prices each (monthly + annual)
3. Copy the 6 price IDs
4. Add to `.env` file
5. Restart server

---

## Detailed Walkthrough

### Step 1: Access Stripe Products

```
https://dashboard.stripe.com/test/products
```

Make sure you're in **TEST MODE** (toggle in top right corner).

---

### Step 2: Create First Product (Basic)

1. Click **"+ Add product"** button

2. Fill in product details:
   ```
   Name: DriveBook Basic
   Description: Basic plan for individual instructors
   ```

3. Add first price (Monthly):
   ```
   Price: $29.00
   Billing period: Monthly
   Currency: USD
   ```

4. Click **"Add another price"**

5. Add second price (Annual):
   ```
   Price: $290.00
   Billing period: Yearly
   Currency: USD
   ```

6. Click **"Save product"**

---

### Step 3: Copy Price IDs

After saving, you'll see your product page with 2 prices listed.

**For Monthly Price:**
- Look for the price row showing "$29.00 / month"
- Click on it to expand details
- You'll see: `Price ID: price_xxxxxxxxxxxxx`
- **Copy this ID** - this is your `STRIPE_BASIC_MONTHLY_PRICE_ID`

**For Annual Price:**
- Look for the price row showing "$290.00 / year"
- Click on it to expand details
- You'll see: `Price ID: price_xxxxxxxxxxxxx`
- **Copy this ID** - this is your `STRIPE_BASIC_ANNUAL_PRICE_ID`

---

### Step 4: Repeat for Pro Plan

Create second product:
```
Name: DriveBook Pro
Description: Pro plan for growing businesses

Monthly Price: $79.00 / month
Annual Price: $790.00 / year
```

Copy both price IDs:
- Monthly → `STRIPE_PRO_MONTHLY_PRICE_ID`
- Annual → `STRIPE_PRO_ANNUAL_PRICE_ID`

---

### Step 5: Repeat for Business Plan

Create third product:
```
Name: DriveBook Business
Description: Business plan for driving schools

Monthly Price: $199.00 / month
Annual Price: $1990.00 / year
```

Copy both price IDs:
- Monthly → `STRIPE_BUSINESS_MONTHLY_PRICE_ID`
- Annual → `STRIPE_BUSINESS_ANNUAL_PRICE_ID`

---

### Step 6: Add to .env File

Open your `.env` file and add at the end:

```bash
# Stripe Subscription Price IDs (from Stripe Dashboard)
STRIPE_BASIC_MONTHLY_PRICE_ID=price_1AbCdEfGhIjKlMnO
STRIPE_BASIC_ANNUAL_PRICE_ID=price_2PqRsTuVwXyZaBcD
STRIPE_PRO_MONTHLY_PRICE_ID=price_3EfGhIjKlMnOpQrS
STRIPE_PRO_ANNUAL_PRICE_ID=price_4TuVwXyZaBcDeFgH
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_5IjKlMnOpQrStUvW
STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_6XyZaBcDeFgHiJkL
```

**Replace the example IDs with your actual price IDs from Stripe!**

---

## Finding Price IDs Later

If you need to find your price IDs again:

1. Go to **Products** in Stripe Dashboard
2. Click on the product name (e.g., "DriveBook Basic")
3. You'll see all prices for that product
4. Click on a price to see its details
5. The Price ID is shown at the top

---

## Verification

After adding all 6 price IDs to `.env`, run:

```bash
node scripts/check-stripe-products.js
```

You should see:
```
✓ STRIPE_BASIC_MONTHLY_PRICE_ID: price_xxxxxxxxxxxxx
✓ STRIPE_BASIC_ANNUAL_PRICE_ID: price_xxxxxxxxxxxxx
✓ STRIPE_PRO_MONTHLY_PRICE_ID: price_xxxxxxxxxxxxx
✓ STRIPE_PRO_ANNUAL_PRICE_ID: price_xxxxxxxxxxxxx
✓ STRIPE_BUSINESS_MONTHLY_PRICE_ID: price_xxxxxxxxxxxxx
✓ STRIPE_BUSINESS_ANNUAL_PRICE_ID: price_xxxxxxxxxxxxx
```

---

## Common Mistakes

❌ **Using Product ID instead of Price ID**
- Product ID: `prod_xxxxxxxxxxxxx` ← Wrong!
- Price ID: `price_xxxxxxxxxxxxx` ← Correct!

❌ **Forgetting to add both monthly and annual**
- Each product needs 2 prices (monthly + annual)

❌ **Wrong currency**
- Make sure all prices are in USD

❌ **Not restarting server**
- After updating `.env`, you must restart: `npm run dev`

---

## What Happens Next

Once configured, when a user clicks "Upgrade" or "Downgrade":

1. System looks up the price ID from `.env`
2. Calls Stripe API with that price ID
3. Stripe updates the subscription
4. Proration is calculated automatically
5. Commission rate updates in database
6. User sees success message

---

## Need Help?

If you're stuck:

1. Make sure you're in **TEST MODE** in Stripe
2. Check that price IDs start with `price_`
3. Verify `.env` file has no typos
4. Restart your server after changes
5. Run `node scripts/check-stripe-products.js` to verify

---

## Production Setup

When ready for production:

1. Switch Stripe to **LIVE MODE**
2. Create the same 3 products in live mode
3. Copy the 6 live price IDs
4. Update `.env` with live price IDs
5. Update `STRIPE_SECRET_KEY` to live key
6. Test with real card (small amount)

**Note**: Test mode products don't transfer to live mode - you must create them again!
