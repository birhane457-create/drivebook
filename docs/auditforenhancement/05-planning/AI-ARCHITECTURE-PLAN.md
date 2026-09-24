# AI-ARCHITECTURE-PLAN.md — DriveBook Admin Copilot Enhancement

**Status:** Planning approved after audit reconciliation complete  
**Basis:** Final decisions D-01 through D-21 at commit `41d56303`  
**Scope:** Architecture-level design for Copilot correctness, safety, and capability enhancement

---

## 1. ARCHITECTURAL PRINCIPLES

### 1.1 Foundation: Read-only boundary (D-10)
**PRESERVE — This is the single most important control.**

The Copilot must remain read-only with:
- Server-side authorization check before tool dispatch
- Hardcoded tool allowlist (no dynamic tool construction)
- No model-generated arbitrary SQL or Prisma operations
- No mutation capabilities

**Why:** This boundary prevents the entire class of data corruption/deletion vulnerabilities. Any enhancement that weakens this control must be rejected.

### 1.2 Evidence-based contracts (D-01, D-16)
**Core principle:** Results must distinguish SUCCESS, EMPTY, PARTIAL, ERROR, UNKNOWN, INFERENCE.

**Anti-pattern:** `.catch(() => 0)` — Database errors must never become valid business zeros.

**Required discipline:**
```typescript
type ToolResult<T> = 
  | { status: 'SUCCESS', data: T }
  | { status: 'EMPTY', reason: string }
  | { status: 'PARTIAL', data: T, missing: string[] }
  | { status: 'ERROR', error: string }
  | { status: 'UNKNOWN', reason: string }

type CopilotResponse = 
  | { type: 'FACT', data: any, source: string }
  | { type: 'INFERENCE', claim: string, basis: string[] }
  | { type: 'UNKNOWN', query: string }
  | { type: 'RECOMMENDATION', action: string, rationale: string }
```

**Impact:** Eliminates silent failures, enables proper error handling, supports epistemic discipline.

### 1.3 Provider-neutral orchestration (D-13)
**Required:** AI provider fallback must have equivalent evidence/tool access.

**Current gap:** Anthropic fallback has materially weaker capabilities than OpenAI primary.

**Target architecture:**
```
┌─────────────────────────────────────┐
│  Copilot Orchestration Layer       │
│  - Tool dispatch                    │
│  - Evidence collection              │
│  - Result normalization             │
└──────────────┬──────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌──────────┐      ┌──────────┐
│ OpenAI   │      │ Anthropic│
│ Provider │      │ Provider │
└──────────┘      └──────────┘
```

Both providers receive:
- Same tool schemas
- Same evidence context
- Same prompt structure
- Same result contracts

**No degraded-mode operation without explicit user notification.**

### 1.4 Versioned contracts (D-17)
**Required:** Tool schemas, prompt templates, model versions must be versioned and observable.

**Rationale:** Reproducibility, debugging, impact analysis of changes.

**Implementation:**
- Tool schemas: semver (e.g., `getBusinessHealth v2.1.0`)
- Prompt templates: git-tracked with change log
- Model versions: captured in audit log
- Breaking changes require migration plan

### 1.5 Untrusted data handling (D-09, A-6)
**Required:** Database-derived content must be structurally separated from instructions.

**Pattern:**
```typescript
// ❌ WRONG — instruction and data mixed
const prompt = `Analyze this booking: ${JSON.stringify(bookingData)}`

// ✅ RIGHT — structural separation
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userQuery },
  { role: 'system', name: 'evidence', content: JSON.stringify({
      source: 'database',
      untrusted: true,
      data: bookingData
    })}
]
```

**Defense depth:**
- Server-side validation of tool arguments
- Explicit untrusted-data envelope
- Output sanitization before returning to client
- Adversarial staging tests

---

## 2. LAYERED ARCHITECTURE

