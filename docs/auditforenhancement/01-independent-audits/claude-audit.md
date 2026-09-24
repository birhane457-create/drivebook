# Claude Independent Audit

Status: Phase 1 — independent. I have not read gpt-audit.md, kimi-audit.md, or kiro-audit.md.
Scope tags: [A] AI architecture · [B] Security/privacy · [C] Business correctness (per AUDIT-SCOPE perspectives)

## Methodology note

Findings below come from direct inspection of the DriveBook repository (main @ 342f8e2, and the
drivebook-hybrid voice microservice within it) across several turns of independent code reading —
not from assumptions or the repo's own documentation claims. Where I relied on a doc's claim rather
than verifying it in code myself, that is stated under "Assumptions" for that finding. One informal
audit document was shared with me by the repository owner mid-session, before this formal multi-model
process existed; where it overlaps with a finding below, I re-verified against the code independently
and note where my read confirms, sharpens, or diverges from it.

---

## Findings

### CLD-01 — Live, unrotated credentials committed to the repository [B]
**Evidence:** `docs/pr/CREDENTIAL_ROTATION_CHECKLIST.md`, lines 14–54.
**Current behaviour:** The file lists what read as real values for `DATABASE_URL`/`DIRECT_URL`
(Supabase), `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TWILIO_AUTH_TOKEN`,
`OPENAI_API_KEY`, `SMTP_PASS`, `VAPI_WEBHOOK_SECRET`, `VAPI_API_KEY`, `CLOUDINARY_API_SECRET`,
`UPSTASH_REDIS_REST_TOKEN`/`KV_REST_API_TOKEN`, and `GOOGLE_CLIENT_SECRET`. The file's own header
states `Status: NOT ROTATED`.
**Impact:** Full compromise surface across DB, auth session signing, payments, SMS, AI providers,
email, voice webhook auth, media storage, rate-limit store, and OAuth. Directly relevant to this
audit because `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`-adjacent flow, and `VAPI_API_KEY` are among the
exposed values — the Copilot and voice layer under audit are running on credentials that need
rotation regardless of any AI architecture finding.
**Assumptions:** I did not attempt to use any value to confirm liveness (would be inappropriate).
Treating as live is the only safe assumption given the file's own status marker.
**Evidence required to verify unresolved claims:** None — the file and its stated status are
sufficient to act on. Confirming actual liveness is Anthropic's/the owner's action via each
provider's dashboard, not something to verify by testing the credential.
**Severity:** CRITICAL.
**Disposition:** FIX REQUIRED — immediate rotation of every listed credential, plus git-history
purge (not just file deletion, which the checklist itself under-scopes at step 4).

### CLD-02 — Account takeover via shared `resetToken` column [B]
**Evidence:** `verifications/otp/confirm/route.ts` (writes `verified:<hex>` into `User.resetToken`,
no purpose binding); `auth/set-password/route.ts` (accepts any string found in `resetToken`, sets a
new password); `auth/reset-password/route.ts` line 22 (takes `token` from `req.json()` with no type
guard, then `findFirst({ where: { resetToken: token } as any })` — Prisma accepts a filter object
here, not just a string, since the value is unchecked).
**Current behaviour:** OTP verification tokens and password-reset tokens share one untyped column
with no purpose, expiry enforcement at the query layer, or consumption guarantee.
**Impact:** An attacker who completes OTP verification for a target phone/email (see CLD-03) can set
that account's password directly, including admin accounts — `verifications/otp/route.ts` looks up
users by email or phone with no role filter.
**Assumptions:** None — read directly in all three files.
**Evidence required to verify unresolved claims:** A staging-environment reproduction is the
remaining step before treating this as field-confirmed rather than code-confirmed.
**Severity:** CRITICAL.
**Disposition:** FIX REQUIRED.

### CLD-03 — OTP brute-force protection does not hold under real deployment [B]
**Evidence:** `verifications/otp/confirm/route.ts` — `failedAttempts` is a plain in-memory `Map`,
keyed by caller-supplied identifier, unpruned, not shared across serverless instances.
**Current behaviour:** Lockout state resets on cold start and does not synchronize across concurrent
instances; the 3-per-hour send limit is keyed on the raw phone/email string before normalization, so
trivially formatted variants of the same number bypass it.
**Impact:** Materially weakens the OTP gate that CLD-02 depends on.
**Assumptions:** None — read directly.
**Severity:** HIGH.
**Disposition:** FIX REQUIRED — move attempt/lockout state to Redis or the DB, normalize identifiers
before keying.

