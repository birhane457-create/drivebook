# Registration Onboarding Baseline

**Version:** 1.0 (2026-11-13)
**Authority:** This document is the single authoritative reference for the registration onboarding design, implementation status, verification evidence, outstanding gaps, and implementation roadmap. All subsequent registration work must update this document in the same delivery cycle as the code change.
**Linked tracker:** `AUDIT-MASTER-TRACKER.md` Section 11

---

## Status Classifications

### Implementation status
| Status | Meaning |
|---|---|
| EXISTS | Implemented in the current codebase |
| VERIFIED | Implementation and specified behaviour supported by evidence |
| PARTIAL | Some functionality exists, but requirements remain incomplete |
| NOT IMPLEMENTED | Identified requirement with no implementation |
| PLANNED | Agreed future implementation |
| DEFERRED | Intentionally postponed |
| BLOCKED | Cannot proceed because of an unresolved dependency |

### Product capability status
| Status | Meaning |
|---|---|
| Available | Implemented and available to the relevant account |
| Planned | Intended capability, not yet available |
| Coming Soon | Recognised future capability with an identified implementation plan |
| Unavailable | Not currently supported or enabled |

---

## Part 1: Intended Onboarding Process

### Governing rules

**Rule A — The server determines the commercial configuration.**
The browser must not be trusted to decide `businessModel`, `paymentMode`, agreement type or agreement version. These are derived and validated by the server via `deriveRegistrationFields()`.

**Rule B — Registration must not promise unavailable capabilities.**
The SaaS model can describe the provider's independent business relationship with DriveBook, but the actual capabilities must reflect what is implemented. A selected business model does not automatically enable direct payments, white labelling or multiple instructors.

**Rule C — Agreement status must reflect reality.**
An unpublished SaaS agreement means PENDING, with no accepted version or timestamp. Privacy acceptance remains independent.

### Onboarding gates (in order)

| Gate | Purpose | Rule |
|---|---|---|
| 1. Business category | Identify what type of provider is registering | driving, plumber, electrician, beauty, tax |
| 2. Organisation type | Establish legal structure | INDIVIDUAL_INSTRUCTOR (driving), SOLE_TRADER or REGISTERED_BUSINESS (non-driving); DRIVING_SCHOOL unavailable |
| 3. Commercial model | Driving instructors select Marketplace or SaaS; non-driving always SaaS | One active model at registration |
| 4. Capability and commercial disclosures | Explain what the selected model provides and what remains unavailable | Must not imply SaaS direct payments are available |
| 5. Terms and privacy acceptance | Apply correct agreement for selected model; record privacy separately | Marketplace: Instructor Terms v2.0; SaaS: PENDING if unpublished |
| 6. Account creation and verification | Server validates selections, derives fields, creates Provider | Email verification and login follow |
| 7. Optional business discovery | Ask what provider wants to achieve | Must not change permissions, payment mode, subscription or business model |

### SaaS registration eligibility decision

**Decision:** Allow SaaS registration with restrictions during controlled testing.

- A provider may register as SaaS while SaaS Terms are unpublished.
- The agreement status is PENDING with no accepted version or timestamp.
- DIRECT payments remain blocked (503 guard).
- The SaaS notice on the registration page states terms are being finalised.
- For public commercial launch: defer SaaS registration until applicable commercial terms and minimum SaaS capabilities are ready.

| Policy | Status | Applies to |
|---|---|---|
| Allow SaaS registration with restrictions | Active | Controlled testing (current) |
| Defer SaaS registration until terms published | PLANNED | Public commercial launch |

### Non-negotiable invariants

1. A provider has one Provider account and one active business model at a time.
2. The server derives all commercial fields; the browser supplies selections only.
3. `organisationType` is always explicitly set by the registration API (no DB default reliance).
4. `commercialAgreementStatus` reflects whether terms have been published AND accepted.
5. `privacyPolicyVersion` and `privacyPolicyAcceptedAt` are always set, independent of commercial agreement.
6. `User.termsAcceptedAt` and `User.termsVersion` are written ONLY for Marketplace providers (legacy Instructor Terms fields).
7. SaaS providers' agreement is recorded in `Provider.commercialAgreement*` fields only.
8. DIRECT payment mode is blocked at runtime until separately implemented and verified.

