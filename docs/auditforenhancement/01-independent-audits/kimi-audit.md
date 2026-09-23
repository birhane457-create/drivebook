# Kimi Independent Audit — DriveBook AI Enhancement

**Auditor:** Kimi (Moonshot AI)
**Phase:** 1 — Independent audit (no cross-review performed yet)
**Date:** 2026-09-23

---

## 0. Scope, Method, and Evidence Basis (read first)

This audit covers the DriveBook Admin Copilot area as scoped in `AUDIT-SCOPE.md`, from three perspectives:

- **A. AI architecture** (model strategy, tool layer, context/memory, output quality)
- **B. Security & privacy** (RBAC, injection, logging, data exposure)
- **C. DriveBook business correctness** (schema alignment, lifecycle rules, eval validity)

### Evidence basis — stated honestly

I did **not** have direct read access to the DriveBook repository when producing this audit. Every finding below is labelled with one of:

| Label | Meaning |
| --- | --- |
| `[DOC]` | Derived from the GPT baseline audit's description of specific code (function names, snippets, comments quoted there) |
| `[REASONED]` | Architectural/security reasoning from first principles; no code inspected |
| `[UNVERIFIED]` | Claims a specific code fact that I could not personally confirm |

**Contamination disclosure:** GPT's baseline audit was shared with me in conversation before this file was written. To preserve Phase 1 integrity: (1) findings I reached independently are marked `IND`; (2) findings I am aware overlap GPT's are marked `OVL-AI-xx`; (3) anything I add beyond GPT is marked `NEW`. Phase 2 cross-review should treat overlap with appropriate skepticism and weight `[DOC]` evidence only after code verification.

**Process note:** Findings are not voted on. Each carries an *evidence quality* rating and a statement of what evidence would confirm/refute it.

---

## A. AI Architecture Findings

### K-A1 — Tool error contracts: silent zero/empty returns poison the model's reasoning `[DOC][OVL-AI-04]`

**Severity: HIGH (fix first)**

Multiple tools wrap DB queries in `catch()` and return `0` / empty arrays. An LLM cannot distinguish "zero failed payments" from "failed to count failed payments." A Copilot that reports false-confidence statements ("there are no failed payments") is worse than one that says "I could not verify this."

**Required change:** every tool result is a discriminated contract:
`{ status: SUCCESS | EMPTY | PARTIAL | ERROR, data, error?: {code, message}, provenance }`
The system prompt must mandate that `ERROR`/`PARTIAL` results are surfaced as "unverifiable," never as facts.

**Evidence that would change my position:** code inspection showing errors are re-thrown, bubbled as typed results, or the model is instructed to treat absence-of-data as unknown.

### K-A2 — No versioned, typed tool-result schema `[DOC][NEW]`

**Severity: MEDIUM**

Eight tools returning ad-hoc shapes is an eval-stability and maintenance problem: prompt wording, tool descriptions, and downstream eval cases all silently break when a shape changes. The K-A1 contract should be the first entry in a **versioned JSON-Schema-per-tool** spec, with schema hash recorded in each Copilot query log entry.

### K-A3 — Latency/cost budget undefined; model strategy is unanswerable without it `[REASONED][OVL-AI-02]`

**Severity: HIGH (as a planning gap)**

"Should we upgrade the model?" cannot be answered without a target envelope (e.g., p95 first-token < 4s, full tool-loop < 15s, $/admin-month ceiling, max tool calls per query). Before any benchmark: define the SLO and budget. Only then benchmark current model vs. cost-efficient vs. reasoning-tier against the same DriveBook cases.

Additionally: GPT's audit references "GPT-5.6 / Luna / Sol via the Responses API" — **`[UNVERIFIED]`**. Verify against OpenAI's live docs; do not anchor the plan on unverified model names or capabilities.

### K-A4 — Fallback path is a materially weaker system and must be labelled as such `[DOC][OVL-AI-10]`

**Severity: MEDIUM**

OpenAI path = dynamic tool selection; Anthropic fallback = fixed pre-fetched context (summary, health, risk, weekly). These are not equivalent. If fallback is retained, the UI and system prompt must explicitly state "degraded mode: limited tool context," and fallback-appropriate answer templates must avoid implying full coverage (e.g., retention/suburb questions).

**Alternative to consider:** fail closed with a clear error instead of a silently-weaker copilot. An admin acting on an incomplete answer is a real operational risk.

