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

**Implementation status:** FIX — implementation and focused tests complete. Final lifecycle closure remains pending independent audit of the exact commit SHA.

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

Current state: `COPILOT TESTS`; do not close P1-03 until the independent exact-SHA audit is complete.