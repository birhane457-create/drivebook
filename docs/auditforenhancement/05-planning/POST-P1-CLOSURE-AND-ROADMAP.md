# Post-P1 Closure Gate and Roadmap

**Status:** Planning baseline
**Date:** September 25, 2026
**Branch:** `audit/ai-enhancement-multimodel`

## Authoritative P1 State

- P1-01 through P1-10: `FIX-VERIFIED`.
- P1-08: authoritative 144-test regression baseline.
- P1-10: 67/67 evaluation cases, CI-integrated.
- Live OpenAI/Anthropic tool-selection accuracy: intentionally unverified.
- No P1 item is `CLOSED`.
- Project closure: deferred.

`FIX-VERIFIED` is an evidence state. It is not the same as `CLOSED` and does not by itself authorize merging to `main`.

## Closure-Gate Track

Closure evidence is separate from new P2/P3 engineering. The gate is complete only when every item below has a named artifact, reviewer, and disposition.

| Gate | Required evidence | Status |
| --- | --- | --- |
| P0 security | All P0 security items independently evidenced, including credential/security-track disposition | OPEN |
| P1 verification | P1-01 through P1-10 independently verified; P1-08 count remains 144 | COMPLETE |
| Regression | Complete regression suite passes from the post-rebase tree | OPEN |
| Rebase | Latest `main` is rebased or merged into the audit branch | OPEN |
| Conflict review | Shared-file conflicts are resolved and reviewed | OPEN |
| Re-verification | P0/P1 evidence is rerun after rebase and conflict resolution | OPEN |
| Read-only boundary | Server authorization, allowlist, argument validation, and no-mutation boundary remain preserved | OPEN |
| Documentation | Trackers, evidence records, decisions, and backlog are reconciled | OPEN |
| Evidence gates | Revenue, RBAC/data classification, AuditLog governance, and credential liveness are explicitly dispositioned | OPEN |

### Closure procedure

1. Resolve or explicitly disposition each P0 security and external evidence dependency.
2. Rebase or merge the latest `main` into `audit/ai-enhancement-multimodel`.
3. Review all conflicts in shared application and documentation files.
4. Run the complete regression suite and the authoritative P1-08/P1-10 checks.
5. Re-verify the read-only boundary and all affected P0/P1 evidence after the rebase.
6. Update both tracker documents and attach the final evidence index.
7. Only after every gate is complete may the project be considered for merge and closure.

Known external or evidence dependencies are the credential/security track, revenue semantics (D-05), RBAC/data classification (D-18), and AuditLog governance (D-19). An unresolved dependency must remain `OPEN`, with an owner and disposition, rather than being silently treated as passed.

## Post-P1 Engineering Track

New engineering starts only after the relevant closure/evidence decision is recorded. The established sequence is:

### P2-01 — DriveBook Knowledge Base

Create versioned domain knowledge for bookings, payments, refunds, payouts, RBAC, instructor compliance, and operational rules. The knowledge layer must be provider-neutral and cite its version in model-facing use.

### P2-02 — Revenue Semantics Evidence Gate

Resolve and document the financial definitions of revenue, wallet credit, failed payment, cancellation loss, and payout before exposing stronger financial conclusions. This is a stakeholder evidence gate, not an implementation assumption.

### P2-04 — RBAC/Data-Classification Evidence Gate

Formalize role -> permission -> tool -> fields -> data-class boundaries and obtain Product/Security approval before adding investigation capabilities.

### P2-03 — Provider-Neutral Orchestration / Anthropic Parity

Ensure fallback providers receive equivalent tool schemas, evidence context, prompt constraints, and result contracts. Test fallback behavior and monitor provider use without silent degradation.

### Investigation Tools

Only after P2-04 is approved should booking, customer, instructor, or payment investigation tools be added to the current read-only set. Each tool requires field-level RBAC, data-classification metadata, audit logging, and focused tests.

## Separate Model-Evaluation Track

Live-model quality is intentionally outside the P1-10 deterministic seam. It must be evaluated separately:

1. **P3-01 — SLOs:** define quality, latency, reliability, cost, refusal, and tool-selection metrics.
2. **P3-02 — Benchmark:** run a pinned, provider-neutral benchmark with ground truth and recorded model/provider versions.
3. **P3-03 — Model selection:** choose a model only from benchmark evidence and documented tradeoffs.

The P1-10 suite must not be presented as empirical proof of OpenAI or Anthropic tool-selection accuracy.

## Recommended Order

`Closure-gate specification -> P0/evidence resolution -> P2-01 Knowledge Base -> P2-02/P2-04 evidence gates -> P2-03 provider parity -> investigation tools -> P3 model benchmark`

P1 should not be reopened unless new evidence identifies a regression.
