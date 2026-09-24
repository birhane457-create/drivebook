# CLAIMS-MATRIX — DriveBook AI Enhancement Audit

**Phase:** 3 — Evidence reconciliation (draft for coordinator review)
**Author:** Kimi (Phase 2 outputs consolidated per AUDIT-RULES R5: evidence outranks consensus)
**Date:** 2026-09-24
**Snapshots:** main @ `3909241bcc5f`; audits at gpt `3c644252` · kimi `bd269381` · claude `bd269381` · kiro `6d0c932e`

**Status legend:** `VERIFIED-CODE` = confirmed in source by a repo-access auditor with path/line ·
`CONFIRMED-2X` = two independent repo-access auditors, different reasoning paths ·
`PARTIAL` = some elements verified, some open · `OPEN` = verification still required ·
`SECURITY` = security track, handled out-of-band from the AI backlog

---

## 1. Security track (precedes all AI work)

| # | Finding | GPT | Kimi | Claude | Kiro | Evidence | Final |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-1 | Live credentials committed (`CREDENTIAL_ROTATION_CHECKLIST.md`, self-marked NOT ROTATED) | flagged (unnumbered) | flagged (K-B4, hedged) | **CLD-01, CRITICAL, file+lines** | noted | File read directly; status self-declared | **VERIFIED-CODE → SECURITY: rotate all listed credentials immediately, then purge git history (rotation first, purge second)** |
| S-2 | Account takeover via shared untyped `resetToken` (OTP + reset share column, no purpose/expiry/consumption) | — | — | **CLD-02, CRITICAL** | — | Three auth route files read directly | **VERIFIED-CODE → SECURITY** |
| S-3 | OTP brute-force: in-memory Map, unpruned, not cross-instance, pre-normalization keys | — | — | **CLD-03, HIGH** | — | `verifications/otp/confirm/route.ts` read directly | **VERIFIED-CODE → SECURITY** |
| S-4 | Unauthenticated SMS relay in voice microservice (`/api/bookings` exempt from auth) | — | — | **CLD-04, CRITICAL** | — | middleware + routes + config read directly | **VERIFIED-CODE → SECURITY: delete route + Mongo dependency, do not gate** |
| S-5 | Pre-account hijacking via public bulk booking (account created from unverified email, setup link issued) | — | — | **CLD-05, HIGH** | — | route.ts lines 264–309, 393–398 | **VERIFIED-CODE → SECURITY** |
| S-6 | Public booking access model false premise: `cuid()` not UUIDv4; phone-match fallback unrate-limited | — | — | **CLD-06, HIGH** | — | comment vs `schema.prisma:236` | **PARTIAL: false premise VERIFIED-CODE; cuid() guessability at volume = OPEN (empirical test); rate-limit fix required regardless** |
| S-7 | Edge middleware defence-in-depth block unreachable (`'/'` prefix-matches all paths) | — | — | **CLD-07, MED-HIGH** | — | `middleware.ts` read directly | **VERIFIED-CODE → fix (exact-match `/`, check protected prefixes first)** |
| S-8 | `.credentials` file in repo root (dev-only values) | — | — | — | **KIRO-SEC-01** | file read directly | **VERIFIED-CODE → remove from repo, gitignore, example template** |
| S-9 | `CRON_SECRET` absent from `.env.example` (document-expiry cron may deploy unauthenticated) | — | — | — | **KIRO-SEC-02** | `.env.example` read directly | **VERIFIED-CODE → add to example + verify deployed secret exists** |

## 2. Copilot correctness (verified bugs producing wrong answers today)

| # | Finding | GPT | Kimi | Claude | Kiro | Evidence | Final |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C-1 | `getInstructorRisk` queries expiry fields from wrong table; all doc-expiry checks permanently skipped | AI-05 (unverified) | K-C3 (if confirmed) | **CLD-08** | **KIRO-C-01, CRITICAL** | Code lines 119–162 + migration `20260814210950` + `schema.prisma` (`DrivingProviderProfile`) | **CONFIRMED-2X, VERIFIED-CODE incl. mechanism (`(prisma as any)` silent ignore → `if (!c.date) continue` always true). CRITICAL. Fix: join `drivingProfile`. EG-05: confirm all approved providers have profiles** |
| C-2 | `getDailySummary.expiringDocs` counts ALL approved providers (`OR: [{},{}]` no-op) | — | — | **CLD-09** | **KIRO-C-02** | Query read directly; Prisma semantics | **CONFIRMED-2X. HIGH. Fix: rebuild filter against actual field locations** |
| C-3 | 100% of tool DB calls `.catch(() => 0/[])`; indistinguishable from real zeros; health-score inversion (DB outage → +20 pts) | AI-04 | K-A1 | **CLD-10** | **KIRO-B-01, CRITICAL** | Pattern read across all 8 tools; inversion traced lines 80–87 | **VERIFIED-CODE. Health-score instance CRITICAL; pattern HIGH. Fix: SUCCESS/EMPTY/PARTIAL/ERROR contract + prompt rule mapping ERROR→"cannot verify"** |
| C-4 | Revenue measured via 3 different ledgers; `DIRECT` payment mode bypasses `WalletTransaction.CREDIT` | — | — | — | **KIRO-A-04, MED-HIGH** | Code + `Provider.paymentMode` in schema | **PARTIAL: code mechanics VERIFIED-CODE; business impact OPEN pending EG-01 (count of DIRECT-mode providers)** |
| C-5 | Health-score structural bugs: onboarding=100 when approved=0; revenue trend can't separate bad from catastrophic | AI-06 | K-A6 | — | **KIRO-C-04** | lines 94–95 + trend formula | **VERIFIED-CODE. MEDIUM. Fix alongside C-3; expose raw signals (K-A6/K-A6')** |
| C-6 | `getSuburbDemand` truncates at 500 rows, undefined order, no truncation signal | — | — | — | **KIRO-A-05** | lines 315–319 | **VERIFIED-CODE. MEDIUM. Fix: `truncated`/`sampleSize` in result (instance of C-3 contract)** |
| C-7 | `getStudentRetention` runs identical query twice | — | — | — | **KIRO-A-06** | lines 269–294 | **VERIFIED-CODE. LOW** |

