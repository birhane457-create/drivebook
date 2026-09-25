# Cybersecurity Study Evidence Standard

## Purpose

This repository is an evidence-driven learning workspace. The goal is to demonstrate understanding and practical security reasoning, not simply accumulate notes.

## Minimum evidence

Each completed topic should contain evidence across these areas:

- **Knowledge:** explain the security concept accurately.
- **Practical:** perform a safe lab or controlled exercise.
- **Application:** map the concept to DriveBook.
- **Reasoning:** identify risk, trade-offs and assumptions.
- **Verification:** test or observe the control.
- **Defence:** explain the work without relying on prepared text.

## Evidence levels

| Level | Meaning |
|---|---|
| 0 — Mentioned | Term appears in notes |
| 1 — Explained | Concept can be explained |
| 2 — Demonstrated | Controlled lab demonstrates the concept |
| 3 — Applied | Concept is mapped to a real DriveBook component |
| 4 — Verified | Test/observation provides evidence for the control |
| 5 — Defended | Learner can explain method, result, limitations and alternatives |

A topic should normally reach Level 4 before being treated as technically verified and Level 5 before being treated as fully defended.

## Audit discipline

Where a security finding is identified, use:

`FINDING → VERIFIED → FIX → FIX-VERIFIED → CLOSED`

Additional states may be used where necessary:

- SUPERSEDED
- REJECTED
- REOPENED

### Critical rule

**TEST INFRASTRUCTURE READY ≠ TEST VERIFIED**

A test file, script, harness or deployment only establishes that testing can be performed. It does not establish that the security property has been proven.

Likewise:

- documentation ≠ implementation
- implementation ≠ verification
- unit tests ≠ production proof
- AI explanation ≠ independent evidence
- a claimed result ≠ an observed result

## Evidence record

For each practical exercise, record:

- repository
- branch
- commit SHA
- date
- command or procedure
- component/path
- expected result
- observed result
- evidence location
- limitations
- conclusion

Keep **fact**, **interpretation**, **risk**, **remediation**, and **verification** distinguishable.

## Production safety

Use staging, local environments, test accounts and synthetic data wherever possible.

Do not perform uncontrolled offensive testing against DriveBook production or third-party systems. Any authorized test must have a defined scope.

## Oral defence template

Be able to answer:

1. What security problem were you examining?
2. What asset or trust boundary was involved?
3. What was the threat?
4. What evidence did you collect?
5. What did the evidence actually prove?
6. What did it not prove?
7. What control or remediation was used?
8. How was the remediation verified?
9. What residual risk remains?
10. What would you do differently with more time?

## Handover requirement

A future reviewer must be able to determine from the folder and evidence records:

- current study stage
- completed versus unverified work
- relevant DriveBook component
- exact branch and commit
- test method
- observed result
- remaining gaps

No reviewer should need to reconstruct the project history from scattered commits.
