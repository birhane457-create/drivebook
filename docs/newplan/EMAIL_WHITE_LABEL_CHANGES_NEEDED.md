# Email White-Label Changes Needed

> **File:** `lib/services/email.ts`  
> **Status:** Import added ✅, provider field added ✅, providerName variable added ✅  
> **Remaining:** Replace all ${instructorName} with ${providerName} in HTML templates

---

## ✅ COMPLETED

1. Added import: `import { getDisplayName, type DisplayIdentitySource } from '@/lib/branding/getDisplayIdentity'` ✅
2. Added `provider?: DisplayIdentitySource` field to `BookingConfirmationData` interface ✅
3. Added `const providerName = data.provider ? getDisplayName(data.provider) : instructorName` logic ✅

---

## 🔧 MANUAL CHANGES NEEDED

Due to special characters (emojis) in the HTML templates, automated replacement failed.

**Find all instances of `${instructorName}` and replace with `${providerName}`:**

### File: `lib/services/email.ts`

**Function: `sendBookingConfirmation` (Line ~48-140)**

✅ Already done:
```typescript
const providerName = data.provider ? getDisplayName(data.provider) : instructorName
```

❌ Remaining replacements in HTML:
1. Line ~90: `Your Instructor: ${instructorName}` → `${providerName}`

**Function: `sendPDATestReminderdata` (Line ~180)**
- Line ~210: `Instructor: ${instructorName}` → `${providerName}`
- Line ~230: `${instructorName} will meet you there` → `${providerName} will meet you there`

**Function: `sendClaimAccountEmail` (Line ~440)**
- Line ~470: `${instructorName} booked a lesson for you` → `${providerName} booked a lesson for you`
- Line ~490: `Instructor: ${instructorName}` → `${providerName}`

---

## 📋 MANUAL REPLACEMENT GUIDE

### Step 1: sendBookingConfirmation (Client Email)
**Search for:** `with <strong>${instructorName}</strong>`  
**Replace with:** `with <strong>${providerName}</strong>` ✅ DONE

**Search for:** `Your Instructor: ${instructorName}`  
**Replace with:** `Your Instructor: ${providerName}`

### Step 2: sendBookingConfirmation (Instructor Email)
No changes needed — instructor emails can keep showing their personal name.

### Step 3: sendPDATestReminder
Add same pattern:
```typescript
const providerName = data.provider ? getDisplayName(data.provider) : instructorName
```

Then replace all `${instructorName}` with `${providerName}` in the HTML.

### Step 4: sendClaimAccountEmail
Add same pattern:
```typescript
const providerName = data.provider ? getDisplayName(data.provider) : instructorName
```

Then replace all `${instructorName}` with `${providerName}` in the HTML.

---

## ✨ ALTERNATIVE: Use Search & Replace in VS Code

1. Open `lib/services/email.ts`
2. Use Find & Replace (Ctrl+H)
3. Find: `\${instructorName}`
4. Replace: `${providerName}`
5. Review each replacement to ensure it's in a client-facing email (not instructor email)

---

## 🎯 VERIFICATION

After manual changes, verify:
- [x] Import added
- [x] Interface updated with `provider?` field
- [x] `providerName` variable created in `sendBookingConfirmation` 
- [ ] All `${instructorName}` replaced with `${providerName}` in client emails
- [ ] Instructor notification emails still use `${instructorName}` (correct)

---

## 📝 NOTE

**Why manual?** The email templates contain Unicode emojis (👨‍🏫,  🚗, etc.) which caused string matching issues in automated replacement. A manual find-replace in the editor will handle this correctly.