## 3. AI architecture

| # | Finding | GPT | Kimi | Claude | Kiro | Evidence | Final |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-1 | No structured DriveBook knowledge layer | AI-01 | K-C1 | **CLD-12** | **KIRO-A-01** (prompt verbatim) | System prompt constant route.ts:18–31 read directly; 9 rule domains enumerated | **VERIFIED-CODE (one doc-based + two code-based audits). HIGH, root cause. v1 scope: payment → booking → refund/payout → instructor doc rules** |
| A-2 | No entity-correlation investigation tool | AI-03 | K-C2 | — | **KIRO-A-03** | All 8 tools read; none accept entity IDs | **VERIFIED-CODE. HIGH. Build `investigateBooking(id)` on C-3 contract + A-1 rules** |
| A-3 | Model unbenchmarked; `gpt-4o-mini` hardcoded | AI-02 (unverified catalog claim) | K-A3 (SLO-first) | — | **KIRO-A-02** | `route.ts:163` | **PARTIAL: hardcoding VERIFIED-CODE; which model = OPEN. GPT's "GPT-5.6/Luna/Sol" premise UNVERIFIED — do not carry into plan. Sequence: SLO → benchmark → decide** |
| A-4 | Fallback materially weaker and silent | AI-10 | K-A4 + fail-closed option | **CLD-13** | **KIRO-B-06** (adds: `ANTHROPIC_API_KEY` absent from `.env.example`; fallback always calls broken risk tool) | route.ts:223–241 | **VERIFIED-CODE. MEDIUM. Label degraded mode OR fail closed (K-A4b, endorsed by KIRO-B-06 evidence)** |
| A-5 | No epistemic labelling (FACT/INFERENCE/RECOMMENDATION/UNKNOWN) | AI-13 | K-A7 | — | — | Prompt read: mandates "estimated impact + recommended action", no confidence mechanism | **VERIFIED-CODE (absence). MEDIUM. Composes with C-3** |
| A-6 | No latency/cost budget or per-request ceilings | — | K-A3 (NEW) | — | KIRO-A-07 (related: 40 DB queries/request possible) | MAX_ROUNDS=5 × 8 tools | **VERIFIED-CODE (absence). Define SLO envelope incl. tool-call ceilings before A-3 benchmark** |
| A-7 | No versioned tool schemas / prompt+model versioning in logs | — | K-A2 | — | KIRO-B-07 | AuditLog metadata read | **VERIFIED-CODE (absence). MEDIUM. Merge: log {toolSchemaHash, promptVersion, model} per query** |
| A-8 | Session-only conversation memory | AI-07 | K-A5 | **CLD-12** | **KIRO-B-02** | MAX_HISTORY=20; React state only | **VERIFIED-CODE. MEDIUM/INFORMATIONAL. Subsume into A-1; no separate memory infra** |
| A-9 | Health score double-interpretation | AI-06 | K-A6 | — | KIRO-C-04 | (see C-5) | **Covered by C-5 + A-5. MEDIUM** |
| A-10 | No eval suite | AI-08 | K-C4 (re-sequenced) | **CLD-12** | **KIRO-B-03** (adds: P0 fixes ship unprotected) | `__tests__/` searched | **VERIFIED-CODE (absence). HIGH. Adjusted sequencing: minimal 10-scenario suite co-ships with C-1/C-2/C-3 fixes, incl. adversarial DB-failure + injection test as blocking scenarios; full suite after A-1** |

## 4. Injection & privacy