---

## Part 2: Existing Implementation

### Gate 1: Business category

| Item | Status | Files | Evidence |
|---|---|---|---|
| Business type selection page | EXISTS | `app/register/business-type/page.tsx` | Source inspection |
| Zod schema accepts driving/plumber/electrician/beauty/tax | EXISTS | `app/api/register/route.ts` (registerSchema) | Source + HTTP tests RT-5, RT-6 |
| Template loader for each business type | EXISTS | `lib/presets/loader.ts`, `lib/presets/{driving,beauty,tax}.ts` | Source inspection |
| URL parameter carries business type to registration page | EXISTS | `app/register/page.tsx` (useSearchParams) | Browser test BW-3 |
| Redirect to business-type selection if no param | EXISTS | `app/register/page.tsx` (useEffect) | Source inspection |

### Gate 2: Organisation type

| Item | Status | Files | Evidence |
|---|---|---|---|
| INDIVIDUAL_INSTRUCTOR for driving (always) | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests FIX-4-1/2; HTTP RT-1; DB RT-1DB; Browser BW-6 |
| SOLE_TRADER for non-driving (default) | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests FIX-4-3; HTTP RT-5; DB RT-5DB |
| REGISTERED_BUSINESS for non-driving (optional) | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests FIX-4-4; HTTP RT-6 |
| DRIVING_SCHOOL rejection | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests FIX-4-6/7/8; HTTP RT-7; Browser BW-4, BW-10 |
| BUSINESS type rejection | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests; HTTP RT-8 |
| INDIVIDUAL_INSTRUCTOR for non-driving rejection | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests; HTTP RT-9 |
| UI: Driving School shown as "Coming soon" / aria-disabled | VERIFIED | `app/register/page.tsx` | Browser BW-4, BW-10 |
| UI: Independent instructor pre-selected for driving | VERIFIED | `app/register/page.tsx` | Browser BW-6 (violet border asserted) |
| UI: Non-driving business structure selector (Sole trader / Registered company) | VERIFIED | `app/register/page.tsx` | Browser BW-3 |
| Schema: `organisationType String?` (nullable, no default) | VERIFIED | `prisma/schema.prisma` | Unit tests FIX-4-10 |
| Migration: nullable TEXT, no DEFAULT clause | VERIFIED | `prisma/migrations/20261110000001_.../migration.sql` | Unit tests FIX-4-11, MIG-1 |
| Production DB: `organisationType` exists (NOT NULL DEFAULT 'SOLE_TRADER') | EXISTS | Production schema inspection | `check-db-state.cjs` output — schema drift documented in tracker 11.5 |

### Gate 3: Commercial model

| Item | Status | Files | Evidence |
|---|---|---|---|
| Driving instructors choose MARKETPLACE or SAAS | VERIFIED | `app/register/page.tsx` | Browser BW-1, BW-2 |
| Non-driving always SAAS (API enforces) | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests FIX-2-1; HTTP RT-5; Browser BW-3 |
| Omitted businessModel defaults to MARKETPLACE (backward compat) | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests BC-1; HTTP (implicit) |
| `paymentMode` derived from `businessModel`, never from browser | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests BC-1–3; DB RT-1DB, RT-4DB, RT-5DB |
| `businessModel` persisted to Provider | VERIFIED | `app/api/register/route.ts` | DB RT-1DB (MARKETPLACE), RT-4DB (SAAS), RT-5DB (SAAS) |
| `paymentMode` persisted to Provider | VERIFIED | `app/api/register/route.ts` | DB RT-1DB (PLATFORM), RT-4DB (DIRECT), RT-5DB (DIRECT) |
| `industry` field persisted to Provider | VERIFIED | `app/api/register/route.ts` | DB RT-5DB (industry=plumber) |
| UI: Marketplace/SaaS model selector visible for driving only | VERIFIED | `app/register/page.tsx` | Browser BW-3 (not visible for plumber) |
| UI: SaaS option shows "Direct payments not yet available" notice | EXISTS | `app/register/page.tsx` | Source inspection |

