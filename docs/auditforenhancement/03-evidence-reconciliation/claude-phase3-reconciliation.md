# Claims Matrix

Status of Phase 2 inputs at time of writing: GPT cross-review complete. Claude cross-review
written, not yet committed. Kimi and Kiro cross-reviews not yet started. Per AUDIT-RULES
("evidence over consensus"), status below reflects source-code evidence gathered across
Phase 1 + available Phase 2 review, not a vote count. Rows marked PROVISIONAL should be
re-confirmed once Kimi's and Kiro's Phase 2 reviews exist.

| # | Finding | GPT (P1/P2) | Kimi (P1) | Claude (P1/P2) | Kiro (P1) | Evidence type | Final status |
|---|---|---|---|---|---|---|---|
| 1 | Tool DB failures silently convert to 0/empty, indistinguishable from real zero | GPT-01, HIGH | K-A1, HIGH | CLD-10, HIGH | KIRO-B-01, CRITICAL | SOURCE CODE FACT — pervasive `.catch(() => 0)` pattern in `lib/admin/ai-tools.ts` | **VERIFIED / FIX REQUIRED**. Severity HIGH for the general pattern (GPT+Claude); Kiro's specific health-score inversion instance (failure → score improves) is its own **CRITICAL** sub-case — see row 8. |
| 2 | `getInstructorRisk` reads `licenseExpiry` from a field never selected, from a table it no longer lives on | GPT-02, HIGH | K-C3, HIGH (unverified) | CLD-08, HIGH | KIRO-C-01, HIGH, with migration-file proof | SOURCE CODE FACT + PRODUCTION FACT (Kiro traced `DROP COLUMN` migration) | **VERIFIED / FIX REQUIRED**. Kiro's citation is the reference evidence: field physically removed from `Instructor`, now lives on `DrivingProviderProfile`, `(prisma as any)` suppresses the type error, check silently never fires. |
| 3 | `getDailySummary` `expiringCount`/`expiringDocs` uses `OR: [{}, {}]`, a no-op filter that counts all approved providers | GPT-03, HIGH | — (not independently raised) | CLD-09, HIGH | KIRO-C-02, HIGH | SOURCE CODE FACT — self-contained, no runtime test needed | **VERIFIED / FIX REQUIRED**, highest confidence in the matrix — the defect is provable from the query text alone. |
| 4 | Prompt injection via untrusted DB content (e.g. `provider.name`) reaching model context unfiltered | GPT-14, HIGH | K-B1, HIGH | CLD-11, MEDIUM-HIGH | — (not explicitly raised as a named finding) | SOURCE CODE FACT (reachability) — `JSON.stringify(toolResult)` into message history; no exploit attempt made | **VERIFIED REACHABILITY / EXPLOITABILITY UNPROVEN**. Requires an adversarial staging test before status can move to CONFIRMED EXPLOITABLE or CLOSED. |
| 5 | Read-only security boundary (server-side permission check before tool execution, whitelisted dispatcher, no dynamic Prisma from model output) | Implicit positive throughout GPT-01–17 | K-B5, POSITIVE | CLD-15, POSITIVE | Stated in Final Position, POSITIVE | SOURCE CODE FACT, unanimous across 3 independent reads | **VERIFIED POSITIVE CONTROL**. Preserve; no proposed fix should touch this layer. |
| 6 | Anthropic fallback provides materially less tool coverage than the OpenAI path (fixed 4-tool prefetch vs. dynamic 5-round loop) | GPT-15, MEDIUM | K-A4, MEDIUM | CLD-13, MEDIUM | — (not independently raised) | SOURCE CODE FACT | **VERIFIED / FIX REQUIRED** — either equalize tool access or surface degraded-mode status to the admin. |
| 7 | Live, unrotated credentials — `docs/pr/CREDENTIAL_ROTATION_CHECKLIST.md` (DB, Stripe, Twilio, OpenAI, VAPI, Cloudinary, Upstash, Google OAuth) | Acknowledged as "separate P0 track, if genuine" | Flagged, `[DOC]`, "outranks all AI findings" | CLD-01, CRITICAL | Not read — Kiro read a *different* file (see row 9) | DOCUMENTATION CLAIM (file's own stated status: "NOT ROTATED") | **SECURITY TRACK — OPEN**. Not an AI-architecture finding; track and close independently of this audit. Do not conflate with row 9. |
| 8 | Health-score specific inversion: a failed `failedPayments` query can silently *raise* the composite score | Accepted from Kiro, "medium correctness finding pending business semantics" | — | — | Raised by Kiro | SOURCE CODE FACT + INFERENCE (business semantics of the weighting not independently confirmed) | **PARTIALLY VERIFIED**. Mechanism is a fact; whether it's "wrong" depends on confirming intended score semantics — carve out from row 1 as its own CRITICAL-candidate pending that confirmation. |
| 9 | Root `.credentials` file — dev-only test credentials committed to repo | Not raised | Not raised | Not raised | KIRO-SEC-01, dev-practice risk, explicitly lower severity | SOURCE CODE FACT (single source) | **VERIFIED, LOWER SEVERITY, DISTINCT FROM ROW 7**. Fix: gitignore + example template. Do not merge with row 7 in any summary document. |
| 10 | No structured DriveBook knowledge layer (booking/payment/commission/payout/RBAC rules absent from system prompt) | Implicit (P1 priority list) | K-C1, HIGH, root cause | CLD-12, HIGH | KIRO-A-01, HIGH, full system prompt reproduced and checked line-by-line | SOURCE CODE FACT — complete read of the 8-line system prompt confirms zero business rules | **VERIFIED / FIX REQUIRED**. Architecture debt, not an active incident — sequence after rows 1–4. |
| 11 | `WalletTransaction` CREDIT used as a revenue proxy without confirmed accounting definition | GPT-06, MEDIUM/HIGH, NEEDS VERIFICATION | — | — | Related: KIRO-A-04, revenue signals span three ledgers | SOURCE CODE FACT + INFERENCE | **NEEDS VERIFICATION** — requires financial-doctrine document + production `DIRECT`-payment-mode provider count (Kiro's EG-01). |
| 12 | Student-retention cohort mismatch (30-day recent-booker denominator vs. 60-day repeat-booker numerator) | GPT-07, MEDIUM, "likely logic defect" | — | — | — | SOURCE CODE FACT + INFERENCE | **NEEDS VERIFICATION** via boundary-case fixtures; single-source so far. |
| 13 | Kimi's Phase 1 findings built from GPT's audit content rather than independent repo access | N/A | Self-disclosed by Kimi (`[DOC]` tags, contamination note) | Raised in Claude Phase 2 | N/A | Kimi's own written disclosure | **PROCESS FINDING, VERIFIED**. Overlapping items (K-A1, K-B1, K-C1, K-C3, etc.) should be weighted as 3 independent sources (GPT, Kiro, Claude), not 4, in any consensus-adjacent summary. Kimi's genuinely `[NEW]` items (K-A2, K-B2) stand on their own. |

## Rows requiring Kimi/Kiro Phase 2 input before closing

Rows 1, 4, 6, 10 all currently rely on GPT's and Claude's Phase 2 challenges only. Kimi's
and Kiro's independent challenge/agreement on severity (not just Phase 1 restatement)
would strengthen or contest the "Final status" column above.



# Disagreements

Record substantive disagreements and resolve them against evidence rather than model
majority. Only genuine disagreements go here — items where all sources converge belong
in CLAIMS-MATRIX.md instead.

---

## D-01 — Severity of tool-failure masking: HIGH vs. CRITICAL

**Positions:**
- Kiro: CRITICAL, unconditionally.
- GPT (Phase 2 challenge to Kiro): HIGH — "CRITICAL needs consequential-impact evidence,"
  not just the structural pattern.
- Claude (Phase 2): agrees with GPT for the general pattern, but proposes carving out
  Kiro's specific health-score-inversion instance as its own CRITICAL line.

**Evidence available:** The general `.catch(() => 0)` pattern is a SOURCE CODE FACT
across all 8 tools. Whether it has already caused a wrong operational decision in
production is UNKNOWN — no production incident log has been checked.

**Resolution:** PARTIALLY RESOLVED. General pattern = HIGH (2 of 3 Phase-2 participants
agree, and GPT's reasoning — that CRITICAL requires demonstrated consequential impact,
not just structural risk — is sound on its own terms, not because of the count). The
health-score inversion sub-case is tracked separately in CLAIMS-MATRIX row 8 pending
confirmation of intended score semantics.

**Evidence that would settle this fully:** Either a documented production incident
traceable to a masked tool failure (→ CRITICAL confirmed), or confirmation that external
monitoring (Sentry/Datadog, per Kiro's EG-02) already catches these at the ops layer
independent of the AI layer (→ severity may soften further).

---

## D-02 — Two different credential-exposure files being treated as one finding

**Positions:**
- Claude: `docs/pr/CREDENTIAL_ROTATION_CHECKLIST.md` (marked "NOT ROTATED," ~10 services)
  and Kiro's root `.credentials` (dev-only test creds, explicitly lower severity per
  Kiro) are two distinct artifacts with two distinct severities.
- GPT (Phase 2): referred to "the checklist" in the singular when challenging Claude's
  CLD-01, without cross-referencing Kiro's separate file.
- Kiro: did not read or reference the checklist file at all; only audited `.credentials`.

**Evidence available:** Both files independently confirmed to exist by their respective
readers (Claude read the checklist directly; Kiro read `.credentials` directly). Neither
auditor cross-checked the other's file.

**Resolution:** RESOLVED AS A PROCESS ITEM, NOT YET AS A SECURITY ITEM. These must be
tracked as two separate rows (CLAIMS-MATRIX rows 7 and 9) with two separate dispositions.
The underlying question of whether the checklist's values are genuinely live remains
OPEN — see EVIDENCE-GAPS.md.

**Evidence that would settle this:** Someone with repo + provider-dashboard access
confirms directly whether the checklist's listed values are live, already rotated, or
placeholder/synthetic. This cannot be resolved by further code reading.

---

## D-03 — Whether Kimi's Phase 1 findings count as independent corroboration

**Positions:**
- Kimi: self-disclosed that it lacked direct repository access and built most findings
  from GPT's Phase 1 audit as shared in conversation; explicitly tagged overlapping
  items `[DOC]` rather than `[REASONED]`-and-verified.
- Claude (Phase 2): overlapping items should be weighted as 3 independent sources (GPT,
  Kiro, Claude), not 4, in any rollup; Kimi's genuinely `[NEW]` items (K-A2 versioned
  tool schemas, K-B2 exfiltration-via-natural-language-query risk) stand on their own
  regardless of access.
- GPT: did not address this directly in its Phase 2 review (predates full visibility
  into Kimi's disclosure, or was not flagged as material).

**Evidence available:** Kimi's own file contains the disclosure in writing (Contamination
disclosure section, kimi-audit.md).

**Resolution:** RESOLVED. This is a process fact, not a content dispute — Kimi's
integrity in disclosing it is itself a positive, and the two `[NEW]` contributions remain
valid regardless of access. Downstream documents (DECISIONS.md, any summary for
non-technical stakeholders) should not describe the convergent findings as "4 independent
models agree."

---

## D-04 — Is a stronger/newer model required, or does the current one just need better inputs?

**Positions:**
- Kiro (GPT-02/K-A3 adjacent): hardcoded `gpt-4o-mini` is verified; whether an upgrade
  is *needed* is NOT verified — "cannot be resolved by code audit alone."
- Kimi: agrees, adds that no latency/cost SLO exists to even evaluate against, and flags
  GPT's mentioned "GPT-5.6 Luna/Sol" model names as `[UNVERIFIED]` against live docs.
- GPT (Phase 2, self-challenge): accepts Kiro's and Kimi's challenge — "an upgrade is not
  [verified]. Benchmark first."

**Evidence available:** None of the four audits ran an actual benchmark. This is a
planning gap, not a code defect.

**Resolution:** RESOLVED BY UNANIMOUS WITHDRAWAL OF THE STRONG CLAIM. No one is
maintaining "a bigger model is needed" as a settled finding. Reframe as an open task:
define an SLO (Kimi's proposal: p95 first-token latency, full tool-loop time, $/admin-
month ceiling, max tool calls per query), then benchmark current model vs. at least one
alternative against real DriveBook cases.

---

## Disagreements not yet reachable

Several potential disagreements can't be evaluated yet because Kimi and Kiro have not
produced Phase 2 cross-reviews. In particular: whether Kiro's KIRO-A-04 (three
inconsistent revenue ledgers) and GPT-06 (WalletTransaction-as-revenue) describe the same
underlying gap or two different ones is unresolved — GPT's Phase 2 review treated them as
related but did not fully reconcile the two framings.


