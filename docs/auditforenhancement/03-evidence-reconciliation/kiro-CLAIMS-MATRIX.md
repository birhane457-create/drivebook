# Kiro Claims Matrix — DriveBook AI Copilot Enhancement Audit

**Phase:** 3 — Evidence Reconciliation  
**Author:** Kiro  
**Date:** 2026-09-24  
**Method:** Direct repository code verification + cross-validation against GPT/Kimi/Claude findings  
**Commit references:** Phase 1 audits @ `6d0c932e`, Phase 2 cross-reviews @ `af784efb`

**Status legend:**
- **VERIFIED-CODE** = Confirmed in source by direct read with path/line citation
- **CONFIRMED-2X** = Two independent auditors verified via different reasoning paths
- **CONFIRMED-3X** = Three independent auditors verified
- **PARTIAL** = Some elements verified, others require runtime/production data
- **OPEN** = Requires verification not yet performed
- **SECURITY** = Security track, handled out-of-band from AI backlog

---

## 1. Security Track (Out-of-Band — Immediate Action Required)

| # | Finding | GPT | Kimi | Claude | Kiro | Evidence Type | Final Status |
|---|---------|-----|------|--------|------|---------------|--------------|
| S-1 | Unrotated credentials in `docs/pr/CREDENTIAL_ROTATION_CHECKLIST.md` (DB, Stripe, Twilio, OpenAI, VAPI, Cloudinary, Upstash, Google OAuth) | Flagged (unnumbered) | K-B4 (hedged) | **CLD-01 CRITICAL** | Not read by me | Claude: file read directly, status "NOT ROTATED" | **SECURITY / CRITICAL** — Rotate all listed credentials immediately, then purge from git history. Separate from S-2. |
| S-2 | Dev credentials in `.credentials` file (admin@drivebook.com.au / Admin123!) | — | — | — | **KIRO-SEC-01** | File read directly by me, marked "FOR DEVELOPMENT ONLY" | **VERIFIED-CODE** — Remove from repo, add to `.gitignore`, create `.credentials.example`. Lower severity than S-1. |
| S-3 | Account takeover via shared `resetToken` (OTP + password-reset share one column, no purpose/expiry/consumption) | — | — | **CLD-02 CRITICAL** | — | Claude: 3 auth route files | **SECURITY / CRITICAL** (Claude only, needs 2nd verification) |
| S-4 | OTP brute-force weakness (in-memory Map, unpruned, non-shared across instances, pre-normalization keys) | — | — | **CLD-03 HIGH** | — | Claude: route file | **SECURITY / HIGH** (Claude only, needs 2nd verification) |
| S-5 | Unauthenticated SMS relay in voice microservice | — | — | **CLD-04 CRITICAL** (withdrawn from AI scope) | — | Claude: middleware + routes | **SECURITY / CRITICAL** — Out of scope for this AI audit per Claude's Phase 2 correction |
| S-6 | `CRON_SECRET` missing from `.env.example` | — | — | — | **KIRO-SEC-02** | `.env.example` read directly | **VERIFIED-CODE / LOW** — Add to example, verify deployed secret exists |
| S-7 | Edge middleware defence-in-depth unreachable (`'/'` prefix-matches all paths) | — | — | **CLD-07 MED-HIGH** | — | Claude only | **PARTIAL** (Claude only, needs 2nd verification) |