### Gate 4: Capability and commercial disclosures

| Item | Status | Files | Evidence |
|---|---|---|---|
| SaaS notice: "SaaS Terms are being finalised" (unpublished) | VERIFIED | `app/register/page.tsx` | Browser BW-2, BW-3 |
| SaaS notice: "Your account and all non-commercial features are available immediately" | EXISTS | `app/register/page.tsx` | Source inspection |
| SaaS option description: "You bring your own students" | EXISTS | `app/register/page.tsx` | Source inspection |
| Marketplace option description: "Students discover and book through DriveBook" | EXISTS | `app/register/page.tsx` | Source inspection |
| SaaS option warning: "Direct payments are not yet available" | EXISTS | `app/register/page.tsx` | Source inspection |
| Does NOT promise unavailable capabilities | VERIFIED | Source inspection | Browser BW-2 confirms notice, not promise |
| Published SaaS checkbox (when `SAAS_TERMS_PUBLISHED=true`) | VERIFIED | `app/register/page.tsx` | Browser BW-11 (published mode) |

### Gate 5: Terms and privacy acceptance

| Item | Status | Files | Evidence |
|---|---|---|---|
| Marketplace requires `termsAccepted=true` (Instructor Terms v2.0) | VERIFIED | `lib/registration/derive-registration-fields.ts` | HTTP RT-2 (400 without); DB RT-1DB (ACCEPTED, version 2.0) |
| Marketplace `commercialAgreementType=MARKETPLACE_TERMS` | VERIFIED | `app/api/register/route.ts` | DB RT-1DB |
| Marketplace `commercialAgreementStatus=ACCEPTED` at registration | VERIFIED | `app/api/register/route.ts` | DB RT-1DB |
| Marketplace `commercialAgreementVersion=2.0` | VERIFIED | `app/api/register/route.ts` | DB RT-1DB |
| Marketplace `commercialAgreementAcceptedAt` set | VERIFIED | `app/api/register/route.ts` | DB RT-1DB |
| Marketplace `User.termsAcceptedAt` set | VERIFIED | `app/api/register/route.ts` | DB RT-1DB |
| Marketplace `User.termsVersion=2.0` | VERIFIED | `app/api/register/route.ts` | DB RT-1DB |
| SaaS (unpublished): `commercialAgreementType=SAAS_TERMS` | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB |
| SaaS (unpublished): `commercialAgreementStatus=PENDING` | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB |
| SaaS (unpublished): `commercialAgreementVersion=null` | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB |
| SaaS (unpublished): `commercialAgreementAcceptedAt=null` | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB |
| SaaS: `User.termsAcceptedAt=null` (SaaS isolation) | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB |
| SaaS: `User.termsVersion=null` (SaaS isolation) | VERIFIED | `app/api/register/route.ts` | DB RT-4DB, RT-5DB |
| SaaS (published): acceptance required when `SAAS_TERMS_PUBLISHED=true` | VERIFIED | `lib/registration/derive-registration-fields.ts` | HTTP SP-1, SP-2 (400 without); SP-3 (201 with) |
| SaaS (published): `commercialAgreementStatus=ACCEPTED` | VERIFIED | `app/api/register/route.ts` | DB SP-3DB |
| SaaS (published): `commercialAgreementVersion=<published>` | VERIFIED | `app/api/register/route.ts` | DB SP-3DB (version=1.0) |
| SaaS (published): `User.termsAcceptedAt=null` (isolation maintained) | VERIFIED | `app/api/register/route.ts` | DB SP-3DB |
| Privacy required (`privacyAccepted=true` via Zod `z.literal(true)`) | VERIFIED | `app/api/register/route.ts` | HTTP RT-10 (400 without) |
| `privacyPolicyVersion=2.0` always set | VERIFIED | `app/api/register/route.ts` | DB RT-1DB, RT-4DB, RT-5DB, SP-3DB |
| `privacyPolicyAcceptedAt` always set, independent of commercial terms | VERIFIED | `app/api/register/route.ts` | DB RT-4DB (PENDING commercial + set privacy), RT-5DB |
| Fail-closed version guard (published + null version → error) | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests VG-1, VG-2 |
| `ageDeclaration` NOT in provider registration (CLIENT/LEARNER only) | VERIFIED | `app/api/register/route.ts` | Unit tests AGE-1–6; HTTP (implicit) |
| UI: Instructor Terms checkbox visible for Marketplace | VERIFIED | `app/register/page.tsx` | Browser BW-1 |
| UI: Instructor Terms checkbox NOT visible for SaaS unpublished | VERIFIED | `app/register/page.tsx` | Browser BW-2 |
| UI: Privacy checkbox always required | VERIFIED | `app/register/page.tsx` | Browser BW-5 |
| UI: Submit disabled until both terms + privacy for Marketplace | VERIFIED | `app/register/page.tsx` | Browser BW-1 |
| UI: Submit enabled with privacy only for SaaS unpublished | VERIFIED | `app/register/page.tsx` | Browser BW-2 |
| UI: SaaS Terms checkbox + link when published | VERIFIED | `app/register/page.tsx` | Browser BW-11 |