| # | Finding | GPT | Kimi | Claude | Kiro | Evidence | Final |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P-1 | Prompt injection: no data/instruction boundary; `provider.name` reaches context verbatim via `JSON.stringify(toolResult)` | AI-09 | K-B1 | **CLD-11** (reachability verified) | **KIRO-C-03** (prompt fix text) + **KIRO-SEC-03** (roadmap sequencing) | Data flow route.ts:202 read directly | **Reachability VERIFIED-CODE; exploitability OPEN (adversarial-name test → enters eval suite as blocking scenario). Severity HIGH (fix now), current exploitability LOW-MEDIUM (names pass admin approval). Adopt Kiro's prompt wording + delimiter framing + Kimi output gate. KIRO-SEC-03 adopted as hard rule: framing precedes roadmap tool expansion** |
| P-2 | Query logging unredacted, no retention/access/PII policy | AI-11 | K-B3 | **CLD-14** | **KIRO-B-08** (schema-level) | route.ts:54 + AuditLog model | **VERIFIED-CODE. MEDIUM. Fix: retention window, access policy, PII redaction decision, + A-7 versioning fields. EG-03: check external TTL** |
| P-3 | Rate limit: doc/actual mismatch (comment 20 vs limiter 30); shared limiter object across admin actions | — | K-B2 (partially corrected) | — | **KIRO-B-04** | `lib/ratelimit.ts` read directly | **VERIFIED-CODE. MEDIUM. Per-admin keys confirmed (prefixes differ — no actual budget collision today); still split AI limiter + fix comment** |
| P-4 | Copilot as exfiltration accelerator (bulk NL aggregation; per-category budgets; anomaly alerting) | — | K-B2 residual (NEW) | — | — (question posed to Kiro in Phase 2) | Reasoned; no code read by Kimi | **OPEN. Pending Kiro answer: considered-and-rejected (then withdraw alerting req.) vs out-of-scope (then Phase 3 security item). Per-category budgets + sensitive-field list remain standing requirements** |
| P-5 | `__ping__` probe: burns rate-limit tokens, pollutes AuditLog, conflates 403/503 | AI-12 (LOW) | — | — | **KIRO-B-05** (LOW-MEDIUM) | AdminAIChat.tsx + route read directly | **VERIFIED-CODE. LOW-MEDIUM (upgrade from GPT's LOW per Kiro's three additional harms). Fix: `GET /api/admin/ai/status`** |

## 5. Positive controls (preserve)

| # | Finding | Consensus | Final |
| --- | --- | --- | --- |
| X-1 | Read-only Copilot boundary: server-side RBAC before tool loop, hardcoded `callTool` switch with throw-default, no raw SQL/arbitrary Prisma | GPT AI-14 · Kimi K-B5 · **CLD-15 (VERIFIED-CODE, lines 98–101, 385–397)** · Kiro final position | **VERIFIED-CODE. Unanimous. Do not loosen while fixing C-1..C-3; no write tools; future human-in-the-loop actions enforced server-side, never model-side** |
| X-2 | Audit logging of every query exists (foundation sound, policy incomplete) | GPT AI-11 · Kimi K-B3 · CLD-14 · KIRO-B-08 | **VERIFIED-CODE. Preserve mechanism; complete policy per P-2** |

## 6. Consolidated final ordering (post-reconciliation)

1. **S-1..S-9 security track** — credential rotation first (hours), then S-2..S-7, S-8, S-9. Out-of-band owner required; not sequenced against AI work.
2. **C-1, C-2, C-3 + A-10-minimal** — confirmed correctness bugs + error contracts + 10-scenario eval suite co-delivery. This is the first engineering sprint.
3. **A-1 knowledge layer v1** → **A-2 investigateBooking** → **A-7 schemas** → **A-10 full suite** → **P-1 framing** (must also precede any roadmap tool expansion).
4. **A-6 SLO → A-3 benchmark → model decision** (A-4 fallback decision folded in).
5. **Everything else** (C-4 pending EG-01, C-5..C-7, P-2..P-5, A-5, A-8, A-9) scheduled within sprints 2–4.

## 7. Open evidence items (owners needed)

| ID | Item | Needed to close |
| --- | --- | --- |
| EG-01 | Count of `paymentMode='DIRECT'` providers | One production DB query |
| EG-02 | Does external monitoring catch `.catch()` suppressions? | Ops/config check |
| EG-03 | External TTL/retention on AuditLog? | Supabase/config check |
| EG-04 | CLD-06: cuid() guessability at production volume | Empirical study; rate-limit fix ships regardless |
| EG-05 | Do all approved providers have `DrivingProviderProfile` rows? | One production DB query (affects C-1 fix shape) |
| EG-06 | CLD-11/P-1: adversarial-name exploitability under current prompt | Test in eval suite; blocking scenario |
| EG-07 | K-B2 question to Kiro: per-category budgets considered or out of scope? | Kiro response in Phase 3 |
| EG-08 | GPT's "GPT-5.6/Luna/Sol" catalog claim | Check OpenAI live docs; not load-bearing for plan |