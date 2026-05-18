# Instructor Dashboard — Gap Analysis & Fix Plan

**Inspected:** May 2026  
**Inspector:** Kiro  
**Status:** In progress — fixing step by step

---

## Pages Inspected

| Page | Route | File | Status |
|------|-------|------|--------|
| Dashboard Home | `/dashboard` | `app/dashboard/page.tsx` | ⚠️ Gaps found |
| Bookings List | `/dashboard/bookings` | `app/dashboard/bookings/page.tsx` | ✅ Good |
| Booking Detail | `/dashboard/bookings/[id]` | `app/dashboard/bookings/[id]/page.tsx` | ✅ Good |
| Clients | `/dashboard/clients` | `app/dashboard/clients/page.tsx` | ✅ Good |
| Earnings | `/dashboard/earnings` | `app/dashboard/earnings/page.tsx` | ✅ Good |
| Availability | `/dashboard/availability` | `app/dashboard/availability/page.tsx` | ✅ Good |
| Settings | `/dashboard/settings` | `app/dashboard/settings/page.tsx` | ⚠️ Gaps found |
| Profile | `/dashboard/profile` | `app/dashboard/profile/page.tsx` | ⚠️ Gaps found |
| Subscription | `/dashboard/subscription` | `app/dashboard/subscription/page.tsx` | ✅ Good |
| Analytics | `/dashboard/analytics` | `app/dashboard/analytics/page.tsx` | ⚠️ Gaps found |
| PDA Tests | `/dashboard/pda-tests` | `app/dashboard/pda-tests/page.tsx` | ✅ Good |
| Branding | `/dashboard/branding` | `app/dashboard/branding/page.tsx` | ✅ Good |
| Progress | `/dashboard/progress` | `app/dashboard/progress/page.tsx` | ⚠️ Missing API |
| Wallet | `/dashboard/wallet` | `app/dashboard/wallet/page.tsx` | ✅ Good |
| Help | `/dashboard/help` | `app/dashboard/help/page.tsx` | ✅ Good |

---

## Gaps Found

### IDASH-01: Dashboard Home — `Settings` icon not imported (build error)

**File:** `app/dashboard/page.tsx`  
**Severity:** 🔴 Critical — causes build/runtime error  
**Problem:** The Quick Actions section uses `<Settings className="h-6 w-6 mb-2" />` but `Settings` is not in the import list. Only `Calendar, Users, DollarSign, Car, TrendingUp, Clock, Wallet, Package, CreditCard` are imported.  
**Fix:** Add `Settings` to the lucide-react import.

---

### IDASH-02: Dashboard Home — CLIENT role links to `/my-bookings` (deleted page)

**File:** `app/dashboard/page.tsx`  
**Severity:** 🔴 Critical — broken link  
**Problem:** The CLIENT section has `<Link href="/my-bookings">View All</Link>`. The `/my-bookings` page was deleted in GAP-09. Should link to `/client-dashboard/bookings`.  
**Fix:** Change href to `/client-dashboard/bookings`.

---

### IDASH-03: Dashboard Home — CLIENT role "Completed Lessons" shown twice in stats

**File:** `app/dashboard/page.tsx`  
**Severity:** 🟡 Minor — UX issue  
**Problem:** The 4-stat grid for CLIENT shows "Completed Lessons" in slot 2 AND "Completed" in slot 4 — both show `completedBookings`. Slot 4 should show something different (e.g., pending reviews or total spend).  
**Fix:** Replace slot 4 with "Pending Reviews" count.

---

### IDASH-04: Dashboard Home — Instructor "Clients Needing Attention" Remind button links to `/dashboard/packages` not client

**File:** `app/dashboard/page.tsx`  
**Severity:** 🟡 Minor — UX issue  
**Problem:** The "Remind" button on the "Clients Needing Attention" card links to `/dashboard/clients` (generic list) instead of the specific client detail page.  
**Fix:** Link to `/dashboard/clients/${pkg.client.id}` so instructor can act directly.

---

### IDASH-05: Settings page — `alert()` used for success/error feedback

**File:** `app/dashboard/settings/page.tsx`  
**Severity:** 🟡 Minor — UX issue  
**Problem:** `handleSubmit` uses `alert('Settings saved successfully!')` and `alert('Failed to save...')`. This is jarring on mobile and inconsistent with the rest of the app which uses toast notifications.  
**Fix:** Replace `alert()` with an inline toast state (same pattern as availability page).

---

### IDASH-06: Profile page — Languages not editable

**File:** `app/dashboard/profile/page.tsx`  
**Severity:** 🟡 Minor — missing feature  
**Problem:** Languages are displayed as read-only badges with "Change in Settings page" note, but the Settings page has no language field either. There is no way for an instructor to set their languages.  
**Fix:** Add a language multi-select/tag input to the Profile page that saves via `PUT /api/instructor/profile`.

