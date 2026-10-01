# INT-M-PKG-01 — Architecture Correction Notice

**Date:** 2026-08-15  
**Commit:** fef1d7dc  
**Supersedes:** specific claims in the documents listed below

---

## Correction

Several INT-M-PKG-01 audit documents contain the statement:

> "route is actively used by mobile app (mobile/services/api.ts + WalletScreen.tsx)"

or equivalent phrasing implying that the endpoint is part of the current production mobile architecture.

**That statement is historically accurate for the legacy Expo mobile client but is NOT accurate for the current mobile architecture.**

---

## Verified architecture (fef1d7dc)

### Current mobile architecture
- **Capacitor** wraps the Next.js web application (`capacitor.config.ts`: `appId: com.drivebook.app`)
- Capacitor loads the Next.js app and renders it natively
- Auth: NextAuth session cookies (same as browser)
- Package purchase: `app/api/public/bookings/bulk` (web booking wizard)
- Client dashboard: `app/client-dashboard/page.tsx` → `AddCreditsModal` → `/api/client/wallet-topup-intent`
- **The Capacitor app does NOT call `/api/client/packages/mobile`**

### Legacy Expo mobile client (not current)
- `mobile/services/api.ts` — Axios + AsyncStorage + Bearer JWT auth
- `mobile/screens/client/WalletScreen.tsx` — called `purchasePackage()` → `POST /api/client/packages/mobile`
- This codebase is still physically present in the repository but is not the current mobile architecture

### Verification method
Traced `app/client-dashboard/page.tsx` (current Capacitor client UI) to its API calls:
- `fetch('/api/client/profile')`
- `fetch('/api/client/wallet')`
- `fetch('/api/client/current-instructor')`
- `fetch('/api/client/my-performance')`
- `AddCreditsModal` → `/api/client/wallet-topup-intent`
- `useSession()` from `next-auth/react` — session auth, not JWT Bearer

No reference to `/api/client/packages/mobile` found in any current Capacitor client code path.

---

## Documents containing stale claims (historical — do not modify)

These documents are preserved as historical evidence of the original finding and are NOT edited. This correction document supersedes their architecture statements only.

| Document | Stale claim |
|----------|-------------|
| `docs/audit/phase2/INT-M-PKG-01-DISCOVERY.md` | States endpoint is "actively used by mobile app" |
| `docs/audit/phase2/INT-M-PKG-01-OPERATIONAL-CONTROL.md` | States current mobile usage |
| `docs/audit/phase2/INT-M-PKG-01-SUMMARY.md` | States `mobile/services/api.ts + WalletScreen.tsx` = production usage |
| `docs/audit/INT-M-PKG-01_PRODUCTION_VERIFIED_EVIDENCE.md` | States current mobile usage |
| `docs/audit/INT-M-PKG-01_SUMMARY.md` | States current mobile usage |

---

## Current finding gate

| Item | Status |
|------|--------|
| Vulnerable POST code exists | YES — still present behind kill switch |
| IDOR / hardcoded price / payment bypass | YES — in disabled branch |
| Production containment | YES — 503 kill switch |
| Current Capacitor app calls endpoint | NO |
| V4 implementation plan | WITHDRAWN |
| Finding | OPEN / CONTAINED |
| Kill switch | REMAINS OFF (unset = 503) |

---

## Pending architectural decision

**RETIRE:** Remove the obsolete POST implementation. The kill switch becomes permanent dead code removal. Current Capacitor app is unaffected. Legacy Expo code becomes explicitly dead.

**REPLACE:** Only if an explicit product requirement emerges for a JWT-based mobile package-purchase API (e.g., a future non-Capacitor native client).

**This decision must be explicitly recorded before any code change is made.**

Retirement path: `OPEN / CONTAINED → decision recorded → POST handler deleted → verification → CLOSED`