### Gate 6: Account creation and verification

| Item | Status | Files | Evidence |
|---|---|---|---|
| Server derives all fields via `deriveRegistrationFields()` | VERIFIED | `lib/registration/derive-registration-fields.ts` | 165 unit tests (Vitest) |
| `RegistrationValidationError` thrown before any DB writes | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests (all rejection paths) |
| User + Provider + Business created in `$transaction` | EXISTS | `app/api/register/route.ts` | Source inspection |
| Trial subscription created via `createOrReuseTrialSubscription` | EXISTS | `app/api/register/route.ts` | Source inspection; dev server logs confirm |
| Verification token generated and emailed | EXISTS | `app/api/register/route.ts` | Source inspection |
| HTTP 201 returned with providerId, commercialAgreementStatus | VERIFIED | `app/api/register/route.ts` | HTTP RT-1, RT-4, RT-5, RT-6, SP-3, SP-5 |
| HTTP 400 returned for validation errors with correct codes | VERIFIED | `app/api/register/route.ts` | HTTP RT-2, RT-3, RT-7, RT-8, RT-9, RT-10, SP-1, SP-2, SP-4 |
| Rate limiting on registration endpoint | EXISTS | `app/api/register/route.ts` (checkRateLimitStrict) | Source inspection |
| Browser: form submission redirects to /login?registered=1 | VERIFIED | `app/register/page.tsx` | Browser BW-7, BW-8, BW-9 |
| Browser: request payload intercepts confirm correct fields | VERIFIED | `app/register/page.tsx` | Browser BW-7 (MARKETPLACE+terms), BW-8 (SAAS, no terms), BW-9 (plumber, SOLE_TRADER), BW-11 (published SaaS, saasTermsAccepted) |

### Gate 7: Optional business discovery

| Item | Status | Files | Evidence |
|---|---|---|---|
| Discovery page exists at `/dashboard/discovery` | EXISTS | `app/dashboard/discovery/page.tsx` | Source inspection |
| Discovery does not affect Provider fields at registration | VERIFIED | `app/api/register/route.ts` | HTTP tests (no discovery reference); Unit tests IVF-D1–3 |
| Discovery is conditional on `isSaas` for wording | EXISTS | `app/dashboard/discovery/page.tsx` | Source inspection; unit test DISC-11 |

### Cross-cutting: SaaS Terms page

