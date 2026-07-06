# OpenAPI Audit Report  DriveBook AI Voice Assistant

**Date:** $(Get-Date -Format "yyyy-MM-dd")
**Auditor:** Automated contract/spec cross-reference audit
**Scope:** `openapi.yaml`, `openapi-management.yaml`, `openapi-webhooks.yaml`, `drivebook-hybrid/openapi.yaml`, `main-app-proxy.js`, `contract.test.js`, prompt modules (`booking.md`, `cancellation.md`)

---

## Executive Summary

| # | Finding | Severity | Component Affected | Status |
|---|---------|----------|--------------------|--------|
| 1 | Response shape mismatch  `/public/bookings/bulk` |  CRITICAL | `openapi.yaml`, `contract.test.js`, main app server | Open |
| 2 | Wrong path in management spec  `/bookings/{bookingId}/cancel` |  HIGH | `openapi-management.yaml`, `cancellation.md`, `main-app-proxy.js` | Open |
| 3 | Cancellation policy endpoint not in prompt modules or proxy |  HIGH | `openapi.yaml`, `openapi-management.yaml`, `cancellation.md`, `main-app-proxy.js` | Open |
| 4 | `bookingId` vs `id` field name inconsistency |  CRITICAL | `openapi.yaml`, `openapi-management.yaml`, `drivebook-hybrid/openapi.yaml`, `contract.test.js` | Open |
| 5 | Short-notice booking flow not in prompt modules |  HIGH | `booking.md`, `openapi.yaml`, voice service runtime | Open |
| 6 | `instructorQuery` field not in prompt modules |  MEDIUM | `booking.md`, `openapi.yaml` | Open |
| 7 | OTP confirm response field name inconsistency |  CRITICAL | `openapi.yaml`, `contract.test.js`, voice service auth flow | Open |
| 8 | Three new endpoints not proxied or tested |  HIGH | `main-app-proxy.js`, `contract.test.js`, `openapi.yaml`, prompt modules | Open |
| 9 | Version mismatch between specs |  MEDIUM | `openapi.yaml` info block | Open |
| 10 | Webhook path canonical vs legacy inconsistency |  MEDIUM | `openapi-webhooks.yaml`, `app/api/stripe/webhook/route.ts` | Open |

---

## Detailed Findings

---

### Finding 1  Response shape mismatch: `/public/bookings/bulk`

**Severity:**  CRITICAL

**Description:**
The contract test and the OpenAPI spec disagree on both the HTTP status code and the `Idempotency-Key` header requirement for the primary booking creation endpoint. This is the most-travelled path in the voice booking flow.

**Evidence:**

- `openapi.yaml` specifies HTTP `201 Created` for a successful booking creation response.
- `contract.test.js` mocks and asserts `HTTP 200` for the same endpoint.
- `openapi.yaml` marks the `Idempotency-Key` request header as **required** for `POST /public/bookings/bulk`.
- `contract.test.js` never sends `Idempotency-Key` in any request to this endpoint.
- Both the spec and the test agree on the `bookingId` field name in the response body.

**Impact:**

- If the real server returns `201`, the contract test passes against a mock but will fail in integration  any voice service code branching on `response.status === 200` will treat every booking creation as a failure.
- If the real server enforces `Idempotency-Key`, every booking creation call from the voice service (which never sends the header) will be rejected  likely a `400` or `422`. This is a potential **total outage** of the booking creation feature.
- The test suite provides false confidence: it passes locally against a mock that returns 200, masking the real server behaviour.

**Recommended Fix:**

1. Confirm the real server's actual response code. Update `openapi.yaml` to match (`200` or `201`), and align `contract.test.js` to the confirmed code.
2. Decide whether `Idempotency-Key` is truly enforced server-side. If yes, add header generation to the voice service and add it to all contract test requests. If no, demote it to `required: false` in the spec.
3. Add an integration smoke test against the real server (not a mock) that covers this endpoint.

---

### Finding 2  Wrong path in management spec: `/bookings/{bookingId}/cancel`

**Severity:**  HIGH

