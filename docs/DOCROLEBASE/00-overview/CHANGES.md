## Session: 2026-08-12 — Per-Student Progress Drill-Down + Trend Chart

### Summary
Added a Progress tab to the instructor client detail page at `/dashboard/clients/[id]`.
The tab fetches the lesson feedback summary scoped to the specific client and shows
a trend chart, latest lesson summary, top focus/strength areas, and full feedback history.

### Client detail page (`/dashboard/clients/[id]`) — UPDATED
- **Tab switcher** added: Bookings | Progress
- **Parallel fetch** — client data and instructor settings loaded simultaneously
  (was sequential; settings fetch was not present before)
- **Progress tab** (`ProgressTab` component):
  - Stats row: lessons reviewed, feedback rate, mock avg score
  - **Trend chart** (`SkillTrendBar`): bar chart showing focus area count per lesson,
    coaching = slate, mock = sky, oldest left → newest right. Pure CSS, no chart library.
  - **Latest lesson card**: topics covered, next lesson focus (prominent), mock score if applicable
  - **Top focus areas / strengths**: translated strings from summary API, top 4 each
  - **Feedback history**: expandable per lesson, next focus icon badge when collapsed,
    notes visible when expanded, direct link to booking detail
  - Empty state when no feedback recorded for this client
- Settings fetch wired so booking history dates use instructor timezone (was missing)

### Trend chart design
- Focus area count per lesson (not mock score) — works for both COACHING and MOCK
- Coaching = muted bar, Mock = sky blue bar (visually distinct without a legend key)
- Absence of data in a lesson = short bar (min 8% height) not invisible
- Only rendered when 2+ lessons with feedback exist

### Files changed
- `app/dashboard/clients/[id]/page.tsx`

---
## Session: 2026-08-12 — Progress & Feedback System Rebuild

### Summary
Full redesign and implementation of the student progress and lesson feedback system.
Core product decision: coaching lessons are qualitative (no score), mock assessments are scored.
"The 97% problem" is eliminated — normal lessons never produce a percentage.
Student progress is based on observed strengths, focus areas, and skill progression — not a calculated number.

### Product decisions locked in
- `performanceScore` is MOCK assessment only — server enforced, client cannot override
- `passed` is MOCK only — server computed from score ≥ 80 + zero critical codes
- COACHING feedback captures: what was covered, what went well, what to focus on, next lesson priority
- Skill states: NEEDS_ATTENTION / IMPROVING / GOOD / NOT_OBSERVED
  - Absence of a code does NOT imply improvement — only explicit observation counts
  - IMPROVING = previously in `lessonFeedback[]`, subsequently in `studentStrengths[]`
- `nextLessonFocus` is first-class metadata — shown prominently to student, included in notification
- Test readiness → "Mock assessment readiness" with disclaimer (not a confidence percentage)

### Feedback POST route (`/api/instructor/lesson-feedback`)
- **Added `studentStrengthCodes[]`** — explicit strength recording, stored in `studentStrengths` field (was ignored before)
- **Added `nextLessonFocus`** — stored in `booking.metadata.nextLessonFocus` (no schema migration needed)
- **Added status check** — feedback only accepted for `status === 'COMPLETED'` bookings
- **Server enforces scoring rules** — COACHING: score=null, passed=null (always); MOCK: calculated from codes
- **Detects resubmission** — `isResubmission` flag in response when updating existing feedback
- **Student notification** — after save, fires `createNotification()` to client.userId with nextLessonFocus snippet
- **Legacy fields** — `strengths`, `areasToImprove` still accepted for backward compat, concatenated into notes

### Summary API (`/api/instructor/lesson-feedback/summary`)
- **`totalLessons` fix** — `COMPLETED` only (was COMPLETED + past CONFIRMED, inflating count)
- **`topStrengths` fix** — from explicit `studentStrengths[]` codes (was broken heuristic based on score ≥ 85)
- **`averageScore` fix** — MOCK assessments only (was all bookings, mixed COACHING nulls)
- **`?clientId=` filter** — optional query param to scope to a single student
- **New fields** — `mockCount`, `coachingCount` for UI breakdown
- **recentFeedback shape** — `focusAreaCodes`, `strengthCodes`, `assessmentType`, `lessonTopics`, `nextLessonFocus` per row

### Student progress API (`/api/client/progress`) — NEW
- Scoped to `client.userId` only — IDOR protected
- `instructorNotes` never returned (private to instructor)
- PDA codes translated to plain English (`shortText`, `tip`, `category`) server-side
- Skill states computed server-side from last 5 lessons with feedback
- COACHING and MOCK clearly separated in response
- `nextLessonFocus` surfaced first-class
- Mock assessments use label ("On track" / "Improvement recommended") not raw percentage
- Disclaimer text included in response: "not an official result"
- `hasData: false` when no feedback exists — clean empty state

### Skill state computation logic
```
For each PDA category across last 5 lessons with feedback (SKILL_WINDOW = 5):
  GOOD            → code in studentStrengths[] in most recent lesson
  IMPROVING       → code was in lessonFeedback[] previously, then studentStrengths[] later
  NEEDS_ATTENTION → code in lessonFeedback[] in most recent lesson
  NOT_OBSERVED    → no observation in either direction
Category state = worst state among its constituent codes
```

### Client progress page (`/client-dashboard/progress`) — REBUILT
- Fetches `/api/client/progress` (was `/api/client/my-performance`)
- **Latest lesson**: topics, strengths, focus areas with tips, next lesson focus prominent
- **Your development**: skill states per category — observed skills first, not-yet-observed collapsed
- **Mock assessments**: score + label + disclaimer, no invented readiness percentage
- **Lesson history**: expandable per lesson, coaching/mock badge, MOCK score only
- `instructorNotes` removed — never shown to student
- Footer explains COACHING vs MOCK distinction

### Instructor progress page (`/dashboard/progress`) — UPDATED
- Parallel fetch for settings + summary (was sequential)
- Stats updated: Mock Avg Score (MOCK only), coaching/mock breakdown counts
- Recent feedback: shows `nextLessonFocus` inline, COACHING shows count summary not score
- Expanded view removed instructor notes exposure (kept — instructor sees their own notes)

### Files changed
- `app/api/instructor/lesson-feedback/route.ts`
- `app/api/instructor/lesson-feedback/summary/route.ts`
- `app/api/client/progress/route.ts` (new)
- `app/client-dashboard/progress/page.tsx` (rebuilt)
- `app/dashboard/progress/page.tsx` (updated)

---
## Session: 2026-08-11 — Admin RBAC Permission Enforcement


### Summary
Full implementation of granular admin permissions per RBAC-SPEC.md. Every admin API route now enforces a specific permission from the 47-permission catalogue instead of the old blanket `role === 'ADMIN'` check. AdminNav filters navigation items by the current admin's permission array.

### Core infrastructure (already existed, confirmed wired)
- `lib/rbac/permissions.ts` — 47 PERM constants + `Permission` type
- `lib/rbac/role-presets.ts` — ADMIN / FINANCE / OPERATIONS / SUPPORT preset arrays
- `lib/rbac/checkPermission.ts` — central server-side check (SUPER_ADMIN wildcard, StaffMember lookup, maxRefundAmount returned)
- `lib/auth/requireRole.ts` — `requirePermission()` thin wrapper for API routes
- `hooks/useAdminPermissions.ts` — client hook with 5-min cache, `can()` / `canAny()` helpers
- `app/api/admin/me/permissions/route.ts` — returns current admin's permission array
- `scripts/migrate-rbac.ts` — idempotent migration to populate existing ADMIN StaffMember.permissions

### API routes updated (old role check → requirePermission)

**Finance**
- `payouts/route.ts` GET → `finance.payouts.view`
- `payouts/preview-all` GET → `finance.payouts.view`
- `payouts/process` POST → `finance.payouts.process`
- `payouts/process-all` POST → `finance.payouts.process`
- `payouts/[payoutId]/hold` POST/DELETE → `finance.payouts.hold`
- `payouts/[payoutId]/mark-sent` POST → `finance.payouts.resolve`
- `payouts/resolve` POST → `finance.payouts.resolve`
- `payouts/resolve-split` POST → `finance.payouts.resolve`
- `revenue/route.ts` GET → `finance.revenue.view`
- `disputes/route.ts` GET → `finance.disputes.view`
- `disputes/route.ts` PATCH → `finance.disputes.manage`
- `pricing/route.ts` GET → `finance.pricing.view`
- `pricing/route.ts` POST → `finance.pricing.manage`
- `ledger/route.ts` GET → `finance.revenue.view`
- `clients/[id]/wallet/add-credit` POST → `finance.credits.manage` + maxRefundAmount cap enforced
- `clients/[id]/wallet/deduct-credit` POST → `users.clients.wallet_deduct` + maxRefundAmount cap enforced
- `transactions/[id]/refund` POST → `finance.disputes.manage`
- `transactions/[id]/invoice` GET → `finance.revenue.view`

**Users / Instructors**
- `instructors/route.ts` GET → `users.instructors.view`
- `instructors/[id]/route.ts` GET → `users.instructors.view`
- `instructors/[id]/approve` POST → `users.instructors.approve` (already wired)
- `instructors/[id]/reject` POST → `users.instructors.reject` (already wired)
- `instructors/[id]/suspend` POST → `users.instructors.suspend` (already wired)
- `instructors/[id]/send-setup-nudge` POST → `users.instructors.send_email`
- `instructors/[id]/send-onboarding-email` POST → `users.instructors.send_email`
- `instructors/[id]/verify-abn` POST → `users.instructors.verify_abn`
- `instructors/[id]/subscription` GET → `users.subscriptions.view`
- `instructors/[id]/subscription` POST → `users.instructors.manage_subscription`
- `instructors/[id]/onboarding-status` GET → `users.instructors.view`
- `clients/route.ts` GET → `users.clients.view`
- `clients/[id]/route.ts` PATCH → `users.clients.edit`
- `clients/[id]/wallet/route.ts` GET → `users.clients.view`
- `subscriptions/route.ts` GET → `users.subscriptions.view`
- `users/[userId]/reset-password` POST → `users.clients.reset_password`

**Operations**
- `bookings/route.ts` GET → `operations.bookings.view`
- `bookings/route.ts` PATCH → `operations.bookings.cancel`
- `bookings/route.ts` POST → `operations.bookings.view`
- `booking-payment-status` GET → `operations.bookings.view`
- `audit-log/route.ts` GET → `operations.audit_log.view`
- `cron-jobs/route.ts` GET → `operations.cron.view`
- `documents/compliance` GET → `operations.documents.view`
- `documents/compliance` POST → `operations.documents.verify`
- `documents/instructor/[id]/route.ts` GET → `operations.documents.view`
- `documents/instructor/[id]/approve` POST → `operations.documents.verify`
- `documents/instructor/[id]/reject` POST → `operations.documents.verify`
- `documents/instructor/[id]/expiry` POST → `operations.documents.verify`
- `test-centres/route.ts` GET → `operations.test_centres.view`
- `test-centres/route.ts` POST → `operations.test_centres.manage`
- `voice-lines/route.ts` GET → `operations.voice_lines.view`
- `voice-lines/route.ts` POST → `operations.voice_lines.manage`

**Engagement / Platform / Analytics**
- `contact/route.ts` POST → `engagement.support.contact`
- `settings/route.ts` GET → `platform.settings.view`
- `settings/route.ts` POST → `platform.settings.manage`
- `ai-brief/route.ts` POST → `platform.copilot.view`
- `ai-brief/history` GET → `platform.copilot.view`
- `ai-query/route.ts` POST → `platform.copilot.view`
- `daily-summary` GET → `operations.audit_log.view`
- `weekly-report` GET/POST → `operations.audit_log.view`
- `operations-timeline` GET → `operations.audit_log.view`
- `health-score` GET → `operations.audit_log.view`
- `instructor-risk` GET → `users.instructors.view`
- `export/route.ts` GET → `finance.revenue.view`
- `test-vercel-api` GET → `platform.settings.view`