| Item | Status | Files | Evidence |
|---|---|---|---|
| `/saas-terms` page exists with 8 sections | EXISTS | `app/saas-terms/page.tsx` | Browser BW-11 (link visible when published); Unit tests SAAS-UI-6, SAAS-UI-7 |
| Status banner: "Not yet in effect" | EXISTS | `app/saas-terms/page.tsx` | Source inspection |
| `SAAS_TERMS_URL = '/saas-terms'` in constants | VERIFIED | `lib/config/registration-constants.ts` | Unit test SAAS-UI-8 |
| Env-var override for test isolation | EXISTS | `lib/config/registration-constants.ts` | HTTP SP-3DB, SP-5; Browser BW-11 |

### Cross-cutting: Payment-service gate

| Item | Status | Files | Evidence |
|---|---|---|---|
| DIRECT payment mode → 503 on bulk-booking | VERIFIED | `app/api/public/bookings/bulk/route.ts` | Unit tests PG-1; WLA-001 |
| DIRECT payment mode → 503 on create-intent | VERIFIED | `app/api/payments/create-intent/route.ts` | Unit tests PG-2; WLA-001 |
| DIRECT payment mode → 503 on quote accept | VERIFIED | `app/api/client/quotes/[id]/accept/route.ts` | Unit tests PG-3; WLA-001 |
| `assertPlatformPaymentMode()` server-side guard | EXISTS | `lib/utils/account.ts` | Unit test PG-4 |
| All SaaS providers derive `paymentMode=DIRECT` | VERIFIED | `lib/registration/derive-registration-fields.ts` | Unit tests PG-5; DB RT-4DB, RT-5DB |

### Cross-cutting: Test infrastructure

| Item | Status | Files | Evidence |
|---|---|---|---|
| Vitest suite (165 tests) | VERIFIED | `__tests__/integration/reg-phase2-architecture.test.ts`, `reg-business-model-selection.test.ts` | 165/165, exit 0 |
| HTTP runtime script (10 HTTP + 30 DB assertions) | VERIFIED | `scripts/runtime-verify-registration.cjs` | Exit 0 against live dev server + Supabase |
| Published SaaS HTTP script (7 tests + 11 DB assertions) | VERIFIED | `scripts/runtime-verify-saas-published.cjs` | Exit 0 against live dev server + Supabase |
| Playwright browser tests (11 tests) | VERIFIED | `__tests__/browser/registration.spec.ts` | 11/11, exit 0 |
| Classification script (read-only) | EXISTS | `scripts/migration-phase2-classification.cjs` | Source inspection; not executed against production |
| DB state check script | EXISTS | `scripts/check-db-state.cjs` | Executed against production (read-only) |
| Provider inspection script | EXISTS | `scripts/check-providers.cjs` | Executed against production (read-only) |
| Test account cleanup script | EXISTS | `scripts/cleanup-test-accounts.cjs` | Executed against production (10 deleted) |
| Dev helper migration script | EXISTS | `scripts/apply-phase2-migration.cjs` | DRIFT-1–5 tests guard against schema drift |

---

## Part 3: Verification Evidence Summary

### Verification levels achieved

| Level | Method | Coverage | Independence |
|---|---|---|---|
| Source-level (Vitest) | 165 unit/integration tests | All derivation logic, schema, migration, constants | Reported (not independently reproduced by reviewer) |
| HTTP runtime | 10 HTTP + 30 DB assertions against live server + Supabase | Registration API responses + Provider/User DB records | Reported (not independently reproduced by reviewer) |
| Published SaaS HTTP | 7 tests + 11 DB assertions | SaaS Terms published lifecycle | Reported (not independently reproduced by reviewer) |
| Browser (Playwright) | 11 tests against live Chromium | UI rendering, checkbox gating, form submission, payload interception, redirect verification | Reported (not independently reproduced by reviewer) |
| Production schema | `check-db-state.cjs` read-only query | 7 Phase 2 columns present; 13 test Provider records; 0 bookings/transactions | Reported |

### What is NOT independently verified

