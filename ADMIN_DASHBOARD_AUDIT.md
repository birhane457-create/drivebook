# Admin Dashboard Audit

**Audited:** August 2026  
**Scope:** `app/admin/` — all admin-facing pages

---

## Verdict by claim

| Claim | Status | Notes |
|---|---|---|
| `admin/layout.tsx` uses `getServerSession` + `redirect()` | ✅ **TRUE** | Confirmed — server component, checks role, redirects INSTRUCTOR → `/dashboard`, CLIENT → `/client-dashboard`, else → `/login` |
| Admin pages use `getServerSession()` consistently | ✅ **TRUE** | Layout enforces at edge; individual pages rely on layout gate (correct pattern) |
| `admin/revenue/page.tsx` uses `document.createElement('a')` for CSV download | ✅ **TRUE** — acceptable | Line 120, same standard pattern as expenses/earnings. Works on all modern browsers and mobile Safari. No change needed. |
| `admin/instructors/[id]/page.tsx` replaced `window.confirm()` with inline modals | ✅ **TRUE** | Already done — code comments explicitly say "C-08 fix: replaces window.confirm()" |
| `console.error` used without user messages | ⚠️ **PARTIALLY TRUE** | `admin/documents/page.tsx` already has both `console.error` AND `showToast('error', ...)` — good. `admin/credits/page.tsx` and `admin/clients/page.tsx` log but show no user message. `admin/staff-governance/page.tsx` same. `admin/page.tsx` sets `dataUnavailable = true` — correct. Not a blocker, low priority. |
| `admin/bookings/[id]/edit/page.tsx` redirect-after-update UX | ✅ **EXISTS** | File is real. The concern about error surfacing is valid but low priority. |

---

## Page existence — all 26 claimed pages exist

All pages listed in the audit were verified to exist on disk. PowerShell's path pattern-matching with square brackets (`[id]`, `[instructorId]`, `[userId]`) caused false "missing" results in the earlier check — the files are real.

| Page | Exists |
|---|---|
| `admin/layout.tsx` | ✅ |
| `admin/page.tsx` | ✅ |
| `admin/bookings/page.tsx` | ✅ |
| `admin/bookings/[id]/edit/page.tsx` | ✅ |
| `admin/clients/page.tsx` | ✅ |
| `admin/clients/[id]/page.tsx` | ✅ |
| `admin/copilot/page.tsx` | ✅ |
| `admin/credits/page.tsx` | ✅ |
| `admin/disputes/page.tsx` | ✅ |
| `admin/documents/page.tsx` | ✅ |
| `admin/documents/review/[instructorId]/page.tsx` | ✅ |
| `admin/instructors/page.tsx` | ✅ |
| `admin/instructors/[id]/page.tsx` | ✅ |
| `admin/policy/page.tsx` | ✅ |
| `admin/pricing/page.tsx` | ✅ |
| `admin/register/page.tsx` | ✅ |
| `admin/revenue/page.tsx` | ✅ |
| `admin/reviews/page.tsx` | ✅ |
| `admin/settings/page.tsx` | ✅ |
| `admin/staff-governance/page.tsx` | ✅ |
| `admin/subscriptions/page.tsx` | ✅ |
| `admin/support/page.tsx` | ✅ |
| `admin/support/user/[userId]/page.tsx` | ✅ |
| `admin/test-centres/page.tsx` | ✅ |
| `admin/voice-lines/page.tsx` | ✅ |
| `admin/payouts/page.tsx` | ✅ |

**26/26 pages exist.**

---

## Auth pattern (confirmation)

`admin/layout.tsx` is a **server component** that calls `getServerSession(authOptions)` and `redirect()` before rendering children. This is the correct Next.js App Router pattern — no client-side redirect needed in individual pages.

The audit claim about "server-side queries rather than client-side filtering" in `admin/bookings` and `admin/clients` is accurate — both are client components that call API routes which do server-side Prisma queries.

---

## console.error coverage — where user messages are missing

Pages where `console.error` is used **without** a corresponding user-facing error message:

| File | Has user message? |
|---|---|
| `admin/page.tsx` | ✅ Yes — `dataUnavailable = true` banner |
| `admin/documents/page.tsx` | ✅ Yes — `showToast('error', ...)` on every catch |
| `admin/instructors/[id]/page.tsx` | ✅ Yes — `router.push('/admin/instructors')` on load failure |
| `admin/bookings/[id]/edit/page.tsx` | ✅ Yes — `setPageError(...)` and `setCancelError(...)` |
| `admin/credits/page.tsx` | ❌ No — only `console.error`, no user message on fetch failure |
| `admin/clients/page.tsx` | ❌ No — only `console.error`, page shows empty state silently |
| `admin/staff-governance/page.tsx` | ❌ No — only `console.error` on fetch failure |

The 3 pages without user messages show empty state or a loading spinner that never resolves. For admin pages, this is low priority since admins can check the browser console. Worth a one-line fix when touching those files.

---

## Recommended actions (in priority order)

| # | Priority | Action | File |
|---|---|---|---|
| 1 | 🟢 Low | Add error state to `credits/page.tsx` fetch failure | `admin/credits/page.tsx` |
| 2 | 🟢 Low | Add error state to `clients/page.tsx` fetch failure | `admin/clients/page.tsx` |
| 3 | 🟢 Low | Add error state to `staff-governance/page.tsx` fetch failure | `admin/staff-governance/page.tsx` |
| 4 | 🟢 Low | Add `try/catch` to clipboard in branding/marketing pages | When touching those files |

**Nothing in this audit is a blocker.** The admin area is well-protected and functionally correct.