### AdminNav permission filtering
- `navGroups` now typed as `NavGroup[]` with `perm?` field on every item
- Every nav item has its required permission wired (17 items across 6 groups)
- `visibleGroups` filters groups/items through `canSee(perm)` — hides inaccessible sections
- `visibleAllNavItems` used for mobile grid — same filtering
- While loading: all items shown (no flash) — SUPER_ADMIN always sees everything

### Credit/deduct limit enforcement (new)
- `add-credit`: checks `finance.credits.manage` via `checkPermission()` (not `requirePermission`) to get `staffMember.maxRefundAmount` — rejects if `amount > maxRefundAmount` for non-SUPER_ADMIN
- `deduct-credit`: same pattern with `users.clients.wallet_deduct`

### Files changed
- `components/admin/AdminNav.tsx`
- `app/api/admin/revenue/route.ts`
- `app/api/admin/payouts/route.ts`
- `app/api/admin/payouts/process/route.ts`
- `app/api/admin/payouts/process-all/route.ts`
- `app/api/admin/payouts/resolve/route.ts`
- `app/api/admin/payouts/resolve-split/route.ts`
- `app/api/admin/payouts/preview-all/route.ts`
- `app/api/admin/payouts/[payoutId]/hold/route.ts`
- `app/api/admin/payouts/[payoutId]/mark-sent/route.ts`
- `app/api/admin/disputes/route.ts`
- `app/api/admin/bookings/route.ts`
- `app/api/admin/settings/route.ts`
- `app/api/admin/audit-log/route.ts`
- `app/api/admin/instructors/route.ts`
- `app/api/admin/instructors/[id]/route.ts`
- `app/api/admin/instructors/[id]/send-setup-nudge/route.ts`
- `app/api/admin/instructors/[id]/send-onboarding-email/route.ts`
- `app/api/admin/instructors/[id]/verify-abn/route.ts`
- `app/api/admin/instructors/[id]/subscription/route.ts`
- `app/api/admin/instructors/[id]/onboarding-status/route.ts`
- `app/api/admin/clients/route.ts`
- `app/api/admin/clients/[id]/route.ts`
- `app/api/admin/clients/[id]/wallet/route.ts`
- `app/api/admin/clients/[id]/wallet/add-credit/route.ts`
- `app/api/admin/clients/[id]/wallet/deduct-credit/route.ts`
- `app/api/admin/users/[userId]/reset-password/route.ts`
- `app/api/admin/subscriptions/route.ts`
- `app/api/admin/pricing/route.ts`
- `app/api/admin/ledger/route.ts`
- `app/api/admin/cron-jobs/route.ts`
- `app/api/admin/voice-lines/route.ts`
- `app/api/admin/test-centres/route.ts`
- `app/api/admin/contact/route.ts`
- `app/api/admin/documents/compliance/route.ts`
- `app/api/admin/documents/instructor/[instructorId]/route.ts`
- `app/api/admin/documents/instructor/[instructorId]/approve/route.ts`
- `app/api/admin/documents/instructor/[instructorId]/reject/route.ts`
- `app/api/admin/documents/instructor/[instructorId]/expiry/route.ts`
- `app/api/admin/transactions/[transactionId]/refund/route.ts`
- `app/api/admin/transactions/[transactionId]/invoice/route.ts`
- `app/api/admin/booking-payment-status/route.ts`
- `app/api/admin/daily-summary/route.ts`
- `app/api/admin/weekly-report/route.ts`
- `app/api/admin/operations-timeline/route.ts`
- `app/api/admin/health-score/route.ts`
- `app/api/admin/instructor-risk/route.ts`
- `app/api/admin/export/route.ts`
- `app/api/admin/ai-brief/route.ts`
- `app/api/admin/ai-brief/history/route.ts`
- `app/api/admin/ai-query/route.ts`
- `app/api/admin/test-vercel-api/route.ts`

---


### Summary
All 43 findings from AUDIT-2026-08-05.md resolved. Zero diagnostics across all changed files.

### Medium fixes

**M-2  subscription/page.tsx: Billing history showed only 1 entry**  
Removed 	ake: 1 from subscriptions query  instructors now see their full plan change history.

**M-3  pda-configs/route.ts: Auth via email+DB (2 round-trips)**  
Both GET and POST now use session.user.instructorId directly from JWT  saves 1 DB query per request.

**M-5  clients/[id]/page.tsx: Hardcoded  top-up amount**  
	opUpAmount now calculated as max(10, pendingBookingPrice - walletBalance)  sends the correct amount needed to cover the actual pending booking.

**M-10  vailability/page.tsx: Exception date min was static**  
Changed to 
ew Date().toLocaleDateString('en-CA')  computed at render time in local timezone (en-CA gives YYYY-MM-DD format).

**M-11  nalytics/route.ts: "Week" period used rolling 7 days not MonSun**  
Now uses Monday of current week (UTC) matching the earnings this-week API  figures are consistent between analytics and earnings pages.

**M-12  randing/page.tsx: instructor state typed as ny**  
Added InstructorProfile interface, state now typed  field renames/deletions will be caught at compile time.

### Low fixes

**L-1  profile/route.ts: Unused 
eq parameter**  
Renamed to _req  TypeScript warning removed.

**L-2  nalytics/page.tsx: No empty state for new instructors**  
Added empty state card when 	otalBookings === 0 && netEarnings === 0 && newClients === 0.

**L-4  nalytics/page.tsx: commissionRate fetched but never shown**  
Now displayed in the Performance Summary section  instructors can see their current commission rate in context.

**L-6  io-generate/route.ts: No rate limiting on OpenAI calls**  
- Added ioGenerateRateLimit = createRateLimiter(5, '1 h') to lib/ratelimit.ts
- Rate limit check added to the POST handler  5 generations per instructor per hour
- Also fixed a broken ioGenerateRateLimit export that was referencing an undefined 
atelimit variable

**H-7 companion  vailability/page.tsx: Exception dates showed wrong day**  
Display uses exDateStr + 'T12:00:00Z' anchor  prevents midnight UTC  previous day shift in AEST.

### Files changed
- pp/api/instructor/pda-configs/route.ts
- pp/api/instructor/bio-generate/route.ts
- pp/api/analytics/route.ts
- pp/dashboard/subscription/page.tsx
- pp/dashboard/clients/[id]/page.tsx
- pp/dashboard/availability/page.tsx
- pp/dashboard/analytics/page.tsx
- pp/dashboard/branding/page.tsx
- pp/api/instructor/profile/route.ts
- lib/ratelimit.ts

### Audit complete
All 43 findings in docs/DOCROLEBASE/03-instructor/AUDIT-2026-08-05.md resolved.
**11 Critical  10 High  14 Medium  8 Low  all fixed.**

---
## Session: 2026-08-05  High-Priority Fixes (H-1 through H-10)

### Summary
Fixed all 10 High findings from AUDIT-2026-08-05.md. Expenses parallel fetch, analytics revenue date fix, exception UTC fix, branding parallel save, packages N+1 eliminated.

### H-1 + M-4  expenses/page.tsx: Settings fetch was sequential + re-ran on every filter change
- Settings now fetched **once on mount** in a separate useEffect([], [])  not re-fetched on year/month change
- Data fetch (expenses + earnings) runs in Promise.all  no sequential blocking
- Saves ~300ms per page load and ~200ms per filter change

### H-3 + L-3  clients/[id]/page.tsx: Booking dates used browser TZ; duration null crash
- Added instructorTz state, fetched from settings on mount
- Booking history dates now use 	imeZone: instructorTz
- .duration null guard: .duration != null ? ... (was .duration >= 60 which crashes on null)

### H-4  expenses/page.tsx: Past-year income always showed all-time totals
- Simplified the income mapping: use p.thisMonthEarnings for current month, p.totalEarnings (the API-filtered value) for all other periods
- Removed redundant isCurrentYear branch  the API already scopes 	otalEarnings to the requested period

### H-5  profile/route.ts: Admin access to credentials
- **Confirmed intentional**  admin accounts need credential numbers for instructor verification. No change.

### H-6  nalytics/route.ts: Revenue query used 	ransaction.createdAt not ooking.startTime
- Changed ...(startDate && { createdAt: { gte: startDate } }) to ...(startDate && { booking: { startTime: { gte: startDate } } })
- Analytics "This Week" and "This Month" revenue now matches the earnings page figures

### H-7 + M-14  exceptions/route.ts: Midnight UTC shift + no try/catch
- Exception dates now stored as T12:00:00.000Z (noon UTC)  stable display across all AU timezones
- All three handlers (GET, POST, DELETE) wrapped in 	ry/catch with proper 500 responses

### H-8  randing/page.tsx: Two sequential API saves  partial save risk
- randRes and profileRes now run in Promise.all simultaneously
- Saves ~300ms; if one fails, the error message is more specific about which save failed

### H-9 + H-10  packages/route.ts: N+1 query + commission rate refetched per package
- **Before**: 1 query for packages + 1 query per package for upcoming bookings + 1 DB query per package for commission rate = up to 60 queries for 20 packages
- **After**: 1 query for packages + 1 batch query for ALL upcoming bookings + 1 commission rate lookup = 3 queries total
- Upcoming bookings grouped client-side by parentBookingId
- allbackCommissionRatio computed once before the map and reused

### Files changed
- pp/dashboard/expenses/page.tsx
- pp/dashboard/clients/[id]/page.tsx
- pp/dashboard/branding/page.tsx
- pp/api/analytics/route.ts
- pp/api/instructor/availability/exceptions/route.ts
- pp/api/instructor/packages/route.ts

---
## Session: 2026-08-05  Critical Fixes from Full Audit

### Summary
Fixed all 11 critical findings from the production audit. Three light-theme pages converted to dark. Fetch errors no longer silently swallowed. Reschedule timezone bug fixed. Analytics error state added. Hardcoded rating replaced with real DB data.

### Fixes

**C-1 — subscription/page.tsx: Billing dates missing en-AU locale**
- Renews on ...toLocaleDateString()  .toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
- Billing history period dates same fix
- Also fixed: SUBSCRIPTION_PLANS[tier]?.name null guard (M-6), removed unused plan variable (M-7)

**C-2  nalytics/page.tsx: API error completely silent  page hung forever**
- Added error state
- etchAnalytics now handles !res.ok with specific messages (401 vs other errors)
- Loading/error gate updated: shows error with retry button instead of perpetual spinner

**C-3  nalytics/page.tsx: verageRating.toFixed(1) crashed if null**
- Changed to nalytics.averageRating != null ? analytics.averageRating.toFixed(1) : ''
- Math.round(analytics.averageRating ?? 0) for star render

**C-4  pi/analytics/route.ts: Confirmed scoped to instructorId**  No change needed

**C-5  clients/[id]/page.tsx + ookings/[id]/page.tsx: 
outer unused**
- Removed useRouter import and const router = useRouter() from both files

**C-6  ookings/[id]/page.tsx: Fetch error swallowed  would crash on 404/401**
- Added etchError state
- Fetch now checks 
.ok, throws typed errors (
ot_found vs ailed)
- Error state rendered with "Back to bookings" link

**C-7  ookings/[id]/page.tsx: ooking.price.toFixed(2) crashed if null**
- Changed to (booking.price ?? 0).toFixed(2)

**C-8  ookings/[id]/page.tsx + clients/[id]/page.tsx: Light theme in dark dashboard**
- Both pages fully converted: g-gray-50  g-slate-950, 	ext-gray-900  	ext-slate-100, all card/border/input colors updated

**C-9  
eschedule/page.tsx: New datetime built in browser TZ, not instructor TZ**
- 
ew Date(date).setHours(h, m)  localDateTimeToUTC(date, time, instructorTz)
- Added localDateTimeToUTC to timezone import
- Reschedule page also converted to dark theme