### CLD-04 — Unauthenticated SMS-sending endpoint in the voice microservice [A][B]
**Evidence:** `drivebook-hybrid/middleware/auth.js` — both `verifyVapiSecret` and `restrictAccess`
explicitly exempt `/api/bookings` and `/api/instructor` as "legacy local endpoints." Neither
`drivebook-hybrid/routes/booking-api.js` nor `instructor-api.js` adds its own auth. `booking-api.js`
calls `smsService.sendBookingConfirmation` with a caller-supplied `clientPhone`.
**Current behaviour:** `POST /api/bookings` on the deployed voice service is reachable by anyone with
no key or signature, writes to a separate legacy MongoDB store (confirmed live — `utils/config.js`
requires `DATABASE_URL` and fails startup without it in production), and sends a real Twilio SMS to
an arbitrary attacker-supplied number. Only a 60-req/min/IP limiter applies.
**Impact:** Free, unauthenticated SMS relay against the platform's own Twilio account; usable for
harassment or cost abuse. The confirmation owner said Mongo is legacy and Postgres is canonical,
which means this route's writes are also functionally orphaned — nothing reads them — so the route
has no remaining purpose beyond the SMS side effect.
**Assumptions:** None — read directly across `auth.js`, `booking-api.js`, `instructor-api.js`, and
`utils/config.js`.
**Severity:** CRITICAL.
**Disposition:** FIX REQUIRED — delete the route and its Mongo dependency rather than gate it, per
the repo owner's own confirmation that Mongo is legacy.

### CLD-05 — Pre-account hijacking via public bulk booking endpoint [B][C]
**Evidence:** `app/api/public/bookings/bulk/route.ts`, lines 264–309 (account creation from an
unverified submitted email) and 393–398 (setup link sent to submitter-supplied phone).
**Current behaviour:** A caller can register an account under any email address with no verification
step before a password-capable setup link is issued.
**Impact:** An attacker can pre-register a victim's email and later gain control of the account.
**Severity:** HIGH.
**Disposition:** FIX REQUIRED — do not create a password-capable account before the email channel is
verified.

### CLD-06 — Public booking endpoint's access model rests on a false premise [B]
**Evidence:** `app/api/public/bookings/[id]/route.ts` (comment claims IDs are "unguessable UUID v4");
`prisma/schema.prisma` line 236, `Booking.id String @id @default(cuid())`.
**Current behaviour:** Booking IDs are `cuid()`s, not UUIDv4s. The endpoint returns pickup address,
time, price, and provider details to any holder of the ID, and its phone-match fallback path has no
rate limit.
**Impact:** Whatever informal guessing resistance the design assumes does not match the actual ID
scheme; this needs re-evaluation as an access-control question, not an entropy question.
**Severity:** HIGH.
**Disposition:** NEEDS VERIFICATION on real-world guessability of cuid() at this table's volume,
FIX REQUIRED on the missing rate limit regardless of that outcome.

### CLD-07 — Edge middleware's defence-in-depth block is unreachable [B]
**Evidence:** `middleware.ts` — `publicPaths` includes `'/'`, matched with `startsWith`.
**Current behaviour:** Because `'/'` is a prefix of every path, the "protected route" branch never
executes; every request is treated as public at the edge layer.
**Impact:** This is not a live hole by itself — handlers still check sessions independently — but it
means the stated defence-in-depth layer is dead code, so any handler that forgets its own check is
unprotected with no edge backstop.
**Severity:** MEDIUM-HIGH (architectural gap, not a demonstrated live bypass).
**Disposition:** FIX REQUIRED — match `'/'` exactly; check protected prefixes before the public list.

### CLD-08 — Copilot `getInstructorRisk`: licence-expiry check silently never fires [A][C]
**Evidence:** `lib/admin/ai-tools.ts` line 119, Prisma `select` includes `insuranceExpiry` and
`wwcCheckExpiry` but not `licenseExpiry`; line 156 reads `inst.licenseExpiry` regardless.
**Current behaviour:** `inst.licenseExpiry` is always `undefined` for every instructor scored, so the
"Licence expiring/expired" flag never triggers, with no error surfaced anywhere.
**Impact:** The Copilot's instructor-risk tool silently omits an entire risk category. An admin
asking "which instructors have expiring documents" gets an answer that looks complete but is missing
a whole check.
**Assumptions:** None — read directly; this is a code-level fact, not an inference.
**Severity:** HIGH.
**Disposition:** VERIFIED, FIX REQUIRED.

