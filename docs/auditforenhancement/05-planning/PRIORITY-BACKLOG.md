# PRIORITY-BACKLOG.md — DriveBook Admin Copilot Enhancement

**Status:** Engineering backlog approved after architecture plan  
**Basis:** AI-ARCHITECTURE-PLAN.md and DECISIONS.md  
**Format:** Prioritized task list with dependencies, estimates, and acceptance criteria

---

## PRIORITY TIERS

### P0 — BLOCKERS (Security & Critical Correctness)
**Must complete before any capability expansion.**

### P1 — FOUNDATION (Correctness & Safety)
**Required for stable enhancement platform.**

### P2 — CAPABILITY (Knowledge & Investigation)
**New capabilities after foundation stable.**

### P3 — OPTIMIZATION (Model Selection & Performance)
**Evidence-based improvements after capabilities proven.**

---

## P0 — BLOCKERS

### P0-01: Security Track — Credential Verification
**Decision:** S-1, S-8, S-9 from DECISIONS.md  
**Estimate:** 1-2 days  
**Owner:** Security + DevOps

**Tasks:**
1. Check provider dashboards for liveness of credentials in `docs/pr/CREDENTIAL_ROTATION_CHECKLIST.md`
2. If live: rotate immediately + purge git history
3. If not live: document as test data + add to gitignore
4. Verify root `.credentials` file is dev-only (not in production)
5. Add `CRON_SECRET` to `.env.example`
6. Verify deployed config has `CRON_SECRET` set

**Acceptance:**
- [ ] All credentials verified (live or test) with evidence
- [ ] Live credentials rotated + history purged
- [ ] `.credentials` confirmed dev-only
- [ ] `CRON_SECRET` in example and deployed config
- [ ] S-1, S-8, S-9 closed with evidence

**Dependencies:** None  
**Blocks:** Nothing (runs in parallel)

---

### P0-02: Middleware S-7 Defence-in-Depth Fix
**Decision:** D-20  
**Estimate:** 1 day  
**Owner:** Backend engineer

**Tasks:**
1. Review current middleware public-path handling (`middleware.ts` lines 84-101)
2. Choose fix approach:
   - **Option A:** Narrow `/api/auth` to specific NextAuth routes
   - **Option B:** Reorder checks (evaluate protected paths before public short-circuit)
3. Implement chosen fix
4. Add regression test: verify protected path under public prefix is blocked
5. Verify existing NextAuth flows still work

**Acceptance:**
- [ ] Public `/api/auth` narrowed OR protected paths checked first
- [ ] Regression test added and passing
- [ ] NextAuth login/logout/session flows verified
- [ ] D-20 closed

**Dependencies:** None  
**Blocks:** Nothing (runs in parallel)

---

### P0-03: Separate Platform Security Findings
**Decision:** D-21 (S-2, S-3, S-4, S-5, S-6)  
**Estimate:** N/A (out-of-band)  
**Owner:** Security team

**Tasks:**
1. Route S-2 (shared resetToken) to security backlog
2. Route S-3 (OTP brute-force) to security backlog
3. Route S-4/S-5/S-6 (voice/booking) to platform security track
4. Ensure separate tracking/remediation outside Copilot audit

**Acceptance:**
- [ ] All platform security findings tracked separately
- [ ] No dependency on Copilot enhancement work

**Dependencies:** None  
**Blocks:** Nothing

---

## P1 — FOUNDATION (LAYER 1 & 2)

### P1-01: Define Tool Result Contract
**Decision:** D-01  
**Estimate:** 2-3 days  
**Owner:** Backend engineer

**Tasks:**
1. Define TypeScript types:
   ```typescript
   type ToolResult<T> = 
     | { status: 'SUCCESS', data: T }
     | { status: 'EMPTY', reason: string }
     | { status: 'PARTIAL', data: T, missing: string[] }
     | { status: 'ERROR', error: string }
     | { status: 'UNKNOWN', reason: string }
   ```
2. Create result envelope helpers:
   ```typescript
   createSuccess<T>(data: T): ToolResult<T>
   createEmpty(reason: string): ToolResult<never>
   createError(error: string): ToolResult<never>
   ```
3. Document contract in `lib/admin/tool-contracts.ts`
4. Create adapter layer for backward compatibility during migration