**Description:**
`openapi-management.yaml` documents the cancel endpoint without a `/public/` prefix and describes it as requiring no authentication, contradicting its position in an authenticated management spec. The actual voice-service path (with `/public/`) is documented correctly only in `openapi.yaml`.

**Evidence:**

- `openapi-management.yaml` documents: `POST /bookings/{bookingId}/cancel`
- `openapi.yaml` documents: `POST /public/bookings/{id}/cancel`
- `cancellation.md` prompt module refers to: `/api/public/bookings/:id/cancel`
- `main-app-proxy.js` routes: `/api/public/bookings/:id/cancel`
- The description in `openapi-management.yaml` reads: *"Uses the public cancel endpoint  no authentication required."*  this is contradictory for an endpoint appearing in a management (authenticated) spec.

**Impact:**

- Developers reading `openapi-management.yaml` will call the wrong path, resulting in `404` errors against the real server.
- The "no authentication required" note on an authenticated spec endpoint will mislead developers about security requirements and may result in unprotected cancellation calls being deployed.
- Inconsistency between specs erodes trust in documentation and slows down onboarding.

**Recommended Fix:**

1. In `openapi-management.yaml`, change the path to `POST /public/bookings/{id}/cancel` or clearly note it as an alias/proxy for the public endpoint.
2. Remove or correct the "no authentication required" description  add a note clarifying whether this is the authenticated management path or a proxy to the public endpoint.
3. Standardise path parameter naming: `{bookingId}` vs `{id}` should be consistent across both specs.

---

### Finding 3  Cancellation policy endpoint not in prompt modules or proxy

**Severity:**  HIGH

**Description:**
Both OpenAPI specs instruct the AI to call `GET /bookings/{bookingId}/cancellation-policy` before cancelling a booking to inform the user of applicable fees. Neither the proxy nor the prompt modules implement this instruction.

**Evidence:**

- `openapi.yaml` x-ai-rules: *"AI should call this BEFORE cancelling."*
- `openapi-management.yaml` notes: *"AI: Call this BEFORE cancelling to inform user of fees."*
- `cancellation.md` has no mention of this endpoint; it instructs the AI to read the refund amount directly from the cancel response.
- `main-app-proxy.js` has no route for `GET /bookings/:id/cancellation-policy`.
- `contract.test.js` has no test for this endpoint.

**Impact:**

- The AI will proceed with cancellations without informing users of fees, which may violate consumer expectations and potentially regulatory requirements depending on jurisdiction.
- If the cancellation fee is significant and only visible in the policy response, users are cancelling blind.
- The cancel response may not always include fee details; if the field is absent, the AI has no fallback and will either hallucinate a response or silently omit fee information.

**Recommended Fix:**

1. Add `GET /public/bookings/:id/cancellation-policy` to `main-app-proxy.js`.
2. Add a contract test for this endpoint.
3. Update `cancellation.md` to include a pre-cancellation step: call the policy endpoint, read fee details, and speak them to the user before asking for confirmation.
4. Alternatively, if the cancel response reliably returns fee information, update the spec to remove the "call this BEFORE cancelling" instruction and document the fee fields in the cancel response schema instead.

---

### Finding 4  `bookingId` vs `id` field name inconsistency

**Severity:**  CRITICAL

**Description:**
The booking identifier field is named `bookingId` in some spec/test contexts and `id` in others. The voice service is built against the hybrid spec (`bookingId`), but if the main app returns `id`, booking lookups in the voice service will silently return `undefined`.

**Evidence:**

| Source | Field name used |
|--------|----------------|
| `openapi.yaml`  `/public/bookings/bulk` response | `bookingId` |
| `openapi.yaml`  `/bookings/lookup` response | `id` |
| `openapi-management.yaml`  `/bookings/lookup` response | `id` |
| `drivebook-hybrid/openapi.yaml`  `/bookings/lookup` response | `bookingId` |
| `contract.test.js` mock | `bookingId` |
| `contract.test.js` assertion | `res.body.bookings[0].bookingId` |

**Impact:**

