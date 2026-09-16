# DriveBook Security Audit — Process & Lifecycle Protocol

**Version:** 1.0  
**Date:** 2026-09-16  
**Authority:** This document governs how security findings are created, progressed, and closed.  
**Scope:** All security, financial-integrity, and reliability findings in the DriveBook codebase.

---

## The Central Rule

> **A finding is CLOSED when evidence exists. Not when a markdown file is edited.**

The master tracker (`AUDIT-MASTER-TRACKER.md`) is the only authoritative record of finding status.  
All other documents are **evidence records** — they support the master tracker, they do not replace it.

---

## Lifecycle Stages

Every finding moves through exactly these stages in order:

```
FINDING → VERIFIED → FIX → FIX-VERIFIED → CLOSED
                                            ↓
                                        (may become REOPENED)

Special:
SUPERSEDED  — original finding replaced by more granular sub-findings
REJECTED    — finding disproven; no vulnerability exists
```

### Stage Definitions

| Stage | Meaning | Who advances it | Required evidence |
|---|---|---|---|
| **FINDING** | Issue discovered and described | Kiro or GPT | Code location + line numbers + description + risk class |
| **VERIFIED** | Finding independently confirmed | GPT (independent review) or Kiro with explicit code proof | Direct code inspection showing the described condition exists |
| **FIX** | Remediation implemented | Kiro | Git commit SHA + changed files listed |
| **FIX-VERIFIED** | Fix independently tested and passing | GPT or Kiro | Targeted passing tests + relevant regression tests; Vitest exit code 0 |
| **CLOSED** | All evidence sufficient; no known gap | Requires FIX-VERIFIED to be complete | Final commit + test count + no open bypass identified |
| **REOPENED** | New evidence shows closure was incorrect | Either party | New finding or test proving the closed state was wrong |
| **SUPERSEDED** | Finding replaced by sub-findings | Either party | List of replacement IDs + reason for split |
| **REJECTED** | Disproven — the described condition does not exist | Either party | Code proof that the condition is absent |

---

## Closure Rules

A finding **cannot** be marked CLOSED unless ALL of the following are true:

1. ✅ **FINDING stage** — code location and risk documented with line numbers
2. ✅ **VERIFIED stage** — independent confirmation that the condition exists (not just a claim)
3. ✅ **FIX stage** — a git commit exists that addresses the finding; commit SHA recorded
4. ✅ **FIX-VERIFIED stage** — at least one targeted test exists that:
   - Would **fail** if the fix were reverted
   - **Passes** with the fix in place
   - Has been run with Vitest exit code 0

**None of these can be satisfied by editing a markdown file alone.**

---

## Supersession Rules

When a finding is reclassified or split:

1. The original finding ID is preserved with `Status: SUPERSEDED`
2. The reason for supersession is recorded (e.g. "original security class disproven by code verification")
3. New sub-finding IDs are listed in the `Replaced-by` field
4. The original finding's evidence documents remain in place — they are not deleted
5. Sub-findings start at `FINDING` stage and must progress through the full lifecycle independently

Example:
```
MM-10   → SUPERSEDED → Replaced by MM-10-A, MM-10-B, MM-10-C
                        Reason: PAY-01 account-substitution class disproven;
                        saas-payment.ts never reads provider.stripeAccountId
```

---

## Reopening Rules

A CLOSED finding may be REOPENED if:

- A new code path is discovered that bypasses the fix
- A test is written that fails despite the finding being marked CLOSED
- A production incident demonstrates the vulnerability was not fully addressed

On reopening:
1. `Status` changes from `CLOSED` to `REOPENED`
2. The original closure evidence is preserved
3. A new `Reopened-reason` field is added with the new evidence
4. The finding re-enters the lifecycle at `FIX` stage (VERIFIED is already established)

---

## Kiro Enforcement Rules

These rules apply to every session. Kiro must follow them without exception.

### Before marking a finding CLOSED

Kiro must confirm all of the following **in the same response** that changes the status:

- [ ] The original finding's code location still matches the fix
- [ ] At least one targeted test exists that would fail without the fix
- [ ] `npx vitest run <test-file>` exits 0 (run and show output)
- [ ] The git commit SHA for the fix is recorded in the master tracker
- [ ] No known bypass of the fix has been identified

### Before committing any production code change

Kiro must update the master tracker **in the same commit** as the production code change:

1. Advance the finding to `FIX` stage with the commit SHA
2. Record which files were changed
3. If tests are added, advance to `FIX-VERIFIED` and record test count + exit code