**Acceptance:**
- [ ] Types defined and exported
- [ ] Helper functions implemented
- [ ] Documentation complete
- [ ] Adapter layer working

**Dependencies:** None  
**Blocks:** P1-02 through P1-08

---

### P1-02: Migrate Health-Score Tool (C-1, C-1a)
**Decision:** D-01, D-02  
**Estimate:** 2-3 days  
**Owner:** Backend engineer

**Tasks:**
1. Read current `getBusinessHealth` implementation (`lib/admin/ai-tools.ts`)
2. Replace `.catch(() => 0)` with explicit error handling
3. Fix `failedPayments` query failure inversion
4. Return `ToolResult<HealthScore>` instead of raw number
5. Add test: DB failure returns ERROR status (not zero)
6. Add test: Failed payments query failure returns ERROR (not +20 points)
7. Confirm business impact of health score (informational vs operational)

**Acceptance:**
- [ ] No `.catch(() => 0)` patterns remain
- [ ] Failed payments query returns ERROR on failure
- [ ] Tests pass for DB failure scenarios
- [ ] Business impact documented (severity confirmed CRITICAL or HIGH)
- [ ] D-01, D-02 verified

**Dependencies:** P1-01  
**Blocks:** P1-09 (health-score semantics)

---

### P1-03: Fix Instructor-Risk Schema Alignment (C-2)
**Decision:** D-03  
**Estimate:** 2 days  
**Owner:** Backend engineer

**Tasks:**
1. Read current `getInstructorRisk` implementation
2. Verify production: measure approved-provider → profile coverage
3. Update query to read from `DrivingProviderProfile` instead of removed `User` fields
4. Return `ToolResult<InstructorRisk>` with PARTIAL status if profile missing
5. Add test: Various profile completeness levels

**Acceptance:**
- [ ] Production profile coverage measured (e.g., "98% of approved providers have profiles")
- [ ] Query reads from correct table
- [ ] PARTIAL status used when profile data incomplete
- [ ] Tests cover edge cases
- [ ] D-03 verified

**Dependencies:** P1-01  
**Blocks:** None

---

### P1-04: Fix Expiring-Document Filter (C-3)
**Decision:** D-04  
**Estimate:** 1 day  
**Owner:** Backend engineer

**Tasks:**
1. Read current `getExpiringDocuments` implementation
2. Fix no-op `OR: [{}, {}]` filter
3. Implement correct filter (expiry date within range, status = valid/expiring)
4. Return `ToolResult<Document[]>`
5. Add boundary-date fixtures (documents expiring today, tomorrow, next week, expired)

**Acceptance:**
- [ ] `OR: [{}, {}]` removed
- [ ] Filter returns only documents expiring within specified range
- [ ] Fixture tests pass
- [ ] D-04 verified

**Dependencies:** P1-01  
**Blocks:** None

---

### P1-05: Fix Suburb Demand Sampling (C-6)
**Decision:** D-07  
**Estimate:** 1 day  
**Owner:** Backend engineer

**Tasks:**
1. Read current `getSuburbDemand` implementation
2. Add explicit `take: 500` + `orderBy` semantics
3. Return `ToolResult<SuburbDemand[]>` with PARTIAL status if truncated
4. Document sampling approach: "Most recent 500 bookings by date"
5. Add test: Verify ORDER BY applied before LIMIT

**Acceptance:**
- [ ] Explicit limit and order documented
- [ ] PARTIAL status used when sampling truncates results
- [ ] Tests verify ordering logic
- [ ] D-07 verified

**Dependencies:** P1-01  
**Blocks:** None

---

### P1-06: Migrate Remaining Tools to Tool Contract
**Decision:** D-01  
**Estimate:** 3-5 days  
**Owner:** Backend engineer

**Tasks:**
1. Audit all tools in `lib/admin/ai-tools.ts` for `.catch(() => 0/[])` patterns
2. Migrate each to `ToolResult<T>` contract
3. Add error handling tests for each
4. Remove backward-compatibility adapter once all migrated

**Acceptance:**
- [ ] Zero `.catch(() => 0)` patterns in codebase
- [ ] All tools return `ToolResult<T>`
- [ ] Error handling tests pass for all tools
- [ ] Adapter removed
- [ ] D-01 fully verified

