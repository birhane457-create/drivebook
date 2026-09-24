# GPT Independent Audit

Status: INDEPENDENT AUDIT — Phase 1
Branch: audit/ai-enhancement-multimodel

## Method

I inspected the current Copilot route, client, tool implementation, tool schemas, Prisma schema, RBAC references, and AI governance documentation. I did not use the other model audits during this phase.

Evidence labels: SOURCE CODE FACT, DOCUMENTATION CLAIM, INFERENCE, PRODUCTION FACT, UNKNOWN.

## GPT-01 — Tool failures are converted into successful-looking data

Disposition: FIX REQUIRED
Severity: HIGH
Evidence: SOURCE CODE FACT

lib/admin/ai-tools.ts defines ToolResult as Record<string, unknown>. Multiple database calls use catch handlers that return 0, empty arrays, or zero aggregates.

Impact: the model cannot distinguish legitimate zero/empty results from database failure or partial failure. This can produce a false operational conclusion.

Required direction: introduce a versioned common result envelope with SUCCESS, EMPTY, PARTIAL and ERROR states, plus metadata and error details. Never silently convert operational failures into zeros.

## GPT-02 — Instructor-risk tool is inconsistent with the current Prisma schema

Disposition: VERIFIED SOURCE MISMATCH; runtime impact requires test
Severity: HIGH
Evidence: SOURCE CODE FACT + SCHEMA FACT

getInstructorRisk selects insuranceExpiry and wwcCheckExpiry from provider and later reads licenseExpiry. The current Prisma architecture separates generic Provider from DrivingProviderProfile, and repository verification documentation states Provider has zero expiry fields while DrivingProviderProfile contains the driving-specific expiry fields.

Inference requiring runtime confirmation: the Prisma call may fail against the generated client. The exact runtime behaviour must be tested rather than assumed.

Required test: run the tool against controlled fixtures and verify query execution, expiry values, risk score, and absence of swallowed schema errors.

## GPT-03 — Daily-summary expiring-document query is incomplete

Disposition: FIX REQUIRED / VERIFY WITH TEST
Severity: HIGH
Evidence: SOURCE CODE FACT

getDailySummary calculates thirtyDaysFromNow but its expiring-document query contains placeholder empty OR predicates instead of actual expiry conditions. The thirty-day value is not used by that query.

Impact: expiringDocs cannot currently be treated as a trustworthy expiry metric.

Required remediation: query DrivingProviderProfile using the current schema and explicitly test licence, insurance, police-check and WWC expiry states.

## GPT-04 — Health score masks data-source failure as a normal score

Disposition: FIX REQUIRED
Severity: HIGH
Evidence: SOURCE CODE FACT

getHealthScore uses non-fatal database calls that convert failures to zero or zero aggregates, then produces a normal 0–100 score.

Impact: a database failure can result in a plausible health score rather than an unavailable/partial state.

Required direction: expose signal-level availability and avoid presenting a normal score when required inputs are unavailable.

## GPT-05 — Health score payment signal may not represent failed payments

Disposition: NEEDS VERIFICATION
Severity: MEDIUM/HIGH
Evidence: SOURCE CODE FACT

The variable named failedPayments is derived from bookings whose status is PENDING_PAYMENT. That is not inherently the same as failed payment attempts.

Required evidence: establish the authoritative DriveBook definition of payment failure and compare it with this implementation using fixtures.

## GPT-06 — Revenue tools use wallet credits as revenue without an explicit accounting definition

Disposition: NEEDS VERIFICATION
Severity: MEDIUM/HIGH
Evidence: SOURCE CODE FACT

Several tools aggregate WalletTransaction records with type CREDIT and expose the result as revenue. The repository also has ledger, payout, refund and Stripe concepts.

Risk: a wallet credit may not be equivalent to recognised revenue unless DriveBook explicitly defines it that way.

Required evidence: map WalletTransaction types to the authoritative accounting meaning and reconcile the AI metric against the financial ledger/payment source.