- Vitest suite not independently re-executed by reviewer
- HTTP/DB runtime tests not independently re-executed by reviewer
- Playwright browser tests not independently re-executed by reviewer
- Production Vercel deployment registration flow not independently tested
- No browser automation against the deployed production URL

---

## Part 4: Outstanding Gaps

### Registration onboarding gaps

| ID | Gap | Status | Impact | Dependency |
|---|---|---|---|---|
| GAP-01 | Post-registration business-model transition (Marketplace ↔ SaaS) | NOT IMPLEMENTED | Provider cannot change model after registration | Separate future feature |
| GAP-02 | Existing SaaS provider terms acceptance flow | NOT IMPLEMENTED | Providers with PENDING status cannot accept published terms | SaaS Terms must be published first |
| GAP-03 | SaaS Terms finalised legal content | PARTIAL | `/saas-terms` page has preview content; version/date TBD | Legal review required |
| GAP-04 | DIRECT payment mode implementation | NOT IMPLEMENTED (503-blocked) | SaaS providers cannot process direct payments | Stripe Connect onboarding + webhook handling + payment flow |
| GAP-05 | Driving School registration | NOT IMPLEMENTED (rejected) | DRIVING_SCHOOL organisation type unavailable | Multi-instructor architecture |
| GAP-06 | BUSINESS account type | NOT IMPLEMENTED (rejected) | Multi-provider organisation unavailable | Multi-provider architecture |
| GAP-07 | `organisationType` schema drift (production: NOT NULL DEFAULT vs nullable) | EXISTS | DB default assigns SOLE_TRADER to paths that omit the field | Migration-history reconciliation |
| GAP-08 | Migration-history reconciliation (40 unrecorded + 1 failed) | EXISTS | Cannot safely use `prisma migrate deploy` | Separate infrastructure task |
| GAP-09 | Browser tests require manual server startup (NODE_OPTIONS OOM on Windows) | EXISTS | Cannot auto-start dev server from Playwright config | Windows/Next.js webpack worker memory constraint |
| GAP-10 | SaaS registration eligibility for public launch | PLANNED | Current policy allows restricted SaaS registration; public launch should defer until terms published | SaaS Terms publication |

### Product capability status

| Capability | Marketplace | SaaS (current) | SaaS (future) |
|---|---|---|---|
| Registration | Available | Available (restricted) | Available (with published terms) |
| Platform payments | Available | Unavailable (503) | Planned (DIRECT mode) |
| Marketplace discovery | Available | Unavailable | Unavailable (by design) |
| Commission (15%) | Available | Not applicable | Not applicable |
| Subscription billing | Available | Available | Available |
| White-label branding | Available (STUDIO+) | Available (PREMIUM) | Available (PREMIUM) |
| Custom domain | Available (STUDIO+) | Available (PREMIUM) | Available (PREMIUM) |
| AI receptionist | Available (PRO+) | Available (PRO+) | Available (PRO+) |
| Direct payments | Unavailable | Unavailable (503) | Planned |
| Post-registration model switch | Unavailable | Unavailable | Planned |
| Multi-provider | Unavailable | Unavailable | Planned |

---

## Part 5: Implementation Roadmap

### Completed (current cycle)