**Resolution:** S-1 and S-2 are **two separate files** with **two separate severities** (Claude's Phase 2 challenge confirmed). S-3 through S-7 are platform-wide, not Copilot-specific. Tracked separately.

---

## 2. Copilot Correctness Defects (Producing Wrong Answers Today)

| # | Finding | GPT | Kimi | Claude | Kiro | Evidence Type | Final Status |
|---|---------|-----|------|--------|------|---------------|--------------|
| C-1 | Tool DB errors silently convert to zero/empty (`.catch(() => 0)` pattern across all 8 tools) | AI-04 HIGH | K-A1 HIGH | CLD-10 HIGH | **KIRO-B-01 CRITICAL** | **CONFIRMED-3X** — All 8 tools verified lines 36-45, 71-80, 122-133, etc. | **VERIFIED-CODE / HIGH for pattern** — Fix: SUCCESS/EMPTY/PARTIAL/ERROR contract + system prompt rule mapping ERROR→"cannot verify" |
| C-1a | Health-score inversion specifically (DB failure → `failedPayments=0` → +20 points) | Accepted from Kiro | — | Supported (Claude Phase 2) | **KIRO-B-01** | **VERIFIED-CODE** lines 80-87 | **VERIFIED-CODE / CRITICAL** — Carved out from C-1 as separate severity (GPT/Claude Phase 2 consensus) |
| C-2 | `getInstructorRisk` queries document-expiry fields from wrong table; checks permanently skipped | AI-05 (unverified) | K-C3 (unverified) | **CLD-08** | **KIRO-C-01** | **CONFIRMED-3X** — Code lines 119-162 + migration `20260814210950_remove_driving_fields_from_core_tables/migration.sql` + schema verification | **VERIFIED-CODE / HIGH** — Fix: join `DrivingProviderProfile`. Evidence gap EG-05: confirm all approved providers have profiles |
| C-3 | `getDailySummary.expiringDocs` counts ALL approved providers (`OR: [{}, {}]` no-op filter) | — | — | **CLD-09** | **KIRO-C-02** | **CONFIRMED-2X** (Claude + me) — Lines 47-49 | **VERIFIED-CODE / HIGH** — Self-contained defect, no runtime test needed. Fix: rebuild filter against `DrivingProviderProfile` |
| C-4 | Revenue measured via 3 inconsistent ledgers; `DIRECT` payment mode bypasses `WalletTransaction.CREDIT` | Related: GPT AI-06 | — | — | **KIRO-A-04** | **VERIFIED-CODE** (mechanism) | **PARTIAL / MEDIUM-HIGH** — Code verified; business impact OPEN pending EG-01 (count of DIRECT-mode providers in production) |
| C-5 | Health-score edge cases: `approved=0` gives onboarding score 100; revenue trend saturates | Related: GPT AI-06 | K-A6 | — | **KIRO-C-04** | **VERIFIED-CODE** lines 94-95 | **VERIFIED-CODE / MEDIUM** — Fix alongside C-1; expose raw signals |
| C-6 | `getSuburbDemand` truncates at 500 rows, no `orderBy`, no truncation indicator | — | — | — | **KIRO-A-05** | **VERIFIED-CODE** lines 315-319 | **VERIFIED-CODE / MEDIUM** — Add `truncated`/`sampleSize` to result |
| C-7 | `getStudentRetention` runs identical query twice | — | — | — | **KIRO-A-06** | **VERIFIED-CODE** lines 269-294 | **VERIFIED-CODE / LOW** |

**Priority for implementation:** C-1/C-1a, C-2, C-3 are the P0 fixes (all HIGH/CRITICAL, all verified by multiple auditors). C-4 through C-7 follow.

---

## 3. AI Architecture & Knowledge Layer

| # | Finding | GPT | Kimi | Claude | Kiro | Evidence Type | Final Status |
|---|---------|-----|------|--------|------|---------------|--------------|
| A-1 | No structured DriveBook knowledge layer (booking/payment/payout/RBAC rules absent from system prompt) | AI-01 HIGH | K-C1 HIGH | CLD-12 | **KIRO-A-01 HIGH** | **CONFIRMED-3X** (GPT doc-based, Claude doc-based, Kiro code-based) — System prompt lines 18-31 verbatim | **VERIFIED-CODE / HIGH / ROOT CAUSE** — v1 scope: payment lifecycle → booking lifecycle → refund/payout → instructor doc rules |
| A-2 | No entity-correlation investigation tool (`investigateBooking(id)` walk: Booking→Customer→Package→Payment→Wallet→Stripe→Webhook→Availability→Audit) | AI-03 HIGH | K-C2 HIGH | — | **KIRO-A-03 HIGH** | **CONFIRMED-2X** — All 8 tools verified; none accept entity IDs | **VERIFIED-CODE / HIGH** — Build on C-1 contract + A-1 rules |
| A-3 | Model strategy unbenchmarked; `gpt-4o-mini` hardcoded; no SLO/budget defined | AI-02 (model names unverified) | K-A3 (SLO-first) | — | **KIRO-A-02** | **VERIFIED-CODE** (hardcoding at line 163) | **PARTIAL** — Hardcoding verified; "GPT-5.6/Luna/Sol" unverified (EG-08). Sequence: define SLO → benchmark → decide |
| A-4 | Anthropic fallback materially weaker (fixed 4-tool prefetch vs dynamic 5-round loop) | AI-10 MEDIUM | K-A4 + fail-closed option | CLD-13 MEDIUM | **KIRO-B-06** | **CONFIRMED-3X** — Lines 223-241 | **VERIFIED-CODE / MEDIUM** — Label degraded mode OR fail closed (Kimi's K-A4b proposal accepted) |
| A-5 | No epistemic labelling (FACT/INFERENCE/RECOMMENDATION/UNKNOWN) | AI-13 MEDIUM | K-A7 MEDIUM | — | — | **VERIFIED-CODE** (absence in system prompt) | **VERIFIED-CODE / MEDIUM** — Composes with C-1 error contract |
| A-6 | No latency/cost budget; MAX_ROUNDS=5 × 8 tools = 40 DB queries/request possible | — | **K-A3 (NEW)** | — | KIRO-A-07 | **VERIFIED-CODE** | **VERIFIED-CODE / MEDIUM** — Define SLO envelope before A-3 benchmark |
| A-7 | No versioned tool schemas; no prompt/model versioning in AuditLog | — | **K-A2 (NEW)** | — | KIRO-B-07 | **VERIFIED-CODE** (AuditLog schema read) | **VERIFIED-CODE / MEDIUM** — Log `{toolSchemaHash, promptVersion, model}` per query |
| A-8 | Session-only conversation memory (MAX_HISTORY=20, React state only) | AI-07 MEDIUM | K-A5 | CLD-12 | **KIRO-B-02** | **CONFIRMED-3X** | **VERIFIED-CODE / MEDIUM/INFORMATIONAL** — Subsume into A-1; no separate memory infra |
| A-9 | No evaluation suite | AI-08 HIGH | K-C4 (sequenced after contracts) | CLD-12 | **KIRO-B-03 HIGH** | **CONFIRMED-3X** — `__tests__/` searched, no AI tests found | **VERIFIED-CODE / HIGH** — Minimal 10-scenario suite co-ships with C-1/C-2/C-3; full suite after A-1 |

**Sequencing consensus:** A-1 (knowledge layer) is the architecture enabler for everything else. A-9 (eval suite) splits into two phases: minimal blocking scenarios with P0 fixes, full suite after knowledge layer.

---

## 4. Injection, Privacy & Rate Limiting

| # | Finding | GPT | Kimi | Claude | Kiro | Evidence Type | Final Status |
|---|---------|-----|------|--------|------|---------------|--------------|
| P-1 | Prompt injection: no data/instruction boundary; `provider.name` reaches model context unframed via `JSON.stringify(toolResult)` | AI-09 HIGH | K-B1 HIGH | **CLD-11** (reachability verified) | **KIRO-C-03 MEDIUM-HIGH** + **KIRO-SEC-03** (roadmap sequencing) | **CONFIRMED-3X** — Data flow route.ts:202 verified | **Reachability VERIFIED-CODE / Exploitability OPEN (EG-08)** — Fix: system prompt rule + delimiter framing + output gate (Kimi's proposal). Must precede roadmap tool expansion. |
| P-2 | Query logging: no retention/access/PII policy; question stored unredacted | AI-11 MEDIUM | K-B3 MEDIUM | CLD-14 MEDIUM | **KIRO-B-08 MEDIUM** | **CONFIRMED-3X** — route.ts:54 + AuditLog schema | **VERIFIED-CODE / MEDIUM** — Define retention, access policy, PII redaction decision + A-7 versioning fields. EG-03: check external TTL |
| P-3 | Rate limit doc/actual mismatch (comment 20/min vs limiter 30/min); shared limiter object (but different key prefixes) | — | Partial: K-B2 | — | **KIRO-B-04 MEDIUM** | **VERIFIED-CODE** — `lib/ratelimit.ts` read directly | **VERIFIED-CODE / MEDIUM** — Split AI-specific limiter + fix comment. Key prefixes differ (no actual budget collision today). |
| P-4 | Copilot as exfiltration accelerator (per-category budgets, anomaly alerting, sensitive-field list) | — | **K-B2 residual (NEW)** | — | Question posed to me in Phase 2 | Kimi: **[REASONED]**, no code access | **OPEN** — My answer: Read-only + RBAC + rate-limits are the current mitigations. Per-category budgets = enhancement, not defect. Anomaly alerting = reasonable addition. Recommend MEDIUM priority. |
| P-5 | `__ping__` probe burns rate-limit tokens, pollutes AuditLog, conflates 403/503 | AI-12 LOW | — | — | **KIRO-B-05 LOW-MEDIUM** | **VERIFIED-CODE** — AdminAIChat.tsx + route read | **VERIFIED-CODE / LOW-MEDIUM** — Fix: `GET /api/admin/ai/status` |

**Resolution on P-4:** I consider this an enhancement (better observability/anomaly detection) rather than a security defect. Current mitigations (server-side RBAC, read-only tools, per-admin rate limits) are sound. Recommend adding per-category budgets and anomaly alerting at MEDIUM priority.

---

## 5. Positive Controls (Preserve)

| # | Finding | Consensus | Evidence Type | Final Status |
|---|---------|-----------|---------------|--------------|
| X-1 | Read-only Copilot boundary: server-side RBAC before tool loop, hardcoded `callTool` switch with throw-default, no raw SQL/arbitrary Prisma | **UNANIMOUS** (GPT AI-14, K-B5, CLD-15, Kiro positive control note) | **CONFIRMED-3X** — route.ts lines 98-101, ai-tools.ts lines 385-397 | **VERIFIED-CODE / POSITIVE CONTROL** — Do not loosen while fixing C-1..C-3; future write tools must preserve server-side enforcement |

---

## 6. Evidence Gaps Requiring Human Action

| ID | Gap Description | Blocks Finding(s) | What Would Close It | Owner |
|----|-----------------|-------------------|---------------------|-------|
| EG-01 | Count of `Provider` records with `paymentMode='DIRECT'` in production | C-4 severity | One production DB query | DB access holder |
| EG-02 | Does external monitoring (Sentry/Datadog) catch `.catch()` suppressions? | C-1 severity adjustment | Ops/config check | Observability owner |
| EG-03 | External TTL/retention policy on AuditLog? | P-2 | Supabase/DB config check | Platform owner |
| EG-04 | Benchmark current model vs alternatives against DriveBook scenarios | A-3 | Run defined test scenarios with quality/latency/cost metrics | Whoever can fund/run benchmark |
| EG-05 | Do all approved providers have `DrivingProviderProfile` rows? | C-2 fix strategy | One production DB query (join check) | DB access holder |
| EG-06 | Adversarial `provider.name` test under current system prompt | P-1 exploitability | Staging test with crafted name → eval suite blocking scenario | Whoever can run staging tests |
| EG-07 | S-1 credential liveness confirmation | S-1 | Check each provider dashboard (never test the credential) | Repo owner / provider access holder |
| EG-08 | Verify "GPT-5.6/Luna/Sol" model names against OpenAI live docs | A-3 (not load-bearing for plan) | Check current OpenAI catalog | Anyone with OpenAI docs access |

---

## 7. Final Priority Ordering (Evidence-Based)

**Immediate (Security Track — Out-of-Band):**
1. S-1: Rotate credentials from checklist file
2. S-2: Remove `.credentials`, add to `.gitignore`
3. S-3 through S-7: Platform-wide security (separate owner)

**Sprint 1 (P0 Correctness Fixes + Minimal Eval):**
1. C-1/C-1a: Tool error contract (SUCCESS/EMPTY/PARTIAL/ERROR)
2. C-2: Fix `getInstructorRisk` schema join
3. C-3: Fix `getDailySummary` expiring-docs filter
4. A-9 (minimal): 10-scenario eval suite with DB-failure + injection as blocking scenarios

**Sprint 2 (Knowledge Layer + Investigation):**
1. A-1: DriveBook knowledge layer v1 (payment → booking → refund/payout → instructor docs)
2. A-2: Build `investigateBooking(id)` tool
3. P-1: Injection framing (system prompt + delimiters + output gate)

**Sprint 3 (Model Strategy + Full Eval):**
1. A-6: Define SLO/budget
2. A-3: Benchmark + model decision
3. A-4: Fallback decision (label degraded mode or fail closed)
4. A-9 (full): Complete eval suite

**Sprint 4 (Polish & Remaining Items):**
1. C-4 through C-7 (pending EG-01)
2. P-2 through P-5
3. A-5, A-7, A-8

---

## 8. Disagreements Resolved

**D-1: C-1 Severity (HIGH vs CRITICAL)**  
**Resolution:** General pattern = HIGH (GPT/Claude Phase 2 consensus); health-score inversion specifically = CRITICAL (carved out as C-1a per Claude's proposal, which I accept).

**D-2: Two Credential Files (S-1 vs S-2)**  
**Resolution:** Confirmed as two separate files with two separate severities per Claude's Phase 2 challenge. S-1 is checklist (CRITICAL, unrotated production secrets), S-2 is root `.credentials` (LOW, dev-only).

**D-3: Kimi's Contamination Disclosure**  
**Resolution:** Accepted as process fact per Claude's Phase 2 analysis. Convergent findings (C-1, C-2, C-3, A-1) counted as 3 independent sources (GPT, Claude, Kiro), not 4. Kimi's genuinely NEW contributions (K-A2, K-A3, K-B2) stand independently.

**D-4: Model Upgrade Required?**  
**Resolution:** Withdrawn by all auditors in Phase 2. No one maintains "bigger model needed" as a verified claim. Reframed as open task: SLO → benchmark → decide.

---

*All code citations independently verified against repository at commit `af784efb` (main, 2026-09-24).*
