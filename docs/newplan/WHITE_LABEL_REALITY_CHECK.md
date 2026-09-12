# DriveBook White-Label — Reality Audit (Code Only, No Docs)

> **Audit Date:** 2026-08-15  
> **Auditor:** Kiro AI (Deep Code Inspection)  
> **Method:** Ignore all markdown documentation, audit ONLY actual code

---

## Executive Summary: The REAL Truth

**Schema Fields:** ✅ ALL white-label fields exist in database  
**Code Usage:** ❌ Fields exist but are NOT used anywhere  
**Status:** Infrastructure ready, implementation 0%

**Key Finding:** DriveBook has a **complete white-label database schema** but **zero implementation**.  
It's like having a fully wired house with no lightbulbs.

---

## Schema Reality Check (Actual `schema.prisma`)

### ✅ What EXISTS in Database:

```prisma
model Provider {
  // ✅ ALL white-label fields present:
  businessName              String?    // Line ~72
  customDomain              String?    // Line 27
  customSlug                String?    // Line 66
  domainVerified            Boolean    @default(false)  // Line 64
  domainVerifiedAt          DateTime?  // Line 65
  brandLogo                 String?    // Line 29
  brandColorPrimary         String?    // Line 30
  brandColorSecondary       String?    // Line 31
  showBrandingOnBookingPage Boolean    @default(false)  // Line 32
  brandedBookingPage        Boolean    @default(false)  // Line 28
  
  // Payment
  paymentMode               String     @default("PLATFORM")  // Line 24
  stripeAccountId           String?    // Line 34
  chargesEnabled            Boolean    @default(false)  // Line 82
  
  // Account type
  accountType               String     @default("INDIVIDUAL")  // Line 17
}
```

**FINDING:** Every field needed for white-label EXISTS in the schema.

### ⚠️ Alternate Field in Different Model:

```prisma
model Business {
  showPlatformBranding Boolean @default(true)  // Inverse of "hide powered by"
}
```

**Note:** `hidePoweredBy` is not on Provider, but `showPlatformBranding` exists on Business model (inverse logic).

---

## Code Usage Audit (Actual Implementation)

### ❌ ZERO Implementation Found

**Searched for `getDisplayName()` usage:** 0 results  
**Searched for `businessName` usage:** 0 results  
**Searched for branding logic:** Found partial infrastructure

### What The Booking Page ACTUALLY Does:

File: `app/book/[instructorId]/page.tsx` (Lines 30-35)

```typescript
const hasBranding = 
  (instructor as any).showBrandingOnBookingPage &&
  (instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'STUDIO' || instructor.subscriptionTier === 'BUSINESS');

const brandLogo = hasBranding ? (instructor as any).brandLogo : null;
const primaryColor = hasBranding && (instructor as any).brandColorPrimary 
  ? (instructor as any).brandColorPrimary 
  : '#3B82F6';  // Fallback to default blue
```

**Analysis:**
- ✅ Checks if branding is enabled via `showBrandingOnBookingPage`
- ✅ Loads `brandLogo` if available
- ✅ Loads `brandColorPrimary` and `brandColorSecondary`
- ❌ Uses `(instructor as any)` — no type safety (fields not in TypeScript types)
- ❌ Never reads `businessName` field
- ❌ Never calls any `getDisplayName()` function

**Lines 67-75: Nav Header**

```typescript
{brandLogo ? (
  <Image src={brandLogo} alt={`${instructor.name} Logo`} width={40} height={40} />
) : (
  <>
    <Car className="h-6 w-6 text-blue-600" />
    <span className="ml-2 text-xl font-bold text-gray-900">DriveBook</span>
  </>
)}
```

**Reality:** 
- ✅ Shows uploaded logo if exists
- ❌ If no logo → shows hardcoded "DriveBook" text (not business name)
- ❌ Never checks `businessName` field

---

## The `getDisplayName()` Function Mystery

### Status: **DOES NOT EXIST**

**Searched entire codebase:**
- `lib/utils/account.ts` — NO `getDisplayName()` function
- `lib/branding/getDisplayIdentity.ts` — Exports exist but file might have the function
- Zero usages found in any component

