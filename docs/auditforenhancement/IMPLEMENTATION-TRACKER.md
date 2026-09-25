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

**Implementation status:** FIX-VERIFIED — implementation, focused tests, and independent GPT audit complete. Closure remains pending the project closure gate.

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

Current state: `FIX-VERIFIED`; do not close P1-05 until the project closure gate is satisfied.

### Independent verification

- GPT audited exact commit `4d4bc303b5ee8568101698d87e4cf10ced03e329` against `88a6c834`.
- GPT result: `FIX-VERIFIED`.
- GPT confirmed complete aggregation beyond 500 rows, deterministic ordering, explicit result metadata, `EMPTY`/`ERROR` separation, `3/3` focused tests, and `120/120` regression tests.
- GPT noted the remaining `where: ... as any` cast as non-blocking follow-up work.
- P1-05 is intentionally not marked `CLOSED`.

## P1-06 — Remaining Tool Contract Migration

**Finding:** Weekly report, revenue breakdown, student retention, and operations timeline still use legacy `LegacyToolResult` returns and silent `.catch(() => 0/[])` fallbacks.

**Implementation status:** FIX-VERIFIED — all four P1-06 tools migrated, tested, and independently audited. Closure remains pending the project closure gate.

### Completed migrations

- Migrated weekly report to `ToolResult<WeeklyReportData>`.
- Replaced seven silent zero/aggregate fallbacks with `safeQueryAll`.
- Returns `PARTIAL` with stable missing signal labels and `null` unavailable metrics.
- Returns `ERROR` when every weekly query fails.
- Focused tests: `3/3` passed in `lib/admin/__tests__/weekly-report.test.ts`.
- Migrated revenue breakdown to `ToolResult<RevenueBreakdownData>` with null unavailable revenue/loss/earner data.
- Migrated student retention to `ToolResult<StudentRetentionData>` with derived return rate null when source cohorts are unavailable.
- Migrated operations timeline to `ToolResult<OperationsTimelineData>` with null unavailable summaries and counts.
- Removed the `LegacyToolResult` bridge from `ai-tools.ts` and the dispatcher.
- Removed all silent `.catch(() => 0/[])` and aggregate fallback patterns from `ai-tools.ts`.

### Verification

- Focused remaining-tool tests: `6/6` passed in `lib/admin/__tests__/remaining-tools.test.ts`.
- Combined final regression suite: `129/129` passed across 9 files.
- Static search: no `LegacyToolResult` or silent `.catch(() => 0/[])` patterns remain in `ai-tools.ts`.
- Touched-file TypeScript diagnostics: none reported. Repository-wide `tsc --noEmit` remains affected by pre-existing test-global typing errors.

### Lifecycle

`FINDING → VERIFIED → FIX → COPILOT TESTS → GPT INDEPENDENT AUDIT → FIX-VERIFIED → CLOSED`

Current state: `FIX-VERIFIED`; all implementation work and independent verification are complete, but do not close P1-06 until the project closure gate is satisfied.

### Independent verification

- GPT audited exact commit `b6b7593d60fec49da9ca909ee6ba4b3fa1e3b806`.
- GPT result: `FIX-VERIFIED` for the complete P1-06 migration.
- GPT confirmed all four tools use `ToolResult<T>`, the bridge and silent fallbacks are gone, unavailable metrics remain null, derived metrics avoid incomplete inputs, `6/6` focused tests passed, and `129/129` regression tests passed.
- GPT noted remaining `as any` casts and the duplicate retention query as separate non-blocking follow-up findings.
- P1-06 is intentionally not marked `CLOSED`.

## P1-07 — Untrusted Data Separation

**Finding:** Raw tool results and database-derived text reach model context without an explicit untrusted-evidence boundary.

**Implementation status:** FIX-VERIFIED — source-level fix and route-level staging evidence are independently verified. Closure remains pending the project closure gate.

### Lifecycle

`FINDING → VERIFIED → FIX → COPILOT TESTS → ADVERSARIAL STAGING → GPT INDEPENDENT AUDIT → FIX-VERIFIED → CLOSED`

Current state: `FIX-VERIFIED`; do not close P1-07 until the project closure gate is satisfied.

### Structural boundary slice

- Added `createUntrustedEvidenceEnvelope()` with explicit `source`, `tool`, `untrusted: true`, and preserved payload fields.
- Wrapped OpenAI tool messages as untrusted evidence instead of sending raw tool JSON.
- Wrapped Anthropic fallback context in the same evidence envelope.
- Added system-prompt rules that database, tool, and user text are untrusted data, not instructions.
- Preserved provider/tool error states instead of converting fallback errors to `{}`.

### Verification