- Voice service code asserting `booking.bookingId` after a lookup call will get `undefined` if the main app returns `id`.
- This will cause silent failures: the voice service may attempt to use an undefined booking ID for subsequent calls (cancel, timeline, payment-status), resulting in `404` or malformed requests.
- This is not caught by contract tests because the test mocks return `bookingId`  the test never exercises the real server response.

**Recommended Fix:**

1. Decide on a single canonical field name (`id` is more REST-conventional; `bookingId` is more explicit). Apply it consistently across all four specs.
2. If the main app is the source of truth and returns `id`, update `drivebook-hybrid/openapi.yaml` and `contract.test.js` to match.
3. Update any voice service code that reads `booking.bookingId` to use the canonical field.
4. Add a schema validation step in the proxy that logs a warning when a response shape does not match the expected schema  this will catch field name drifts at runtime before they become silent failures.

---

### Finding 5  Short-notice booking flow not in prompt modules

**Severity:**  HIGH

**Description:**
Both OpenAPI specs define a distinct short-notice booking path (bookings within 120 minutes of lesson start) that returns `status: PENDING` with no `checkoutUrl`. The `booking.md` prompt module has no handling for this case.

**Evidence:**

- `openapi.yaml` documents: if booking is within 120 minutes  `status: PENDING`, no `checkoutUrl`, no payment required, AI should say *"Your booking is pending instructor approval."*
- `booking.md` prompt module: no mention of `PENDING` status, `PENDING_PAYMENT` status, or the absence of `checkoutUrl`.
- The module appears to assume `checkoutUrl` is always present after a successful booking creation.

**Impact:**

- When a user books a lesson within 2 hours of the lesson time, the voice service will receive `{ status: "PENDING" }` with no `checkoutUrl`.
- Without explicit handling, the AI will either attempt to read a missing `checkoutUrl` (resulting in an error or silent null), hallucinate a response, or give a generic error message  all of which are poor user experiences.
- In the worst case the AI says "Here is your payment link: undefined" or similar, which would be a serious trust/UX failure.

**Recommended Fix:**

1. Update `booking.md` to handle all three possible post-booking states:
   - `PENDING_PAYMENT` + `checkoutUrl` present  send/speak payment link
   - `PENDING` (short-notice) + no `checkoutUrl`  say "Your booking is pending instructor approval. You'll be notified when it's confirmed."
   - `CONFIRMED` (e.g. package/credit booking)  say "Your booking is confirmed."
2. Add a contract test case for the short-notice path (booking within 120 minutes).

---

### Finding 6  `instructorQuery` field not in prompt modules

**Severity:**  MEDIUM

**Description:**
The booking endpoint supports `instructorQuery` (instructor name or phone number) as an alternative to `instructorId`, allowing the backend to resolve the instructor without a prior search step. This simplification is not documented in the prompt module.

**Evidence:**

- `openapi.yaml` `/public/bookings/bulk` request body: `instructorQuery` field documented as an alternative to `instructorId`.
- `booking.md`: only `instructorId` is mentioned; the AI always performs a prior search call to resolve the ID.

**Impact:**

- The AI always makes an extra round-trip (search  get ID  book) when it could short-circuit to a single booking call using `instructorQuery`.
- For voice interactions where latency matters, this adds unnecessary delay.
- Not a correctness issue  the current flow works  but it's an efficiency and simplicity gap.

**Recommended Fix:**

1. Update `booking.md` to document `instructorQuery` as a fallback: if the user provides a name or phone number and no prior ID lookup has been done, pass `instructorQuery` directly to the booking endpoint.
2. Define when to prefer `instructorQuery` vs `instructorId` (e.g. use `instructorId` when a prior search has already resolved it; use `instructorQuery` when the user provides a name directly).

---

### Finding 7  OTP confirm response field name inconsistency

**Severity:**  CRITICAL

**Description:**
The OTP confirmation endpoint response uses `valid` in `openapi.yaml` but `verified` in the contract test mock. Any voice service code checking `response.verified` will always receive `undefined` if the real server follows the spec and returns `valid`.

