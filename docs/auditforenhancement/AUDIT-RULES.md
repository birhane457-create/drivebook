# Audit Rules

## Scope
Audit the existing DriveBook AI/Copilot implementation and the architecture required to make it more reliable, knowledgeable, secure, observable, and useful.

## Required finding format
Each finding should include:
- ID
- Title
- Evidence / exact path and symbol where possible
- Current behaviour
- Impact
- Assumptions
- Evidence required to verify unresolved claims
- Severity only after evidence
- Recommended disposition: VERIFIED / NEEDS VERIFICATION / NOT A FINDING / FIX REQUIRED / INFORMATIONAL

## Mandatory challenge
Do not inherit another auditor's conclusion during the independent phase. In cross-review, explicitly state agreements, disagreements, withdrawn findings, strengthened findings, missed findings, and what evidence would change the position.

## Priority principles
- Evidence over consensus.
- Tool correctness before model optimisation.
- Security incidents are not buried inside feature work.
- Read-only Copilot boundaries remain unless separately justified and approved.
- Empty, unavailable, partial, and error states must remain distinguishable.
- User/database content is untrusted data, not instructions.

## Model benchmarking
Do not assume current model names, capabilities, or availability. Benchmark actual candidates using DriveBook cases with defined quality, latency, and cost targets.
