# GPT Phase 3 — Evidence Reconciliation

Status: PHASE 3 — GPT reconciliation
Branch: main
Main HEAD verified before writing: af784efbd74aa04780de8fdd3eea16541327a7b1
Application code changed by this document: NO

## Purpose

Phase 1 produced independent audits. Phase 2 produced cross-reviews. Phase 3 separates verified source facts, runtime facts, production facts, evidence gaps, architectural enhancements, out-of-scope findings, and positive controls. Model agreement is supporting evidence, not proof.

## Snapshot integrity

All four Phase 1 audit files and four Phase 2 reviews are present on main.

Kimi's Phase 2 document explicitly says it did not have direct repository access. Its overlap with GPT therefore is not independent code corroboration. Phase 3 must not count four model votes where only GPT, Claude and Kiro inspected repository evidence.

Kiro's Phase 2 cites commit 6ed899ce, while current main HEAD is af784efbd74aa04780de8fdd3eea16541327a7b1. Runtime and production claims must be rechecked against current HEAD before closure.

## Reconciled findings

| ID | Claim | Disposition | Evidence status |
|---|---|---|---|
| E-01 | Tool DB failures become zero/empty | ACCEPT — FIX REQUIRED | Verified source defect |
| E-02 | Health-score failure can improve score | ACCEPT — separate critical case | Verified source logic; impact still verify |
| E-03 | Instructor-risk queries removed fields from wrong table | ACCEPT — FIX REQUIRED | Verified source + migration evidence |
| E-04 | expiringCount filter is a no-op | ACCEPT — FIX REQUIRED | Verified source logic |
| E-05 | DB content reaches model without explicit untrusted-data framing | ACCEPT — FIX REQUIRED | Verified data flow; exploit unverified |
| E-06 | Read-only Copilot boundary | POSITIVE CONTROL | Verified source |
| E-07 | Copilot knowledge layer absent | ACCEPT — ARCHITECTURAL GAP | Capability/architecture finding |
| E-08 | Stronger/newer model is required | REJECT AS UNPROVEN | No benchmark evidence |
| E-09 | AI evaluation suite needed | ACCEPT — SEQUENCED ENHANCEMENT | Architecture requirement |
| E-10 | Fallback provider has weaker evidence/tool access | ACCEPT — FIX/VERIFY | Source finding |
| E-11 | Persistent memory is a security defect | REJECT | Capability/architecture issue |
| E-12 | Conversation history needs server validation | ACCEPT — SECURITY HARDENING | Source finding |
| E-13 | Tool arguments need independent runtime validation | ACCEPT — SECURITY HARDENING | Source/architecture finding |
| E-14 | Copilot data scope needs explicit role/tool/field mapping | ACCEPT — SECURITY GOVERNANCE | Needs scope verification |
| E-15 | Copilot can accelerate bulk data access | ACCEPT — THREAT MODEL ITEM | Reasoned risk |
| E-16 | AuditLog retention unclear | NEEDS EVIDENCE | Policy/cleanup not yet verified |
| E-17 | Wallet CREDIT equals revenue | NEEDS EVIDENCE | Accounting semantics unverified |
| E-18 | DIRECT providers may be omitted from wallet revenue | NEEDS EVIDENCE | Depends on production data |
| E-19 | Health score approved=0 edge case | ACCEPT — CORRECTNESS/DEFINITION | Source logic per Kiro |
| E-20 | Suburb demand silently samples 500 | ACCEPT — CORRECTNESS | Source finding per Kiro |
| E-21 | Retention query duplicated | ACCEPT — LOW OPTIMISATION | Source finding |
| E-22 | __ping__ consumes AI/rate-limit/audit resources | ACCEPT — LOW/MEDIUM OPS | Source flow |
| E-23 | Rate-limit documentation says 20 while implementation is 30 | NEEDS EVIDENCE / DOC MISMATCH | Source mismatch |
| E-24 | Anthropic API key absent from env example | NEEDS EVIDENCE | Config/doc gap |
| E-25 | Prompt/model version observability missing | ACCEPT — ENHANCEMENT | Architecture reasoning |
| E-26 | FACT/INFERENCE/UNKNOWN/RECOMMENDATION discipline needed | ACCEPT — ENHANCEMENT | Architecture reasoning |
| E-27 | Entity/case investigation tool needed | ACCEPT — ENHANCEMENT | Capability gap |
| E-28 | Credential checklist may contain unrotated secrets | SEPARATE SECURITY TRACK | Requires verification/rotation |
| E-29 | Root .credentials contains dev credentials | SEPARATE DEV-HYGIENE TRACK | Verify against current HEAD |
| E-30 | Claude voice/SMS/account/booking findings | OUT OF AI-COPILOT SCOPE | Separate platform-security audit |

## Priority

### Immediate security

1. Resolve the two credential artifacts separately.
2. Verify Copilot data scope and sensitive-field exposure.
3. Validate model-supplied tool arguments and request history.
4. Add untrusted-data framing and adversarial injection tests.

### Immediate correctness

1. E-01 tool-error contract.
2. E-02 health-score failure inversion.
3. E-03 instructor-risk schema alignment.
4. E-04 expiring-document logic.
5. E-19 health-score boundary semantics.
6. E-20 suburb sampling correctness.

### Architecture/enablers

1. Versioned tool-result schemas.
2. Authoritative DriveBook knowledge layer.
3. Provider-neutral evidence contract.
4. Baseline evaluation suite.
5. FACT/INFERENCE/UNKNOWN/RECOMMENDATION response discipline.
6. Investigation/case-correlation tools.

### Benchmark

Do not select a stronger model merely because an auditor suggested it. Define answer correctness, evidence grounding, correct UNKNOWN/ERROR behaviour, injection resistance, p95 latency, cost ceiling, and tool-call distributions. Benchmark the deployed model against candidates using identical DriveBook cases and tool contracts.

## Settled enough to proceed

- Silent tool-failure masking is a real defect.
- Instructor-risk query is out of alignment with current schema/migrations.
- Expiring-document filter is logically broken.
- Untrusted database content can reach model context.
- The read-only server-side boundary is a positive control and must remain intact.

## Not settled

- Exact severity of every finding.
- Whether wallet credits are recognised revenue.
- Whether DIRECT payment mode creates a production revenue gap.
- Whether external AuditLog retention exists.
- Whether the current model is insufficient.
- Whether prompt injection is successfully exploitable.
- Whether credential checklist values are live.
- Whether production configuration differs from current source.

## Required evidence tasks

EG-01 — Schema/runtime: controlled fixtures for instructor-risk and expiry queries.

EG-02 — Production coverage: DrivingProviderProfile coverage for approved instructors.

EG-03 — Revenue doctrine: WalletTransaction, DIRECT flow, Stripe payments and ledger semantics.

EG-04 — Copilot scope: role → permission → tool → fields → data-class matrix.

EG-05 — Security: verify credential artifacts without authenticating with exposed values; rotate if required.

EG-06 — Retention: verify AuditLog retention policy and cleanup mechanism.

EG-07 — Injection: staging adversarial tests using controlled database/provider text.

EG-08 — Benchmark: define SLO/cost envelope and build a small DriveBook-specific eval set.

## Phase 3 conclusion

The multi-model method produced useful signal, but the correct output is not a majority vote. The strongest result is separating facts already proven by source evidence from claims requiring runtime, production, security, accounting or benchmark evidence.

No application code has been changed by this reconciliation document.

Next safe action: execute EG-01 through EG-08 against the current main snapshot, record evidence, and only then convert verified findings into implementation tasks.