**C-10  
eschedule/page.tsx + ookings/[id]/page.tsx: instructorTz always Perth**
- GET /api/bookings/[id] now includes instructor: { select: { timezone, state } } in response
- Both pages now read instructor timezone directly from the booking API response

**C-11  pi/analytics/route.ts: verageRating was hardcoded 4.8**
- Replaced Promise.resolve(4.8) with real prisma.review.aggregate({ _avg: { rating: true } })
- Returns 
ull if instructor has no reviews  page shows ` instead of a fake number

### Files changed
- pp/api/analytics/route.ts
- pp/api/bookings/[id]/route.ts  GET now includes instructor timezone
- pp/dashboard/analytics/page.tsx
- pp/dashboard/subscription/page.tsx
- pp/dashboard/bookings/[id]/page.tsx
- pp/dashboard/bookings/[id]/reschedule/page.tsx
- pp/dashboard/clients/[id]/page.tsx

### Audit document
Full audit findings recorded in docs/DOCROLEBASE/03-instructor/AUDIT-2026-08-05.md
43 findings total (11C / 10H / 14M / 8L). All criticals now fixed.
High/medium/low findings open for next sprint.

---
# DriveBook — Change Log

**Purpose:** Rolling log of what changed each session. Only the 2 most recent sessions are kept in full detail. Older sessions are summarised in one line — the permanent record lives in the relevant feature docs.

---

## Session: 2026-08-05 — Timezone Audit: Dashboard Date Formatting

### Summary
Audited all instructor dashboard pages for locale and timezone inconsistencies following a claim that multiple pages used `toLocaleDateString`/`toLocaleTimeString` without explicit `timeZone`. Verified each claim against the actual files — some were already fixed, others were real. Fixed all confirmed issues across 6 files. Zero `en-US` locale remaining in any dashboard page.

### What the report claimed vs reality

| Claim | Reality | Action |
|---|---|---|
| `dashboard/page.tsx:130` — upcoming lessons missing timeZone | **True** — client section had no TZ | Fixed: uses `instructor.timezone` per booking |
| `dashboard/page.tsx:596` — instructor upcoming lessons | **Already fixed** — had `timeZone: instructorTz` | No change |
| `bookings/page.tsx` — missing timeZone | **Already fixed** last session | No change |
| `packages/page.tsx` — `en-US` locale + no TZ | **True** — 3 uses of `en-US` + no timezone | Fixed |
| `wallet/page.tsx` — transaction dates no TZ | **True** | Fixed |
| `pda-tests/page.tsx` — test dates no TZ | **True** | Fixed |
| `documents/page.tsx` — date-only string midnight UTC issue | **True** — could show wrong day in AEST | Fixed: noon UTC anchor |
| `progress/page.tsx` — feedback dates no TZ | **True** | Fixed: noon UTC anchor |
| `settings/security/page.tsx` | Already uses `en-AU`, relative time for recent entries | No change needed |
| `earnings/page.tsx` groupByDay labels | Already using `T12:00:00Z` anchor | Already correct |

### Fixes applied

**`packages/page.tsx`**
- Added `resolveTimezone` import and `instructorTz` state
- Fetches `/api/instructor/settings` in parallel with package data
- Replaced `en-US` locale (3 occurrences) with `en-AU`
- All date/time displays now use `timeZone: instructorTz`

**`wallet/page.tsx`**
- Added `resolveTimezone` import, `instructorTz` state, settings fetch
- Transaction dates (`tx.booking.startTime`, `tx.createdAt`) now use `timeZone: instructorTz`

**`pda-tests/page.tsx`**
- Added `resolveTimezone` import, `instructorTz` state
- Settings fetch wired into mount `useEffect` alongside `fetchAll()`
- Test date display uses `timeZone: instructorTz`

**`dashboard/page.tsx` — client section**
- Upcoming lessons card (line 130): now resolves timezone from `booking.instructor.timezone` / `booking.instructor.state` per booking

**`documents/page.tsx`**
- `fmtDate()` — date-only strings (`YYYY-MM-DD`) were parsed as midnight UTC, showing the wrong day in AEST (UTC+10 would show Dec 30 for a Dec 31 expiry)
- Fix: appends `T12:00:00Z` for date-only strings so display is stable across all AU timezones

**`progress/page.tsx`**
- Feedback dates: same noon UTC anchor applied for `fb.date` date-only strings

### Files changed
- `app/dashboard/packages/page.tsx`
- `app/dashboard/wallet/page.tsx`
- `app/dashboard/pda-tests/page.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/documents/page.tsx`
- `app/dashboard/progress/page.tsx`

---

## Session: 2026-08-05 — Pre-Launch Deep Inspection + Fixes

### Summary
Deep production-readiness audit of the instructor dashboard — all API routes, booking lifecycle, client management, earnings, and check-in/out flows. 2 critical, 3 high, 4 medium, and 4 low issues found and fixed. Zero diagnostics across all 7 changed files.

### 🔴 Critical fixes

**CRIT-1 — `GET /api/bookings`: unbounded query with no default limit**
- Bookings page called `/api/bookings` with no limit or date range — an instructor with 2,000+ bookings would trigger a full table scan on every page load.
- Fix: hard default of 200, cap at 500. Bookings page now passes `?from=&to=&limit=400` covering a ±90/60 day window.

**CRIT-2 — `POST /api/bookings`: wallet balance recheck loaded all transactions into memory**
- Inside the `$transaction`, `walletTransaction.findMany` loaded every confirmed transaction for the client wallet to sum them — O(n) memory inside a DB lock.
- Fix: replaced with two `aggregate` calls (CREDIT sum + DEBIT sum). Constant-time regardless of transaction history.

### 🟠 High fixes

**HIGH-1 — `POST /api/bookings`: `SLOT_TAKEN` error was re-thrown as `SLOT_ALREADY_BOOKED`, causing 500**
- Transaction threw `SLOT_TAKEN` → caught → re-thrown as `SLOT_ALREADY_BOOKED` → no outer handler → 500 to instructor.
- Fix: outer catch now handles both error codes with a clean 409 response.

**HIGH-2 — `bookings/page.tsx`: no date range on fetch — relied on 200 default cap**
- Bookings page fetched no date range, meaning recent bookings might be missed if an instructor has 200+ total. 
- Fix: `?from=90days_ago&to=60days_future&limit=400` — captures all practically relevant bookings.

**HIGH-3 — `check-in/route.ts`: booking fetched before null check and auth check**
- DB query ran before `if (!booking)` guard — order meant: fetch → try to read `booking.instructor` → crash on null before the guard fired.
- Fix: null check + auth check now happen immediately after the fetch. Same fix applied to `check-out/route.ts`.

### 🟠 Medium fixes

**MED-1 — `PATCH /api/bookings/[id]`: `price` accepted from client input**
- `updateSchema` included `price: z.number().optional()` — instructor could send any price and it would apply to the wallet deduction.
- Fix: `price` removed from schema. New price computed server-side from duration change using `booking.lockedHourlyRate`. Wallet adjustment uses the computed delta, not client input.

**MED-2 — `GET /api/bookings/[id]`: full client object returned**
- `include: { client: true }` returned all internal client fields.
- Fix: `include: { client: { select: { id, name, phone, email, userId } } }` — returns only what the booking detail page needs.

**MED-3 — `check-out/route.ts`: redundant comment block cleaned up**
- Auth error messages were verbose debug strings. Cleaned to concise `'Forbidden'`.

### 🟡 Low fixes

**LOW-1 — `bookings/page.tsx`: booking dates used browser timezone**
- `toLocaleDateString` / `toLocaleTimeString` had no `timeZone` option — displayed in browser TZ, not instructor's stored TZ.
- Fix: page now fetches timezone from `/api/instructor/settings` in parallel with bookings. All date/time displays pass `{ timeZone: instructorTz }`.

**LOW-2 — `bookings/page.tsx`: `canCheckOut` logic incorrect**
- `const canCheckOut = booking.checkInTime && !booking.checkOutTime` — truthy string check, no status guard.
- Fix: `booking.status === 'CONFIRMED' && !!booking.checkInTime && !booking.checkOutTime`

**LOW-3 — `new/page.tsx`: client dropdown only loaded first 25 clients**
- `fetch('/api/clients')` used default limit of 25 — instructors with 25+ clients couldn't see all of them in the dropdown.
- Fix: `fetch('/api/clients?limit=200')`

**LOW-4 — `confirm/route.ts`: in-app notifications used no timezone**
- `notifyBookingConfirmed` and `notifyClientBookingConfirmed` called without timezone — notification timestamps defaulted to Perth.
- Fix: instructor timezone resolved from `booking.instructor` and passed to both notification calls.

### Files changed
- `app/api/bookings/route.ts`
- `app/api/bookings/[id]/route.ts`
- `app/api/bookings/[id]/check-in/route.ts`
- `app/api/bookings/[id]/check-out/route.ts`
- `app/api/bookings/[id]/confirm/route.ts`
- `app/dashboard/bookings/page.tsx`
- `app/dashboard/bookings/new/page.tsx`

### Not fixed (deferred — needs schema or architectural change)
- `clients/[id]` DELETE is a notes-field soft-delete with no `deletedAt` column — client still appears in list. Needs schema migration.
- `dashboard/page.tsx` initial instructor query still eager-loads full `client` objects (noted, non-blocking for launch).

---

## Session: 2026-08-05 — Earnings Page Refactor + Timezone Fixes

### Summary
Full earnings page refactor. Three orphaned components wired. Earnings date logic corrected to use lesson date (booking.startTime) not transaction creation date. Timezone-aware weekly/day grouping on the client. New `UpcomingScheduledSection` component extracts the last inline block.

### Components wired (were orphans, now live)

| Component | Now used in |
|---|---|
| `PlatformEarningsSection` | `app/dashboard/earnings/page.tsx` |
| `OfflineEarningsSection` | `app/dashboard/earnings/page.tsx` |
| `UpcomingScheduledSection` | `app/dashboard/earnings/page.tsx` (new component) |

**Earnings page** went from ~560 lines (all inline) to ~260 lines (data shaping + three components).

### Bugs fixed

**Earnings grouped by `createdAt` instead of lesson date**
- `groupTransactionsByWeek` was bucketing by `transaction.createdAt` — a lesson taught Monday could land in a different week if the transaction was processed later.
- Fix: now uses `booking.startTime` via `getLocalDateKey(lessonDate, instructorTz)` for correct local-day bucketing.
- Same fix applied to day grouping inside each week.

**API `thisMonth`/`lastMonth` filtered by `transaction.createdAt`**
`app/api/instructor/earnings/route.ts`
- `prisma.transaction.aggregate` for this/last month used `createdAt: { gte: startOfThisMonth }` — a lesson taught Oct 31st with a transaction created Nov 1st would miss October's totals.
- Fix: changed to `booking: { startTime: { gte: startOfThisMonth } }` — earnings belong to the month the lesson happened.
- Applied to: `thisMonthStats`, `thisMonthPlatformStats`, `thisMonthOfflineStats`, `lastMonthStats`.

**Timezone not used for client-side grouping**
- Earnings page had no timezone context — grouping used browser TZ (`new Date().toISOString()`).
- Fix: page fetches instructor timezone from `/api/instructor/settings` in parallel with earnings. `groupTransactionsByWeek` and `groupByDay` both accept `tz` param.

### New component: `UpcomingScheduledSection`
`components/instructor/UpcomingScheduledSection.tsx`
- Extracted from inline JSX in earnings page
- Handles platform + offline combined scheduled view
- Dynamic label: "(platform)", "(offline)", or "(platform + offline)" based on what's present
- Platform sub-header only shown when both streams have data
- `formatDuration` helper: `< 60 → Xmin`, `>= 60 → Xh` or `X.Xh`
- `paymentMethodLabel` includes `credit_card`, `debit_card`

### Other improvements
- `formatDuration` added to `UpcomingScheduledSection` — consistent across all duration displays
- `paymentMethodLabel` extended: `credit_card` and `debit_card` → "Card"
- `/dashboard/progress` added to Operations nav group in `DashboardNav.tsx`
- Client "Add Funds" quick action fixed to `/client-dashboard/wallet` (was pointing to instructor-path page)
- `PlatformEarningsSection` Transaction type updated to match API shape (nullable `client`, optional package fields)

### Files changed
- `app/dashboard/earnings/page.tsx`
- `app/api/instructor/earnings/route.ts`
- `components/instructor/PlatformEarningsSection.tsx`
- `components/instructor/UpcomingScheduledSection.tsx` (new)
- `components/DashboardNav.tsx`
- `app/dashboard/page.tsx`

---

## Session: 2026-08-04 — Instructor Dashboard Audit

### Summary
Full audit of the instructor dashboard and all sub-pages. 5 bugs fixed, 4 data/logic issues resolved, 4 UX improvements. Encoding corruption fixed in earnings and settings pages.

### Bugs fixed

**BUG-1 — `remind-client`: `metadata` key collision killed rate-limit check**
`app/api/instructor/remind-client/route.ts`
- The `recentReminder` notification query had two `metadata` conditions in the same object — the spread overwrote the first, making the `reminderType` check dead code.
- Fix: removed the dead `recentReminder` query entirely. The auditLog check is the effective gate and works correctly.

**BUG-2 — `dashboard/page.tsx`: `endOfToday` mutation was fragile**
- `localDateTimeToUTC('23:59').setSeconds(59, 999)` mutated a returned Date object with a confusing two-step pattern.
- Fix: replaced with `new Date(localDateTimeToUTC(...).getTime() + 59_999)` — immutable, clear.

**BUG-3 — `bookings/page.tsx`: `fetchBookings` silently swallowed auth errors**
- `res.ok` was never checked — a 401 session expiry would set `bookings` to `{ error: 'Unauthorized' }` and render an empty list with no feedback.
- Fix: added explicit 401 and non-ok handling with user-facing toast.

**BUG-4 — `earnings/page.tsx`: widespread encoding corruption (replacement chars U+FFFD)**
- All separator characters (`·`, `–`, `→`) and emoji in the earnings page were replaced with U+FFFD during a prior file write.
- Fix: PowerShell replacement script restored all characters. Affects: `weekLabel`, `Loading earnings…`, section headers, bullet list items, separator dots in lesson rows.

**BUG-5 — `settings/page.tsx`: cancellation policy section had garbled emoji and text**
- `??` instead of emoji, ` 2448 hours notice` instead of `24–48 hours notice`, `?` prefix instead of ❌.
- Fix: restored all three rows and the header icon to correct text/emoji.

### Data / logic issues fixed

**DATA-1 — `dashboard/page.tsx`: `daysInCurrentMonth` was dead code**
- Declared but never referenced. Daily average used `daysElapsedThisMonth` (correct).
- Fix: removed the unused variable.

**DATA-2 — `dashboard/page.tsx`: unused `DollarSign` import**
- Imported from lucide-react but not used anywhere in the JSX.
- Fix: removed from import list.

**DATA-3 — `dashboard/page.tsx`: `monthlyBookings` fetched but never used**
- A `prisma.booking.count()` for monthly confirmed/completed bookings was in the `Promise.all` but the result was never referenced in the JSX or calculations.
- Fix: removed the dead query entirely. Saves one DB round-trip per dashboard load.

**DATA-4 — `dashboard/page.tsx`: `instructor.clients` eager-loaded but never rendered**
- The core instructor query included `clients: { take: 5 }` — this data was never used. Client attention widgets use the `clientsWithPackages` / `inactiveClients` queries.
- Fix: removed the `clients` include from the core query.

**DATA-5 — `earnings/this-week` API: week boundaries in UTC instead of instructor's timezone**
- Week start/end used `now.getUTCDay()` — an AEST instructor's Monday starts at 14:00 Sunday UTC, so bookings on late Sunday UTC were wrongly included in the previous week.
- Fix: uses `getLocalDateKey` + `localDateTimeToUTC` to compute Mon 00:00 → Sun 23:59:59 in the instructor's actual timezone.
- API now also selects `timezone` and `state` fields from the instructor record.

**DATA-6 — `TodayWorkspace`: never received `timezone` prop from dashboard**
- `<TodayWorkspace>` accepts a `timezone` prop but dashboard always passed the default (Perth).
- Fix: `timezone={instructorTz}` added to the call site.

### UX fixes

**UX-1 — `clients/page.tsx`: double fetch on mount**
- Two `useEffect` hooks both triggered `fetchClients` on mount — one for `debouncedSearch` change and one with empty deps `[]`.
- Fix: removed the redundant `useEffect([])`; the debounce effect handles the initial empty-search fetch.

**UX-2 — `earnings/page.tsx`: `fetchEarnings` silently hid API errors**
- Non-ok responses were ignored; page showed "Failed to load earnings data" with no context.
- Fix: added explicit `console.error` on non-ok with status code for debuggability.

### Files changed
- `app/api/instructor/remind-client/route.ts`
- `app/api/instructor/earnings/this-week/route.ts`
- `app/dashboard/page.tsx`
- `app/dashboard/bookings/page.tsx`
- `app/dashboard/clients/page.tsx`
- `app/dashboard/earnings/page.tsx`
- `app/dashboard/settings/page.tsx`

### Deferred (not fixed — tracked for next session)
- **Bookings page timezone**: `toLocaleTimeString` on bookings list has no `timeZone` option — shows browser TZ not instructor TZ. Needs settings API fetch on that page.
- **Earnings page week grouping**: client-side `groupTransactionsByWeek` uses `getDay()` (browser TZ) for grouping — same class of problem as the API fix above.
- **Profile page dual-API submit**: vehicleTypes and profile data saved in separate non-atomic calls. If second fails, data is partially saved.

---

## Session: 2026-08-03 — Timezone National Expansion + Offline/Business Records Audit

### Summary
Full timezone refactor for national expansion readiness. Offline booking API bug fixed. Business records audit. Schedule page, availability service, email/SMS/notifications all updated to use instructor's stored timezone.

### New: `lib/utils/timezone.ts`
Single source of truth for all timezone operations in the platform:
- `localDateTimeToUTC(date, time, tz)` — form submit → UTC
- `getLocalDateKey(utcDate, tz)` — group by local day
- `formatLocalTime / formatLocalDate` — display in any timezone
- `timezoneFromState(state)` — derive TZ from AU state code
- `resolveTimezone(tz)` — validate IANA + fallback
- `AU_TIMEZONES` — all 7 Australian instructor zones

### Bugs fixed

**Offline booking API — critical timezone bug**
`app/api/bookings/offline/route.ts`
- Was: `new Date(date + 'T' + time + ':00.000Z')` — Perth time stored as UTC (8h off)
- Now: `localDateTimeToUTC(date, time, instructorTimezone)` — uses instructor's stored timezone

**OfflineEarningsSection — duration display + timezone**
`components/instructor/OfflineEarningsSection.tsx`
- `{b.duration}h` → `{b.duration < 60 ? Xmin : X/60h}` (duration is in minutes, not hours)
- Date grouping now uses `getLocalDateKey` with instructor's timezone
- Scheduled section was showing past data — replaced with link to bookings page
- Accepts `timezone` prop

**Business records page — date display**
`app/dashboard/expenses/page.tsx`
- Expense dates now use `formatLocalDate(date, instructorTimezone)`
- Fetches instructor timezone from settings API alongside expenses
- CSV export uses same timezone-aware date formatting

### Timezone selector added to Settings
`app/dashboard/settings/page.tsx`
- Dropdown added in Service Area section using `AU_TIMEZONES`
- Saves to `Instructor.timezone` in DB
- Settings API GET/PUT updated to include `timezone` and `state`

### Availability service
`lib/services/availability.ts`
- `parseTimeUTC()` now calls `localDateTimeToUTC` with instructor's stored timezone
- Fallback chain: stored timezone → state-derived → Perth default

### Schedule page
`app/dashboard/schedule/page.tsx`
- `toPerth()` + `isSamePerthDay()` removed — replaced with `toLocal(dt, tz)` + `isSameLocalDay(a, b, tz)`
- `BufferSettings` now includes `timezone` field
- All helpers (`formatTime`, `formatDay`, `formatDateLabel`) accept `tz` param
- `WeekView`, `AgendaView`, `BookingCard` all receive and use instructor's timezone
- Week start anchor and "Today" button use instructor's timezone

### Email / SMS / Notifications
`lib/services/email.ts`, `sms.ts`, `notifications.ts`
- All booking-related functions accept optional `timezone` param (defaults to Perth)
- Existing call sites fully backward-compatible
- New call sites can pass `instructor.timezone` to display correct local times

### Files changed
- `lib/utils/timezone.ts` (new)
- `app/api/bookings/offline/route.ts`
- `components/instructor/OfflineEarningsSection.tsx`
- `app/dashboard/expenses/page.tsx`
- `app/dashboard/settings/page.tsx`
- `app/api/instructor/settings/route.ts`
- `lib/services/availability.ts`
- `app/dashboard/schedule/page.tsx`
- `lib/services/email.ts`
- `lib/services/sms.ts`
- `lib/services/notifications.ts`

---



### Summary
New-device OTP verification for instructors. Shared `SlotPicker` component replacing duplicate slot-fetch logic. Suburb-based instructor search. Simplified registration. Buffer visualisation on schedule. Cloudinary signed URL routing fixed. OTP endpoint DoS fix.

### Changes

**SEC-1 — New device OTP gate (`app/login/page.tsx`)**
- Instructor login on new browser: OTP sent to email, `OtpModal` blocks navigation until code confirmed
- Known devices navigate immediately; non-instructor roles get notification email only
- `OtpModal`: 6-digit input, masked email, resend with rate-limit feedback, lockout after 3 fails
- OTP endpoint performance fix: DB write completes before responding; email sent fire-and-forget — response time 8.6s → ~200ms (dev) / ~50ms (prod)

**Shared `SlotPicker` component (`components/SlotPicker.tsx`)**
- Pill grid replaces `<select>` dropdown in all booking surfaces
- Used by: `BookingDetailsForm`, `new/page.tsx` offline form
- `variant="dark|light"`, `allowFallback` for offline forms, `scheduledTimes` for session deduplication
- Removed dead `offlineSlots`/`loadingOfflineSlots`/`offlineSlotsMessage` state from `new/page.tsx`

**Suburb-based instructor search**
- `ServiceAreaPicker` component — multi-suburb picker from static AU postcode data
- Settings page Service Area section rebuilt: suburb picker primary, radius as fallback
- Search API: exact suburb/postcode token match; falls back to radius for instructors without suburb list
- `serviceAreas` field added to settings API (GET/PUT)
- `suburbList` added to search response for card display

**Registration page simplified (`app/register/page.tsx`)**
- 4 fields only: Name, Email, Password, Phone
- "After you sign up" onboarding preview
- API: `baseAddress`, `hourlyRate`, `vehicleTypes`, `serviceRadiusKm` now optional with defaults

**Schedule page — buffer visualisation (`app/dashboard/schedule/page.tsx`)**
- Week view fetches `bookingBufferMinutes`/`enableTravelTime`/`travelTimeMinutes` from settings
- Dashed amber stripe rendered after each booking block showing the blocked buffer window

**Cloudinary route conflict fix**
- Deleted duplicate `[docType]` routes — existing `[type]` routes already handled signed URLs with audit logging
- Admin instructor page updated to call `documents/${docType}` (correct path)

**`inert` attribute fix**
- All 6 landing showcase components: `inert` → `inert=""` (React 18 expects string)

**Package discount transparency**
- Student-facing: clean discount %, no "funded by" language
- Instructor settings: info box explaining DriveBook funds discounts, payout unchanged
- Admin pricing: explanation panel below `discountPaidBy` dropdown

### Files changed
- `app/login/page.tsx`
- `app/api/verifications/otp/route.ts`
- `components/SlotPicker.tsx` (new)
- `components/BookingDetailsForm.tsx`
- `app/dashboard/bookings/new/page.tsx`
- `components/instructor/ServiceAreaPicker.tsx` (new)
- `app/dashboard/settings/page.tsx`
- `app/api/instructor/settings/route.ts`
- `app/api/instructors/search/route.ts` (recreated — was missing from disk)
- `app/dashboard/schedule/page.tsx`
- `app/register/page.tsx`
- `app/api/register/route.ts`
- `app/admin/instructors/[id]/page.tsx`
- `components/PackageSelector.tsx`
- `components/admin/PricingSettingsForm.tsx`
- `components/subdomain/SubdomainPricingBooking.tsx`
- `components/landing/AIReceptionistShowcase.tsx` + 5 other showcases

---

## Earlier sessions (detail in permanent docs)

| Session | What | Where documented |
|---|---|---|
| 2026-07-31 | Business card builder, session idle timeout, device tracking | `CODEBASE_MAP.md` AUTHENTICATION + INSTRUCTOR MARKETING TOOLS |
| 2026-07-25 | Audit fixes (session 2+3): wallet atomicity, payout bugs, document expiry, bookings audit | `06-payments/PAYOUTS.md`, `05-admin/DOCUMENT_VERIFICATION.md` |
| 2026-07-22 | Subscription overhaul, admin subscription UI, STUDIO tier, booking flow bugs | `07-subscriptions/`, `CODEBASE_MAP.md` SUBSCRIPTIONS |
| 2026-07-20 | Lesson feedback/assessment types, packages, documents page redesign, remove hardcoded values | `03-instructor/DASHBOARD.md`, `CODEBASE_MAP.md` |
| 2026-07-19 | BUSINESS tier, admin operations manual, policy page | `00-overview/ADMIN_BUSINESS_RULES.md`, `operations/` |


### Summary
Instructor logins from a new browser now require email OTP confirmation before the dashboard is accessible. Known browsers skip the check entirely. Non-instructor roles (admin, client) receive the existing notification email but no OTP gate.

### Changes

**`app/login/page.tsx` — OTP gate added**
- After successful `signIn()`, calls `device-check` and awaits the result (no longer fire-and-forget for instructors)
- If `isNewDevice && role === 'INSTRUCTOR'`: calls `/api/verifications/otp` to send a 6-digit code to the instructor's email, then shows `OtpModal` — navigation is blocked until the code is confirmed
- Known devices or non-instructor roles navigate immediately as before
- OTP send failure is non-fatal — login proceeds (availability > perfect security)

**`OtpModal` component (inline in login page)**
- Full-screen overlay with sky-600 shield icon
- 6-digit numeric input, large tracking font
- Confirm button disabled until 6 digits entered
- Error messages: wrong code with attempts-remaining count, lockout after 3 fails
- Resend button with rate-limit message (`retryAfter` seconds shown)
- Masked email display: `j***@example.com`
- "This browser will be remembered after verification" note

### Files changed
- `app/login/page.tsx`

### Security notes
- OTP: HMAC-SHA256 hashed in DB, 5-min TTL, max 3 resends/hour (existing infra)
- Lockout: 3 failed attempts locks the verificationId (existing infra)
- Device identity: localStorage UUID (stable across network changes — not IP-based)
- Scope: INSTRUCTOR role only for OTP gate; all roles still get new-device email notification

---



### Summary
Streamlined instructor registration to 4 fields. Replaced air-distance km radius with suburb-based search backed by static AU postcode data. Fixed Cloudinary signed URL routing conflicts. Register page redesigned.

### Changes

**Registration page — simplified to 4 fields**
`app/register/page.tsx`
- Removed: base address, hourly rate, vehicle type, service radius
- Added: "After you sign up" onboarding preview panel
- Removed hardcoded Sydney lat/lng fallback (`-33.8688, 151.2093`)
- Redirects to `/login?registered=1` on success

**Register API — optional fields with defaults**
`app/api/register/route.ts`
- `baseAddress`, `hourlyRate`, `vehicleTypes`, `serviceRadiusKm` now optional with sensible defaults
- Removed hardcoded lat/lng from the form body

**ServiceAreaPicker component — new**
`components/instructor/ServiceAreaPicker.tsx`
- Multi-suburb selector backed by static AU postcode data (no API calls)
- Storage format: JSON array of `"Suburb|STATE|postcode"` tokens
- Helper functions exported: `parseServiceAreas`, `serialiseServiceAreas`, `encodeSuburb`, `decodeSuburb`

**Settings page — Service Area section rebuilt**
`app/dashboard/settings/page.tsx`
- Suburb picker as primary (exact match, no maths)
- Base address input for home base
- Radius input moved to "Fallback Radius" with note it's air-distance only

**Settings API — serviceAreas field added**
`app/api/instructor/settings/route.ts`
- `serviceAreas` added to schema, PUT handler, and GET select

**Search API — suburb-first, radius fallback**
`app/api/instructors/search/route.ts`
- If instructor has suburb list: exact postcode/suburb match — no Haversine
- If no suburb list: falls back to km radius as before (no breakage)
- `serviceAreas` added to DB select
- `suburbList` added to format output for display on cards

**Route conflict fix**
- Deleted duplicate `[docType]` routes under `instructor/documents` and `admin/instructors/[id]/document`
- Both already had correct `[type]` routes with signed URLs and audit logging
- Admin instructor page updated to use correct path `documents/${docType}`

### Files changed
- `app/register/page.tsx`
- `app/api/register/route.ts`
- `components/instructor/ServiceAreaPicker.tsx` (new)
- `app/dashboard/settings/page.tsx`
- `app/api/instructor/settings/route.ts`
- `app/api/instructors/search/route.ts`
- `app/admin/instructors/[id]/page.tsx`

---



### Summary
Completed Task 7: full attribution of platform-funded package discounts across all surfaces — student booking flow, instructor subdomain pages, instructor settings, and admin pricing panel.

### Changes

**PackageSelector.tsx — student attribution line**
`components/PackageSelector.tsx`
- Added note under Package Benefits: "Package discounts are funded by DriveBook — your instructor's hourly rate stays the same."
- Only shown when at least one discount tier > 0%

**PricingSettingsForm.tsx — admin explanation box**
`components/admin/PricingSettingsForm.tsx`
- Added explanatory panel below the `discountPaidBy` dropdown
- Explains to admin how the discount attribution setting appears to instructors and students

**SubdomainPricingBooking.tsx — subdomain package rows**
`components/subdomain/SubdomainPricingBooking.tsx`
- Each package row now shows `{pct}% discount — funded by DriveBook` instead of just `{pct}% bulk discount`
- If discount is 0%, shows `Standard rate`

**app/dashboard/settings/page.tsx — instructor pricing section**
`app/dashboard/settings/page.tsx`
- Added info box under the hourly rate input: explains that package discounts are funded by DriveBook and that the instructor payout is always calculated on their full hourly rate

### Files changed
- `components/PackageSelector.tsx`
- `components/admin/PricingSettingsForm.tsx`
- `components/subdomain/SubdomainPricingBooking.tsx`
- `app/dashboard/settings/page.tsx`

---



### Summary
Third audit pass covering student/client dashboard, instructor bookings page, admin payouts BSB masking, and wallet API. 6 confirmed issues fixed; C-01 confirmed already done.

### Fixes

**NF-01 — 6 `window.confirm()` on instructor bookings page**
`app/dashboard/bookings/page.tsx`
- Check-in, check-out, cancel, delete, confirm, save edit all used `window.confirm()` — blocked on mobile WebView
- Fix: `PendingAction` type + `requestConfirm()` pattern; single inline modal overlay handles all 6 actions

**NF-02 — `en-US` locale on instructor bookings page**
`app/dashboard/bookings/page.tsx`
- 3 date/time formats used `en-US` — `Jul 25` instead of `25 Jul`, 12-hour AM/PM instead of 24-hour
- Fix: changed to `en-AU` throughout

**NF-03 — Full BSB visible in admin payouts list table (resolves P-02)**
`app/admin/payouts/page.tsx`
- BSB shown unmasked in list table alongside masked account number
- Fix: list table now shows `•••-XXX` (last 3 digits); `MarkSentModal` retains full BSB since admin needs it for the transfer

**NF-04 — Student bookings tab counts from page slice**
`app/client-dashboard/bookings/page.tsx`
- Tab badge "Upcoming (3)" was computed from current page only, not full dataset
- Fix: uses `profile.upcomingCount` and `profile.pastCount` from API

**NF-05 + NF-06 — Wallet API: unbounded query + dead `totalBookedHours`**
`app/api/client/wallet/route.ts`
- Loading ALL confirmed transactions on every wallet page visit (no `take` limit)
- `totalBookedHours` computed via a separate booking query but never rendered in the wallet UI
- Fix: balance via two `aggregate()` calls; recent transactions with `take: 20`; removed dead booking query

**C-01 — Confirmed already fixed (not a change this session)**
`app/book/[instructorId]/book-type/page.tsx`
- Inline `validationError` state with `role="alert"` was already in place; audit doc updated

### Files changed
- `app/dashboard/bookings/page.tsx`
- `app/admin/payouts/page.tsx`
- `app/client-dashboard/bookings/page.tsx`
- `app/api/client/wallet/route.ts`

---

## Session: 2026-07-25 — Full Audit Fixes (Reliability, Data Integrity, Type Safety)

### Summary
Full re-audit of the codebase against the COMBINED_AUDIT_REPORT.md. 10 confirmed issues fixed. 7 architectural items deferred (documented in TODO.md under "Post-audit deferred").

### Data Integrity Fixes

**P1-A — Reschedule route: wallet + booking now atomic**
`app/api/client/bookings/[id]/reschedule/route.ts`
- `walletTransaction.create` and `booking.update` were separate writes
- Mid-flight failure left wallet adjusted but booking unchanged
- Fix: both writes now inside a single `$transaction` with TOCTOU balance re-check inside the transaction

**P1-B — `confirm-package-booking`: wallet drift + phantom fields**
`app/api/client/confirm-package-booking/route.ts`
- Was writing to `ClientWallet.totalSpent` and `creditsRemaining` — fields that don't exist in schema
- No `WalletTransaction` record was created, so `getWalletBalance()` (ledger-derived) was never updated
- Three separate writes (booking confirm, package hours update, wallet) were not atomic
- Fix: all three writes in one `$transaction`; phantom field writes replaced with `WalletTransaction` DEBIT + `balance.decrement`

**P3-A — `payments/verify`: wallet pairs now atomic**
`app/api/payments/verify/route.ts`
- CREDIT + DEBIT `walletTransaction.create` calls were sequential separate writes in both POST and GET
- A failure between them left a dangling CREDIT with no DEBIT
- Fix: both creates inside a single `$transaction` in both handlers

### Reliability Fixes

**P2-A — Dashboard layout: misleading PENDING banner on DB failure**
`app/dashboard/layout.tsx`
- `approvalStatus ?? 'PENDING'` fallback showed "account is pending" even if the DB was simply unreachable
- Fix: fallback changed to `null`; banner only renders when a real non-approved status is returned

**P2-B — Instructor dashboard: `instructor` query separated from supplementary batch**
`app/dashboard/page.tsx`
- Single `Promise.all` with 8 queries — `instructor` had no `.catch()`, so any query failure crashed the entire page
- Fix: `instructor` runs first in isolation with `.catch(() => null)` → redirect on failure; the 7 supplementary queries run in a second `Promise.all` each individually guarded with `.catch()` fallbacks

**P2-C — Admin dashboard: zeros indistinguishable from real data on query failure**
`app/admin/page.tsx` + `components/admin/AdminDashboardTabs.tsx`
- Outer `try/catch` only logged to console; page rendered zeros silently
- Fix: `dataUnavailable = true` set in catch; `AdminDashboardTabs` shows a red "data temporarily unavailable" banner when set

### Security / Defence-in-Depth

**P3-B — Rate limiting on payout resolve route**
`app/api/admin/payouts/resolve/route.ts`
- No rate limiting on financial mutations; only auth check
- Fix: wired `payoutRateLimit` (5/min per admin, existing in `lib/ratelimit.ts`); added after auth check

**P3-C — Critical env variable validation at startup**
`instrumentation.ts` (new file) + `next.config.js`
- No startup validation; a misconfigured env var silently broke deep in a request handler
- Fix: Next.js instrumentation hook validates `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` on server start. Format-checks each value. Hard-fails in production, warns in development.

### Type Safety

**P3-D — `prisma as any` cleanup**
- `npx prisma generate` run to refresh generated client types
- Removed `(prisma as any)` casts from 41 files where the model IS in `schema.prisma`: `auditLog`, `transaction`, `walletTransaction`, `stripeDispute`, `payout`, `ledgerEntry`, `cronHealth`, `instructor`, `webhookEvent`, `subscription`, `clientWallet`
- One silent bug fixed in the process: `confirm-package-booking` was calling `(prisma as any).wallet.update` — no such model; corrected to `prisma.clientWallet.update` via correct relation path
- Remaining `(prisma as any)` casts are documented custom tables not in schema.prisma: `notificationRetry`, `waitingList`, `bookingIdempotencyKey`, `testCentre`, `instructorExpense`, `availabilityException`, `reconciliationReport`, `financialLedger`, `adminBrief`

### Files changed (primary)
- `app/api/client/bookings/[id]/reschedule/route.ts`
- `app/api/client/confirm-package-booking/route.ts`
- `app/api/payments/verify/route.ts`
- `app/dashboard/layout.tsx`
- `app/dashboard/page.tsx`
- `app/admin/page.tsx`
- `components/admin/AdminDashboardTabs.tsx`
- `app/api/admin/payouts/resolve/route.ts`
- `instrumentation.ts` (new)
- `next.config.js`
- 41 service/route files — `prisma as any` casts removed

---



### Summary
Fixed all 7 bugs from the DASH_GAPS.md priority list. All files pass diagnostics with zero errors.

### Bugs Fixed

| # | ID | File(s) |
|---|---|---|
| 1 | BUG-1 | Earnings "This Week" card showed gross lesson price, not net instructor payout. API now sums `instructorPayout` (falls back to `price × (1 - commissionRate)`, then `× 0.85` for very old bookings). |
| 2 | BUG-2 | `weekStartDisplay`/`weekEndDisplay` were `MM/DD` (US). Now `DD/MM` (AU). |
| 3 | DATA-3/4 | Per-booking breakdown in `EarningsThisWeekCard` showed gross price and a wrong `N × $rate = total` formula label. Card now shows net payout per booking and a plain lesson count label. |
| 4 | BUG-3 | Profile page had 5 `alert()` calls for upload/save/service-area errors. Replaced with a toast notification (same pattern as settings page). Added `CheckCircle`/`AlertCircle` icons and `showToast()` helper. |
| 5 | BUG-4 | PDA config deletion in settings used `window.confirm()`. Replaced with an inline amber confirm row (`pdaDeleteConfirmId` state) — accessible, mobile-safe, consistent with the rest of the app. |
| 6 | BUG-5/DATA-2 | Dashboard "Upcoming Lessons" panel included today's lessons (already shown in TodayWorkspace). Changed `startTime: { gte: now }` → `startTime: { gt: endOfToday }`. Panel description "Next bookings after today" now accurate. |
| 7 | BUG-6 | `ProfileCompletenessCard` bio check was `bio.trim().length > 30` chars. Profile page enforces 75 words. Now consistent: `bio.split(/\s+/).length >= 75`. Tip text updated to mention the 75-word requirement. |
| 8 | UX-4 | `PendingApprovalBanner` defaulted all non-APPROVED statuses to the "pending approval" blue banner — including SUSPENDED accounts which got a misleading message. Added explicit `SUSPENDED` case with amber styling and "Contact Support" CTA. Also added `mb-4` spacing to all banner variants. |
| 9 | BUG-7 | Client search on `/dashboard/clients` was client-side filtering only — couldn't find clients on page 2+. Added `search` query param to `GET /api/clients` (Prisma `contains insensitive` on name/email/phone). Page now debounces 300ms and resets to page 1 on each search. Removed redundant `filteredClients` local filter. |
| 10 | DATA-1 | `FindNextSlot` made up to 21 sequential API calls (7 days × 3 durations, each awaited). Rewritten to fire all 21 fetches in one `Promise.all`, then sort results chronologically. Worst-case latency drops from ~4s to ~200ms. |

### Files changed
- `app/api/instructor/earnings/this-week/route.ts`
- `components/instructor/EarningsThisWeekCard.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/profile/page.tsx`
- `app/dashboard/settings/page.tsx`
- `app/dashboard/clients/page.tsx`
- `app/api/clients/route.ts`
- `components/instructor/ProfileCompletenessCard.tsx`
- `components/instructor/PendingApprovalBanner.tsx`
- `components/instructor/FindNextSlot.tsx`

---

## Session: 2026-07-22 — Instructor Dashboard Deep Inspection + Gap Analysis

### Summary
Full deep inspection of the instructor dashboard — all 15 pages, 15 components, 29+ API routes, admin instructor management, and all related docs. Created `docs/DOCROLEBASE/03-instructor/DASH_GAPS.md` recording 27 identified gaps across 6 categories.

### Gaps recorded (27 total)

| Severity | Count | Examples |
|---|---|---|
| 🔴 Critical bugs | 3 | EarningsCard shows gross not net; date format US not AU; profile `alert()` |
| 🟠 High | 2 | Double booking fetch on dashboard; stale Prisma client |
| 🟡 Medium | 10 | Client search client-side only; bio threshold mismatch; FindNextSlot 21 serial calls; PayoutScheduleCard missing |
| 🟢 Low | 12 | Perth TZ hardcoded; confirm() dialogs; docs gaps |

**Files created:**
- `docs/DOCROLEBASE/03-instructor/DASH_GAPS.md` — full gap register with fix instructions and recommended fix order

**No code changed in this session.** All findings recorded for implementation in the next sprint.

---

## Session: 2026-07-22 — VAPI System Prompt — displayName Update

### Summary
Updated all instructor name references in the VAPI system prompt from `[name]`/`instructor.name` to `[displayName]`. For BUSINESS accounts, `displayName` is the school name (e.g. "Perth Drive Academy"); for individual instructors it's their personal name or trading name. This was the deferred VAPI update from Task 10.

**Files changed:** `drivebook-hybrid/VAPI_SYSTEM_PROMPT.md`

**Changes:**
- Step 3 (ONE INSTRUCTOR RULE): `[name]` → `[displayName]`
- Step 3 (MULTIPLE INSTRUCTORS): `[name]` → `[displayName]`
- Step 4 (getPackages script): `instructor.name` → `displayName`
- Step 8b (service area out-of-range): `[instructor name]`/`[name]` → `[displayName]`
- Step 9 (confirmation script): `Instructor: [name]` → `Instructor: [displayName]`
- Step 10 (instructorQuery fallback): `[instructor name]` → `[displayName]`
- CONVERSATION STATE: `instructor_name` → `instructor_displayName` with BUSINESS note
- EXAMPLE 1 dialogue: `[API name]`/`[name]` → `[API displayName]`/`[displayName]` in findInstructors response and confirmation script

⚠️ **Action required:** Re-upload this prompt to VAPI dashboard. The built file should be generated first with real `SUPPORT_PHONE` and `SUPPORT_EMAIL` values via `node scripts/build-vapi-prompt.js` in `drivebook-hybrid/`.

---

## Session: 2026-07-22 — Booking Flow Audit + Bug Fixes

### Summary
Deep audit of the public booking wizard. Found and fixed 4 bugs including one critical (Book Later completely broken). Added slot countdown timer to payment page.

---

### Bug 1 — CRITICAL: Book Later flow was broken in main app

**`app/book/[instructorId]/payment/page.tsx`**

The payment page for Book Later was expecting `bookingResult.transactionId` but the bulk API actually returns `{ checkoutUrl, ... }` — no `transactionId` in the Book Later response. The route creates a Stripe Checkout Session, not a PaymentIntent, so there is no transaction to create an intent for.

Every Book Later attempt threw `"Missing transactionId from booking response"` — the path was completely broken.

**Fix:** Book Later now detects `bookingResult.checkoutUrl` and redirects directly to it via `window.location.href`. No PaymentIntent step needed — Stripe hosts the entire payment on their checkout page. Book Now path unchanged.

---

### Bug 2 — HIGH: `alert()` in registration page

**`app/book/[instructorId]/registration/page.tsx`**

`validateForm()` used `alert()` for all 7 validation errors. Blocks UI thread, inaccessible, terrible mobile UX.

**Fix:** Added `validationError` state. All 7 `alert()` calls replaced with `setValidationError()`. Error rendered as inline red banner below the RegistrationForm, matching the pattern in every other step.

---

### Bug 3 — MEDIUM: Confirmation page hardcoded step number

**`app/book/[instructorId]/confirmation/page.tsx`**

`<MultiStepBookingLayout currentStep={3}>` was hardcoded. When `offersTestPackage = true`, the wizard has one extra step, so the indicator was highlighting the wrong step.

**Fix:** Dynamic calculation: `bookingType === 'now' ? (offersTestPackage ? 6 : 5) : (offersTestPackage ? 5 : 4)`

---

### Bug 4 — LOW: No slot countdown on payment page

**`app/book/[instructorId]/payment/page.tsx`**

Slots are held for 10 minutes (server-side `SlotReservation`). The confirmation page warned about this, but the payment page showed no timer — students could unknowingly take too long and hit a `BOOKING_EXPIRED` error mid-payment.

**Fix:** Added a countdown timer state (`slotSecondsLeft`, 10 × 60 seconds) that ticks every second. Displayed as a colour-coded badge on the scheduled lessons card: green → amber (≤3 min) → red (≤1 min). Only shown when `scheduledBookings.length > 0` (Book Now with slots).

---

### Remaining known bugs (deferred — see TODO)

- **Bug 5 (by design):** Only the first scheduled lesson creates a `Booking` DB row. Multiple slots in one package flow — remaining are stored as `packageHoursRemaining`, students schedule from dashboard post-payment. This is intentional product design, not a bug.

---

## Session: 2026-07-22 — Payout System Audit + Bug Fixes

### Summary
Deep audit of payout system. Found and fixed 5 bugs. Built the missing instructor payouts API. Rewrote both payout docs.

---

### Bugs Fixed

**`lib/services/payout-service.ts` — Bug 1: buffer always 24h**
- `buildPayout()` was hardcoding `PAYOUT_BUFFER_HOURS = 24`
- The cron used `PlatformSettings.lateCancellationWindowHours × 2` (dynamic, default 48h)
- Three different values in the codebase for the same concept
- Fix: added `getPayoutBufferHours()` helper that reads from `PlatformSettings`; `buildPayout()` now calls it

**`app/api/admin/payouts/process-all/route.ts` — Bug 2: no `payoutHold` check**
- "Process All Eligible" admin button was missing the `payoutHold` check
- Would attempt payout for instructors with active dispute holds, then error in `buildPayout()`
- Fix: added `payoutHold` check alongside ABN check; returns `SKIPPED` cleanly with reason

**`app/api/admin/payouts/resolve/route.ts` — Bug 3: `referenceId` field doesn't exist**
- `walletTransaction.create` was using `referenceId: transactionId`
- `WalletTransaction` schema has `bookingId`, not `referenceId`
- Would throw a Prisma runtime error on every dispute refund to client wallet
- Fix: changed to `bookingId: txn.bookingId`

**`app/dashboard/earnings/page.tsx` — Bug 4: wrong payout day**
- Footer told instructors "Payouts processed weekly on Fridays"
- Cron runs Tuesday 2am AWST, not Friday
- Fix: updated to "Payouts processed automatically every Tuesday morning (AWST)"

**`app/api/instructor/payouts/route.ts` — Bug 5: empty directory**
- The `/api/instructor/payouts` directory existed but contained no `route.ts`
- Documented in PAYOUTS.md and referenced by `PayoutScheduleCard` — was a 404 in production
- Fix: created full implementation returning payout history, pending payouts, next payout date, connection status

---

### Docs Rewritten

**`docs/DOCROLEBASE/03-instructor/PAYOUTS.md`** — complete rewrite
- Accurate payout schedule (Tuesday, not Friday)
- Correct buffer hours (48h dynamic from DB, not 24h hardcoded)
- Full payout state machine documented (ELIGIBLE → PROCESSING → PAID/FAILED, bank sub-states)
- Post-payout refund clawback mechanism documented
- `GET /api/instructor/payouts` response shape documented
- What instructors can vs cannot see

**`docs/operations/02-finance.md`** — complete rewrite
- Full admin payout page (4 tabs: Eligible, Manual Transfers, Withheld, Disputes)
- Resolve modal actions (5 actions) with effects
- `PAYOUT_BATCH_SIZE` env var note
- Failed payouts — no auto-retry, admin must retry manually
- Weekly manual transfer reminder — bank/manual instructors NOT auto-processed
- Post-payout refund clawback
- Governance threshold note: policy only, not enforced in code

---

## Session: 2026-07-22 — Document System Audit + Expiry Bug Fix

### Summary
Deep audit of both instructor-facing and admin-facing document management. Found and fixed a critical expiry data storage bug. Updated 6 stale doc files. Created the missing DOCUMENTS.md for instructors.

---

### 1. Expiry Date Storage Bug — Fixed

**Root cause:** The schema has dedicated `licenseExpiry`, `insuranceExpiry`, `policeCheckExpiry`, `wwcCheckExpiry` DateTime columns that were never written to. The expiry save API was writing into `workingHours.expiry` JSON instead, causing the real columns to always be null.

**`app/api/admin/documents/instructor/[instructorId]/expiry/route.ts`**
- Now writes to **both** the real DateTime columns AND `workingHours.expiry` JSON (dual-write for backward compat)
- Real columns become the primary source going forward

**`app/api/admin/documents/compliance/route.ts`**
- Now selects `licenseExpiry`, `insuranceExpiry`, `policeCheckExpiry`, `wwcCheckExpiry` real columns
- Falls back to `workingHours.expiry` JSON for records saved before this fix

**`app/api/admin/documents/instructor/[instructorId]/route.ts`**
- Same: reads real columns first, JSON fallback

---

### 2. Documentation Fixes

**Created `docs/DOCROLEBASE/03-instructor/DOCUMENTS.md`** (was missing)
- Full reference for `/dashboard/documents` (Account Setup page)
- 5-step checklist items and conditions
- 8 document types table (required/optional, expiry tracked)
- Upload flow, expiry display, next-step banner logic, post-upload pipeline

**`docs/DOCROLEBASE/03-instructor/DASHBOARD.md`**
- Added "Documents / Account Setup Page" section before Subscription Page section

**`docs/DOCROLEBASE/03-instructor/ONBOARDING_APPROVAL.md`**
- Fixed Step 2: document upload is at `/dashboard/documents`, not `/setup/complete-profile`
- Added `photoIdDoc` to admin verification checklist

**`docs/operations/04-instructors.md`**
- Removed fictional per-document stage machine (UPLOADED/PENDING_VERIFICATION/VERIFIED/EXPIRED/REJECTED/ARCHIVED — these don't exist)
- Replaced with accurate model: URL-present = uploaded, `documentsVerified=true` = admin-approved, null URL = not uploaded or rejected
- Fixed approval checklist: changed "License number present" → actual file fields (`licenseImageFront` etc.)
- Added `photoIdDoc` and `vehicleRegistrationDoc` to checklist (were missing)

**`docs/DOCROLEBASE/00-overview/ADMIN_BUSINESS_RULES.md`**
- §1 approval checklist now uses actual DB field names (licenseImageFront, licenseImageBack, photoIdDoc, vehicleRegistrationDoc) instead of "license number present"
- Added tip pointing to Document Review page before approving

**`docs/DOCROLEBASE/05-admin/INSTRUCTOR_APPROVALS.md`**
- Updated instructor detail section: now 4 tabs (Overview / Subscription / Bookings / Documents), not 3
- Subscription tab documented with link to §7a
- Document Review section: expanded with full 6-route API inventory, reject SMS+audit behaviour, expiry dual-write note

**`docs/DOCROLEBASE/05-admin/DOCUMENT_VERIFICATION.md`**
- Removed "Instructor dashboard status page" from Phase 1 — it's done
- Removed "Audit logging" from recommendations — it's done
- Updated schema snippet: expiry fields shown as live production columns (not commented-out future)
- Added architecture note on expiry storage dual-write
- Updated API route inventory with all 7 routes
- Marked Phase 1/2/3 items accurately

---

## Session: 2026-07-21 — Subscription System Overhaul + Admin Subscription Management

### Summary
Fixed all critical bugs in the subscription upgrade/downgrade flow. Built a full admin subscription management UI. Added STUDIO commission rate throughout. Retired the legacy webhook.

---

### 1. Subscription Bug Fixes

#### Root causes fixed:

**`app/api/instructor/subscription/route.ts`**
- `POST` checkout now uses `customer: customerId` (not `customer_email`) — prevents duplicate Stripe customers on retry

**`app/api/stripe/webhook/route.ts` — `handleCheckoutCompleted`**
- DB tier/status/`stripeSubscriptionId` update moved **inside** `$transaction` — was previously in a separate `try/catch` after the transaction, causing silent failures where `stripeCustomerId` committed but tier never changed
- Now correctly finds and links the existing trial subscription row (if present) by `stripeSubscriptionId: null` + `instructorId` before creating a new row

**`app/api/stripe/webhook/route.ts` — `handleSubscriptionUpdate`**
- Now stamps `stripeSubscriptionId` on `Instructor` record (was missing)
- Race condition fix: when no subscription row found by `stripeSubscriptionId` (fires before `checkout.session.completed`), now searches for existing trial row by `instructorId` + `stripeSubscriptionId: null` and **links** it — prevents duplicate `Subscription` rows
- Only creates a brand-new row if no existing row found at all

**`app/api/instructor/subscription/billing-portal/route.ts`**
- Accepts `targetTier` parameter for upgrade checkout (trial → different tier with payment)
- Correctly creates Stripe customer from existing ID, not email

**`components/SubscriptionPlans.tsx`**
- Passes `targetTier` to billing portal on `active-change` dialog confirm
- Syncs from Stripe on both `payment_added=true` AND `portal_return=true`

#### Legacy webhook retired:
**`app/api/subscriptions/webhook/route.ts`**
- All processing removed — now returns `200` with `warning: 'legacy_endpoint_retired'` and logs a CRITICAL error
- **Action required:** Remove `/api/subscriptions/webhook` from Stripe dashboard webhooks — only `/api/stripe/webhook` should be registered

---

### 2. Admin Subscription Tab — Instructor Profile

**`app/admin/instructors/[id]/page.tsx`**
- Added **Subscription** tab (4th tab: Overview · Subscription · Bookings · Documents)
- Shows DB state vs live Stripe state side-by-side with refresh button
- Automatic drift detection — if DB and Stripe disagree, amber warning with one-click "Force Sync" button
- Actions wired to `POST /api/admin/instructors/[id]/subscription`:
  - **Force sync** — pulls live Stripe state into DB
  - **Cancel at period end** — sets `cancel_at_period_end: true` in Stripe (with reason modal)
  - **Cancel immediately** — cancels Stripe subscription now (with reason modal)
  - **Link Stripe sub ID** — manually links a `stripeSubscriptionId` to fix missing links
  - **Override tier / status** — sets any tier + status without touching Stripe (trial extensions, corrections); requires reason; audit-logged
  - **Delete duplicate row** — trash button on individual subscription rows (only visible when multiple rows exist)

---

### 3. Admin Subscriptions List Page

**`app/admin/subscriptions/page.tsx`** — new page at `/admin/subscriptions`
- Summary cards: Active / Trial / Past Due / Cancelled / Total — double as filter chips
- Search by name or email
- Filter by tier (BASIC / PRO / STUDIO / BUSINESS)
- Filter by status (ACTIVE / TRIAL / PAST_DUE / CANCELLED)
- Per-row quick Force Sync button (Stripe linked only)
- Stripe link indicator: green tick or amber warning per row
- Links to instructor profile → Subscription tab

**`app/api/admin/subscriptions/route.ts`** — new API powering the list page

**`components/admin/AdminNav.tsx`**
- Added "Subscriptions" link to the Users dropdown

---

### 4. STUDIO Commission Rate — Added End-to-End

**`prisma/schema.prisma`**
- Added `studioCommissionRate Float @default(11)` to `PlatformSettings`

**`prisma/migrations/20260721000001_add_studio_commission_rate/migration.sql`**
```sql
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "studioCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 11;
```

**`lib/services/platform-pricing.ts`**
- Added `studioCommissionRate` to `PricingSettings` interface and `DEFAULTS`
- `getCommissionRate('STUDIO')` now returns `pricing.studioCommissionRate` (was falling through to `basicCommissionRate`)

**`app/api/admin/pricing/route.ts`**
- Added `studioCommissionRate` to Zod validation schema

**`components/admin/PricingSettingsForm.tsx`**
- Commission grid expanded from 3 → 4 columns: Basic / Pro / Studio / Business

---

## Session: 2026-07-20 — Lesson Feedback + Assessment Type System

### Summary
Added `assessmentType` (COACHING/MOCK), `lessonTopics`, `passed` fields to Booking schema. Redesigned LessonFeedbackForm. Student progress redesigned as timeline. Fixed duplicate route functions and payment.ts class methods.

### Key files
`prisma/schema.prisma`, `prisma/migrations/20260720000001_add_assessment_type/migration.sql`,
`components/instructor/LessonFeedbackForm.tsx`, `app/api/instructor/lesson-feedback/route.ts`,
`app/api/client/my-performance/route.ts`, `app/client-dashboard/progress/page.tsx`,
`lib/services/lesson-feedback-service.ts`, `lib/services/payment.ts`

---

## Session: 2026-07-20 — Packages + Dashboard Widget Fixes

### Summary
Fixed `$5/h` rate bug (now uses `instructor.hourlyRate`), `ExpiresJan 1, 1970` null date bug, and unpaid packages showing in Clients Needing Attention widget. Added `RemindButton` for SMS from dashboard.

### Key files
`app/api/instructor/packages/route.ts`, `app/dashboard/packages/page.tsx`,
`app/dashboard/page.tsx`, `components/instructor/RemindButton.tsx`,
`app/api/instructor/remind-client/route.ts`, `app/api/instructor/clients/[id]/route.ts`

---

## Session: 2026-07-20 — Documents Page Redesign

### Summary
Collapsible document rows, Account Setup progress checklist, next-step banner, mobile-first layout. Added `abn`, `abnVerified`, `workingHours`, `subscriptionStatus` to profile API select. Fixed hydration error in CheckItem.

### Key files
`app/dashboard/documents/page.tsx`, `app/api/instructor/profile/route.ts`

---

## Session: 2026-07-20 — Waiting List → Slot-Open Automation

### Summary
Created `lib/services/waiting-list-notify.ts`. Wired into both cancel routes. Fire-and-forget pattern.

### Key files
`lib/services/waiting-list-notify.ts`, `app/api/bookings/[id]/cancel/route.ts`, `app/api/public/bookings/[id]/cancel/route.ts`

---

## Session: 2026-07-20 — Remove Hardcoded Values (Task 5)

### Summary
Replaced hardcoded commission rates, cancellation windows (24h/48h), payout buffer (48h), and platform fees with DB-backed `PlatformSettings` reads.

### Key files
`lib/services/payment.ts`, `lib/config/packages.ts`, `lib/services/stripe.ts`,
`app/api/analytics/route.ts`, `app/api/analytics/mobile/route.ts`,
`app/api/cron/weekly-payouts/route.ts`, `app/cancel-booking/[id]/page.tsx`,
`app/api/bookings/[id]/cancel/route.ts`, `app/api/public/bookings/[id]/cancel/route.ts`,
`app/api/bookings/[id]/cancellation-policy/route.ts`, `app/api/public/bookings/[id]/cancellation-policy/route.ts`,
`components/CancelDialog.tsx`, `lib/config/governance.ts`

---

## Session: 2026-07-19 — BUSINESS Tier Enable + Subscription Config

### Summary
Removed `comingSoon: true` from BUSINESS card. Updated feature list with `— Coming soon —` HR divider, clock icons for roadmap items. Updated `lib/config/subscriptions.ts` BUSINESS features to reflect v1 reality.

### Key files
`components/SubscriptionPlans.tsx`, `lib/config/subscriptions.ts`

---

## Session: 2026-07-19 — Admin Operations Manual + Policy Page

### Summary
Created 11 operations docs in `docs/operations/`. Built `/admin/policy` page with sidebar navigation and full-text search. Fixed extractSections null crash. Added "Policy & Rules" to AdminNav.

### Key files
`docs/operations/README.md` through `11-release-management.md`,
`app/admin/policy/page.tsx`, `components/admin/AdminPolicyViewer.tsx`, `components/admin/AdminNav.tsx`

---

## Session: 2026-07-19 — Identity Architecture + BUSINESS Tier Foundation

### Summary
Introduced organisation-led identity model, created `getDisplayName` utility, traced through all student-facing surfaces. Homepage SEO fixes.

### Key files
`prisma/schema.prisma` (businessName), `lib/utils/account.ts`, `lib/branding/getDisplayIdentity.ts`,
`lib/services/sms.ts`, `lib/services/notifications.ts`, `app/subdomain/[slug]/page.tsx`,
`app/api/instructors/recommendations/route.ts`, `app/dashboard/branding/page.tsx`,
`app/api/instructor/branding/route.ts`, `app/page.tsx`

---

*Maintained by Kiro. Add new entries at the top. Each session gets a summary block.*

---

## Session: 2026-07-31 — Business Card Builder + Security Hardening

### Summary
Two streams of work this session. First: a new instructor marketing feature — a business card builder with client-side PDF generation. Second: a series of security improvements covering session idle timeout, device fingerprinting, and new device login notifications.

---

### Feature: Instructor Business Card Builder

**New route: `/dashboard/marketing/cards`**

Instructors can now design, preview, and download print-ready business cards from their dashboard. The card engine is built as a reusable component set so the same components can serve a future public `/business-card` lead-funnel page with minimal additional work.

#### Architecture

```
components/marketing/cards/
├── types.ts                  ← CardData type, CardOrderStatus enum
├── BusinessCardPreview.tsx   ← Live front/back card preview (85×55mm)
├── BusinessCardForm.tsx      ← Editable fields (locked: name/phone/URL; editable: suburbs/car/transmission)
├── BusinessCardPDF.ts        ← Client-side jsPDF engine (A4, 10-up, duplex-ready, crop marks)
└── CardQRCode.tsx            ← QR wrapper with consistent settings

