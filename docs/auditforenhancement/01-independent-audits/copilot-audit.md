# Assistant Independent Audit

Status: INDEPENDENT AUDIT — Phase 1
Date: 2026-09-24
Scope: DriveBook admin Copilot implementation and supporting architecture

## Method
I reviewed the live implementation in the DriveBook repo rather than inheriting prior audit conclusions. I focused on the admin Copilot API route, the tool layer, the client, and the supporting contract code.

Evidence labels used: SOURCE CODE FACT, DOCUMENTATION CLAIM, INFERENCE, PRODUCTION FACT, UNKNOWN.

---

## A-01 — Audit logging is still non-fatal and misstates the actor role

Disposition: FIX REQUIRED
Severity: MEDIUM
Evidence: SOURCE CODE FACT

Evidence:
- `drivebook/app/api/admin/ai-query/route.ts`
  - `logAIQuery()` writes `actorRole: 'ADMIN'` unconditionally
  - The catch block logs to console and explicitly allows the request to continue if audit write fails
- `drivebook/lib/auth/requireRole.ts` and RBAC permission model indicate role-based access exists beyond a single admin role

Current behaviour:
- The audit trail does not record the real authenticated role.
- If writing the audit log fails, the system still answers the user instead of escalating or failing closed.

Impact:
- Operational auditability is weakened.
- Security and compliance review cannot rely on the trail to reflect the actual actor.
- A failed audit write can silently degrade compliance posture.

Assumptions:
- The platform expects audit logs to be authoritative and role-aware.
- The requirement is not merely “best effort” event recording.

Evidence required to verify unresolved claims:
- Confirm whether the compliance policy requires fail-closed or fail-open behaviour for audit failures.
- Confirm whether actorRole values should reflect `ADMIN`, `SUPER_ADMIN`, or a more granular role model.

---

## A-02 — Tool arguments are still loosely validated despite the read-only boundary

Disposition: FIX REQUIRED
Severity: HIGH
Evidence: SOURCE CODE FACT

Evidence:
- `drivebook/app/api/admin/ai-query/route.ts`
  - model tool-call arguments are parsed with `JSON.parse(tc.function?.arguments ?? '{}')`
  - the arguments are passed straight into `callTool(name, args)`
- `drivebook/lib/admin/ai-tools.ts`
  - `callTool` switches on a string name and passes `args as any` without server-side schema validation or constraining numeric ranges

Current behaviour:
- The model is effectively trusted to produce a valid argument object for every tool call.
- The server does not enforce a strict schema before the call executes.

Impact:
- A malicious or faulty model output can trigger unsupported parameter combinations.
- The shape and limits of tool inputs are not checked at the API boundary.
- This increases the risk of unexpected Prisma queries or accidental misuse of downstream business logic.

Assumptions:
- The tool layer is intended to be a controlled read-only surface, not a free-form data access API.

Evidence required to verify unresolved claims:
- Verify whether all admin tools already have explicit runtime validation for types, ranges, required fields, and nullability.
- Review whether the API should reject malformed tool arguments before any database read.

---

## A-03 — Provider fallback is still structurally unequal

Disposition: FIX REQUIRED
Severity: HIGH
Evidence: SOURCE CODE FACT

Evidence:
- `drivebook/app/api/admin/ai-query/route.ts`
  - OpenAI path: tool-calling loop with up to 5 rounds and `TOOL_DEFINITIONS`
  - Anthropic path: prefetches only `getDailySummary`, `getHealthScore`, `getInstructorRisk`, and `getWeeklyReport`, then sends a single-shot prompt using a synthetic context block

Current behaviour:
- The same user question can receive materially different evidence depending on whether OpenAI or Anthropic is active.
- The fallback path does not enforce the same tool contract or evidence breadth as the primary path.

Impact:
- Model/provider choice affects answer quality and data availability.
- The system can silently degrade in ways that are not visible to the operator.
- This violates the architectural requirement for provider-neutral orchestration.

Assumptions:
- The admin AI is meant to behave consistently regardless of provider.

Evidence required to verify unresolved claims:
- Benchmark the same admin tasks against both providers with equal tool access.
- Document whether fallback is intentionally degraded or whether the architecture is expected to maintain parity.

---

## A-04 — The untrusted-data boundary is still not explicit enough in the system prompt and tool pipeline