**Dependencies:** P1-01, P1-02, P1-03, P1-04, P1-05  
**Blocks:** P1-10 (evaluation suite)

---

### P1-07: Untrusted-Data Structural Separation
**Decision:** D-09  
**Estimate:** 2-3 days  
**Owner:** Backend engineer

**Tasks:**
1. Review current evidence injection in `app/api/admin/ai-query/route.ts`
2. Implement structural separation:
   ```typescript
   messages.push({
     role: 'system',
     name: 'evidence',
     content: JSON.stringify({
       source: 'database',
       untrusted: true,
       data: toolResult
     })
   })
   ```
3. Add server-side tool-argument validation
4. Sanitize model output before returning to client
5. Update system prompt to instruct handling of untrusted evidence

**Acceptance:**
- [ ] Evidence structurally separated from instructions
- [ ] Server validates tool arguments
- [ ] Output sanitized
- [ ] Prompt updated
- [ ] D-09 partially verified (staging tests in P1-08)

**Dependencies:** P1-06  
**Blocks:** P1-08

---

### P1-08: Adversarial Staging Tests (Prompt Injection)
**Decision:** D-09  
**Estimate:** 2 days  
**Owner:** Security + Backend engineer

**Tasks:**
1. Create staging test suite for prompt injection attempts:
   - Inject instructions in booking notes
   - Inject instructions in customer names
   - Inject instructions via tool arguments
   - Attempt to bypass read-only boundary
2. Verify all attempts blocked or neutralized
3. Document results in audit trail
4. If any succeed: fix before proceeding to P2

**Acceptance:**
- [ ] 10+ adversarial test cases created
- [ ] All prompt injection attempts blocked
- [ ] Results documented
- [ ] D-09 fully verified

**Dependencies:** P1-07  
**Blocks:** P2 (all capability expansion)

---

### P1-09: Health-Score Semantics Clarification
**Decision:** D-06  
**Estimate:** 2 days  
**Owner:** Product + Backend engineer

**Tasks:**
1. Document health-score formula and meaning
2. Define edge cases:
   - Zero bookings
   - DB failure (now returns ERROR)
   - Partial data (some queries succeed, some fail)
3. Update Copilot to expose underlying signals:
   ```
   "Health: 72/100
   - 10 active bookings
   - 2 failed payments
   - 1 expiring license
   - 0 customer complaints"
   ```
4. Add to knowledge base (once Layer 3 starts)

**Acceptance:**
- [ ] Health-score semantics documented
- [ ] Edge cases defined
- [ ] Copilot exposes underlying signals
- [ ] D-06 verified

**Dependencies:** P1-02  
**Blocks:** P2-01 (knowledge base)

---

### P1-10: Evaluation Suite Foundation
**Decision:** D-15  
**Estimate:** 3-4 days  
**Owner:** Backend engineer + QA

**Tasks:**
1. Create evaluation suite framework:
   ```
   tests/copilot-evaluation/
   ├── tool-selection/
   ├── failure-handling/
   ├── permission-boundaries/
   ├── representative-scenarios/
   └── prompt-injection/
   ```
2. Add test cases:
   - Tool selection: 20+ queries → verify correct tool chosen
   - Failure handling: DB error → verify ERROR status, not zero
   - Permission boundaries: Unauthorized role → tool rejected
   - Representative: 10 end-to-end admin scenarios
   - Prompt injection: All P1-08 staging tests
3. Run in CI
4. Require 100% pass before deployment

**Acceptance:**
- [ ] Evaluation suite framework created
- [ ] 50+ test cases implemented
- [ ] CI integration complete
- [ ] 100% pass rate achieved
- [ ] D-15 verified

**Dependencies:** P1-06, P1-08  
**Blocks:** P2 (prevents regression)

---

## P2 — CAPABILITY (LAYER 3 & 4)

### P2-01: Create DriveBook Knowledge Base
**Decision:** D-11  
**Estimate:** 2-3 weeks (requires domain expert time)  
**Owner:** Product + Backend engineer

**Tasks:**
1. Create knowledge base structure:
   ```
   lib/knowledge/
   ├── payment-lifecycle.md
   ├── booking-lifecycle.md
   ├── refund-payout-rules.md
   ├── instructor-documents.md
   ├── rbac-boundaries.md
   ├── operational-definitions.md
   └── version.json
   ```
