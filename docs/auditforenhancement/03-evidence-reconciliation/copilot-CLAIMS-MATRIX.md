# Copilot Claims Matrix — DriveBook AI Copilot Enhancement Audit

**Phase:** 3 — Evidence Reconciliation  
**Author:** GitHub Copilot  
**Date:** 2026-09-24  
**Method:** Direct repository code verification and comparison against the Phase 1 and Phase 2 audit findings  
**Status:** Reconciliation in progress

## Status legend
- VERIFIED-CODE = confirmed directly in repository source
- PARTIAL = confirmed in source, but impact/runtime requires more evidence
- OPEN = requires runtime, production, security, accounting, or benchmark evidence
- SECURITY = separate out-of-band security track
- POSITIVE CONTROL = architectural control that should be preserved

---

## 1. Verified source defects and architecture issues

| ID | Claim | Evidence | Status | Notes |
|---|---|---|---|---|
| C-01 | Tool DB failures are converted into zero or empty business results | `drivebook/lib/admin/ai-tools.ts` uses `.catch(() => 0)` and `.catch(() => ({ _sum: { amount: 0 } }))` across multiple tool calls | VERIFIED-CODE | Strongest correctness defect; fix with explicit SUCCESS/EMPTY/PARTIAL/ERROR contract |
| C-01a | Health-score failure inversion: failed payment query treated as zero can improve score | `drivebook/lib/admin/ai-tools.ts` `getHealthScore` includes a failedPayments signal and previously treated missing/failed data as zero-like success | VERIFIED-CODE | Severity should be separate from the broader pattern |
| C-02 | Instructor-risk logic is inconsistent with current Prisma schema and fields moved to profile tables | `drivebook/lib/admin/ai-tools.ts` uses provider-level expiry fields while the broader architecture indicates driving-specific expiry data belongs to a profile model | VERIFIED-CODE | Needs fixture-backed runtime confirmation |
| C-03 | Expiring-doc summary query is effectively no-op because the filter is an empty OR condition | `drivebook/lib/admin/ai-tools.ts` `getDailySummary` has `OR: [{}, {}]` for expiring document checks | VERIFIED-CODE | Clear logic defect |
| C-06 | Suburb demand silently samples the first 500 bookings and does not reveal that truncation | `drivebook/lib/admin/ai-tools.ts` `getSuburbDemand` uses `take: 500` and aggregates the sampled set only | VERIFIED-CODE | Not a security issue, but a correctness/observability problem |
| C-07 | Student retention query is duplicated or structurally redundant | `drivebook/lib/admin/ai-tools.ts` `getStudentRetention` reuses a similar recent-booker selection and repeat calculation pattern | VERIFIED-CODE | Lower severity than correctness blockers |
| A-01 | No structured DriveBook knowledge layer is injected into the assistant | `drivebook/app/api/admin/ai-query/route.ts` system prompt is operational but not knowledge-based or versioned | VERIFIED-CODE | This is a capability gap and a design requirement |
| A-02 | No entity-correlation investigation tool exists yet | The admin tool set is reporting-oriented rather than entity-based investigation | VERIFIED-CODE | Enhancement, not current defect |
| A-03 | Provider fallback is not evidence-equivalent to the OpenAI path | `drivebook/app/api/admin/ai-query/route.ts` OpenAI path uses tool-calling loop; Anthropic path prefetches a narrower four-tool context | VERIFIED-CODE | This is a real architecture issue |
| A-04 | Untrusted DB/user text is not explicitly separated from instruction content | `drivebook/app/api/admin/ai-query/route.ts` injects tool JSON into the same message stream | VERIFIED-CODE | Reachability is real; exploitability still requires staging tests |
| A-05 | Tool arguments are not strongly validated at the server boundary | `JSON.parse(tc.function?.arguments ?? '{}')` then `callTool(name, args)` without strong schema validation | VERIFIED-CODE | Needs runtime validation and bounded input checks |
| A-06 | Audit logging is non-fatal and is not role-accurate | `drivebook/app/api/admin/ai-query/route.ts` logs `actorRole: 'ADMIN'` unconditionally and catches audit failure without stopping the request | VERIFIED-CODE | Compliance and traceability problem |
| A-07 | UI readiness check hits the production AI API instead of a dedicated health route | `drivebook/components/admin/AdminAIChat.tsx` sends a `__ping__` message to `/api/admin/ai-query` on mount | VERIFIED-CODE | Operational noise, cost risk, noisy logs |
| A-08 | Response discipline is not explicit enough: FACT / INFERENCE / UNKNOWN / RECOMMENDATION is absent | System prompt and route do not label reasoning or evidence states explicitly | VERIFIED-CODE | Important for trust and evaluation |
| A-09 | No evaluation suite exists for Copilot behavior | The repo has app and integration tests, but no AI-specific regression suite for admin Copilot behavior | VERIFIED-CODE | This should be a required enabler |