### 2.1 Layer 1: Correctness Foundation
**Dependencies:** None  
**Deliverables:** D-01, D-02, D-03, D-04, D-07

**Purpose:** Fix proven defects in current tools before building new capabilities.

**Components:**
1. **Tool Result Contract** (D-01)
   - Define `ToolResult<T>` type system
   - Migrate all tools from `.catch(() => 0/[])` to explicit contracts
   - Server-side result envelope before model sees output

2. **Proven defect fixes:**
   - D-02: Health-score failure inversion (add test, confirm impact, fix)
   - D-03: Instructor-risk schema alignment (verify profile coverage, update query)
   - D-04: Expiring-document filter (fix no-op `OR: [{}, {}]`, add fixtures)
   - D-07: Suburb demand sampling (explicit limit/order semantics)

3. **Test harness foundation:**
   - Unit tests for tool correctness
   - Fixtures for edge cases (empty results, DB failures, schema gaps)
   - CI enforcement

**Completion criteria:**
- ✅ Zero `.catch(() => 0/[])` patterns in tool code
- ✅ All D-02/D-03/D-04/D-07 fixes deployed with passing tests
- ✅ Tool correctness test suite passes in CI

### 2.2 Layer 2: Safety & Evaluation
**Dependencies:** Layer 1  
**Deliverables:** D-09, D-15, D-20

**Purpose:** Harden security boundaries and establish regression protection.

**Components:**
1. **Untrusted-data controls** (D-09)
   - Structural separation of evidence from instructions
   - Server-side tool-argument validation
   - Output sanitization
   - Adversarial staging tests (prompt injection attempts)

2. **Evaluation suite** (D-15)
   - Tool selection correctness (given query, verify correct tool chosen)
   - Failure handling (given DB error, verify ERROR status not zero)
   - Permission boundaries (verify unauthorized tools rejected)
   - Representative admin investigations (end-to-end scenarios)
   - Prompt injection boundary tests

3. **Middleware S-7 fix** (D-20)
   - Narrow `/api/auth` public prefix to specific NextAuth routes
   - Or reorder middleware checks (protected paths before public)
   - Add overlap regression test

**Completion criteria:**
- ✅ Staging adversarial tests pass (prompt injection blocked)
- ✅ Evaluation suite runs in CI with 100% pass rate
- ✅ S-7 middleware fix verified

### 2.3 Layer 3: Knowledge Architecture
**Dependencies:** Layer 1, Layer 2  
**Deliverables:** D-11, D-06

**Purpose:** Add authoritative domain knowledge to complement live transactional data.

**Components:**
1. **DriveBook Knowledge Base** (D-11)
   
   **Content domains:**
   - Payment lifecycle: wallet, DIRECT, CREDIT, Stripe/offline mapping
   - Booking lifecycle: states, transitions, cancellation rules
   - Refund/payout: timing, conditions, reversal rules
   - Instructor documents: required types, expiry rules, verification process
   - RBAC/tool boundaries: which roles can access which tools/data
   - Operational definitions: health score meaning, risk classification

   **Structure:**
   ```
   knowledge/
   ├── payment-lifecycle.md
   ├── booking-lifecycle.md
   ├── refund-payout-rules.md
   ├── instructor-documents.md
   ├── rbac-boundaries.md
   ├── operational-definitions.md
   └── version.json
   ```

   **Integration:**
   - Knowledge injected as system context
   - Versioned (semver)
   - Cited in Copilot responses ("per payment lifecycle v2.1.0")
   - Updated through code review, not ad-hoc

2. **Health-score semantics clarification** (D-06)
   - Document what health score means
   - Define edge cases (zero bookings, DB failure, partial data)
   - Expose underlying signals in Copilot output
   - Example: "Health: 72/100 (based on: 10 active bookings, 2 failed payments, 1 expiring license)"

**Completion criteria:**
- ✅ Knowledge base created with all six domains
- ✅ Knowledge versioning system operational
- ✅ Copilot cites knowledge in responses
- ✅ Health-score semantics documented and tested

