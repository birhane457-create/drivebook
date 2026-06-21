# Agent Instructions — DriveBook Project

**READ THIS EVERY NEW CHAT SESSION**

---

## Core Rules

### 1. Documentation System
- ✅ **DOCROLEBASE** is the PERMANENT documentation system
- ✅ Located: `docs/DOCROLEBASE/**/*.md`
- ✅ Reflects CURRENT code reality (no archives, no history)
- ✅ Single source of truth

### 2. TODO.md Workflow
- **Purpose:** Track work-in-progress items
- **Location:** `docs/DOCROLEBASE/TODO.md`
- **Sections:**
  - 🔄 PLANNED: Code exists, docs missing
  - 🔧 FIXES NEEDED: Code/docs mismatches
  - ✅ VERIFIED: Accurate (no changes needed)
  - 🚫 REMOVED: Deleted features (ignore)

### 3. Task Completion Process
When work is COMPLETE or FIXED:

1. ✅ **Update the permanent .md file** (in DOCROLEBASE)
   - Add verification date
   - Mark as ✅ VERIFIED or ✅ COMPLETE
   - Add audit notes
   - Example: `**Status:** ✅ VERIFIED COMPLETE (June 13, 2026)`

2. ✅ **Remove from TODO.md**
   - Delete the item entirely
   - Do NOT keep as archive

3. ❌ **Do NOT create temporary files**
   - No TASK_N_SUMMARY.md
   - No SESSION_COMPLETE.md
   - No AUDIT_REPORT.md
   - Only permanent DOCROLEBASE docs

### 4. File Management
- ✅ Keep DOCROLEBASE files (permanent)
- ✅ Keep TODO.md (temporary tracking)
- ❌ Delete all session/task/audit files
- ❌ No temporary documentation

### 5. When Starting New Chat
- 🔄 Read TODO.md to understand current state
- 🔄 Check DOCROLEBASE for permanent docs
- 🔄 Continue from last session's work
- ❌ Do NOT assume, re-read context

---

### 6. Creating New Documentation Files

Before creating ANY new .md file:

1. Search DOCROLEBASE for an existing document covering that feature.
2. If one exists, UPDATE IT.
3. Do NOT create a new document for:

   * audits
   * reviews
   * inspections
   * summaries
   * enhancements
   * fixes
   * session work

Create a new .md file ONLY if:

* The feature does not already have a permanent document.
* No suitable DOCROLEBASE document exists.

Examples:

Booking change:
✅ Update: 02-student/BOOKING_FLOW.md
❌ Do not create: BOOKING_FLOW_AUDIT.md

Instructor earnings change:
✅ Update: 03-instructor/EARNINGS.md
❌ Do not create: EARNINGS_REVIEW.md

Admin AI Copilot change:
✅ Update: 06-admin/AI_COPILOT.md
❌ Do not create: AI_COPILOT_STATUS.md

### 7. Documentation Hierarchy

Priority order:

1. Update existing DOCROLEBASE document
2. If work is not finished, track in TODO.md
3. Create a new DOCROLEBASE document ONLY if no suitable document exists

Default assumption:
UPDATE EXISTING DOCUMENTATION.
DO NOT CREATE NEW DOCUMENTATION.

## Current State (As of June 19, 2026)

