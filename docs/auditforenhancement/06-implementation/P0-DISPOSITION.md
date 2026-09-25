# P0 Security Disposition Record

**Date:** September 25, 2026
**Scope:** P0 inventory and evidence disposition only
**Branch:** `audit/ai-enhancement-multimodel`
**Authority:** This record distinguishes the enhancement-track P0 labels from the historical wallet P0-01A/P0-01B labels.

## Evidence Rules

- Status is based on inspectable repository evidence, not inherited tracker claims.
- `CLOSED` requires complete execution evidence for the required scenario, not merely source inspection or test-file existence.
- The historical `18/18` P0-01 claim is not used because the complete output/evidence is not currently available.
- No suspected credential is authenticated or tested. Credential liveness must be verified through the appropriate provider or deployment dashboard.

## Disposition Matrix

| Finding ID | Exact identifier | Current status | Fix commit | Verification evidence | Independent review | External dependency | Disposition | Closure blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0-01A | Wallet PaymentIntent cross-user theft / ownership bypass | `OPEN` | `28e75f73` ownership fix | Source: [P0-01-VERIFICATION.md](../../audit/P0-01-VERIFICATION.md), [P0-01-VERIFICATION-SUMMARY.md](../../audit/P0-01-VERIFICATION-SUMMARY.md). Local unit coverage: [wallet-ownership.test.ts](../../app/api/client/__tests__/wallet-ownership.test.ts). Route-level test exists at [p0-01-ownership.test.ts](../../app/api/client/wallet-add/__tests__/p0-01-ownership.test.ts), but complete execution evidence is unavailable. | Independent source review recorded in the P0-01 verification documents; test gate remains pending. | Isolated staging deployment, Stripe test-mode PaymentIntent, database evidence, and deployment verification. | Remain open pending complete execution evidence. Required minimum: User B request using User A's PaymentIntent -> HTTP 403 -> zero `WalletTransaction` rows -> User B balance unchanged. | Yes |
| P0-01B | Concurrent wallet credit race / duplicate PaymentIntent credit | `OPEN` | `b9c2f0ff` database uniqueness and conflict handling | Migration source: [20260911000000_add_wallet_transaction_payment_intent_unique](../../prisma/migrations/20260911000000_add_wallet_transaction_payment_intent_unique/migration.sql). Concurrent test source: [p0-01b-concurrent.test.ts](../../app/api/client/wallet-add/__tests__/p0-01b-concurrent.test.ts), which uses `Promise.all()`. Complete execution output and deployment verification are not available here. | Historical source review identified the race and the fix; independent execution evidence remains pending. | Isolated PostgreSQL/staging database and deployed migration. | Remain open pending complete concurrent execution, unique-index verification, and graceful conflict evidence. | Yes |
| P0-01 (security track) | S-1 credential liveness; S-8 root `.credentials`; S-9 `CRON_SECRET` example/deployment configuration | `OPEN` | None recorded for this disposition | Evidence/reconciliation: [CLAIMS-MATRIX.md](../03-evidence-reconciliation/CLAIMS-MATRIX.md), [DECISIONS.md](../04-final/DECISIONS.md), [PRIORITY-BACKLOG.md](../05-planning/PRIORITY-BACKLOG.md). | Independent audit records require security-track handling; no liveness evidence is present in this repository disposition. | Security/DevOps, provider dashboards, deployment configuration, and credential owners. Never authenticate suspected values. | Remain open. Rotate or disposition credentials, confirm `.credentials` handling, add/verify `CRON_SECRET`, and record evidence. | Yes |
| P0-02 (enhancement track) | S-7 middleware public-path defence-in-depth | `FIX-VERIFIED` | `9ff8da95a874a2362d6fbde931bb54e163c1d78d` | 65/65 test evidence and implementation record in the authoritative tracker; focused middleware tests and request-level auth-flow tests are recorded there. | GPT independent audit recorded in the tracker at the exact SHA. | None identified beyond the final post-rebase re-verification gate. | Resolve for P0 disposition; retain as independently verified and re-run after the required latest-main rebase. | No, subject to post-rebase re-verification |
| P0-03 (enhancement track) | S-2 shared reset token; S-3 distributed OTP brute-force; S-4/S-5/S-6 voice/booking platform security findings | `OPEN` | None recorded for this disposition | Scope and routing are recorded in [DECISIONS.md](../04-final/DECISIONS.md), [PRIORITY-BACKLOG.md](../05-planning/PRIORITY-BACKLOG.md), and the authoritative tracker. No independent remediation evidence is recorded here. | No independent closure review recorded for these items. | Platform security team and relevant voice/booking owners. | Remain open on the separate platform-security track; obtain owner, evidence, and disposition before closure. | Yes |

