# DECISIONS.md — Final Coordinator Decision

**Audit:** DriveBook Admin Copilot enhancement audit  
**Basis:** GPT, Kimi, Claude and Kiro Phase 1 audits; Phase 2 cross-review; Phase 3 reconciliation; coordinator consolidation; Kiro Phase 4 challenge `ff6cd372`.

## 1. Final audit decision

**RECONCILIATION COMPLETE.**

The evidence is sufficiently reconciled to move from audit into architecture/implementation planning.

This does **not** mean every evidence gap is closed. Open production, provider-dashboard and business-policy questions remain explicitly gated.

No application-code change is authorized by this audit document. Remediation must use:

`FINDING → VERIFIED → FIX → FIX-VERIFIED → CLOSED`

## 2. Decisions

### D-01 — Tool failure contract
**FIX REQUIRED.** Replace silent database fallbacks such as `.catch(() => 0/[])` with an explicit result contract: SUCCESS, EMPTY, PARTIAL, ERROR. An ERROR must never become a valid business zero.

### D-02 — Health-score failure inversion
**FIX REQUIRED; severity remains impact-dependent.** A failed `failedPayments` query must not improve the score. Add a regression test and confirm whether the score drives operational decisions before assigning final CRITICAL/HIGH severity.

### D-03 — Instructor-risk schema alignment
**FIX REQUIRED.** Read expiry data from `DrivingProviderProfile`, after verifying approved-provider/profile coverage.

### D-04 — Expiring-document filter
**FIX REQUIRED.** Replace the no-op filter and add boundary-date fixtures.

### D-05 — Revenue semantics
**EVIDENCE GATE.** Establish the authoritative financial definition of revenue/failed payment and determine production DIRECT-mode coverage before redesigning revenue tools.

### D-06 — Health-score semantics
**CLARIFY/REDESIGN.** Define edge cases and expose underlying signals/calculation rather than presenting an unexplained composite as ground truth.

### D-07 — Suburb demand sampling
**FIX REQUIRED, MEDIUM.** Make sampling/truncation visible and deterministic where appropriate.

### D-08 — Duplicate retention query
**LOW-PRIORITY OPTIMISATION.** Remove duplicated work when the tool is next modified.

### D-09 — Prompt injection/untrusted data
**FIX REQUIRED BEFORE CAPABILITY EXPANSION.** Structurally separate database-derived content from instructions, apply explicit untrusted-data handling, and test adversarially in staging. Reachability is verified; successful exploitation is not.

### D-10 — Read-only boundary
**PRESERVE.** Keep server-side authorization, hardcoded read-only tool dispatch and the prohibition on model-generated arbitrary SQL/Prisma or mutations.

### D-11 — DriveBook knowledge layer
**BUILD.** Create a versioned authoritative domain-knowledge layer for payment lifecycle, booking lifecycle, refunds/payouts, instructor-document rules, RBAC/tool boundaries and operational definitions. Live transactional data remains authoritative for live facts.

### D-12 — Entity investigation
**BUILD AFTER FOUNDATIONAL CONTROLS.** Add case/entity correlation across relevant booking, customer, package, payment, wallet, Stripe/webhook and audit records with explicit field/data-class controls.

### D-13 — Fallback parity
**FIX REQUIRED.** Equalize evidence/tool access across providers or explicitly surface degraded mode. Prefer provider-neutral orchestration.

### D-14 — Model selection
**BENCHMARK FIRST.** Define quality, latency, cost and reliability SLOs and benchmark the current model against candidates. Do not choose a model by recency or assumption.

### D-15 — Evaluation suite
**BUILD.** Establish blocking regression tests for tool selection, failure handling, correctness, permissions, prompt injection and representative admin investigations.

### D-16 — Epistemic response discipline
**BUILD.** Distinguish verified fact, inference, unknown/unavailable information and recommendation. This depends on D-01.

### D-17 — Versioning/observability
**BUILD.** Version tool contracts and capture model/prompt/tool versions sufficient to reproduce Copilot behavior.

### D-18 — RBAC/data scope
**EVIDENCE GATE.** Map role → permission → tool → returned fields → data class and confirm intended authorization.

### D-19 — AuditLog governance
**EVIDENCE GATE.** Establish retention, access and redaction requirements for Copilot audit records.

### D-20 — Middleware S-7
**VERIFIED, MEDIUM, FIX.** Kiro's Phase 4 second read confirms the defence-in-depth gap. Narrow the public `/api/auth` prefix or ensure protected paths are evaluated first, and add overlap regression coverage. Existing handler authentication prevents classifying this audit finding as a demonstrated active takeover.

### D-21 — Separate platform security
**KEEP OUT-OF-BAND.** S-1 through S-9 remain on the security lifecycle. S-1 credential-looking values and S-8 development credentials are distinct artifacts. Never test suspected credentials by attempting authentication.

## 3. Implementation gates

1. **Security track:** handle credential/platform findings separately.
2. **Data correctness:** implement SUCCESS/EMPTY/PARTIAL/ERROR and prove it with tests.
3. **Current Copilot correctness:** remediate C-2/C-3/C-5 and C-1a; complete C-4 evidence.
4. **Safety/evaluation:** untrusted-data controls, S-7 fix, server-side validation and blocking evaluation suite.
5. **Knowledge/schema architecture:** versioned domain knowledge, tool contracts and provider-neutral evidence envelopes.
6. **Investigation:** entity-level correlation after foundational controls.
7. **Model decision:** benchmark only after SLOs are defined.

## 4. Explicitly not decided

- No specific newer model is selected.
- Wallet credits are not assumed to equal accounting revenue.
- Prompt-injection exploitation is not claimed without staging evidence.
- Persistent memory is not mandated.
- No write capability is approved.
- Open production/business evidence is not silently treated as closed.

## 5. Final status

**AUDIT RECONCILIATION: COMPLETE**

**ARCHITECTURE/IMPLEMENTATION PLANNING: APPROVED TO PROCEED**

**APPLICATION REMEDIATION: NOT YET VERIFIED/CLOSED**

Next work product: `AI-ARCHITECTURE-PLAN.md` and `PRIORITY-BACKLOG.md`, followed by individual findings entering the normal remediation lifecycle.