Disposition: FIX REQUIRED
Severity: HIGH
Evidence: SOURCE CODE FACT

Evidence:
- `drivebook/app/api/admin/ai-query/route.ts`
  - `SYSTEM_PROMPT` warns the model to be concise and direct but does not explicitly say that all database, user, and tool text is untrusted and must not be treated as instructions
- Tool outputs are directly inserted into the message history as JSON strings from `callTool()` results

Current behaviour:
- User text, database-derived text, and tool output all sit in the same conversational context without a clear trust boundary.
- The prompt still relies on behavioural discipline rather than a structural separation pattern.

Impact:
- Prompt-injection and data-poisoning risks remain more exposed than they need to be.
- Any future tool output that contains attacker-controlled text could affect the model’s reasoning or behaviour.

Assumptions:
- The model should never treat a DB value as instruction content.

Evidence required to verify unresolved claims:
- Run adversarial staging tests with prompt-injection payloads embedded in booking/customer names, payout notes, dispute text, or address strings.
- Confirm whether the model is receiving a dedicated evidence envelope instead of raw data in instruction position.

---

## A-05 — The client uses a real AI endpoint as a configuration probe

Disposition: NEEDS VERIFICATION
Severity: MEDIUM
Evidence: SOURCE CODE FACT

Evidence:
- `drivebook/components/admin/AdminAIChat.tsx`
  - `useEffect()` sends `POST /api/admin/ai-query` with `messages: [{ role: 'user', content: '__ping__' }]`

Current behaviour:
- The UI probes AI availability by calling the production AI endpoint, not a separate health/status route.
- This can create real query logs, rate-limit consumption, and unnecessary AI calls during simple UI initialization.

Impact:
- A health check can become a noisy operational event.
- It may distort usage metrics or trigger unnecessary provider costs.

Assumptions:
- The chat widget is allowed to hit the LLM endpoint as a lightweight readiness check.

Evidence required to verify unresolved claims:
- Confirm whether this call is counted as a normal AI query for billing, logs, and rate limiting.
- Decide whether a dedicated status probe should replace the production path.

---

## A-06 — The admin tool contract is improved, but the API still returns unstructured JSON and lacks a strict evidence envelope

Disposition: FIX REQUIRED
Severity: MEDIUM
Evidence: SOURCE CODE FACT

Evidence:
- `drivebook/lib/admin/tool-contracts.ts` defines a clean `ToolResult<T>` contract
- `drivebook/lib/admin/ai-tools.ts` uses this contract for some tools, but `callTool` still returns legacy `Record<string, any>` for many functions and the API route serializes tool outputs directly into the chat context

Current behaviour:
- The system has a contract layer, but the public route still treats tool output as opaque JSON instead of enforcing a consistent evidence structure.
- This makes it harder to reason about status, missing data, partial failure, and provenance.

Impact:
- Some parts of the system can still present business results without a clear provenance record.
- Error states are easier to blur with empty or partial business data.

Assumptions:
- The architecture is intended to distinguish `SUCCESS`, `EMPTY`, `PARTIAL`, `ERROR`, and `UNKNOWN` at every layer.

Evidence required to verify unresolved claims:
- Review all tool call sites and confirm whether every tool returns the same contract shape before it reaches the model.
- Confirm whether the model prompt distinguishes evidence from recommendation and inference.

---

## Summary assessment

The repo has substantially improved from the earlier zero/empty result bug pattern. The introduction of `tool-contracts.ts` is a real step forward and is the strongest sign that the project is moving toward evidence-aware handling.

However, the implementation still has important gaps in the following areas:
- audit integrity and role fidelity
- strict tool argument validation
- provider parity and evidence parity
- explicit trust boundaries for untrusted database content
- status-check design for the UI

This is not a “model problem”; it is a system-design problem. The architecture is closer to operationally usable than the original audit suggested, but it is not yet mature enough to be described as fully robust.

## Recommended next priorities
1. Fix audit/logging semantics and actor-role fidelity.
2. Add strict server-side validation for every tool argument and reject malformed tool inputs early.
3. Force provider-neutral evidence access before any further model or tool expansion.
4. Add explicit untrusted-data envelopes and adversarial prompt-injection tests.
5. Replace the ping call with a dedicated health route to avoid production AI calls during startup.