**Evidence:**

- `openapi.yaml` `/verifications/otp/confirm` response schema: `{ success, valid, verificationToken, expiresAt }`
- `contract.test.js` mock response: `{ verified: true, verificationToken: "tok_abc123" }`
- `contract.test.js` assertion: `expect(res.body.verified).toBe(true)`  checks `verified`, not `valid`
- The `verified` field does not appear anywhere in `openapi.yaml`.

**Impact:**

- This is a **silent auth failure**: if the real server returns `{ valid: true }` and the voice service checks `response.verified`, the check always evaluates to `undefined` (falsy).
- The user will be told their OTP is invalid even after entering the correct code.
- The contract test provides **no protection**  it passes because it mocks `verified: true` and asserts `verified`, never testing the spec-defined `valid` field.
- This could block all authenticated voice service flows if OTP verification is a prerequisite.

**Recommended Fix:**

1. Determine the real server's actual field name by inspecting the live endpoint or server-side code.
2. If the server returns `valid`: update `contract.test.js` mock and assertion to use `valid`; update all voice service code that reads this field.
3. If the server returns `verified`: update `openapi.yaml` to use `verified` in the response schema.
4. Add a field-level schema assertion in the contract test (not just a value check) so future field renames are caught automatically.

---

### Finding 8  Three new endpoints not proxied or tested

**Severity:**  HIGH

**Description:**
`openapi.yaml` documents three token-authenticated endpoints intended for the voice service's post-booking flow. None of them are implemented in `main-app-proxy.js` or covered by contract tests.

**Evidence:**

The following endpoints are documented in `openapi.yaml` with explicit `x-ai-rules`:

| Endpoint | Documented AI instruction |
|----------|--------------------------|
| `GET /public/bookings/{id}/payment-status?token=` | *"Use this to check if payment succeeded"* |
| `GET /public/bookings/{id}/timeline?token=` | *"Use this to answer 'What happened to my booking?'"* |
| `GET /public/bookings/{id}/payment-summary?token=` | Payment page data |

None appear in `main-app-proxy.js`. None have contract tests.

**Impact:**

- The AI cannot check payment status after sending a checkout link  it has no way to confirm whether the user paid.
- The AI cannot answer "What happened to my booking?" queries  a common post-booking caller question.
- If prompt modules are updated to use these endpoints (per spec instructions), the calls will hit unproxied routes and receive `404` errors.
- The payment-summary endpoint may be required for the voice service to describe payment details to a caller.

**Recommended Fix:**

1. Add all three routes to `main-app-proxy.js`, forwarding `token` as a query parameter.
2. Add contract tests for each endpoint covering: successful response, expired/invalid token (`401`), booking not found (`404`).
3. Update prompt modules (`booking.md` or a new `payment.md`) to document when and how to use `payment-status` and `timeline`.

---

### Finding 9  Version mismatch between specs

**Severity:**  MEDIUM

**Description:**
`openapi.yaml` contains two `version` declarations in its info block  one reads `3.0.0` and another reads `2.0.0`. The Swagger 2.0 format permits exactly one `info.version` field. One of these is a copy-paste artefact.

**Evidence:**

- `openapi.yaml` line ~4: `version: '3.0.0'`
- `openapi.yaml` line ~130: `version: 2.0.0` (duplicate)
- `openapi-management.yaml`: `version: 2.0.0`
- `openapi-webhooks.yaml`: `version: 2.0.0`
- `drivebook-hybrid/openapi.yaml`: `version: 2.0.0`

**Impact:**

- Tooling that parses `openapi.yaml` may pick up either value depending on parser behaviour (first-wins vs last-wins), leading to inconsistent version reporting.
- A version of `3.0.0` against a `swagger: '2.0'` document will confuse tools that validate the spec format  some validators may reject the file.
- Minor operational impact but creates confusion when correlating deployed versions to spec revisions.

**Recommended Fix:**

