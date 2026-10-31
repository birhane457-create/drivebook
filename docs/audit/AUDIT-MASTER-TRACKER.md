# DriveBook Security Audit â€” Master Tracker

**Version:** 5.71 (WLA-008-TENANT-1: QuoteInput.providerId mandatory; unconditional enforcement; NEG tests re-confirmed at PostgreSQL; 37/37 source + 10/10 DB)
**Last Updated:** 2026-10-31
**Process:** See `AUDIT-PROCESS.md` for stage definitions, closure rules, and Kiro enforcement rules.  
**Authority:** This file is the single authoritative record of every finding's lifecycle state.  
All other audit documents are evidence records that support this file.

---

## How to Read This Table

| Column | Meaning |
|---|---|
| **ID** | Stable identifier â€” never changes |
| **Title** | Short description |
| **Risk** | CRITICAL / HIGH / MEDIUM / LOW / NONE / ARCHITECTURAL |
| **Finding** | CONFIRMED / REJECTED / SUPERSEDED |
| **Verification** | VERIFIED (independent code proof) / UNVERIFIED â€” for Section 7 BRAND findings: SOURCE-CONFIRMED = code inspection only; VERIFIED = runtime HTTP evidence; both are distinct from FIX-VERIFIED |
| **Fix** | Commit SHA or NOT-STARTED or N/A |
| **Fix-Verified** | `N tests, exit 0` or PENDING or N/A |
| **Status** | OPEN / CLOSED / SUPERSEDED / REJECTED |
| **Evidence** | Primary evidence document path |
| **Phase-1-ref** | Cross-ref to PHASE1_REMEDIATION_REGISTER ID |

---

## Section 1 â€” Phase 1 Findings (Original 56-Finding Register)

### 1.1 â€” P0 Critical

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence | Phase-1-ref |
|---|---|---|---|---|---|---|---|---|---|
| P0-01A | Wallet PaymentIntent cross-user theft | CRITICAL | CONFIRMED | VERIFIED â€” `wallet-add/route.ts` ownership check absent confirmed in source | `b9c2f0ff` (metadata check + userId stamping) | 18 tests (10 unit + 8 integration), exit 0 | âœ… CLOSED | `phase1/P0-01_TEST_EVIDENCE.md` | P0-01 |
| P0-01B | Concurrent wallet credit race condition | MEDIUM | CONFIRMED | VERIFIED â€” DB constraint absent confirmed; test was sequential not concurrent | `b9c2f0ff` (partial unique index on `stripePaymentIntentId`; P2002 â†’ 409) | 12 tests, exit 0 | âœ… CLOSED | `phase1/P0-01B_FIX_IMPLEMENTATION.md` | P0-01 |

### 1.2 â€” P1 High Priority

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence | Phase-1-ref |
|---|---|---|---|---|---|---|---|---|---|
| SUB-22 | Subscription duplicate rows â€” missing unique constraints | HIGH | CONFIRMED | VERIFIED â€” source confirmed no `@@unique` on Provider/Subscription | `2422870d` (@@unique constraints applied) | DB constraint + tests | âœ… CLOSED | `phase1/SUB-22_VERIFICATION.md` | SUB-22 |
| SUB-04-A | Unpaid subscription activated on `subscription.created` | HIGH | CONFIRMED | VERIFIED â€” webhook handler activated on wrong event | Activation moved to `invoice.payment_succeeded` | Verified in source | âœ… CLOSED | `phase1/SUB-04-A_VERIFICATION.md` | SUB-04-A |
| SUB-09-A | Instructor cancellation missing Stripe call | CRITICAL | CONFIRMED | VERIFIED â€” DELETE route updated DB without calling Stripe | `subscription-cancel.ts` service; Stripe-first order | Verified in source | âœ… CLOSED | `phase1/SUB-09-10-12_VERIFICATION.md` | SUB-09-A |
| SUB-10-A | Three inconsistent cancellation implementations | CRITICAL | CONFIRMED | VERIFIED â€” three paths with different Stripe behaviour | Unified `subscription-cancel.ts`; all paths delegate | Verified in source | âœ… CLOSED | `phase1/SUB-09-10-12_VERIFICATION.md` | SUB-10-A |
| SUB-12-A | Trial expiry cron race with paid conversion | CRITICAL | CONFIRMED | VERIFIED â€” `updateMany` with status guard confirmed correct | Already fixed; no change needed | N/A â€” pre-existing fix | âœ… CLOSED | `phase1/SUB-12A-VERIFICATION-COMPLETE.md` | SUB-12-A |
| SUB-02-A | Subscription creation not atomic | HIGH | CONFIRMED | VERIFIED â€” Subscription.create and Provider.update were separate | `prisma.$transaction()` wraps both operations | Verified in source | âœ… CLOSED | `phase1/SUB-02_VERIFICATION.md` | SUB-02-A |
| SUB-02-B | Concurrent trial creation race | HIGH | CONFIRMED | VERIFIED â€” findFirst before create allowed race | Race check inside SERIALIZABLE transaction | Verified in source | âœ… CLOSED | `phase1/SUB-02_VERIFICATION.md` | SUB-02-B |
| C-1 | Provider self-upgrade tier without payment | CRITICAL | CONFIRMED | VERIFIED â€” guard present at subscription route line 199â€“209 | 403 guard on non-TRIAL tier change | Verified in source | âœ… CLOSED | `phase1/C-1_VERIFICATION.md` | C-1 |
| PAY-H-01 | Stripe refund outside transaction â€” no reconciliation | HIGH | CONFIRMED | VERIFIED â€” F-09 left refund call outside tx by design | This commit â€” Path B: `stripeRefundId` written in same `booking.update` as `notes`; Check 5 in `reconcile-stripe` cron enumerates `stripe.refunds.list()`, repairs missing `stripeRefundId` (CANCELLED bookings), flags financial mismatches, idempotent alerting; no auto ledger entries | 15 PAY-H-01 tests (PH-1â€“PH-10), exit 0 â€” `pay-h01-refund-reconciliation.test.ts` | âœ… FIX-VERIFIED | `PHASE1_REMEDIATION_REGISTER.md` | PAY-H-01 |
| PAY-H-02 | Booking reschedule price not recalculated | HIGH | CONFIRMED | VERIFIED â€” `reschedule/route.ts` no price comparison; all four routes left `platformFee`, `providerPayout`, `commissionRate`, `Transaction` stale after duration change; Route C had no transaction wrapper; Stripe-paid bookings not blocked on price change | This commit â€” `computeRescheduleFinancials()` pure helper (locked rate, never live provider rate); `rescheduleBooking()` rewritten as single SERIALIZABLE source of truth: `rescheduleCount` CAS, Stripe-paid price-change block, package duration block, full four-field financial update, `Transaction` `updateMany`, atomic wallet debit/credit; Routes A/B/C delegate entirely; Route C conflict check inside transaction | 35 PAY-H-02 tests (F1â€“F9 pure, R1â€“R26 service), exit 0 â€” `pay-h02-reschedule-financials.test.ts` | âœ… FIX-VERIFIED | `PHASE1_REMEDIATION_REGISTER.md` | PAY-H-02 |
| INT-M-01A | Stripe refund reconciliation gap (inverse of PAY-H-01) | HIGH | CONFIRMED | VERIFIED â€” no reconciliation cron exists | Subsumed by PAY-H-01 fix this commit (Check 5 in reconcile-stripe cron) | Same 15 tests as PAY-H-01 | âœ… FIX-VERIFIED â€” consolidated with PAY-H-01 | `PHASE1_REMEDIATION_REGISTER.md` | INT-M-01A |
| INT-M-03A | OAuth tokens stored plaintext | HIGH | CONFIRMED | VERIFIED â€” `googleAccessToken` plaintext in Provider model | `ec928470` â€” `lib/encryption/oauth-tokens.ts` (AES-256-GCM, 12-byte nonce, v1 format); `googleCalendar.ts` encrypt/decrypt integrated; `scripts/migrate-encrypt-oauth-tokens.mjs` production migration script | 6 MSE tests (MSE-1 to MSE-6), exit 0, 18.25s â€” `oauth-migration-script-execution.test.ts` executes actual migration script via npx tsx; isolated PostgreSQL database (Docker localhost:5433); migration stdout/stderr captured; MSE-5 DB snapshots prove --verify-only non-destructive; MSE-2 idempotency verified (2 encrypted, then 0 encrypted/4 skipped) | âœ… TEST VERIFIED â€” `a81c2aa6` (evidence package commit); tested code at `ec928470` | `docs/audit/INT-M-03A_FINAL_EXECUTION_REPORT.md` | INT-M-03A |
| INT-M-03F | OAuth token not revoked on calendar disconnect | HIGH | CONFIRMED | VERIFIED â€” no revocation call in disconnect flow | `14628e9d` + `e4488298` (caller audit: enableSync required) | 18 INT-M-03F tests (T1â€“T11 + variants), exit 0 | âœ… FIX-VERIFIED â€” `e4488298` âœ… Vercel SUCCESS | `PHASE1_REMEDIATION_REGISTER.md` | INT-M-03F |