2. Document each domain with product/operations team input
3. Version with semver (start at v1.0.0)
4. Integrate knowledge injection in system prompt
5. Update Copilot to cite knowledge sources

**Acceptance:**
- [ ] All six knowledge domains documented
- [ ] Version 1.0.0 tagged
- [ ] System prompt includes knowledge context
- [ ] Copilot cites knowledge in responses (e.g., "per payment lifecycle v1.0.0")
- [ ] D-11 verified

**Dependencies:** P1-10 (foundation stable)  
**Blocks:** P2-02, P2-03

---

### P2-02: Revenue Semantics Evidence Gate
**Decision:** D-05  
**Estimate:** 3-5 days (stakeholder dependent)  
**Owner:** Product + Finance

**Tasks:**
1. Meet with accounting team to define authoritative "revenue" vs "wallet credit"
2. Measure production DIRECT-mode payment coverage
3. Document financial ledger semantics
4. Design revenue tool based on evidence
5. Implement after D-05 gate resolved

**Acceptance:**
- [ ] Financial definition documented and approved
- [ ] Production DIRECT-mode coverage measured
- [ ] Revenue tool designed
- [ ] D-05 gate CLOSED with evidence

**Dependencies:** P2-01 (knowledge base for financial rules)  
**Blocks:** Revenue tool implementation

---

### P2-03: Provider-Neutral Orchestration (Anthropic Parity)
**Decision:** D-13  
**Estimate:** 2-3 days  
**Owner:** Backend engineer

**Tasks:**
1. Audit current OpenAI vs Anthropic capability gap
2. Ensure both providers receive:
   - Same tool schemas
   - Same evidence context
   - Same prompt structure
   - Same result contracts
3. Test fallback: Primary fails → Anthropic receives full context
4. Add monitoring: Log provider used, detect degraded mode

**Acceptance:**
- [ ] Anthropic fallback has equivalent tool/evidence access
- [ ] Fallback tested and working
- [ ] No silent degradation
- [ ] Monitoring captures provider usage
- [ ] D-13 verified

**Dependencies:** P2-01 (knowledge base must be provider-neutral)  
**Blocks:** P3-02 (model selection depends on fair comparison)

---

### P2-04: RBAC/Data-Classification Evidence Gate
**Decision:** D-18  
**Estimate:** 1 week (requires security/product review)  
**Owner:** Product + Security

**Tasks:**
1. Map role → permission → tool → fields → data class
2. Define data classification schema (public, internal, sensitive, PII)
3. Document intended authorization for each tool
4. Security review and approval

**Acceptance:**
- [ ] RBAC mapping complete
- [ ] Data classification defined
- [ ] Security approved
- [ ] D-18 gate CLOSED

**Dependencies:** None (can run in parallel)  
**Blocks:** P2-05, P2-06, P2-07, P2-08

---

### P2-05: Investigation Tool — Booking
**Decision:** D-12  
**Estimate:** 3 days  
**Owner:** Backend engineer

**Tasks:**
1. Implement `investigateBooking(bookingId)` tool
2. Gather: booking + customer + instructor + payments + wallet + Stripe events + audit log
3. Apply field-level RBAC filtering based on caller role
4. Return evidence envelope with data-classification metadata
5. Audit all uses of investigation tool

**Acceptance:**
- [ ] Tool implemented with complete evidence gathering
- [ ] RBAC enforced at field level
- [ ] Evidence envelope includes data-classification
- [ ] All uses audited
- [ ] Tests pass

**Dependencies:** P2-04  
**Blocks:** None

---

### P2-06: Investigation Tool — Customer
**Decision:** D-12  
**Estimate:** 2 days  
**Owner:** Backend engineer

**Tasks:**
1. Implement `investigateCustomer(customerId)` tool
2. Gather: customer + all bookings + payment history + wallet + support tickets
3. Apply RBAC field filtering
4. Return evidence envelope

**Acceptance:**
- [ ] Tool implemented
- [ ] RBAC enforced
- [ ] Evidence envelope correct
- [ ] Tests pass

**Dependencies:** P2-04  
**Blocks:** None

---