## GPT-07 — Student retention uses mismatched cohorts

Disposition: NEEDS VERIFICATION / LIKELY LOGIC DEFECT
Severity: MEDIUM
Evidence: SOURCE CODE FACT

recentBookers is customers with bookings in the last 30 days. repeatBookers is customers with more than one booking during the last 60 days. The return rate divides the latter by the former.

A customer can be a repeat booker in days 31–60 without belonging to the recent 30-day denominator cohort.

Required remediation: define the cohort first and calculate repeat behaviour against that same cohort. Add boundary fixtures.

## GPT-08 — Suburb demand silently samples 500 bookings

Disposition: FIX REQUIRED
Severity: MEDIUM
Evidence: SOURCE CODE FACT

getSuburbDemand retrieves at most 500 qualifying bookings and then calculates suburb counts locally.

Impact: above 500 bookings, the result is not a complete 30-day ranking and the limitation is not disclosed.

Required direction: aggregate using a canonical suburb field in the database, or explicitly expose sampling metadata.

## GPT-09 — Suburb extraction from address strings is fragile

Disposition: NEEDS VERIFICATION
Severity: MEDIUM
Evidence: SOURCE CODE FACT

The tool derives suburb by splitting pickupAddress on commas and taking the second-last element.

Risk: this assumes a stable address format and is not equivalent to canonical geographic normalisation.

## GPT-10 — Tool arguments are not strongly validated independently of the model

Disposition: FIX REQUIRED
Severity: MEDIUM
Evidence: SOURCE CODE FACT

The API parses model-supplied JSON and passes it to callTool. The dispatcher uses any casts. Tool schemas describe numeric parameters but do not provide comprehensive runtime validation.

Risk: an LLM is an untrusted caller. Tool arguments require server-side validation.

## GPT-11 — Copilot audit records hard-code actorRole as ADMIN

Disposition: NEEDS VERIFICATION
Severity: MEDIUM
Evidence: SOURCE CODE FACT

logAIQuery writes actorRole as ADMIN even though authorisation is permission-based and the repository contains SUPER_ADMIN and other RBAC concepts.

Risk: audit records may misrepresent the authenticated actor.

## GPT-12 — Copilot audit logging is non-fatal despite documentation requiring every query to be logged

Disposition: NEEDS SECURITY/POLICY DECISION
Severity: MEDIUM
Evidence: SOURCE CODE FACT

logAIQuery catches audit-write failures and allows the AI response to continue. Repository documentation says every Copilot query must be logged.

Important nuance: fail-closed is not automatically correct; the security and availability requirements must determine the policy.

## GPT-13 — Copilot data scope needs an explicit access model

Disposition: NEEDS VERIFICATION
Severity: HIGH if broad access is not intended
Evidence: SOURCE CODE FACT + SECURITY INFERENCE

A single PLATFORM_COPILOT_VIEW permission gates tools exposing platform-wide revenue, instructor risk, student retention, suburb demand, disputes and operations.

This may be intentional for trusted administrators, but the assumption should be explicit.

Required verification: map role -> Copilot permission -> tools -> returned fields -> sensitive data classes.

## GPT-14 — Prompt-injection defence is not explicit

Disposition: FIX REQUIRED
Severity: HIGH
Evidence: SOURCE CODE FACT

The system prompt contains no explicit untrusted-data boundary for database/user-controlled text. Tool outputs can contain database-derived strings.

Risk: richer future tools could expose text attempting to alter model instructions.

Required direction: treat all user/database/tool content as untrusted data and minimise unnecessary free-form text in tool results.

## GPT-15 — OpenAI and Anthropic fallback paths have different evidence availability

Disposition: FIX REQUIRED
Severity: MEDIUM
Evidence: SOURCE CODE FACT

OpenAI uses dynamic tool calling for up to five rounds. Anthropic fallback pre-fetches only Daily Summary, Health Score, Instructor Risk and Weekly Report.

