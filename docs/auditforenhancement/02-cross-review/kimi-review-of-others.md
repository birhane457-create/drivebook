# Kimi Cross-Review of Other Audits — DriveBook AI Enhancement

**Reviewer:** Kimi (Moonshot AI)
**Phase:** 2 — Cross-review
**Date:** 2026-09-23
**Branch:** `audit/ai-enhancement-multimodel`

---

## 0. Snapshot Verification (mandatory header — per amended AUDIT-RULES)

> **Rule added after a real incident:** one auditor read a stale branch view and concluded
> the Phase 1 reports did not exist. Every cross-review must therefore begin by declaring
> the exact snapshot it reviewed. *A cross-review cannot proceed from an unverified repository snapshot.*

| Auditor (this file) | Branch | Commit SHA inspected | File SHAs | Snapshot status |
| --- | --- | --- | --- | --- |
| Kimi | `audit/ai-enhancement-multimodel` | **NONE — no repo access from my environment** | gpt-audit.md: full text received via upload (conversation); claude-audit.md: **NOT INSPECTED**; kiro-audit.md: **NOT INSPECTED** | ⚠️ PARTIAL — GPT review valid; Claude/Kiro sections locked until files are provided |

**Consequence:** Sections 2 (Claude) and 3 (Kiro) below are LOCKED placeholders containing no
fabricated positions. They will be completed only from the actual committed files, with their
commit SHAs recorded here at completion time.

**Relayed state (unverified by me, per coordinator message 2026-09-23 20:54 +08:00):**
GPT `72e9ce0f` · Kimi `9cc30f7a` · Claude `67c7b867` · Kiro `de0a6599` · GPT cross-review `8dd7aa02`.
Coordinator confirms all four Phase 1 audits substantive and **Phase 1 LOCKED** — no auditor
should rewrite Phase 1 after seeing others' reports.

## 1. Review of `gpt-audit.md` (GPT — baseline audit)

### 1.1 Agreements (and whether I independently reached the same finding)

| GPT finding | My position | Comment |
| --- | --- | --- |
| AI-01 No DriveBook knowledge layer (HIGH) | **Agree — independent** (K-C1) | Root-cause finding. GPT's consequence example ("why was this booking rejected?") is exactly right: data access ≠ rule interpretation. |
| AI-02 Model choice limits reasoning (HIGH) | **Partially agree — independent** (K-A3) | Agree on benchmarking *approach*. Disagree on anchoring: "GPT-5.6 / Luna / Sol" is **[UNVERIFIED]** — must be checked against OpenAI's live docs before it anchors the plan. Severity is HIGH as a *planning gap*, not as a model deficiency. gpt-4o-mini vs. alternatives is a bench question, not a known answer. |
| AI-03 Tool layer too shallow (HIGH) | **Agree — independent** (K-C2) | GPT's `investigateBooking()` walk (Booking→Customer→Package→Payment→Wallet→Stripe→Webhook→Availability→Slot→Approval→Audit) is the correct target shape. This is the single highest-value capability addition. |
| AI-04 Error-swallowing → false "zero" data (HIGH) | **Agree — independent** (K-A1) | Strongest finding in the whole audit. I additionally require the model to surface ERROR/PARTIAL as "unverifiable" (UNKNOWN), not just carry a status field. |
| AI-05 Instructor-risk schema drift (HIGH — VERIFY) | **Agree — independent** (K-C3) | GPT is right to flag it and right to mark it unverified. My addition: a concrete verification method (diff Prisma queries vs. schema.prisma + fixture run), because "Kiro should check" without a method can produce a second unverified opinion instead of a fact. |
| AI-06 Health score ≠ ground truth (MEDIUM/HIGH) | **Agree — independent** (K-A6) | I'd rate MEDIUM only. The double-interpretation problem is real but bounded: the score is advisory, and raw-signal exposure fixes it. Calling it MEDIUM/HIGH dilutes the HIGH tier. |
| AI-07 Conversation memory temporary (MEDIUM) | **Agree — independent** (K-A5) | Correct, and correctly not over-rated. GPT's own reasoning (knowledge layer subsumes this) matches mine. |
| AI-08 No AI evaluation system (HIGH) | **Agree with the goal — disagree with the priority** (K-C4) | Eval suite is essential but *sequencing-dependent*: grading the model against tools that can silently return garbage zeroes (AI-04) measures noise. Contracts + knowledge layer first, evals after. I'd also define metrics (evidence-citation rate, UNKNOWN-when-appropriate rate, injection-resistance rate) so "smarter" is measurable. |
| AI-09 Prompt injection / untrusted data (HIGH) | **Agree — independent** (K-B1) | GPT's "DATABASE CONTENT = DATA ≠ INSTRUCTIONS" rule is correct. My additions: structural delimiter framing per tool result, and an output gate so answers can't relay action-requests found in DB text. |
| AI-10 Fallback materially weaker (MEDIUM) | **Agree — independent** (K-A4) | GPT documents the asymmetry well. My addition: consider failing closed instead of answering in a silently-degraded mode — an admin acting on incomplete fallback output is an operational risk. At minimum, label degraded mode in UI + system prompt. |
| AI-11 Query logging privacy (MEDIUM) | **Agree — independent** (K-B3) | Logging is right; policy is missing. I'd add: store tool-schema hash per log entry (ties to K-A2) for replay/debugging. |
| AI-12 `__ping__` probe (LOW) | **Agree** | Trivial. `GET /api/admin/ai/status` is obviously correct. No dispute. |
| AI-13 No confidence mechanism (MEDIUM) | **Agree — independent** (K-A7) | FACT / INFERENCE / RECOMMENDATION / UNKNOWN discipline is the right shape and composes with AI-04. |
| AI-14 Read-only boundary (POSITIVE) | **Agree — independent** (K-B5) | Preserve. Resist all write-tool pressure; any future human-in-the-loop action must be enforced server-side, never model-side. |

