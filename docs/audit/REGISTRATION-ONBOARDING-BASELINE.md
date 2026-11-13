# Registration Onboarding Baseline

**Version:** 1.3 (2026-11-14)
**Authority:** This document is the single authoritative reference for the registration onboarding design, implementation status, verification evidence, outstanding gaps, and implementation roadmap. All subsequent registration work must update this document in the same delivery cycle as the code change.
**Linked tracker:** `AUDIT-MASTER-TRACKER.md` Section 11
**Current version:** v1.3 (2026-11-14) — see change history at end of document

---

## Status Classifications

### Implementation status (for items that exist in the codebase)
| Status | Meaning |
|---|---|
| EXISTS | Implemented in the current codebase; source inspection confirms presence |
| VERIFIED | Implementation and specified behaviour supported by reported evidence (unit, HTTP, DB or browser tests) |
| PARTIAL | Some functionality exists, but requirements remain incomplete |

### Gap status (for items that are missing, incomplete or deferred)
| Status | Meaning |
|---|---|
| OPEN | Identified requirement with no implementation; no work started |
| IN PROGRESS | Work has begun but is not complete |
| BLOCKED | Cannot proceed because of an unresolved dependency |
| DEFERRED | Intentionally postponed to a later cycle |
| RESOLVED | Previously a gap; now fully implemented and verified |

### Product capability status
| Status | Meaning |
|---|---|
| Available | Implemented, enabled and available to the relevant account tier |
| Planned | Intended capability, not yet available; no implementation |
| Coming Soon | Recognised future capability with an identified implementation plan; UI label may show this |
| Unavailable | Not currently supported or enabled at runtime (e.g., 503-blocked) |

### Evidence qualifier
All evidence references in this document are **reported** unless explicitly marked otherwise. "Reported" means the test was executed and the result was observed by the implementer, but not independently reproduced by a reviewer. This distinction is preserved throughout.

---

## Part 1: Intended Onboarding Process

### Governing rules

**Rule A — The server determines the commercial configuration.**
The browser must not be trusted to decide `businessModel`, `paymentMode`, agreement type or agreement version. These are derived and validated by the server via `deriveRegistrationFields()` in `lib/registration/derive-registration-fields.ts`.

**Rule B — Registration must not promise unavailable capabilities.**
The SaaS model can describe the provider's independent business relationship with DriveBook, but the actual capabilities must reflect what is implemented. A selected business model does not automatically enable direct payments, white labelling or multiple instructors.

**Rule C — Agreement status must reflect reality.**
An unpublished SaaS agreement means PENDING, with no accepted version or timestamp. Privacy acceptance remains independent.

### Onboarding gates (in order)

| Gate | Purpose | Rule |
|---|---|---|
| 1. Business category | Identify what type of provider is registering: driving, plumbing, electrical, beauty, tax or another supported category | Selection drives template loading and available organisation types |
| 2. Organisation type | Establish legal structure: INDIVIDUAL_INSTRUCTOR (driving), SOLE_TRADER or REGISTERED_BUSINESS (non-driving) | DRIVING_SCHOOL is unavailable (Coming Soon); BUSINESS is reserved and rejected |
| 3. Commercial model | Driving instructors select Marketplace or SaaS; non-driving always SaaS | One active model at registration; not changeable post-registration |
| 4. Capability and commercial disclosures | Explain what the selected model provides and what remains unavailable | Must not imply SaaS direct payments are available; must distinguish implemented vs planned capabilities |
| 5. Terms and privacy acceptance | Apply correct agreement for selected model; record privacy separately | Marketplace: Instructor Terms v2.0 (ACCEPTED at registration); SaaS: PENDING if unpublished, ACCEPTED if published and accepted; Privacy: always required, always recorded |
| 6. Account creation and verification | Server validates selections, derives commercial and agreement fields, creates Provider account | Email verification and login follow; all commercial fields set by server |
| 7. Post-registration business discovery | Optional page at `/dashboard/discovery` where the provider indicates business interests | Completed after registration; does not change permissions, payment mode, subscription, business model or account entitlements |

### SaaS registration eligibility decision

**Decision:** Allow SaaS registration with restrictions during controlled testing.

- A provider may register as SaaS while SaaS Terms are unpublished.
- The agreement status is PENDING with no accepted version or timestamp.
- DIRECT payments remain blocked (503 guard on all payment routes).
- The SaaS notice on the registration page states terms are being finalised.
- The registration page warns that direct payments are not yet available.

For public commercial launch: defer SaaS registration until applicable commercial terms and minimum SaaS capabilities are ready (see Public SaaS Launch Readiness below).

| Policy | Status | Applies to |
|---|---|---|
| Allow SaaS registration with restrictions | Active | Controlled testing (current) |
| Defer SaaS registration until terms published | PLANNED | Public commercial launch |

### Public SaaS Launch Readiness

The following minimum requirements must be satisfied before SaaS registration is offered to the public:

| Requirement | Status | Notes |
|---|---|---|
| Finalised and published SaaS Terms | OPEN | Current content is preview-only at `/saas-terms`; version/date TBD; legal review required |
| Existing-provider acceptance process | OPEN | No API endpoint or dashboard notice for existing PENDING providers to accept newly published terms |
| Clearly defined available SaaS capabilities | PARTIAL | Registration page describes SaaS model; warnings about direct payments exist; full capability matrix not yet documented for providers |
| Accurate disclosures about unavailable DIRECT payments | VERIFIED | Registration page states "Direct payments are not yet available"; 503 guards active on all payment routes |
| Agreed public registration eligibility policy | OPEN | Policy decision required: allow restricted SaaS registration or defer until terms published |

Do not mark public SaaS launch readiness as achieved until all five criteria are satisfied.

### Non-negotiable invariants