### 2.4 Layer 4: Investigation Capabilities
**Dependencies:** Layer 1, Layer 2, Layer 3  
**Deliverables:** D-12

**Purpose:** Add entity-level investigation tools after foundational controls are stable.

**Components:**
1. **Entity correlation tools**
   
   **New tools:**
   - `investigateBooking(bookingId)` — booking + related customer + instructor + payments + wallet transactions + Stripe events + audit trail
   - `investigateCustomer(customerId)` — customer + all bookings + payment history + wallet + support tickets
   - `investigateInstructor(instructorId)` — instructor + profile + documents + bookings + revenue + complaints
   - `investigatePayment(paymentId)` — payment + booking + wallet entries + Stripe/offline mapping + reconciliation status

   **Evidence envelope:**
   ```typescript
   {
     entity: 'booking',
     id: 'BK-12345',
     snapshot_time: '2026-09-24T10:00:00Z',
     fields: {
       booking: { ... },
       customer: { id, name, email },  // controlled fields only
       instructor: { id, name },
       payments: [ ... ],
       wallet_transactions: [ ... ],
       audit_log: [ ... ]
     },
     data_classification: {
       public: ['id', 'status'],
       internal: ['customer.email'],
       sensitive: []
     }
   }
   ```

2. **RBAC/data-class controls** (D-18)
   - Map role → tool → fields → data class
   - Server-side field filtering based on caller role
   - Audit all investigation tool uses

**Completion criteria:**
- ✅ Investigation tools implemented with field-level RBAC
- ✅ Evidence envelopes include data-classification metadata
- ✅ All investigation tool uses audited

### 2.5 Layer 5: Model Selection & Optimization
**Dependencies:** Layer 1, Layer 2, Layer 3, Layer 4  
**Deliverables:** D-14, D-10 (preserve)

**Purpose:** Choose AI model based on evidence, not assumptions.

**Components:**
1. **SLO definition** (D-14)
   
   **Quality SLOs:**
   - Tool selection accuracy: >95% correct tool for query
   - Correctness: >98% factually accurate responses
   - Hallucination rate: <2% of responses contain invented data
   
   **Latency SLOs:**
   - p50: <2s for simple queries
   - p95: <5s for complex multi-tool investigations
   - p99: <10s
   
   **Cost SLOs:**
   - Target: <$0.10 per query average
   - Monitor: tokens in/out, model cost, tool execution cost
   
   **Reliability SLOs:**
   - Availability: >99.5% (excluding planned maintenance)
   - Fallback success rate: >90% when primary provider fails

2. **Benchmark suite**
   - Representative admin queries (50+ real scenarios)
   - Correctness scoring against ground truth
   - Latency measurement
   - Cost tracking
   - Run against: current gpt-4o-mini, gpt-4o, claude-3.5-sonnet, others

3. **Model decision**
   - Evidence-based comparison
   - Document tradeoffs
   - No "upgrade because newer" without proof

**Completion criteria:**
- ✅ SLOs defined and baselined
- ✅ Benchmark suite operational
- ✅ Model comparison complete with evidence
- ✅ Model selection documented with rationale

---

## 3. CROSS-CUTTING CONCERNS

### 3.1 Observability (D-17)
**Throughout all layers:**
- Capture model/prompt/tool versions in audit log
- Track latency, cost, error rates per tool
- Alert on anomalies (sudden error rate increase, cost spike)
- Dashboard: Copilot health metrics

### 3.2 Testing strategy (D-15 enhancement per Kiro Phase 4)
**Per-layer test requirements:**

**Layer 1:**
- Unit: Each tool returns correct SUCCESS/EMPTY/ERROR
- Integration: DB failure scenarios
- Edge: Zero records, schema gaps, concurrent modifications

**Layer 2:**
- Security: Prompt injection attempts blocked
- Regression: All evaluation suite scenarios pass
- Boundary: Unauthorized tool access rejected

