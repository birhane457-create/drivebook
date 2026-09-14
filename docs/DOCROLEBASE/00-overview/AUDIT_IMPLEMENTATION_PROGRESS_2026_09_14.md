# DriveBook — Audit Implementation Progress Tracker

**Baseline:** `AUDIT_FINAL_BASELINE_2026_09_14.md`  
**Purpose:** persistent implementation tracker for Kiro. Work may be completed in multiple sessions/commits.  
**Owner:** Kiro implements production-code changes. Assistant records/re-verifies audit evidence.  
**Rule:** do not mark an item CLOSED from a code change alone; closure requires current source plus relevant test/verification evidence.

## Status legend

- `OPEN` — finding remains.
- `IN PROGRESS` — implementation underway.
- `FIXED — VERIFY` — Kiro believes implementation is fixed; independent/current-source verification still required.
- `CLOSED` — source + tests/evidence establish closure.
- `ACCEPTED RISK` — explicit launch decision documented with rationale.
- `SUPERSEDED` — replaced by a stronger finding/design decision; link the replacement.

## P0 tracker

| ID | Area | Finding | Status | Kiro commit/PR | Test evidence | Re-verification |
|---|---|---|---|---|---|---|
| P0-01 | Wallet | `wallet-add` does not prove PaymentIntent belongs to authenticated wallet | OPEN | — | — | Required |
| P0-02 | Client booking | Client reschedule lacks strict duration/date validation | OPEN | — | — | Required |
| P0-03 | Reviews | `reviewComment` vs Prisma `customerReview` mismatch | OPEN | — | — | Required |
| P0-04 | Instructor payouts | Client-controlled ABN/tax verification fields | OPEN | — | — | Required |

## P1 tracker

| ID | Area | Finding | Status | Kiro commit/PR | Test evidence | Re-verification |
|---|---|---|---|---|---|---|
| P1-01 | Middleware | Custom-domain hostname `includes()` trust boundary | OPEN | — | — | Required |
| P1-02 | Middleware | Maintenance secret accepted in query string | OPEN | — | — | Required |
| P1-03 | Public booking | Pickup address exposed by unauthenticated UUID endpoint | OPEN | — | — | Required |
| P1-04 | Public self-service | Verification/cancel/reschedule/payment actions lack demonstrated abuse controls | OPEN | — | — | Required |
| P1-05 | Refunds | Cancellation/refund lacks durable refund-pending/reconciliation state | OPEN | — | — | Required |
| P1-06 | Public reschedule | Token can be consumed before successful final transition; timezone risk | OPEN | — | — | Required |
| P1-07 | Availability | Concurrent check/reserve can race without demonstrated DB invariant | OPEN | — | — | Required |
| P1-08 | Payments | Stripe PaymentIntent creation lacks durable idempotency and is mixed with DB transactions | OPEN | — | — | Required |
| P1-09 | Authentication | Login abuse controls not sufficiently demonstrated | OPEN | — | — | Required |
| P1-10 | Debug | Unauthenticated debug session endpoint | OPEN | — | — | Required |
| P1-11 | Dashboard | Exclusion-based instructor dashboard role gate | OPEN | — | — | Required |
| P1-12 | Subscriptions | Broad provider fallback + webhook race/ambiguous subscription identity | OPEN | — | — | Required |
| P1-13 | Subscriptions | Subscription validation fails open on DB error | OPEN | — | — | Required |
| P1-14 | Documents | Legacy document URL fallback can bypass signed delivery | OPEN | — | — | Required |
| P1-15 | Payouts/PII | Full bank details exposed; ABN logging | OPEN | — | — | Required |
| P1-16 | Staff | `assignedToMe` UI filter not applied by API | OPEN | — | — | Required |
| P1-17 | Staff | Auto-assignment load increment can race | OPEN | — | — | Required |
| P1-18 | Admin AI | DB errors become zero/empty metrics | OPEN | — | — | Required |
| P1-19 | Admin AI | Compliance fields/data model drift hidden by `as any` | OPEN | — | — | Required |
| P1-20 | Mobile auth | Long-lived JWT lacks demonstrated revocation/session management | OPEN | — | — | Required |
| P1-21 | Check-out | Transaction selection/state update insufficiently constrained | OPEN | — | — | Required |
| P1-22 | Reschedule | Calendar failure can leave durable DB/calendar drift | OPEN | — | — | Required |
| P1-23 | Auth | Broad Provider graph loaded during credential authentication | OPEN | — | — | Required |
| P1-24 | Type safety | Security-sensitive routes/services use `@ts-nocheck` | OPEN | — | — | Required |

## P2 / VERIFY tracker