1. A provider has one Provider account and one active business model at a time.
2. The server derives all commercial fields; the browser supplies selections only.
3. `organisationType` is always explicitly set by the registration API via `deriveRegistrationFields()`. The production database default (`NOT NULL DEFAULT 'SOLE_TRADER'`) does not affect the registration API path because the field is always supplied. Seed and test scripts that omit the field receive the DB default — this is documented as schema drift (GAP-07) but does not affect production registration.
4. `commercialAgreementStatus` reflects whether terms have been published AND accepted. PENDING means terms are not yet published or not yet accepted.
5. `privacyPolicyVersion` and `privacyPolicyAcceptedAt` are always set at registration, independent of commercial agreement status.
6. `User.termsAcceptedAt` and `User.termsVersion` are written ONLY for Marketplace providers (legacy Instructor Terms fields). SaaS providers always have these as null.
7. SaaS providers' agreement is recorded in `Provider.commercialAgreement*` fields only, never in `User.terms*` fields.
8. DIRECT payment mode is blocked at runtime by 503 guards on all three payment routes until separately implemented and verified.

---

## Part 2: Existing Implementation

### Gate 1: Business category

| Item | Status | Files | Evidence |
|---|---|---|---|
| Business type selection page | EXISTS | `app/register/business-type/page.tsx` | Source inspection |
| Zod schema accepts driving/plumber/electrician/beauty/tax | VERIFIED | `app/api/register/route.ts` (registerSchema, line 28) | HTTP RT-5 (plumber 201), RT-6 (plumber+REGISTERED_BUSINESS 201); source inspection |
| Template loader for each business type | EXISTS | `lib/presets/loader.ts`, `lib/presets/driving.ts`, `lib/presets/beauty.ts`, `lib/presets/tax.ts` | Source inspection |
| URL parameter carries business type to registration page | VERIFIED | `app/register/page.tsx` (useSearchParams, line 91) | Browser BW-3 (plumber page renders structure selector) |
| Redirect to business-type selection if no param | EXISTS | `app/register/page.tsx` (useEffect, line 96) | Source inspection |

### Gate 2: Organisation type

| Item | Status | Files | Evidence |
|---|---|---|---|
| INDIVIDUAL_INSTRUCTOR for driving (always) | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 159) | Unit tests FIX-4-1/2; HTTP RT-1 (201); DB RT-1DB; Browser BW-6 |
| SOLE_TRADER for non-driving (default) | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 166) | Unit tests FIX-4-3; HTTP RT-5 (201); DB RT-5DB |
| REGISTERED_BUSINESS for non-driving (optional) | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 166) | Unit tests FIX-4-4; HTTP RT-6 (201) |
| DRIVING_SCHOOL rejection | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 141) | Unit tests FIX-4-6/7/8; HTTP RT-7 (400); Browser BW-4, BW-10 |
| BUSINESS type rejection | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 149) | Unit tests; HTTP RT-8 (400) |
| INDIVIDUAL_INSTRUCTOR for non-driving rejection | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 152) | Unit tests; HTTP RT-9 (400) |
| UI: Driving School shown as "Coming soon" / aria-disabled | VERIFIED | `app/register/page.tsx` | Browser BW-4 (scoped to Driving school container), BW-10 (click prevention) |
| UI: Independent instructor pre-selected for driving | VERIFIED | `app/register/page.tsx` | Browser BW-6 (violet border asserted on selected card) |
| UI: Non-driving business structure selector (Sole trader / Registered company) | VERIFIED | `app/register/page.tsx` | Browser BW-3 |
| Schema: `organisationType String?` (nullable, no default) | VERIFIED | `prisma/schema.prisma` (line 184) | Unit tests FIX-4-10 |
| Migration SQL: nullable TEXT, no DEFAULT clause | VERIFIED | `prisma/migrations/20261110000001_add_organisation_type_and_agreement_fields/migration.sql` | Unit tests FIX-4-11, MIG-1 |
| Production DB: `organisationType` column present | EXISTS | Production schema (via `scripts/check-db-state.cjs`) | Read-only query confirmed 7/7 columns present |
| Production DB: schema drift (`NOT NULL DEFAULT 'SOLE_TRADER'` vs intended nullable) | OPEN (GAP-07) | Production schema | Documented in tracker Section 11.5; does not affect registration API (always supplies value explicitly) |

### Gate 3: Commercial model

| Item | Status | Files | Evidence |
|---|---|---|---|
| Driving instructors choose MARKETPLACE or SAAS | VERIFIED | `app/register/page.tsx` | Browser BW-1 (Marketplace selected), BW-2 (SaaS selected) |
| Non-driving always SAAS (API enforces) | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 106) | Unit tests FIX-2-1; HTTP RT-5; Browser BW-3 (selector absent) |
| Omitted businessModel defaults to MARKETPLACE (backward compat) | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 104) | Unit tests BC-1 |
| `paymentMode` derived from `businessModel`, never from browser | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 108) | Unit tests BC-1–3; DB RT-1DB (PLATFORM), RT-4DB (DIRECT), RT-5DB (DIRECT) |
| `businessModel` persisted to Provider record | VERIFIED | `app/api/register/route.ts` (line 188) | DB RT-1DB (MARKETPLACE), RT-4DB (SAAS), RT-5DB (SAAS) |
| `paymentMode` persisted to Provider record | VERIFIED | `app/api/register/route.ts` (line 189) | DB RT-1DB (PLATFORM), RT-4DB (DIRECT), RT-5DB (DIRECT) |
| `industry` field persisted to Provider record | VERIFIED | `app/api/register/route.ts` (line 185) | DB RT-5DB (industry=plumber) |
| UI: Marketplace/SaaS model selector visible for driving only | VERIFIED | `app/register/page.tsx` | Browser BW-3 (selector absent for plumber) |
| UI: SaaS option shows "Direct payments are not yet available" notice | EXISTS | `app/register/page.tsx` | Source inspection |

### Gate 4: Capability and commercial disclosures