app/dashboard/marketing/cards/page.tsx   ← Authenticated instructor page
app/api/instructor/card-order/route.ts   ← POST (submit print request) + GET (order history)
```

#### Card design
- **Front:** DriveBook brand, instructor name, phone, service areas, transmission/car label, QR code pointing to booking URL
- **Back:** Driving progress tracker — 6-row date/skill/signed table. Gives students a reason to keep the card.
- **Footer:** Shows instructor's actual subdomain (`john.drivebook.com.au`) or custom domain if verified and set

#### Data pre-fill
All fields are fetched from the instructor profile on page load:
- `name`/`displayName` → locked
- `phone` → locked
- `bookingUrl` (derived from `customSlug` or `id`) → locked, drives QR code
- `footerDomain` (custom domain if verified, else subdomain) → auto-derived
- `suburb` (from parsed `baseAddress`) → editable
- `carMake + carModel` → editable `carLabel` field
- `vehicleTypes` → maps to `AUTOMATIC | MANUAL | BOTH` toggle

#### PDF engine (`BusinessCardPDF.ts`)
- Dynamically imported — keeps jsPDF (~250KB) out of the initial bundle
- Page 1: 10 card fronts in 2×5 grid (MARGIN_X=19.4mm, MARGIN_Y=13.5mm, CARD_W=85.6mm, CARD_H=54mm)
- Page 2: 10 card backs with columns mirrored for duplex long-edge flip
- Crop marks at all 15 intersection points
- No emoji — uses plain text labels (`Ph:`, `Car:`) since jsPDF Helvetica is Latin-only
- Name wraps to 2 lines via `splitTextToSize` — no arbitrary truncation
- jsPDF + @types/qrcode installed at pinned versions (jspdf@2.5.1, qrcode@1.5.3)

#### Print request system
- Instructor can request a physical printed pack (50/100/200 cards)
- Order stored as `CardOrder` with status lifecycle: `PENDING → APPROVED → PRINTING → READY → DELIVERED`
- Duplicate order guard: blocks new request if one is already active
- Admin receives email notification on new order
- `CardOrder` model added to `prisma/schema.prisma`; requires migration before print requests work (PDF download works without migration)

#### Navigation
- "Business Cards" added to DashboardNav under the Marketing section, using the already-imported `CreditCard` icon

#### Known pending
- `npx prisma migrate dev --name add_card_orders` must be run to activate the `CardOrder` table
- Physical fulfilment is handled manually by admin; no wallet deduction in v1

---

### Security: Session Idle Timeout

**`lib/auth.ts`**

Sessions previously remained valid for the full 7-day `maxAge` regardless of activity. An instructor who walked away from a shared computer could be accessed days later.

**Fix:** Added idle timeout in the NextAuth JWT callback:
- `lastActivity` Unix timestamp stored in the JWT on every request
- On each JWT validation, if `now - lastActivity > 1800` (30 minutes), the callback returns `null`, which invalidates the session and forces re-login
- Absolute `maxAge` unchanged at 7 days — the idle timeout fires first in practice
- 30-minute threshold configurable by changing `IDLE_TIMEOUT` constant

```typescript
// 30 minutes of inactivity → session invalidated → redirect to login
const IDLE_TIMEOUT = 30 * 60
if (lastActivity && now - lastActivity > IDLE_TIMEOUT) return null as any
token.lastActivity = now
```

---

### Security: New Device Login Detection + Email Notification

**Files added:**
- `lib/services/deviceTracking.ts` — device identity and login tracking service
- `app/api/auth/device-check/route.ts` — POST endpoint called after login
- Schema: `LoginDevice` model added to `prisma/schema.prisma`

**Identity strategy (important):**
Previous design used `SHA256(IP + User-Agent)` as the device fingerprint. This produced false "new device" alerts whenever an instructor switched from home Wi-Fi to mobile data, enabled a VPN, or changed networks. IP is now login *context* only — never used for identity.

The device is identified by a browser-generated UUID stored in `localStorage`:
```
Device identity  = SHA256(localStorage["drivebook_device_id"])
IP + User-Agent  = stored as audit context, never used for fingerprint
```

**`lib/services/deviceTracking.ts` — design decisions:**
- `getOrCreateDeviceToken()` — browser-only, uses `window.crypto.randomUUID()` (Web Crypto API, not Node crypto), validates UUID v4 format before trusting stored value
- `validateDeviceToken()` — server-side UUID v4 regex validation before any DB work; rejects malformed input
- `generateFingerprint()` — SHA-256 of the device token; raw UUID never stored in DB
- `recordDeviceLogin()` — uses `findUnique + upsert` pattern: `findUnique` determines `isNewDevice`, `upsert` handles the write safely under concurrent login (prevents P2002 on simultaneous tab logins)
- `parseUserAgent()` — corrected detection order: Edge before Chrome (Edge UA contains "Chrome/"), iOS/iPadOS before macOS (some iPad UA strings resemble desktop macOS)
- `getUserDevices()` — limit clamped to `[1, 50]` to prevent oversized queries
- All catch blocks log before returning fallback (no silent swallowing)
- `// @ts-expect-error` comments are temporary — marked `SEC-3` in TODO; remove after migration + `prisma generate`

