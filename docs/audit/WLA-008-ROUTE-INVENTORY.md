# WLA-008 — Cross-Provider Tenant Isolation Route Inventory

**Date:** 2026-10-27
**Finding:** WLA-008 (OPEN — P1)
**Scope:** Complete inventory of provider-facing routes that read or write provider-owned resources

## Methodology

Every API route under the following path prefixes was inspected:
- `/api/instructor/**` — instructor-facing dashboard routes
- `/api/bookings/**` — booking management routes
- `/api/client/**` — client-facing routes that may reference provider resources
- `/api/business/**` — business management routes
- `/api/public/**` — public routes (no auth; providerId from request is expected)
- `/api/availability/**` — availability checking routes
- `/api/branding/**` — branding routes
- `/api/packages/**` — package routes
- `/api/reviews/**` — review routes

## Classification system

| Class | Meaning |
|---|---|
| ✅ SECURED | Query scoped by `session.user.providerId`; request-supplied IDs are validated against the authenticated provider |
| ⚠️ REVIEW | Uses session for auth but may accept providerId from request without verifying ownership |
| ❌ VULNERABLE | Accepts providerId from request without any ownership check |
| ℹ️ PUBLIC | No auth required; providerId from request is by design (public booking, reviews) |
| 🔒 ADMIN | Admin-only route; provider scoping is not applicable |

## Inventory — Instructor-facing routes (`/api/instructor/**`)

### Routes that scope by session.providerId (✅ SECURED)

| Route | Method | Scoping | Notes |
|---|---|---|---|
| `/api/instructor/profile` | GET, PUT | `session.user.providerId` | Reads/writes own profile |
| `/api/instructor/branding` | GET, PUT | `session.user.providerId` | Reads/writes own branding |
| `/api/instructor/earnings` | GET | `session.user.providerId` | Reads own earnings |
| `/api/instructor/earnings/this-week` | GET | `session.user.providerId` | Reads own weekly earnings |
| `/api/instructor/client-performance` | GET | `session.user.providerId` | Reads own client performance |
| `/api/instructor/client-lesson-feedback` | GET | `session.user.providerId` | Reads own lesson feedback |
| `/api/instructor/payouts` | GET | `session.user.providerId` | Reads own payouts |
| `/api/instructor/payout-settings` | GET, POST | `session.user.providerId` | Reads/writes own payout settings |
| `/api/instructor/packages` | GET | `session.user.providerId` | Reads own packages |
| `/api/instructor/quotes` | GET | `session.user.providerId` | Reads own quotes |
| `/api/instructor/consent` | GET, POST | `session.user.id` | Reads/writes own consent |
| `/api/instructor/documents` | GET, POST | `session.user.providerId` | Reads/writes own documents |
| `/api/instructor/documents/[type]` | GET | `session.user.providerId` | Reads own document by type |
| `/api/instructor/documents/expiry` | POST | `session.user.providerId` | Updates own document expiry |
| `/api/instructor/domain/verify` | POST | `session.user.providerId` | Verifies own domain |
| `/api/instructor/expenses/[id]` | DELETE | `session.user.providerId` | Deletes own expense (ownership checked) |
| `/api/instructor/test-package` | GET, PUT | `session.user.providerId` | Reads/writes own test package |
| `/api/instructor/custom-packages` | GET, POST | `session.user.providerId` | Lists/creates own custom packages |
| `/api/instructor/custom-packages/[id]` | GET, PATCH, DELETE | `session.user.providerId` | Owns/updates/deletes own custom package |
| `/api/instructor/voice-line` | GET | `session.user.id` | Reads own voice line status |
| `/api/instructor/whiteboard/upload` | POST | `session.user.providerId` | Uploads to own whiteboard |
| `/api/instructor/bio-generate` | POST | `session.user.providerId` | Generates own bio |
| `/api/instructor/receipts/weekly` | GET | `session.user.providerId` | Reads own weekly receipts |

### Routes that accept resource IDs from request (⚠️ REVIEW)

| Route | Method | Risk | Notes |
|---|---|---|---|
| `/api/instructor/clients/[id]` | GET | ⚠️ | Accepts client ID from URL; must verify the client belongs to the authenticated provider |
| `/api/instructor/invoices/[transactionId]` | GET | ⚠️ | Accepts transaction ID; must verify it belongs to the authenticated provider |
| `/api/instructor/invoices/[transactionId]/data` | GET | ⚠️ | Same as above |
| `/api/instructor/quotes/[bookingId]/submit` | POST | ⚠️ | Accepts booking ID; must verify the booking belongs to the authenticated provider |
| `/api/instructor/devices/[id]` | DELETE | ℹ️ | Device ID is user-scoped (not provider-scoped); uses `session.user.id` |

## Inventory — Booking routes (`/api/bookings/**`)