**Net: 14/14 substantive agreement, with priority/severity adjustments.** No finding of mine is contradicted by GPT's audit; the overlap on AI-04/AI-09/AI-01 should be treated as convergent detection, not double-counted confidence — both audits read the same second-hand code description.

### 1.2 Disagreements (explicit)

**D-1: Severity inflation in GPT's audit.**
Eight of fourteen findings marked HIGH. Impact: the backlog cannot be sequenced from it. My re-rating (evidence-weighted):

- **HIGH, fix first:** AI-04 (contracts), AI-09 (injection), AI-01 (knowledge layer), AI-03 (investigation tool), AI-05 *only if confirmed* (schema drift).
- **HIGH as planning gap, not code defect:** AI-02 (needs SLO + benchmark before any model change).
- **MEDIUM:** AI-06, AI-07, AI-08 (sequenced dependency), AI-10, AI-11, AI-13.
- **LOW:** AI-12.
- **OUT OF BAND (SECURITY TRACK):** the credential exposure — GPT buried a potential P0 in a closing paragraph. It outranks every AI finding and needs an owner + deadline now.

**D-2: "GPT-5.6 / Luna / Sol" catalog claim.**
GPT asserts specific current model names/capabilities. I could not verify these; they must be confirmed against OpenAI's live documentation. If wrong, the benchmark plan's framing changes (though the bench-*against-real-cases* methodology survives intact). GPT should label this finding's factual premise as unverified in the master matrix.

**D-3: Architecture diagram presented as a design.**
GPT's layered diagram is a picture of components it just told us are missing. Useful as a north star; not an architecture. I'd rather see it replaced in the final plan with: data flow (what the model can reach), contract boundaries (tool schemas), and the knowledge-layer versioning model.

### 1.3 Findings I withdraw

None. No GPT finding is wrong; several are mis-prioritised (D-1), which is a calibration difference, not a withdrawal trigger.

### 1.4 Findings I strengthen

- **AI-04 → K-A1+K-A2:** strengthen with a *versioned JSON-Schema-per-tool* requirement and schema-hash logging, so eval cases and prompts don't silently break when shapes evolve.
- **AI-09 → K-B1:** strengthen with an **output gate** — the Copilot's final answer must never relay imperative text found inside DB content, even in quotes. GPT stated the input-side rule; the output side is equally exploitable.
- **AI-11 → K-B3 + K-B2:** strengthen into a broader *exfiltration* concern: the Copilot lowers the skill floor for large-scale reads. Rate-limit scope is unverified; per-admin budgets + anomaly alerting needed.

### 1.5 Findings I believe GPT missed

| ID | Finding | Basis |
| --- | --- | --- |
| K-A2 | Versioned, typed tool-result schemas | `[REASONED]` Eight ad-hoc tool shapes = eval instability and silent breakage |
| K-A3 | Latency/cost SLO undefined | `[REASONED]` "Which model?" is unanswerable without a budget envelope |
| K-B2 | Copilot as exfiltration accelerator | `[REASONED]` Read-only ≠ low-risk; natural-language aggregates at scale |
| K-A4b | Fallback fail-closed alternative | `[REASONED]` Silently-degraded answers can drive admin action |

### 1.6 Evidence that would change my position

- **On D-1:** if the DriveBook team confirms that several HIGH findings are already partially mitigated in code (e.g., typed error handling exists in newer commits), the severity table should be regenerated from code, not from either audit.
- **On D-2:** OpenAI live docs confirming/denying the named models. If confirmed, I upgrade AI-02's premise to verified and the benchmark plan stands as written.
- **On AI-05:** the schema-diff result. If fields are confirmed in sync, I downgrade K-C3 to LOW and close it in CLAIMS-MATRIX.

### 1.7 My position after reviewing GPT (final for this section)

GPT's audit is **directionally sound, methodologically weak on calibration**. I stand behind all 14 of its findings as real, but behind only 5 as genuinely HIGH. The credential exposure must leave the AI track. The single most important shared finding remains AI-04: **an AI that cannot distinguish "zero" from "unknown" will eventually state a falsehood with full confidence** — and in an admin operations tool, someone will act on it.

---

## 2. Review of `claude-audit.md` (Claude)

**PENDING — file not accessible in my environment at time of writing.**

Required before completion (do not summarise — read the actual file):

- [ ] Agreements/disagreements per finding
- [ ] Any Claude findings not in GPT's or my set
- [ ] Claude's severity calibration vs. mine
- [ ] Evidence claims Claude marks as verified vs. asserted

## 3. Review of `kiro-audit.md` (Kiro)

**PENDING — file not accessible in my environment at time of writing.**

Kiro's audit carries extra weight because it can inspect the actual repository (GPT's and mine are document-based). Priority checks:

- [ ] Kiro's verification result on AI-05 (schema drift) — this should be treated as authoritative over both document-based audits
- [ ] Kiro's verdict on the credential-exposure finding (real vs. redacted/fake)
- [ ] Any production-code facts that contradict `[DOC]` findings in GPT's or my audit

---

## 4. Phase 2 Summary (Kimi)

| Item | Count/Status |
| --- | --- |
| GPT findings reviewed | 14/14 |
| Full agreement (with calibration notes) | 14 |
| Explicit disagreements | 3 (D-1 severity, D-2 unverified premise, D-3 diagram-as-design) |
| Withdrawals | 0 |
| Strengthenings | 4 |
| GPT-missed findings added | 4 (K-A2, K-A3, K-B2, K-A4b) |
| Claude review | PENDING (no file access) |
| Kiro review | PENDING (no file access) |