A production code change **without a corresponding master tracker update** is not acceptable.

### Before starting a new fix

Kiro must confirm the target finding is at `VERIFIED` stage (not just `FINDING`).  
If a finding is only at `FINDING`, GPT independent verification must happen first.

### When reclassifying a finding

Kiro must:
1. Set original finding to `SUPERSEDED` (never delete or silently rewrite)
2. Create new sub-findings starting at `FINDING` stage
3. Record the reclassification reason in the original finding row
4. Not carry forward the original finding's VERIFIED status to sub-findings automatically

---

## Evidence Document Rules

Individual documents in `docs/audit/phase1/`, `docs/audit/phase2/`, etc. are **evidence records**.

They:
- ✅ Record investigation details, code traces, test output
- ✅ Support the master tracker's lifecycle state
- ✅ Can be updated to add new evidence
- ❌ Do NOT control the finding's lifecycle stage — only the master tracker does
- ❌ Do NOT replace the master tracker's test evidence columns

When a finding's status changes in the master tracker, the corresponding evidence document should be updated to show `Current Status: [STAGE]` at the top — but the evidence document is never the authoritative status source.

---

## PR/MR Documentation Rules

Every PR that changes production code for a security finding must include:

```markdown
## Security Finding Status

| ID | Finding | Verified | Fix | Fix Verified | Status |
|---|---|---|---|---|---|
| MM-05-A | Concurrent admin refund race | ✅ | ✅ commit abc123 | ✅ 3 tests pass | CLOSED |
| MM-05-B | Lost-refund gap | ✅ | ✅ commit abc123 | ✅ 2 tests pass | CLOSED |
```

The PR description must reflect the **current state** at the time of the PR, not the state at the time of investigation.

---

## Finding ID Conventions

IDs are assigned at `FINDING` stage and never change.

Format:
- Phase 1 original findings: `P0-01`, `SUB-22`, `C-1`, `F-08`, `PAY-H-01`, etc. (from PHASE1_REMEDIATION_REGISTER)
- Phase 2 payout findings: `PAY-01` with sub-tasks `PAY-01-A` through `PAY-01-D`
- Money-movement inventory: `MM-01` through `MM-17`, with sub-findings using suffix `A/B/C...`
- Future findings: continue `MM-18`, `MM-19`, etc. or introduce new prefix if outside money-movement scope

Sub-findings of a superseded finding inherit the parent ID prefix: `MM-10` → `MM-10-A`, `MM-10-B`, `MM-10-C`.

---

## What Each Column in the Master Tracker Means

| Column | What it records |
|---|---|
| **ID** | Stable identifier; never changes |
| **Title** | Short description of the finding |
| **Risk** | CRITICAL / HIGH / MEDIUM / LOW / NONE / ARCHITECTURAL |
| **Finding** | CONFIRMED / REJECTED / SUPERSEDED |
| **Verification** | VERIFIED (independent) / UNVERIFIED / N/A |
| **Fix** | Commit SHA, or NOT-STARTED / N/A |
| **Fix-Verified** | Test count + exit code, or PENDING / N/A |
| **Status** | OPEN / CLOSED / SUPERSEDED / REJECTED / REOPENED |
| **Evidence** | Path to primary evidence document |
| **Phase-1-ref** | Cross-reference to original PHASE1_REMEDIATION_REGISTER ID if applicable |

---

## Appendix A — Kiro Session Enforcement Checklist

This checklist applies at the start and end of every session that involves audit work or production code changes. It is not optional.

### At the start of every session

Before touching any production code:

- [ ] Open `docs/audit/AUDIT-MASTER-TRACKER.md` and identify the finding being worked on
- [ ] Confirm the finding is at `VERIFIED` stage (not just `FINDING`)
- [ ] If the finding is only at `FINDING`, stop and perform verification first
- [ ] Read the reconciliation report entry for the finding — confirm the "Missing before FIX" list
- [ ] Check whether MM-14 or MM-15 affect the current fix design (both are UNVERIFIED; if in scope, read the relevant webhook handler before starting)

### When implementing a fix

- [ ] The production code change addresses exactly the finding described in the master tracker
- [ ] No additional findings are silently fixed or introduced without creating new tracker entries
- [ ] The idempotency key (if applicable) is deterministic and bound to the specific operation — not a random UUID generated at call time
- [ ] If the fix is for MM-07 + MM-05-A/B/C together, they ship in a single commit (no gap window between ledger write and idempotency key)

### When adding tests