# Evidence Gaps

Concrete verification tasks required before findings in CLAIMS-MATRIX.md can move from
VERIFIED-by-static-read to fully CLOSED. Each gap names what evidence would resolve it,
not just that more evidence is needed.

| ID | Gap | Blocks which finding(s) | What would close it | Owner action needed |
|---|---|---|---|---|
| EG-01 | Whether the values in `docs/pr/CREDENTIAL_ROTATION_CHECKLIST.md` are currently live | CLAIMS-MATRIX row 7 | Direct confirmation via each provider's dashboard (Stripe, Twilio, OpenAI, VAPI, Cloudinary, Upstash, Supabase, Google Cloud console) — never by testing the credential itself | Repo owner / whoever holds provider access |
| EG-02 | Whether `DrivingProviderProfile` records exist for all approved providers, or only some | CLAIMS-MATRIX row 2 fix strategy | A production or staging query counting `Provider` rows with `approvalStatus = 'APPROVED'` and no corresponding `DrivingProviderProfile` row — a join-based fix could silently return null for those | DB access holder |
| EG-03 | Whether external error monitoring (Sentry/Datadog/etc.) already catches the `.catch()` suppressions at the ops layer | CLAIMS-MATRIX row 1 severity | Check monitoring dashboard/config for alerts tied to the specific catch blocks in `lib/admin/ai-tools.ts` | Whoever owns observability tooling |
| EG-04 | Count of `Provider` records with `paymentMode = 'DIRECT'` in production | CLAIMS-MATRIX row 11 | A production query; determines whether the wallet-CREDIT-as-revenue gap is theoretical or materially undercounts revenue today | DB access holder |
| EG-05 | Authoritative DriveBook definition of "failed payment" vs. the code's proxy (`PENDING_PAYMENT` booking status) | CLAIMS-MATRIX row 11 (adjacent) | Financial doctrine document or a decision from whoever owns payment semantics | Product/finance owner |
| EG-06 | Actual DriveBook-scenario benchmark data comparing `gpt-4o-mini` against at least one alternative model | Disagreement D-04 | Run defined test scenarios (booking-failure investigation, revenue anomaly, instructor-risk identification) against current model and 1+ alternative; score correctness, tool-selection accuracy, reasoning quality | Whoever can run/fund the benchmark |
| EG-07 | Whether a database-level TTL or platform retention policy applies to `AuditLog` records storing admin Copilot queries | CLD-14 / K-B3 (query-logging privacy) | Check DB schema / Supabase retention config directly | DB/platform owner |
| EG-08 | Adversarial test of the prompt-injection reachability path (a crafted `provider.name` run through the live tool-calling loop) | CLAIMS-MATRIX row 4 | A staged test in a non-production environment, checking whether the existing system prompt's instructions are sufficient to resist an embedded instruction in tool output | Whoever can run a staging test safely |
| EG-09 | Whether `PLATFORM_COPILOT_VIEW` permission is intentionally sufficient for all platform-wide data the Copilot's 8 tools currently expose | GPT-13 | Map: role → Copilot permission → tools → returned fields → sensitive-data classification, checked against RBAC design intent | RBAC/permissions owner |
| EG-10 | A second independent code read of `middleware.ts` | CLD-07 (currently single-source, Claude only) | Any second auditor reading the file and confirming or refuting the `publicPaths` dead-code claim | Any subsequent auditor pass |
| EG-11 | Kimi's and Kiro's Phase 2 cross-reviews | Several CLAIMS-MATRIX rows marked PROVISIONAL | Both models need to actually read the other three Phase 1 audits and produce `02-cross-review/kimi-review-of-others.md` and `kiro-review-of-others.md` | Whoever runs Kimi's and Kiro's sessions |
| EG-12 | Whether `docs/pr/CREDENTIAL_ROTATION_CHECKLIST.md` and root `.credentials` are the only credential-adjacent files in the repo, or whether others exist | CLAIMS-MATRIX rows 7, 9 | A repo-wide search for credential-pattern files/filenames beyond the two already found | Any auditor with repo search access |

## Gaps that cannot be closed by any AI auditor, regardless of access

EG-01, EG-04, EG-05, EG-06, EG-07, and EG-09 all require either production data access,
a business/financial policy decision, or resources (a funded benchmark run) that sit
outside what static code reading — by any model — can resolve. These should be assigned
human owners now rather than carried forward as open audit findings indefinitely.