- Focused tests: `2/2` passed in `lib/admin/__tests__/evidence-envelope.test.ts`.
- Touched-file TypeScript diagnostics: none reported.
- Route-level adversarial staging tests: `2/2` passed in `app/api/admin/ai-query/__tests__/p1-07-adversarial-staging.test.ts` for OpenAI and Anthropic model-facing paths.
- Hostile values covered provider names, pickup addresses, booking notes, payment errors, and instructor data.
- The staging harness verifies provider-facing request construction and evidence separation without live credentials; live-provider exploitability remains unclaimed.

### Independent verification

- GPT audited exact commit `cb65416450eb4b1126749b4e7bc4bc4c56e1feae` against `99a1c5a2`.
- GPT result: `FIX-VERIFIED` for the structural boundary and route-level staging slice.
- GPT confirmed both provider paths, hostile evidence preservation, `untrusted: true`, system-prompt rules, `2/2` adversarial tests, and `133/133` regression tests.
- GPT explicitly did not claim live-provider prompt-injection immunity.
- P1-07 is intentionally not marked `CLOSED`.

## P1-08 — Adversarial Coverage Expansion

**Finding:** The route-level staging boundary is verified, but the broader assurance target requires server-side validation, malicious-argument rejection, and a wider adversarial matrix.

**Implementation status:** FIX-VERIFIED — the final P1-08 assurance slice passed independent GPT audit and regression verification. Closure remains pending the project closure gate.

### Lifecycle

`FINDING → VERIFIED → FIX → STRUCTURAL TESTS → ADVERSARIAL STAGING → SERVER-SIDE BOUNDARY TESTS → GPT INDEPENDENT AUDIT → FIX-VERIFIED → CLOSED`

Current state: `FIX-VERIFIED`; do not close P1-08 until the project closure gate is satisfied.

### Verification

- OpenAI adversarial route path: passed.
- Anthropic route path: passed.
- Hostile provider names, addresses, booking notes, payment errors, and tool-result fields: covered.
- Malicious tool names and unavailable tools: rejected.
- Unexpected arguments, string arguments, negative numbers, and `NaN`: rejected.
- Permission bypass: rejected with `403` before provider request and tool dispatch.
- Full regression suite: `147/147` passed across 12 files.
- Touched-file TypeScript diagnostics: none reported.

### Independent verification

- GPT audited exact commit `5d4a6bac8b984bd44ad781f7033126f376cbf1b4`.
- GPT result: `FIX-VERIFIED` for the final P1-08 assurance slice.
- GPT confirmed the allowlist, server-side validation, read-only dispatch invariants, adversarial coverage, and the police-check regression.
- GPT explicitly preserved the correct limitation: the tests prove application-side boundary enforcement, not empirical live-model prompt-injection immunity.
- P1-08 is intentionally not marked `CLOSED`.

### Final P1 foundation state

| Item | SHA | Status |
|---|---|---|
| P1-01 Tool Result Contract | `df01d43a` | FIX-VERIFIED |
| P1-02 Health Score | `f127dfe7` | FIX-VERIFIED |
| P1-03 Instructor Risk | `a31066ee` + policeCheck regression | FIX-VERIFIED |
| P1-04 Daily Summary | `88a6c834` | FIX-VERIFIED |
| P1-05 Suburb Demand | `4d4bc303` | FIX-VERIFIED |
| P1-06 Remaining Tools | `b6b7593d` | FIX-VERIFIED |
| P1-07 Untrusted Evidence | `cb654164` | FIX-VERIFIED |
| P1-08 Adversarial Coverage | `5d4a6bac` | FIX-VERIFIED (144-test authoritative count) |

This is the authoritative P1 remediation sequence for the implementation audit baseline. Closure remains a separate lifecycle gate and is not recorded here.

## Next engineering stage

### P1-09 — Health-Score Semantics Clarification

**Status:** IMPLEMENTATION COMPLETE — pending independent verification
**Decision:** D-06
**Dependencies:** P1-02

**Scope:**
- document the health-score formula and semantics
- define zero vs missing vs error behaviour
- define edge cases for empty, partial, and failed data
- surface the underlying signals in Copilot output without reintroducing silent fallbacks
- correct the onboarding definition to match the actual current-approved-provider calculation

**Acceptance:**
- [x] semantics documented
- [x] edge cases defined
- [x] underlying signals surfaced
- [ ] D-06 verified by independent GPT audit

### P1-10 — Copilot Evaluation Suite Foundation

**Status:** READY
**Decision:** D-15
**Dependencies:** P1-06, P1-08

**Scope:**
- create the evaluation suite scaffold under tests/copilot-evaluation/
- add tool-selection, failure-handling, permission-boundary, representative, and prompt-injection cases
- run in CI and require 100% pass before deployment

**Acceptance:**
- [ ] evaluation suite framework created
- [ ] 50+ cases implemented
- [ ] CI integration complete
- [ ] 100% pass rate achieved
- [ ] D-15 verified

P1-09 is the next architecture item after the verified P1 foundation. P1-10 is unblocked because the ToolResult migration and adversarial boundary work are complete.