---

## 2. Open findings requiring external or runtime evidence

| ID | Claim | Evidence status | Why it remains open |
|---|---|---|---|
| O-01 | Wallet credit is equivalent to recognised revenue | OPEN | Needs finance/accounting semantics and transaction-policy confirmation |
| O-02 | DIRECT payment mode creates a production revenue gap | OPEN | Requires production data and accounting doctrine |
| O-03 | Prompt injection is exploitable in current production conditions | OPEN | Reachability is verified in source, but successful exploit is not proven |
| O-04 | AuditLog retention policy meets compliance requirements | OPEN | Requires policy review, cleanup or TTL configuration evidence |
| O-05 | Current model is insufficient and needs a stronger provider/version | OPEN | No benchmark or quality/latency/cost test has been run |
| O-06 | The role-to-tool-to-field access matrix is complete and correct | OPEN | Requires RBAC review and data classification mapping |
| O-07 | Rate-limit mismatch is material in practice | OPEN | The code mismatch is observed, but the risk is low unless operational abuse exists |

---

## 3. Positive controls to preserve

| ID | Control | Evidence | Status |
|---|---|---|---|
| X-01 | Read-only boundary remains intact | `drivebook/lib/admin/ai-tools.ts` uses a fixed allowlist and `callTool` rejects unknown names; no arbitrary SQL or Prisma mutation capability is exposed | POSITIVE CONTROL |
| X-02 | Server-side permission enforcement precedes tool execution | `drivebook/app/api/admin/ai-query/route.ts` calls `requirePermission` before tool use | POSITIVE CONTROL |
| X-03 | Tool contract layer exists and supports explicit result states | `drivebook/lib/admin/tool-contracts.ts` defines `SUCCESS`, `EMPTY`, `PARTIAL`, `ERROR`, `UNKNOWN` | POSITIVE CONTROL |

---

## 4. Out-of-scope and separate security track

| ID | Finding | Status |
|---|---|---|
| S-01 | Credential artifacts in docs or repo root files | SECURITY |
| S-02 | Auth or OTP weaknesses outside the admin Copilot scope | SECURITY |
| S-03 | Voice/booking platform security issues outside the Copilot scope | SECURITY |

These remain important, but they should not be merged with the admin Copilot backlog unless the evidence directly implicates the Copilot path.

---

## 5. Reconciled priority order

### Immediate correctness and safety
1. C-01 and C-01a: explicit error contract and no silent zero conversion
2. C-02: align instructor-risk logic with the current schema
3. C-03: fix expiring-doc logic and status semantics
4. A-05: validate tool arguments before execution
5. A-06: make audit logging authoritative and role-aware

### Immediate architecture hardening
1. A-04: enforce explicit untrusted-data separation
2. A-03: provider-neutral evidence and fallback parity
3. A-09: create a minimal Copilot evaluation suite that blocks future regressions
4. A-08: force response-state labelling for evidence and uncertainty

### Capability and future work
1. A-01: DriveBook knowledge layer
2. A-02: entity investigation tools after foundation is stable
3. O-01 and O-02: finance semantics and revenue mapping
4. O-05: model benchmark and selection only after correctness and safety are stable

---

## 6. Final reconciliation statement

The strongest verified findings are not about the model itself; they are about the operational design of the Copilot: tool result contract correctness, schema alignment, evidence discipline, trust boundaries, and logging integrity.

The important distinction is that a proven source issue is not the same as a proven production exploit. The repo shows strong evidence for correctness failures and trust-boundary weaknesses, but not yet a fully proven exploit path beyond source-level reachability.

This means the correct next move is to fix the verified correctness issues, add the staked evaluation and validation gates, and then decide on model strategy using benchmarks rather than assumptions.

## Phase 3 outcome

**Status:** EVIDENCE RECONCILIATION COMPLETE FOR THIS REVIEW CYCLE  
**Author:** GitHub Copilot

The next safe action is implementation of the first verified P0 fixes, followed by the minimal blocking evaluation suite.
