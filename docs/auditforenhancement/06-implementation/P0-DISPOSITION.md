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
| P0-01A | Wallet PaymentIntent cross-user theft / ownership bypass | `OPEN` | `28e75f73` ownership fix | Source and local/Docker evidence are recorded in [P0-DOCKER-LOCAL-EVIDENCE.md](P0-DOCKER-LOCAL-EVIDENCE.md). | Independent source review complete; staging gate intentionally delegated. | Other team: authenticated staging sessions, Stripe test-mode PaymentIntent, database evidence, and deployment verification. | Delegated / remain open. Do not duplicate implementation or staging work on this branch. | Yes |
| P0-01B | Concurrent wallet credit race / duplicate PaymentIntent credit | `OPEN` | `b9c2f0ff` database uniqueness and conflict handling | Migration and local/Docker concurrency evidence are recorded in [P0-DOCKER-LOCAL-EVIDENCE.md](P0-DOCKER-LOCAL-EVIDENCE.md). | Independent source review complete; staging gate intentionally delegated. | Other team: deployed migration verification, authenticated concurrent requests, and database evidence. | Delegated / remain open. Do not duplicate implementation or staging work on this branch. | Yes |
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

- P0-01A: `OPEN / DELEGATED` — other team owns authenticated staging evidence.
- P0-01B: `OPEN / DELEGATED` — other team owns deployed concurrency and migration evidence.
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

This is deployment-level prerequisite evidence only. P0-01A and P0-01B remain `OPEN / DELEGATED`; authenticated staging evidence is deferred to the other team, and rebase remains blocked.

## S-1 / S-8 / S-9 Repository Disposition

| Finding | Repository evidence | Current status | External evidence required | Disposition |
| --- | --- | --- | --- | --- |
| S-1 credential liveness | [CREDENTIAL_ROTATION_CHECKLIST.md](../../pr/CREDENTIAL_ROTATION_CHECKLIST.md) is tracked and explicitly marked `NOT ROTATED`, with credential-looking values recorded. Values are intentionally not reproduced here. | `OPEN` | Security/DevOps and each provider dashboard must confirm rotation, revocation, history handling, and replacement configuration. Suspected credentials must never be tested by authentication. | Remain open; security owner disposition required. Closure blocker: Yes |
| S-8 root `.credentials` | A local `.credentials` file exists, is ignored by `.gitignore`, and is not tracked by Git. Repository evidence supports local dev-only handling but does not prove historical exposure, removal from all machines, or safe contents. | `OPEN` | Repository-owner/security confirmation of local cleanup, history status, and developer-machine handling. Do not inspect or authenticate with values. | Remain open pending security/dev-hygiene disposition. Closure blocker: Yes |
| S-9 `CRON_SECRET` configuration | `CRON_SECRET` is absent from [.env.example](../../../.env.example); cron routes require a bearer secret in deployed configuration. Deployed Vercel secret state was not inspected. | `OPEN` | DevOps must confirm the deployed secret exists, is rotated/managed, and all protected cron routes use the intended auth path. | Remain open pending example/configuration and deployment evidence. Closure blocker: Yes |

S-1/S-8/S-9 repository disposition is complete as an inventory, not as a resolution. No application or configuration fix is authorized by this record. Wallet P0-01A/B staging evidence is likewise delegated and remains an explicit closure dependency. Our active P0 track is S-2 through S-6, followed by remaining closure dependencies.

## S-2 through S-6 Platform-Security Disposition

| Finding | Original evidence and affected component | Main-branch remediation check | Current status | Remaining owner/evidence | Our action |
| --- | --- | --- | --- | --- | --- |
| S-2 / CLD-02 shared `resetToken` | [claude-audit.md](../01-independent-audits/claude-audit.md) identifies shared `User.resetToken` use across OTP confirmation, password setup, and password reset. A verified OTP can therefore cross the password-reset purpose boundary. A staging reproduction is still the field-verification step. | No dedicated S-2 remediation or verification artifact was found in `origin/main/docs/audit`; source references remain part of the security track. | `OPEN` / code-confirmed | Security/auth owner must separate token purpose, enforce expiry/consumption, and independently verify the auth flows in isolated staging. | Do not duplicate the fix; retain as an external security closure blocker. |
| S-3 / CLD-03 OTP brute-force protection | [claude-audit.md](../01-independent-audits/claude-audit.md) identifies an in-memory, unpruned, per-instance attempt map and pre-normalization rate-limit keys in `verifications/otp/confirm/route.ts`. | No dedicated S-3 remediation or verification artifact was found in `origin/main/docs/audit`; no evidence shows distributed lockout behavior. | `OPEN` / code-confirmed | Security/platform owner must implement shared bounded state (Redis/DB), normalize identifiers, and provide multi-instance/runtime verification. | Do not duplicate the fix; retain as an external security closure blocker. |
| S-4 / CLD-04 unauthenticated voice SMS relay | [claude-audit.md](../01-independent-audits/claude-audit.md) identifies legacy `drivebook-hybrid` `/api/bookings` access exempted by middleware, with caller-controlled phone data reaching Twilio SMS. | No S-4 remediation or deployed verification artifact was found in `origin/main/docs/audit`; the finding is explicitly outside Copilot scope and assigned to the platform/voice track. | `OPEN` / separate platform track | Voice/platform owner must confirm whether the legacy service is deployed, remove the route and Mongo dependency if obsolete, and provide deployment/runtime evidence. | No Copilot action; keep as P0 closure dependency. Never probe SMS delivery against real numbers. |
| S-5 / CLD-05 public bulk-booking pre-account hijacking | [claude-audit.md](../01-independent-audits/claude-audit.md) identifies account creation from an unverified submitted email followed by a password-capable setup link to a submitted phone in `app/api/public/bookings/bulk/route.ts`. | No S-5 remediation or verification artifact was found in `origin/main/docs/audit`; the main source remains the referenced evidence surface. | `OPEN` / separate platform track | Auth/platform owner must establish verified-channel account creation and provide a synthetic staging reproduction plus post-fix verification. | No Copilot action; retain as a closure dependency. |
| S-6 / CLD-06 public booking access and rate-limit gap | [claude-audit.md](../01-independent-audits/claude-audit.md) verifies the `cuid()` versus UUIDv4 documentation false premise and identifies unrate-limited phone-match fallback in `app/api/public/bookings/[id]/route.ts`. Cuid guessability remains an empirical question; the rate-limit fix is required regardless. | No S-6 remediation or verification artifact was found in `origin/main/docs/audit`; no empirical cuid-volume test is recorded. | `OPEN` / partial evidence | Platform/security owner must add rate limiting, assess returned-field authorization, and document an isolated-volume/guessability assessment. | No Copilot action; retain as a closure dependency. |

### S-2 through S-6 conclusion

These findings are platform/voice/authentication security work outside the Admin Copilot implementation boundary. Main-branch audit documents provide the original source evidence and routing, but do not provide closure evidence for these items. They remain `OPEN`; no implementation is duplicated on the Copilot branch, and no rebase or P2 work is authorized until the external dispositions are recorded.