### CLD-09 — Copilot `getDailySummary`: `expiringCount` query is a no-op filter [A][C]
**Evidence:** `lib/admin/ai-tools.ts` line 44:
`OR: [{ /* licenseExpiry moved to DrivingProviderProfile */ }, { /* insuranceExpiry moved ... */ }]`.
**Current behaviour:** An `OR` of two empty objects matches every row, so the query counts every
`APPROVED` provider, not providers with expiring documents. The count is not stale or conservative —
it is a different, unrelated number wearing the field name `expiringCount`.
**Impact:** Any Copilot answer that cites "expiring docs" from `getDailySummary` is currently
reporting total approved-provider count. This is more severe than "needs schema verification" (the
disposition an earlier informal audit gave it) — it's independently confirmable as broken from the
query alone, without needing to know where the fields live now.
**Severity:** HIGH.
**Disposition:** VERIFIED, FIX REQUIRED — rebuild the filter against wherever expiry fields actually
live (reportedly `DrivingProviderProfile`; I have not independently confirmed that model's shape).

### CLD-10 — Tool layer cannot distinguish "zero" from "query failed" [A]
**Evidence:** Pervasive pattern across `lib/admin/ai-tools.ts`, e.g. lines 36–45, 71–80, 122–133,
191–199, 222–229 — every DB call is wrapped `.catch(() => 0)` or `.catch(() => [])` or
`.catch(() => ({ _sum: { amount: 0 } }))`.
**Current behaviour:** A failed query and a genuinely empty result are structurally identical in the
returned JSON.
**Impact:** The model has no way to know when it should say "I couldn't verify this" versus "there
are zero of these." This is architecture-wide, not confined to the two fields above — CLD-08 and
CLD-09 are the two instances I could concretely demonstrate as *already wrong in practice*; the
broader pattern means more instances likely exist un-triggered.
**Severity:** HIGH.
**Disposition:** FIX REQUIRED — every tool should return a SUCCESS/EMPTY/PARTIAL/ERROR-shaped result,
per AUDIT-RULES's own stated principle ("empty, unavailable, partial, and error states must remain
distinguishable").

### CLD-11 — Concrete prompt-injection vector: `provider.name` reaches model context unfiltered [A][B]
**Evidence:** `lib/admin/ai-tools.ts` `getInstructorRisk` returns `name: inst.name` verbatim (line
168); `app/api/admin/ai-query/route.ts` line 202 serializes tool results with
`JSON.stringify(toolResult)` directly into the message history sent back to the model.
**Current behaviour:** `Provider.name` is user-set at signup and flows into the LLM's context with no
sanitization or framing that marks it as untrusted data.
**Impact:** This is the first concretely reachable instance of the injection surface AUDIT-RULES
already names as a principle ("user/database content is untrusted data, not instructions") — not
demonstrated as exploited, but demonstrated as reachable, which is a stronger claim than "could
happen later."
**Assumptions:** I have not attempted an actual injection string against a running instance — no
environment to test against. This is a data-flow finding, not an exploitation finding.
**Evidence required to verify unresolved claims:** A test case with an adversarial provider name run
against the live tool-calling loop, checking whether the system prompt's existing instructions
("never make up data," etc.) are sufficient to resist it.
**Severity:** MEDIUM-HIGH pending that test.
**Disposition:** NEEDS VERIFICATION on exploitability; VERIFIED on reachability.

### CLD-12 — No DriveBook knowledge layer, no eval suite, no persistent AI memory [A]
**Evidence:** `app/api/admin/ai-query/route.ts` — the entire domain-knowledge surface is the
`SYSTEM_PROMPT` constant (lines 18–32) plus `TOOL_DEFINITIONS`; `MAX_HISTORY = 20` caps context to
recent messages only, with nothing written back to a durable store; no test/eval files reference the
Copilot's tool outputs against expected behaviour.
**Current behaviour:** The Copilot reasons from ad hoc system-prompt text and live tool output only.
Nothing an admin tells it persists past the current browser session's message list.
**Impact:** Answers about DriveBook's actual business rules (booking lifecycle, payout rules, RBAC,
etc.) depend entirely on what the model already knows generically plus whatever a tool call returns —
there is no authoritative, versioned source of DriveBook-specific rules it consults.
**Severity:** HIGH (architecture — not an active incident).
**Disposition:** VERIFIED, FIX REQUIRED as part of the architecture plan, not urgent relative to
CLD-01–CLD-07.

### CLD-13 — Anthropic fallback path is a materially different, weaker system [A]
**Evidence:** `app/api/admin/ai-query/route.ts` lines 223–241 — the Anthropic path pre-fetches exactly
four tools (`getDailySummary`, `getHealthScore`, `getInstructorRisk`, `getWeeklyReport`) and does a
single-shot call with no further tool access, versus the OpenAI path's dynamic multi-round
tool-calling loop (`MAX_ROUNDS = 5`).
**Current behaviour:** If `OPENAI_API_KEY` is absent or fails, a question about suburb demand or
student retention gets answered by a model that was never given those tools' data.
**Impact:** Silent capability degradation depending on which key is configured — an admin has no way
to know which mode they're in from the response.
**Severity:** MEDIUM.
**Disposition:** VERIFIED, FIX REQUIRED — either give the fallback the same tool set or surface which
mode answered.

