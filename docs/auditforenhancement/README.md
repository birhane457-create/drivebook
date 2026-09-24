# DriveBook AI Enhancement — Multi-Model Audit

This branch is an isolated audit workspace. It must not change production application code.

## Method
1. Independent audits are completed before reviewers see each other's findings.
2. Each auditor records evidence, assumptions, severity, and confidence.
3. A second cross-review phase challenges the other audits.
4. Disagreements are resolved against repository/runtime evidence, not by majority vote.
5. Final engineering decisions are recorded separately from model opinions.

## Audit tracks
- GPT: `gpt-audit.md`
- Kimi: `kimi-audit.md`
- Claude: `claude-audit.md`
- Kiro: `kiro-audit.md`

## Evidence rule
Distinguish SOURCE CODE FACT, DOCUMENTATION CLAIM, INFERENCE, PRODUCTION FACT, and UNKNOWN. Do not mark a finding VERIFIED without sufficient evidence.

## Security
Any suspected live credential exposure is tracked separately from ordinary AI enhancement findings until verified.