- [ ] At least one targeted test exists that **would fail** if the fix were reverted
- [ ] The test exercises the actual production code path — not just a comparison function in isolation
- [ ] `npx vitest run <test-file>` has been run and exit code 0 has been observed in this session
- [ ] The test count and exit code are recorded before updating the master tracker

### When updating the master tracker

- [ ] The master tracker update is in the **same commit** as the production code change
- [ ] The `Fix` column contains the actual commit SHA (not "see PR" or "latest commit")
- [ ] The `Fix-Verified` column contains the actual test count and exit code
- [ ] If advancing to CLOSED: all four closure criteria in the Closure Rules section are met
- [ ] If superseding a finding: the original row's `Status` is set to `SUPERSEDED`; `Replaced-by` is populated; reason is recorded; original evidence is not deleted

### When a finding is reclassified

- [ ] The original finding ID is preserved with `Status: SUPERSEDED` — it is never deleted or silently rewritten
- [ ] New sub-findings start at `FINDING` stage, not `VERIFIED`
- [ ] The reclassification is recorded with a date and reason in the master tracker
- [ ] The original evidence documents are left in place

### What Kiro must never do

- ❌ Mark a finding CLOSED based on a markdown edit alone
- ❌ Claim tests pass without running them and observing exit code 0 in the current session
- ❌ Advance a finding from FINDING to CLOSED in a single step without passing through VERIFIED and FIX-VERIFIED
- ❌ Create a `-fixed.ts` file alongside a production file as a test stub
- ❌ Create a new finding without assigning it a stable ID and recording it in the master tracker
- ❌ Commit production code for a finding without updating the master tracker in the same commit
- ❌ Write a PR description that describes the investigation state from when the finding was discovered rather than the current state at time of PR

---

## Appendix B — Template: Advancing a Finding

When Kiro advances a finding's lifecycle stage, it must produce this block in the response:

```
## Lifecycle Update: [FINDING-ID]

Previous stage:  [VERIFIED / FIX / ...]
New stage:       [FIX / FIX-VERIFIED / CLOSED]

Evidence for this advance:
- Fix commit:     [SHA]
- Files changed:  [list]
- Test file:      [path]
- Tests run:      npx vitest run [test-file]
- Result:         [N] tests passed, exit code [0]
- Would-fail check: [describe which test fails if fix is reverted]

Master tracker updated: [yes/no — must be yes before this response ends]
```

This block must appear in the response **before** any summary or next-steps section.

---

## Appendix C — Template: New Finding

When Kiro discovers a new finding, it must produce this block:

```
## New Finding: [NEW-ID]

Title:           [short description]
Risk:            [CRITICAL / HIGH / MEDIUM / LOW / ARCHITECTURAL]
Code location:   [file path, line number(s)]
Condition:       [exact description of what the code does that is wrong]
Attack vector:   [how this could be exploited, or why it is unreliable/incorrect]
Impact:          [what happens if exploited or left unfixed]
Phase-1-ref:     [related existing finding ID, or "none"]

Finding stage:   CONFIRMED
Verification:    [VERIFIED if confirmed by code trace in this session / UNVERIFIED if only suspected]

Master tracker:  [added as FINDING stage with ID [NEW-ID]]
```

The new finding must be added to the master tracker before the session ends, even if Kiro does not intend to fix it in the same session.

---

## Appendix D — How to Handle MM-14 and MM-15 Before Starting P0 Work

MM-14 (`handleDisputeClosed()` overlap) and MM-15 (`transfer.failed` ledger reversal) are both at `FINDING` stage — unverified. Before the P0 fixes begin:

**MM-14 — required read:**
1. Open `app/api/stripe/webhook/route.ts`
2. Find `handleDisputeClosed()` function
3. Check: does it write a `WalletTransaction(CREDIT)` or `LedgerEntry`?
4. Cross-reference with `handleChargeRefunded()` to identify overlap
5. Record finding as CONFIRMED or REJECTED in the master tracker with the evidence

**MM-15 — required read:**
1. Open `app/api/stripe/webhook/route.ts`
2. Find `handleTransferFailed()` function
3. Check: does it reverse `appendLedgerEntry(PAYOUT_PAID)` and `incrementLedger()` entries?
4. If yes → finding REJECTED (correctly handled)
5. If no → finding CONFIRMED; add to P1 fix queue
6. Record in master tracker with the evidence

Both reads can be done in 10–15 minutes before starting MM-07/MM-05 implementation.  
Do not skip them — MM-14 in particular may affect the MM-07 fix design.