| Item | Status | Files | Evidence |
|---|---|---|---|
| SaaS notice: "SaaS Terms are being finalised" (when unpublished) | VERIFIED | `app/register/page.tsx` | Browser BW-2, BW-3 |
| SaaS notice: "Your account and all non-commercial features are available immediately" | EXISTS | `app/register/page.tsx` | Source inspection |
| SaaS option description: "You bring your own students" | EXISTS | `app/register/page.tsx` | Source inspection |
| Marketplace option description: "Students discover and book through DriveBook" | EXISTS | `app/register/page.tsx` | Source inspection |
| SaaS option warning: "Direct payments are not yet available" | EXISTS | `app/register/page.tsx` | Source inspection |
| Does NOT promise unavailable capabilities | VERIFIED | `app/register/page.tsx` | Browser BW-2 confirms notice text, not capability promise |
| Published SaaS checkbox visible when `SAAS_TERMS_PUBLISHED=true` | VERIFIED | `app/register/page.tsx` | Browser BW-11 (published mode, checkbox + link visible) |
| Published SaaS checkbox links to `/saas-terms` | VERIFIED | `app/register/page.tsx` (uses `SAAS_TERMS_URL` constant) | Browser BW-11 |

### Gate 5: Terms and privacy acceptance

| Item | Status | Files | Evidence |
|---|---|---|---|
| Marketplace requires `termsAccepted=true` (Instructor Terms v2.0) | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 113) | HTTP RT-2 (400 without); DB RT-1DB (ACCEPTED, version 2.0) |
| Marketplace `commercialAgreementType=MARKETPLACE_TERMS` | VERIFIED | `app/api/register/route.ts` (line 191) | DB RT-1DB |
| Marketplace `commercialAgreementStatus=ACCEPTED` at registration | VERIFIED | `app/api/register/route.ts` (line 192) | DB RT-1DB |
| Marketplace `commercialAgreementVersion=2.0` | VERIFIED | `app/api/register/route.ts` (line 193) | DB RT-1DB |
| Marketplace `commercialAgreementAcceptedAt` set (timestamp) | VERIFIED | `app/api/register/route.ts` (line 194) | DB RT-1DB |
| Marketplace `User.termsAcceptedAt` set | VERIFIED | `app/api/register/route.ts` (line 167) | DB RT-1DB |
| Marketplace `User.termsVersion=2.0` | VERIFIED | `app/api/register/route.ts` (line 168) | DB RT-1DB |
| SaaS (unpublished): `commercialAgreementType=SAAS_TERMS` | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB |
| SaaS (unpublished): `commercialAgreementStatus=PENDING` | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB |
| SaaS (unpublished): `commercialAgreementVersion=null` | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB |
| SaaS (unpublished): `commercialAgreementAcceptedAt=null` | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB |
| SaaS: `User.termsAcceptedAt=null` (SaaS isolation) | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB, SP-3DB |
| SaaS: `User.termsVersion=null` (SaaS isolation) | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB, SP-3DB |
| SaaS (published): acceptance required when `SAAS_TERMS_PUBLISHED=true` | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 122) | HTTP SP-1 (400 without), SP-2 (400 with false), SP-3 (201 with true) |
| SaaS (published): `commercialAgreementStatus=ACCEPTED` | VERIFIED | `app/api/register/route.ts` | DB SP-3DB |
| SaaS (published): `commercialAgreementVersion=<published version>` | VERIFIED | `app/api/register/route.ts` | DB SP-3DB (version=1.0 — test override value, not an approved production legal version) |
| SaaS (published): `commercialAgreementAcceptedAt` set (timestamp) | VERIFIED | `app/api/register/route.ts` | DB SP-3DB |
| SaaS (published): `User.termsAcceptedAt=null` (isolation maintained) | VERIFIED | `app/api/register/route.ts` | DB SP-3DB |
| Privacy required (`privacyAccepted=true` via Zod `z.literal(true)`) | VERIFIED | `app/api/register/route.ts` (line 39) | HTTP RT-10 (400 without) |
| `privacyPolicyVersion=2.0` always set | VERIFIED | `app/api/register/route.ts` (line 196) | DB RT-1DB, RT-4DB, RT-5DB, SP-3DB |
| `privacyPolicyAcceptedAt` always set, independent of commercial terms | VERIFIED | `app/api/register/route.ts` (line 197) | DB RT-4DB (PENDING commercial + set privacy), RT-5DB, SP-3DB |
| Fail-closed version guard (published + null/empty version → error) | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 130) | Unit tests VG-1, VG-2 |
| `ageDeclaration` NOT in provider registration (CLIENT/LEARNER only) | VERIFIED | `app/api/register/route.ts` (lines 56–59, 166–169) | Unit tests AGE-1–6; confirmed absent from Zod schema and User write |
| UI: Instructor Terms checkbox visible for Marketplace | VERIFIED | `app/register/page.tsx` | Browser BW-1 |
| UI: Instructor Terms checkbox NOT visible for SaaS unpublished | VERIFIED | `app/register/page.tsx` | Browser BW-2 |
| UI: Privacy checkbox always required | VERIFIED | `app/register/page.tsx` | Browser BW-5 |
| UI: Submit disabled until both terms + privacy for Marketplace | VERIFIED | `app/register/page.tsx` | Browser BW-1 |
| UI: Submit enabled with privacy only for SaaS unpublished | VERIFIED | `app/register/page.tsx` | Browser BW-2 |
| UI: SaaS Terms checkbox + link when published | VERIFIED | `app/register/page.tsx` | Browser BW-11 |

### Gate 6: Account creation and verification

| Item | Status | Files | Evidence |
|---|---|---|---|
| Server derives all fields via `deriveRegistrationFields()` | VERIFIED | `lib/registration/derive-registration-fields.ts` | 165 unit tests (Vitest, reported) |
| `RegistrationValidationError` thrown before any DB writes | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests (all rejection paths throw before return) |
| User + Provider created in `prisma.$transaction` | EXISTS | `app/api/register/route.ts` (line 157) | Source inspection |
| Business template created via `createBusinessFromTemplate` outside transaction | EXISTS | `app/api/register/route.ts` (line 222) | Source inspection; non-fatal (catch logged) |
| Trial subscription created via `createOrReuseTrialSubscription` | EXISTS | `app/api/register/route.ts` (line 211) | Source inspection; dev server logs confirm creation |
| Verification token generated and emailed | EXISTS | `app/api/register/route.ts` (lines 97–100, 239–285) | Source inspection |
| HTTP 201 returned with providerId, commercialAgreementStatus, organisationType | VERIFIED | `app/api/register/route.ts` (line 252) | HTTP RT-1, RT-4, RT-5, RT-6, SP-3, SP-5 |
| HTTP 400 returned for validation errors with correct error codes | VERIFIED | `app/api/register/route.ts` (line 89) | HTTP RT-2, RT-3, RT-7, RT-8, RT-9, RT-10, SP-1, SP-2, SP-4 |
| Rate limiting on registration endpoint (5 per 15 min by IP) | EXISTS | `app/api/register/route.ts` (line 80) | Source inspection |
| Browser: form submission redirects to `/login?registered=1` | VERIFIED | `app/register/page.tsx` (line 152) | Browser BW-7, BW-8, BW-9, BW-11 |
| Browser: request payload intercept confirms correct fields per path | VERIFIED | `app/register/page.tsx` | Browser BW-7 (MARKETPLACE+termsAccepted), BW-8 (SAAS, no termsAccepted), BW-9 (plumber, SOLE_TRADER), BW-11 (published SaaS, saasTermsAccepted) |

