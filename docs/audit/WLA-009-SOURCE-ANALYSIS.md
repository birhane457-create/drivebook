# WLA-009 Source Analysis — PREMIUM white-label entitlement vs subdomain renderer gate

**Date:** 2026-10-27
**Finding:** WLA-009 (source-verified, policy decision required before fix)
**Commit:** `c65cf3ee`

## Source-level analysis

### 1. getAccountFeatures() — lib/utils/account.ts

```typescript
const tier = account.subscriptionTier ?? 'BASIC'
const isBusiness = account.accountType === 'BUSINESS'
const isPremium = tier === 'PREMIUM'
const isPro = tier === 'PRO' || tier === 'STUDIO' || isPremium   // PREMIUM included
const isStudioPlus = tier === 'STUDIO' || isPremium               // PREMIUM included

return {
  whiteLabel: isPremium || isBusiness,   // PREMIUM = full white-label ✓
  customDomain: isStudioPlus,            // PREMIUM can use custom domain ✓
  customSlug: isPro,                     // PREMIUM can use custom slug ✓
  // ...
}
```

PREMIUM is treated as the highest individual tier — equal to or above STUDIO.

### 2. Subdomain renderer — app/subdomain/[slug]/page.tsx

```typescript
// Line 176-177
const isPro = instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'STUDIO';
//   PREMIUM is NOT included in isPro
const hasBranding = isPro && instructor.showBrandingOnBookingPage;
const brandLogo = hasBranding ? instructor.brandLogo : null;
```

PREMIUM is excluded from the local `isPro` definition. A PREMIUM provider with
`showBrandingOnBookingPage: true` and `brandLogo` set will have `brandLogo = null`
on their booking page. Their logo is silently suppressed.

### 3. Tier hierarchy in the codebase

| Tier | getAccountFeatures isPro | getAccountFeatures whiteLabel | Subdomain isPro | hasBranding |
|---|---|---|---|---|
| BASIC | No | No | No | No |
| PRO | Yes | No | Yes | Yes (if flag set) |
| STUDIO | Yes | No | Yes | Yes (if flag set) |
| PREMIUM | **Yes** | **Yes** | **No** | **No** ← gap |
| BUSINESS | — | Yes | — | — |

### 4. Historical BRAND-V-05 (CLOSED)

BRAND-V-05 was about the domain verification **API endpoint** not accepting PREMIUM
tier accounts. That was fixed (`STUDIO+PREMIUM` accepted). BRAND-V-05 did NOT cover
the subdomain renderer's `isPro` logic — they are separate code paths.

### 5. Comment in the renderer

```typescript
// Branding — colors apply for all tiers; logo/name white-labelling is PRO/STUDIO/BUSINESS only
```

This comment explicitly lists PRO/STUDIO/BUSINESS but not PREMIUM. This may have been
an intentional design choice when white-labelling was STUDIO+ only, before PREMIUM was
added with full white-label entitlement.

## Policy question

**Option A — PREMIUM should have branding (fix the renderer):**
  - `isPro` in the renderer should include PREMIUM
  - Aligns with `getAccountFeatures().whiteLabel: isPremium`
  - PREMIUM providers' logos and branding would appear on their booking page

**Option B — Driving-specific renderer intentionally excludes PREMIUM branding:**
  - PREMIUM may be intended only for the non-driving BusinessWebsitePage renderer
  - The driving subdomain page has its own separate branding policy
  - Requires the comment to be updated to say "PRO/STUDIO/BUSINESS only (not PREMIUM)"

## Conclusion

No code change should be made until the policy is settled. This analysis establishes:
1. There is a definite inconsistency between getAccountFeatures and the renderer
2. BRAND-V-05 does not cover this — they are different code paths
3. The renderer's comment suggests the exclusion may have been intentional
4. A policy decision is required before implementing Option A or B