### P2-07: Investigation Tool — Instructor
**Decision:** D-12  
**Estimate:** 3 days  
**Owner:** Backend engineer

**Tasks:**
1. Implement `investigateInstructor(instructorId)` tool
2. Gather: instructor + profile + documents + bookings + revenue + complaints
3. Apply RBAC field filtering
4. Return evidence envelope

**Acceptance:**
- [ ] Tool implemented
- [ ] RBAC enforced
- [ ] Evidence envelope correct
- [ ] Tests pass

**Dependencies:** P2-04  
**Blocks:** None

---

### P2-08: Investigation Tool — Payment
**Decision:** D-12  
**Estimate:** 2 days  
**Owner:** Backend engineer

**Tasks:**
1. Implement `investigatePayment(paymentId)` tool
2. Gather: payment + booking + wallet entries + Stripe/offline mapping + reconciliation
3. Apply RBAC field filtering
4. Return evidence envelope

**Acceptance:**
- [ ] Tool implemented
- [ ] RBAC enforced
- [ ] Evidence envelope correct
- [ ] Tests pass

**Dependencies:** P2-04  
**Blocks:** None

---

### P2-09: AuditLog Governance Evidence Gate
**Decision:** D-19  
**Estimate:** 1 week (legal/compliance dependent)  
**Owner:** Legal + Compliance

**Tasks:**
1. Define Copilot audit log retention requirements
2. Define redaction requirements for sensitive queries
3. Define access audit policy (who can view Copilot logs)
4. Implement retention/redaction if needed

**Acceptance:**
- [ ] Retention policy documented
- [ ] Redaction requirements defined
- [ ] Access policy established
- [ ] Implementation complete (if required)
- [ ] D-19 gate CLOSED

**Dependencies:** None (runs in parallel)  
**Blocks:** Long-term audit log strategy

---

## P3 — OPTIMIZATION (LAYER 5)

### P3-01: Define Model Selection SLOs
**Decision:** D-14  
**Estimate:** 2 days  
**Owner:** Product + Backend engineer

**Tasks:**
1. Define quality SLOs:
   - Tool selection accuracy target (e.g., >95%)
   - Correctness target (e.g., >98%)
   - Hallucination rate ceiling (e.g., <2%)
2. Define latency SLOs (p50, p95, p99)
3. Define cost SLOs (average per query)
4. Define reliability SLOs (availability, fallback success rate)
5. Baseline current performance

**Acceptance:**
- [ ] SLOs documented and approved
- [ ] Current performance baselined
- [ ] D-14 partially verified

**Dependencies:** P1-10 (evaluation suite for measurement)  
**Blocks:** P3-02

---

### P3-02: Model Benchmark Suite
**Decision:** D-14  
**Estimate:** 3-4 days  
**Owner:** Backend engineer

**Tasks:**
1. Create benchmark suite with 50+ representative admin queries
2. Define ground-truth answers for correctness scoring
3. Run benchmark against:
   - Current: gpt-4o-mini
   - Candidates: gpt-4o, claude-3.5-sonnet, others
4. Measure: correctness, latency, cost per query
5. Document results with evidence

**Acceptance:**
- [ ] Benchmark suite operational
- [ ] All candidate models tested
- [ ] Results documented with evidence
- [ ] D-14 partially verified

**Dependencies:** P3-01, P2-03 (provider parity for fair comparison)  
**Blocks:** P3-03

---

### P3-03: Model Selection Decision
**Decision:** D-14  
**Estimate:** 2 days  
**Owner:** Product + Backend engineer

**Tasks:**
1. Review benchmark results
2. Compare candidates against SLOs
3. Document tradeoffs (quality vs cost vs latency)
4. Make evidence-based decision
5. If change justified: deploy new model
6. If current model optimal: document justification for staying

**Acceptance:**
- [ ] Model decision made with evidence
- [ ] Tradeoffs documented
- [ ] If changed: new model deployed and verified
- [ ] If unchanged: justification documented
- [ ] D-14 fully verified

**Dependencies:** P3-02  
**Blocks:** None

---

### P3-04: Observability & Monitoring Enhancements
**Decision:** D-17, A-7  
**Estimate:** 2-3 days  
**Owner:** Backend engineer + DevOps