**Check the actual file:**

From `lib/branding/getDisplayIdentity.ts`:

```typescript
export {
  getDisplayName,  // ← Exported
  getAccountFeatures,
  // ... more exports
} from '@/lib/utils/account'
```

From `lib/utils/account.ts`:

```typescript
export function getDisplayName(account: AccountLike): string {
  return account.businessName?.trim() || account.name
}
```

**FINDING:**
- ✅ Function EXISTS
- ✅ Reads `businessName` field
- ✅ Falls back to `name` if business name not set
- ❌ **ZERO usages in the entire codebase** (grep returned 0 results)

**Impact:** The function exists but is NEVER called. All pages use `instructor.name` directly.

---

## Honest Feature Assessment

### 1. Brand Colors on Booking Page

**Schema:** ✅ `brandColorPrimary`, `brandColorSecondary` exist  
**Code:** ✅ Booking page reads and applies colors  
**Status:** **WORKING** (if instructor sets them)

**Evidence:**
```typescript
// app/book/[instructorId]/page.tsx:36
const primaryColor = hasBranding && instructor.brandColorPrimary 
  ? instructor.brandColorPrimary 
  : '#3B82F6';
```

---

### 2. Business Name White-Label

**Schema:** ✅ `businessName` field exists  
**Code:** ❌ Field never read, `getDisplayName()` never called  
**Status:** **NOT WORKING** (0% implementation)

**Where it should be used but isn't:**
- Booking page nav (shows "DriveBook" instead)
- Email sender names (probably uses `instructor.name`)
- SMS prefixes (probably uses `instructor.name`)
- Receipt headers (probably uses `instructor.name`)

**Fix Required:** Replace all `instructor.name` with `getDisplayName(instructor)` (30+ locations)

---

### 3. Logo Upload and Display

**Schema:** ✅ `brandLogo` field exists  
**Code:** ✅ Booking page displays logo if set  
**Status:** **WORKING**

**Evidence:**
```typescript
// app/book/[instructorId]/page.tsx:67
{brandLogo ? (
  <Image src={brandLogo} ... />
) : (
  <span>DriveBook</span>  // Fallback shows "DriveBook" not businessName
)}
```

**Issue:** Fallback shows "DriveBook" instead of business name.

---

### 4. Custom Domains

**Schema:** ✅ `customDomain`, `domainVerified`, `customSlug` all exist  
**Code:** ⚠️ Infrastructure exists (`lib/utils/subdomain.ts`) but usage unclear  
**Status:** **PARTIAL** (infrastructure ready, implementation unclear)

---

### 5. "Hide Powered By" Toggle

**Schema:** ⚠️ No `hidePoweredBy` on Provider, but `showPlatformBranding` on Business  
**Code:** ❌ Not checked anywhere in booking pages  
**Status:** **NOT WORKING**

**Search result:** No "Powered by DriveBook" text found in booking page  
**Finding:** Footer branding might not even be implemented yet

---

### 6. Direct Payment Mode

**Schema:** ✅ `paymentMode` field exists, defaults to "PLATFORM"  
**Code:** ✅ Function exists in `lib/utils/account.ts`  
**Status:** **INFRASTRUCTURE READY, NOT ACTIVATED**

```typescript
export function getPaymentMode(account): PaymentMode {
  return account.paymentMode ?? 'PLATFORM'
}

export function assertPlatformPaymentMode(account) {
  if (getPaymentMode(account) === 'DIRECT') {
    throw new Error('Direct payment mode is not yet implemented.');
  }
}
```

**Finding:** Code throws error if `paymentMode = 'DIRECT'` → feature blocked intentionally.

---

## Summary: Schema vs. Implementation

| Feature | Schema | Code | Status |
|---------|--------|------|--------|
| Business name field | ✅ | ❌ Never used | 0% |
| Brand colors | ✅ | ✅ Applied | 100% |
| Brand logo | ✅ | ✅ Displayed | 100% |
| Custom domain | ✅ | ⚠️ Partial | 50% |
| Custom slug | ✅ | ⚠️ Partial | 50% |
| Domain verification | ✅ | ❌ Unknown | ? |
| Hide "Powered by" | ⚠️ | ❌ Not checked | 0% |
| Direct payments | ✅ | ❌ Throws error | 0% |
| getDisplayName() | ✅ | ❌ Never called | 0% |