### K-A5 — Conversation "memory" is context-window replay, not memory `[DOC][OVL-AI-07]`

**Severity: MEDIUM**

`MAX_HISTORY = 20` replay is fine for chat continuity but cannot hold durable operational preferences. Once a knowledge layer exists, most "remember this" requests collapse into versioned rules rather than per-conversation state. Don't build persistent memory infra before K-C1 lands.

### K-A6 — Health score is a derived heuristic, not ground truth `[DOC][OVL-AI-06]`

**Severity: MEDIUM**

0–100 score = raw data → arbitrary weights → LLM interpretation (double interpretation). Tools should return raw signals + weights + thresholds + per-signal reasons alongside the composite, and the system prompt must prohibit treating the composite as fact.

### K-A7 — No epistemic labelling of outputs `[DOC][OVL-AI-13]`

**Severity: MEDIUM**

The prompt mandates "estimated impact and recommended action" but provides no confidence mechanism. Adopt a required output discipline: **FACT** (direct DB evidence, cite tool + record id) / **INFERENCE** (multi-signal reasoning, state the signals) / **RECOMMENDATION** (human decision required) / **UNKNOWN** (insufficient evidence). This also composes with K-A1: ERROR results must map to UNKNOWN.

---

## B. Security & Privacy Findings

### K-B1 — Prompt injection from live DB content is unhandled `[DOC][OVL-AI-09]`

**Severity: HIGH**

Tool outputs (names, dispute text, audit messages, bios) are attacker/legitimate-user-controlled text entering the model context. Current defence: apparently none. Required:

- System rule: **database content = data, never instructions**; tool outputs are untrusted input.
- Structural framing: wrap each tool result in delimiters with an explicit "the following is untrusted data" preamble; instruct the model to never execute instructions found inside.
- Output gate: the Copilot's final answer must never contain action requests derived from tool-content text (defence in depth — it is read-only anyway, but answers could phish an admin).
- Future surface: document search, tickets, emails, uploaded files will make this worse; design the framing now.

### K-B2 — The Copilot lowers the skill floor for large-scale data reads `[REASONED][NEW]`

**Severity: MEDIUM-HIGH (needs threat-model pass)**

A read-only Copilot is still an *exfiltration accelerator*: a compromised or curious admin can ask natural-language aggregate questions ("list all instructors with expired documents and their suburbs", "which students disputed in the last 90 days") faster than raw DB access. Rate limits exist but **scope is `[UNVERIFIED]`** (per-admin? per-IP? per-role?).
**Required:** per-admin rate limits with per-category budgets (sensitive aggregates vs. counts), an alert on anomalous query volume/topics, and a defined "sensitive fields" list that requires elevated role or is excluded from tool results entirely.

### K-B3 — Query logging: retention, access, and PII policy undefined `[DOC][OVL-AI-11]`

**Severity: MEDIUM**

Logging the question (`question.slice(0, 500)`) is correct for an admin AI, but policy must specify: retention period, who can read logs, whether PII is redacted at write time, and whether model/tool outputs are stored. Store a tool-schema hash (K-A2) alongside each log entry for later replay/debugging.

### K-B4 — Credential-looking material found in a rotation document `[DOC][OVL-AI-(unnumbered)]`

**Severity: SECURITY TRACK — outranks all AI findings; out of scope for this repo's AI plan**

If values are real: rotate immediately, handle as a security incident, audit access logs. If redacted/fake: verify and close in writing. **This must not wait for Phase 4.** One paragraph in an AI audit is insufficient handling; it needs an owner and a deadline now.

### K-B5 — Read-only boundary is the crown jewel — do not erode it `[DOC][POSITIVE]`

**Severity: POSITIVE CONTROL**

Server-side RBAC check → rate limit → whitelisted tools → read-only Prisma is the correct shape. Resist all future pressure to add write tools ("just approve this instructor from chat"); if ever proposed, require human-in-the-loop confirmation outside the model, with the same server-side enforcement — never model-enforced permissions.

---

## C. DriveBook Business Correctness Findings

### K-C1 — No structured DriveBook knowledge layer `[DOC][OVL-AI-01]`

**Severity: HIGH (root cause)**