**Layer 3:**
- Knowledge: Version changes don't break responses
- Semantics: Health score edge cases return expected results

**Layer 4:**
- RBAC: Field-level filtering enforced
- Investigation: Entity correlation returns complete evidence

**Layer 5:**
- Benchmark: Model performance meets SLOs
- Fallback: Provider switching works without degradation

### 3.3 Evidence gates (D-05, D-18, D-19, S-1)
**These decisions are blocked pending external evidence:**

**D-05 (Revenue semantics):** Cannot finalize revenue tool until:
- ✅ Authoritative financial definition of "revenue" vs "wallet credit"
- ✅ Production DIRECT-mode payment coverage measured
- ✅ Accounting team confirms ledger semantics

**D-18 (RBAC/data scope):** Cannot finalize investigation tools until:
- ✅ Role → permission → tool → fields mapping documented
- ✅ Data classification schema defined
- ✅ Security review of field-level access

**D-19 (AuditLog governance):** Cannot finalize Copilot audit retention until:
- ✅ Legal/compliance retention requirements defined
- ✅ Redaction requirements for sensitive queries
- ✅ Access audit policy established

**S-1 (Credentials):** Cannot close security finding until:
- ✅ Provider dashboards checked for liveness
- ✅ If live: rotated + history purged
- ✅ If not live: documented as test data

**Handling:** Evidence gates do not block other layers. Work proceeds on unblocked items. Gated decisions remain OPEN until evidence provided.

---

## 4. MIGRATION STRATEGY

### 4.1 Backward compatibility
**Tool contract migration:**
- Old tools continue to work during Layer 1 implementation
- Dual-mode operation: new tools use `ToolResult<T>`, old tools wrapped in adapter
- Model sees normalized `ToolResult<T>` regardless of implementation
- Remove adapters only after all tools migrated

### 4.2 Incremental deployment
**Per-layer rollout:**
1. Layer 1: Deploy behind feature flag, validate with internal users
2. Layer 2: Staging adversarial tests, then production
3. Layer 3: Knowledge base v1.0.0, iterate based on Copilot responses
4. Layer 4: Investigation tools released to subset of admins, monitor RBAC
5. Layer 5: Benchmark, decide, deploy new model (if justified)

### 4.3 Rollback plan
**Each layer must be independently rollback-able:**
- Feature flags control new capabilities
- Old tool implementations preserved until migration verified
- Model version pinned, can revert to previous version
- Knowledge base versioned, can roll back to earlier version

---

## 5. SUCCESS METRICS

### 5.1 Correctness
- **Zero** error-masking patterns (`.catch(() => 0)`) in production
- **>98%** tool correctness rate (evaluation suite)
- **100%** of proven defects (D-02, D-03, D-04, D-07) fixed and tested

### 5.2 Safety
- **Zero** prompt injection exploits in staging tests
- **100%** evaluation suite pass rate in CI
- **Zero** unauthorized tool access attempts succeed

### 5.3 Capability
- **Knowledge base covers** all six domains with version 1.0.0
- **Investigation tools available** for booking/customer/instructor/payment
- **RBAC enforcement** at field level verified

### 5.4 Quality
- **Meets or exceeds** defined SLOs (quality, latency, cost, reliability)
- **Model selection justified** with benchmark evidence
- **Provider fallback** degrades gracefully without silent failures

### 5.5 Engineering discipline
- **All changes** follow FINDING → VERIFIED → FIX → FIX-VERIFIED → CLOSED
- **No architectural controls weakened** (read-only boundary preserved)
- **Evidence gates** explicitly tracked and resolved

---

## 6. TIMELINE ESTIMATE

**Assumptions:**
- Single full-time engineer
- Part-time product/security review
- Evidence gates resolved in parallel