**Tasks:**
1. Capture model/prompt/tool versions in audit log
2. Add dashboards:
   - Copilot health metrics
   - Tool correctness rate
   - Error rate per tool
   - Latency p50/p95/p99
   - Cost per query
   - Provider usage (OpenAI vs Anthropic)
3. Add alerts:
   - Error rate spike
   - Cost spike
   - Latency degradation
   - Prompt injection attempts

**Acceptance:**
- [ ] Version capture implemented
- [ ] Dashboards operational
- [ ] Alerts configured
- [ ] D-17 verified

**Dependencies:** P1-10 (evaluation suite provides metrics)  
**Blocks:** None

---

### P3-05: Duplicate Query Optimization (C-7)
**Decision:** D-08  
**Estimate:** 1 day  
**Owner:** Backend engineer

**Tasks:**
1. Remove duplicate student-retention query
2. Verify query still used only once
3. Add test to prevent regression

**Acceptance:**
- [ ] Duplication removed
- [ ] Tests pass
- [ ] D-08 verified

**Dependencies:** None  
**Blocks:** None

---

## SUMMARY

### Sequencing

**Phase 1 (P0 + P1):** Foundation — 4-6 weeks
- P0: Security blockers (parallel, 1-2 days each)
- P1-01: Tool contract (2-3 days)
- P1-02 through P1-06: Tool migration (1-3 days each, some parallel)
- P1-07 + P1-08: Untrusted-data + adversarial tests (4-5 days)
- P1-09 + P1-10: Health semantics + evaluation suite (5-6 days, some parallel)

**Phase 2 (P2):** Capability — 3-4 weeks
- P2-01: Knowledge base (2-3 weeks, can start early)
- P2-02: Revenue evidence gate (parallel, stakeholder-dependent)
- P2-03: Provider parity (2-3 days)
- P2-04: RBAC evidence gate (1 week, can start early)
- P2-05 through P2-08: Investigation tools (2-3 days each, parallel after P2-04)
- P2-09: Audit governance (parallel, legal-dependent)

**Phase 3 (P3):** Optimization — 1-2 weeks
- P3-01: SLO definition (2 days)
- P3-02: Benchmark suite (3-4 days)
- P3-03: Model decision (2 days)
- P3-04: Observability (2-3 days, can start early)
- P3-05: Optimization (1 day)

**Total timeline:** 8-12 weeks (with parallelization and evidence gates resolved promptly)

### Critical Path

```
P1-01 (contract)
  ↓
P1-02..P1-06 (tool migration)
  ↓
P1-07 (untrusted-data)
  ↓
P1-08 (adversarial tests) ← GATE before P2
  ↓
P2-01 (knowledge base)
  ↓
P2-05..P2-08 (investigation tools, after P2-04 RBAC gate)
  ↓
P3-02 (benchmark, after P2-03 provider parity)
  ↓
P3-03 (model decision)
```

### Evidence Gates (Non-blocking, Parallel)

- **P0-01:** Credential verification (security team, 1-2 days)
- **P2-02:** Revenue semantics (finance team, stakeholder-dependent)
- **P2-04:** RBAC mapping (security/product, 1 week)
- **P2-09:** Audit governance (legal, stakeholder-dependent)

### Completion Criteria

**Phase 1 complete when:**
- [ ] All P0 items closed
- [ ] Tool contract implemented and migrated
- [ ] Adversarial tests pass
- [ ] Evaluation suite operational
- [ ] Zero error-masking patterns remain

**Phase 2 complete when:**
- [ ] Knowledge base v1.0.0 deployed
- [ ] Investigation tools operational with RBAC
- [ ] Provider parity verified
- [ ] Evidence gates resolved or explicitly deferred

**Phase 3 complete when:**
- [ ] SLOs defined and baselined
- [ ] Model decision made with evidence
- [ ] Observability dashboards operational
- [ ] Optimizations deployed

**Overall success:**
- [ ] All D-01 through D-21 decisions verified or gated
- [ ] Read-only boundary preserved (D-10)
- [ ] Zero weakening of architectural controls
- [ ] All changes follow FINDING → VERIFIED → FIX → FIX-VERIFIED → CLOSED

---

**Backlog Status:** READY FOR IMPLEMENTATION  
**Next Action:** Allocate engineer, start with P0-01, P0-02, P0-03 in parallel