| Item | Status | Commits | Verification |
|---|---|---|---|
| ageDeclaration removal | VERIFIED | `99174967` | AGE-1–6 |
| organisationType nullable + no default | VERIFIED | `99174967` | MIG-1, FIX-4-10/11 |
| Classification script v2 with REVIEW group | VERIFIED | `99174967` | MIG-3–5 |
| apply-phase2-migration.cjs corrected + DRIFT guards | VERIFIED | `e17eece5` | DRIFT-1–5 |
| SaaS User.terms* isolation | VERIFIED | `f5f40a7e` | OWN-1–4 |
| SaaS lifecycle tests (_testSaasPublished) | VERIFIED | `52fe73da` | SaaS-PUB-1–7 |
| SaaS Terms UI lifecycle + /saas-terms page | VERIFIED | `3f174df2` | SAAS-UI-1–10 |
| Fail-closed version guard | VERIFIED | `c8000038` | VG-1–7 |
| Independent verification (31 IVF tests) | VERIFIED | `986824cd` | IVF-M/S/SP/O/P/DS/D |
| Vercel build fix (14 TypeScript errors) | VERIFIED | `4ed626c3` | Local build exit 0; Vercel success |
| Package-lock reconciliation | VERIFIED | `2b3c9e05` | npm ci + build + vitest all pass |
| Full Provider DB persistence (30 assertions) | VERIFIED | `5e39f581` | HTTP RT-1DB/4DB/5DB; SP-3DB |
| SaaS published HTTP lifecycle (7 tests) | VERIFIED | `5e39f581` | HTTP SP-1–5 |
| Test cleanup accounting fix | VERIFIED | `4c6bea6e` | Source verified |
| Browser tests BW-1–6 (rendering + gating) | VERIFIED | `968c1609` | Playwright 6/6 |
| Browser tests BW-7–9 (submission + payload) | VERIFIED | `488bc054` | Playwright 9/9 |
| Browser tests BW-10–11 (DS prevention + published SaaS) | VERIFIED | `33bdc4b6` | Playwright 11/11 |
| Production DB state check | EXISTS | `4d39b7cc` | check-db-state.cjs executed |
| Provider creation path audit | VERIFIED | `0055133a` | Source inspection of all 3 paths |
| Tracker Section 11 + corrected migration assessment | EXISTS | `0055133a`, `d2bcd12c` | Documentation |

### Future work (ordered by dependency)

| Priority | Item | Status | Dependencies | Acceptance criteria |
|---|---|---|---|---|
| 1 | SaaS Terms legal content finalisation | PARTIAL | Legal review | Published version string; effective date; all 8 sections complete |
| 2 | SaaS Terms publication + existing-provider acceptance flow | NOT IMPLEMENTED | Item 1 | Dashboard notice; API endpoint; version + timestamp recorded; audit log |
| 3 | SaaS registration eligibility for public launch | PLANNED | Items 1–2 | Policy decision: defer SaaS registration until terms published OR allow with documented restrictions |
| 4 | Migration-history reconciliation | BLOCKED | Separate infrastructure task | All 40 unrecorded migrations resolved; failed migration fixed; `prisma migrate deploy` safe |
| 5 | Post-registration business-model transition (Marketplace ↔ SaaS) | NOT IMPLEMENTED | Item 2 (SaaS Terms); Item 4 (migration); DIRECT payment (item 6) | Request UI; eligibility checks; agreement acceptance; admin approval; financial reconciliation; effective date; audit history |
| 6 | DIRECT payment mode implementation | NOT IMPLEMENTED | Stripe Connect onboarding; webhook handling; payment flow; 503 guard removal | SaaS providers can process direct payments; Stripe Connect onboarding complete |
| 7 | Driving School registration | NOT IMPLEMENTED | Multi-instructor architecture | DRIVING_SCHOOL organisation type available; multiple instructors under one school identity |
| 8 | BUSINESS/multi-provider account type | NOT IMPLEMENTED | Multi-provider architecture | Multiple providers under one organisation; admin roles; team management |

### Documentation update rule

Every implementation task must update this document in the same delivery cycle as the code change:

1. Review the current documented requirements and implementation status.
2. Identify the precise gap being addressed.
3. Implement only the agreed scope.
4. Run the relevant tests and record actual results.
5. Update this document with changed files, commit references, evidence and remaining limitations.
6. Update `AUDIT-MASTER-TRACKER.md` Section 11 and link it to this document.
7. Close the item only when its acceptance criteria and required verification are satisfied.

If implementation is incomplete, the document must say so. A commit alone must never turn an item into VERIFIED.

---

## Change History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-13 | Kiro | Initial creation — full baseline of registration onboarding implementation, evidence, gaps and roadmap |