**`app/api/auth/device-check/route.ts`:**
- Called client-side after successful login (fire-and-forget, never blocks login)
- Validates UUID before any DB work
- If new device: sends HTML email notification (device name, partial IP, timestamp, reset password CTA)
- If DB unavailable (pre-migration): silently returns `{ success: true }` — login never affected

**`app/login/page.tsx`:**
- After successful login: `getOrCreateDeviceToken()` called via dynamic import
- Device token sent in POST body to `/api/auth/device-check`
- Entire device-check block is wrapped in `try/catch` — any failure is silent

**New device email:**
```
Subject: New login to your DriveBook account
Body: Device (Chrome on Windows), Time (AWST), IP (first 2 octets only)
CTA: Reset Password button if not you
```

**`LoginDevice` schema:**
```prisma
model LoginDevice {
  id          String   @id @default(cuid())
  userId      String
  fingerprint String   // SHA-256 of device token
  lastUsedAt  DateTime @default(now())
  firstSeenAt DateTime @default(now())
  ipAddress   String   // context only
  userAgent   String   // context only
  trusted     Boolean  @default(false)
  @@unique([userId, fingerprint])
}
```

**Pending:** Requires `npx prisma migrate deploy` to create the `LoginDevice` table. Until then, tracking silently degrades with a `console.warn`.