1. Remove the duplicate `version` field from `openapi.yaml`. Confirm the canonical version and set it once in the `info` block.
2. If `3.0.0` was intentional (e.g. the spec was being migrated to OpenAPI 3.0), complete or revert the migration  the `swagger: '2.0'` top-level key and `openapi: '3.0.x'` key cannot coexist.

---

### Finding 10  Webhook path canonical vs legacy inconsistency

**Severity:**  MEDIUM

**Description:**
`openapi-webhooks.yaml` documents only the legacy webhook path (`/webhooks/stripe`), while the actual implementation lives at the canonical path (`/stripe/webhook`). The legacy path is treated as primary in documentation when it should be deprecated.

**Evidence:**

- `openapi.yaml` header comment: *"Canonical path: `/api/stripe/webhook`, Legacy alias: `/api/webhooks/stripe`"*
- `openapi-webhooks.yaml` documents: `POST /webhooks/stripe` only (legacy)
- Implementation: `app/api/stripe/webhook/route.ts` (canonical path)

**Impact:**

- Developers and Stripe dashboard configuration guided by `openapi-webhooks.yaml` will configure the legacy path, which may not be actively maintained or may be removed in a future cleanup.
- If the legacy alias is removed, any Stripe webhook configuration pointing to it will silently drop all webhook events  missed payments, failed refund confirmations, subscription events.
- Low immediate risk if the alias is still active, but the documentation inverts the intended path hierarchy.

**Recommended Fix:**

1. Update `openapi-webhooks.yaml` to document `POST /stripe/webhook` as the primary path.
2. Add `POST /webhooks/stripe` as a deprecated alias with a `deprecated: true` flag and a migration note pointing to the canonical path.
3. Add a note in the spec indicating the Stripe dashboard should be configured to use the canonical path.

---

## What to Fix First

Prioritised by production risk and blast radius:

### Immediate (fix before next release)

1. **Finding 7  OTP `valid` vs `verified`**
   The OTP auth flow is a prerequisite for all authenticated voice interactions. A field name mismatch here blocks every caller who needs to verify their identity. Highest priority because the impact is total and silent.

2. **Finding 1  `/public/bookings/bulk` status code + `Idempotency-Key`**
   Core booking creation path. A wrong status code assertion means false test confidence; missing `Idempotency-Key` means potential rejection of all booking calls by the real server. Fix the status code ambiguity by testing against the real server, and implement idempotency key generation.

3. **Finding 4  `bookingId` vs `id` field name**
   Silent failure in booking lookups. The voice service will retrieve `undefined` for booking IDs on lookup responses if the main app returns `id`. Downstream calls using that undefined ID will fail unpredictably.

### High Priority (fix within current sprint)

4. **Finding 5  Short-notice booking flow**
   Any booking within 120 minutes hits this path. Without handling, the AI will produce an incorrect or incoherent response for a real-world use case.

5. **Finding 8  Three unproxied endpoints**
   The AI cannot confirm payment success or answer post-booking status questions. Add proxy routes and contract tests before enabling post-booking voice flows.

6. **Finding 3  Cancellation policy endpoint gap**
   Cancelling without informing users of fees is a UX and potentially a legal risk. The endpoint exists; it just needs to be wired into the proxy and prompt module.

### Medium Priority (fix before next spec revision)

7. **Finding 2  Management spec wrong path + contradictory auth description**
   Actively misleads developers. Fix path and remove the contradictory "no auth required" note.

8. **Finding 6  `instructorQuery` not in prompts**
   Efficiency improvement. No correctness impact, but reduces unnecessary API round-trips in the voice booking flow.

### Low Priority (housekeeping)

9. **Finding 9  Duplicate version in `openapi.yaml`**
   Cosmetic and tooling risk. Remove the duplicate `version` field.

10. **Finding 10  Webhook canonical vs legacy path in spec**
    Documentation inversion. Low risk while the legacy alias is active, but should be corrected before any infrastructure cleanup removes the alias.

---

*Report generated from static cross-reference analysis of spec files, proxy routes, prompt modules, and contract tests. Findings reflect discrepancies at the time of audit  confirm each finding against the live server before closing.*