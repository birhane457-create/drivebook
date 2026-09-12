# Receipt Tax Analysis - Who Is The Supplier?

**Date:** September 4, 2026  
**Issue:** Current receipts show "DriveBook — Tax Receipt" with DriveBook ABN  
**Question:** Is DriveBook the supplier, or is the instructor the supplier?

---

## Current Platform Architecture (PLATFORM Mode)

### Payment Flow
```
Student
   │
   │ $900 package purchase
   ▼
DriveBook Stripe Account
   │
   │ (holds prepaid value)
   ▼
Student books lesson from wallet
   │
   │ $180 wallet debit
   ▼
Lesson occurs
   │
   ▼
Instructor becomes payable
   │
   │ Commission calculation:
   │ - Lesson value: $180
   │ - DriveBook commission (10-15%): $18-$27
   │ - Instructor payout: $153-$162
   ▼
Weekly payout to instructor
```

### Key Question: Who Supplies The Driving Lesson?

**Option A: DriveBook is the supplier**
- Student contracts with DriveBook
- DriveBook engages instructor as independent contractor/agent
- Receipt shows: "Supplier: DriveBook, ABN: 23 806 069 420"
- GST: DriveBook collects/remits GST on full $900
- Commission is a business expense to DriveBook

**Option B: Instructor is the supplier**
- Student contracts with instructor
- DriveBook is payment processor/marketplace facilitator
- Receipt shows: "Supplier: [Instructor Name], ABN: [Instructor ABN]"
- GST: Instructor collects/remits GST (if registered)
- Commission is DriveBook's service fee

---

## ATO Tax Treatment

### If DriveBook Is The Supplier:
✅ **Correct receipt format (current):**
```
Tax Receipt
Supplier: DriveBook
ABN: 23 806 069 420
---
10-Hour Package: $900
Platform fee (3.6%): $32.40
GST included: $84.76
Total: $900
```

**Tax obligations:**
- DriveBook: Collect & remit GST on $900
- DriveBook: Commission paid to instructor is business expense
- Instructor: Receives $153-$162 as contractor income (no GST)

### If Instructor Is The Supplier:
❌ **Current receipt is WRONG:**
```
Tax Receipt
Supplier: [Instructor Name]          ← Changed
ABN: [Instructor ABN]                ← Changed
---
Driving lesson: $180
DriveBook service fee: $18-$27       ← Split shown
Subtotal: $163.64
GST: $16.36
Total: $180
```

**Tax obligations:**
- Instructor: Collect & remit GST on $180 (if registered)
- DriveBook: Collect & remit GST on $18-$27 service fee only
- Student: Two separate tax invoices (one from instructor, one from DriveBook)

---

## Commercial Reality Check

### Current Terms of Service (Need to Verify)
**CHECK THESE:**
1. Who does the student contract with? DriveBook or Instructor?
2. Who is legally responsible for lesson delivery?
3. What happens if instructor doesn't show up? DriveBook liable or instructor?
4. Does instructor have direct relationship with student outside platform?

### Marketplace vs Agency Model

**If MARKETPLACE (DriveBook is intermediary):**
- Student contracts with **Instructor**
- Instructor is supplier
- DriveBook facilitates payment (like Uber, Airbnb)
- Receipt should show instructor as supplier

**If AGENCY (DriveBook supplies via agents):**
- Student contracts with **DriveBook**
- DriveBook is supplier
- Instructor is DriveBook's agent/contractor
- Receipt should show DriveBook as supplier (current format correct)

---

## Critical Issue: Instructor ABN

Current implementation assumes DriveBook ABN for all receipts.

**Problem scenarios:**

### Scenario 1: Instructor is supplier + has ABN
❌ Receipt shows DriveBook ABN (wrong supplier)
✅ Should show instructor ABN

### Scenario 2: Instructor is supplier + NO ABN
❌ Receipt shows DriveBook ABN (wrong supplier)
⚠️ Should show instructor details but NO ABN field
⚠️ Student CANNOT claim GST credits (supplier not GST registered)

### Scenario 3: DriveBook is supplier
✅ Receipt shows DriveBook ABN (correct as-is)

---

## Wallet Booking Receipt - Special Case

Current wallet lesson receipt shows:
```
Lesson Booked from Wallet
2 hrs × $90/hr       $180
Paid from wallet    -$180
Charged to card        $0
```