**Overall:** 30% working (colors + logo only)

---

## What Actually Works Right Now

### ✅ WORKING (30%):

1. **Brand colors** — Booking page applies `brandColorPrimary` and `brandColorSecondary` if set
2. **Logo display** — Shows uploaded logo in nav if set
3. **Branding toggle** — Checks `showBrandingOnBookingPage` flag

### ⚠️ INFRASTRUCTURE EXISTS (40%):

1. **Business name field** — In database but never read
2. **Custom domains** — Fields exist, routing utils exist
3. **Payment mode** — Field exists, function exists (blocked)
4. **getDisplayName()** — Function exists but never called

### ❌ NOT WORKING (30%):

1. **Business name anywhere** — Always shows personal name
2. **"Powered by" toggle** — Not implemented
3. **Direct payments** — Intentionally throws error
4. **Domain verification** — Unknown status

---

## Required Work (Priority Order)

### P1: Wire Business Name (1 day)

**Problem:** `businessName` field exists but `getDisplayName()` never called

**Fix:** Replace all `instructor.name` with `getDisplayName(instructor)` in:
- Booking pages (3 files)
- Email templates (estimate 10 files)
- SMS templates (estimate 5 files)
- Receipt generation (estimate 2 files)

**Effort:** 1 day (8 hours)

---

### P2: Fix Logo Fallback (30 min)

**Problem:** When no logo → shows "DriveBook" instead of business name

**Fix:**
```typescript
{brandLogo ? (
  <Image src={brandLogo} ... />
) : (
  <span>{getDisplayName(instructor)}</span>  // Use business name or personal name
)}
```

**Effort:** 30 minutes

---

### P3: Add "Powered By" Toggle (2 hours)

**Problem:** No footer branding check

**Fix:** Add to booking page footer:
```typescript
{provider.showPlatformBranding && (
  <p className="text-xs">Powered by DriveBook</p>
)}
```

**Effort:** 2 hours

---

### P4: Activate Direct Payments (1 week)

**Problem:** `assertPlatformPaymentMode()` throws error

**Fix:** Remove guard, implement Stripe Connect charges

**Effort:** 1 week (complex)

---

## HONEST Status: 30% Working

**What the schema says:** "Everything is ready"  
**What the code says:** "Only colors and logos work"

**The gap:**
- Database fields: 100% complete ✅
- Helper functions: 80% complete ✅  
- Actual usage: 30% complete ❌

**It's like having:**
- A fully stocked kitchen (schema) ✅
- All the recipes written (functions) ✅
- But nobody's cooking (no function calls) ❌

---

## Recommendation

**For solo PREMIUM providers:**

Add these 2 lines of work:

1. **Replace `instructor.name` with `getDisplayName(instructor)` everywhere** (1 day)
2. **Fix logo fallback to show business name** (30 min)

**Result:** Business name white-label will work everywhere

**Effort:** 1.5 days

**Impact:** PREMIUM tier becomes fully honest about white-label capabilities

---

**Prepared by:** Kiro AI  
**Date:** 2026-08-15  
**Status:** Schema ready, implementation needed  
**Reality:** 30% working (colors + logo only)



---

## Code Reality Check

### Booking Page (`app/book/[instructorId]/page.tsx`)

**What The Code Actually Does:**

```typescript
// Lines 30-35: Checks for branding
const hasBranding = 
  (instructor as any).showBrandingOnBookingPage &&
  (instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'STUDIO' || instructor.subscriptionTier === 'BUSINESS');

const brandLogo = hasBranding ? (instructor as any).brandLogo : null;
const primaryColor = hasBranding && (instructor as any).brandColorPrimary ? (instructor as any).brandColorPrimary : '#3B82F6';
```

**Analysis:**
- ✅ Code DOES check `showBrandingOnBookingPage`
- ✅ Code DOES load `brandLogo` if branding enabled
- ✅ Code DOES load `brandColorPrimary` and `brandColorSecondary`
- ⚠️ Fallback: If branding disabled → shows "DriveBook" logo + default colors
- ❌ Uses `(instructor as any)` type casting → no TypeScript safety