### Gate 7: Post-registration business discovery

| Item | Status | Files | Evidence |
|---|---|---|---|
| Discovery page exists at `/dashboard/discovery` | EXISTS | `app/dashboard/discovery/page.tsx` | Source inspection |
| Discovery does not affect Provider fields at registration | VERIFIED | `app/api/register/route.ts` | HTTP tests (no discovery reference in registration API); Unit tests IVF-D1–3 |
| Discovery is conditional on `isSaas` for booking description wording | EXISTS | `app/dashboard/discovery/page.tsx` | Source inspection; unit test DISC-11 |
| Discovery is optional — can be skipped or completed after registration | EXISTS | `app/dashboard/discovery/page.tsx` | Source inspection; no precondition gate blocks registration |
| Discovery stores data in `ProviderDiscovery` model linked to `providerId` | EXISTS | `prisma/schema.prisma` (ProviderDiscovery model) | Source inspection |
| Discovery does not change `businessModel`, `paymentMode`, subscription or permissions | EXISTS | `app/dashboard/discovery/page.tsx` | Source inspection; no write to Provider fields |
| Ability to edit submitted discovery answers after initial completion | NOT VERIFIED | `app/dashboard/discovery/page.tsx` | Source inspection suggests upsert pattern but edit-after-submit flow not independently tested |

### Cross-cutting: SaaS Terms page

| Item | Status | Files | Evidence |
|---|---|---|---|
| `/saas-terms` page exists with 8 sections | EXISTS | `app/saas-terms/page.tsx` | Source inspection; unit tests SAAS-UI-6, SAAS-UI-7 |
| Status banner: "Not yet in effect" | EXISTS | `app/saas-terms/page.tsx` | Source inspection |
| `SAAS_TERMS_URL = '/saas-terms'` in constants | VERIFIED | `lib/config/registration-constants.ts` (line 42) | Unit test SAAS-UI-8 |
| Env-var override for test isolation (`SAAS_TERMS_PUBLISHED_OVERRIDE`, `SAAS_TERMS_VERSION_OVERRIDE`) | EXISTS | `lib/config/registration-constants.ts` (lines 39–40) | HTTP SP-3DB, SP-5; Browser BW-11 (test override, not production configuration) |
| SaaS Terms version 1.0 used in tests is a test override value | — | — | Version 1.0 is NOT an approved production legal version; it is a test-only override via `SAAS_TERMS_VERSION_OVERRIDE` |

### Cross-cutting: Payment-service gate

| Item | Status | Files | Evidence |
|---|---|---|---|
| DIRECT payment mode → 503 on bulk-booking route | VERIFIED | `app/api/public/bookings/bulk/route.ts` (line 262) | Unit tests PG-1; WLA-001 tests |
| DIRECT payment mode → 503 on create-intent route | VERIFIED | `app/api/payments/create-intent/route.ts` (line 215) | Unit tests PG-2; WLA-001 tests |
| DIRECT payment mode → 503 on quote accept route | VERIFIED | `app/api/client/quotes/[id]/accept/route.ts` (line 77) | Unit tests PG-3; WLA-001 tests |
| `assertPlatformPaymentMode()` server-side guard | EXISTS | `lib/utils/account.ts` (line 143) | Unit test PG-4 |
| All SaaS providers derive `paymentMode=DIRECT` at registration | VERIFIED | `lib/registration/derive-registration-fields.ts` (line 108) | Unit tests PG-5; DB RT-4DB (DIRECT), RT-5DB (DIRECT) |

### Cross-cutting: Test infrastructure

| Item | Status | Files | Evidence |
|---|---|---|---|
| Vitest suite (165 tests) | VERIFIED | `__tests__/integration/reg-phase2-architecture.test.ts`, `__tests__/integration/reg-business-model-selection.test.ts` | 165/165 exit 0 (reported) |
| HTTP runtime script (10 HTTP + 30 DB assertions) | VERIFIED | `scripts/runtime-verify-registration.cjs` | Exit 0 against live dev server + Supabase (reported) |
| Published SaaS HTTP script (7 tests + 11 DB assertions) | VERIFIED | `scripts/runtime-verify-saas-published.cjs` | Exit 0 against live dev server + Supabase (reported) |
| Playwright browser tests (11 tests) | VERIFIED | `__tests__/browser/registration.spec.ts` | 11/11 exit 0 (reported) |
| Classification script (read-only) | EXISTS | `scripts/migration-phase2-classification.cjs` | Source inspection; not executed against production |
| DB state check script | EXISTS | `scripts/check-db-state.cjs` | Executed against production (read-only, reported) |
| Provider inspection script | EXISTS | `scripts/check-providers.cjs` | Executed against production (read-only, reported) |
| Test account cleanup script | EXISTS | `scripts/cleanup-test-accounts.cjs` | Executed against production (10 records deleted, reported) |
| Dev helper migration script | EXISTS | `scripts/apply-phase2-migration.cjs` | DRIFT-1–5 unit tests guard against schema drift |

---

## Part 3: Verification Evidence Summary

### Verification levels achieved

