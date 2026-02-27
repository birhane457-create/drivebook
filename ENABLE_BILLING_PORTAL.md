# Enable Stripe Billing Portal - Step by Step

## Why You Need This

The "Manage Billing & Payment" button on your subscription page needs the Stripe Billing Portal to be enabled. This allows instructors to:
- Update their payment method
- View and download invoices
- Cancel their subscription
- Update billing address

---

## Quick Steps (1 minute)

### 1. Go to Billing Portal Settings

Open this URL in your browser:
```
https://dashboard.stripe.com/test/settings/billing/portal
```

Make sure you're in **TEST MODE** (toggle in top right).

---

### 2. Activate the Portal

You'll see a page that says "Customer portal".

Click the big blue button: **"Activate test link"**

---

### 3. Configure Features

After activating, you'll see configuration options:

#### Customer Information
- ✅ Email address (enabled by default)
- ✅ Billing address (optional)

#### Payment Methods
- ✅ **Update payment method** ← Make sure this is checked!

#### Subscriptions
- ✅ Cancel subscription (optional)
- ✅ Pause subscription (optional)
- ✅ Switch plans (optional - we handle this in our app)

#### Invoices
- ✅ **View invoice history** ← Make sure this is checked!

---

### 4. Set Return URL

Scroll down to "Business information" section.

Set the return URL to:
```
http://localhost:3000/dashboard/subscription
```

This is where users return after managing their billing.

---

### 5. Save Configuration

Click **"Save"** at the bottom of the page.

---

## ✅ Verification

After enabling, test it:

1. Restart your server: `npm run dev`
2. Login as: `birhane457@gmail.com`
3. Go to: `/dashboard/subscription`
4. Click "Manage Billing & Payment"
5. Should redirect to Stripe portal (not show error)

---

## What You'll See

When you click "Manage Billing & Payment", you'll be redirected to a Stripe-hosted page where you can:

- **Update payment method**: Add or change credit card
- **View invoices**: See all past invoices
- **Download receipts**: PDF receipts for each payment
- **Cancel subscription**: End subscription at period end
- **Update billing info**: Change billing address

After making changes, click "Return to [Your App]" to come back.

---

## Troubleshooting

### "Portal not enabled" error
→ Make sure you clicked "Activate test link"

### Can't find the portal settings
→ Go directly to: https://dashboard.stripe.com/test/settings/billing/portal

### Changes not working
→ Restart your server after enabling portal

### Wrong return URL
→ Update it in portal settings to: `http://localhost:3000/dashboard/subscription`

---

## Production Setup

When you go live, you'll need to:

1. Switch Stripe to **LIVE MODE**
2. Enable billing portal again in live mode
3. Update return URL to your production domain:
   ```
   https://yourdomain.com/dashboard/subscription
   ```

**Note**: Test mode and live mode have separate portal configurations!

---

## Summary

1. Go to: https://dashboard.stripe.com/test/settings/billing/portal
2. Click "Activate test link"
3. Enable "Update payment method" and "View invoice history"
4. Set return URL: `http://localhost:3000/dashboard/subscription`
5. Click "Save"
6. Restart server
7. Test it!

That's it! Your billing portal is now ready. 🎉