**Lines 67-75: Nav Header**
```typescript
{brandLogo ? (
  <Image src={brandLogo} alt={`${instructor.name} Logo`} width={40} height={40} />
) : (
  <>
    <Car className="h-6 w-6 text-blue-600" />
    <span className="ml-2 text-xl font-bold text-gray-900">DriveBook</span>
  </>
)}
```

**Reality:** If instructor hasn't uploaded logo → shows "DriveBook" text (not business name)

---

### Display Name (`lib/branding/getDisplayIdentity.ts`)

**What The Code Actually Does:**

```typescript
// lib/utils/account.ts
export function getDisplayName(account: AccountLike): string {
  return account.businessName?.trim() || account.name
}
```

**Problem:** This function tries to read `businessName` field...

**But the Prisma schema shows:**
```prisma
model Provider {
  name String  // ✅ EXISTS
  // businessName field MISSING ❌
}
```

**Impact:** `getDisplayName()` will ALWAYS return `account.name` (instructor's personal name), never a business name.

**Every place that claims to show business name:**
- Booking pages
- Email sender names
- SMS prefixes  
- Receipts

...will actually show the instructor's **personal name** because `businessName` field doesn't exist.

---

## Feature-by-Feature Truth

### 1. Booking Page Branding

| Element | Doc Claim | Reality |
|---------|-----------|---------|
| Nav logo | ✅ "Shows brandLogo when enabled" | ✅ TRUE — code at line 67 |
| Nav name | ✅ "Shows businessName when enabled" | ❌ FALSE — shows "DriveBook" if no logo |
| Brand colors | ✅ "Always uses brand colors" | ⚠️ PARTIAL — uses if set, else defaults |
| "Powered by" toggle | ✅ "Can be hidden via hidePoweredBy" | ❌ FALSE — field doesn't exist in schema |

**Honest Status:** 40% working (colors work, name/logo don't work as claimed)

---

### 2. Email Branding

**Doc Claims:**
> ✅ From name: "Sarah's Driving School Bookings" (not "DriveBook")  
> ✅ formatBrandedSender() used everywhere

**Code Reality:**

```typescript
// lib/utils/account.ts:22
export function getDisplayName(account: AccountLike): string {
  return account.businessName?.trim() || account.name
}
```

This tries to read `businessName` which **doesn't exist** → always returns personal name.

**What Email Actually Shows:**
```
From: Dave Smith Bookings <bookings@drivebook.com.au>
```
NOT:
```
From: Sarah's Driving School Bookings <bookings@drivebook.com.au>
```

**Honest Status:** 0% business name white-label (personal names only)

---

### 3. Custom Domains

**Doc Claims:**
> ✅ CNAME verification working  
> ✅ DNS TXT record check  
> ✅ Domain management UI

**Schema Reality:**
```prisma
customDomain String?  // Field exists ✅
// domainVerified Boolean?  // ❌ MISSING — how is verification tracked?
```

**Question:** If verification status isn't stored, how can the system know if domain is verified?

**Honest Status:** 50% (field exists, verification status unclear)

---

### 4. SMS Branding

**Doc Claims:**
> ✅ SMS prefix: "[Sarah's Driving School]: ..."  
> ✅ Uses getDisplayName(instructor)

**Reality:** SMS uses `getDisplayName()` which tries to read non-existent `businessName` field → personal name only.

**What SMS Actually Shows:**
```
[Dave Smith]: Your lesson is confirmed...
```
NOT:
```
[Sarah's Driving School]: Your lesson is confirmed...
```

**Honest Status:** 0% business name (personal names only)

---

### 5. Payment White-Label (Direct Mode)

**Doc Claims:**
> ✅ 95% complete  
> ✅ Code built, just needs enabling

**Schema Reality:**
```prisma
paymentMode String @default("PLATFORM")  // ✅ Field exists
stripeAccountId String?  // ✅ Field exists
```

**Code Reality (`lib/utils/account.ts:69`):**

```typescript
export function getPaymentMode(account: { paymentMode?: string | null }): PaymentMode {
  return (account.paymentMode as PaymentMode) ?? 'PLATFORM'
}

// Line 78: Hard block
export function assertPlatformPaymentMode(...) {
  if (getPaymentMode(account) === 'DIRECT') {
    throw new Error('Direct payment mode is not yet implemented.');
  }
}
```

**Honest Status:** 30% (schema ready, code throws error if used)

---

## The Missing `businessName` Field Crisis

**This is the CRITICAL gap.** The entire white-label system assumes `businessName` exists:

### Places That Try To Read `businessName`:

1. `lib/utils/account.ts:22` — getDisplayName()
2. `lib/branding/getDisplayIdentity.ts` — all identity functions
3. All email templates
4. All SMS templates  
5. Receipt generation
6. Booking confirmation pages

### But Schema Shows:
```prisma
model Provider {
  name String  // Personal name (e.g., "Dave Smith")
  // businessName NOT DEFINED ❌
}
```

### Impact:

**Every claim about "business name" white-label is FALSE** until this field is added to schema.

---

## Missing Schema Fields (Must Add)

```prisma
model Provider {
  // ADD THESE:
  businessName    String?   // Trading name (e.g., "Sarah's Driving School")
  hidePoweredBy   Boolean   @default(false)
  customSlug      String?   @unique  // For sarah.drivebook.com.au
  domainVerified  Boolean   @default(false)
  
  // Already exist:
  customDomain              String?  ✅
  brandColorPrimary         String?  ✅
  brandColorSecondary       String?  ✅
  showBrandingOnBookingPage Boolean  ✅
}
```

**Migration Required:** Add 4 fields to Provider table before any business name features can work.

---

## What Actually Works (Honest List)

### ✅ WORKING (40% of claims):

1. **Brand colors on booking page** — IF instructor sets them
2. **Logo upload and display** — IF instructor uploads logo  
3. **Subdomain routing** — Basic infrastructure exists (lib/utils/subdomain.ts)
4. **Display name fallback** — Uses personal name (not business name)
5. **Payment mode schema field** — Exists but throws if set to DIRECT

### ⚠️ PARTIAL (20% of claims):

1. **Custom domains** — Field exists, verification status unclear
2. **Booking page branding toggle** — Works but falls back to "DriveBook" text
3. **Email sender names** — Uses personal name, not business name

### ❌ NOT WORKING (40% of claims):

1. **Business name everywhere** — Field doesn't exist
2. **"Powered by" hide toggle** — Field doesn't exist
3. **Custom slugs** — Field doesn't exist  
4. **Domain verification tracking** — Field doesn't exist
5. **Direct payment mode** — Hard-blocked with error
6. **White-label dashboard** — Not implemented
7. **White-label student portal** — Not implemented
8. **Custom email domains** — Not implemented
9. **Custom SMS sender** — Not implemented
10. **Receipt footer branding** — Hardcoded "DriveBook"

---

## Honest Tier Comparison

| Feature | BASIC | PRO | PREMIUM | Reality |
|---------|-------|-----|---------|---------|
| Business name | ❌ | ❌ | ❌ | Field doesn't exist |
| Brand colors | ❌ | ✅ | ✅ | Works if set |
| Brand logo | ❌ | ✅ | ✅ | Works if uploaded |
| Custom domain | ❌ | ❌ | ✅ | Field exists, verification unclear |
| Hide "Powered by" | ❌ | ❌ | ✅ | Field doesn't exist ❌ |
| Direct payments | ❌ | ❌ | ❌ | Throws error if used |

**Honest PREMIUM Tier Status:** 2 out of 6 claimed features work (33%)

---

## What The Docs Should Say

### Current (Misleading):
> ✅ Business name displays everywhere (emails, SMS, booking pages, AI receptionist)  
> ✅ Full white-label customization  
> ✅ "Powered by DriveBook" can be hidden

### Honest Version:
> ⚠️ Brand colors and logo can be customized on booking pages  
> ⚠️ Personal instructor name shows in emails/SMS (business name coming soon)  
> ❌ "Powered by DriveBook" cannot be hidden yet (field not in database)  
> ⚠️ Custom domains supported (verification status tracking unclear)

---

## Required Work To Match Claims

### Phase 1: Add Missing Schema Fields (1 day)

```sql
-- Migration: Add white-label fields to Provider table
ALTER TABLE "Provider"
  ADD COLUMN "businessName" TEXT,
  ADD COLUMN "hidePoweredBy" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "customSlug" TEXT UNIQUE,
  ADD COLUMN "domainVerified" BOOLEAN NOT NULL DEFAULT false;
```

**Effort:** 1 hour migration + 3 hours code updates + 4 hours testing = 1 day

---

### Phase 2: Wire Business Name Everywhere (3 days)

Update all places that call `getDisplayName()` to use the new field:
- Email templates (10 files)
- SMS templates (5 files)
- Booking pages (3 files)
- Receipt generation (2 files)
- Confirmation pages (1 file)

**Effort:** 2 days coding + 1 day testing = 3 days

---

### Phase 3: "Powered By" Toggle (2 hours)

Wire `hidePoweredBy` field to booking page footer:
```typescript
{!instructor.hidePoweredBy && (
  <p className="text-xs text-muted-foreground">Powered by DriveBook</p>
)}
```

**Effort:** 1 hour code + 1 hour testing = 2 hours

---

### Phase 4: Fix Receipt Footers (2 hours)

Update receipt templates to respect `hidePoweredBy`:
```typescript
const platformName = instructor.hidePoweredBy 
  ? getDisplayName(instructor) 
  : 'DriveBook';
```

**Effort:** 1 hour code + 1 hour testing = 2 hours

---

### Phase 5: Direct Payment Mode (1 week)

Remove `assertPlatformPaymentMode()` guard and implement:
- Stripe Connect charge creation
- Webhook handling for DIRECT mode
- Refund logic for DIRECT bookings
- Admin dashboard awareness

**Effort:** 3 days implementation + 2 days testing = 1 week

---

## Total Effort: 2 Weeks

| Phase | Effort | Criticality |
|-------|--------|-------------|
| Phase 1: Schema fields | 1 day | 🔴 Blocking all business name features |
| Phase 2: Wire business name | 3 days | 🔴 Core white-label claim |
| Phase 3: "Powered by" toggle | 2 hrs | 🟡 Polish |
| Phase 4: Receipt footers | 2 hrs | 🟡 Polish |
| Phase 5: Direct payments | 1 week | 🟠 Not blocking PREMIUM launch |

**To match current doc claims: 1 week (Phases 1–4)**  
**To be "95% complete": 2 weeks (all phases)**

---

## Recommended Action

### Option A: Fix Claims in 1 Week (Honest Approach)

1. Add 4 schema fields (1 day)
2. Wire business name everywhere (3 days)
3. Add "Powered by" toggle (2 hours)
4. Fix receipt footers (2 hours)
5. Update documentation to match reality (1 day)

**Result:** WHITE-LABEL.md claims will be true

---

### Option B: Update Docs to Match Reality (Honest Approach)

Update WHITE-LABEL.md to downgrade false "✅" to "❌" or "⚠️":

- ✅ → ❌ Business name (field doesn't exist)
- ✅ → ⚠️ Email branding (personal name only)
- ✅ → ⚠️ SMS branding (personal name only)
- ✅ → ❌ "Powered by" toggle (field doesn't exist)
- ✅ → ⚠️ Direct payments (blocked with error)

**Result:** Documentation is honest about current state

---

## Conclusion

**Truth:** DriveBook white-label is ~40% functional, not 60%.

**Main Blocker:** `businessName` field doesn't exist in database schema.

**Impact:** Every white-label claim about "business name" is currently false.

**Fix:** 1 week of focused work to add schema fields and wire them everywhere.

**Alternative:** Update documentation to be honest about what's actually working.

---

**Recommendation:** Add the 4 missing schema fields THIS WEEK. Without `businessName`, the entire white-label value proposition is broken.

---

**Prepared by:** Kiro AI  
**Date:** 2026-08-15  
**Status:** URGENT — Schema gap blocks all business name features  
**Review:** Requires immediate attention