| Level | Method | Coverage | Independence |
|---|---|---|---|
| Source-level (Vitest) | 165 unit/integration tests | All derivation logic, schema, migration, constants, UI source assertions | Reported (not independently reproduced by reviewer) |
| HTTP runtime | 10 HTTP requests + 30 DB assertions against live dev server + Supabase | Registration API HTTP responses + Provider/User DB field persistence | Reported (not independently reproduced by reviewer) |
| Published SaaS HTTP | 7 HTTP requests + 11 DB assertions | SaaS Terms published lifecycle (missing/false/true acceptance, DB persistence, SaaS isolation) | Reported (not independently reproduced by reviewer) |
| Browser (Playwright) | 11 tests against live Chromium browser | UI rendering, checkbox gating, form submission, request payload interception, redirect verification | Reported (not independently reproduced by reviewer) |
| Production schema | `scripts/check-db-state.cjs` read-only query | 7 Phase 2 columns present; 13 test Provider records (all disposable); 0 bookings/transactions/wallet | Reported |

### What is NOT independently verified

- Vitest suite not independently re-executed by reviewer
- HTTP/DB runtime tests not independently re-executed by reviewer
- Playwright browser tests not independently re-executed by reviewer
- Production Vercel deployment registration flow not independently tested against the deployed URL
- No browser automation against the deployed production URL
- Discovery edit-after-submit flow not tested

### Evidence qualifier

All results in this document are **reported** — meaning the test was executed and the result was observed by the implementer. No result has been independently reproduced by a reviewer unless explicitly stated otherwise in the evidence column. A status of VERIFIED means the implementation and specified behaviour are supported by reported evidence; it does not mean a reviewer has independently confirmed the result.

---

## Part 4: Outstanding Gaps

### Gap status definitions

| Status | Meaning |
|---|---|
| OPEN | Identified requirement with no implementation; no work started |
| IN PROGRESS | Work has begun but is not complete |
| BLOCKED | Cannot proceed because of an unresolved dependency |
| DEFERRED | Intentionally postponed to a later cycle |
| RESOLVED | Previously a gap; now fully implemented and verified |

### Registration onboarding gaps

| ID | Gap | Status | Impact | Dependency | Notes |
|---|---|---|---|---|---|
| GAP-01 | Post-registration business-model transition (Marketplace ↔ SaaS) | OPEN | Provider cannot change model after registration | SaaS Terms publication (GAP-03); existing-provider acceptance (GAP-02); DIRECT payment implementation (GAP-04); migration-history reconciliation (GAP-08) | Separate future feature; not part of initial onboarding |
| GAP-02 | Existing SaaS provider terms acceptance flow | OPEN | Providers with PENDING agreement status cannot accept newly published SaaS Terms | SaaS Terms must be published first (GAP-03) | Requires dashboard notice, API endpoint, version+timestamp recording, audit log |
| GAP-03 | SaaS Terms finalised legal content | OPEN | `/saas-terms` page has preview content only; version/date TBD | Legal review required | Current content is placeholder; 8 sections exist but are not legally finalised |
| GAP-04 | DIRECT payment mode implementation | OPEN | SaaS providers cannot process direct payments; 503 guards active on all 3 payment routes | Stripe Connect onboarding; webhook handling for DIRECT mode; payment flow; 503 guard removal | Blocking dependency for full SaaS commercial launch |
| GAP-05 | Driving School registration | OPEN | DRIVING_SCHOOL organisation type is rejected at registration | Multi-instructor architecture | UI shows "Coming Soon"; derivation throws DRIVING_SCHOOL_NOT_AVAILABLE |
| GAP-06 | BUSINESS/multi-provider account type | OPEN | BUSINESS organisation type is rejected at registration | Multi-provider architecture | Derivation throws ORGANISATION_TYPE_NOT_AVAILABLE |
| GAP-07 | `organisationType` schema drift (production DB: NOT NULL DEFAULT 'SOLE_TRADER' vs intended: nullable, no default) | OPEN | DB default assigns SOLE_TRADER to paths that omit the field (seed.ts, register-test-users.ts) | Migration-history reconciliation (GAP-08) | Does NOT affect registration API (always supplies value explicitly). Production Provider creation path audit confirmed only `app/api/register/route.ts` creates Provider records in production, and it always sets `organisationType`. |
| GAP-08 | Migration-history reconciliation (40 unrecorded + 1 failed migration) | OPEN | Cannot safely use `prisma migrate deploy` without resolving ledger | Separate infrastructure task (see tracker Section 10) | 40 migrations applied via `db push` are not in `_prisma_migrations`; 1 migration (`20260116000000`) is recorded as NOT FINISHED |
| GAP-09 | Browser tests require manual server startup (NODE_OPTIONS OOM on Windows) | OPEN | Cannot auto-start dev server from Playwright `webServer` config; webpack worker OOM on default heap | Windows/Next.js webpack worker memory constraint | `playwright.config.ts` documents manual startup requirement; `webServer` config is commented out |
| GAP-10 | SaaS registration eligibility for public launch | DEFERRED | Current policy allows restricted SaaS registration (PENDING agreement, no DIRECT payments) | SaaS Terms publication (GAP-03); existing-provider acceptance (GAP-02); public launch policy decision | Public launch should defer SaaS registration until terms are published and minimum SaaS capabilities are ready |

### Product capability status

Capabilities are distinguished by implementation status (implemented vs planned), runtime status (enabled vs blocked) and entitlement (subscription tier requirement).