| Route | Method | Class | Notes |
|---|---|---|---|
| `/api/bookings` | GET, POST | ⚠️ REVIEW | GET scopes by `session.user.providerId`; POST creates booking for the provider — needs ownership check on providerId from request |
| `/api/bookings/batch` | POST | ⚠️ REVIEW | Creates batch bookings; providerId from session but customer ID from request — needs verification |
| `/api/bookings/[id]` | GET, PUT | ⚠️ REVIEW | Accepts booking ID; must verify booking belongs to authenticated provider |
| `/api/bookings/[id]/reschedule` | POST | ✅ SECURED | Query: `where: { id: params.id, providerId: session.user.providerId }` |
| `/api/bookings/combined` | POST | ⚠️ REVIEW | Accepts `data.providerId` from request body — public-facing route (customer books a lesson) |
| `/api/bookings/offline` | POST | ✅ SECURED | Uses `session.user.providerId` for booking creation |
| `/api/bookings/mobile` | POST | ⚠️ REVIEW | JWT auth; uses decoded providerId — needs verification of JWT claim |

## Inventory — Client-facing routes (`/api/client/**`)

| Route | Method | Class | Notes |
|---|---|---|---|
| `/api/client/packages` | GET | ✅ SECURED | Uses `session.user.id` to find customers → packages |
| `/api/client/confirm-package-booking` | POST | ✅ SECURED | Uses transaction-scoped booking lookup |
| `/api/client/quotes/request` | POST | ⚠️ REVIEW | Accepts `data.providerId` from request — intentional (client requests quote from a specific provider) |
| `/api/client/quotes/[id]/accept` | POST | ✅ SECURED | Verifies quote belongs to `session.user.id` (customer) |
| `/api/client/schedule-package-hours` | POST | ⚠️ REVIEW | Accepts `providerId` from request body — needs verification |
| `/api/client/bookings/create-bulk` | POST | ⚠️ REVIEW | Accepts `providerId` from cart items — wallet deduction checks balance |
| `/api/client/bookings/[id]` | GET | ⚠️ REVIEW | Accepts booking ID; uses `session.user.id` for client scoping |

## Inventory — Business routes (`/api/business/**`)

| Route | Method | Class | Notes |
|---|---|---|---|
| `/api/business/services/[id]` | GET, PATCH, DELETE | ✅ SECURED | Uses `getOwnedService(params.id, session.user.providerId)` — ownership verified |
| `/api/business/branding` | PUT | ⚠️ REVIEW | Accepts branding data; should verify business belongs to session provider |

## Inventory — Public routes (`/api/public/**`)

| Route | Method | Class | Notes |
|---|---|---|---|
| `/api/public/bookings` | POST | ℹ️ PUBLIC | Accepts `data.providerId` from request — intentional (customer books a lesson with a specific provider) |
| `/api/public/bookings/bulk` | POST | ℹ️ PUBLIC | Same as above — package purchase flow |
| `/api/public/check-service-area` | GET | ℹ️ PUBLIC | Accepts `providerId` from query — public service area check |
| `/api/public/instructors` | GET | ℹ️ PUBLIC | Lists public instructor info |
| `/api/public/bookings/[id]` | GET | ℹ️ PUBLIC | Public booking info (payment token required) |

## Inventory — Other routes with providerId from request

| Route | Method | Class | Notes |
|---|---|---|---|
| `/api/availability/check-and-reserve` | POST | ℹ️ PUBLIC | Accepts `data.providerId` — public slot reservation |
| `/api/availability/validate-slots` | GET | ℹ️ PUBLIC | Accepts `providerId` from query — public availability check |
| `/api/branding` | GET | ℹ️ PUBLIC | Accepts `providerId` from query — public branding display |
| `/api/packages` | GET | ℹ️ PUBLIC | Accepts `providerId` from query — public package display |
| `/api/reviews` | GET | ℹ️ PUBLIC | Accepts `providerId` from query — public reviews |
| `/api/waiting-list` | POST, GET | ℹ️ PUBLIC | Accepts `providerId` from request — public waiting list |
| `/api/voice/availability` | POST | ℹ️ PUBLIC | Accepts `data.providerId` — voice AI availability check |

## Summary

| Category | Count | Status |
|---|---|---|
| ✅ SECURED (session-scoped) | 24 | No action needed |
| ⚠️ REVIEW (request-supplied IDs) | 13 | Needs verification of ownership checks |
| ℹ️ PUBLIC (no auth, by design) | 10 | Not a tenant isolation concern |
| 🔒 ADMIN | — | Not inventoried (admin routes are RBAC-gated separately) |

## Priority targets for Provider A / Provider B negative-access tests

The ⚠️ REVIEW routes are the highest priority. The following are the most critical to verify:

1. `/api/instructor/clients/[id]` — Can Provider A read Provider B's client?
2. `/api/instructor/invoices/[transactionId]` — Can Provider A read Provider B's invoice?
3. `/api/bookings` POST — Can Provider A create a booking under Provider B's providerId?
4. `/api/bookings/[id]` GET — Can Provider A read Provider B's booking?
5. `/api/bookings/batch` POST — Can Provider A batch-create bookings under Provider B?
6. `/api/client/schedule-package-hours` — Can a client schedule hours with a different provider than the one who owns the package?
7. `/api/bookings/combined` — Does the combined route verify the providerId from the request matches the eligible provider?
8. `/api/bookings/mobile` — JWT claim vs request providerId consistency

## Next steps

1. Read each ⚠️ REVIEW route source and classify its actual scoping behavior
2. Build Provider A / Provider B negative-access tests for the highest-priority routes
3. Document findings and implement fixes for any confirmed isolation gaps