**Tax treatment:**
- This is NOT a tax invoice (no new payment occurred)
- Original tax invoice was the package purchase
- This is a consumption/usage receipt only
- Should NOT show "GST included: $XX" (would imply double-taxation)

**Correct approach:**
- Remove "Tax Receipt" label from wallet bookings
- Call it "Booking Confirmation" or "Wallet Transaction Receipt"
- Show wallet balance movement, not tax details
- Reference original package purchase receipt for tax purposes

---

## Recommendations

### URGENT: Determine Supplier Identity

**Action Required:**
1. **Review Terms of Service** - Who does student contract with?
2. **Review Insurance** - Who carries liability insurance?
3. **Consult Tax Advisor** - Confirm marketplace vs agency model
4. **Check ATO Ruling** - Marketplace facilitator obligations

**DO NOT proceed with ABN changes until this is resolved!**

### Option A: If DriveBook Is Supplier (Agency Model)

✅ **Keep current receipt format with minor fixes:**
1. ✅ Use DriveBook ABN (23 806 069 420)
2. ✅ Show "Supplier: DriveBook" explicitly
3. ✅ Show GST on package/single lesson receipts
4. ❌ Remove "Tax Receipt" from wallet booking receipts
5. ✅ Clarify "Platform fee" is actually just Stripe processing (3.6%)

**GST obligations:**
- DriveBook collects & remits GST on full lesson price
- Commission to instructor is business expense (no GST)

### Option B: If Instructor Is Supplier (Marketplace Model)

❌ **Major receipt redesign required:**
1. Add `abnNumber` field to Provider/DrivingProviderProfile schema
2. Add `abnVerified` and `gstRegistered` fields
3. Receipt must show instructor ABN (not DriveBook)
4. Split GST calculation:
   - Lesson GST (instructor collects)
   - Platform fee GST (DriveBook collects)
5. Two tax invoices:
   - Instructor invoice for lesson
   - DriveBook invoice for platform fee

**GST obligations:**
- Instructor collects & remits GST on lesson (if registered)
- DriveBook collects & remits GST on platform fee only
- Student gets TWO tax invoices

---

## Impact on Current Implementation

### If Agency Model (DriveBook is supplier):
**Effort:** LOW (minor changes)
- ✅ ABN already added (correct)
- ✅ GST calculation added
- ❌ Fix wallet receipts (remove tax invoice label)
- ❌ Add explicit "Supplier: DriveBook" to receipts

### If Marketplace Model (Instructor is supplier):
**Effort:** HIGH (major redesign)
- ❌ New schema fields (abnNumber, abnVerified, gstRegistered)
- ❌ ABN collection flow (instructor onboarding)
- ❌ ABN verification API integration (ABR Lookup)
- ❌ Receipt service rewrite (conditional supplier logic)
- ❌ Dual tax invoice generation
- ❌ Split GST remittance (instructor + DriveBook)
- ❌ Instructor tax reporting (BAS integration guidance)
- ❌ Customer education (two invoices, complex)

---

## Decision Required

**BLOCKER:** Cannot finalize receipt implementation until supplier identity confirmed.

**Next Steps:**
1. **Review ToS with legal** - Clarify contractual relationships
2. **Consult accountant/tax advisor** - Confirm tax treatment
3. **Check existing instructor agreements** - What do they say?
4. **Make architectural decision** - Agency or Marketplace?
5. **Update receipts accordingly**

**Timeline:**
- **If Agency:** 2-4 hours to fix wallet receipts + add explicit supplier
- **If Marketplace:** 2-3 weeks to implement full instructor ABN flow

---

## Temporary Solution (Production Unblocking)

**IF URGENTLY NEED TO GO LIVE:**

1. **Assume Agency Model** (DriveBook is supplier)
2. Keep current receipts with DriveBook ABN
3. Add disclaimer: "DriveBook provides driving lesson services via contracted instructors"
4. Document assumption in ToS
5. **Schedule legal/tax review post-launch**

**Risk:** If actually marketplace model, receipts are non-compliant and must be reissued.

---

**Status:** ⚠️ BLOCKED - Awaiting supplier identity clarification  
**Priority:** 🔴 CRITICAL - Blocks production tax compliance  
**Owner:** Product/Legal/Finance team decision required