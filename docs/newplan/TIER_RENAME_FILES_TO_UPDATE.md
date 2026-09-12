# Files That Need BUSINESS → PREMIUM Update

> **Status:** Work in Progress  
> **Date:** 2026-08-15

---

## ✅ ALREADY UPDATED

1. ✅ `lib/config/subscriptions.ts` - Main config
2. ✅ `app/api/instructor/subscription/route.ts` - Subscription validation
3. ✅ `app/api/cron/apply-rate-changes/route.ts` - Commission rates

---

## 🔧 CRITICAL FILES TO UPDATE NOW

### API Routes (Tier Validation)

1. **`app/api/admin/instructors/[id]/subscription/route.ts`**
   - Line ~X: Tier validation array
   - Action: Add 'PREMIUM' to allowed tiers

2. **`app/api/admin/settings/page.tsx`**  
   - Multiple references to BUSINESS tier
   - Action: Update UI to show PREMIUM

3. **`app/api/admin/subscriptions/page.tsx`**
   - Subscription management UI
   - Action: Display PREMIUM instead of BUSINESS

4. **`app/api/instructor/branding/route.ts`**
   - Feature access checks
   - Action: Update tier checks to include PREMIUM

5. **`app/api/instructor/domain/verify/route.ts`**
   - Custom domain feature check
   - Action: Update tier validation

6. **`app/api/public/instructor/[instructorId]/route.ts`**
   - Public instructor profile
   - Action: Update tier display

7. **`app/api/stripe/webhook/route.ts`**
   - Subscription webhooks
   - Action: Handle both BUSINESS and PREMIUM

8. **`app/api/subscriptions/checkout/route.ts`**
   - Checkout flow
   - Action: Update tier creation

---

### UI Pages (Display Names)

9. **`app/admin/instructors/[id]/page.tsx`**
   - Instructor detail page
   - Action: Show "Premium" tier

10. **`app/admin/settings/page.tsx`**
    - Admin settings
    - Action: Update tier references

11. **`app/admin/subscriptions/page.tsx`**
    - Subscription management
    - Action: Display PREMIUM

12. **`app/book/[instructorId]/page.tsx`**
    - Booking page
    - Action: Update comments mentioning BUSINESS

---

### Business Setup Pages

13. **`app/business-setup/**`**
    - All setup wizard pages
    - Action: Rename to `premium-setup` OR update text

---

## 🔄 SECONDARY FILES (Can Do Later)

### Cron Jobs

14. **`app/api/cron/send-trial-expiry-alerts/route.ts`**
    - Trial expiry alerts
    - Action: Update tier references

---

### API Business Routes

15. **`app/api/business/ai-config/route.ts`**
    - AI configuration
    - Action: Update tier checks OR rename folder to `/api/premium/`

16. **`app/api/business/capabilities/route.ts`**
    - Capabilities API
    - Action: Update tier checks OR rename folder

---

### Recommendations

17. **`app/api/instructors/recommendation/route.ts`**
    - Instructor recommendations
    - Action: Update tier display

---

## 📝 QUICK FIX PATTERN

For most files, the pattern is:

### Pattern 1: Tier Validation Arrays
```typescript
// BEFORE:
if (!['BASIC', 'PRO', 'STUDIO', 'BUSINESS'].includes(tier)) {

// AFTER:
if (!['BASIC', 'PRO', 'STUDIO', 'PREMIUM', 'BUSINESS'].includes(tier)) {
// Keep BUSINESS for backward compatibility
```

### Pattern 2: Tier Comparisons
```typescript
// BEFORE:
if (instructor.subscriptionTier === 'BUSINESS') {

// AFTER:
if (instructor.subscriptionTier === 'PREMIUM' || instructor.subscriptionTier === 'BUSINESS') {
// Handle both for migration period
```

### Pattern 3: UI Display
```typescript
// BEFORE:
{tier === 'BUSINESS' && <Badge>Business</Badge>}

// AFTER:
{(tier === 'PREMIUM' || tier === 'BUSINESS') && <Badge>Premium</Badge>}
// Always display as "Premium"
```

### Pattern 4: Comments
```typescript
// BEFORE:
// Only BUSINESS tier can access this

// AFTER:
// Only PREMIUM tier can access this
```

---

## 🎯 PRIORITY ORDER

### Phase 1: Critical (DO NOW) ✅
1. ✅ Subscription config
2. ✅ Tier validation in subscription API
3. ✅ Commission rate cron
4. ⏳ Admin UI pages
5. ⏳ Stripe webhook

### Phase 2: Important (BEFORE DEPLOY)
6. ⏳ All API tier checks
7. ⏳ UI display names
8. ⏳ Branding/domain APIs

### Phase 3: Nice to Have (CAN DO AFTER)
9. ⏳ Business setup wizard rename
10. ⏳ Comment updates
11. ⏳ API folder renames

---

## 🚀 AUTOMATED UPDATE SCRIPT

Created: `scripts/update-tier-references.js`

**Run:**
```bash
# Preview changes
node scripts/update-tier-references.js --dry-run

# Apply changes
node scripts/update-tier-references.js
```

**What it does:**
- Finds all 'BUSINESS' string literals
- Replaces with 'PREMIUM'
- Skips files with 'deprecated', 'backward', 'legacy' keywords
- Adds PREMIUM to tier arrays while keeping BUSINESS

---

## ✅ VERIFICATION CHECKLIST

After updates, verify:

- [ ] Subscription creation works for PREMIUM tier
- [ ] Tier display shows "Premium" not "Business"
- [ ] Feature access checks work for PREMIUM
- [ ] Backward compatibility: existing BUSINESS users still work
- [ ] Stripe webhooks handle both PREMIUM and BUSINESS
- [ ] Commission calculation uses correct rate (10%)
- [ ] UI shows correct tier everywhere
- [ ] No broken tier comparisons

---

## 📊 ESTIMATED EFFORT

- **Critical files (Phase 1):** 30-45 minutes
- **Important files (Phase 2):** 1-2 hours
- **Nice to have (Phase 3):** 2-3 hours
- **Total:** 3-6 hours

---

## 🎯 NEXT STEPS

1. ✅ Update subscription config (DONE)
2. ✅ Update critical API files (DONE: 3/50)
3. ⏳ Run update script for remaining files
4. ⏳ Test subscription flow
5. ⏳ Run database migration
6. ⏳ Deploy