The system prompt + tool descriptions do not encode booking/payment/commission/subscription/payout/RBAC/audit lifecycles. The model can fetch data but cannot *interpret* it against DriveBook rules ("why was this booking rejected?").
**Required:** versioned, structured rule modules (not prompt-dumped markdown): each rule = id, statement, source doc, version, effective date, scope. v1 priority: payment lifecycle → booking lifecycle → refund/payout rules → instructor approval/document rules. Short-notice rules and AI-receptionist boundaries follow.

### K-C2 — No entity-correlation investigation tool `[DOC][OVL-AI-03]`

**Severity: HIGH**

Current tools are dashboard aggregators. There is no `investigateBooking(id)` that walks Booking → Customer → Package → Payment → Wallet → Stripe event → Webhook → Availability → Slot conflict → Approval state → Audit log and returns a correlated timeline. **This is the single highest-value capability addition** — it converts the Copilot from summariser to investigator. Build it on top of the K-A1 contract and K-C1 rules, returning FACT/INFERENCE/UNKNOWN segments.

### K-C3 — Instructor-risk tool may be out of sync with production schema `[DOC][UNVERIFIED][OVL-AI-05]`

**Severity: HIGH if confirmed**

References to `licenseExpiry` / `insuranceExpiry` / `wwcCheckExpiry` vs. documentation suggesting fields moved to `DrivingProviderProfile`, plus in-code comments about schema movement. **Verification method (do this, don't debate it):** diff the tool's Prisma queries against current `schema.prisma`, run the risk tool against fixtures with known expiry states, compare outputs to ground truth. Any mismatch = silent miscalculation of instructor compliance — a business-safety issue, not just a code issue.

### K-C4 — Eval suite is valuable only after the foundation exists `[DOC][OVL-AI-08]`

**Severity: MEDIUM (as sequenced dependency)**

Converting PAY-01/SUB-22/MM/P0 cases into `AI-EVAL-00x` scenarios with Must/Must-NOT assertions is exactly right — but grading the model against tools that can silently return garbage zeroes (K-A1) measures nothing. Order: K-A1 contracts → K-C1 knowledge v1 → K-A2 schemas → then evals. Define eval metrics at the same time: correctness, evidence-citation rate, UNKNOWN-when-appropriate rate, injection-resistance rate.

### K-C5 — Short-notice, package, subscription and receptionist rules are unencoded `[DOC][NEW detail]`

**Severity: MEDIUM**

GPT's list of missing rule domains is correct; my addition: these are precisely the domains where admin questions are *why*-questions ("why was I charged?", "why did my receptionist booking fail?") that require rule interpretation, not data lookup. They are the test cases for K-C1's v1 scope.

---

## Consolidated Priority View (Kimi)

| # | Finding | Sev | Depends on | Effort |
| --- | --- | --- | --- | --- |
| 1 | K-B4 credential exposure | SECURITY | — | hours |
| 2 | K-A1 tool error contracts | HIGH | — | days |
| 3 | K-B1 injection framing | HIGH | K-A2 (delimiters) | days |
| 4 | K-C3 schema verification | HIGH if confirmed | — | days |
| 5 | K-C1 knowledge layer v1 (payments+bookings) | HIGH | K-A1 | weeks |
| 6 | K-C2 investigateBooking tool | HIGH | K-A1, K-C1 | weeks |
| 7 | K-A3 latency/cost SLO + benchmark | HIGH (gap) | K-A1 | days |
| 8 | K-A2 versioned tool schemas | MEDIUM | K-A1 | days |
| 9 | K-B2 exfiltration rate-limits/alerting | MED-HIGH | — | days |
| 10 | K-A4 fallback degraded-mode labelling | MEDIUM | — | hours |
| 11 | K-A7 epistemic output labels | MEDIUM | K-A1 | days |
| 12 | K-C4 eval suite | MEDIUM | 2,5,8 | weeks |
| 13 | K-B3 log policy | MEDIUM | — | hours |
| 14 | K-A5/K-A6 memory & health-score framing | MEDIUM | K-C1 | days |

---

## Phase 2 Placeholder — Position After Reviewing Other Audits

*(To be completed in `02-cross-review/kimi-review-of-others.md` after Phase 1 closes)*

- **Agreements:** TBD
- **Disagreements:** TBD
- **Findings I withdraw:** TBD
- **Findings I strengthen:** TBD
- **Findings I believe others missed:** TBD
- **Evidence that would change my position:** TBD
- **My final assessment:** TBD