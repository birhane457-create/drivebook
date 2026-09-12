# BUSINESS → PREMIUM Tier Rename - Current Status

> **Date:** 2026-08-15  
> **Status:** IN PROGRESS (Core Complete, Remaining Files Need Update)

---

## ✅ COMPLETED

### 1. Core Configuration ✅
**File:** `lib/config/subscriptions.ts`

- ✅ Added PREMIUM tier ($199/month, 10% commission OR 0% with direct payment)
- ✅ Kept BUSINESS as deprecated (backward compatibility)
- ✅ Updated Stripe price IDs with fallbacks
- ✅ Updated commission rates
- ✅ Features: Solo provider, full white-label, direct payment option
- ✅ "Coming Soon" for multi-provider

###  2. Database Migration ✅
**File:** `prisma/migrations/rename_business_to_premium.sql`

- ✅ Updates Provider.subscriptionTier BUSINESS → PREMIUM
- ✅ Updates Subscription.tier BUSINESS → PREMIUM  
- ✅ Preserves accountType = 'BUSINESS' (feature flags)

### 3. Critical API Files ✅
- ✅ `app/api/instructor/subscription/route.ts` - Tier validation
- ✅ `app/api/cron/apply-rate-changes/route.ts` - Commission rates

---

## ⏳ REMAINING WORK

### Phase 1: Critical API Tier Checks (~30-45 min)

**Need to add PREMIUM to tier validation arrays:**

1. `app/api/admin/instructors/[id]/subscription/route.ts`
2. `app/api/admin/settings/page.tsx`
3. `app/api/instructor/branding/route.ts`
4. `app/api/instructor/domain/verify/route.ts`
5. `app/api/stripe/webhook/route.ts`
6. `app/api/subscriptions/checkout/route.ts`

**Pattern:**
```typescript
// Add PREMIUM, keep BUSINESS for backward compat
if (!['BASIC', 'PRO', 'STUDIO', 'PREMIUM', 'BUSINESS'].includes(tier)) {
```

---

### Phase 2: UI Display Names (~1-2 hours)

**Update to show "Premium" instead of "Business":**

1. `app/admin/instructors/[id]/page.tsx`
2. `app/admin/subscriptions/page.tsx`  
3. `app/book/[instructorId]/page.tsx` (comments only)

**Pattern:**
```typescript
// Display both BUSINESS and PREMIUM as "Premium"
{(tier === 'PREMIUM' || tier === 'BUSINESS') && <Badge>Premium</Badge>}
```

---

### Phase 3: Optional Renames (~2-3 hours)

**Consider renaming folders:**
- `app/business-setup/` → `app/premium-setup/` OR update text
- `app/api/business/` → `app/api/premium/` OR keep as-is

---

## 🎯 KEY DECISIONS MADE

### 1. Commission Rate: 10% OR 0%
**PREMIUM tier supports TWO modes:**

**Mode A: Marketplace (10% commission)**
```typescript
paymentMode: 'PLATFORM'
commission: 10%
```
- Default for driving instructors
- Platform handles payments
- Bank statement shows "DRIVEBOOK"

**Mode B: Direct Payment (0% commission)**
```typescript
paymentMode: 'DIRECT'
commission: 0% (subscription fee only)
```
- For tradies/established businesses
- Provider's Stripe Connect account
- Bank statement shows provider's business name
- 70% built, needs enabling

---

### 2. Backward Compatibility Strategy

**Keep BUSINESS tier in code:**
- Database still has BUSINESS records
- API accepts both PREMIUM and BUSINESS  
- Both map to same features
- UI always displays as "Premium"

**Why:**
- Existing users on BUSINESS tier
- Migration can happen gradually
- No breaking changes
- Zero downtime

---

## 🚀 DEPLOYMENT PLAN

### Step 1: Complete Remaining Updates
```bash
# Use automated script
node scripts/update-tier-references.js --dry-run  # Preview
node scripts/update-tier-references.js            # Apply
```

### Step 2: Test Thoroughly
- [ ] Create new PREMIUM subscription
- [ ] Verify existing BUSINESS users still work
- [ ] Test tier-gated features
- [ ] Check commission calculation (10%)
- [ ] Test direct payment mode toggle (when enabled)

### Step 3: Run Database Migration
```bash
# Backup first!
pg_dump $DATABASE_URL > backup.sql

# Run migration
psql $DATABASE_URL < prisma/migrations/rename_business_to_premium.sql
```

### Step 4: Deploy & Monitor
- Deploy code changes
- Monitor for errors
- Check Stripe webhooks
- Verify subscriptions working

---

## 📊 IMPACT ESTIMATE

### Code Files Affected
- Core config: 1 file ✅
- API routes: ~15-20 files ⏳
- UI pages: ~5-10 files ⏳
- Total: ~25-30 files

### Database Records
- Providers on BUSINESS tier: ~10-50
- Subscriptions: ~10-50
- Migration time: <1 second

### Testing Time
- Unit tests: N/A (no tests exist)
- Manual testing: 30-60 minutes
- Total QA: 1 hour

---

## ✅ WHAT THIS ENABLES

### Clear Tier Structure
1. BASIC - Entry level
2. PRO - Professional
3. STUDIO - Custom domain
4. **PREMIUM** - Full white-label, solo provider
5. **BUSINESS** (future) - Multi-provider schools

### Benefits
- ✅ No confusion about multi-provider
- ✅ Room for BUSINESS tier above
- ✅ Clear positioning
- ✅ Ready for direct payment (0% commission)
- ✅ Works with white-label branding we just built

---

## 🎯 NEXT IMMEDIATE ACTIONS

1. **Run update script** to catch remaining files
2. **Test subscription flow** with PREMIUM tier
3. **Review commission calculation** ensure 10% OR 0%
4. **Update UI** to show "Premium" everywhere
5. **Run database migration** when ready

---

## 💡 IMPORTANT NOTES

### About Commission
**PREMIUM tier can be either:**
- 10% commission (marketplace mode) - Default
- 0% commission (direct payment mode) - Optional, requires enabling

**This is configurable per provider:**
```prisma
Provider {
  subscriptionTier: 'PREMIUM'
  paymentMode: 'PLATFORM'  // 10% commission
  // OR
  paymentMode: 'DIRECT'    // 0% commission
}
```

### About accountType
**DON'T confuse with subscriptionTier:**
- `subscriptionTier`: BASIC, PRO, STUDIO, PREMIUM
- `accountType`: INDIVIDUAL, BUSINESS (feature flags, keep as-is)

These are separate fields!

---

## ✅ SUMMARY

**What's Done:**
- ✅ Core config renamed
- ✅ Database migration ready
- ✅ 3 critical files updated
- ✅ Backward compatibility maintained

**What Remains:**
- ⏳ ~25-30 files need tier reference updates
- ⏳ UI needs "Premium" display names
- ⏳ Testing needed before deploy

**Timeline:**
- Remaining work: 3-6 hours
- Testing: 1 hour
- Deploy: 30 minutes
- **Total: 4-8 hours**

**Ready to continue?** Run the update script or update files manually!