**Layer 1 (Correctness):** 2-3 weeks
- Tool contract definition: 3 days
- Migration of 10-15 existing tools: 1-1.5 weeks
- Test harness: 3-4 days
- Proven defect fixes: 3-4 days

**Layer 2 (Safety):** 2 weeks
- Untrusted-data controls: 1 week
- Evaluation suite: 4-5 days
- S-7 middleware fix: 2 days

**Layer 3 (Knowledge):** 2-3 weeks
- Knowledge base creation: 1.5-2 weeks (requires domain expert input)
- Integration: 3 days
- Health-score clarification: 2 days

**Layer 4 (Investigation):** 2-3 weeks
- Entity correlation tools: 1.5 weeks
- RBAC/field-level controls: 1 week
- Audit integration: 2-3 days

**Layer 5 (Model):** 1-2 weeks
- SLO definition: 2 days
- Benchmark suite: 3-4 days
- Model comparison: 3-4 days
- Decision/deployment: 2 days

**Total sequential:** 9-13 weeks

**With parallelization (Layer 3 knowledge gathering while Layer 1/2 proceed):** 7-10 weeks

**Evidence gate resolution:** Parallel, depends on stakeholder availability

---

## 7. RISKS & MITIGATION

### 7.1 Risk: Evidence gates block Layer 4
**Impact:** Investigation tools cannot be finalized without D-18 RBAC/data mapping  
**Mitigation:** Implement tools with conservative field filtering, refine after mapping complete

### 7.2 Risk: Knowledge base becomes stale
**Impact:** Copilot cites outdated business rules  
**Mitigation:** Version knowledge base, establish update process, monitor for knowledge drift

### 7.3 Risk: Model benchmark shows current model optimal
**Impact:** No model change justified, but time spent on benchmark  
**Mitigation:** This is a GOOD outcome — evidence that current choice is correct. Benchmark is not wasted work.

### 7.4 Risk: Layer 1 migration breaks existing functionality
**Impact:** Admin Copilot degrades or fails during tool contract migration  
**Mitigation:** Dual-mode operation, adapter layer, feature flags, incremental rollout

### 7.5 Risk: Prompt injection staging tests reveal exploitable vulnerabilities
**Impact:** Must pause capability expansion until fixed  
**Mitigation:** This is EXPECTED and DESIRABLE. Better to find in staging than production. Layer 2 exists for this reason.

---

## 8. GOVERNANCE

### 8.1 Approval gates
**Architecture decisions require approval for:**
- Changes weakening read-only boundary → **Security lead sign-off**
- New tool with sensitive data access → **RBAC review + audit**
- Model change → **Benchmark evidence + cost impact analysis**
- Knowledge base updates → **Domain expert review + version tag**

### 8.2 Change discipline
**All changes follow:** `FINDING → VERIFIED → FIX → FIX-VERIFIED → CLOSED`

**No shortcuts:**
- No "quick fixes" without tests
- No "this is obviously better" without benchmark
- No "just this once" bypass of RBAC review

### 8.3 Audit trail
**Capture and retain:**
- All Copilot queries and responses (subject to D-19 policy)
- Tool selection and execution
- Model/prompt/tool versions used
- Evidence sources cited
- RBAC decisions (which tools accessed by which roles)

---

## 9. HANDOFF TO IMPLEMENTATION

**Next document:** `PRIORITY-BACKLOG.md` — breaks this architecture into prioritized engineering tasks

**Prerequisites before implementation starts:**
- ✅ This architecture plan reviewed and approved
- ✅ Engineer capacity allocated
- ✅ Evidence gate stakeholders identified
- ✅ Test/staging environment verified

**Success criteria for implementation:**
- Each layer's completion criteria met
- All changes tested and verified
- Evidence gates resolved or explicitly deferred
- No architectural controls weakened
- Read-only boundary preserved

---

**Architecture Plan Status:** APPROVED TO PROCEED  
**Next Action:** Create `PRIORITY-BACKLOG.md` with sequenced engineering tasks