| ID | Area | Item | Status | Evidence needed |
|---|---|---|---|---|
| V-01 | Auth | Email/account enumeration controls | OPEN | Current source + abuse tests |
| V-02 | Auth | Distinguishable credential errors | OPEN | UX/security decision |
| V-03 | Reviews | Pagination and rating constraints | OPEN | Route tests |
| V-04 | Reviews | Aggregate rating race | OPEN | Concurrency test |
| V-05 | APIs | Response data minimisation | OPEN | Endpoint-by-endpoint review |
| V-06 | Booking | `rescheduledFrom` growth strategy | OPEN | Data model decision |
| V-07 | Public tokens | Entropy/expiry/one-time lifecycle | OPEN | Token generation/consumption audit |
| V-08 | Data | Soft-delete filtering | OPEN | Repository-wide query audit |
| V-09 | Integrations | Email/SMS/calendar/Cloudinary recovery and idempotency | OPEN | Side-effect matrix |
| V-10 | Payments | DIRECT payment mode end-to-end lifecycle | OPEN | Full payment-flow test |
| V-11 | Service areas | API currently returns empty because model is absent | OPEN | Product/architecture decision |
| V-12 | Mobile | Hard-coded local IP in mobile config | OPEN | Production config review |
| V-13 | Platform identity | Deprecated compatibility file | OPEN | Call-site migration proof |
| V-14 | White label | Outstanding receipt/white-label TODOs | OPEN | Launch-vs-backlog classification |

## Subscription sub-tracker

These remain part of the same implementation programme rather than being treated as a separate audit:

- [ ] Make Stripe subscription identity deterministic and unique.
- [ ] Remove provider-wide `updateMany` subscription fallback.
- [ ] Remove "most recent TRIAL/ACTIVE" subscription identity fallback.
- [ ] Make webhook event processing idempotent and order-safe.
- [ ] Resolve trial-to-paid conversion race.
- [ ] Define and enforce one active/trial subscription invariant per provider.
- [ ] Reconcile local subscription state with Stripe state.
- [ ] Define admin override semantics and prevent silent Stripe/local divergence.
- [ ] Make customer creation race-safe.
- [ ] Prove email side-effect idempotency across webhook event orderings.
- [ ] Consolidate or explicitly retire legacy subscription checkout/mobile paths.
- [ ] Align Stripe API versions or document an intentional version boundary.
- [ ] Verify monthly/annual/trial period semantics during tier changes.
- [ ] Verify billing portal behaviour for trial and active subscriptions.

## Financial implementation programme

- [ ] PaymentIntent ownership binding.
- [ ] Stable Stripe idempotency keys for every money-moving create/refund operation.
- [ ] Separate external Stripe side effects from DB transaction semantics, with durable operation state.
- [ ] Wallet credit idempotency and replay protection.
- [ ] Refund pending/reconciliation state.
- [ ] Transaction-type/state invariants.
- [ ] Ledger double-entry/invariant tests where applicable.
- [ ] Payout/Connect state reconciliation.
- [ ] Direct-payment lifecycle consistency.

## Booking implementation programme

- [ ] Client reschedule schema and bounds.
- [ ] Public reschedule token transaction semantics.
- [ ] Australian timezone handling made explicit rather than server-local.
- [ ] Availability reservation concurrency invariant.
- [ ] Booking creation money/state re-check inside the transaction where needed.
- [ ] Instructor reschedule SERIALIZABLE/concurrency proof.
- [ ] Calendar reconciliation after booking changes.
- [ ] Public booking data minimisation.
- [ ] Cancellation/refund state machine.

## Identity/security implementation programme

- [ ] Positive role allow-listing for dashboard routes.
- [ ] Remove/gate debug session route.
- [ ] Login rate limiting/progressive abuse controls.
- [ ] Public token rate limits and replay protection.
- [ ] Mobile session revocation/device management.
- [ ] Fresh server-side authorization for mobile sensitive actions.
- [ ] Remove sensitive fields from broad auth projections.
- [ ] Secure custom-domain hostname boundary.
- [ ] Remove query-string maintenance secret.
- [ ] Mask/remove sensitive payout data from responses/logs.
- [ ] Signed-only compliance document delivery.

## Data/AI/admin implementation programme

- [ ] Staff task filters enforced server-side.
- [ ] Staff auto-assignment made atomic.
- [ ] AI data tools distinguish `0` from `unavailable`.
- [ ] AI compliance data source aligned with current schema.
- [ ] Admin AI prompt/history retention reviewed for PII minimisation.
- [ ] Response projections minimised across admin/client/instructor endpoints.
- [ ] Soft-delete visibility policy verified.

## Type-safety / legacy programme

- [ ] Inventory every production `@ts-nocheck` route/service.
- [ ] Remove it from security/financial routes first.
- [ ] Replace `as any` around Prisma writes with generated Prisma types.
- [ ] Classify legacy routes as reachable, intentionally retained, or dead.
- [ ] Remove dead/duplicate payment/subscription implementations only after reachability is proven.
- [ ] Keep compatibility code only where there is a documented migration boundary.

## Verification gate

A batch can be marked CLOSED only when all applicable checks below are recorded:

- [ ] source reviewed after Kiro implementation
- [ ] regression test added/updated
- [ ] relevant unit/integration/concurrency test passes
- [ ] TypeScript/build passes
- [ ] no alternate/legacy route bypasses the fix
- [ ] ownership/role checks verified
- [ ] financial state/idempotency verified where applicable
- [ ] external side-effect failure path verified where applicable
- [ ] documentation updated

## Session log

### 2026-09-14 — Baseline handoff

- Baseline audit findings consolidated into `AUDIT_FINAL_BASELINE_2026_09_14.md`.
- Implementation tracker created.
- Kiro is authorised to re-check every finding against its local checkout and to record disagreements with evidence.
- No production-code changes were made by the assistant.
- Current global status remains **NOT PRODUCTION READY**.

### Future entries

For each implementation session, add:

`Date — batch — findings addressed — commit/PR — tests — remaining issues — re-verification status.`