| Capability | Marketplace | SaaS (current — unpublished terms) | SaaS (future — published terms + DIRECT) |
|---|---|---|---|
| Registration | Available | Available (restricted: PENDING agreement) | Available (with published terms) |
| Platform payments (DriveBook processes via Stripe) | Available | Unavailable (503 — not applicable to SaaS model) | Unavailable (by design) |
| Direct payments (provider's own Stripe) | Unavailable (not applicable) | Unavailable (503-blocked) | Planned (GAP-04) |
| Marketplace discovery | Available | Unavailable (by design) | Unavailable (by design) |
| Commission (15% to DriveBook) | Available | Not applicable | Not applicable |
| Subscription billing | Available | Available | Available |
| White-label branding | Available (STUDIO+ tier) | Available (PREMIUM tier) | Available (PREMIUM tier) |
| Custom domain | Available (STUDIO+ tier) | Available (PREMIUM tier) | Available (PREMIUM tier) |
| AI receptionist | Available (PRO+ tier) | Available (PRO+ tier) | Available (PRO+ tier) |
| Post-registration model switch | Unavailable | Unavailable | Planned (GAP-01) |
| Multi-provider (BUSINESS type) | Unavailable | Unavailable | Planned (GAP-06) |
| Driving School registration | Unavailable | Unavailable | Planned (GAP-05) |

---

## Part 5: Implementation Roadmap

### Completed (current cycle)

| Item | Status | Commits | Verification |
|---|---|---|---|
| ageDeclaration removal from provider registration | VERIFIED | `99174967` | AGE-1–6 unit tests (reported) |
| organisationType nullable + no default in schema and migration | VERIFIED | `99174967` | MIG-1, FIX-4-10/11 unit tests (reported) |
| Classification script v2 with REVIEW group | VERIFIED | `99174967` | MIG-3–5 unit tests (reported) |
| `scripts/apply-phase2-migration.cjs` corrected + DRIFT guards | VERIFIED | `e17eece5` | DRIFT-1–5 unit tests (reported) |
| SaaS `User.terms*` isolation (Marketplace-only writes) | VERIFIED | `f5f40a7e` | OWN-1–4 unit tests (reported) |
| SaaS lifecycle tests (`_testSaasPublished` injection) | VERIFIED | `52fe73da` | SaaS-PUB-1–7 unit tests (reported) |
| SaaS Terms UI lifecycle + `/saas-terms` preview page | VERIFIED | `3f174df2` | SAAS-UI-1–10 unit tests (reported) |
| Fail-closed version guard (`SAAS_TERMS_VERSION_MISSING`) | VERIFIED | `c8000038` | VG-1–7 unit tests (reported) |
| Independent verification tests (31 IVF tests) | VERIFIED | `986824cd` | IVF-M/S/SP/O/P/DS/D unit tests (reported) |
| Vercel build fix (14 pre-existing TypeScript errors) | VERIFIED | `4ed626c3` | Local `next build` exit 0 (reported); Vercel status: success (reported) |
| Package-lock.json reconciliation (Capacitor 8.x) | VERIFIED | `2b3c9e05` | `npm ci` + `prisma generate` + `next build` + Vitest 165/165 all pass (reported) |
| Full Provider DB persistence (30 DB assertions across 3 registration types) | VERIFIED | `5e39f581` | HTTP RT-1DB/4DB/5DB (reported) |
| SaaS published HTTP lifecycle (7 tests + 11 DB assertions) | VERIFIED | `5e39f581` | HTTP SP-1–5 + SP-3DB (reported) |
| Test cleanup accounting fix (deleted count, FK skip, exit code) | VERIFIED | `4c6bea6e` | Source verified (reported) |
| Browser tests BW-1–6 (rendering + gating) | VERIFIED | `968c1609` | Playwright 6/6 (reported) |
| Browser tests BW-7–9 (submission + payload interception) | VERIFIED | `488bc054` | Playwright 9/9 (reported) |
| Browser tests BW-10–11 (Driving School prevention + published SaaS) | VERIFIED | `33bdc4b6` | Playwright 11/11 (reported) |
| Production DB state check | EXISTS | `4d39b7cc` | `check-db-state.cjs` executed (reported, read-only) |
| Provider creation path audit (all 3 paths inspected) | VERIFIED | `0055133a` | Source inspection of `app/api/register/route.ts`, `prisma/seed.ts`, `scripts/register-test-users.ts` (reported) |
| Tracker Section 11 + corrected migration assessment | EXISTS | `0055133a`, `d2bcd12c` | Documentation |
| Registration onboarding baseline document | EXISTS | `df857100` | This document (v1.0) |

### Future work (ordered by dependency)

Dependencies are critical: an item should not be started until its dependencies are resolved. Items that can proceed independently are marked as such.

| Priority | Item | Gap | Status | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|
| 1 | SaaS Terms legal content finalisation | GAP-03 | OPEN | Legal review (external) | Published version string; effective date; all 8 sections legally reviewed; content updated in `app/saas-terms/page.tsx`; `SAAS_TERMS_VERSION` set to published version in `lib/config/registration-constants.ts`; `SAAS_TERMS_PUBLISHED` set to `true` |
| 2 | Existing SaaS provider terms acceptance flow | GAP-02 | OPEN | Item 1 (SaaS Terms published) | Dashboard notice for PENDING providers; `POST /api/provider/accept-saas-terms` endpoint; records `commercialAgreementStatus=ACCEPTED`, `commercialAgreementVersion=<published>`, `commercialAgreementAcceptedAt=now()`; audit log entry; `User.terms*` remain null |
| 3 | SaaS registration eligibility for public launch | GAP-10 | DEFERRED | Items 1–2 (terms published + acceptance flow) | Policy decision recorded: defer SaaS registration until terms published OR allow with documented restrictions; registration page updated accordingly |
| 4 | DIRECT payment mode implementation | GAP-04 | OPEN | Stripe Connect onboarding flow; DIRECT-mode webhook handling; payment flow; 503 guard removal | SaaS providers can process direct payments via their own Stripe account; all 3 payment route 503 guards removed; Stripe Connect onboarding complete; end-to-end payment test passes |
| 5 | Migration-history reconciliation | GAP-08 | OPEN | Separate infrastructure task (no registration dependency) | All 40 unrecorded migrations resolved in `_prisma_migrations`; failed migration `20260116000000` fixed; `prisma migrate deploy` safe to run; `prisma migrate diff` confirms schema equivalence |
| 6 | Post-registration business-model transition (Marketplace ↔ SaaS) | GAP-01 | OPEN | Item 2 (SaaS Terms acceptance); Item 4 (DIRECT payments); Item 5 (migration reconciliation) | Provider request UI; eligibility checks (no unresolved marketplace financial obligations); agreement acceptance for target model; admin approval; financial reconciliation; effective date; immutable audit history; existing bookings remain governed by original arrangements |
| 7 | Driving School registration | GAP-05 | OPEN | Multi-instructor architecture (external design) | `DRIVING_SCHOOL` organisation type available; multiple instructors under one school identity; derivation no longer rejects |
| 8 | BUSINESS/multi-provider account type | GAP-06 | OPEN | Multi-provider architecture (external design) | `BUSINESS` organisation type available; multiple providers under one organisation; admin roles; team management |

**Dependency graph:**

```
Item 1 (SaaS Terms content)
  ↓
Item 2 (Existing-provider acceptance) ← depends on Item 1
  ↓
Item 3 (Public SaaS eligibility) ← depends on Items 1+2

Item 4 (DIRECT payments) ← independent of Items 1–3
  ↓
Item 6 (Model switching) ← depends on Items 2+4+5

Item 5 (Migration reconciliation) ← independent of all others
  ↓
Item 6 (Model switching) ← also depends on Item 5

Items 7–8 (Driving School, BUSINESS) ← independent of all above; depend on multi-instructor/multi-provider architecture
```

Items 4 and 5 can proceed independently and in parallel. Item 6 (model switching) is blocked by both Items 2 and 4 and Item 5. Items 7–8 depend on a separate architecture design.

### Action Priority — what to do now, what stays pending, what is post-launch

This section separates the gaps into three actionable categories and distinguishes three release stages: registration deployment, controlled onboarding, and public financial operations.

#### ACT NOW — immediate actions

These items must be resolved before any real registration or onboarding.

| # | Item | Gap | Why now | What to do |
|---|---|---|---|---|
| A1 | Rotate ALL exposed credentials | SEC-CRED-01 (tracker Section 9) | Credentials are in public Git history. CRITICAL security risk regardless of whether real data exists. | 1. Audit ALL secrets in Git history: database connection strings, Stripe webhook signing secret, Stripe API keys (sk_test_/sk_live_), NEXTAUTH_SECRET, any other production service credentials. 2. Rotate every affected active credential. 3. Update Vercel env vars for each. 4. Verify old credentials no longer authenticate. 5. Consider Git history cleanup (BFG/filter-repo) or accept historical exposure with new credentials active. Do NOT paste replacement credentials into Git, chat, or audit documents. |
| A2 | Clean up remaining 13 test Provider records from production DB | — (operational) | Production DB has 13 disposable test Provider records with default-assigned `organisationType=SOLE_TRADER`. They are not real users but should not remain in a production database. | Before deleting: inspect each Provider's linked User, Subscription, AuditLog, Business, BusinessBranding, ProviderDiscovery and other FK dependencies. Do NOT assume cascade delete handles all linked data safely. Delete in correct FK order (child tables first, then Provider, then User). Preserve a cleanup report with deleted record IDs and final row counts (all key tables should show 0). |
| A3 | Verify deployed Vercel registration flow end-to-end | — (verification gap) | All tests ran against local dev server. The Vercel-deployed registration flow has not been independently verified against production. | 1. Confirm Vercel deployment is live and healthy. 2. Submit a test registration via the deployed URL with a controlled test email. 3. Verify HTTP 201 response. 4. Verify Provider record in production DB: `businessModel=MARKETPLACE`, `paymentMode=PLATFORM`, correct `organisationType`, `commercialAgreementStatus=ACCEPTED`, `commercialAgreementVersion=2.0`, `privacyPolicyVersion=2.0`, `privacyPolicyAcceptedAt` set, `User.termsAcceptedAt` set. 5. Verify registration email is received. 6. Verify email verification link works. 7. Verify user can log in after verification. 8. Verify dashboard loads with correct permissions and available capabilities. 9. Clean up test records. 10. Do NOT trigger real payments during this test. |

#### STAYS PENDING — tracked, not blocking registration deployment

These items are tracked in the roadmap but do not block registration deployment or controlled onboarding. Some block later release stages.

| # | Item | Gap | Blocks | Status |
|---|---|---|---|---|
| P1 | SaaS Terms legal content finalisation | GAP-03 | Public SaaS launch | OPEN — legal review required |
| P2 | Existing SaaS provider terms acceptance flow | GAP-02 | SaaS Terms publication; model switching | OPEN — needs API endpoint + dashboard notice |
| P3 | SaaS registration eligibility for public launch | GAP-10 | Public SaaS launch | DEFERRED — policy decision needed after P1+P2 |
| P4 | DIRECT payment mode implementation | GAP-04 | SaaS commercial features; model switching | OPEN — Stripe Connect onboarding + webhook + payment flow + 503 guard removal |
| P5 | Schema drift correction (`organisationType` NOT NULL DEFAULT → nullable) | GAP-07 | Migration-history accuracy | OPEN — cosmetic; does NOT affect registration API (always supplies value) |
| P6 | Migration-history reconciliation (40 unrecorded + 1 failed) | GAP-08 | Future `prisma migrate deploy` usage | OPEN — separate infrastructure task (tracker Section 10) |
| P7 | Browser test server startup automation | GAP-09 | Dev convenience | OPEN — Windows/Next.js webpack worker OOM constraint |

#### Conditional gates — not blocking registration, but blocking specific financial/AI features

These items are tracked elsewhere in the audit tracker but are NOT registration onboarding gaps. They gate specific operational capabilities that Marketplace registration may lead to.

| # | Item | Tracker ref | Blocks | Status | Notes |
|---|---|---|---|---|---|
| C1 | SaaS settlement/payment model | WLA-002 (Section 9) | Public Marketplace financial transactions (settlement behaviour must be confirmed) | OPEN — under research, awaiting Stripe confirmation | Not a registration gap; blocks real payment processing |
| C2 | Wallet ownership and transaction attribution | WLA-005 (Section 9) | Public wallet functionality (credit expiry, payout buffer, transaction attribution) | OPEN — source fix-verified for payout security; runtime verification + FIFO + admin UI outstanding | Not a registration gap; blocks wallet-dependent operations |
| C3 | AI prompt injection protection | AI-M-01 (Section 1.5) | Public AI receptionist actions | DEFERRED — awaiting AI architecture redesign | Conditional gate: only blocks if AI receptionist is enabled publicly |
| C4 | AI tool authorisation completeness | AI-M-02 (Section 1.5) | Public AI receptionist tool calls | DEFERRED — awaiting AI architecture redesign | Conditional gate: only blocks if AI tools are enabled publicly |

#### POST-LAUNCH — future features, separate scope

These are not launch blockers. They are future product features with their own architecture dependencies.

| # | Item | Gap | Dependency | Scope |
|---|---|---|---|---|
| F1 | Post-registration business-model transition (Marketplace ↔ SaaS) | GAP-01 | P2 + P4 + C1 + P6 | Provider request UI; eligibility checks; agreement acceptance; admin approval; financial reconciliation; effective date; immutable audit history. Existing bookings remain governed by original arrangements. |
| F2 | Driving School registration | GAP-05 | Multi-instructor architecture (external design) | `DRIVING_SCHOOL` organisation type available; multiple instructors under one school identity. |
| F3 | BUSINESS/multi-provider account type | GAP-06 | Multi-provider architecture (external design) | `BUSINESS` organisation type available; multiple providers under one organisation; admin roles; team management. |

These should not be started until their dependencies are resolved and the product contract for each is defined.

#### Release stage gate summary

Registration, onboarding and financial operations are distinct stages. A successfully registered instructor is not necessarily a financially ready Marketplace instructor.

| Release stage | What is required | What is NOT required | What this enables |
|---|---|---|---|
| 1. Registration deployment | A1 (credentials rotated); compatible schema (Phase 2 columns exist — confirmed); successful Vercel deployment | A2, A3, P1–P7, C1–C4, F1–F3 | Registration page is live and accepts form submissions |
| 2. Controlled Marketplace onboarding | Stage 1 + A2 (test data cleaned) + A3 (full registration verified: 201 + DB persistence + email + login + dashboard) | P1–P7, C1–C4, F1–F3 | Real instructors can register, verify email, log in and set up their dashboard. No financial transactions processed. |
| 3. Public Marketplace transactions | Stage 2 + C1 (WLA-002 settlement confirmed) + C2 (WLA-005 wallet ownership runtime-verified) + applicable C3/C4 (AI security if enabled) | P1–P7, F1–F3 | Students can pay for lessons; instructors receive payouts; wallet credits and debits operate; AI receptionist can act if enabled |
| 4. Public SaaS registration | Stage 2 + P1 (SaaS Terms published) + P2 (acceptance flow) + P3 (eligibility policy) + P4 (DIRECT payments) | P5–P7, F1–F3 | SaaS registration available publicly with published terms and direct payment capability |
| 5. Model switching | Stage 4 + P5 (schema drift corrected) + P6 (migration history reconciled) | F2–F3 | Providers can transition between Marketplace and SaaS post-registration |

**Key distinction:** Stages 1–2 do not require WLA-002, WLA-005 or AI-M-01/02. Stage 3 does. A registered instructor who has not yet processed a payment does not trigger the financial-transaction gates.

### Documentation update rule

Every implementation task must update this document in the same delivery cycle as the code change:

1. Review the current documented requirements and implementation status.
2. Identify the precise gap being addressed.
3. Implement only the agreed scope.
4. Run the relevant tests and record actual results.
5. Update this document with changed files, commit references, evidence and remaining limitations.
6. Update `AUDIT-MASTER-TRACKER.md` Section 11 and link it to this document.
7. Close the item only when its acceptance criteria and required verification are satisfied.

If implementation is incomplete, the document must say so. A commit alone must never turn an item into VERIFIED. A documentation correction does not itself verify the underlying application implementation. Source-to-document verification remains a separate review activity.

---

## Change History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-13 | Kiro | Initial creation — full baseline of registration onboarding implementation, evidence, gaps and roadmap |
| 1.1 | 2026-11-14 | Kiro | v1.1 revision per documentation revision plan: (1) Separated implementation status (EXISTS/VERIFIED/PARTIAL) from gap status (OPEN/IN PROGRESS/BLOCKED/DEFERRED/RESOLVED); corrected GAP-07/08/09 from EXISTS to OPEN. (2) Corrected roadmap dependencies — Item 6 (model switching) now depends on Items 2+4+5; Items 4 and 5 can proceed independently; added dependency graph. (3) Added Public SaaS Launch Readiness section with 5 criteria. (4) Renamed Gate 7 to "Post-registration business discovery"; added discovery storage, editability and no-effect-on-entitlements items. (5) Clarified SaaS Terms version 1.0 as test override not production legal version; distinguished application-derived organisation types from DB defaults; replaced abbreviated migration paths with exact filenames. (6) Added evidence qualifier: all results are "reported" unless explicitly marked otherwise. (7) Updated roadmap with corrected dependencies and independent-vs-blocked markers. (8) Added v1.1 change history entry. No application code or production configuration changed. |
| 1.2 | 2026-11-14 | Kiro | Added "Action Priority" section separating gaps into three categories: ACT NOW (blocks safe Marketplace launch: credential rotation, test record cleanup, deployed flow verification), STAYS PENDING (tracked, not blocking Marketplace launch: SaaS Terms content, acceptance flow, eligibility policy, DIRECT payments, schema drift, migration history, browser test automation), POST-LAUNCH (future features: model switching, Driving School, BUSINESS type). Added launch gate summary table showing what is required vs not required for each launch type. No application code or production configuration changed. |
| 1.3 | 2026-11-14 | Kiro | Corrected launch-gate structure per reviewer: (1) Expanded A1 to require audit of ALL exposed secrets, not just DB password and Stripe webhook. (2) Expanded A2 to require FK dependency inspection before deletion and cleanup report preservation. (3) Expanded A3 from HTTP 201 check to full 10-point verification including email verification, login, and dashboard permissions. (4) Added "Conditional gates" section for WLA-002 (settlement), WLA-005 (wallet ownership), AI-M-01/02 (AI security) — these do not block registration but block public financial transactions and AI receptionist actions. (5) Replaced single "Marketplace launch" with five distinct release stages: registration deployment, controlled onboarding, public Marketplace transactions, public SaaS registration, model switching. Key distinction: a registered instructor is not necessarily a financially ready Marketplace instructor. No application code or production configuration changed. |