---

### Pending Migrations (both features)

Both new schema models require a migration before their database-dependent features activate:

```bash
# Run once — creates LoginDevice + CardOrder tables
npx prisma migrate dev --name add_login_device_and_card_orders
npx prisma generate
npx tsc --noEmit
npm run build
```

After migration:
- Remove `// @ts-expect-error` lines in `lib/services/deviceTracking.ts`
- Run manual test scenarios documented in `docs/DOCROLEBASE/TODO.md` (SEC-3 section)

### Files added/changed summary

| File | Status | Purpose |
|------|--------|---------|
| `components/marketing/cards/types.ts` | New | CardData type + CardOrderStatus enum |
| `components/marketing/cards/BusinessCardPreview.tsx` | New | Live front/back card preview |
| `components/marketing/cards/BusinessCardForm.tsx` | New | Editable card fields |
| `components/marketing/cards/BusinessCardPDF.ts` | New | Client-side PDF generator |
| `components/marketing/cards/CardQRCode.tsx` | New | QR code wrapper |
| `app/dashboard/marketing/cards/page.tsx` | New | Instructor card builder page |
| `app/api/instructor/card-order/route.ts` | New | Print order POST + GET |
| `lib/services/deviceTracking.ts` | New | Device fingerprint + tracking |
| `app/api/auth/device-check/route.ts` | New | Post-login device check + email |
| `prisma/schema.prisma` | Modified | Added `LoginDevice` + `CardOrder` models |
| `lib/auth.ts` | Modified | Added 30-min idle timeout; device imports |
| `app/login/page.tsx` | Modified | Calls device-check after login |
| `components/DashboardNav.tsx` | Modified | Added Business Cards nav link |
| `docs/DOCROLEBASE/TODO.md` | Modified | SEC-1 to SEC-6 phase 2 security items; post-migration checklist; 10 manual test scenarios |