### ✅ ALL IMPLEMENTATION TASKS COMPLETE
All 7 original implementation tasks are done and documented in DOCROLEBASE.
All 4 security issues (MEDIUM #4, #5, #6, #8) are fixed.
All cron jobs registered in vercel.json and auth-corrected.
TypeScript: 0 errors. No hardcoded prices. No fake content.

### ⏳ PENDING (In TODO.md)
- 9 config tasks in Vercel/Stripe/Google dashboards (no code changes needed)
- 1 deferred item: /blog — build 2 articles when ready

### ✅ VOICE SERVICE FIXES (June 19, 2026)
- `main-app-proxy.js` — startup crash fixed (generated-client-js path didn't exist). Rewrote to direct axios. Now sends `x-api-key` to authenticate against main app.
- `voice-webhook.js` — `getSession()`/`saveSession()` not awaited → every call triggered recovery. Fixed.
- `package.json` — added `axios` dependency.
- `.env.example` — completely rewritten with correct voice service vars.
- `contract.test.js` — replaced broken generated-client mock with axios mock. Session tests now use `await`.
- `voice-script.md` — OTP 4→6 digits. Booking reference prompts replaced with phone-only asks.
- `AI_VOICE_RECEPTIONIST_GUIDE.md` — removed `accountHolderPassword` from booking format.
- Webhook idempotency: now hard-fail (was soft-fail)
- Commission rate: locked at booking creation in both booking routes
- Email failure: SMS + in-app fallback added
- Slot double-booking: verified already fixed (inside $transaction)

### ✅ CRON FIXES APPLIED (June 19, 2026)
- 4 missing crons added to vercel.json (check-trial-expiry, send-trial-expiry-alerts, slot-cleanup, notifications)
- slot-cleanup and notifications cron auth bugs fixed (were returning 401 on every Vercel call)
- @ts-nocheck removed from bookingReminders.ts and packageExpiryAlerts.ts

### ✅ OTHER FIXES APPLIED (June 19, 2026)
- Trial emails: all prices/rates now from SUBSCRIPTION_PLANS config (no hardcoded values)
- 3-day trial reminder email added (was only 7-day + expiry)
- Subscription page banner: escalates at ≤3 days, shows payment nudge when no card added
- Fake testimonials removed from homepage (ACL risk)
- error.tsx: production now shows generic message (was exposing Prisma errors)
- .env.example: added NEXT_PUBLIC_VOICE_PHONE_NUMBER and NEXT_PUBLIC_COPILOT_DIRECT_LINE_TOKEN
- AIReceptionistShowcase: removed hardcoded US fallback phone number
- Mobile TODO stubs closed — Capacitor wrapper uses web UI, not separate native screens

---

## Example: Complete a Task

**BEFORE (In TODO.md):**
```
#### 1. Admin API Endpoints
- Code: ✅ Complete
- Status: ❌ Docs missing
- Where: 06-admin/ADMIN_API.md
```

**WORK DONE:**
- Write comprehensive docs
- Create: `docs/DOCROLEBASE/06-admin/ADMIN_API.md`

**AFTER (In TODO.md):**
- ✅ Remove entire item from PLANNED section
- Done

**In permanent doc (ADMIN_API.md):**
- Add header: `**Status:** ✅ VERIFIED COMPLETE (Date)`
- Keep doc live forever in DOCROLEBASE
- That's the official record

---

## What NOT to Do

❌ Create temporary audit files  
❌ Create temporary summary files  
❌ Create temporary status files  
❌ Keep items in TODO after completion  
❌ Mark items as "archived"  
❌ Keep history notes in docs  
❌ Duplicate documentation  

---

## Command for Next Chat

When starting next session, say:
> "I understand. TODO.md is temporary tracking. Permanent work goes in DOCROLEBASE. When complete, update the .md file, remove from TODO.md, no temp files. I'll follow this."

---

**Last Updated:** June 19, 2026 (full pre-production hardening session complete)

---

## Project Reality Notes (Update)

**Pricing policy (current code reality):**
- ✅ Supported: hourly lessons, platform bulk packages (6/10/15 hours), instructor PDA test pack (from dashboard settings)
- ❌ Not supported: instructor “special services”, custom add-on packages, `specialService*`, `customPackageId/customPackagePrice`

When updating docs, ensure `docs/DOCROLEBASE/01-public/BOOKING_FLOW.md`, `docs/DOCROLEBASE/01-public/SUBDOMAIN_PAGE.md`, `docs/DOCROLEBASE/03-instructor/BULK_BOOKING.md`, and `docs/DOCROLEBASE/03-instructor/PRICING.md` reflect this.

