# Package Tiers Migration — DB-Driven Configuration

## Summary

Package tiers (hours, labels, discounts) are now stored in the database (`PlatformSettings.packageTiers` JSONB column) and managed entirely from the admin pricing dashboard.

**What changed:**
- **Before:** Tier structure hardcoded in 7+ files. Changing hours/labels required code changes + deploy.
- **After:** Admin can add/remove/edit tiers from the UI. Discount % changes apply instantly. Tier structure changes (add 20hr tier, drop 6hr tier) require one code file update + deploy.

---

## Data Flow

```
Admin Dashboard
  └─ /admin/pricing → PricingSettingsForm.tsx
       └─ POST /api/admin/pricing → prisma.platformSettings.upsert({ packageTiers })
            └─ invalidatePricingCache()

Booking Flow (live, DB-driven)
  └─ BookingContext → GET /api/public/pricing
       └─ getPlatformPricing() → reads packageTiers from DB
            └─ PackageSelector renders tiers
            └─ BookingContext calculates discounts

Marketing Pages (static fallback)
  └─ /lessons, /lessons/packages
       └─ import PREDEFINED_PACKAGES from '@/lib/config/packages'
```

---

## Schema

### PlatformSettings.packageTiers (JSONB, nullable)

```typescript
Array<{
  hours:    number;   // e.g. 6, 10, 15
  label:    string;   // e.g. "Starter", "Popular", "Best Value"
  discount: number;   // percent, e.g. 10 = 10% off
  featured: boolean;  // true = shows "Most Popular" badge
}>
```

**Example:**
```json
[
  { "hours": 6,  "label": "Starter",    "discount": 5,  "featured": false },
  { "hours": 10, "label": "Popular",    "discount": 10, "featured": true  },
  { "hours": 15, "label": "Best Value", "discount": 12, "featured": false }
]
```

**Backward compatibility:**
- If `packageTiers` is `null` (legacy row), code falls back to the 3 named columns (`package6Discount`, `package10Discount`, `package15Discount`).
- The named columns remain in the schema untouched — no destructive migration.

---

## What Admin Can Do (Zero Code Deploy)

✅ **Change discount %** — edit any tier's discount field, click Save → live immediately  
✅ **Rename tier labels** — e.g. "Starter" → "Beginner"  
✅ **Toggle "Most Popular" badge** — click the ★ button on any tier  
✅ **Reorder tiers** — drag rows (not implemented yet, but data supports it)

⚠️ **Add or remove tiers** — works in the booking flow immediately, but marketing pages (`/lessons`, `/lessons/packages`) still reference the static `PREDEFINED_PACKAGES` constant in code. See below.

---

## Known Limitation — Marketing Pages

The public marketing pages (`app/lessons/page.tsx` and `app/lessons/packages/page.tsx`) use a static import:

```typescript
import { PREDEFINED_PACKAGES } from '@/lib/config/packages';
```

This constant is a **fallback** for SEO/static pages that can't call async DB functions at module scope.

**Impact:**
- Admin adds a 20hr tier in the dashboard → booking flow picks it up instantly ✅
- Marketing pages still show 6/10/15 tiers until `PREDEFINED_PACKAGES` is manually updated in code and redeployed ⚠️

**Workaround:**
Admin dashboard shows a prominent amber warning box explaining this. If tier structure changes, also update `lib/config/packages.ts` → `PREDEFINED_PACKAGES` array.

**Future fix (optional):**
Convert those two marketing pages to async server components that call `getPackageTiers()` at render time. That would make them fully DB-driven with zero static fallback.

---

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `packageTiers Json?` column to `PlatformSettings` |
| `lib/config/packages.ts` | Added `PackageTier` type, `DEFAULT_PACKAGE_TIERS`, `getPackageTiers()`, `invalidatePricingCache()` |
| `lib/services/platform-pricing.ts` | `PricingSettings` interface + `getPlatformPricing()` now include `packageTiers` |
| `app/api/admin/pricing/route.ts` | Zod schema accepts `packageTiers` array, calls `invalidatePricingCache()` after save |
| `app/api/public/pricing/route.ts` | Returns `packageTiers` in response |
| `components/admin/PricingSettingsForm.tsx` | Replaced 3 hardcoded discount fields with dynamic tier table (add/remove/edit rows) |
| `components/PackageSelector.tsx` | Reads `packageTiers` from `platformSettings`, falls back to named columns if null |
| `lib/contexts/BookingContext.tsx` | Discount calculation now uses `packageTiers` tier-aware helper, falls back to named columns |

**Untouched (intentional):**
- `app/lessons/page.tsx` and `app/lessons/packages/page.tsx` — still use static `PREDEFINED_PACKAGES`
- `package6Discount`, `package10Discount`, `package15Discount` columns — kept in schema as safe fallback

---

## Testing Checklist

**Admin dashboard:**
- [ ] Open `/admin/pricing` — tier table loads with current tiers (seeded from named columns if `packageTiers` was null)
- [ ] Change a discount % — save → booking flow reflects new discount immediately (no cache delay)
- [ ] Add a new tier (e.g. 20hrs, "Premium", 15% off) — save → booking flow shows it
- [ ] Remove a tier — save → booking flow no longer shows it
- [ ] Toggle featured — save → booking flow shows "Most Popular" badge on the correct tier

**Booking flow:**
- [ ] Open `/book` → select a provider → PackageSelector shows live tiers from DB
- [ ] Custom hours dropdown — discounts apply at correct thresholds
- [ ] Checkout — pricing breakdown matches tier discount

**Marketing pages (expected drift):**
- [ ] `/lessons` and `/lessons/packages` — if tier structure changed, these still show old tiers until `PREDEFINED_PACKAGES` is updated in code

---

## Rollback Plan

If issues arise:
1. Admin can edit `packageTiers` back to original values from the UI (instant)
2. Developers can set `packageTiers` to `null` in the DB directly — code will fall back to the 3 named columns
3. No schema rollback needed — `packageTiers` column is nullable and additive only

---

## Migration Applied

Date: 2026-09-01  
SQL: `ALTER TABLE "PlatformSettings" ADD COLUMN "packageTiers" JSONB;`  
Prisma: `npx prisma generate` after schema update  
Status: ✅ Complete — production booking flow reads from DB, marketing pages use static fallback