## Required P0-01 Evidence Gate

The minimum ownership scenario for P0-01A is not satisfied by the local ownership helper tests or by the existence of an integration test file. The disposition remains `OPEN` until an inspectable execution record demonstrates all of the following with PaymentIntent ownership bound to User A:

1. User B submits the wallet-add request using User A's succeeded PaymentIntent.
2. The response is HTTP `403`.
3. User B receives zero `WalletTransaction` rows for that PaymentIntent.
4. User B's wallet balance is unchanged.
5. The evidence identifies the deployment/test commit and isolated test environment.

The same evidence package should record the legitimate User A path, missing metadata rejection, wallet mismatch rejection, and duplicate/concurrent behavior where applicable.

## Disposition Summary

- P0-01A: `OPEN` — required ownership execution evidence missing.
- P0-01B: `OPEN` — complete concurrent execution and deployment evidence missing.
- P0-01 security track (S-1/S-8/S-9): `OPEN` — external security evidence required.
- P0-02 S-7: `FIX-VERIFIED` — post-rebase re-verification still belongs to the closure gate.
- P0-03 S-2 through S-6: `OPEN` — separate platform-security disposition required.

## Local Evidence Update

Docker evidence is now recorded in [P0-DOCKER-LOCAL-EVIDENCE.md](P0-DOCKER-LOCAL-EVIDENCE.md). The actual route tests passed `12/12`, including the required User B -> User A ownership scenario and PostgreSQL `Promise.all()` concurrency checks. This strengthens, but does not complete, P0-01A/B disposition: both remain `OPEN` until isolated staging reproduces the HTTP, database, migration, and deployment evidence.

No rebase, P2 implementation, or application change is authorized by this record. After P0 disposition is complete, follow the sequence in [POST-P1-CLOSURE-AND-ROADMAP.md](../05-planning/POST-P1-CLOSURE-AND-ROADMAP.md).

## Staging Checkpoint: Incomplete

The deployed Vercel prerequisite was checked from the terminal:

- `GET /` returned HTTP `200` from Vercel.
- `POST /api/client/wallet-add` without authentication returned HTTP `401`.
- The wallet endpoint is present and authentication enforcement is active.
- No credentials, sessions, real payment information, or fabricated PaymentIntent records were used.
- Authenticated NextAuth sessions, a succeeded Stripe test-mode PaymentIntent, and read-only staging database access are not yet available.

This is deployment-level prerequisite evidence only. P0-01A and P0-01B remain `OPEN`; authenticated staging evidence is deferred, and rebase remains blocked.

## S-1 / S-8 / S-9 Repository Disposition

| Finding | Repository evidence | Current status | External evidence required | Disposition |
| --- | --- | --- | --- | --- |
| S-1 credential liveness | [CREDENTIAL_ROTATION_CHECKLIST.md](../../pr/CREDENTIAL_ROTATION_CHECKLIST.md) is tracked and explicitly marked `NOT ROTATED`, with credential-looking values recorded. Values are intentionally not reproduced here. | `OPEN` | Security/DevOps and each provider dashboard must confirm rotation, revocation, history handling, and replacement configuration. Suspected credentials must never be tested by authentication. | Remain open; security owner disposition required. Closure blocker: Yes |
| S-8 root `.credentials` | A local `.credentials` file exists, is ignored by `.gitignore`, and is not tracked by Git. Repository evidence supports local dev-only handling but does not prove historical exposure, removal from all machines, or safe contents. | `OPEN` | Repository-owner/security confirmation of local cleanup, history status, and developer-machine handling. Do not inspect or authenticate with values. | Remain open pending security/dev-hygiene disposition. Closure blocker: Yes |
| S-9 `CRON_SECRET` configuration | `CRON_SECRET` is absent from [.env.example](../../../.env.example); cron routes require a bearer secret in deployed configuration. Deployed Vercel secret state was not inspected. | `OPEN` | DevOps must confirm the deployed secret exists, is rotated/managed, and all protected cron routes use the intended auth path. | Remain open pending example/configuration and deployment evidence. Closure blocker: Yes |

S-1/S-8/S-9 repository disposition is complete as an inventory, not as a resolution. No application or configuration fix is authorized by this record. After these external dispositions and the remaining S-2 through S-6 disposition are complete, follow the closure sequence.
