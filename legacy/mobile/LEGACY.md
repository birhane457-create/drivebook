# LEGACY — Retired Expo Mobile Application

This directory contains the original React Native / Expo mobile client for DriveBook.

**Status: RETIRED — not the current mobile architecture.**

---

## Current mobile architecture

The current DriveBook mobile app is a **Capacitor wrapper around the Next.js web application**:

- Configuration: `capacitor.config.ts` at repository root (`appId: com.drivebook.app`)
- Build: `npm run mobile:build` (builds Next.js + syncs Capacitor)
- Auth: NextAuth session cookies (same as browser)
- API: Standard Next.js routes under `app/api/`

The Capacitor app renders the full Next.js web application natively. It does not use this
Expo codebase.

---

## What this directory contains

A self-contained React Native / Expo application with its own `package.json`, `node_modules`,
and Expo build configuration. It communicates with the backend via JWT Bearer tokens
(`Authorization: Bearer <token>`) stored in AsyncStorage — a different auth mechanism
from the current NextAuth session-based architecture.

Key files:
- `services/api.ts` — Axios-based API client using JWT Bearer tokens
- `screens/client/WalletScreen.tsx` — package purchase UI (references `/api/client/packages/mobile`)
- `App.tsx` — React Native navigation shell

---

## Why it is retained

Git history preserves the full source. The code is kept here for reference. It is not
built, tested, deployed, or depended upon by any active part of the repository.

---

## Security note

The API endpoint this codebase called — `POST /api/client/packages/mobile` — has a known
security vulnerability (INT-M-PKG-01: IDOR, hardcoded pricing, payment bypass). That
endpoint is currently disabled via a kill switch (`ENABLE_MOBILE_PACKAGE_PURCHASE` unset
= 503). The endpoint's remediation is tracked separately from this legacy codebase.

See: `docs/audit/INT-M-PKG-01_ARCHITECTURE_CORRECTION.md`

---

## Dependency audit result (verified 2026-08-15, commit d8aab97a)

| Check | Result |
|-------|--------|
| Root `package.json` scripts reference this folder | No |
| npm workspace dependency | No |
| CI/CD pipeline | No |
| Docker/build dependency | No |
| Next.js transpiles this folder | No |
| Root Vitest test suite includes this folder | No |
| Active code imports from this folder | No |
| Current Capacitor app depends on this folder | No |

This folder is safe to archive or delete without affecting any active system.
The decision to do so is separate from the INT-M-PKG-01 security remediation.