Therefore provider selection can change what evidence is available for the same question.

Required direction: create provider-neutral orchestration so model choice does not change the evidence contract.

## GPT-16 — Configuration probe consumes the real AI endpoint

Disposition: INFORMATIONAL / LOW
Evidence: SOURCE CODE FACT

AdminAIChat sends a POST containing __ping__ to the real AI endpoint on mount. This passes through authentication, rate limiting and provider selection.

Required direction: use a lightweight configuration/status endpoint.

## GPT-17 — Conversation history is client-controlled input

Disposition: NEEDS VERIFICATION
Severity: MEDIUM
Evidence: SOURCE CODE FACT

The server accepts messages with generic string roles and content, then forwards history to the model. The client normally sends user/assistant messages, but the server should enforce the contract itself.

Required direction: validate role enum, content type, per-message length and total payload size; reject unexpected roles.

## Additional architectural observation

The current Copilot is primarily an analytics assistant, not yet an investigation engine.

A stronger architecture should distinguish:
- reporting tools: what is happening?
- investigation tools: why is it happening?
- evidence tools: what records prove it?
- policy knowledge: what should DriveBook do?
- recommendation: what should the human consider doing?

A knowledge layer must not become a second source of truth. Live values such as prices, commission rates and permissions should remain sourced from their authoritative code/configuration/database locations.

## Initial priority

P0 / separate security track:
- Verify any suspected live credential exposure.
- Verify any privilege or data-scope bypass.

P1:
1. GPT-01 tool result/error contract
2. GPT-02 schema mismatch
3. GPT-03 expiry query
4. GPT-04 health-score failure masking
5. GPT-14 untrusted-data boundary
6. GPT-13 explicit Copilot data-access model

P2:
- GPT-05 payment metric definition
- GPT-06 accounting/revenue definition
- GPT-07 retention cohort
- GPT-08 suburb sampling
- GPT-09 geographic normalisation
- GPT-10 argument validation
- GPT-15 provider-neutral orchestration
- GPT-12 audit policy alignment
- GPT-11 actor-role correctness
- GPT-17 request/history validation

P3:
- GPT-16 configuration probe

## What other auditors should challenge

1. Can GPT-02 be proven at runtime?
2. Is WalletTransaction CREDIT actually the approved DriveBook revenue definition?
3. Is PENDING_PAYMENT intentionally the payment-failure metric?
4. Is PLATFORM_COPILOT_VIEW intentionally sufficient for all platform-wide information?
5. Should Copilot audit logging fail closed or fail open?
6. Is the 500-booking suburb limit deliberate sampling?
7. Are there additional Copilot tools/routes I missed?
8. Does production configuration materially differ from repository code?
9. What security/data-leakage risks are not LLM-specific?
10. Which findings are architectural preferences rather than defects?

## Final position — Phase 1

The Copilot has a sound foundation in server-side permission checking, a read-only tool whitelist, bounded tool rounds, timeouts, token limits, and audit intent.

Its central weakness is evidence quality and domain grounding, not simply model intelligence.

The correct sequence is:

correct schema -> correct metrics -> explicit errors -> stable tool contracts -> controlled data scope -> untrusted-data boundary -> authoritative DriveBook knowledge -> evaluation -> model benchmark.

The goal is not to make the AI confidently answer more questions. The goal is to make it unable to confidently reason from incorrect, incomplete, or silently failed evidence.

## Evidence that would change my position

- Runtime evidence proving the apparently invalid schema fields are valid in the actual generated client/deployment.
- A documented financial definition proving wallet CREDIT is intentionally synonymous with revenue for these metrics.
- A documented definition proving PENDING_PAYMENT is the intended payment-failure signal.
- RBAC evidence proving all users with PLATFORM_COPILOT_VIEW are intentionally allowed the full platform-wide dataset.
- Evidence that the 500-row suburb limit is deliberate bounded sampling with disclosure.
- Production configuration showing a materially different AI/tool architecture.
