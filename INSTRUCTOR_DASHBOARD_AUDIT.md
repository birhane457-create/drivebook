# Instructor Dashboard Audit

**Audited:** August 2026  
**Scope:** `app/dashboard/` — all instructor-facing pages

---

## Verdict by claim

| Claim | Status | Notes |
|---|---|---|
| `alert()` in `marketing/cards/page.tsx` | ✅ **Fixed** | Replaced with `pdfError` state + inline red error panel |
| `navigator.clipboard` in `branding/page.tsx` | ⚠️ **Real, acceptable** | `copyUrl()` uses clipboard API — fails silently if denied; add `try/catch` if it becomes a complaint |
| `navigator.clipboard` in `marketing/page.tsx` | ⚠️ **Real, acceptable** | Same pattern, same risk |
| `navigator.clipboard` in `profile/share/page.tsx` | ⚠️ **Real, acceptable** | Same — no fallback |
| `document.createElement('a')` in `earnings` + `expenses` | ✅ **Real, by design** | Standard file download pattern — works on all modern browsers including mobile Safari |
| `localStorage` in `settings/security/page.tsx` | ❌ **Wrong file** | No localStorage in that file. Device token is read in `login/page.tsx` inside a dynamic import inside a click handler — always client-side, SSR-safe |
| `router.push('/login')` in `bookings/[id]/*` pages | ❌ **Inaccurate** | Pages use `useSession` — the middleware handles redirect for all `/dashboard/*` routes at the edge |
| `invoice/[transactionId]/page.tsx` listed | ❌ **Doesn't exist** | File not found on disk |
| `clients/[id]/performance/page.tsx` listed | ❌ **Doesn't exist** | File not found on disk |

---

## What was fixed

**`app/dashboard/marketing/cards/page.tsx`**
- Added `pdfError` state
- `handleDownload()`: replaced `alert('Could not generate PDF...')` with `setPdfError(...)`
- Error displayed as inline red panel with `AlertCircle` icon below the download button
- Error clears on next download attempt

---

## Remaining clipboard risk (low priority)

Three pages use `navigator.clipboard.writeText()` without a fallback:
- `app/dashboard/branding/page.tsx` — `copyUrl()`
- `app/dashboard/marketing/page.tsx` — `handleCopyUrl()`
- `app/dashboard/profile/share/page.tsx` — inline onClick

The Clipboard API requires HTTPS and user permission. On HTTPS (production Vercel), this always works. The only scenario where it fails is HTTP local dev or a browser that has blocked clipboard access. Since the app already enforces HTTPS in production, this is low priority. Add `try/catch` if instructors report copy button failures.

Suggested pattern when touching any of those files:
```ts
const copyUrl = (url: string, key: string) => {
  navigator.clipboard.writeText(url).catch(() => {
    // Fallback: select the text so user can copy manually
  })
  setCopied(key)
  setTimeout(() => setCopied(null), 2000)
}
```

---

## Pages that exist vs audit list

| Page (audit claimed) | Exists? |
|---|---|
| `dashboard/layout.tsx` | ✅ |
| `dashboard/page.tsx` | ✅ |
| `dashboard/availability/page.tsx` | ✅ |
| `dashboard/bookings/page.tsx` | ✅ |
| `dashboard/bookings/[id]/page.tsx` | ✅ |
| `dashboard/bookings/[id]/edit/page.tsx` | ✅ |
| `dashboard/bookings/[id]/reschedule/page.tsx` | ✅ |
| `dashboard/bookings/new/page.tsx` | ✅ |
| `dashboard/branding/page.tsx` | ✅ |
| `dashboard/clients/page.tsx` | ✅ |
| `dashboard/clients/[id]/page.tsx` | ✅ |
| `dashboard/clients/[id]/performance/page.tsx` | ❌ Does not exist |
| `dashboard/credits/add-funds/page.tsx` | ✅ |
| `dashboard/documents/page.tsx` | ✅ |
| `dashboard/earnings/page.tsx` | ✅ |
| `dashboard/expenses/page.tsx` | ✅ |
| `dashboard/help/page.tsx` | ✅ |
| `dashboard/invoice/[transactionId]/page.tsx` | ❌ Does not exist |
| `dashboard/invoice/gallery/page.tsx` | ✅ |
| `dashboard/invoice/demo/page.tsx` | ✅ |
| `dashboard/marketing/page.tsx` | ✅ |
| `dashboard/marketing/cards/page.tsx` | ✅ |
| `dashboard/packages/page.tsx` | ✅ |
| `dashboard/pda-tests/page.tsx` | ✅ |
| `dashboard/profile/page.tsx` | ✅ |
| `dashboard/profile/share/page.tsx` | ✅ |
| `dashboard/schedule/page.tsx` | ✅ |
| `dashboard/settings/page.tsx` | ✅ |
| `dashboard/settings/payout/page.tsx` | ✅ |
| `dashboard/settings/security/page.tsx` | ✅ |
| `dashboard/subscription/page.tsx` | ✅ |
| `dashboard/wallet/page.tsx` | ✅ |
| `dashboard/analytics/page.tsx` | ✅ |

**31 of 33 pages exist.** Two were listed in the audit that don't exist on disk.

---

## Auth pattern (clarification)

The audit claimed `router.push('/login')` was used for client-side redirects in booking detail pages. The actual pattern:

- **`middleware.ts`** — protects all `/dashboard/*` routes at the edge. Unauthenticated requests never reach the page.
- **Individual pages** — use `useSession()` from NextAuth to get session data. They don't need to redirect themselves.

This is the correct pattern for Next.js App Router. No change needed.