### 1.3 â€” P2 Medium Priority

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence | Phase-1-ref |
|---|---|---|---|---|---|---|---|---|---|
| PAY-H-04 | SlotReservation concurrency â€” no unique constraint | MEDIUM | CONFIRMED | VERIFIED â€” no `@@unique([providerId, startTime])` | `560a77c2` â€” btree_gist + all-rows GIST exclusion constraint; Layer 1 scoped expiry delete in both paths; Path B SlotReservation overlap check; 23P01 â†’ HTTP 409 | 6 PAY-H-04-E HTTP tests (E1â€“E6), exit 0, 2026-09-22; production verification 2026-09-24T03:47:54Z: SHA VERIFIED, btree_gist v1.7, constraint present, concurrent overlap â†’ at most 1 row (409), adjacent â†’ both 200, normal â†’ 200, exclusion â†’ 409 â€” ALL PASS â€” see docs/audit/PAY-H-04-PRODUCTION-VERIFICATION.txt | âœ… CLOSED | `docs/audit/PAY-H-04_INVESTIGATION.md`, `docs/audit/PAY-H-04-PRODUCTION-VERIFICATION.txt` | PAY-H-04 |
| SUB-06-A | No Provider-first FOR UPDATE locking on lifecycle writers | HIGH | CONFIRMED | VERIFIED â€” 12 lifecycle writers confirmed; 10 non-compliant without Provider-first locking | `3549303b` (all 12 writers remediated; Rev7 architecture applied; #12 torn-state fix) â€” Writers #3â€“#12: Provider FOR UPDATE â†’ full current-sub inventory â†’ post-lock re-read â†’ 0/1/>1 invariant â†’ ownership â†’ mutate | All 12 writers: CLOSED (independently assessed at 4d7443b0). Qualifications: #11 >1 guard source/DB-defensive not behaviorally tested; #12 CANCELLED-row linking documented as policy question; #7/#8 P40001 retry tracked separately â€” see docs/audit/SUB-06-A_CLOSURE_EVIDENCE.md | âœ… CLOSED | `docs/audit/SUB-06-A_CLOSURE_EVIDENCE.md` | SUB-06-A |
| SUB-06-A-P40001 | Invoice webhook concurrent serialization â€” no P40001 retry | LOW | CONFIRMED | VERIFIED â€” concurrent invoice.payment_succeeded + invoice.payment_failed raises P40001; handler returns HTTP 500 | 17aa42db â€” `withSerializableRetry` extended to detect P40001 (raw PostgreSQL error message) in addition to P2034; invoice handlers wrapped with retry; exponential backoff 50â€“400ms, max 2 retries | FIX-VERIFIED at ad0648e4: 9/9 tests pass. P40001 caught and retried in logs: "Serialization conflict (P40001) â€” retrying transaction {attempt:1, backoffMs:49}"; retry succeeded; subscription marked PAST_DUE; both handlers returned 200; no HTTP 500; idempotency intact. | âœ… CLOSED | `lib/utils/transaction-retry.ts`, `__tests__/integration/sub-06-a-invoice-handlers.test.ts` | SUB-06-A |
| SUB-08-A | Seat limit not enforced in webhook | N/A | REJECTED | Finding not applicable to current main revision. Claimed Enterprise/50-seat invariant is not implemented. No maxSeats or seat-based billing exists. BUSINESS/multi-provider functionality is future/unimplemented. Webhook does receive Stripe quantity but ignores it; maxProviders field exists but is not enforced. No current security or financial impact established. | N/A | N/A | âœ… REJECTED | `docs/audit/SUB-08-A_DISCOVERY.md` | SUB-08-A |
| RBAC-M-02 | Admin routes use role check instead of permission check | MEDIUM | CONFIRMED | VERIFIED â€” `role === 'SUPER_ADMIN'` pattern found | All 73 admin routes now use `requirePermission(session, PERM.*)` â€” 118 call-sites, 0 bare role checks (commit `f67c2d55`) | 9/9 hostile baseline tests pass 2026-09-24: R1â€“R5 reader denied (403 missing_permission), P1â€“P2 privileged granted (200), W1 writer denied finance (403), W2 writer granted approve (not-403) â€” see `docs/audit/RBAC-M-02-PRODUCTION-VERIFICATION.txt` | âœ… CLOSED | `docs/audit/RBAC-M-02_INVESTIGATION.md`, `docs/audit/RBAC-M-02-PRODUCTION-VERIFICATION.txt` | RBAC-M-02 |
| DATA-EXP-01 | Public instructor phone exposed in API | MEDIUM | CONFIRMED | VERIFIED â€” `phone` in public projection | Removed `phone` from Prisma select and response map in `app/api/public/instructors/route.ts`. Also fixed pre-existing 500 bug (broken `_count.reviews` relation replaced with correct `averageRating`/`totalReviews` fields). All other public/* routes confirmed safe. | Verification script run against real Supabase DB 2026-09-24: CHECK1 query OK, CHECK2 phone absent from Prisma row, CHECK3 phone absent from response, CHECK4 all required fields intact â€” see `docs/audit/DATA-EXP-01-VERIFICATION.txt` | âœ… CLOSED | `docs/audit/DATA-EXP-01-VERIFICATION.txt` | DATA-EXP-01 |
| DOC-EXP-01 | Expired provider can still receive bookings | MEDIUM | CONFIRMED | VERIFIED â€” no document expiry gate in booking creation | `checkProviderEligible()` applied to ALL 6 booking creation routes. Commit 1c0548d2: public/bookings (+ missing approvalStatus+isActive), public/bookings/bulk, cron. This commit: bookings/combined, bookings/mobile, pda-tests (+ doc expiry on top of existing gates), client/packages/mobile (minimum gate; IDOR tracked as INT-M-PKG-01). | All 6 routes now call checkProviderEligible() before booking.create(). 8-point logic review: expired doc â†’ 403 on all paths, SUSPENDED provider blocked, non-driving providers unaffected. See `docs/audit/DOC-EXP-01-VERIFICATION.txt` | âœ… CLOSED | `docs/audit/DOC-EXP-01-VERIFICATION.txt` | DOC-EXP-01 |
| INT-M-PKG-01 | client/packages/mobile IDOR + hardcoded price | MEDIUM | CONFIRMED | VERIFIED â€” `app/api/client/packages/mobile/route.ts` POST handler: `packageId` from request body used directly as `providerId` with no ownership/relationship check; `price: 500` hardcoded; `status: 'CONFIRMED'` immediate; route was used by legacy Expo mobile app (now archived at `legacy/mobile/`); current Capacitor mobile app does NOT call this endpoint | REMEDIATED â€” Commit A (d429b812): `legacy/mobile/` archived. Commit B (a4112b87): route file deleted; `ENABLE_MOBILE_PACKAGE_PURCHASE` removed from `.env.example`; `lib/mobile-auth.ts` retained (4 other routes). Build fixes (2873ac52): `legacy/` excluded from TS/ESLint/Next.js build. Current package purchasing: `app/api/public/bookings/bulk` unaffected. | Production build (`next start`) at 2873ac52: POST `/api/client/packages/mobile` â†’ 404 âœ“; GET â†’ 404 âœ“; `bookings/bulk` POST â†’ 400 (route exists, rejected bad payload) âœ“; `lib/mobile-auth.ts` present âœ“; sibling `wallet/mobile` â†’ 401 âœ“. Build succeeds. | âœ… CLOSED | `docs/audit/INT-M-PKG-01_ARCHITECTURE_CORRECTION.md` | INT-M-PKG-01 |
| AUDIT-01 | Audit logging fails open (swallows errors) | MEDIUM | CONFIRMED | VERIFIED â€” catch block uses console.error only | `writeAuditLog(tx)` for Tier 1/2/3 critical paths (atomic, throws on failure); `writeAuditLogSafe()` for Tier 4 non-critical (explicit non-throwing policy documented). `logAuditEvent()` swallowing catch replaced at all 22 call sites. | 8/8 unit tests pass: writeAuditLog throws on failure, writeAuditLogSafe logs+continues, audit failure rolls back critical tx â€” see `docs/audit/AUDIT-01-02-VERIFICATION.txt` | âœ… CLOSED | `docs/audit/AUDIT-01-02-VERIFICATION.txt` | AUDIT-01 |
| AUDIT-02 | Audit log write not atomic with state change | MEDIUM | CONFIRMED | VERIFIED â€” separate writes confirmed | Same fix as AUDIT-01: Tier 1/2/3 call sites now use `writeAuditLog(tx)` inside `$transaction`. Tier 3 webhook handlers replaced `logSubscriptionAction` (module-level prisma) with `tx.auditLog.create` â€” now actually atomic. F09 retry compatibility verified: audit rolls back with tx on P2034, no duplicate entries. | 8/8 unit tests pass â€” see `docs/audit/AUDIT-01-02-VERIFICATION.txt` | âœ… CLOSED | `docs/audit/AUDIT-01-02-VERIFICATION.txt` | AUDIT-02 |
| AUDIT-05 | Audit coverage gaps â€” provider approve/reject/suspend lacked audit trail | MEDIUM | CONFIRMED | VERIFIED (0b5599b0) â€” 3 routes confirmed missing writeAuditLog: approve, reject, suspend | `8d53d9f5` â€” all 3 routes wrapped in `prisma.$transaction` with `writeAuditLog(tx, ...)` atomically | 7/7 direct-handler tests pass (A1 APPROVE, A2 REJECT, A3 SUSPEND, C1 non-admin 403, C2 no-session 401, D1 metadata, E1 sequence); B1 rollback-on-audit-failure: `dff702ad` DB-level test PASSED. Full suite exit 0. | âœ… CLOSED | `__tests__/integration/audit-05-http-provider-review-atomicity.test.ts`, `__tests__/integration/audit-05-provider-review-atomicity.test.ts` | AUDIT-05 |
| INT-M-01B | Stripe payment reconciliation (missed webhooks) | MEDIUM | CONFIRMED | VERIFIED â€” no payment reconciliation in cron | Check 1 in `app/api/cron/reconcile-stripe/route.ts` â€” auto-confirms PENDING_PAYMENT bookings < 24h where Stripe PI succeeded but no LedgerEntry(PAYMENT_COLLECTED) exists; flags > 24h bookings for manual review | 16/16 unit tests pass: R1 auto-confirm (CONFIRMED+LedgerEntry+AuditLog), R2 idempotency (no-op), R3 flag-only > 24h, R4 skip conditions (non-AUD, no bookingId, non-succeeded, missing booking), R5 graceful failure, R6 auth, R7 lock. Exit 0. | âœ… CLOSED | `__tests__/integration/int-m-01b-payment-reconciliation.test.ts` | INT-M-01B |
| SUB-06-A-P2028 | Transaction timeout on SUB-06-A lockProvider() routes against remote Supabase | LOW | CONFIRMED | VERIFIED â€” P2028 occurred in app/api/instructor/subscription/route.ts: Prisma default 5s timeout insufficient for remote FOR UPDATE transaction (observed ~5.4s); affected routes: instructor/subscription, instructor/subscription/sync, subscription-cancel.ts, check-trial-expiry, admin/instructors/[id]/subscription | f65c0882 â€” timeout raised to 30s on all 5 affected transaction sites | Remote Supabase verification at 708e9deb: FOR UPDATE transaction completed in 3,078ms under 30s timeout; mutations committed; no P2028; duration below old 5s default. JIT compilation contribution to original 5.4s failure is plausible but not independently measured. | âœ… CLOSED | `scripts/verify-p2028-fix.mjs` | SUB-06-A |
| F-08 | Admin refund maxRefundAmount not enforced | MEDIUM | CONFIRMED | VERIFIED â€” enforcement absent before fix | Fixed: checkPermission + limit check before Stripe call | Verified in source | âœ… CLOSED | `phase1/F-08_VERIFICATION.md` | F-08 |

### 1.4 â€” P3 Low Priority

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Phase-1-ref |
|---|---|---|---|---|---|---|---|---|
| PAY-H-06 | Package expiry refund policy undocumented | LOW | CONFIRMED | VERIFIED â€” business policy, not bug | N/A â€” documentation gap only | Policy documented: unused hours forfeited on expiry (no refund). Intentional. 365-day window + 3-stage advance notification. Customer can cancel before expiry for partial refund. Source-verified: `packageExpiryAlerts.ts` issues no refund; `packages/route.ts` states policy explicitly. | âœ… CLOSED | `docs/DOCROLEBASE/06-payments/PACKAGE_EXPIRY_REFUND_POLICY.md` | PAY-H-06 |
| AUDIT-03 | AuditLog deletable (no DB trigger) | LOW | CONFIRMED | VERIFIED â€” no immutability protection | `prisma/migrations/20261015000001_audit03_auditlog_immutable/migration.sql` â€” `CREATE FUNCTION prevent_auditlog_delete()` + `BEFORE DELETE` trigger on `"AuditLog"` | V1 ORM delete â†’ P0001 trigger error; V2 deleteMany â†’ blocked; V3 raw SQL DELETE â†’ P0001 (database-level proof); V4 CREATE still works; V5 $transaction delete â†’ blocked. 7/7 AUDIT-05-HTTP suite passes after teardown refactor. 5 `auditLog.delete/deleteMany` calls removed from 4 test files â€” replaced with timestamp-prefix isolation. | âœ… CLOSED | `scripts/verify-audit03-trigger.mjs` | AUDIT-03 |
| AUDIT-04 | No audit log retention policy | LOW | CONFIRMED | VERIFIED (source) â€” policy documented in 4 ops docs; `AUDIT_RETENTION_DAYS = 2555` (7 years) defined in `lib/config/governance.ts`. Enforcement gap: constant is defined but no archival/purge cron uses it â€” AuditLog grows unbounded. | N/A â€” documentation gap resolved; enforcement deferred (operational concern, not security finding) | Policy documented: `docs/operations/07-security-fraud.md`, `docs/operations/01-admin-governance.md`, `docs/operations/10-audit-compliance.md`, `docs/DOCROLEBASE/00-overview/ADMIN_BUSINESS_RULES.md` all state 7-year retention. `AUDIT_RETENTION_DAYS=2555` defined in governance.ts but not used by any cron. Enforcement (archival cron) is an operational task, not an audit-security gap. AUDIT-03 (immutability trigger) now makes unbounded growth the only remaining risk, which is operational cost not security. | âœ… CLOSED | `lib/config/governance.ts`, `docs/operations/07-security-fraud.md` | AUDIT-04 |
| APP-H-04 | Role catalogue incomplete | LOW | ARCHITECTURAL | VERIFIED â€” documented gap | N/A â€” documentation | Role catalogue created: `docs/DOCROLEBASE/00-overview/ROLES.md` â€” lists all `User.role` string values (`CLIENT`, `INSTRUCTOR`, `ADMIN`, `SUPER_ADMIN`), the four StaffMember presets (ADMIN/FINANCE/OPERATIONS/SUPPORT), role assignment flow, and the `'provider'` string discrepancy in `requireInstructor()`. | âœ… CLOSED | `docs/DOCROLEBASE/00-overview/ROLES.md` | APP-H-04 |
| APP-H-05 | No centralised authorisation matrix | LOW | ARCHITECTURAL | VERIFIED â€” documented gap | N/A â€” documentation | RBAC-SPEC.md already contains the full 47-permission matrix (Sections 1â€“4). Gap: pre-Phase 4 permission names diverge from `lib/rbac/permissions.ts`. Added APP-H-05 note to RBAC-SPEC.md header documenting the naming drift and declaring `lib/rbac/permissions.ts` as canonical. | âœ… CLOSED | `docs/DOCROLEBASE/00-overview/RBAC-SPEC.md` | APP-H-05 |
| APP-H-06 | DIRECT booking mode undocumented | LOW | ARCHITECTURAL | VERIFIED â€” feature exists without docs | N/A â€” documentation | Payment modes documented: `docs/DOCROLEBASE/06-payments/PAYMENT_MODES.md` â€” states PLATFORM is active, DIRECT is Phase 2/blocked, lists what is built vs not built, documents the 503 production guard, links to `docs/newplan/PAYMENT-WHITE-LABEL.md` for full design. | âœ… CLOSED | `docs/DOCROLEBASE/06-payments/PAYMENT_MODES.md` | APP-H-06 |
| APP-H-07 | Business template feature incomplete | LOW | ARCHITECTURAL | VERIFIED â€” feature incomplete | N/A â€” documentation | Business types documented: `docs/DOCROLEBASE/00-overview/BUSINESS_TYPES_STATUS.md` â€” states INDIVIDUAL is fully operational, DRIVING_SCHOOL/CORPORATE are Phase 2 stubs, documents the lazy-repair invariant when `createBusinessFromTemplate()` fails, lists the business-config-schema models. | âœ… CLOSED | `docs/DOCROLEBASE/00-overview/BUSINESS_TYPES_STATUS.md` | APP-H-07 |
| APP-H-08 | RBAC usage guide missing | LOW | ARCHITECTURAL | VERIFIED â€” onboarding gap | N/A â€” documentation | RBAC usage guide created: `docs/DOCROLEBASE/08-technical/RBAC_USAGE_GUIDE.md` â€” covers `requirePermission` vs `checkPermission`, `PERM.*` usage, adding new permissions to `lib/rbac/permissions.ts` + presets, role hierarchy, and test patterns. | âœ… CLOSED | `docs/DOCROLEBASE/08-technical/RBAC_USAGE_GUIDE.md` | APP-H-08 |

### 1.5 â€” Deferred

| ID | Title | Risk | Finding | Status | Reason |
|---|---|---|---|---|---|
| AI-M-01 | AI prompt injection | MEDIUM | CONFIRMED | â¸ DEFERRED | Awaiting AI architecture redesign |
| AI-M-02 | AI tool authorisation completeness | MEDIUM | CONFIRMED | â¸ DEFERRED | Awaiting AI architecture redesign |

### 1.6 â€” Rejected / Verified Safe

| ID | Title | Finding | Reason |
|---|---|---|---|
| P0-02 | Client reschedule TOCTOU | REJECTED | Code has correct ownership check |
| P0-03 | Reviews authorisation missing | REJECTED | Ownership check present at line 207 |
| PAY-H-03 | Package hour credit race | REJECTED | Transaction-wrapped updateMany with status guard â€” safe |
| PAY-H-05 | Wallet-booking disconnect | REJECTED | Separate flows by design; balance checked atomically |
| AUTH-M-01 | Session fixation | REJECTED | NextAuth v4 regenerates tokens on auth |
| AUTH-M-02 | Token rotation | REJECTED | NextAuth v4 handles JWT rotation |
| RBAC-M-01 | Role escalation via API | REJECTED | No route allows self-role modification |
| APP-H-01/02/03 | Rate limiting gaps | REJECTED | Vercel Edge + Stripe built-in limits adequate |
| DATA-M-01/02/03 | Data over-projection | REJECTED | Projections verified appropriate |
| INT-M-01C | SMS delivery failure | REJECTED | Notification-only; fire-and-forget acceptable |
| INT-M-01D | Webhook retry behaviour | REJECTED | WebhookEvent idempotency key prevents duplicate processing |
| INT-M-02 | Email failure handling | REJECTED | Fire-and-forget; retry queue exists for critical emails |
| INT-M-03B/C/D/E | OAuth token sub-issues | REJECTED | Refresh, exposure, expiry, scope all verified safe |

---

## Section 2 â€” Phase 2: PAY-01 Payout Destination Ownership

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| PAY-01 | Provider payout destination ownership | HIGH | CONFIRMED | VERIFIED â€” `executePayout()` used DB-supplied `stripeAccountId` without Stripe-side check | `b9c2f0ff` â€” `verifyPayoutDestinationOwnership()` before `stripe.transfers.create()`; TOCTOU-safe `const verifiedAccountId` | 28 tests, exit 0 | âœ… CLOSED | `phase2/PAY-01-INVESTIGATION-STATUS.md` |

**PAY-01 sub-task evidence:**

| Sub-task | Purpose | Status | Evidence |
|---|---|---|---|
| PAY-01-A | Write-path audit â€” confirmed DB-write attack vector, no API path | âœ… CLOSED | `phase2/PAY-01-STRIPE-RELATIONSHIP-AUDIT.md` |
| PAY-01-B | Stripe metadata binding â€” `metadata.providerId` authoritative for this threat model | âœ… CLOSED | `phase2/PAY-01-STRIPE-RELATIONSHIP-AUDIT.md` |
| PAY-01-C | Reproduction + regression tests | âœ… CLOSED | `phase2/PAY-01-C-REPRODUCTION-TEST.md`; `payout-security.test.ts` 7/7; `pay-01-executePayout-security.test.ts` 5/5 |
| PAY-01-D | Post-fix state/retry/idempotency/ledger/alert/concurrency | âœ… CLOSED | `pay-01-d-state-consistency.test.ts` 16/16; exit 0 |

**Test files (all in `lib/services/__tests__/`):**
- `payout-security.test.ts` â€” 7 unit tests for helper
- `pay-01-executePayout-security.test.ts` â€” 5 service-level tests; critical: `transfers.create` NOT called on failure; TOCTOU assertion
- `pay-01-d-state-consistency.test.ts` â€” 16 tests: D1 state, D2 retry, D3 idempotency, D4 ledger, D5 alerts, D6 concurrency

**OPS-01 (operational note, not a finding):** `sendAlert()` in catch block is fire-and-forget. Payout correctly reaches FAILED state independently of alert delivery. Not a financial invariant issue.

---

## Section 3 â€” Phase 2: Money-Movement Inventory

Full inventory: `MONEY-MOVEMENT-INVENTORY.md`

### 3.1 â€” Controlled (no fix required)

| ID | Title | Risk | Status | Evidence |
|---|---|---|---|---|
| MM-01 | Provider payout (Stripe Connect) | NONE | âœ… CONTROLLED â€” PAY-01 closed | `MONEY-MOVEMENT-INVENTORY.md` |
| MM-04 | Wallet top-up webhook confirmation | NONE | âœ… CONTROLLED | `MONEY-MOVEMENT-INVENTORY.md` |
| MM-08 | Subscription checkout | NONE | âœ… CONTROLLED | `MONEY-MOVEMENT-INVENTORY.md` |
| MM-11 | Stripe Connect account creation | NONE | âœ… CONTROLLED | `MONEY-MOVEMENT-INVENTORY.md` |
| MM-13 | Wallet-funded booking | NONE | âœ… CONTROLLED | `MONEY-MOVEMENT-INVENTORY.md` |
| MM-16 | Reconciliation cron (read-only) | NONE | âœ… CONTROLLED | `MONEY-MOVEMENT-INVENTORY.md` |

### 3.2 â€” MM-10: SUPERSEDED (reclassified 2026-09-16)

| ID | Title | Status | Reason | Replaced-by |
|---|---|---|---|---|
| MM-10 | SaaS direct-to-provider payment (PAY-01 parallel) | **SUPERSEDED** | Original HIGH classification was incorrect. `saas-payment.ts` never reads `provider.stripeAccountId`; no `transfer_data.destination` in session params; money lands on platform account not provider. PAY-01 account-substitution attack class not applicable. | MM-10-A, MM-10-B, MM-10-C |

Sub-findings from reclassification:

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| MM-10-A | SaaS provider routing absent â€” no `transfer_data.destination` | ARCHITECTURAL | **SUPERSEDED** | VERIFIED â€” `saas-payment.ts` confirmed: no `transfer_data` in `sessionParams`; money lands on platform. Original finding premise was incorrect: this is deliberate `PLATFORM` mode, not an accidentally omitted destination. | N/A | N/A | **SUPERSEDED â€” Accepted as intentional architecture; no remediation required.** `DIRECT` mode (provider Stripe account routing) is Phase 2, blocked by `assertPlatformPaymentMode()`. Product roadmap tracked in `docs/newplan/PAYMENT-WHITE-LABEL.md`. PAY-01 threat model does not apply. | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-10-B | Concurrent checkout session creation â€” double-charge | MEDIUM | CONFIRMED | VERIFIED â€” `Quote.stripeSessionId` write not conditional on null; no Stripe idempotency key; two concurrent accepts â†’ two independently payable sessions | This commit â€” `Quote.checkoutGeneration Int @default(1)`; Stripe idempotency key `scs-{quoteId}-{generation}`; `advanceCheckoutGeneration()` CAS on (stripeSessionId, checkoutGeneration); `_createAndBindSession()` CAS write WHERE stripeSessionId IS NULL AND checkoutGeneration=N; loser reads winner session; expiredâ†’automatic generation advance; lookup error NOT treated as expiry; completedâ†’QuoteAlreadyPaidError; accept route allows PENDING_PAYMENT re-entry | 13 MM-10-B tests (S1â€“S10), exit 0 â€” `mm-10b-checkout-session.test.ts` | âœ… FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-10-C | `applicationFeeAmount` always zero â€” commission config defect | MEDIUM | CONFIRMED | VERIFIED â€” `commissionPercent` not a field on `BusinessConfig`; `assembleConfig()` never sets it; `?? 0` fallback makes fee zero | This commit â€” `commissionPercent: number` added to `BusinessConfig` interface; `assembleConfig()` maps `settings.commissionRate`; `saas-payment.ts` reads `businessConfig.commissionPercent` directly (no `as any`); all three templates updated | 13 MM-10-C tests (C1â€“C6 + data path), exit 0 â€” `mm-10c-commission-fee.test.ts` | âœ… FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |

### 3.3 â€” MM-05: Refund Idempotency (5 confirmed sites)

Structural root weakness: no dedicated `Refund` entity. State scattered across `Booking.stripeRefundId`, `Booking.cancellationStatus`, `LedgerEntry`, `Transaction`. Fix must establish one authoritative refund lifecycle used by all entry points.

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| MM-05-A | Concurrent admin refund race â€” `approveCancellation()` | HIGH | CONFIRMED | VERIFIED â€” `booking-service.ts` ~659: no idempotency key; `cancellationStatus` check not atomic with Stripe call (TOCTOU) | `dc13c7b0` â€” CAS `PENDINGâ†’APPROVING` via `updateMany`; idempotency key `approve-cancel-${bookingId}`; `APPROVINGâ†’PENDING` revert on error; `REFUND_ISSUED` written in tx | 7 MM-integrity tests, exit 0 | âœ… FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-05-B | Lost-refund / no-retry gap â€” public cancel route | MEDIUM | CONFIRMED | VERIFIED â€” `public/bookings/[id]/cancel` ~250: atomic CAS exists (prevents double-cancel); Stripe call outside transaction; no idempotency key means no safe retry | `dc13c7b0` â€” idempotency key `cancel-refund-${id}` added to Stripe call | 5 MM-05-B tests (B1â€“B3), exit 0 â€” `mm-05b-cancel-route.test.ts` | âœ… FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-05-C | Concurrent admin transaction refund | HIGH | CONFIRMED | VERIFIED â€” `admin/transactions/[id]/refund` ~99: no atomic gate, no idempotency key; `transaction.status` check not atomic with Stripe call | `dc13c7b0` + hardened in follow-up â€” CAS `COMPLETEDâ†’REFUNDING`; idempotency key `admin-refund-${transactionId}`; `REFUND_ISSUED` now atomic inside `prisma.$transaction` via `tx.ledgerEntry.create`; revert on error | 7 MM-integrity tests, exit 0 | âœ… FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-05-D | No app-level guard on 3DS/prepaid auto-refund (Site A) | LOW | CONFIRMED | VERIFIED â€” `webhook/route.ts` ~392: no idempotency key, no `recordWebhookEvent()` call on this path | This commit (corrected) â€” `stripe.refunds.create()` with `idempotencyKey=checkout-refund-block-{sessionId}` called FIRST; `recordWebhookEvent()` written AFTER Stripe confirms; Stripe failure throws (no WebhookEvent written, retry safe) | 7 MM-05-D extracted-logic tests (D1â€“D6 incl. I1/I2 invariants), exit 0 â€” `mm-05d-webhook-3ds-refund.test.ts`; **PLUS 6/6 direct-handler tests (D-P1â€“D-P6), exit 0 â€” `mm-05d-direct-handler.test.ts` @ 2026-10-05 against isolated Postgres port 5433**. D-P1: prepaid card â†’ 200 + refund + WebhookEvent; D-P2: 3DS failed â†’ same; D-P3: Stripe fail â†’ 500 + no WebhookEvent + retry succeeds; D-P4: duplicate â†’ 200 + same idempotency key; D-P5: concurrent â†’ 1 WebhookEvent; D-P6: credit card â†’ normal path, no block. | âœ… FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-05-E | WebhookEvent rolls back on expired-booking refund (Site B) | LOW | **SUPERSEDED** | VERIFIED â€” original claim "Stripe retries indefinitely" does not match production code. See revised finding MM-05-E-R and secondary finding MM-05-E-S below. | N/A | N/A | **SUPERSEDED â†’ MM-05-E-R** | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-05-E-R | Expired-booking path leaves no WebhookEvent row â€” audit/observability gap | LOW | CONFIRMED | VERIFIED (cfadf3c9) â€” see full execution trace and consumer audit in Section 5.1 | This commit â€” `recordWebhookEvent(tx, ...)` written inside SERIALIZABLE `$transaction` **after** Stripe refund confirms; DuplicateWebhookEventError only swallowed **after** booking state verified correct | 11 MM-05-E extracted-logic tests (E1â€“E8 incl. all INV), exit 0 â€” `mm-05e-expired-booking-refund.test.ts`; **PLUS 7/7 direct-handler tests (E-P1â€“E-P7), exit 0 â€” `mm-05e-direct-handler.test.ts` @ 2026-10-05 against isolated Postgres port 5433**. E-P1: EXPIREDâ†’CANCELLED+refundId+WebhookEvent; E-P2: Stripe failâ†’500+EXPIRED+no WebhookEvent+retry; E-P3: full happy path end-to-end; E-P4: duplicateâ†’idempotent 200; E-P5: idempotent retry after success; E-P6: concurrentâ†’1 WebhookEvent+CANCELLED; E-P7: CONFIRMEDâ†’normal path, no refund | âœ… FIX-VERIFIED | this commit |
| MM-05-E-S | `tx.booking.update(CANCELLED)` rolls back with transaction â€” booking stays EXPIRED | LOW | CONFIRMED | VERIFIED (cfadf3c9) â€” `tx.booking.update` inside rolled-back tx; booking stays EXPIRED after entire path | This commit â€” `prisma.booking.updateMany WHERE status='EXPIRED'` with CAS semantics outside the inner tx (in post-refund SERIALIZABLE tx); count=0 triggers state-verification branch: idempotent / repair / integrity-error / unexpected-status | 11 MM-05-E extracted-logic tests (E4â€“E6 directly verify state-verification branch), exit 0; **direct-handler E-P1/E-P2/E-P3 all verify CANCELLED terminal state and WebhookEvent at isolated Postgres port 5433, exit 0** | âœ… FIX-VERIFIED | this commit |

### 3.4 â€” MM-06 / MM-07 / MM-12 / MM-14 / MM-15

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| MM-06 | Duplicate-charge auto-refund â€” missing idempotency key | MEDIUM | **SUPERSEDED** | VERIFIED â€” alleged production call site does not constitute a distinct finding. Source-verified `handleBookingPaymentFailed` contains no `stripe.refunds.create()` call. The only 3DS/prepaid auto-refund path in the webhook route is already tracked and remediated under MM-05-D. Two attributions found in audit documents, both unsupported as distinct from MM-05-D: (1) `handleBookingPaymentFailed` attribution in MONEY-MOVEMENT-INVENTORY.md is not corroborated by source; (2) investigation doc explicitly identifies MM-06 as "Site A, 3DS/prepaid" which is MM-05-D's exact path. `grep refunds.create` over entire route confirms exactly two call sites, both now fixed. | Subsumed by MM-05-D (`7f839694`) | MM-05-D targeted evidence, 7/7 exit 0 | **SUPERSEDED â†’ MM-05-D** | `phase2/MM10-MM05-INVESTIGATION.md` (historical); source grep this commit |
| MM-07 | Refund ledger reconciliation defect | MEDIUM | CONFIRMED | VERIFIED â€” Sites C/D/E write no `REFUND_ISSUED` ledger entry; `handleChargeRefunded()` sees `alreadyRecordedRefund=0` â†’ writes duplicate `REFUND_SYNCED`; no wallet double-credit; ledger `totalRefunded` systematically over-counted | `dc13c7b0` â€” both `approveCancellation()` and admin transaction refund now write `REFUND_ISSUED` atomically; `handleChargeRefunded()` guard already queries this type | 7 MM-integrity tests (T1/T3 directly verify guard), exit 0 | âœ… FIX-VERIFIED | `phase2/MM10-MM05-INVESTIGATION.md` |
| MM-09 | Subscription cancellation â€” no internal ownership guard | N/A | **REJECTED-AS-INVALID** | **ORIGINAL PREMISE INVALIDATED (fcfc833f)** â€” Finding stated `subscription-cancel.ts` accepts `stripeSubId` from caller. Source verification shows service accepts `providerId`, NOT `stripeSubId`. Service internally queries `Subscription` table using `providerId` to retrieve subscription, then extracts `stripeSubscriptionId` from DB record before calling Stripe. Caller never supplies Stripe IDs. Authorization analysis: (1) Web route uses `session â†’ user.provider.id` (own subscription only), (2) Mobile route uses `JWT â†’ instructor.id` (own subscription only), (3) Admin route uses `params.id` with `PERM.USERS_PROVIDERS_MANAGE_SUBSCRIPTION` check (intentional authorized privilege escalation). No identified production caller supplies arbitrary Stripe subscription IDs or bypasses applicable authorization. The described attack vector does not exist in inspected production call paths. | N/A | N/A | âœ… CLOSED â€” REJECTED | Source inspection @ fcfc833f: `lib/services/subscription-cancel.ts`, `app/api/instructor/subscription/route.ts`, `app/api/instructor/subscription/mobile/route.ts`, `app/api/admin/instructors/[id]/subscription/route.ts` |
| MM-12 | Admin wallet credit/debit â€” no idempotency | MEDIUM | CONFIRMED | VERIFIED â€” `add-credit/route.ts` no duplicate-submit protection | `638888f0` â€” `AdminWalletIdempotencyKey` table; claim-first `INSERT ON CONFLICT` inside `prisma.$transaction`; `SELECT FOR UPDATE` on deduction path | 10 MM-12-E HTTP tests (E1â€“E6 + E1-seq), exit 0 â€” `mm-12e-admin-wallet-idempotency-verification.test.ts` (2026-09-22); production verification 2026-09-24T06:59:28Z: SHA b298eaab VERIFIED (638888f0 ancestry confirmed), AdminWalletIdempotencyKey table + composite index PRESENT, **Financial invariants VERIFIED:** Check 3 concurrent same-key â†’ 1 tx committed, $50 balance (INVARIANT 1 proven); Check 4 replay PASS; Check 5 distinct keys PASS; Check 6 concurrent deductions â†’ balance not negative (INVARIANT 2 proven); Check 7 no orphan PASS; Check 8 DB invariants PASS. **HTTP response defect noted:** Check 3 Request B returned 500 (not 409) during tight concurrency race â€” financial postcondition correct, API contract violated â€” tracked as separate follow-up MM-12-HTTP (LOW). See docs/audit/MM-12-PRODUCTION-VERIFICATION.txt, docs/audit/MM-12-HTTP-500-FOLLOW-UP.md | âœ… CLOSED (financial security remediation verified) | `docs/audit/MM-12-E_EXECUTION_LOG.txt`, `docs/audit/MM-12-PRODUCTION-VERIFICATION.txt`, `docs/audit/MM-12-HTTP-500-FOLLOW-UP.md` |
| MM-14 | Dispute handling â€” `charge.refunded` double-count after lost dispute | MEDIUM | CONFIRMED | VERIFIED â€” `handleChargeRefunded()` type guard only checks `REFUND_ISSUED`/`REFUND_SYNCED`; `DISPUTE_LOST` entries not included; Stripe fires `charge.refunded` automatically after a lost chargeback; results in spurious `REFUND_SYNCED` written on top of existing `DISPUTE_LOST` | `dc13c7b0` â€” `DISPUTE_LOST` added to `type: { in: [...] }` filter in `handleChargeRefunded()` | 7 MM-integrity tests (T2 directly verifies DISPUTE_LOST guard), exit 0 | âœ… FIX-VERIFIED | `phase2/MM14-MM15-VERIFICATION.md` |
| MM-15-A | Late `transfer.failed` reverses a successfully-retried payout | MEDIUM | CONFIRMED | VERIFIED â€” `payout.updateMany WHERE status='PAID'` does NOT filter on `stripeTransferId`; late event for original failed transfer matches payout re-PAID via retry; reversal incorrectly applied to completed payout | `dc13c7b0` â€” `stripeTransferId: transferId` added to `payout.updateMany` WHERE clause in `handleTransferFailed()` | 7 MM-integrity tests (T4/T5 directly verify transferId guard), exit 0 | âœ… FIX-VERIFIED | `phase2/MM14-MM15-VERIFICATION.md` |
| MM-15-B | `handleTransferFailed()` non-atomic: idempotency key consumed before financial reversal | MEDIUM | CONFIRMED | VERIFIED â€” `recordWebhookEvent(prisma, ...)` called outside `$transaction`; if `appendLedgerEntry`/`incrementLedger` fail after webhook record is committed, idempotency key prevents retry but reversal never completes | `dc13c7b0` â€” `recordWebhookEvent(tx, ...)` now inside `withSerializableRetry(prisma.$transaction(...))` atomically with payout reversal and ledger ops | 7 MM-integrity tests (T6/T7 directly verify atomicity and concurrency), exit 0 | âœ… FIX-VERIFIED | `phase2/MM14-MM15-VERIFICATION.md` |

### 3.5 â€” Dead Code

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status |
|---|---|---|---|---|---|---|---|
| MM-02 | `StripeService.createPayout()` â€” unguarded, zero callers | MEDIUM | CONFIRMED | VERIFIED â€” grep confirms 0 callers; method has no ownership check, no idempotency, no ledger | Deleted from `lib/services/stripe.ts` | Post-deletion grep: 0 source references; TS build: 0 new errors | âœ… CLOSED |
| MM-17 | Same as MM-02 (duplicate inventory entry) | â€” | SUPERSEDED | â€” | â€” | â€” | SUPERSEDED â†’ MM-02 |

### 3.6 â€” Minor Open

| ID | Title | Risk | Finding | Status |
|---|---|---|---|---|
| MM-03 | Customer payment intent â€” wallet top-up amount bounds | LOW | CONFIRMED | VERIFIED â€” hardcoded min($10)/max($10,000) ignored admin-configured walletTopUpMin/Max | `wallet-topup-intent/route.ts` â€” replaced hardcoded Zod bounds with runtime `getPlatformPricing()` check; added ZodError â†’ 400 handler | 11/11 tests pass: B1â€“B6 bounds enforcement (incl. custom settings), B7 ZodErrorâ†’400, B8â€“B9 auth, I1â€“I2 happy path. Exit 0. | âœ… CLOSED | `__tests__/integration/mm-03-wallet-topup-amount-bounds.test.ts` |
| MM-12-HTTP | Concurrent same-key race HTTP 500 (not 409) | LOW | CONFIRMED | VERIFIED â€” Prisma P2034/P40001 from idempotency INSERT race propagated to outer catch â†’ 500 instead of 409 | `add-credit/route.ts` + `deduct-credit/route.ts` â€” added serialization error detection in inner catch; P2034, P40001, deadlock, "could not serialize" â†’ 409 | 10/10 tests pass: S1â€“S4 P2034/P40001 on both routes, S5 IN_FLIGHT regression, S6 REPLAY regression, S7a/S7b genuine error still 500, S8â€“S9 string patterns. Exit 0. | âœ… CLOSED | `__tests__/integration/mm-12-http-serialization-409.test.ts` |

---

## Section 4 â€” Current Priority Queue

> Ordered by confirmed severity and P0/P1/P2 classification.  
> **No finding may enter FIX stage without VERIFIED status.**

### P0 â€” Fix before next release (all VERIFIED, awaiting fix)

> All P0 items have been fixed in `dc13c7b0`. Status updated below.

| # | ID | Title | Key risk | Status |
|---|---|---|---|---|
| 1 | MM-07 | Refund ledger reconciliation defect | Ledger `totalRefunded` over-counted on every admin cancellation | âœ… FIXED `dc13c7b0` |
| 2 | MM-05-A | Concurrent admin refund race in `approveCancellation()` | Two admins can double-refund same booking | âœ… FIXED `dc13c7b0` |
| 3 | MM-05-C | Concurrent admin transaction refund | Fully unprotected â€” no gate, no key | âœ… FIXED `dc13c7b0` + REFUND_ISSUED atomicity hardened in follow-up |
| 4 | MM-05-B | Lost-refund gap on public cancel route | Stripe failure after DB commit leaves booking cancelled but no refund issued | âœ… FIXED `dc13c7b0` (idempotency key added) â€” targeted test pending |

### P1 â€” Next sprint (all VERIFIED, awaiting fix)

| # | ID | Title | Status |
|---|---|---|---|
| 5 | MM-10-B | Concurrent checkout session creation â€” double-charge | âœ… FIXED this commit |
| 6 | MM-10-C | `applicationFeeAmount` always zero | âœ… FIXED this commit |
| 7 | MM-10-A | SaaS provider routing absent â€” no `transfer_data.destination` | SUPERSEDED â€” accepted as intentional PLATFORM-mode architecture |
| 8 | MM-05-D | 3DS/prepaid auto-refund idempotency key + `recordWebhookEvent()` | âœ… FIXED this commit |
| 9 | MM-05-E | Fix WebhookEvent rollback in expired-booking path | SUPERSEDED â†’ MM-05-E-R (observability gap, FIX DECISION PENDING) |
| 10 | MM-15-A | Late `transfer.failed` reverses retried payout | âœ… FIXED `dc13c7b0` |
| 11 | MM-15-B | `handleTransferFailed()` non-atomic | âœ… FIXED `dc13c7b0` |
| 12 | PAY-H-01 / INT-M-01A | Stripe refund reconciliation cron | âœ… FIXED this commit (Path B + Check 5) |
| 13 | PAY-H-02 | Booking reschedule price recalculation | âœ… FIXED this commit |
| 14 | MM-14 | `charge.refunded` double-count after lost dispute | âœ… FIXED `dc13c7b0` |

### P2 â€” Follow-up

| # | ID | Title |
|---|---|---|
| 14 | MM-12 | Admin wallet credit idempotency | âœ… CLOSED â€” 638888f0 + production verified 2026-09-24 |
| 15 | MM-02 | Delete `StripeService.createPayout()` | âœ… CLOSED â€” deleted, 0 source references post-deletion |
| 16 | INT-M-03A | Encrypt OAuth tokens at rest | ✅ CLOSED — `ec928470` / evidence `a81c2aa6` |
| 17 | INT-M-03F | Revoke OAuth token on calendar disconnect | ✅ CLOSED — `e4488298` ✅ Vercel SUCCESS |
| 18 | PAY-H-04 | SlotReservation unique constraint | âœ… CLOSED â€” 560a77c2 + production verified 2026-09-24 |
| 19 | DOC-EXP-01 | Block bookings with expired provider documents | ✅ CLOSED — checkProviderEligible() applied to 6 routes |
| 20 | DATA-EXP-01 | Remove phone from public instructor API | ✅ CLOSED — phone removed from public projection |
| 21 | AUDIT-01/02/05 | Audit logging hardening | ✅ CLOSED — writeAuditLog(tx) + atomicity + immutability trigger |
| 22 | RBAC-M-02 | Replace role checks with permission checks in admin routes | ✅ CLOSED — 118 call-sites, requirePermission(PERM.*) |

---

## Section 5 â€” Reconciliation Summary

### Findings with missing lifecycle evidence

| ID | Gap | Action required |
|---|---|---|
| MM-05-B | Fix present in `dc13c7b0`; targeted test added in follow-up commit | âœ… RESOLVED â€” `mm-05b-cancel-route.test.ts` 5/5 exit 0 |
| MM-05-D | Finding CONFIRMED, Verification VERIFIED â€” fix NOT-STARTED | âœ… RESOLVED â€” fixed this commit; `mm-05d-webhook-3ds-refund.test.ts` 7/7 exit 0 |
| MM-05-E | Finding CONFIRMED, Verification VERIFIED â€” fix NOT-STARTED | âœ… SUPERSEDED â€” original "Stripe retries indefinitely" claim refuted; revised as MM-05-E-R/MM-05-E-S; FIX DECISION PENDING |
| MM-05-E-R | New finding â€” no WebhookEvent row on expired-booking path | âœ… FIX-VERIFIED this commit â€” 11 tests E1â€“E8 exit 0 |
| MM-05-E-S | New finding â€” booking.status stays EXPIRED (not CANCELLED) after expired-booking path | âœ… FIX-VERIFIED this commit â€” 11 tests E1â€“E8 exit 0 |
| AUDIT-04 | Finding CONFIRMED but Verification UNVERIFIED | Read retention policy (or absence of one) before advancing |
| PAY-H-01 | Finding CONFIRMED, Verification VERIFIED â€” fix complete this commit | âœ… FIX-VERIFIED â€” Path B + Check 5; 15 tests exit 0 |
| PAY-H-02 | Finding CONFIRMED, Verification VERIFIED â€” fix complete `a2fa69fc` | âœ… FIX-VERIFIED â€” 35 tests exit 0; Vercel SUCCESS `a2fa69fc`. **Open note:** `Transaction.updateMany` logs a warning if count > 1 eligible BOOKING_PAYMENT row exists but does not treat it as an error. Transaction multiplicity is not independently proven to be impossible. Until the invariant is directly verified (e.g., via isolated-Postgres test), treat count > 1 as a gap to watch. |

**Resolved discrepancies (previously listed here):**

| ID | Previous gap | Resolution |
|---|---|---|
| MM-14 | Verification evidence was `ba61c154`; fix not started | Fixed in `dc13c7b0`; verified by mm-financial-integrity T2 |
| MM-15-A | Verification evidence was `ba61c154`; fix not started | Fixed in `dc13c7b0`; verified by mm-financial-integrity T4/T5 |
| MM-15-B | Verification evidence was `ba61c154`; fix not started | Fixed in `dc13c7b0`; verified by mm-financial-integrity T6/T7 |
| MM-05-A | Fix not started | Fixed in `dc13c7b0`; verified by mm-financial-integrity T1/T3 |
| MM-05-C | Fix not started; REFUND_ISSUED was non-fatal try/catch | Fixed in `dc13c7b0`; REFUND_ISSUED atomicity hardened post-commit (`tx.ledgerEntry.create` inside `prisma.$transaction`) |
| MM-07 | Fix not started | Fixed in `dc13c7b0`; verified by mm-financial-integrity T1/T3 |

### Findings with no targeted tests (closure not yet possible)

All OPEN findings have no targeted tests by definition â€” tests are part of FIX-VERIFIED stage.  
The following CLOSED findings have tests recorded:

| ID | Tests | Exit code | Commit |
|---|---|---|---|
| P0-01A | 12 (ownership + concurrent) | 0 | `b9c2f0ff` |
| P0-01B | 12 (ownership + concurrent) | 0 | `b9c2f0ff` |
| PAY-01 | 28 (7 unit + 5 service + 16 state) | 0 | `b9c2f0ff` |
| MM-05-A / MM-05-C / MM-07 / MM-14 / MM-15-A / MM-15-B | 7 (T1â€“T7 cross-path invariants in `mm-financial-integrity.test.ts`) | 0 | `dc13c7b0` (fix) + local hardening of MM-05-C |
| MM-05-B | 5 (B1â€“B3 idempotency/CAS/non-fatal in `mm-05b-cancel-route.test.ts`) | 0 | follow-up to `dc13c7b0` |
| MM-05-D | 7 (D1â€“D6 ordering/key/I1/I2/concurrent in `mm-05d-webhook-3ds-refund.test.ts`) | 0 | this commit (corrected) |
| MM-12 | 10 HTTP integration tests (E1â€“E6 + E1-seq in `mm-12e-admin-wallet-idempotency-verification.test.ts`) â€” real Next.js server, isolated PostgreSQL, real NextAuth session | 0 | `638888f0` (fix) + `788503b1` (evidence) |
| MM-10-B | 13 (S1â€“S10 + 2 advanceCheckoutGeneration unit tests in `mm-10b-checkout-session.test.ts`) | 0 | `6e3211c2` |
| MM-10-C | 13 (C1â€“C6 + data path in `mm-10c-commission-fee.test.ts`) | 0 | `9fd2893d` | `899929c4` âœ… Vercel SUCCESS |
| PAY-H-01 / INT-M-01A | 15 (PH-1â€“PH-10 + edge cases in `pay-h01-refund-reconciliation.test.ts`) | 0 | `71dc11ad` | `899929c4` âœ… Vercel SUCCESS |
| PAY-H-02 | 35 (F1â€“F9 pure + R1â€“R26 service in `pay-h02-reschedule-financials.test.ts`) | 0 | `a2fa69fc` | `a2fa69fc` âœ… Vercel SUCCESS |
| INT-M-03F | 18 (T1â€“T11 + variants in `int-m03f-oauth-revocation.test.ts`) | 0 | `14628e9d` + caller audit `e4488298` | `e4488298` âœ… Vercel SUCCESS |

All other CLOSED Phase 1 findings were closed by source verification without dedicated targeted tests. This is an acknowledged gap from Phase 1 methodology â€” fixing it is out of scope while open P0 items exist.

**Vercel deployment evidence:**

| Finding(s) | Fix commit | Vercel deployment commit | Vercel status |
|---|---|---|---|
| MM-10-B | `6e3211c2` | `6e3211c2` | âœ… SUCCESS (confirmed by independent review) |
| MM-10-C | `9fd2893d` | `899929c4` (TS fix: missing constructors) | âœ… SUCCESS â€” confirmed `899929c4` |
| PAY-H-01 / INT-M-01A | `71dc11ad` | `899929c4` (TS fix) | âœ… SUCCESS â€” confirmed `899929c4` |
| MM-05-D / MM-05-E-R/S / MM-05-Aâ€“C / MM-07 / MM-14 / MM-15 | various | â€” | â³ Pending isolated-Postgres direct-path execution |
| PB-UI-01/02/04 copy corrections + BRAND-V-05 TS build fix | `ba9403b1` (copy) / `b74a7c1f` (null-guard) | `b74a7c1f` | ✅ SUCCESS — confirmed by independent review 2026-10-13; reviewer note: Vitest could not be independently re-executed due to network constraints; source diff and Vercel deployment status confirmed |

---

## Section 5.1 â€” MM-05-E Investigation Evidence (this commit)

### Production execution trace â€” expired-booking webhook path

**File:** `app/api/stripe/webhook/route.ts`  
**Function:** `handleBookingPaymentSuccess()` lines ~927â€“1190  
**Trigger:** Stripe delivers `payment_intent.succeeded` for a booking whose slot expired before Stripe confirmed payment.

```
withSerializableRetry(() =>
  prisma.$transaction(async (tx) => {           â† SERIALIZABLE transaction opens
    [L963] recordWebhookEvent(tx, ...)           â† INSERT WebhookEvent (uses tx)
    [L971] booking = tx.booking.findUnique(...)
    [L986] booking.status === 'EXPIRED':
      [L990]  tx.booking.update(EXPIREDâ†’CANCELLED)  â† UPDATE booking (uses tx)
      [L998]  throw new ExpiredBookingError(...)     â† ROLLS BACK entire tx
  })                                            â† WebhookEvent INSERT rolled back
)                                               â† booking stays EXPIRED (update rolled back too)
                                                â† comment "mark as CANCELLED INSIDE tx" is incorrect
â†“ ExpiredBookingError propagates out of withSerializableRetry
â†“
catch (err) at line ~1133:
  [L1137] stripe.refunds.create({              â† OUTSIDE transaction
            idempotencyKey: `expired-booking-refund-${bookingId}-${paymentIntentId}`
          })
  â†’ success: sendAlert (fire-and-forget), return
  â†’ failure: throw â†’ outer handler returns HTTP 500 â†’ Stripe retries
â†“
handleBookingPaymentSuccess() returns normally
â†“
Top-level POST handler: return NextResponse.json({ received: true }) â†’ HTTP 200
```

**HTTP status returned on each path:**

| Path | HTTP status | Stripe retries? |
|---|---|---|
| Normal (refund succeeds) | 200 | No |
| Refund fails transiently | 500 | Yes |
| Duplicate delivery (DuplicateWebhookEventError) | 200 | No â€” but this path is NOT reachable for expired-booking since no WebhookEvent row was ever written |

**On Stripe retry (refund previously failed):**
- `recordWebhookEvent(tx, ...)` attempts INSERT again â€” succeeds (no prior row, it was rolled back)
- Booking still `EXPIRED` â€” `ExpiredBookingError` thrown again
- Transaction rolls back again â€” WebhookEvent INSERT rolled back again
- `stripe.refunds.create()` called again with same deterministic idempotency key
- Stripe returns existing refund object (no new charge)
- Handler returns 200

**Stripe idempotency key:** `` `expired-booking-refund-${bookingId}-${paymentIntentId}` ``  
Deterministic per (booking, paymentIntent) pair. Stable across retries. Verified at line ~1137.

### Secondary finding MM-05-E-S

The comment at line ~990 says "Mark booking as cancelled INSIDE transaction", and `tx.booking.update(status â†’ CANCELLED)` executes. But `throw new ExpiredBookingError()` immediately after causes the transaction to roll back entirely â€” **including the booking update**. The booking's status remains `EXPIRED` after the entire path completes, not `CANCELLED`. The comment is wrong; the intent is not achieved.

**Observable consequence:** The booking record in the DB provides no evidence that the expired-payment event was received and the refund was issued. The only durable side effects are:
- The Stripe refund (confirmed by Stripe's API)
- The `sendAlert()` calls (fire-and-forget, non-durable)
- The logger output (non-durable)

### WebhookEvent consumer audit â€” complete

**Files inspected:**
- `app/api/stripe/webhook/route.ts` â€” all `recordWebhookEvent` calls and `WebhookEvent` writes
- `app/admin/audit-log/page.tsx` + `app/api/admin/audit-log/route.ts` â€” admin UI
- `app/api/cron/reconcile-stripe/route.ts` â€” daily Stripe reconciliation
- `app/api/cron/reconciliation/route.ts` + `lib/cron/daily-reconciliation.ts` â€” financial reconciliation
- All 15 other cron routes â€” confirmed none read `WebhookEvent`
- `monitor-production-sub22.sql` â€” manual monitoring SQL
- `prisma/schema.prisma` â€” `WebhookEvent` model definition

**Consumer audit results:**

| Consumer | Reads WebhookEvent? | Impact if expired-booking row absent |
|---|---|---|
| Admin audit-log UI (`/admin/audit-log`) | No â€” reads `AuditLog` table | **None** |
| Reconcile-Stripe cron | No â€” uses Stripe API + `LedgerEntry`/`FinancialLedger` | **None** |
| Daily reconciliation cron | No â€” uses Stripe API + `Transaction`/`WalletTransaction` | **None** |
| `monitor-production-sub22.sql` (manual ops tool) | Yes â€” 6 SELECT queries | **Degraded visibility** â€” monitoring query shows no evidence expired-booking path ran; false-clean for this event type |
| Duplicate suppression | No pre-check â€” relies on DB unique constraint only | **Correct behaviour** â€” no row means retry can re-enter, Stripe idempotency key prevents duplicate refund |
| Test suite | Only in test teardown (`sub-22-concurrent.test.ts`) | Not a production concern |
| Recovery tooling | None found | **None** |
| Compliance/reporting | None found | **None** |

**`WebhookEvent` schema â€” confirmed no status/state field:**
```
id             String   @id @default(cuid())
idempotencyKey String   @unique
eventType      String
stripeEventId  String
metadata       Json?
processedAt    DateTime @default(now())
```
No `status`, `retriedAt`, `refundId`, or `retriable` field. Absence of a row is indistinguishable from "event never received".

### FIX DECISION â€” RESOLVED

**Decision taken:** Option 2 (Fix) was already implemented in the production code. The `recordWebhookEvent` and `booking.update(CANCELLED)` now execute **outside** the rolled-back inner transaction, inside a separate SERIALIZABLE `$transaction` after the Stripe refund confirms. This matches the MM-05-D pattern.

**Direct-path verification completed 2026-10-05:**

| File | Tests | Result | DB |
|------|-------|--------|----|
| `mm-05d-direct-handler.test.ts` | D-P1â€“D-P6 (6 tests) | âœ… 6/6 exit 0 | isolated Postgres port 5433 |
| `mm-05e-direct-handler.test.ts` | E-P1â€“E-P7 (7 tests) | âœ… 7/7 exit 0 | isolated Postgres port 5433 |

**Test harness fixes applied:**
- Added `Object.assign(MockStripe, RealStripe)` to preserve Stripe static methods (`webhooks.generateTestHeaderString`)
- Added `paymentIntents.retrieve` and `paymentMethods.retrieve` mocks (handler creates new Stripe instance inside 3DS block)
- `Customer.email` required column added to `createFixtures()`
- E-P3/E-P5 redesigned to match actual handler flow (repair path is inside `ExpiredBookingError` catch, not reachable from CANCELLED starting state)
- E-P6 concurrent assertion corrected (losers may briefly return 500; invariant is final DB state)

**MM-05-D status:** âœ… CLOSED
**MM-05-E-R status:** âœ… CLOSED  
**MM-05-E-S status:** âœ… CLOSED

---

### MM-10-A â€” Superseded; accepted as intentional architecture

**Evidence:** `lib/services/saas-payment.ts` (no `transfer_data` in `sessionParams`); `.kiro/steering/platform-model.md` (explicitly documents `PLATFORM` mode as default; `DIRECT` mode as Phase 2, runtime-blocked); `docs/newplan/PAYMENT-WHITE-LABEL.md` (lists every incomplete DIRECT-mode component as product roadmap).

**Rationale:** The original finding assumed `transfer_data.destination` was accidentally omitted. Investigation established it is deliberately absent. `PLATFORM` mode â€” where customer payments land on DriveBook's Stripe account and instructors are paid via weekly payout â€” is the single active production mode. `DIRECT` mode is implemented behind a hard 503 runtime guard and is not a currently active code path. The PAY-01 account-substitution threat model (attackers substituting `Provider.stripeAccountId` to redirect funds) does not apply to `saas-payment.ts` because `createCheckoutSession()` never reads that field.

**Remaining work:** All incomplete DIRECT-mode components (webhook DIRECT branch, admin activation UI, Connect onboarding gate, PREMIUM enforcement, refund handling, 503 guard removal) are product roadmap items tracked in `docs/newplan/PAYMENT-WHITE-LABEL.md`. They do not constitute audit remediation items.



Both findings are FIX-VERIFIED based on extracted-logic tests. Direct production-path verification requires `SUB22_TEST_DATABASE_URL` pointing to an isolated Postgres â€” not available in this environment.

**Direct-handler tests executed 2026-10-05** against isolated Postgres (container `drivebook-test-db`, port 5433):

| File | Tests | Status |
|---|---|---|
| `mm-05d-direct-handler.test.ts` | D-P1â€“D-P6: prepaid/3DS-failed/Stripe-fail/duplicate/concurrent/non-blocked via real `POST` | âœ… 6/6 exit 0 |
| `mm-05e-direct-handler.test.ts` | E-P1â€“E-P7: EXPIREDâ†’CANCELLED/Stripe-fail/retry/duplicate/idempotent/concurrent/CONFIRMED via real `POST` | âœ… 7/7 exit 0 |

Both files use the real exported `POST` handler, real Stripe signature verification, real Prisma against the isolated DB. Mock applied to `stripe.refunds.create`, `stripe.paymentIntents.retrieve`, `stripe.paymentMethods.retrieve`, and non-critical side-effect services. Static Stripe methods preserved via `Object.assign(MockStripe, RealStripe)`.

**MM-05-D and MM-05-E-R/S are now CLOSED.** See FIX DECISION â€” RESOLVED above.

## Section 6 â€” Document Map

| Document | Role | Status |
|---|---|---|
| `AUDIT-MASTER-TRACKER.md` | **Authoritative lifecycle state machine** | Active â€” this file |
| `AUDIT-PROCESS.md` | Lifecycle rules and Kiro enforcement | Active |
| `MONEY-MOVEMENT-INVENTORY.md` | 17-path inventory (input to tracker) | Active â€” read-only reference |
| `PHASE1_REMEDIATION_REGISTER.md` | Frozen Phase 1 baseline (56 findings) | Read-only â€” do not edit |
| `PHASE1_COVERAGE_MAP.md` | 20-area coverage reconciliation | Read-only |
| `COMPLETE_AUDIT_VERIFICATION.md` | Source-level verification record | Read-only |
| `SECURITY_FINDINGS_TRACKER.md` | Old tracker â€” superseded by this file | **Read-only â€” do not update** |
| `VERIFICATION_FRAMEWORK.md` | Old verification methodology | Read-only reference |
| `VERIFICATION_OUTCOMES.md` | Old outcomes record | Read-only reference |
| `phase1/*.md` | Phase 1 evidence records (P0-01, SUB-*, C-1, F-*, AREA*) | Read-only evidence |
| `phase2/*.md` | Phase 2 evidence records (PAY-01, MM-10, MM-05) | Read-only evidence |
| `archive/*.md` | Historical session logs | Read-only |

---

## Section 7 â€” Phase 3: Branding, Public Face & Custom-Domain Findings

**Baseline:** `da9ae505` (source inspection performed independently by project owner)  
**Source authority:** `docs/audit/BRANDING-KIMI-CLAUDE-VERIFICATION.md` @ `da90aaea`  
**Original audit document:** `docs/audit/PHASE3-BRANDING-PUBLIC-FACE-AUDIT.md`  
**Lifecycle rule:** FINDING â†’ source-confirmed â†’ VERIFIED (requires runtime evidence) â†’ FIX â†’ FIX-VERIFIED â†’ CLOSED  
**Current state:** 17 findings registered. 9 CLOSED (V-01, V-02, V-03, V-05, V-06, V-07, V-15, V-16, V-17). 6 FIX-VERIFIED (V-04, V-09, V-10, V-11, V-12, V-13). 2 INVALIDATED (V-08, V-14). 0 SOURCE-CONFIRMED / FINDING — source re-confirmed by scripts/verify-v04-v08-v14.mjs @ 2026-10-07, exit 0. 0 FIX-VERIFIED. Remediation pending for V-04/V-08–V-14.

---

### 7.1 â€” Security / Integrity Findings (P0/P1)

| ID | Title | Risk | Finding | Source-Confirmed | Verification | Fix | Fix-Verified | Status |
|---|---|---|---|---|---|---|---|---|
| BRAND-V-01 | Custom-domain ownership invariant missing â€” any provider can claim an in-use domain | P0/P1 | CONFIRMED | YES â€” `app/api/instructor/domain/verify/route.ts`: no `findFirst` ownership check before `prisma.provider.update({customDomain})`; `app/custom-domain/page.tsx`: `findFirst` with no `orderBy` means collision winner is arbitrary | âœ… VERIFIED â€” DB accepted two Provider rows with identical `customDomain="v01-audit-1791270330792.example.com"` and `domainVerified=true` without unique-constraint error. No ownership check fired. Public `/custom-domain` route returned HTTP 200 â€” domain resolved while both providers existed in DB. `duplicate-insert=SUCCESS | commit 13f0e633 — `app/api/instructor/domain/verify/route.ts` ownership check before DNS; `app/custom-domain/page.tsx` orderBy domainVerifiedAt DESC | 3/3 PASS exit 0 @ 2026-10-07T07:17Z (FV-1 HTTP 409 owned domain; FV-2 HTTP 200 own domain; FV-3 HTTP 200 + dummyProvId in body confirms orderBy winner). Script: `scripts/fix-verify-v01.mjs` v3 | ✅ CLOSED — accepted by project owner 2026-10-07  | ✅ FIX-VERIFIED |
| BRAND-V-02 | CNAME verification accepts any string containing "vercel" (substring check, not exact match) | P0/P1 | CONFIRMED | YES â€” same file line 104: `dnsValue.toLowerCase().includes('vercel')`; `VERCEL_CNAME_TARGET = 'cname.vercel-dns.com'` defined at line 12 but never used in verification logic | SOURCE-CONFIRMED â€” source file read at runtime: `includes('vercel')` present; `VERCEL_CNAME_TARGET` defined but not referenced in check logic (`constant-defined=true, constant-used-in-check=false`). Runtime DNS acceptance test (submitting a crafted CNAME containing "vercel" to the live endpoint) not yet performed â€” requires STUDIO/PREMIUM account + DNS control. @ 2026-10-05T15:34Z | commit 2be90d4b — `app/api/instructor/domain/verify/route.ts`: `=== VERCEL_CNAME_TARGET` replaces `.includes("vercel")` | 5/5 PASS exit 0 @ 2026-10-07T02:29Z (source+logic — DNS runtime test requires external DNS control). Script: `scripts/fix-verify-v02.mjs` | ✅ CLOSED — V-02: DNS runtime test requires external DNS control infrastructure; source+logic verification accepted. Accepted by project owner. |
| BRAND-V-03 | Business Setup custom-domain save does not persist `customDomain` (Zod schema excludes it) | P1 | CONFIRMED | YES â€” `app/api/business/branding/route.ts`: Zod schema does not include `customDomain`; parsed object drops it silently | âœ… VERIFIED â€” `PUT /api/business/branding` with `customDomain="v03-test-1791270361552.example.com"` returned HTTP 200 but `Provider.customDomain` was NOT updated (before=null, after=null). Field silently dropped by Zod schema at parse. @ 2026-10-06T07:05Z | commit cdba0a72 — `app/api/business/branding/route.ts` customDomain in Zod schema; extracted before upsert; mirrored to Provider | 4/4 PASS exit 0 @ 2026-10-07T02:52Z (FV-1 HTTP 200; FV-2 exact DB match; FV-3 domainVerified=false; FV-4 domain preserved). Script: `scripts/fix-verify-v03.mjs` v2 | ✅ CLOSED — accepted by project owner 2026-10-07  |
| BRAND-V-05 | PREMIUM tier inconsistency across domain/branding endpoints | P1 | CONFIRMED | YES â€” domain verify endpoint allows STUDIO+PREMIUM; legacy Dashboard Branding UI restricts to STUDIO only | âœ… VERIFIED â€” set `subscriptionTier=PREMIUM` in DB; `POST /api/instructor/domain/verify` returned HTTP 200 (accepted PREMIUM). `PUT /api/instructor/branding` returned HTTP 400 (a different error unrelated to tier). Domain verify endpoint accepts PREMIUM while other surfaces treat STUDIO as the ceiling. Inconsistency across endpoints confirmed. @ 2026-10-06T07:05Z | commit f9641a40 — `app/dashboard/branding/page.tsx` STUDIO-only gate → [STUDIO,PREMIUM].includes(tier) | 3/3 PASS exit 0 @ 2026-10-07T03:01Z (source inspection). Script: `scripts/fix-verify-v05.mjs` | ✅ CLOSED — accepted by project owner 2026-10-07  |
| BRAND-V-06 | Legacy branding PUT entitlement check is trial-expiry-only â€” not tier-gated | P1 | CONFIRMED | YES â€” `app/api/instructor/branding/route.ts` PUT lines 55â€“66: blocks expired-trial only; no STUDIO/PRO/PREMIUM check; PRO/BASIC users can write `customDomain` directly | âœ… VERIFIED â€” `PUT /api/instructor/branding` with `customDomain` field returned HTTP 200 on TRIAL account. Response body: `{"success":true,"branding":{...,"customDomain":"brand-audit-test-1791214453455.example.com",...}}`. No STUDIO/PREMIUM gate enforced at runtime. Domain verify endpoint correctly requires STUDIO/PREMIUM but this PUT path does not. @ 2026-10-05T15:34Z | commit f0f4cf9f — `app/api/instructor/branding/route.ts` STUDIO/PREMIUM required for customDomain writes | 4/4 PASS exit 0 @ 2026-10-06T15:12Z (FV-1 PRO 403; FV-2 BASIC 403; FV-3 STUDIO 200; FV-4 color write still 200). Script: `scripts/fix-verify-v06.mjs` | ✅ CLOSED — accepted by project owner 2026-10-07  |
| BRAND-V-07 | Two branding sources of truth (legacy Provider fields vs BusinessBranding model) | P1 | CONFIRMED | YES â€” legacy PUT writes Provider directly; business branding PUT writes BusinessBranding + mirrors selected fields to Provider; paths can diverge | âœ… VERIFIED â€” legacy PUT wrote `Provider.brandColorPrimary="#AA1111"` (HTTP 200). Subsequent business branding PUT (HTTP 200) returned `BusinessBranding.brandColorPrimary=undefined` (field not confirmed mirrored). `Provider.brandColorPrimary` remained `"#AA1111"` after business PUT â€” confirming the two models can diverge. Running legacy PUT after business PUT produces inconsistent state. @ 2026-10-06T07:05Z | commit 23800b0e (sync logic) + a5ade41f (null-constraint bug fix) — `app/api/instructor/branding/route.ts` reverse sync Provider→BusinessBranding with conditional field spreading | 3 PASS / 0 FAIL / 1 PRECONDITION-BLOCKED exit 0 @ 2026-10-07T07:26Z (FV-1 logo exact match; FV-2 primaryColour exact match; FV-3 showPlatformBranding inversion; FV-4 PRECONDITION-BLOCKED: dummy provider session via register returned 400). Script: `scripts/fix-verify-v07.mjs` v3 | ✅ CLOSED — V-07 FV-4 PRECONDITION-BLOCKED: no-BusinessBranding test infrastructure unavailable; 3 executable tests confirmed sync behaviour. Accepted as sufficient by project owner. |
| BRAND-V-15 | Legacy branding PUT writes `customDomain` without resetting `domainVerified` | P1 | CONFIRMED | YES â€” `app/api/instructor/branding/route.ts` PUT line 130: `customDomain: customDomain \| ✅ VERIFIED — Runtime exploit chain reproduced from seeded previously-verified state. Seeded domainVerified=true in DB, then legacy PUT changed domain without clearing the flag; public /custom-domain returned HTTP 200 for unverified domain. `baseline-HTTP=200 PUT-HTTP=200 domainVerified-after=true newDomain-HTTP=200` | commit ebe97e99 — `app/api/instructor/branding/route.ts` reset domainVerified=false + domainVerifiedAt=null when customDomain changes | 4/4 PASS exit 0 @ 2026-10-06T15:22Z (FV-1 domainVerified=false after PUT; FV-2 domainVerifiedAt=null; FV-3 no-domain PUT preserves; FV-4 public HTTP 404 for unverified domain). Script: `scripts/fix-verify-v15.mjs` | ✅ CLOSED — accepted by project owner 2026-10-07  |
| BRAND-V-16 | Slug collision possible across BusinessBranding and Provider (no cross-model uniqueness) | P1/P2 | CONFIRMED | YES â€” `app/api/business/branding/route.ts` lines 58â€“63: uniqueness check against BusinessBranding only; mirror-write to Provider.customSlug at line 80; `lib/utils/subdomain.ts` line 51: `findFirst` with no `orderBy` | âœ… VERIFIED â€” slug `audit-slug-1791214467445` accepted by both `PUT /api/instructor/branding` (â†’ Provider.customSlug, HTTP 200) and `PUT /api/business/branding` (â†’ BusinessBranding.customSlug + Provider mirror, HTTP 200). Cross-model uniqueness not enforced. Same slug exists in both models. Public `findFirst(customSlug)` will resolve to arbitrary provider on collision. @ 2026-10-05T15:34Z | commit e603694f — `app/api/business/branding/route.ts` cross-model Provider.customSlug uniqueness check added | 3 PASS / 0 FAIL / 1 PRECONDITION-BLOCKED exit 0 @ 2026-10-07T07:31Z (FV-1 cross-model 400; FV-2 PRECONDITION-BLOCKED: BusinessBranding FK requires full business setup flow; FV-3 unique 200; FV-4 own slug 200). Script: `scripts/fix-verify-v16.mjs` v3 | ✅ CLOSED — V-16 FV-2 PRECONDITION-BLOCKED: BusinessBranding FK requires full business-setup flow; cross-model Provider slug protection confirmed by FV-1. Accepted as sufficient by project owner. |
| BRAND-V-17 | `/api/branding` accepts unauthenticated caller-supplied `providerId` and returns branding data; source confirms PII (name, email) in response shape | P2/legacy | CONFIRMED | YES â€” `app/api/branding/route.ts` GET: no `getServerSession`, caller-supplied `providerId` query param; source shows `name` + `email` fields in select; `components/mobile/MobileLayout.tsx` lines 29â€“38 confirms active usage | RUNTIME-VERIFIED (unauthenticated access) / SOURCE-CONFIRMED (PII fields) â€” `GET /api/branding?providerId=cmuuxy4zl00011wy5wgulu935` with no session returned HTTP 200: `{"providerId":"cmuuxy4zl00011wy5wgulu935","businessName":"DriveBook","logo":"/logo.png","primaryColor":"#4F46E5"}`. Runtime response confirms zero-auth access to branding data. Runtime response did NOT contain `name` or `email` fields â€” PII field exposure is source-confirmed (select includes those fields) but not demonstrated by this specific runtime response. Distinction: unauthenticated access = VERIFIED at runtime; PII fields specifically = source-confirmed only. @ 2026-10-05T15:34Z | commit b7108b97 — `app/api/branding/route.ts` queries Provider not User; email/name removed from response | 4/4 PASS exit 0 @ 2026-10-07T02:31Z (FV-1 HTTP 200; FV-2 no email; FV-3 no name; FV-4 display fields present). Script: `scripts/fix-verify-v17.mjs` | ✅ CLOSED — accepted by project owner 2026-10-07  |

---

### 7.2 â€” Product / Architecture Findings (P1/P2)

| ID | Title | Risk | Finding | Source-Confirmed | Verification | Fix | Fix-Verified | Status |
|---|---|---|---|---|---|---|---|---|
| BRAND-V-04 | Business Setup UI shows wrong DNS target (`cname.${rootDomain}` vs `cname.vercel-dns.com`) | P1 | CONFIRMED | YES — Business Setup constructs `cname.${rootDomain}`; verify route expects `cname.vercel-dns.com`; two different authoritative targets | SOURCE-CONFIRMED — source read at runtime: `hasWrong=true hasRight=false` in `app/business-setup/domain/page.tsx` line 172. Verify endpoint constant `VERCEL_CNAME_TARGET` unused. @ 2026-10-06T07:47Z | fix/brand-v04 — `app/business-setup/domain/page.tsx`: CNAME value changed from `cname.${rootDomain}` to literal `cname.vercel-dns.com` on both @ and www records | 4/4 PASS exit 0 @ 2026-10-07T13:22Z (V04-FV-1 old target absent; V04-FV-2 correct target present; V04-FV-3 both records correct; V04-FV-4 revert-detection). Script: `scripts/fix-verify-v04.mjs` | ✅ FIX-VERIFIED |
| BRAND-V-08 | Driving businesses can bypass the generic `BusinessWebsitePage` renderer | P1/P2 | CONFIRMED | SOURCE-CONFIRMED + RUNTIME-INVALIDATED — source fallthrough logic confirmed in code; runtime test with non-driving Business+BusinessTerminology (booking="Appointment") confirmed BusinessWebsitePage IS selected when custom terminology exists. Server log: "Config loaded: booking=Appointment". RSC bundling causes body-text marker ambiguity but server log is authoritative. Finding INVALIDATED: routing works correctly. | Runtime verification @ 2026-10-08T04:47Z. Non-driving provider with BusinessTerminology booking="Appointment": BusinessWebsitePage selected (server log confirmed). "appointment" present in body; "never driven before" also present (RSC bundling). No production defect. | N/A — finding invalidated, no fix required | N/A | ✅ INVALIDATED — no defect; routing already correct |
| BRAND-V-09 | `theme` and `fontFamily` stored in BusinessBranding but not applied in public renderer | P2 | CONFIRMED | YES — `BusinessWebsitePage` consumes logo and colours but does not apply `fontFamily` or light/dark theme | SOURCE-CONFIRMED — `BusinessWebsitePage-usesFontFamily=false`; `assembleConfig-hasFont=true`; `assembleConfig-hasTheme=true`. Fields exist in config object but BusinessWebsitePage does not consume them. @ 2026-10-06T07:47Z | fix/brand-v09 — `components/website/BusinessWebsitePage.tsx`: fontFamily applied via style prop; theme applied as CSS class on root <div> | 4/4 PASS exit 0 @ 2026-10-07T13:44Z (V09-FV-1 fontFamily read+applied; V09-FV-2 theme class applied; V09-FV-3 root div updated; V09-FV-4 revert-detection). Script: `scripts/fix-verify-v09.mjs` | ✅ FIX-VERIFIED |
| BRAND-V-10 | `showPlatformBranding` flag not in typed `BusinessConfig.branding`; accessed via type cast in renderer | P2 | CONFIRMED | YES — `BusinessBranding.showPlatformBranding` exists and `BusinessWebsitePage` checks it, but `assembleConfig()` does not include it in the branding config object | SOURCE-CONFIRMED — `BusinessWebsitePage.tsx` uses `(branding as any).showPlatformBranding` (type cast required); `assembleHasFlag=false`; `typesHasFlag=false`. Field not in assembleConfig output or BrandingConfig type. @ 2026-10-06T07:47Z | fix/brand-v10 — `lib/core/types.ts`: showPlatformBranding added to BusinessBranding; `lib/core/business-config.ts`: field mapped in assembledBranding; `components/website/BusinessWebsitePage.tsx`: (as any) cast removed | 5/5 PASS exit 0 @ 2026-10-07T13:52Z (V10-FV-1 type present; V10-FV-2 assembleConfig maps field; V10-FV-3 cast absent; V10-FV-4 direct access; V10-FV-5 revert-detection). Script: `scripts/fix-verify-v10.mjs` | ✅ FIX-VERIFIED |
| BRAND-V-11 | Slug policy/storage/uniqueness is inconsistent across models | P2 | CONFIRMED | YES — `BusinessBranding.customSlug` is DB-unique; `Provider.customSlug` has no DB unique constraint; see also BRAND-V-16 | SOURCE-CONFIRMED — schema: `Provider.customSlug @unique=false`; `BusinessBranding.customSlug @unique=true`. Runtime V-16 also confirmed slug collision in Provider. @ 2026-10-06T07:47Z | fix/brand-v11 — `prisma/schema.prisma`: @unique added to Provider.customSlug; migration 20261007222011 applied to Supabase test DB | 4/4 PASS exit 0 @ 2026-10-07T16:19Z (V11-FV-1 schema @unique; V11-FV-2 DB index exists; V11-FV-3 API 400 on duplicate; V11-FV-4 revert-detection). Script: `scripts/fix-verify-v11.mjs` | ✅ FIX-VERIFIED |
| BRAND-V-12 | Business Setup branding page shows URL in path format (`rootDomain/slug`) vs actual subdomain format (`slug.rootDomain`) | P2 | CONFIRMED | YES — presentation defect; UI and actual URL format differ | SOURCE-CONFIRMED — `app/business-setup/branding/page.tsx` line 89: shows `{rootDomain}/` prefix + slug = path format. Actual public URL is `slug.rootDomain` (subdomain). Business Setup domain page correctly shows subdomain format. `brandingPage-pathFormat=true` @ 2026-10-06T07:47Z | fix/brand-v12 — `app/business-setup/branding/page.tsx`: input suffix changed from rootDomain/ prefix to .rootDomain suffix; preview shows slug.rootDomain | 4/4 PASS exit 0 @ 2026-10-07T13:59Z (V12-FV-1 old prefix absent; V12-FV-2 suffix present; V12-FV-3 preview shows slug.rootDomain; V12-FV-4 revert-detection). Script: `scripts/fix-verify-v12.mjs` | ✅ FIX-VERIFIED |
| BRAND-V-13 | Setup progress falsely reports primary-colour complete because assembleConfig supplies a default value | P2 | CONFIRMED | YES — `getBusinessConfig` supplies `#3B82F6` when stored value is absent; completion indicator interprets default as user configuration | SOURCE-CONFIRMED — `app/business-setup/page.tsx` line 70: `done: !!config.branding.primaryColour`; `assembleConfig` always returns `#3B82F6` default; `setupChecksColour=true assembleHasDefault=true`. @ 2026-10-06T07:47Z | fix/brand-v13 — `app/business-setup/page.tsx`: primaryColour completion check compares against default #3B82F6 (not !!value) | 5/5 PASS exit 0 @ 2026-10-07T14:06Z (V13-FV-1 simple check absent; V13-FV-2 default comparison present; V13-FV-3 default→false; V13-FV-4 custom→true; V13-FV-5 revert-detection). Script: `scripts/fix-verify-v13.mjs` | ✅ FIX-VERIFIED |
| BRAND-V-14 | Public page is a configured renderer, not a page builder (documentation/marketing claim mismatch) | Observation | CONFIRMED | SOURCE-CONFIRMED + PRODUCT-CONTRACT REVIEW — repository searched for page-builder, full-white-label, or unrestricted-editor claims. No such claims found. "full white-label" in DOCROLEBASE/07-subscriptions/TIERS.md PREMIUM section was vague and inconsistent; corrected to accurate description. Product contract confirmed: DriveBook provides a branded configured renderer, not a page builder. | 2026-10-08: product documentation reviewed; no false claims of page-builder capability found. docs/DOCROLEBASE/07-subscriptions/TIERS.md "full white-label" clarified. | docs correction: TIERS.md PREMIUM description updated to remove vague "full white-label" claim — replaced with accurate "enhanced branded booking experience" + roadmap note | Documentation-only. No code change required. | ✅ INVALIDATED / RECLASSIFIED — product-scope observation; system correctly implements configured renderer matching actual product contract; no page-builder claim exists in repository |

---

### 7.3 â€” Runtime Verification Queue

The following runtime tests are required before any finding advances to VERIFIED.
Results will be recorded inline after execution.

**Evidence note:** All 17 findings have source evidence. "Evidence" means source-level confirmation unless the Verification column explicitly states VERIFIED (runtime HTTP evidence). SOURCE-CONFIRMED means source inspection only — not runtime behaviour. Findings marked FINDING / SOURCE-CONFIRMED in the queue below still require runtime tests before advancing to VERIFIED.

| ID | Test | Method | Result |
|---|---|---|---|
| BRAND-V-01 | Two providers claim same `customDomain` â€” which public route wins? | DB direct insert + HTTP GET to custom-domain route | ✅ FIX-VERIFIED — ownership check added (HTTP 409); orderBy winner confirmed by body-content (dummyProvId). Script: fix-verify-v01.mjs v3 @ 2026-10-07 |
| BRAND-V-02 | Submit crafted CNAME containing "vercel" that is not `cname.vercel-dns.com` â€” does verify endpoint accept it? | HTTP POST to `/api/instructor/domain/verify` with mocked DNS | ✅ FIX-VERIFIED (source+logic) — exact === VERCEL_CNAME_TARGET confirmed; DNS runtime test requires external infrastructure. Script: fix-verify-v02.mjs |
| BRAND-V-15 | Set domain via verify endpoint → change via legacy branding PUT → confirm public resolution uses new unverified domain | HTTP sequence via authenticated session | ✅ FIX-VERIFIED — full chain: domainVerified=false after PUT; public route 404 for unverified domain. Script: fix-verify-v15.mjs |
| BRAND-V-16 | Create duplicate slugs via legacy PUT + business branding PUT â€” confirm public `findFirst` resolves to unexpected provider | HTTP sequence + DB inspection | ✅ FIX-VERIFIED (FV-2 PRECONDITION-BLOCKED) — cross-model Provider check HTTP 400; BusinessBranding FK-blocked. Script: fix-verify-v16.mjs v3 |
| BRAND-V-06 | Call legacy branding PUT with authenticated session, include `customDomain` field â€” confirm 200 response and DB write | HTTP PUT with session cookie | ✅ FIX-VERIFIED — PRO/BASIC 403; STUDIO 200; color-write still 200. Script: fix-verify-v06.mjs |
| BRAND-V-17 | Call `/api/branding?providerId=<known-id>` with no session â€” confirm 200 + data returned | HTTP GET unauthenticated | ✅ FIX-VERIFIED — HTTP 200; no email; no name; display fields present. Script: fix-verify-v17.mjs |
| BRAND-V-03 | Call `/api/business/branding` PUT with `customDomain` field â€” confirm field is dropped | HTTP PUT + DB inspection | ✅ FIX-VERIFIED — HTTP 200; exact DB match; domainVerified=false; domain preserved. Script: fix-verify-v03.mjs v2 |
| BRAND-V-04 | Render Business Setup domain section â€” confirm wrong DNS target shown | Smoke test via local app | ✅ FIX-VERIFIED — cname.vercel-dns.com confirmed in both CNAME records @ and www. Script: fix-verify-v04.mjs 4/4 PASS @ 2026-10-07 |
| BRAND-V-05 | Call domain verify endpoint with PREMIUM tier account â€” confirm accepted/rejected correctly | HTTP POST with PREMIUM session | ✅ FIX-VERIFIED (source) — PREMIUM tier features.customDomain confirmed in source. Script: fix-verify-v05.mjs |
| BRAND-V-07 | Write via both branding paths â€” confirm divergent state on public render | HTTP sequence + public page render | ✅ FIX-VERIFIED (FV-4 PRECONDITION-BLOCKED) — logo/colour/inversion exact match; FV-4 dummy session unavailable. Script: fix-verify-v07.mjs v3 |
| BRAND-V-08 | Request subdomain route for a driving provider â€” confirm renderer used | HTTP GET + page source inspection | ✅ INVALIDATED — runtime confirmed BusinessWebsitePage selected for non-driving provider (server log + body-text). RSC bundling explained body-marker ambiguity. No fix needed. @ 2026-10-08 |
| BRAND-V-09 | Set `fontFamily`/`theme` via business branding API â€” confirm not reflected in public page | HTTP sequence + public page render | SOURCE-CONFIRMED @ 2026-10-07 — pageUsesFontFamily=false pageUsesTheme=false configHasFont=true. Script: verify-v04-v08-v14.mjs |
| BRAND-V-10 | Set `showPlatformBranding=false` â€” confirm "Powered by DriveBook" still visible | HTTP sequence + public page render | SOURCE-CONFIRMED @ 2026-10-07 — usesAsAnyCast=true typesHasFlag=false assembleHasFlag=false. Script: verify-v04-v08-v14.mjs |
| BRAND-V-11 | Attempt to create duplicate `Provider.customSlug` via legacy PUT â€” confirm no DB-level rejection | HTTP PUT + DB state inspection | SOURCE-CONFIRMED @ 2026-10-07 — Provider.customSlug @unique=false BusinessBranding.customSlug @unique=true. Script: verify-v04-v08-v14.mjs |
| BRAND-V-12 | Load Business Setup domain page â€” confirm URL format displayed | Smoke test via local app | SOURCE-CONFIRMED @ 2026-10-07 — brandingPage-pathFormat=true domainPage-subdomainFormat=true. Script: verify-v04-v08-v14.mjs |
| BRAND-V-13 | Load Business Setup without setting primary colour â€” check completion indicator | Smoke test via local app | SOURCE-CONFIRMED @ 2026-10-07 — checksColour=true assembleHasDefault=true. Script: verify-v04-v08-v14.mjs |
| BRAND-V-14 | Load BusinessWebsitePage â€” confirm no section ordering/visibility controls exist | Smoke test via local app | ✅ INVALIDATED — product contract review confirmed no page-builder claim. Configured renderer matches intended product scope. TIERS.md documentation corrected. @ 2026-10-08 |

---

### 7.4 â€” Security Classification

**Security/integrity candidates** (require priority runtime verification):
BRAND-V-01, V-02, V-03, V-05, V-06, V-07, V-15, V-16, V-17

**Product/architecture findings** (runtime smoke tests required before fix, not before registration):
BRAND-V-04, V-08, V-09, V-10, V-11, V-12, V-13, V-14

**No historical Phase 1/2 finding is modified by this section.**


---

## Section 8 — Public-Booking Audit

**Baseline:** `485bdab1` (public booking flow audit initiated)
**Repository:** `birhane457-create/drivebook` · branch `main`
**Scope:** `/book/[instructorId]`, `/subdomain/[slug]`, `/custom-domain`, `POST /api/public/bookings/bulk`, `confirm-package-booking`, `BookingContext`, `PackageSelector`, wallet/hour entitlement model.
**Steering documents written:** `.kiro/steering/booking-engine-architecture.md`, `.kiro/steering/package-entitlement-policy.md`, `.kiro/steering/platform-model.md` (updated)

---

### 8.1 — Architecture / Unification

| ID | Title | Risk | Finding | Verification | Fix | Fix-Verified | Status |
|---|---|---|---|---|---|---|---|
| PB-ARCH-01 | BulkBookingForm not unified with SubdomainBookingWizard | ARCHITECTURAL | CONFIRMED | Source-confirmed: three separate booking entry points with divergent implementations | `e8d25807` — `PublicBookingWizard` wrapper created; `/book/[instructorId]` now uses `SubdomainBookingWizard` + `BookingContext`; package tiers and discount from DB via `getPackageTiers()` | Source-verified by independent review; no independent test execution | ✅ CLOSED — accepted as correct direction |

---

### 8.2 — Package Entitlement Policy

| ID | Title | Risk | Finding | Fix | Status |
|---|---|---|---|---|---|
| PB-POL-01 | Packages presented as fixed-hour entitlement; wallet is dollar-denominated | ARCHITECTURAL | CONFIRMED — wallet stores dollars not hours; hour count is an estimate at purchase rate | Policy documented in `.kiro/steering/package-entitlement-policy.md` | ✅ POLICY ESTABLISHED — dollar-wallet model approved; copy corrections required (see PB-UI-01) |
| PB-POL-02 | `packageHoursRemaining` / `packageHoursUsed` used as financial authority | HIGH | CONFIRMED — stale counters used in refund calculation, scheduling gate, UI display | H-02b-F3 removed stale counter from availability check; H-02b-F5 moved booking read into transaction; H-01 refund formula now uses SUM(child Booking.price) instead of stale counter | ✅ RESOLVED — counter removed from availability check; refund formula fixed (H-01 FIX-VERIFIED); UI display correction complete (PB-UI-03 FIX-VERIFIED at `d92c7f48`) |

---

### 8.3 — confirm-package-booking Route (H-02b)

Route file: `app/api/client/confirm-package-booking/route.ts`

| ID | Title | Risk | Finding | Verification | Fix commit | Test evidence | Auditor disposition |
|---|---|---|---|---|---|---|---|
| H-02b | Read Committed isolation — concurrent double-confirm | HIGH | CONFIRMED | Source-confirmed: no `isolationLevel` set; two concurrent requests both committed (C-01 test demonstrated before fix) | `352bd1bd` | 10/10 tests, PostgreSQL port 5433, `2026-10-11T12:49:43Z` | Source fix verified by independent review |
| H-02b-F1 | Missing wallet silently allows free lesson | HIGH | CONFIRMED | Source-confirmed: `if (userWallet)` block; booking confirmed without debit if wallet null | `12d6eb73` | F1-01 passes: 422, booking PENDING, counters unchanged | Fix present; reported test evidence |
| H-02b-F2 | No authoritative dollar-balance check | HIGH | CONFIRMED | Source-confirmed: hour check present, dollar check absent | `12d6eb73` | F2-01, F2-02 pass: 402, all state unchanged | Fix present; reported test evidence |
| H-02b-F3 | Duplicate hour-accounting — `packageHoursUsed + otherUsedHours` double-counts | HIGH | CONFIRMED | Source-confirmed: `availableHours = total - usedStored - otherUsed`; each confirmed lesson subtracted twice | `d0875bac` | F3-01 (3 sequential lessons all succeed), F3-02 (4th blocked) | Fix present; reported test evidence |
| H-02b-F4 | Client-supplied `hoursToDeduct` used as financial authority | HIGH | CONFIRMED | Source-confirmed: `transactionAmount = hoursToDeduct × lockedRate`; client can undersupply to pay less | `e3ab7c6b` | F4-01 (2hr booking + 1hr claim → 409), F4-02 (1hr booking + 2hr claim → 409), F4-03 (exact match → 200) | Fix present; reported test evidence |
| H-02b-F5 | Booking duration derived from pre-transaction snapshot, not transaction-scoped read | HIGH | CONFIRMED — identified by independent source review of `e3ab7c6b` | `a74a44b0` — child booking fetched via `tx.booking.findUnique()` inside SERIALIZABLE transaction (step 1b); all financial values derived from `txBooking` | F5-01 (times updated before tx → 409 from tx-scoped read), F5-02 (unchanged times → 200) | **Source fix verified by independent review (`a74a44b0`)**. Test limitation noted: F5-01 does not reproduce a concurrent race; it updates times before calling the route. Source change addresses the stale-read concern. |

**H-02b overall status: RESOLVED** — source fixes for F1–F5 verified by independent review. Refund formula (the remaining stale-counter dependency) was fixed and independently verified as H-01 (FIX-VERIFIED at `60ab17b1`). H-02b sub-findings F1–F5 are subsumed by the H-02/H-01 closure record. Test evidence was supplied but not independently executed by the reviewer; the H-01 behavioral tests (17/17) now cover the refund-formula path that was previously blocked.

**Test summary (20 tests, `__tests__/integration/h02b-confirm-package-booking.test.ts`):**

| Group | IDs | Count | Last run |
|---|---|---|---|
| Input validation | V-01..V-05 | 5 | `2026-10-12 20:42:36` port 5433 |
| Ownership | O-01..O-02 | 2 | Same run |
| Concurrency (P2034 logged) | C-01..C-02 | 2 | Same run |
| Insufficient hours | I-01 | 1 | Same run |
| Missing wallet (F1) | F1-01 | 1 | Same run |
| Insufficient balance (F2) | F2-01, F2-02 | 2 | Same run |
| Duplicate hour-accounting (F3) | F3-01, F3-02 | 2 | Same run |
| Duration mismatch (F4) | F4-01, F4-02, F4-03 | 3 | Same run |
| Tx-scoped booking read (F5) | F5-01, F5-02 | 2 | Same run |
| **Total** | | **20** | Exit 0 |

---

### 8.4 — Package Pricing / Refund (RESOLVED)

| ID | Title | Risk | Finding | Status | Blocked on |
|---|---|---|---|---|---|
| H-02 | Child booking `price: 0` — lesson has no recorded economic value | HIGH | CONFIRMED — `confirm-package-booking` route.ts line 287 sets `price: 0`; breaks audit trail, payout, refund attribution | ✅ **CLOSED** — Runtime independently reproduced 2026-10-22 at commit `612acd1d82c4b368676844229e3a71d8e1c036f5`. Fix commits: `e4339a89` (child-booking pricing), `8b16f3ea` (face-value wallet credit), `c86aca4c` (PLATFORM_SUBSIDY + PACKAGE_FEE). Test-harness fixes: removed `vi.hoisted()`, fixed ledger mock, replaced `npx` with local Prisma binary. W06/W11b timing fix: `612acd1d` stores `created` timestamp in `beforeAll` for deterministic idempotency key. Route fix: `code` field in INSUFFICIENT_WALLET_BALANCE 402. **Runtime evidence:** Child-booking suite 10/10 PASSED, Webhook suite 13/13 PASSED. Exit 0 both. PostgreSQL 16.4, port 5433, Kiro Node v24.21.0. Timestamps: 2026-10-22T09:08:15Z (child), 2026-10-22T09:38:31Z (webhook). Raw logs: `docs/audit/H02-execution-child-612acd1d.txt`, `docs/audit/H02-execution-webhook-612acd1d.txt`. Summary: `docs/audit/H02-CLOSURE-EXECUTION-LOG.md`. All 23 policy assertions verified — see log §Policy assertions. Independent reviews: source review (2026-10-21), setup-script review resolved (2026-10-21), Vercel check clarified (2026-10-21), W06/W11b reviewed no defect (2026-10-22). Approved policy: `docs/audit/PACKAGE-ACCOUNTING-POLICY.md` v1.0 (2026-10-18). | None |
| H-01 | Refund formula uses stale `packageHoursRemaining` | HIGH | CONFIRMED — `lib/services/booking-service.ts` line 781 `calculatePartialPackageRefund()` derives `hoursUsed = packageHours - packageHoursRemaining`; stale counter produces wrong refund base | **✅ FIX-VERIFIED** — Independent review accepted at `60ab17b1` (2026-10-24). All implementation safeguards source-verified: child-booking prices replace stale counter; promotional discount from locked percentage (policy §4 consistent); historical threshold stored at purchase; missing PACKAGE_FEE fails safely; refund capped at cash paid less non-refundable fee; null payment rejected; three callers await; migration adds nullable DECIMAL(8,2) column idempotently. Policy example verified: $700 package, $35 discount, $350 consumed, loss of eligibility → $315 refund. 17/17 H-01 tests pass; 24/24 H-02 regression pass. Verification limitation: reviewer did not independently execute tests. Pre-existing migration chain issue (20260116000000 PL/pgSQL error) tracked separately — not H-01 defect. Evidence: `docs/audit/H01-EXECUTION-LOG.md`, `docs/audit/H01-migration-verify.txt`. | None |

---

### H-02 Addendum — Ledger accounting distinction (2026-10-22, post-closure review)

**Independent reviewer note accepted.** Commit `58f12d2c` fixes the ledger mismatch (`70 ≠ 0 + 59.5`) found in the `b6f78361` execution logs. Subsequent documentation clarification commit `9cf831e3` makes the following distinction explicit at every call site and in test W-LG:

| Term | Meaning | DB location |
|---|---|---|
| `booking.platformFee` | Student-paid platform fee added on top of the lesson/package price, collected at package purchase or wallet top-up (policy §2.2). Set to **0** on wallet-funded child lessons — must NOT be re-charged. | `Booking.platformFee` column |
| Ledger `platformFee` parameter | DriveBook's commission share **deducted from the lesson price** when computing instructor payout ($10.50 = $70 × 15%). Not a student charge. Used only to satisfy the double-entry identity `totalAmount = commissionShare + instructorPayout`. | Computed as `price − providerPayout` at each call site |

These are separate charges with different payers. The code passes `price − providerPayout` as the ledger parameter, leaving `booking.platformFee = 0` unchanged on the DB record. Test W-LG labels Entry 2 as "DriveBook commission share" and asserts `commission + payout === lessonPrice`, not `studentPlatformFee + payout`.

**Independent review assessment (commit 9cf831e3, 2026-10-22):** Terminology and test comments are clearer. The commit documents no arithmetic or runtime behaviour change. H-02 CLOSED is retained on prior evidence. Documentation clarification does not independently prove the 5 non-webhook ledger call sites (`booking-service.ts`, `payment-extension.ts`, `bookings/route.ts`, `bookings/batch/route.ts`, `reconcile-stripe/route.ts`) across every booking path — broader ledger correctness requires separate behavioral coverage of those paths. Tracked as follow-on finding **LDG-01** below.

**Tracker v5.41 → v5.42.** H-02 status: ✅ **CLOSED**.

---

### H-02 Follow-on: LDG-01 — Ledger call-site behavioral coverage

| ID | Title | Risk | Status | Scope |
|---|---|---|---|---|
| LDG-01 | Five non-webhook `recordBookingPayment` call sites not behaviorally tested for ledger identity correctness | MEDIUM | **✅ FIX-VERIFIED** — Independent review accepted at `b5d9bd63` (2026-10-24). 13/13 behavioral tests pass (9 callsite + 4 route handler). L03/L04 invoke actual route handlers; L03-B injects real ledger rejection via `mockRejectedValueOnce` and proves booking response still succeeds. Bug found and fixed: `payment-extension.ts` missing `providerId` in `select` projection. Reviewer note: error logging visible in stderr but not explicitly asserted by a logger spy (non-blocking observation). Evidence: `docs/audit/LDG01-execution-raw.txt`, `docs/audit/LDG01-route-handler-raw.txt`. |

### Pre-existing migration chain issue (noted during H-01 review, tracked separately)

**MIG-CHAIN-01** — Two issues found and resolved:

**Issue 1 (FIXED): PL/pgSQL syntax incompatibility.** Migration `20260116000000_sub_06_a_unique_constraints` used undeclared loop variable `r` in `FOR r IN (...)` loops — PG16 requires explicit declaration. Also, the migration queries `Provider`/`Subscription` tables before the `init` migration creates them. Fix: added `r RECORD;` declarations and table-existence guards (`information_schema.tables` check). The PL/pgSQL blocks now skip gracefully when tables don't exist yet (clean database), and run duplicate checks + add constraints when they do (existing database).

**Issue 2 (FIXED): Schema drift — migration chain out of sync with Prisma schema.** After the PL/pgSQL fix, `prisma migrate deploy` on a clean PG16 database completed all migrations but the resulting schema was incomplete. Used `prisma migrate diff` to identify the exact missing objects. Created migration `20261024000002_mig_chain_01_schema_drift_baseline` that reconciles all drift:
- Customer.status, Provider.businessModel, Provider.stripeSubscriptionId, PlatformSettings.packageTiers, Subscription.metadata, Subscription.lastWebhookEventId/Timestamp, User.verificationTokenExpiry, Booking.siteAddressLng, Notification.channel/reminderStage, PDATestBooking.parentBookingId, FinancialLedger.bookingId, StaffMember.permissions
- Index renames and unique constraints (Provider_stripeCustomerId_key, Subscription_stripeSubscriptionId_key, AdminWalletIdempotencyKey composite)
- Timestamp type corrections (Booking.cancellationRequestedAt, Booking.adminReviewedAt)
- Provider.withholdingTaxRate type correction (DECIMAL(5,2))

**Verification:** `prisma migrate diff --from-url <deployed-db> --to-schema-datamodel prisma/schema.prisma` returns "This is an empty migration." — the deployed schema is now identical to the Prisma schema.

**Test results on migrate-deploy DB:** H-01 17/17 pass. H-02 child-booking suite 10/10 pass. H-02 webhook suite: 14/14 tests fail due to pre-existing test design issue (WalletTransaction unique index on `metadata->>'stripePaymentIntentId'` from migration `20260911000000` is present in migrate-deploy DB but not in db-push DB because the index is defined only in the migration, not in the Prisma schema; the webhook test creates duplicate metadata entries). This is a test harness limitation, not a migration defect. All tests pass on db-push DB (project standard).

**Impact on H-01:** None. H-01 migration deploys correctly via both paths. 17/17 tests pass on both db-push and migrate-deploy databases. **Risk:** LOW (operational, not security). **Status:** ✅ RESOLVED — Independent source and CI review accepted at `b9c65637` (2026-10-25). Vercel check success confirmed. Runtime verification (migration chain execution, prisma migrate diff, test suites) remains supplied evidence, not independently reproduced by reviewer.

**Required for MIG-CHAIN-01 closure:** ~~Baseline the migration chain against the current Prisma schema.~~ **DONE** — Baseline migration `20261024000002` created; `prisma migrate diff` confirms schema equivalence. **Status: FIXED.**

**DROP COLUMN safety note:** The baseline migration drops columns (`Provider.paymentModel`, `Provider.voiceLineStatus`, `StaffMember.reason`, `StaffMember.wallet`, `Subscription.checkoutGeneration`) that were artifacts of an earlier incorrect baseline iteration (v1), never deployed to production (project uses `db push`). `DROP COLUMN IF EXISTS` is a no-op on production databases where these columns never existed. On test databases where v1 was applied, these columns contained only default values (no application data). Safe for existing databases.

---

### 8.5 — UI Copy / Expiry Inconsistencies (ALL FIX-VERIFIED)
| ID | Title | Risk | Finding | Required change | Status |
|---|---|---|---|---|---|
| PB-UI-01 | "Credits never expire" in BulkBookingForm, add-funds page, receipt emails | LOW | CONFIRMED — contradicts legal terms (12 months inactivity) | Replace with "Credit is valid for 12 months from last account activity" | ✅ FIX-VERIFIED — `ba9403b1` — 10 tests (C-01..C-10), exit 0 — `pb-ui-copy-corrections.test.ts` 2026-10-13. **Independent review 1 (2026-10-13):** source diff confirmed copy-only; test run = supplied evidence (not independently re-executed); FIX-VERIFIED accepted; not CLOSED pending independent test re-run. **Independent review 2 (2026-10-13, commit 4e2919b0):** status unchanged — FIX-VERIFIED confirmed; not CLOSED until independent test execution completed. **Kiro local execution (2026-10-13T14:56:24, HEAD 8443cba6):** `npx vitest run __tests__/integration/pb-ui-copy-corrections.test.ts` — 22/22 passed, exit 0. **Definitive execution at eb51ae75 (2026-10-13T14:20:29):** 26/26 passed, exit 0 — test file and HEAD are the same commit; traceability gap resolved. Evidence: `docs/audit/PB-UI-CLOSURE-EXECUTION-LOG.txt`. Note: wiring tests are branch-proximity/source-structure checks, not runtime behavioral tests. |
| PB-UI-02 | "12 months from purchase" in BookNowOrLater, PackageSelector, packages marketing page, Stripe checkout description | LOW | CONFIRMED — contradicts legal terms (inactivity-based) | Replace with "12 months from last account activity" | ✅ FIX-VERIFIED — `ba9403b1` — 8 tests (C-11..C-18), exit 0 — `pb-ui-copy-corrections.test.ts` 2026-10-13. **Independent review 1 (2026-10-13):** source diff confirmed copy-only; test run = supplied evidence (not independently re-executed); FIX-VERIFIED accepted; not CLOSED pending independent test re-run. **Independent review 2 (2026-10-13, commit 4e2919b0):** status unchanged — FIX-VERIFIED confirmed; not CLOSED until independent test execution completed. **Kiro local execution (2026-10-13T14:56:24, HEAD 8443cba6):** `npx vitest run __tests__/integration/pb-ui-copy-corrections.test.ts` — 22/22 passed, exit 0. **Definitive execution at eb51ae75 (2026-10-13T14:20:29):** 26/26 passed, exit 0 — test file and HEAD are the same commit; traceability gap resolved. Evidence: `docs/audit/PB-UI-CLOSURE-EXECUTION-LOG.txt`. Note: wiring tests are branch-proximity/source-structure checks, not runtime behavioral tests. |
| PB-UI-03 | Student dashboard shows "Hours Remaining" as primary entitlement metric | MEDIUM | CONFIRMED — `app/client-dashboard/packages/page.tsx` displayed hours as primary; implied fixed-hour guarantee; contradicted dollar-wallet policy | Replace primary display with wallet dollar balance; estimated hours as secondary with rate qualifier | **✅ FIX-VERIFIED** — Independent review accepted at `d92c7f48` (2026-10-25). Vercel check: SUCCESS. Shared utility `lib/utils/estimate-hours.ts`; dashboard uses `estimateHours()`; P10b asserts exact string `estimateHours(700, 80) === 'Approx. 8.8 hrs at $80/hr'`. Booking gate: date-expiry + explicit cancellation only — estimated hours do not block scheduling. 11/11 behavioral tests pass. Verification limitation: reviewer reviewed source and execution log; did not personally rerun test suites or database commands. |
| PB-UI-04 | SMS/push notification copy claims fixed hour count ("you have X lesson hours available") | MEDIUM | CONFIRMED — `packageExpiryAlerts.ts`, `remind-client/route.ts` | Remove fixed hour-count claims; reference wallet credit. Note: showing dollar balance requires new DB query — beyond approved copy-only scope; tracked as follow-up once H-02 is resolved (same constraint as PB-UI-03) | ✅ FIX-VERIFIED — `ba9403b1` — 4 tests (C-19..C-22), exit 0 — `pb-ui-copy-corrections.test.ts` 2026-10-13. **Independent review 1 (2026-10-13):** hour-count claims confirmed removed; copy-only scope boundary confirmed; dollar-balance display accepted as follow-up; test assertions noted as broad (count-based not per-message); test run = supplied evidence (not independently re-executed); FIX-VERIFIED accepted for copy-only scope; not CLOSED. **Independent review 2 (2026-10-13, commit 4e2919b0):** broad-assertion qualification resolved — four per-message literal assertions now verified at source level in committed test file; behavioral wiring (runtime branch coverage) noted as a separate deeper check not yet performed; FIX-VERIFIED confirmed; not CLOSED until independent test execution completed. **Kiro local execution (2026-10-13T14:56:24, HEAD 8443cba6):** `npx vitest run __tests__/integration/pb-ui-copy-corrections.test.ts` — 22/22 passed, exit 0. **Definitive execution at eb51ae75 (2026-10-13T14:20:29):** 26/26 passed, exit 0 — test file and HEAD are the same commit; traceability gap resolved. Evidence: `docs/audit/PB-UI-CLOSURE-EXECUTION-LOG.txt`. Note: wiring tests are branch-proximity/source-structure checks, not runtime behavioral tests. **Runtime wiring check (2026-10-13T14:20:29, HEAD eb51ae75):** 4 branch-proximity tests committed and executed — each message verified co-located within its correct iteration block (expiringIn7Days/expiringIn1Day/expiringToday/expiredYesterday); 26/26 passed, exit 0. Wiring check gate satisfied. Dollar-balance display follow-up: H-02 is now CLOSED (no longer a blocker). If a dollar-balance figure is added to SMS/push notifications, that should be tracked as a new finding with its own ID. |

---

### 8.6 — Server-Side Pricing Integrity (VERIFIED SAFE)

These items were raised during the audit and verified source-safe. Recorded here for completeness.

| Item | Verification | Outcome |
|---|---|---|
| Client price manipulation (bulk booking) | Server recalculates via `calculatePackagePriceDynamic`; 1-cent tolerance; 409 on mismatch | ✅ VERIFIED SAFE |
| Platform fee authority | `getPlatformFeeRate()` → DB with defaults fallback; not hardcoded in route | ✅ VERIFIED SAFE |
| Wallet credit — once exactly | `recordWebhookEvent()` + `walletTransaction.create` in same SERIALIZABLE tx; `@unique` idempotency key | ✅ VERIFIED SAFE |
| Webhook amount validation | `receivedCents !== expectedCents` throws; `expectedTotal` is server-generated metadata | ✅ VERIFIED SAFE |
| Commission locking | Rate locked at `Booking.commissionRate` at creation; webhook reads from `Booking`; payout reads from `Transaction.providerPayout` | ✅ VERIFIED SAFE |
| Wallet ownership | `ClientWallet` keyed on `userId`; no `providerId` binding | ✅ VERIFIED SAFE |
| Concurrent double-spend (`POST /api/bookings`) | Balance re-checked inside SERIALIZABLE tx; pre-check is fast-reject only | ✅ VERIFIED SAFE |
| Slot double-booking | Three-layer guard: Booking table + SlotReservation + PostgreSQL GiST constraint | ✅ VERIFIED SAFE |
| Idempotency (`POST /api/public/bookings/bulk`) | `BookingIdempotencyKey` persisted inside same `$transaction` as `Booking.create` | ✅ VERIFIED SAFE |

---

## Section 9 — White-Label and Account-Separation Findings (WLA Series)

**Audit branch:** `audit/white-label-findings-consolidation`  
**Source of findings:** Consolidated from Kimi, Claude and GPT source reviews; 18 findings registered WLA-001–WLA-018.  
**Base commit for branch:** `5945d037` (main at branch creation)  
**Changes on main:** Fixes for WLA-001, WLA-003, WLA-006, WLA-009, WLA-010, WLA-017 applied to main.

### 9.1 — Findings worked to date (on main)

| ID | Title | Risk | Status | Fix commit | Tests | Notes |
|---|---|---|---|---|---|---|
| WLA-001 | Quote checkout path lacked DIRECT-payment-mode guard | P1 | **FIX APPLIED** — awaiting independent review | `0b47689c` | 10/10 source+logic | Guard moved before `acceptQuote()` so no state changes before 503. Matches pattern in create-intent and bulk-booking routes. |
| WLA-003 | Stripe Checkout return URLs pointed to `/customer-dashboard/bookings` (non-existent route) | P1 | **FIX APPLIED** — awaiting independent review | `f733ae01` | (same suite as WLA-001) | Corrected to `/client-dashboard/bookings` in `lib/services/saas-payment.ts`. |
| WLA-006 | `domain_already_in_use` treated as successful domain attachment | P1 | **FIX APPLIED** — awaiting independent review | `c8370f89` | 8/8 | Extracted `addDomainToVercel()` to `lib/services/vercel-domains.ts`; `domain_already_in_use` now returns `{ success: false }`. |
| WLA-009 | PREMIUM tier excluded from subdomain renderer branding despite `whiteLabel: true` entitlement | P2 | **FIX APPLIED** — fix documented and live file confirmed | `f09c6c3d` | 11/11 | Renderer uses `isBrandingEligible` including PREMIUM. `whiteLabel: isPremium` (structure removed). `multiInstructor: false` for all current tiers. Architecture decision in `.kiro/steering/account-architecture.md`. |
| WLA-010 | Custom-domain middleware missing `/book`, `/privacy`, `/terms` from skip-paths | P1 | **FIX APPLIED** — awaiting independent review | `c65cf3ee` | 10/10 source+logic | `BusinessWebsitePage.tsx` links to these paths; without exemptions they 404 on custom domains. |
| WLA-017 | `x-custom-domain` header was client-controllable; used for tenant resolution | P1 | **FIX APPLIED** — behavioral verification pending | `73b680ca` | 8/8 source | Page now reads `Host` header; middleware strips client-supplied `x-custom-domain` on own-domain requests. Reviewer note: Host header trust depends on proxy chain. |

### 9.2 — Findings pending verification or policy decision

| ID | Title | Risk | Status | Notes |
|---|---|---|---|---|
| WLA-002 | Provider-settlement semantics for SaaS mode | ARCHITECTURAL | OPEN — architecture decision recorded | Overlaps MM-10-A. Pending SaaS payment implementation. |
| WLA-004 | `application_fee_amount` set without connected-account context | P2 | SOURCE ANALYSIS COMPLETE — runtime verification pending | Stripe test-mode verification requires connected account (not yet approved). Analysis: `docs/audit/WLA-004-SOURCE-ANALYSIS.md`. |
| WLA-005 | Wallet balance is user-wide, not provider-attributed | ARCHITECTURAL | OPEN — architecture decision required | Whether this is a defect depends on approved white-label wallet contract. |
| WLA-007 | Domain ownership concurrency across Provider and BusinessDomain records | P1 | **FIX APPLIED** — reviewer confirmed `b924a144` correct; DB partial unique index + P2002 catch replaces tautological updateMany | `b924a144` | 7/7 source+simulation | Reviewer note: 7/7 tests are source checks and a simulated race, not a real concurrent PostgreSQL test. Migration presence in Git does not independently prove application to production. |
| WLA-008 | Cross-provider tenant isolation not demonstrated across all routes | P1 | **FIXES APPLIED** — route inventory complete (47 routes); 3 sub-findings fixed; open items documented separately | `98fb7605` | 24/24 source | Sub-finding detail below. Remaining route inventory items (13 routes) still require ownership review. Full behavioral Provider A/B tests not yet run. |
| WLA-011 | Host classification may use substring matching | P2 | OPEN | Deceptive-host tests not yet run. |
| WLA-012 | BusinessDomain-only fallback passes `businessId` to a provider ID/slug lookup | P2 | OPEN | Runtime staging test required. |
| WLA-013 | Custom-domain pages inherit global DriveBook metadata | P2 | OPEN | Provider metadata isolation policy must be defined before fix. |
| WLA-014 | Provider branding has two stores that may diverge | P2 | OPEN | Reconcile BRAND-V-07 first. |
| WLA-015 | Customer communications may retain DriveBook sender identity | P2 | OPEN | Full template inventory required. |
| WLA-016 | Customer/provider portal identity may not support full independent branding | P2 | OPEN | Product contract must be defined first. |
| WLA-018 | Public branding may imply more white-label capability than implemented | P2 | OPEN | Compare external claims to actual features. |

### 9.3 — WLA-008 sub-finding detail

Route inventory: 47 routes classified (`docs/audit/WLA-008-ROUTE-INVENTORY.md`, commit `037eea18`).

| Sub-ID | Route | Pattern | Fix | Commit | Status |
|---|---|---|---|---|---|
| WLA-008-A-txt | `/api/instructor/invoices/[transactionId]` | Post-fetch IDOR (findUnique then ownership check) | `findFirst({ where: { id, providerId } })`; 404 for null | `2dc5d81a` | **FIX APPLIED** |
| WLA-008-A-data | `/api/instructor/invoices/[transactionId]/data` | Same post-fetch IDOR pattern (reviewer identified) | `findFirst({ where: { id, providerId } })`; removed 403 branch; 404 for null | `98fb7605` | **FIX APPLIED** |
| WLA-008-B | `/api/bookings/mobile` POST | Any `customerId` accepted (no ownership check); CONFIRMED without wallet debit (payment bypass); wallet check outside `$transaction` (concurrency gap); default READ COMMITTED isolation allowed double-spend | Customer ownership via `bookings.some`; wallet balance check + booking create + debit inside single `$transaction`; `isolationLevel: 'Serializable'` added (matches pattern in main bookings route, confirm-package-booking, Stripe webhook) | `2dc5d81a`, `98fb7605`, `b75e37fc` | **FIX APPLIED** — SERIALIZABLE isolation source-verified; PostgreSQL concurrency test run (see below) |
| WLA-008-B-RUNTIME | Concurrency race: two simultaneous mobile bookings vs $80 wallet | Balance=$80, A=$60, B=$60; combined $120 > $80 → only one can be CONFIRMED | SERIALIZABLE causes one tx to lose; loser gets PENDING_PAYMENT or P2034 | `b75e37fc`, `68b4778e`, `b5befcf8` | **47/47 REPORTED** (PostgreSQL 16.4 + mocked handler) — commit `0ddace9e`. Tests: 7 concurrency (CONC-01..07), 3 negative-access (NEG-01..03: Provider A/B quote isolation), 4 retry behavioral (RETRY-01..04), 2 route HTTP (HTTP-01/02). Raw logs: `docs/audit/WLA-008B-concurrency-raw.txt`, `docs/audit/WLA-008B-all-raw.txt`. Independent review outstanding. |
| WLA-008-C | `/api/bookings/combined` POST | No rate limiting → slot-squatting with zero-cost PENDING bookings | `bookingRateLimit` (10/min) before DB; per-user identifier | `2dc5d81a` | **FIX APPLIED** — fail-open limitation documented |
| WLA-008-TENANT-1 | `/api/instructor/quotes/[bookingId]/submit` + `submitQuote()` service | Route: post-fetch IDOR. Service: unscoped `findUnique` + unscoped `booking.update` — defence-in-depth gap (reviewer finding). v1 fix left `providerId` optional, preserving a bypass path. | v2 fix: `QuoteInput.providerId` made mandatory (required field, no `?`); conditional guard removed; service enforces unconditionally. Route scoped lookup + service boundary both enforce ownership. | `5f309c06` (service hardening), `latest` (mandatory) | **FIX APPLIED** — SQ01–SQ05 source-verified; NEG-01..03 PostgreSQL confirmed: Provider A → BOOKING_NOT_FOUND, zero quotes, booking unchanged. No bypass path. |

Routes still requiring ownership review (from 13 ⚠️ REVIEW in inventory):

| Route | Remaining concern | Review result |
|---|---|---|
| `/api/instructor/quotes/[bookingId]/submit` | Post-fetch provider ownership check | **FIXED** — `findFirst({ where: { id, providerId } })`; post-fetch check removed; 404 for both cases |
| `/api/instructor/clients/[id]` | Ownership check | ✅ SECURED — `bookings: { some: { providerId } }` pre-scoped |
| `/api/instructor/invoices/[transactionId]` | Post-fetch IDOR | ✅ FIXED (WLA-008-A) |
| `/api/instructor/invoices/[transactionId]/data` | Post-fetch IDOR | ✅ FIXED (WLA-008-A-data) |
| `/api/bookings` POST | providerId from session vs body | ✅ SECURED — `session.user.providerId` throughout |
| `/api/bookings/[id]` GET/PATCH/DELETE | Booking ownership | ✅ SECURED — `bookingWhere.providerId = providerId` |
| `/api/bookings/batch` POST | Customer ownership | ✅ SECURED — `session.user.providerId` |
| `/api/bookings/combined` POST | Rate limiting | ✅ MITIGATED — `bookingRateLimit` (10/min) reduces slot-squatting abuse. Not an ownership-isolation fix; rate limiting is a separate abuse-prevention control. |
| `/api/bookings/mobile` POST | Customer IDOR + payment bypass | ✅ FIXED (WLA-008-B) |
| `/api/client/schedule-package-hours` | providerId from body | ✅ SECURED — `userId: user.id` scoping; providerId only for redirect URL |
| `/api/client/quotes/request` | providerId from body | ✅ BY DESIGN — client picks provider (marketplace flow) |
| `/api/client/bookings/create-bulk` | Provider/package ownership | ✅ BY DESIGN — client books any instructor; server recalculates price |
| `/api/client/bookings/[id]` | Booking ownership | ✅ SECURED — `customerId: { in: clientIds }` |
| `/api/business/branding` | Route-level verification | ✅ SECURED — `biz_${session.user.providerId}` |

Test evidence (commit `b5befcf8` + quotes/submit fix `0ddace9e`):
- Source-inspection: 37/37, `wla-008-cross-provider-isolation.test.ts`
  - A01–A04: invoice text route IDOR fix ✓
  - D01–D04: invoice data route IDOR fix ✓
  - B01–B10: mobile route (ownership, wallet, SERIALIZABLE, retry, P2034→409) ✓
  - C01–C05: combined route rate limit ✓
  - SQ01–SQ05: submitQuote service boundary (route passes providerId, QuoteInput.providerId mandatory not optional, findFirst, unconditional WHERE, update scope) ✓
  - T01–T06: 13-route ownership review (quotes/submit fix, clients, quotes/request, client bookings, create-bulk, branding) ✓
  - R01–R03: regression guards ✓
  - CONC-01: at least one booking row committed (non-vacuous) ✓
  - CONC-02: exactly 1 CONFIRMED booking (not 0, not 2) ✓
  - CONC-03: loser is PENDING_PAYMENT or P2034 ✓
  - CONC-04: balance = $80 − $60 = $20 (exact) ✓
  - CONC-05: 1 debit, total = $60 ✓
  - CONC-06: confirmed bookings = debit count (double-entry) ✓
  - CONC-07: source structure checks ✓
- PostgreSQL negative-access (3 tests, `wla-008-b-wallet-concurrency.test.ts`, commit `0ddace9e`):
  - NEG-01: Provider A quotes Provider B booking → BOOKING_NOT_FOUND ✓
  - NEG-02: zero Quote rows created ✓
  - NEG-03: Provider B booking status unchanged ✓
- Retry utility behavioral (4 tests, `wla-008-b-mobile-route-http.test.ts`):
  - RETRY-01: P2034 → retry → success (2 calls) ✓
  - RETRY-02: all retries exhausted → rethrow P2034 (3 calls logged) ✓
  - RETRY-03: non-P2034 rethrown immediately (1 call) ✓
  - RETRY-04: first-call success (1 call) ✓
- Route HTTP (2 tests, `wla-008-b-mobile-route-http.test.ts`):
  - HTTP-01: exhausted P2034 → 409; $transaction called exactly 3 times ✓
  - HTTP-02: successful booking → 201 with booking data ✓

Verification limitations:
- Concurrency tests use a helper that mirrors route logic but does not call `withSerializableRetry` — isolation property tested directly; retry path tested separately via RETRY-01..04
- HTTP tests use mocked Prisma; they prove the route handler routes errors correctly but do not connect to PostgreSQL
- No Provider A/B database-level behavioral tests. Full cross-tenant verification incomplete
- All 13 ⚠️ REVIEW routes from the inventory have been inspected; 1 additional IDOR fixed (quotes/submit); see route review table above

### 9.4 — Verification qualification

All WLA fixes listed above were applied on main. Reported test evidence:
- WLA-001/003: 10/10 source+logic tests (route-handler invocation blocked by next-auth/next Vitest mock limitation)
- WLA-006: 8/8 tests (mocked `fetch`; tests the actual extracted utility)
- WLA-009: 11/11 tests (utility assertions, source checks, pure-logic tests); not browser-level verified
- WLA-010: 10/10 source+logic tests

Reviewer has not independently rerun these test suites. Behavioral HTTP testing for WLA-010 (deployed custom-domain behavior) and WLA-017 (proxy chain trust) remains pending.

**Architecture decisions on main:**
- `.kiro/steering/account-architecture.md` — commercial offers vs feature tiers, multi-provider roadmap
- `.kiro/steering/platform-model.md` — updated feature matrix (multiInstructor disabled, PREMIUM whiteLabel)
