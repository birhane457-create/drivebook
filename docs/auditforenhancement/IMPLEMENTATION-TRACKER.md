# Implementation Tracker — AI Enhancement Audit

**Branch:** `audit/ai-enhancement-multimodel`

## P0-02 — Middleware S-7 Defence-in-Depth

| Stage | Status | Evidence |
|---|---|---|
| Finding | VERIFIED | D-20 / Kiro Phase 4 challenge |
| Baseline | VERIFIED | `middleware.ts` had broad public-path prefix matching |
| Implement | COMPLETE | Path-boundary matcher; exact root handling; restricted NextAuth public endpoints; protected API check before public short-circuit |
| Regression tests | ADDED | `middleware.public-paths.test.ts` |
| Kiro verification | PENDING | Independent verification required |
| FIX-VERIFIED | PENDING | Requires passing tests + Kiro review |
| CLOSED | PENDING | Do not close before evidence |

### Acceptance criteria

- [x] `/` is exact-match only.
- [x] Public route matching uses path boundaries.
- [x] Arbitrary `/api/auth/*` paths are not automatically public.
- [x] Protected API detection occurs before the public short-circuit.
- [x] Regression tests cover root-prefix, protected API, NextAuth, and route-boundary cases.
- [ ] Test execution evidence recorded.
- [ ] NextAuth login/logout/session flows verified.
- [ ] Kiro independent verification completed.
- [ ] D-20 marked FIX-VERIFIED.
- [ ] D-20 marked CLOSED.

**Rule:** Source changes alone do not close a finding. Test and independent verification evidence are required.

## P1-03 — Instructor Risk

**Finding:** `getInstructorRisk()` read legacy document-expiry fields from `Provider`, masking a schema mismatch with `as any`.

**Implementation status:** FIX-VERIFIED — implementation, focused tests, and independent GPT audit complete. Closure remains pending the project closure gate.

### Changes

- Read provider identity and Stripe fields through the typed Prisma `Provider` client.
- Read `licenseExpiry`, `insuranceExpiry`, and `wwcCheckExpiry` from typed `DrivingProviderProfile` rows keyed by `providerId`.
- Preserve existing cancellation, dispute, Stripe, and 14/30-day expiry scoring semantics.
- Return the shared `ToolResult<T>` contract.
- Return `ERROR` when the required provider query fails.
- Return `PARTIAL` with `missing[]` when an independent profile, cancellation, or dispute query fails.
- Represent missing profiles and unavailable document data explicitly; affected providers receive `riskLevel: 'unknown'` and `riskScore: null` rather than clean risk.

### Verification

- Focused tests: `13/13` passed in `lib/admin/__tests__/instructor-risk.test.ts`.
- Required regression command: passed the discovered Admin Copilot suite, `13/13` tests.
- `npx tsc --noEmit`: exits `2` because of pre-existing test typing errors across 24 repository test files (`vi`, `expect`, `describe`, and related globals). No diagnostics remain in the P1-03 implementation, shared contract, or focused test file.

### Lifecycle

`FINDING → VERIFIED → FIX → COPILOT TESTS → GPT INDEPENDENT AUDIT → FIX-VERIFIED → CLOSED`

Current state: `FIX-VERIFIED`; do not close P1-03 until the project closure gate is satisfied.

### Independent verification

- GPT audited exact commit `a31066ee7ea5d4f8b1af5e96998e7475d503d121` against `3846d6a9`.
- GPT result: `FIX-VERIFIED`.
- GPT confirmed typed `DrivingProviderProfile` access, explicit unknown evidence states, error/partial handling, preserved scoring, `13/13` focused tests, and `114/114` regression tests.
- P1-03 is intentionally not marked `CLOSED`.

## P1-04 — Daily Summary Expiring Documents

**Finding:** `getDailySummary()` used an empty `OR: [{}, {}]` filter on `Provider`, so `expiringDocs` was not an expiry metric.

**Implementation status:** FIX-VERIFIED — implementation, focused tests, and independent GPT audit complete. Closure remains pending the project closure gate.

### Changes

- Read approved provider IDs through the typed Prisma `Provider` client.
- Count matching `DrivingProviderProfile` rows using licence, insurance, police-check, and WWCC expiry fields.
- Preserve the existing 30-day look-ahead while removing the no-op filter.
- Return the shared `ToolResult<DailySummaryData>` contract.
- Return `PARTIAL` with stable signal labels in `missing[]` when independent summary queries fail.
- Return `ERROR` when every summary signal fails.
- Represent unavailable counts as `null`, never as business zeroes.

### Verification

- Focused tests: `3/3` passed in `lib/admin/__tests__/daily-summary.test.ts`.
- Combined regression suite before the final missing-label refinement: `117/117` passed across 6 files.
- Final focused suite after the refinement: `3/3` passed.
- Touched-file TypeScript diagnostics: none reported. Repository-wide `tsc --noEmit` remains affected by pre-existing test-global typing errors.

### Lifecycle

`FINDING → VERIFIED → FIX → COPILOT TESTS → GPT INDEPENDENT AUDIT → FIX-VERIFIED → CLOSED`

Current state: `FIX-VERIFIED`; do not close P1-04 until the project closure gate is satisfied.

### Independent verification

- GPT audited exact commit `88a6c8349ae01ed213cab51b43b3b399e80d64df` against the previous P1-03 commit.
- GPT result: `FIX-VERIFIED`.
- GPT confirmed removal of the no-op filter, typed `DrivingProviderProfile` access, approved-provider scoping, explicit error/partial handling, stable `missing[]` labels, `3/3` focused tests, and `117/117` regression tests.
- GPT noted the intentional inclusion of already-expired documents in the operational 30-day compliance metric; this remains a separate semantics decision.
- P1-04 is intentionally not marked `CLOSED`.

## P1-05 — Suburb Demand Sampling

**Finding:** `getSuburbDemand()` silently limited the input to 500 bookings and calculated demand from that incomplete sample.

**Implementation status:** FIX — implementation and focused tests complete; independent audit pending.

### Changes

- Removed the silent `take: 500` sample cap.
- Fetch the complete qualifying booking set with deterministic creation-time ordering.
- Preserve the existing address-based suburb extraction because `Booking` has no canonical suburb field.
- Return `ToolResult<SuburbDemandData>` with `totalBookings`, `sampleSize`, and `truncated: false` metadata.
- Return `EMPTY` when no qualifying bookings exist and `ERROR` when the booking query fails.

### Verification

- Focused tests: `3/3` passed in `lib/admin/__tests__/suburb-demand.test.ts`.
- Combined regression suite: `120/120` passed across 7 files.
- Touched-file TypeScript diagnostics: none reported. Repository-wide `tsc --noEmit` remains affected by pre-existing test-global typing errors.

### Lifecycle

`FINDING → VERIFIED → FIX → COPILOT TESTS → GPT INDEPENDENT AUDIT → FIX-VERIFIED → CLOSED`

Current state: `FIX`; do not close P1-05 before focused tests and independent verification.