### CLD-14 — Admin question text stored unredacted with no retention policy [B]
**Evidence:** `app/api/admin/ai-query/route.ts` line 54, `question: opts.question.slice(0, 500)`
written into `AuditLog.metadata`.
**Current behaviour:** Up to 500 characters of whatever the admin typed is stored verbatim, forever,
with no stated retention window or access restriction beyond whatever generally governs `AuditLog`.
**Impact:** An admin investigating something sensitive (a dispute, a specific customer's payment
issue) has their query text permanently retained without a defined policy for who can read it or how
long it lives.
**Severity:** MEDIUM.
**Disposition:** FIX REQUIRED — define retention, access, and redaction policy; this is a policy gap
more than a code bug.

### CLD-15 — Read-only Copilot security boundary is correctly implemented [A][B] — positive control
**Evidence:** `app/api/admin/ai-query/route.ts` lines 98–101 (`requirePermission` before any tool
executes, server-side, not model-trusted); `lib/admin/ai-tools.ts` lines 385–397, `callTool` is a
hardcoded `switch` with a `throw` default — no dynamic property access, no raw SQL, no arbitrary
Prisma construction from model output.
**Current behaviour:** The AI cannot reach any function outside the eight whitelisted, read-only
tools, and permission is checked before the tool-calling loop starts, not inside it.
**Impact:** This is the one part of the Copilot I would explicitly protect from being loosened while
fixing everything else — CLD-08 through CLD-13 are about data quality and architecture, not about
this boundary, and the fixes for those should not touch it.
**Severity:** N/A — positive finding.
**Disposition:** VERIFIED, INFORMATIONAL. Preserve as-is.

---

## Assumptions

- I have not run the application; every finding above is static-code-verified against the indexed
  repository, not runtime-verified, except where a finding explicitly says otherwise.
- `DrivingProviderProfile` is assumed (not independently confirmed by me) to be the current home of
  `licenseExpiry`/`insuranceExpiry` per code comments and the repo owner's statement; CLD-08/CLD-09
  fixes depend on confirming that model's actual shape.
- I have not verified whether the credentials in CLD-01 are still live at the time of reading — I am
  treating the file's own "NOT ROTATED" status as sufficient grounds to require rotation regardless.

## Evidence gaps

- `TOOL_DEFINITIONS` (the OpenAI function-calling schema descriptions) — not yet read; could contain
  its own instruction-quality issues.
- `AdminAIChat` client component, including the `__ping__` probe pattern — not yet read.
- `getStudentRetention`, `getRevenueBreakdown`, `getSuburbDemand` bodies — partially read; not fully
  audited for the same catch-and-zero pattern confirmed elsewhere.
- No access to a running environment to test CLD-11's exploitability or CLD-03's actual lockout
  behaviour under concurrent load.

## Security observations

CLD-01 through CLD-07 are platform-wide, not Copilot-scoped, but AUDIT-RULES explicitly states
"security incidents are not buried inside feature work" — and CLD-01 in particular directly
implicates the credentials this very AI system runs on. I'm treating disclosure of these as in-scope
and urgent regardless of how the final architecture work is prioritized.

## Final position

The Copilot's core security boundary (CLD-15) is sound and should not be touched. Everything else
about the Copilot — knowledge layer, eval suite, persistent memory, fallback parity — is real
architecture debt (CLD-12, CLD-13) but not urgent relative to two things that are: the data-quality
bugs that are already producing wrong numbers today (CLD-08, CLD-09, and by extension CLD-10 as the
pattern behind them), and the platform-wide security findings (CLD-01 through CLD-07) that exist
independent of any AI work and should not wait for the AI architecture project to conclude.

## Evidence that would change my position

- A working `DrivingProviderProfile` schema dump showing the expiry fields already correctly wired
  elsewhere would downgrade CLD-08/CLD-09's severity if `getInstructorRisk`/`getDailySummary` turn
  out to be dead code no longer called from the live Copilot UI — I did not verify call-site reachability
  from `AdminAIChat`, only that the functions exist and would misbehave if invoked.
  - A demonstrated failed exploitation attempt against CLD-11 under the current system prompt would
  lower it from MEDIUM-HIGH to INFORMATIONAL.
- Confirmation that `docs/pr/CREDENTIAL_ROTATION_CHECKLIST.md` was already rotated between my read and
  now would not lower CLD-01's disposition, only its currency — the file needs deletion from history
  either way.