---

### IDASH-07: Profile page — License and Insurance numbers are read-only with no edit path

**File:** `app/dashboard/profile/page.tsx`  
**Severity:** 🟡 Minor — missing feature  
**Problem:** `licenseNumber` and `insuranceNumber` are shown as read-only with a link to `/setup/complete-profile`. That setup page may not exist or may not be accessible post-onboarding. Instructors need to be able to update these.  
**Fix:** Make these fields editable directly on the profile page (they are already in the `PUT /api/instructor/profile` payload).

---

### IDASH-08: Analytics page — no chart/visual, just numbers

**File:** `app/dashboard/analytics/page.tsx`  
**Severity:** 🟢 Low — enhancement  
**Problem:** The analytics page shows stat cards and a text summary but no visual trend chart. The "Performance Summary" section has a completion rate progress bar but nothing for revenue over time.  
**Note:** This is OPEN-10 in GAP_ANALYSIS.md — acceptable for launch. No action needed now.

---

### IDASH-09: Progress page — `/api/instructor/lesson-feedback/summary` route missing

**File:** `app/dashboard/progress/page.tsx`  
**Severity:** 🔴 Critical — API 404  
**Problem:** The progress page calls `GET /api/instructor/lesson-feedback/summary` but only `GET /api/instructor/lesson-feedback` (with `?bookingId=`) exists. The summary endpoint does not exist. The page gracefully shows a placeholder when the API returns null, so it doesn't crash — but the data is never shown even when feedback exists.  
**Fix:** Create `app/api/instructor/lesson-feedback/summary/route.ts` that aggregates feedback across all bookings for this instructor.

---

### IDASH-10: Mobile bottom nav — missing Progress and PDA Tests tabs

**File:** `components/instructor/MobileBottomNav.tsx`  
**Severity:** 🟡 Minor — navigation gap  
**Problem:** Mobile nav only has 5 tabs: Home, Bookings, Clients, Earnings, Availability. Progress and PDA Tests are only accessible via the desktop "More" dropdown. On mobile, instructors have no quick access to these.  
**Fix:** Replace "Availability" tab (accessible via Settings) with "More" tab that links to a full menu, OR swap one tab for PDA Tests (most used after bookings).  
**Decision:** Keep current 5 tabs but add PDA Tests as a 6th tab (scroll-able on mobile) — or swap Availability for PDA Tests since availability is less frequently accessed.

---

### IDASH-11: Earnings page — stale `.tsx` files in directory

**File:** `app/dashboard/earnings/`  
**Severity:** 🟢 Low — cleanup  
**Problem:** Directory contains `page-enhanced.tsx`, `page-old.tsx`, `page-verbose.tsx` alongside `page.tsx`. These are dead files that clutter the codebase.  
**Fix:** Delete the 3 stale files.

---

### IDASH-12: Dashboard Home — no subscription status banner for instructor

**File:** `app/dashboard/page.tsx`  
**Severity:** 🟡 Minor — missing feature  
**Problem:** The DASHBOARD.md spec says the dashboard should show a subscription status banner (trial days remaining, past due warning, etc.). The subscription page has this logic but the main dashboard home does not show any subscription status.  
**Fix:** Add a compact subscription status banner at the top of the instructor dashboard (trial warning, past due alert).

---

## Fix Order

| # | Gap | Priority | Status |
|---|-----|----------|--------|
| IDASH-01 | Missing `Settings` import | 🔴 Critical | ✅ Fixed |
| IDASH-02 | `/my-bookings` dead link | 🔴 Critical | ✅ Fixed |
| IDASH-09 | Missing lesson-feedback/summary API | 🔴 Critical | ✅ Fixed |
| IDASH-03 | Duplicate "Completed" stat | 🟡 Minor | ✅ Fixed |
| IDASH-04 | Remind button wrong link | 🟡 Minor | ✅ Fixed |
| IDASH-05 | Settings uses alert() | 🟡 Minor | ✅ Fixed |
| IDASH-06 | Languages not editable | 🟡 Minor | ✅ Fixed |
| IDASH-07 | License/Insurance read-only | 🟡 Minor | ✅ Fixed |
| IDASH-10 | Mobile nav missing PDA Tests | 🟡 Minor | ✅ Fixed |
| IDASH-11 | Stale earnings files | 🟢 Low | ✅ Fixed |
| IDASH-12 | No subscription banner on dashboard | 🟡 Minor | ✅ Fixed |
| IDASH-08 | No chart in analytics | 🟢 Low | ⏭️ Deferred (OPEN-10) |
